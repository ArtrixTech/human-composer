use std::sync::Mutex;

use tauri::{AppHandle, Emitter, Manager, State};

use crate::db::Database;
use crate::llm::{get_llm_config, set_llm_config, suggest_outcome_with_llm, test_llm_connection};
use crate::models::{
    AppSnapshot, Branch, BranchSuggestion, CompleteTaskResult, CreateTaskResult, DayLane,
    DayLaneType, DayRunwaySnapshot, LaneTier, LlmConfig, PriorityLevel, ProjectGraph, ProjectSummary,
    Task,
    TaskStatus, TodaySnapshot,
};
use crate::undo::{UndoAction, UndoStack};
use crate::runway::local_date_string;

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
    let (snapshot, runway) = {
        let db = state.db.lock().map_err(|e| e.to_string())?;
        let snapshot = db.build_app_snapshot(project_id).map_err(|e| e.to_string())?;
        let runway = db.build_day_runway_snapshot().map_err(|e| e.to_string())?;
        (snapshot, runway)
    };
    let _ = app.emit("graph-updated", &snapshot);
    let _ = app.emit("runway-updated", &runway);
    let _ = app.emit("today-updated", &runway);
    Ok(())
}

fn emit_runway_only(app: &AppHandle, state: &State<'_, AppState>) -> Result<(), String> {
    let runway = {
        let db = state.db.lock().map_err(|e| e.to_string())?;
        db.build_day_runway_snapshot().map_err(|e| e.to_string())?
    };
    let _ = app.emit("runway-updated", &runway);
    let _ = app.emit("today-updated", &runway);
    Ok(())
}

#[tauri::command]
pub fn get_today_snapshot(state: State<'_, AppState>) -> Result<TodaySnapshot, String> {
    state
        .db
        .lock()
        .map_err(|e| e.to_string())?
        .build_today_snapshot()
        .map_err(|e| e.to_string())
}

#[tauri::command]
pub fn get_day_runway_snapshot(state: State<'_, AppState>) -> Result<DayRunwaySnapshot, String> {
    state
        .db
        .lock()
        .map_err(|e| e.to_string())?
        .build_day_runway_snapshot()
        .map_err(|e| e.to_string())
}

#[tauri::command]
pub fn get_enabled_lane_count(state: State<'_, AppState>) -> Result<i32, String> {
    state
        .db
        .lock()
        .map_err(|e| e.to_string())?
        .get_enabled_lane_count()
        .map_err(|e| e.to_string())
}

#[tauri::command]
pub fn set_enabled_lane_count(
    app: AppHandle,
    state: State<'_, AppState>,
    count: i32,
) -> Result<(), String> {
    {
        let db = state.db.lock().map_err(|e| e.to_string())?;
        db.set_enabled_lane_count(count).map_err(|e| e.to_string())?;
    }
    emit_runway_only(&app, &state)
}

#[tauri::command]
pub fn reorganize_runway_lanes(
    app: AppHandle,
    state: State<'_, AppState>,
    date: Option<String>,
) -> Result<i32, String> {
    let date = date.unwrap_or_else(local_date_string);
    let moved = {
        let db = state.db.lock().map_err(|e| e.to_string())?;
        db.reorganize_focus_lanes(&date).map_err(|e| e.to_string())?
    };
    emit_runway_only(&app, &state)?;
    Ok(moved)
}

#[tauri::command]
pub fn auto_populate_runway(state: State<'_, AppState>, date: Option<String>) -> Result<(), String> {
    let date = date.unwrap_or_else(local_date_string);
    {
        let db = state.db.lock().map_err(|e| e.to_string())?;
        db.auto_populate_runway(&date).map_err(|e| e.to_string())?;
    }
    Ok(())
}

#[tauri::command]
pub fn create_day_lane(
    app: AppHandle,
    state: State<'_, AppState>,
    date: Option<String>,
    name: String,
    lane_type: String,
    priority_tier: Option<String>,
) -> Result<DayLane, String> {
    let date = date.unwrap_or_else(local_date_string);
    let lt = DayLaneType::from_str(&lane_type);
    let tier = priority_tier
        .map(|p| LaneTier::from_str(&p))
        .unwrap_or(LaneTier::Sub);
    let lane = {
        let db = state.db.lock().map_err(|e| e.to_string())?;
        db.create_day_lane_with_tier(&date, &name, lt, tier)
            .map_err(|e| e.to_string())?
    };
    emit_runway_only(&app, &state)?;
    Ok(lane)
}

