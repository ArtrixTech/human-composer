use crate::models::{Branch, Project, Task, TaskStatus};
use crate::AppState;
use chrono::Utc;
use rusqlite::params;
use tauri::State;
use uuid::Uuid;

// ─── helpers ──────────────────────────────────────────────────────────────────

fn query_task(db: &rusqlite::Connection, id: &str) -> Result<Task, String> {
    db.query_row(
        "SELECT id, branch_id, project_id, title, description, status, sort_order, created_at, completed_at
         FROM tasks WHERE id = ?1",
        params![id],
        |row| {
            let status_str: String = row.get(5)?;
            Ok(Task {
                id: row.get(0)?,
                branch_id: row.get(1)?,
                project_id: row.get(2)?,
                title: row.get(3)?,
                description: row.get(4)?,
                status: TaskStatus::from(status_str.as_str()),
                sort_order: row.get(6)?,
                created_at: row.get(7)?,
                completed_at: row.get(8)?,
            })
        },
    )
    .map_err(|e| e.to_string())
}

fn cascade_ready(db: &rusqlite::Connection, completed_task_id: &str) -> Result<Vec<Task>, String> {
    let dependent_ids: Vec<String> = {
        let mut stmt = db
            .prepare("SELECT task_id FROM task_dependencies WHERE depends_on_task_id = ?1")
            .map_err(|e| e.to_string())?;
        stmt.query_map(params![completed_task_id], |row| row.get(0))
            .map_err(|e| e.to_string())?
            .collect::<Result<Vec<_>, _>>()
            .map_err(|e| e.to_string())?
    };

    let mut newly_ready = Vec::new();
    for dep_id in dependent_ids {
        let pending_count: i32 = db
            .query_row(
                "SELECT COUNT(*) FROM task_dependencies td
                 JOIN tasks t ON td.depends_on_task_id = t.id
                 WHERE td.task_id = ?1 AND t.status != 'done'",
                params![dep_id],
                |row| row.get(0),
            )
            .map_err(|e| e.to_string())?;

        if pending_count == 0 {
            db.execute(
                "UPDATE tasks SET status = 'ready' WHERE id = ?1 AND status = 'pending'",
                params![dep_id],
            )
            .map_err(|e| e.to_string())?;
            let task = query_task(db, &dep_id)?;
            if task.status == TaskStatus::Ready {
                newly_ready.push(task);
            }
        }
    }
    Ok(newly_ready)
}

// ─── projects ─────────────────────────────────────────────────────────────────

#[tauri::command]
pub fn get_projects(state: State<AppState>) -> Result<Vec<Project>, String> {
    let db = state.db.lock().map_err(|e| e.to_string())?;
    let mut stmt = db
        .prepare(
            "SELECT id, name, source_type, source_ref, created_at
             FROM projects ORDER BY created_at",
        )
        .map_err(|e| e.to_string())?;
    stmt.query_map([], |row| {
        Ok(Project {
            id: row.get(0)?,
            name: row.get(1)?,
            source_type: row.get(2)?,
            source_ref: row.get(3)?,
            created_at: row.get(4)?,
        })
    })
    .map_err(|e| e.to_string())?
    .collect::<Result<Vec<_>, _>>()
    .map_err(|e| e.to_string())
}

#[tauri::command]
pub fn create_project(
    name: String,
    state: State<AppState>,
    app: tauri::AppHandle,
) -> Result<Project, String> {
    let db = state.db.lock().map_err(|e| e.to_string())?;
    let id = Uuid::new_v4().to_string();
    let created_at = Utc::now().to_rfc3339();
    db.execute(
        "INSERT INTO projects (id, name, source_type, created_at) VALUES (?1, ?2, 'manual', ?3)",
        params![id, name, created_at],
    )
    .map_err(|e| e.to_string())?;
    let project = Project {
        id,
        name,
        source_type: "manual".to_string(),
        source_ref: None,
        created_at,
    };
    let _ = app.emit("project-created", &project);
    Ok(project)
}

#[tauri::command]
pub fn delete_project(
    id: String,
    state: State<AppState>,
    app: tauri::AppHandle,
) -> Result<(), String> {
    let db = state.db.lock().map_err(|e| e.to_string())?;
    db.execute("DELETE FROM projects WHERE id = ?1", params![id])
        .map_err(|e| e.to_string())?;
    let _ = app.emit("project-deleted", &id);
    Ok(())
}

// ─── branches ─────────────────────────────────────────────────────────────────

