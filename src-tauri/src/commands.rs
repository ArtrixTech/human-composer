use std::sync::Mutex;

use tauri::{AppHandle, Emitter, Manager, State};

use crate::auto_assign::suggest_branch;
use crate::db::Database;
use crate::models::{
    AppSnapshot, BranchSuggestion, CompleteTaskResult, CreateTaskResult, ProjectGraph,
    ProjectSummary, Task, TaskStatus,
};
use crate::undo::{UndoAction, UndoStack};

pub struct AppState {
    pub db: Mutex<Database>,
    pub undo: UndoStack,
}

fn active_project_id(db: &Database) -> Result<String, String> {
    if let Some(id) = db
        .get_active_project_id()
        .map_err(|e| e.to_string())?
    {
        return Ok(id);
    }
    let projects = db.list_projects().map_err(|e| e.to_string())?;
    projects
        .first()
        .map(|p| p.id.clone())
        .ok_or_else(|| "No project available".to_string())
}

/// Build snapshot and emit **after** releasing the DB lock to avoid deadlocks
/// with tray refresh / other commands listening on `graph-updated`.
fn emit_snapshot(app: &AppHandle, state: &State<'_, AppState>, project_id: &str) -> Result<(), String> {
    let snapshot = {
        let db = state.db.lock().map_err(|e| e.to_string())?;
        db.build_app_snapshot(project_id).map_err(|e| e.to_string())?
    };
    let _ = app.emit("graph-updated", &snapshot);
    Ok(())
}

#[tauri::command]
pub fn list_projects(state: State<'_, AppState>) -> Result<Vec<ProjectSummary>, String> {
    state
        .db
        .lock()
        .map_err(|e| e.to_string())?
        .list_projects()
        .map_err(|e| e.to_string())
}

#[tauri::command]
pub fn create_project(
    app: AppHandle,
    state: State<'_, AppState>,
    name: String,
) -> Result<String, String> {
    let id = {
        let db = state.db.lock().map_err(|e| e.to_string())?;
        let id = db.create_project(&name).map_err(|e| e.to_string())?;
        db.set_active_project_id(&id).map_err(|e| e.to_string())?;
        id
    };
    emit_snapshot(&app, &state, &id)?;
    Ok(id)
}

#[tauri::command]
pub fn set_active_project(
    app: AppHandle,
    state: State<'_, AppState>,
    project_id: String,
) -> Result<(), String> {
    {
        let db = state.db.lock().map_err(|e| e.to_string())?;
        db.set_active_project_id(&project_id)
            .map_err(|e| e.to_string())?;
    }
    emit_snapshot(&app, &state, &project_id)
}

#[tauri::command]
pub fn get_project_graph(state: State<'_, AppState>, project_id: String) -> Result<ProjectGraph, String> {
    state
        .db
        .lock()
        .map_err(|e| e.to_string())?
        .get_project_graph(&project_id)
        .map_err(|e| e.to_string())
}

#[tauri::command]
pub fn get_app_snapshot(state: State<'_, AppState>, project_id: Option<String>) -> Result<AppSnapshot, String> {
    let db = state.db.lock().map_err(|e| e.to_string())?;
    let pid = project_id.unwrap_or_else(|| active_project_id(&db).unwrap_or_default());
    db.build_app_snapshot(&pid).map_err(|e| e.to_string())
}

#[tauri::command]
pub fn create_branch(
    app: AppHandle,
    state: State<'_, AppState>,
    project_id: String,
    name: String,
) -> Result<String, String> {
    let id = {
        let db = state.db.lock().map_err(|e| e.to_string())?;
        db.create_branch(&project_id, &name).map_err(|e| e.to_string())?
    };
    emit_snapshot(&app, &state, &project_id)?;
    Ok(id)
}