#[tauri::command]
pub fn close_day_lane(app: AppHandle, state: State<'_, AppState>, lane_id: String) -> Result<(), String> {
    {
        let db = state.db.lock().map_err(|e| e.to_string())?;
        db.close_day_lane(&lane_id).map_err(|e| e.to_string())?;
    }
    emit_runway_only(&app, &state)
}

#[tauri::command]
pub fn rename_day_lane(
    app: AppHandle,
    state: State<'_, AppState>,
    lane_id: String,
    name: String,
) -> Result<DayLane, String> {
    let lane = {
        let db = state.db.lock().map_err(|e| e.to_string())?;
        db.rename_day_lane(&lane_id, &name).map_err(|e| e.to_string())?
    };
    emit_runway_only(&app, &state)?;
    Ok(lane)
}

#[tauri::command]
pub fn reorder_day_lanes(
    app: AppHandle,
    state: State<'_, AppState>,
    date: Option<String>,
    lane_ids: Vec<String>,
) -> Result<(), String> {
    let date = date.unwrap_or_else(local_date_string);
    {
        let db = state.db.lock().map_err(|e| e.to_string())?;
        db.reorder_day_lanes(&date, &lane_ids).map_err(|e| e.to_string())?;
    }
    emit_runway_only(&app, &state)
}

#[tauri::command]
pub fn assign_task_to_lane(
    app: AppHandle,
    state: State<'_, AppState>,
    task_id: String,
    lane_id: String,
    position: Option<i32>,
) -> Result<(), String> {
    {
        let db = state.db.lock().map_err(|e| e.to_string())?;
        db.assign_task_to_lane(&task_id, &lane_id, position)
            .map_err(|e| e.to_string())?;
    }
    emit_runway_only(&app, &state)
}

#[tauri::command]
pub fn remove_task_from_lane(
    app: AppHandle,
    state: State<'_, AppState>,
    task_id: String,
    lane_id: String,
) -> Result<(), String> {
    {
        let db = state.db.lock().map_err(|e| e.to_string())?;
        db.remove_task_from_lane(&task_id, &lane_id)
            .map_err(|e| e.to_string())?;
    }
    emit_runway_only(&app, &state)
}

#[tauri::command]
pub fn reorder_lane_tasks(
    app: AppHandle,
    state: State<'_, AppState>,
    lane_id: String,
    task_ids: Vec<String>,
) -> Result<(), String> {
    {
        let db = state.db.lock().map_err(|e| e.to_string())?;
        db.reorder_lane_tasks(&lane_id, &task_ids)
            .map_err(|e| e.to_string())?;
    }
    emit_runway_only(&app, &state)
}

#[tauri::command]
pub fn move_task_between_lanes(
    app: AppHandle,
    state: State<'_, AppState>,
    task_id: String,
    from_lane_id: String,
    to_lane_id: String,
    position: Option<i32>,
) -> Result<(), String> {
    {
        let db = state.db.lock().map_err(|e| e.to_string())?;
        db.move_task_between_lanes(&task_id, &from_lane_id, &to_lane_id, position)
            .map_err(|e| e.to_string())?;
    }
    emit_runway_only(&app, &state)
}

#[tauri::command]
pub fn claim_task(
    app: AppHandle,
    state: State<'_, AppState>,
    task_id: String,
    lane_id: String,
    project_id: String,
) -> Result<Task, String> {
    let task = {
        let db = state.db.lock().map_err(|e| e.to_string())?;
        db.claim_task(&task_id, &lane_id).map_err(|e| e.to_string())?
    };
    emit_snapshot(&app, &state, &project_id)?;
    Ok(task)
}

#[tauri::command]
pub fn postpone_task(
    app: AppHandle,
    state: State<'_, AppState>,
    task_id: String,
    lane_id: String,
    project_id: String,
) -> Result<Task, String> {
    let task = {
        let db = state.db.lock().map_err(|e| e.to_string())?;
        db.postpone_task(&task_id, &lane_id)
            .map_err(|e| e.to_string())?
    };
    emit_snapshot(&app, &state, &project_id)?;
    Ok(task)
}