#[tauri::command]
pub fn get_branches(project_id: String, state: State<AppState>) -> Result<Vec<Branch>, String> {
    let db = state.db.lock().map_err(|e| e.to_string())?;
    let mut stmt = db
        .prepare(
            "SELECT id, project_id, name, sort_order, archived
             FROM branches WHERE project_id = ?1 AND archived = 0
             ORDER BY sort_order, rowid",
        )
        .map_err(|e| e.to_string())?;
    stmt.query_map(params![project_id], |row| {
        Ok(Branch {
            id: row.get(0)?,
            project_id: row.get(1)?,
            name: row.get(2)?,
            sort_order: row.get(3)?,
            archived: row.get::<_, i32>(4)? != 0,
        })
    })
    .map_err(|e| e.to_string())?
    .collect::<Result<Vec<_>, _>>()
    .map_err(|e| e.to_string())
}

#[tauri::command]
pub fn create_branch(
    project_id: String,
    name: String,
    state: State<AppState>,
    app: tauri::AppHandle,
) -> Result<Branch, String> {
    let db = state.db.lock().map_err(|e| e.to_string())?;
    let id = Uuid::new_v4().to_string();
    let sort_order: i32 = db
        .query_row(
            "SELECT COALESCE(MAX(sort_order), -1) + 1 FROM branches WHERE project_id = ?1",
            params![project_id],
            |row| row.get(0),
        )
        .unwrap_or(0);
    db.execute(
        "INSERT INTO branches (id, project_id, name, sort_order) VALUES (?1, ?2, ?3, ?4)",
        params![id, project_id, name, sort_order],
    )
    .map_err(|e| e.to_string())?;
    let branch = Branch {
        id,
        project_id,
        name,
        sort_order,
        archived: false,
    };
    let _ = app.emit("branch-created", &branch);
    Ok(branch)
}

#[tauri::command]
pub fn archive_branch(
    id: String,
    state: State<AppState>,
    app: tauri::AppHandle,
) -> Result<(), String> {
    let db = state.db.lock().map_err(|e| e.to_string())?;
    db.execute(
        "UPDATE branches SET archived = 1 WHERE id = ?1",
        params![id],
    )
    .map_err(|e| e.to_string())?;
    let _ = app.emit("branch-archived", &id);
    Ok(())
}

// ─── tasks ────────────────────────────────────────────────────────────────────

#[tauri::command]
pub fn get_tasks(project_id: String, state: State<AppState>) -> Result<Vec<Task>, String> {
    let db = state.db.lock().map_err(|e| e.to_string())?;
    let mut stmt = db
        .prepare(
            "SELECT id, branch_id, project_id, title, description, status, sort_order, created_at, completed_at
             FROM tasks WHERE project_id = ?1
             ORDER BY sort_order, rowid",
        )
        .map_err(|e| e.to_string())?;
    stmt.query_map(params![project_id], |row| {
        let status_str: String = row.get(5)?;
        Ok(Task {
            id: row.get(0)?,
            branch_id: row.get(1)?,
            project_id: row.get(2)?,
            title: row.get(3)?,
            description: row.get(4)?,
            status: TaskStatus::from(status_str.as_str()),
            sort_order: row.get(6)?,
            created_at: row.get(7)?,
            completed_at: row.get(8)?,
        })
    })
    .map_err(|e| e.to_string())?
    .collect::<Result<Vec<_>, _>>()
    .map_err(|e| e.to_string())
}

#[tauri::command]
pub fn create_task(
    project_id: String,
    title: String,
    branch_id: Option<String>,
    state: State<AppState>,
    app: tauri::AppHandle,
) -> Result<Task, String> {
    let db = state.db.lock().map_err(|e| e.to_string())?;
    let id = Uuid::new_v4().to_string();
    let created_at = Utc::now().to_rfc3339();
    let status = if branch_id.is_some() {
        TaskStatus::Ready
    } else {
        TaskStatus::Inbox
    };
    let sort_order: i32 = match &branch_id {
        Some(bid) => db
            .query_row(
                "SELECT COALESCE(MAX(sort_order), -1) + 1 FROM tasks WHERE branch_id = ?1",
                params![bid],
                |row| row.get(0),
            )
            .unwrap_or(0),
        None => 0,
    };
    db.execute(
        "INSERT INTO tasks (id, branch_id, project_id, title, status, sort_order, created_at)
         VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7)",
        params![id, branch_id, project_id, title, status.as_str(), sort_order, created_at],
    )
    .map_err(|e| e.to_string())?;
    let task = Task {
        id,
        branch_id,
        project_id,
        title,
        description: None,
        status,
        sort_order,
        created_at,
        completed_at: None,
    };
    let _ = app.emit("task-created", &task);
    Ok(task)
}