#[tauri::command]
pub fn create_task(
    app: AppHandle,
    state: State<'_, AppState>,
    project_id: String,
    branch_id: Option<String>,
    title: String,
) -> Result<CreateTaskResult, String> {
    let (task, branch_suggestion) = {
        let db = state.db.lock().map_err(|e| e.to_string())?;

        let task_id = if let Some(bid) = &branch_id {
            db.append_task_to_branch(&project_id, bid, &title)
                .map_err(|e| e.to_string())?
        } else {
            db.create_inbox_task(&project_id, &title)
                .map_err(|e| e.to_string())?
        };

        if branch_id.is_some() {
            db.recalculate_project_statuses(&project_id)
                .map_err(|e| e.to_string())?;
        }

        let task = db.get_task(&task_id).map_err(|e| e.to_string())?;
        state.undo.push(UndoAction::TaskCreated {
            task_id: task_id.clone(),
        });

        let graph = db.get_project_graph(&project_id).map_err(|e| e.to_string())?;
        let branch_suggestion = if branch_id.is_none() {
            suggest_branch(&title, &graph.branches)
        } else {
            None
        };

        (task, branch_suggestion)
    };

    emit_snapshot(&app, &state, &project_id)?;

    Ok(CreateTaskResult {
        task,
        branch_suggestion,
    })
}

#[tauri::command]
pub fn assign_task_to_branch(
    app: AppHandle,
    state: State<'_, AppState>,
    task_id: String,
    branch_id: String,
) -> Result<Task, String> {
    let (project_id, task) = {
        let db = state.db.lock().map_err(|e| e.to_string())?;
        let project_id = db.project_id_for_branch(&branch_id).map_err(|e| e.to_string())?;
        let task = db
            .assign_task_to_branch(&task_id, &branch_id)
            .map_err(|e| e.to_string())?;
        (project_id, task)
    };
    emit_snapshot(&app, &state, &project_id)?;
    Ok(task)
}

#[tauri::command]
pub fn add_dependency(
    app: AppHandle,
    state: State<'_, AppState>,
    task_id: String,
    depends_on_task_id: String,
) -> Result<(), String> {
    let project_id = {
        let db = state.db.lock().map_err(|e| e.to_string())?;
        db.add_dependency(&task_id, &depends_on_task_id)
            .map_err(|e| e.to_string())?;
        let project_id = db.project_id_for_task(&task_id).map_err(|e| e.to_string())?;
        db.recalculate_project_statuses(&project_id)
            .map_err(|e| e.to_string())?;
        project_id
    };
    emit_snapshot(&app, &state, &project_id)
}

#[tauri::command]
pub fn remove_dependency(
    app: AppHandle,
    state: State<'_, AppState>,
    task_id: String,
    depends_on_task_id: String,
) -> Result<(), String> {
    let project_id = {
        let db = state.db.lock().map_err(|e| e.to_string())?;
        let project_id = db.project_id_for_task(&task_id).map_err(|e| e.to_string())?;
        db.remove_dependency(&task_id, &depends_on_task_id)
            .map_err(|e| e.to_string())?;
        project_id
    };
    emit_snapshot(&app, &state, &project_id)
}

#[tauri::command]
pub fn update_task(
    app: AppHandle,
    state: State<'_, AppState>,
    project_id: String,
    task_id: String,
    title: Option<String>,
    description: Option<String>,
) -> Result<Task, String> {
    let task = {
        let db = state.db.lock().map_err(|e| e.to_string())?;
        db.update_task(&task_id, title.as_deref(), description.as_deref())
            .map_err(|e| e.to_string())?
    };
    emit_snapshot(&app, &state, &project_id)?;
    Ok(task)
}

#[tauri::command]
pub fn delete_task(
    app: AppHandle,
    state: State<'_, AppState>,
    project_id: String,
    task_id: String,
) -> Result<(), String> {
    {
        let db = state.db.lock().map_err(|e| e.to_string())?;
        db.delete_task(&task_id).map_err(|e| e.to_string())?;
    }
    emit_snapshot(&app, &state, &project_id)
}

#[tauri::command]
pub fn set_task_status(
    app: AppHandle,
    state: State<'_, AppState>,
    project_id: String,
    task_id: String,
    status: String,
) -> Result<Task, String> {
    let task_status = TaskStatus::from_str(&status).ok_or_else(|| format!("Invalid status: {status}"))?;
    let task = {
        let db = state.db.lock().map_err(|e| e.to_string())?;
        let previous = db.get_task(&task_id).map_err(|e| e.to_string())?;
        state.undo.push(UndoAction::TaskStatus {
            task_id: task_id.clone(),
            previous_status: previous.status.clone(),
        });
        db.set_task_status(&task_id, task_status)
            .map_err(|e| e.to_string())?
    };
    emit_snapshot(&app, &state, &project_id)?;
    Ok(task)
}