#[tauri::command]
pub fn start_external_task(
    app: AppHandle,
    state: State<'_, AppState>,
    task_id: String,
    project_id: String,
    lane_id: Option<String>,
    estimated_minutes: i32,
    note: Option<String>,
) -> Result<Task, String> {
    let date = local_date_string();
    let task = {
        let db = state.db.lock().map_err(|e| e.to_string())?;
        // Resolve source lane and always land on a watch lane
        let source_lane = lane_id.as_deref().and_then(|lid| db.get_day_lane(lid).ok());
        match source_lane {
            Some(ref lane) if lane.lane_type == DayLaneType::Watch => {
                // Already in a watch lane — ensure assignment (idempotent)
                db.assign_task_to_lane(&task_id, &lane.id, None).ok();
            }
            Some(ref focus_lane) => {
                // Source is a focus lane — move task to the shared watch lane
                let watch = db
                    .find_or_create_watch_lane(&date, "等待外部")
                    .map_err(|e| e.to_string())?;
                db.move_task_between_lanes(&task_id, &focus_lane.id, &watch.id, None)
                    .map_err(|e| e.to_string())?;
            }
            None => {
                // No source lane (backlog / task not in any lane) — assign to watch lane
                let watch = db
                    .find_or_create_watch_lane(&date, "等待外部")
                    .map_err(|e| e.to_string())?;
                db.assign_task_to_lane(&task_id, &watch.id, None)
                    .map_err(|e| e.to_string())?;
            }
        }
        db.start_external_task(&task_id, estimated_minutes, note.as_deref())
            .map_err(|e| e.to_string())?
    };
    emit_snapshot(&app, &state, &project_id)?;
    Ok(task)
}

#[tauri::command]
pub fn complete_external_task(
    app: AppHandle,
    state: State<'_, AppState>,
    task_id: String,
    project_id: String,
) -> Result<Task, String> {
    let task = {
        let db = state.db.lock().map_err(|e| e.to_string())?;
        db.complete_external_task(&task_id).map_err(|e| e.to_string())?
    };
    emit_snapshot(&app, &state, &project_id)?;
    Ok(task)
}

#[tauri::command]
pub fn review_external_task(
    app: AppHandle,
    state: State<'_, AppState>,
    task_id: String,
    project_id: String,
    action: String,
) -> Result<Task, String> {
    let task = {
        let db = state.db.lock().map_err(|e| e.to_string())?;
        db.review_external_task(&task_id, &action)
            .map_err(|e| e.to_string())?
    };
    emit_snapshot(&app, &state, &project_id)?;
    Ok(task)
}

#[tauri::command]
pub fn set_task_estimated_minutes(
    app: AppHandle,
    state: State<'_, AppState>,
    project_id: String,
    task_id: String,
    minutes: i32,
) -> Result<Task, String> {
    let task = {
        let db = state.db.lock().map_err(|e| e.to_string())?;
        db.set_task_estimated_minutes(&task_id, minutes)
            .map_err(|e| e.to_string())?
    };
    emit_snapshot(&app, &state, &project_id)?;
    Ok(task)
}

#[tauri::command]
pub fn rename_branch(
    app: AppHandle,
    state: State<'_, AppState>,
    project_id: String,
    branch_id: String,
    name: String,
) -> Result<Branch, String> {
    let branch = {
        let db = state.db.lock().map_err(|e| e.to_string())?;
        db.rename_branch(&branch_id, &name).map_err(|e| e.to_string())?
    };
    emit_snapshot(&app, &state, &project_id)?;
    Ok(branch)
}

#[tauri::command]
pub fn list_archived_branches(
    state: State<'_, AppState>,
    project_id: String,
) -> Result<Vec<Branch>, String> {
    state
        .db
        .lock()
        .map_err(|e| e.to_string())?
        .list_archived_branches(&project_id)
        .map_err(|e| e.to_string())
}

#[tauri::command]
pub fn unarchive_branch(
    app: AppHandle,
    state: State<'_, AppState>,
    project_id: String,
    branch_id: String,
) -> Result<Branch, String> {
    let branch = {
        let db = state.db.lock().map_err(|e| e.to_string())?;
        db.unarchive_branch(&branch_id).map_err(|e| e.to_string())?
    };
    emit_snapshot(&app, &state, &project_id)?;
    Ok(branch)
}

#[tauri::command]
pub fn delete_project(
    app: AppHandle,
    state: State<'_, AppState>,
    project_id: String,
) -> Result<(), String> {
    {
        let db = state.db.lock().map_err(|e| e.to_string())?;
        db.delete_project(&project_id).map_err(|e| e.to_string())?;
    }
    let fallback = {
        let db = state.db.lock().map_err(|e| e.to_string())?;
        db.list_projects().ok().and_then(|p| p.first().map(|x| x.id.clone()))
    };
    if let Some(pid) = fallback {
        emit_snapshot(&app, &state, &pid)?;
    } else {
        emit_runway_only(&app, &state)?;
    }
    Ok(())
}

