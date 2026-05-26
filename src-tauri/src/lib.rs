mod commands;
mod db;
mod models;
pub mod sources;

use rusqlite::Connection;
use std::sync::Mutex;
use tauri::Manager;

pub struct AppState {
    pub db: Mutex<Connection>,
}

fn build_tray(app: &tauri::App) -> tauri::Result<()> {
    use tauri::menu::{Menu, MenuItem, PredefinedMenuItem};
    use tauri::tray::TrayIconBuilder;

    let show = MenuItem::with_id(app, "show", "Open Human Composer", true, None::<&str>)?;
    let widget = MenuItem::with_id(app, "widget", "Toggle Widget", true, None::<&str>)?;
    let sep = PredefinedMenuItem::separator(app)?;
    let quit = MenuItem::with_id(app, "quit", "Quit", true, None::<&str>)?;
    let menu = Menu::with_items(app, &[&show, &widget, &sep, &quit])?;

    TrayIconBuilder::new()
        .icon(app.default_window_icon().unwrap().clone())
        .menu(&menu)
        .show_menu_on_left_click(true)
        .on_menu_event(|app, event| match event.id.as_ref() {
            "show" => {
                if let Some(window) = app.get_webview_window("main") {
                    let _ = window.show();
                    let _ = window.set_focus();
                }
            }
            "widget" => {
                if let Some(window) = app.get_webview_window("floating-widget") {
                    if window.is_visible().unwrap_or(false) {
                        let _ = window.hide();
                    } else {
                        let _ = window.show();
                        let _ = window.set_focus();
                    }
                } else {
                    let _ = commands::open_floating_widget(app.clone());
                }
            }
            "quit" => {
                app.exit(0);
            }
            _ => {}
        })
        .build(app)?;

    Ok(())
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_opener::init())
        .plugin(tauri_plugin_global_shortcut::Builder::new().build())
        .setup(|app| {
            let app_data_dir = app
                .path()
                .app_data_dir()
                .expect("Failed to resolve app data directory");
            std::fs::create_dir_all(&app_data_dir)
                .expect("Failed to create app data directory");

            let db_path = app_data_dir.join("human_composer.db");
            let conn = Connection::open(&db_path).expect("Failed to open SQLite database");
            db::migrate(&conn).expect("Database migration failed");

            app.manage(AppState {
                db: Mutex::new(conn),
            });

            build_tray(app)?;
            Ok(())
        })
        .invoke_handler(tauri::generate_handler![
            commands::get_projects,
            commands::create_project,
            commands::delete_project,
            commands::get_branches,
            commands::create_branch,
            commands::archive_branch,
            commands::get_tasks,
            commands::create_task,
            commands::update_task_status,
            commands::update_task,
            commands::assign_task_to_branch,
            commands::delete_task,
            commands::add_dependency,
            commands::remove_dependency,
            commands::get_dependencies,
            commands::get_recommendations,
            commands::open_floating_widget,
            commands::close_floating_widget,
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