#[tauri::command]
pub fn update_task_status(
    id: String,
    status: TaskStatus,
    state: State<AppState>,
    app: tauri::AppHandle,
) -> Result<Vec<Task>, String> {
    let db = state.db.lock().map_err(|e| e.to_string())?;
    let completed_at = if status == TaskStatus::Done {
        Some(Utc::now().to_rfc3339())
    } else {
        None
    };
    db.execute(
        "UPDATE tasks SET status = ?1, completed_at = ?2 WHERE id = ?3",
        params![status.as_str(), completed_at, id],
    )
    .map_err(|e| e.to_string())?;

    let updated = query_task(&db, &id)?;
    let mut affected = vec![updated];

    if status == TaskStatus::Done {
        let mut newly_ready = cascade_ready(&db, &id)?;
        affected.append(&mut newly_ready);
    }

    let _ = app.emit("tasks-updated", &affected);
    Ok(affected)
}

#[tauri::command]
pub fn update_task(
    id: String,
    title: String,
    description: Option<String>,
    state: State<AppState>,
    app: tauri::AppHandle,
) -> Result<Task, String> {
    let db = state.db.lock().map_err(|e| e.to_string())?;
    db.execute(
        "UPDATE tasks SET title = ?1, description = ?2 WHERE id = ?3",
        params![title, description, id],
    )
    .map_err(|e| e.to_string())?;
    let task = query_task(&db, &id)?;
    let _ = app.emit("tasks-updated", &vec![task.clone()]);
    Ok(task)
}

#[tauri::command]
pub fn assign_task_to_branch(
    task_id: String,
    branch_id: String,
    state: State<AppState>,
    app: tauri::AppHandle,
) -> Result<Task, String> {
    let db = state.db.lock().map_err(|e| e.to_string())?;
    let sort_order: i32 = db
        .query_row(
            "SELECT COALESCE(MAX(sort_order), -1) + 1 FROM tasks WHERE branch_id = ?1",
            params![branch_id],
            |row| row.get(0),
        )
        .unwrap_or(0);
    db.execute(
        "UPDATE tasks SET branch_id = ?1, status = 'ready', sort_order = ?2 WHERE id = ?3",
        params![branch_id, sort_order, task_id],
    )
    .map_err(|e| e.to_string())?;
    let task = query_task(&db, &task_id)?;
    let _ = app.emit("tasks-updated", &vec![task.clone()]);
    Ok(task)
}

#[tauri::command]
pub fn delete_task(
    id: String,
    state: State<AppState>,
    app: tauri::AppHandle,
) -> Result<(), String> {
    let db = state.db.lock().map_err(|e| e.to_string())?;
    db.execute("DELETE FROM tasks WHERE id = ?1", params![id])
        .map_err(|e| e.to_string())?;
    let _ = app.emit("task-deleted", &id);
    Ok(())
}

// ─── dependencies ─────────────────────────────────────────────────────────────

#[tauri::command]
pub fn add_dependency(
    task_id: String,
    depends_on_task_id: String,
    state: State<AppState>,
    app: tauri::AppHandle,
) -> Result<(), String> {
    let db = state.db.lock().map_err(|e| e.to_string())?;
    db.execute(
        "INSERT OR IGNORE INTO task_dependencies (task_id, depends_on_task_id) VALUES (?1, ?2)",
        params![task_id, depends_on_task_id],
    )
    .map_err(|e| e.to_string())?;
    db.execute(
        "UPDATE tasks SET status = 'pending' WHERE id = ?1 AND status = 'ready'",
        params![task_id],
    )
    .map_err(|e| e.to_string())?;
    let task = query_task(&db, &task_id)?;
    let _ = app.emit("tasks-updated", &vec![task]);
    Ok(())
}

#[tauri::command]
pub fn remove_dependency(
    task_id: String,
    depends_on_task_id: String,
    state: State<AppState>,
    app: tauri::AppHandle,
) -> Result<(), String> {
    let db = state.db.lock().map_err(|e| e.to_string())?;
    db.execute(
        "DELETE FROM task_dependencies WHERE task_id = ?1 AND depends_on_task_id = ?2",
        params![task_id, depends_on_task_id],
    )
    .map_err(|e| e.to_string())?;

    let pending_count: i32 = db
        .query_row(
            "SELECT COUNT(*) FROM task_dependencies td
             JOIN tasks t ON td.depends_on_task_id = t.id
             WHERE td.task_id = ?1 AND t.status != 'done'",
            params![task_id],
            |row| row.get(0),
        )
        .map_err(|e| e.to_string())?;

    if pending_count == 0 {
        db.execute(
            "UPDATE tasks SET status = 'ready' WHERE id = ?1 AND status = 'pending'",
            params![task_id],
        )
        .map_err(|e| e.to_string())?;
    }

    let task = query_task(&db, &task_id)?;
    let _ = app.emit("tasks-updated", &vec![task]);
    Ok(())
}

