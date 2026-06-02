use tauri::{
    menu::{IsMenuItem, Menu, MenuItem, PredefinedMenuItem},
    tray::TrayIconBuilder,
    AppHandle, Emitter, Manager,
};

use crate::commands::AppState;
use crate::models::{DayRunwaySnapshot, ExternalStatus, TaskStatus};
use crate::runway::is_focus_active;

enum MenuEntry {
    Item(usize),
    Sep(usize),
}

pub fn setup_tray(app: &AppHandle) -> tauri::Result<()> {
    let quit = MenuItem::with_id(app, "quit", "退出", true, None::<&str>)?;
    let show = MenuItem::with_id(app, "show", "打开 Human Composer", true, None::<&str>)?;
    let menu = Menu::with_items(app, &[&show, &PredefinedMenuItem::separator(app)?, &quit])?;
    let icon = app.default_window_icon().cloned().expect("tray icon");

    TrayIconBuilder::with_id("main-tray")
        .icon(icon)
        .menu(&menu)
        .tooltip("Human Composer")
        .on_menu_event(|app, event| {
            let id = event.id.as_ref();
            if id == "quit" {
                app.exit(0);
            } else if id == "show" {
                show_main(app);
            } else if id == "quick-add" {
                let _ = app.emit("floating-focus-input", ());
                if let Some(window) = app.get_webview_window("floating") {
                    let _ = window.show();
                    let _ = window.set_focus();
                }
            } else if let Some(task_id) = id.strip_prefix("complete:") {
                handle_tray_task_action(app, task_id, true);
            } else if let Some(task_id) = id.strip_prefix("complete-ext:") {
                handle_tray_complete_external(app, task_id);
            } else if let Some(rest) = id.strip_prefix("claim:") {
                if let Some((task_id, lane_id)) = rest.split_once(':') {
                    handle_tray_claim(app, task_id, lane_id);
                }
            }
        })
        .build(app)?;

    Ok(())
}

fn show_main(app: &AppHandle) {
    if let Some(window) = app.get_webview_window("main") {
        let _ = window.show();
        let _ = window.set_focus();
    }
}

fn handle_tray_task_action(app: &AppHandle, task_id: &str, complete: bool) {
    let project_id = {
        let state = app.state::<AppState>();
        let db = match state.db.lock() {
            Ok(db) => db,
            Err(_) => return,
        };
        let project_id = match db.project_id_for_task(task_id) {
            Ok(id) => id,
            Err(_) => return,
        };
        if complete {
            let _ = db.complete_task(task_id, &project_id);
        } else {
            let _ = db.activate_task(task_id, &project_id);
        }
        project_id
    };

    emit_snapshots(app, &project_id);
    let _ = refresh_tray_menu(app);
}

fn handle_tray_complete_external(app: &AppHandle, task_id: &str) {
    let project_id = {
        let state = app.state::<AppState>();
        let db = match state.db.lock() {
            Ok(db) => db,
            Err(_) => return,
        };
        let project_id = match db.project_id_for_task(task_id) {
            Ok(id) => id,
            Err(_) => return,
        };
        let _ = db.complete_external_task(task_id);
        project_id
    };
    emit_snapshots(app, &project_id);
    let _ = refresh_tray_menu(app);
}

fn handle_tray_claim(app: &AppHandle, task_id: &str, lane_id: &str) {
    let project_id = {
        let state = app.state::<AppState>();
        let db = match state.db.lock() {
            Ok(db) => db,
            Err(_) => return,
        };
        let project_id = match db.project_id_for_task(task_id) {
            Ok(id) => id,
            Err(_) => return,
        };
        let _ = db.claim_task(task_id, lane_id);
        project_id
    };
    emit_snapshots(app, &project_id);
    let _ = refresh_tray_menu(app);
}

fn emit_snapshots(app: &AppHandle, project_id: &str) {
    let (app_snapshot, runway) = {
        let state = app.state::<AppState>();
        let db = match state.db.lock() {
            Ok(db) => db,
            Err(_) => return,
        };
        let app_snapshot = db.build_app_snapshot(project_id).ok();
        let runway = db.build_day_runway_snapshot().ok();
        (app_snapshot, runway)
    };
    if let Some(snapshot) = app_snapshot {
        let _ = app.emit("graph-updated", snapshot);
    }
    if let Some(runway) = runway {
        let _ = app.emit("runway-updated", &runway);
        let _ = app.emit("today-updated", &runway);
    }
}

pub fn refresh_tray_menu(app: &AppHandle) -> Result<(), String> {
    let snapshot = {
        let state = app.state::<AppState>();
        let db = state.db.lock().map_err(|e| e.to_string())?;
        db.build_day_runway_snapshot().map_err(|e| e.to_string())?
    };

    build_tray_menu(app, &snapshot)
}

