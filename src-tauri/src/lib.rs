mod auto_assign;
mod commands;
mod db;
mod models;
mod recommend;
mod sources;
mod today;
mod tray;
mod undo;
mod runway;

use std::sync::Mutex;

use commands::AppState;
use db::Database;
use tauri::{Emitter, Listener, Manager};
use tauri_plugin_global_shortcut::{Code, GlobalShortcutExt, Modifiers, Shortcut, ShortcutState};

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    let complete_shortcut =
        Shortcut::new(Some(Modifiers::SUPER | Modifiers::SHIFT), Code::KeyD);
    let quick_add_shortcut =
        Shortcut::new(Some(Modifiers::SUPER | Modifiers::SHIFT), Code::KeyN);
    let palette_shortcut = Shortcut::new(Some(Modifiers::SUPER), Code::KeyK);

    tauri::Builder::default()
        .plugin(tauri_plugin_opener::init())
        .plugin(
            tauri_plugin_global_shortcut::Builder::new()
                .with_handler({
                    let complete = complete_shortcut.clone();
                    let quick_add = quick_add_shortcut.clone();
                    let palette = palette_shortcut.clone();
                    move |app, shortcut, event| {
                        if event.state != ShortcutState::Pressed {
                            return;
                        }
                        if shortcut == &complete {
                            let _ = app.emit("shortcut-complete-task", ());
                        } else if shortcut == &quick_add {
                            let _ = app.emit("shortcut-quick-add", ());
                        } else if shortcut == &palette {
                            let _ = app.emit("shortcut-command-palette", ());
                        }
                    }
                })
                .build(),
        )
        .setup(move |app| {
            let data_dir = app
                .path()
                .app_data_dir()
                .expect("failed to resolve app data dir");
            let db_path = data_dir.join("human-composer.db");
            let database = Database::open(&db_path).expect("failed to open database");

            app.manage(AppState {
                db: Mutex::new(database),
                undo: undo::UndoStack::new(),
            });

            tray::setup_tray(app.handle())?;
            let _ = tray::refresh_tray_menu(app.handle());

            for label in ["main", "floating"] {
                if let Some(window) = app.get_webview_window(label) {
                    let _ = window.set_shadow(true);
                }
            }

            #[cfg(target_os = "macos")]
            {
                use tauri::window::{Effect, EffectsBuilder};
                for label in ["main", "floating"] {
                    if let Some(window) = app.get_webview_window(label) {
                        let _ = window.set_effects(
                            EffectsBuilder::new()
                                .effects(vec![Effect::ContentBackground])
                                .radius(12.0)
                                .build(),
                        );
                    }
                }
            }

            if let Some(floating) = app.get_webview_window("floating") {
                let _ = floating.set_maximizable(false);
                let _ = floating.set_resizable(false);
            }

            let handle = app.handle().clone();
            app.handle().listen("graph-updated", move |_event| {
                let handle = handle.clone();
                tauri::async_runtime::spawn(async move {
                    let _ = tray::refresh_tray_menu(&handle);
                });
            });
            let handle2 = app.handle().clone();
            app.handle().listen("runway-updated", move |_event| {
                let handle = handle2.clone();
                tauri::async_runtime::spawn(async move {
                    let _ = tray::refresh_tray_menu(&handle);
                });
            });

            let gs = app.global_shortcut();
            gs.register(complete_shortcut)?;
            gs.register(quick_add_shortcut)?;
            gs.register(palette_shortcut)?;

            Ok(())
        })
        .invoke_handler(tauri::generate_handler![
            commands::get_today_snapshot,
            commands::get_day_runway_snapshot,
            commands::auto_populate_runway,
            commands::create_day_lane,
            commands::close_day_lane,
            commands::rename_day_lane,
            commands::reorder_day_lanes,
            commands::assign_task_to_lane,
            commands::remove_task_from_lane,
            commands::reorder_lane_tasks,
            commands::move_task_between_lanes,
            commands::claim_task,
            commands::start_external_task,
            commands::complete_external_task,
            commands::review_external_task,
            commands::set_task_estimated_minutes,
            commands::rename_branch,
            commands::list_archived_branches,
            commands::unarchive_branch,
            commands::delete_project,
            commands::reorder_task,
            commands::focus_floating_for_quick_add,
            commands::list_projects,
            commands::create_project,
            commands::set_active_project,
            commands::get_project_graph,
            commands::get_app_snapshot,
            commands::create_branch,
            commands::create_task,
            commands::assign_task_to_branch,
            commands::add_dependency,
            commands::remove_dependency,
            commands::update_task,
            commands::delete_task,
            commands::set_task_status,
            commands::activate_task,
            commands::complete_task,
            commands::pin_task,
            commands::archive_branch,
            commands::delete_branch,
            commands::reorder_branches,
            commands::set_task_priority,
            commands::archive_task,
            commands::unarchive_task,
            commands::list_archived_tasks,
            commands::reorder_branch_tasks,
            commands::suggest_branch_for_task,
            commands::undo_last_action,
            commands::list_project_sources,
            commands::show_main_window,
            commands::toggle_floating_expanded,
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