#[tauri::command]
pub fn get_dependencies(
    project_id: String,
    state: State<AppState>,
) -> Result<Vec<(String, String)>, String> {
    let db = state.db.lock().map_err(|e| e.to_string())?;
    let mut stmt = db
        .prepare(
            "SELECT td.task_id, td.depends_on_task_id
             FROM task_dependencies td
             JOIN tasks t ON td.task_id = t.id
             WHERE t.project_id = ?1",
        )
        .map_err(|e| e.to_string())?;
    stmt.query_map(params![project_id], |row| {
        Ok((row.get::<_, String>(0)?, row.get::<_, String>(1)?))
    })
    .map_err(|e| e.to_string())?
    .collect::<Result<Vec<_>, _>>()
    .map_err(|e| e.to_string())
}

// ─── recommendations ──────────────────────────────────────────────────────────

#[tauri::command]
pub fn get_recommendations(
    project_id: String,
    state: State<AppState>,
) -> Result<Vec<Task>, String> {
    let db = state.db.lock().map_err(|e| e.to_string())?;

    // Fetch all ready tasks
    let mut stmt = db
        .prepare(
            "SELECT id, branch_id, project_id, title, description, status, sort_order, created_at, completed_at
             FROM tasks WHERE project_id = ?1 AND status = 'ready'",
        )
        .map_err(|e| e.to_string())?;

    let ready_tasks: Vec<Task> = stmt
        .query_map(params![project_id], |row| {
            let status_str: String = row.get(5)?;
            Ok(Task {
                id: row.get(0)?,
                branch_id: row.get(1)?,
                project_id: row.get(2)?,
                title: row.get(3)?,
                description: row.get(4)?,
                status: TaskStatus::from(status_str.as_str()),
                sort_order: row.get(6)?,
                created_at: row.get(7)?,
                completed_at: row.get(8)?,
            })
        })
        .map_err(|e| e.to_string())?
        .collect::<Result<Vec<_>, _>>()
        .map_err(|e| e.to_string())?;

    // Score each ready task: count how many tasks depend on it (critical path proxy)
    let mut scored: Vec<(Task, i32)> = ready_tasks
        .into_iter()
        .map(|task| {
            let downstream_count: i32 = db
                .query_row(
                    "WITH RECURSIVE deps(id) AS (
                         SELECT task_id FROM task_dependencies WHERE depends_on_task_id = ?1
                         UNION
                         SELECT td.task_id FROM task_dependencies td JOIN deps d ON td.depends_on_task_id = d.id
                     )
                     SELECT COUNT(*) FROM deps",
                    params![task.id],
                    |row| row.get(0),
                )
                .unwrap_or(0);
            (task, downstream_count)
        })
        .collect();

    // Sort: pinned first, then by downstream count descending, then by sort_order
    scored.sort_by(|a, b| b.1.cmp(&a.1).then(a.0.sort_order.cmp(&b.0.sort_order)));

    Ok(scored.into_iter().map(|(t, _)| t).collect())
}

// ─── floating widget ──────────────────────────────────────────────────────────

#[tauri::command]
pub fn open_floating_widget(app: tauri::AppHandle) -> Result<(), String> {
    if let Some(window) = app.get_webview_window("floating-widget") {
        let _ = window.show();
        let _ = window.set_focus();
    } else {
        tauri::WebviewWindowBuilder::new(
            &app,
            "floating-widget",
            tauri::WebviewUrl::App("?window=floating-widget".into()),
        )
        .title("Human Composer")
        .inner_size(320.0, 420.0)
        .always_on_top(true)
        .decorations(false)
        .resizable(false)
        .skip_taskbar(true)
        .build()
        .map_err(|e| e.to_string())?;
    }
    Ok(())
}

#[tauri::command]
pub fn close_floating_widget(app: tauri::AppHandle) -> Result<(), String> {
    if let Some(window) = app.get_webview_window("floating-widget") {
        let _ = window.hide();
    }
    Ok(())
}
