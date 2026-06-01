use tauri::{
    menu::{IsMenuItem, Menu, MenuItem, PredefinedMenuItem},
    tray::TrayIconBuilder,
    AppHandle, Emitter, Manager,
};

use crate::commands::AppState;

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
            } else if let Some(task_id) = id.strip_prefix("complete:") {
                handle_tray_task_action(app, task_id, true);
            } else if let Some(task_id) = id.strip_prefix("activate:") {
                handle_tray_task_action(app, task_id, false);
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

    let _ = refresh_tray_menu(app);
    let snapshot = {
        let state = app.state::<AppState>();
        let db = match state.db.lock() {
            Ok(db) => db,
            Err(_) => return,
        };
        db.build_app_snapshot(&project_id).ok()
    };
    if let Some(snapshot) = snapshot {
        let _ = app.emit("graph-updated", snapshot);
    }
}

pub fn refresh_tray_menu(app: &AppHandle) -> Result<(), String> {
    let snapshot = {
        let state = app.state::<AppState>();
        let db = state.db.lock().map_err(|e| e.to_string())?;
        let project_id = match db.get_active_project_id().map_err(|e| e.to_string())? {
            Some(id) => id,
            None => db
                .list_projects()
                .map_err(|e| e.to_string())?
                .first()
                .map(|p| p.id.clone())
                .ok_or_else(|| "No project".to_string())?,
        };
        db.build_app_snapshot(&project_id)
            .map_err(|e| e.to_string())?
    };

    let Some(tray) = app.tray_by_id("main-tray") else {
        return Ok(());
    };

    let mut owned_items: Vec<MenuItem<tauri::Wry>> = Vec::new();
    let mut separators: Vec<PredefinedMenuItem<tauri::Wry>> = Vec::new();
    let mut structure: Vec<MenuEntry> = Vec::new();

    if let Some(active) = &snapshot.active_task {
        owned_items.push(
            MenuItem::with_id(
                app,
                "current",
                format!("正在: {}", active.task.title),
                false,
                None::<&str>,
            )
            .map_err(|e| e.to_string())?,
        );
        structure.push(MenuEntry::Item(owned_items.len() - 1));
        owned_items.push(
            MenuItem::with_id(
                app,
                format!("complete:{}", active.task.id),
                "完成当前任务",
                true,
                None::<&str>,
            )
            .map_err(|e| e.to_string())?,
        );
        structure.push(MenuEntry::Item(owned_items.len() - 1));
    } else {
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
            MenuItem::with_id(app, "rec-header", "推荐下一个:", false, None::<&str>)
                .map_err(|e| e.to_string())?,
        );
        structure.push(MenuEntry::Item(owned_items.len() - 1));
        for rec in snapshot.recommendations.iter().take(5) {
            owned_items.push(
                MenuItem::with_id(
                    app,
                    format!("activate:{}", rec.task.id),
                    rec.task.title.clone(),
                    true,
                    None::<&str>,
                )
                .map_err(|e| e.to_string())?,
            );
            structure.push(MenuEntry::Item(owned_items.len() - 1));
        }
        separators.push(PredefinedMenuItem::separator(app).map_err(|e| e.to_string())?);
        structure.push(MenuEntry::Sep(separators.len() - 1));
    }

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

    let tooltip = snapshot
        .active_task
        .as_ref()
        .map(|t| t.task.title.clone())
        .unwrap_or_else(|| "Human Composer".to_string());
    tray.set_tooltip(Some(&tooltip)).ok();

    Ok(())
}