#[tauri::command]
pub fn activate_task(
    app: AppHandle,
    state: State<'_, AppState>,
    task_id: String,
    project_id: String,
) -> Result<Task, String> {
    let task = {
        let db = state.db.lock().map_err(|e| e.to_string())?;
        db.activate_task(&task_id, &project_id)
            .map_err(|e| e.to_string())?
    };
    emit_snapshot(&app, &state, &project_id)?;
    Ok(task)
}

#[tauri::command]
pub fn complete_task(
    app: AppHandle,
    state: State<'_, AppState>,
    task_id: String,
    project_id: String,
) -> Result<CompleteTaskResult, String> {
    let (completed_task, recommendations) = {
        let db = state.db.lock().map_err(|e| e.to_string())?;
        let previous = db.get_task(&task_id).map_err(|e| e.to_string())?;
        state.undo.push(UndoAction::TaskStatus {
            task_id: task_id.clone(),
            previous_status: previous.status,
        });
        db.complete_task(&task_id, &project_id)
            .map_err(|e| e.to_string())?
    };
    emit_snapshot(&app, &state, &project_id)?;
    Ok(CompleteTaskResult {
        completed_task,
        recommendations,
    })
}

#[tauri::command]
pub fn pin_task(
    app: AppHandle,
    state: State<'_, AppState>,
    project_id: String,
    task_id: String,
    pinned: bool,
) -> Result<Task, String> {
    let task = {
        let db = state.db.lock().map_err(|e| e.to_string())?;
        db.set_task_pinned(&task_id, pinned)
            .map_err(|e| e.to_string())?
    };
    emit_snapshot(&app, &state, &project_id)?;
    Ok(task)
}

#[tauri::command]
pub fn archive_branch(
    app: AppHandle,
    state: State<'_, AppState>,
    project_id: String,
    branch_id: String,
) -> Result<(), String> {
    {
        let db = state.db.lock().map_err(|e| e.to_string())?;
        db.archive_branch(&branch_id).map_err(|e| e.to_string())?;
    }
    emit_snapshot(&app, &state, &project_id)
}

#[tauri::command]
pub fn suggest_branch_for_task(
    state: State<'_, AppState>,
    project_id: String,
    title: String,
) -> Result<Option<BranchSuggestion>, String> {
    let db = state.db.lock().map_err(|e| e.to_string())?;
    let graph = db.get_project_graph(&project_id).map_err(|e| e.to_string())?;
    Ok(suggest_branch(&title, &graph.branches))
}

#[tauri::command]
pub fn undo_last_action(
    app: AppHandle,
    state: State<'_, AppState>,
    project_id: String,
) -> Result<(), String> {
    let action = state
        .undo
        .pop()
        .ok_or_else(|| "Nothing to undo".to_string())?;

    {
        let db = state.db.lock().map_err(|e| e.to_string())?;
        match action {
            UndoAction::TaskStatus {
                task_id,
                previous_status,
            } => {
                db.set_task_status(&task_id, previous_status)
                    .map_err(|e| e.to_string())?;
            }
            UndoAction::TaskCreated { task_id } => {
                db.delete_task(&task_id).map_err(|e| e.to_string())?;
            }
        }
    }
    emit_snapshot(&app, &state, &project_id)
}

#[tauri::command]
pub fn list_project_sources() -> Vec<String> {
    crate::sources::registry()
        .into_iter()
        .map(|s| s.source_type().to_string())
        .collect()
}

#[tauri::command]
pub fn show_main_window(app: AppHandle) -> Result<(), String> {
    if let Some(window) = app.get_webview_window("main") {
        window.show().map_err(|e| e.to_string())?;
        window.set_focus().map_err(|e| e.to_string())?;
    }
    Ok(())
}

#[tauri::command]
pub fn toggle_floating_expanded(app: AppHandle) -> Result<(), String> {
    if let Some(window) = app.get_webview_window("floating") {
        let expanded = window
            .is_visible()
            .map_err(|e| e.to_string())?
            && window.inner_size().map_err(|e| e.to_string())?.height > 100;
        if expanded {
            let _ = window.set_size(tauri::LogicalSize::new(220.0, 52.0));
        } else {
            let _ = window.set_size(tauri::LogicalSize::new(320.0, 400.0));
        }
    }
    Ok(())
}