#[tauri::command]
pub fn reorder_task(
    app: AppHandle,
    state: State<'_, AppState>,
    project_id: String,
    task_id: String,
    direction: String,
) -> Result<Task, String> {
    let task = {
        let db = state.db.lock().map_err(|e| e.to_string())?;
        db.reorder_task(&task_id, &direction)
            .map_err(|e| e.to_string())?
    };
    emit_snapshot(&app, &state, &project_id)?;
    Ok(task)
}

#[tauri::command]
pub fn focus_floating_for_quick_add(app: AppHandle) -> Result<(), String> {
    if let Some(window) = app.get_webview_window("floating") {
        window.show().map_err(|e| e.to_string())?;
        window.set_focus().map_err(|e| e.to_string())?;
        let _ = window.set_size(tauri::LogicalSize::new(320.0, 400.0));
        let _ = app.emit("floating-focus-input", ());
    }
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
pub async fn create_task(
    app: AppHandle,
    state: State<'_, AppState>,
    project_id: String,
    branch_id: Option<String>,
    title: String,
) -> Result<CreateTaskResult, String> {
    let (task, inbox_ctx) = {
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

        let inbox_ctx = if branch_id.is_none() {
            let graph = db.get_project_graph(&project_id).map_err(|e| e.to_string())?;
            let llm_config = get_llm_config(&db)?;
            Some((
                graph.project.name,
                graph.branches,
                llm_config,
            ))
        } else {
            None
        };

        if branch_id.is_some() {
            let _ = db.auto_slot_action_to_lane(&task_id);
        }

        (task, inbox_ctx)
    };

    let branch_suggestion = if let Some((project_name, branches, llm_config)) = inbox_ctx {
        suggest_outcome_with_llm(&llm_config, &title, &project_name, &branches).await
    } else {
        None
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
        let _ = db.auto_slot_action_to_lane(&task_id);
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
pub fn delete_branch(
    app: AppHandle,
    state: State<'_, AppState>,
    project_id: String,
    branch_id: String,
) -> Result<(), String> {
    {
        let db = state.db.lock().map_err(|e| e.to_string())?;
        db.delete_branch(&branch_id).map_err(|e| e.to_string())?;
    }
    emit_snapshot(&app, &state, &project_id)
}

#[tauri::command]
pub fn reorder_branches(
    app: AppHandle,
    state: State<'_, AppState>,
    project_id: String,
    branch_ids: Vec<String>,
) -> Result<(), String> {
    {
        let db = state.db.lock().map_err(|e| e.to_string())?;
        db.reorder_branches(&project_id, &branch_ids)
            .map_err(|e| e.to_string())?;
    }
    emit_snapshot(&app, &state, &project_id)
}

#[tauri::command]
pub fn set_task_priority(
    app: AppHandle,
    state: State<'_, AppState>,
    project_id: String,
    task_id: String,
    priority: String,
) -> Result<Task, String> {
    let level = PriorityLevel::from_str(&priority);
    let task = {
        let db = state.db.lock().map_err(|e| e.to_string())?;
        db.set_task_priority(&task_id, level)
            .map_err(|e| e.to_string())?
    };
    emit_snapshot(&app, &state, &project_id)?;
    Ok(task)
}

#[tauri::command]
pub fn archive_task(
    app: AppHandle,
    state: State<'_, AppState>,
    project_id: String,
    task_id: String,
) -> Result<Task, String> {
    let task = {
        let db = state.db.lock().map_err(|e| e.to_string())?;
        db.archive_task(&task_id).map_err(|e| e.to_string())?
    };
    emit_snapshot(&app, &state, &project_id)?;
    emit_runway_only(&app, &state)?;
    Ok(task)
}

#[tauri::command]
pub fn unarchive_task(
    app: AppHandle,
    state: State<'_, AppState>,
    project_id: String,
    task_id: String,
) -> Result<Task, String> {
    let task = {
        let db = state.db.lock().map_err(|e| e.to_string())?;
        db.unarchive_task(&task_id).map_err(|e| e.to_string())?
    };
    emit_snapshot(&app, &state, &project_id)?;
    Ok(task)
}

#[tauri::command]
pub fn list_archived_tasks(
    state: State<'_, AppState>,
    project_id: String,
) -> Result<Vec<Task>, String> {
    state
        .db
        .lock()
        .map_err(|e| e.to_string())?
        .get_archived_tasks_for_project(&project_id)
        .map_err(|e| e.to_string())
}

#[tauri::command]
pub fn reorder_branch_tasks(
    app: AppHandle,
    state: State<'_, AppState>,
    project_id: String,
    branch_id: String,
    task_ids: Vec<String>,
) -> Result<(), String> {
    {
        let db = state.db.lock().map_err(|e| e.to_string())?;
        db.reorder_branch_tasks(&branch_id, &task_ids)
            .map_err(|e| e.to_string())?;
    }
    emit_snapshot(&app, &state, &project_id)
}

#[tauri::command]
pub async fn suggest_branch_for_task(
    state: State<'_, AppState>,
    project_id: String,
    title: String,
) -> Result<Option<BranchSuggestion>, String> {
    let (project_name, branches, llm_config) = {
        let db = state.db.lock().map_err(|e| e.to_string())?;
        let graph = db.get_project_graph(&project_id).map_err(|e| e.to_string())?;
        let llm_config = get_llm_config(&db)?;
        (graph.project.name, graph.branches, llm_config)
    };
    Ok(
        suggest_outcome_with_llm(&llm_config, &title, &project_name, &branches).await,
    )
}

#[tauri::command]
pub fn get_llm_config_cmd(state: State<'_, AppState>) -> Result<LlmConfig, String> {
    let db = state.db.lock().map_err(|e| e.to_string())?;
    get_llm_config(&db)
}

#[tauri::command]
pub fn set_llm_config_cmd(state: State<'_, AppState>, config: LlmConfig) -> Result<(), String> {
    let db = state.db.lock().map_err(|e| e.to_string())?;
    set_llm_config(&db, &config)
}

#[tauri::command]
pub async fn test_llm_connection_cmd(config: LlmConfig) -> Result<String, String> {
    test_llm_connection(&config).await
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
        let _ = app.emit("main-show-today", ());
    }
    Ok(())
}

#[tauri::command]
pub fn get_floating_notice_message() -> String {
    notice::pending_message()
}

mod notice {
    use std::sync::Mutex;

    static PENDING: Mutex<String> = Mutex::new(String::new());

    pub fn set_pending(message: &str) {
        if let Ok(mut pending) = PENDING.lock() {
            *pending = message.to_string();
        }
    }

    pub fn pending_message() -> String {
        PENDING.lock().map(|s| s.clone()).unwrap_or_default()
    }

    pub fn clear_pending() {
        if let Ok(mut pending) = PENDING.lock() {
            pending.clear();
        }
    }
}

#[tauri::command]
pub fn show_floating_notice(app: AppHandle, message: String) -> Result<(), String> {
    use std::sync::atomic::{AtomicU64, Ordering};
    use std::time::Duration;

    static NOTICE_GEN: AtomicU64 = AtomicU64::new(0);

    const NOTICE_GAP: f64 = 4.0;
    const NOTICE_HEIGHT: f64 = 28.0;

    notice::set_pending(&message);

    let floating = app
        .get_webview_window("floating")
        .ok_or("floating window not found")?;
    let notice = app
        .get_webview_window("floating-notice")
        .ok_or("floating-notice window not found")?;

    let scale = floating.scale_factor().map_err(|e| e.to_string())?;
    let pos = floating.outer_position().map_err(|e| e.to_string())?;
    let size = floating.outer_size().map_err(|e| e.to_string())?;

    let width = size.width as f64 / scale;
    let x = pos.x as f64 / scale;
    let y = pos.y as f64 / scale + size.height as f64 / scale + NOTICE_GAP;

    notice
        .set_size(tauri::LogicalSize::new(width, NOTICE_HEIGHT))
        .map_err(|e| e.to_string())?;
    notice
        .set_position(tauri::LogicalPosition::new(x, y))
        .map_err(|e| e.to_string())?;
    let _ = notice.set_always_on_top(true);
    let _ = notice.emit("floating-notice-message", &message);
    notice.show().map_err(|e| e.to_string())?;

    let generation = NOTICE_GEN.fetch_add(1, Ordering::SeqCst) + 1;
    let app_clone = app.clone();
    std::thread::spawn(move || {
        std::thread::sleep(Duration::from_millis(2000));
        if NOTICE_GEN.load(Ordering::SeqCst) != generation {
            return;
        }
        notice::clear_pending();
        if let Some(window) = app_clone.get_webview_window("floating-notice") {
            let _ = window.emit("floating-notice-message", "");
            let _ = window.hide();
        }
    });

    Ok(())
}

#[tauri::command]
pub fn toggle_floating_expanded(app: AppHandle) -> Result<(), String> {
    let _ = app.emit("floating-toggle-expand", ());
    Ok(())
}