fn build_tray_menu(app: &AppHandle, snapshot: &DayRunwaySnapshot) -> Result<(), String> {
    let Some(tray) = app.tray_by_id("main-tray") else {
        return Ok(());
    };

    let mut owned_items: Vec<MenuItem<tauri::Wry>> = Vec::new();
    let mut separators: Vec<PredefinedMenuItem<tauri::Wry>> = Vec::new();
    let mut structure: Vec<MenuEntry> = Vec::new();

    let mut has_active = false;
    for lane in &snapshot.lanes {
        // Show focus-active tasks with a "完成" action
        if let Some(focus_task) = lane.tasks.iter().find(|t| is_focus_active(&t.task)) {
            has_active = true;
            owned_items.push(
                MenuItem::with_id(
                    app,
                    format!("lane-{}", lane.lane.id),
                    format!("🎯 {}: {}", lane.lane.name, focus_task.task.title),
                    false,
                    None::<&str>,
                )
                .map_err(|e| e.to_string())?,
            );
            structure.push(MenuEntry::Item(owned_items.len() - 1));
            owned_items.push(
                MenuItem::with_id(
                    app,
                    format!("complete:{}", focus_task.task.id),
                    format!("完成「{}」", focus_task.task.title),
                    true,
                    None::<&str>,
                )
                .map_err(|e| e.to_string())?,
            );
            structure.push(MenuEntry::Item(owned_items.len() - 1));
        }

        // Show external delegated tasks with "标记完成" (routes to completeExternal, not completeTask)
        for ext_task in lane.tasks.iter().filter(|t| {
            t.task.status == TaskStatus::Active
                && t.task.external_status == Some(ExternalStatus::Delegated)
        }) {
            has_active = true;
            owned_items.push(
                MenuItem::with_id(
                    app,
                    format!("ext-{}", ext_task.task.id),
                    format!("⏳ {}: {}", lane.lane.name, ext_task.task.title),
                    false,
                    None::<&str>,
                )
                .map_err(|e| e.to_string())?,
            );
            structure.push(MenuEntry::Item(owned_items.len() - 1));
            owned_items.push(
                MenuItem::with_id(
                    app,
                    format!("complete-ext:{}", ext_task.task.id),
                    format!("标记完成「{}」", ext_task.task.title),
                    true,
                    None::<&str>,
                )
                .map_err(|e| e.to_string())?,
            );
            structure.push(MenuEntry::Item(owned_items.len() - 1));
        }

        // Show needs-review tasks as non-actionable reminders (open app to review)
        for rev_task in lane.tasks.iter().filter(|t| {
            t.task.external_status == Some(ExternalStatus::NeedsReview)
        }) {
            owned_items.push(
                MenuItem::with_id(
                    app,
                    format!("review-{}", rev_task.task.id),
                    format!("🔔 待审核: {}", rev_task.task.title),
                    false,
                    None::<&str>,
                )
                .map_err(|e| e.to_string())?,
            );
            structure.push(MenuEntry::Item(owned_items.len() - 1));
        }
    }

    if !has_active {
        owned_items.push(
            MenuItem::with_id(app, "idle", "暂无进行中的任务", false, None::<&str>)
                .map_err(|e| e.to_string())?,
        );
        structure.push(MenuEntry::Item(owned_items.len() - 1));
    }

    separators.push(PredefinedMenuItem::separator(app).map_err(|e| e.to_string())?);
    structure.push(MenuEntry::Sep(separators.len() - 1));

    if !snapshot.recommendations.is_empty() {
        owned_items.push(
            MenuItem::with_id(app, "rec-header", "推荐领取:", false, None::<&str>)
                .map_err(|e| e.to_string())?,
        );
        structure.push(MenuEntry::Item(owned_items.len() - 1));
        for rec in snapshot.recommendations.iter().take(5) {
            if let Some(lane) = snapshot.lanes.first() {
                owned_items.push(
                    MenuItem::with_id(
                        app,
                        format!("claim:{}:{}", rec.task.id, lane.lane.id),
                        rec.task.title.clone(),
                        true,
                        None::<&str>,
                    )
                    .map_err(|e| e.to_string())?,
                );
                structure.push(MenuEntry::Item(owned_items.len() - 1));
            }
        }
        separators.push(PredefinedMenuItem::separator(app).map_err(|e| e.to_string())?);
        structure.push(MenuEntry::Sep(separators.len() - 1));
    }

    owned_items.push(
        MenuItem::with_id(app, "quick-add", "快速添加任务…", true, None::<&str>)
            .map_err(|e| e.to_string())?,
    );
    structure.push(MenuEntry::Item(owned_items.len() - 1));

    owned_items.push(
        MenuItem::with_id(app, "show", "打开 Human Composer", true, None::<&str>)
            .map_err(|e| e.to_string())?,
    );
    structure.push(MenuEntry::Item(owned_items.len() - 1));
    separators.push(PredefinedMenuItem::separator(app).map_err(|e| e.to_string())?);
    structure.push(MenuEntry::Sep(separators.len() - 1));
    owned_items.push(
        MenuItem::with_id(app, "quit", "退出", true, None::<&str>).map_err(|e| e.to_string())?,
    );
    structure.push(MenuEntry::Item(owned_items.len() - 1));

    let refs: Vec<&dyn IsMenuItem<tauri::Wry>> = structure
        .iter()
        .map(|entry| match entry {
            MenuEntry::Item(i) => &owned_items[*i] as &dyn IsMenuItem<tauri::Wry>,
            MenuEntry::Sep(i) => &separators[*i] as &dyn IsMenuItem<tauri::Wry>,
        })
        .collect();

    let menu = Menu::with_items(app, &refs).map_err(|e| e.to_string())?;
    tray.set_menu(Some(menu)).map_err(|e| e.to_string())?;

    let focus_active_count = snapshot
        .lanes
        .iter()
        .filter(|l| l.tasks.iter().any(|t| is_focus_active(&t.task)))
        .count();

    let review_count = snapshot
        .lanes
        .iter()
        .flat_map(|l| l.tasks.iter())
        .filter(|t| t.task.external_status == Some(ExternalStatus::NeedsReview))
        .count();

    let tooltip = if review_count > 0 {
        format!("{review_count} 项待审核")
    } else if focus_active_count > 0 {
        format!("{focus_active_count} 泳道专注中")
    } else {
        "Human Composer".to_string()
    };
    tray.set_tooltip(Some(&tooltip)).ok();


    Ok(())
}
