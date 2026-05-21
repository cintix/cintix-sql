mod db;

use db::commands;
use db::AppState;
use std::collections::HashMap;
use std::sync::Mutex;
use tauri::menu::{MenuBuilder, MenuItemBuilder, SubmenuBuilder};
use tauri::Emitter;

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_dialog::init())
        .manage(AppState {
            connections: Mutex::new(HashMap::new()),
            active_profile: Mutex::new(None),
        })
        .setup(|app| {
            if cfg!(debug_assertions) {
                app.handle().plugin(
                    tauri_plugin_log::Builder::default()
                        .level(log::LevelFilter::Info)
                        .build(),
                )?;
            }

            let new_query = MenuItemBuilder::with_id("new_query", "New Query")
                .accelerator("CmdOrCtrl+T")
                .build(app)?;
            let open_file = MenuItemBuilder::with_id("open_file", "Open...")
                .accelerator("CmdOrCtrl+O")
                .build(app)?;
            let save_file = MenuItemBuilder::with_id("save_file", "Save")
                .accelerator("CmdOrCtrl+S")
                .build(app)?;
            let export_results = MenuItemBuilder::with_id("export_results", "Export Results")
                .accelerator("CmdOrCtrl+E")
                .build(app)?;
            let exit = MenuItemBuilder::with_id("exit", "Exit")
                .accelerator("Alt+F4")
                .build(app)?;

            let file_menu = SubmenuBuilder::new(app, "File")
                .item(&new_query)
                .item(&open_file)
                .item(&save_file)
                .item(&export_results)
                .separator()
                .item(&exit)
                .build()?;

            let undo = MenuItemBuilder::with_id("undo", "Undo")
                .accelerator("CmdOrCtrl+Z")
                .build(app)?;
            let redo = MenuItemBuilder::with_id("redo", "Redo")
                .accelerator("CmdOrCtrl+Shift+Z")
                .build(app)?;
            let cut = MenuItemBuilder::with_id("cut", "Cut")
                .accelerator("CmdOrCtrl+X")
                .build(app)?;
            let copy = MenuItemBuilder::with_id("copy", "Copy")
                .accelerator("CmdOrCtrl+C")
                .build(app)?;
            let paste = MenuItemBuilder::with_id("paste", "Paste")
                .accelerator("CmdOrCtrl+V")
                .build(app)?;
            let select_all = MenuItemBuilder::with_id("select_all", "Select All")
                .accelerator("CmdOrCtrl+A")
                .build(app)?;

            let edit_menu = SubmenuBuilder::new(app, "Edit")
                .item(&undo)
                .item(&redo)
                .separator()
                .item(&cut)
                .item(&copy)
                .item(&paste)
                .separator()
                .item(&select_all)
                .build()?;

            let execute = MenuItemBuilder::with_id("execute", "Execute")
                .accelerator("F5")
                .build(app)?;
            let format_sql = MenuItemBuilder::with_id("format_sql", "Format SQL")
                .accelerator("CmdOrCtrl+Shift+F")
                .build(app)?;

            let query_menu = SubmenuBuilder::new(app, "Query")
                .item(&execute)
                .item(&format_sql)
                .build()?;

            let toggle_theme = MenuItemBuilder::with_id("toggle_theme", "Toggle Theme")
                .build(app)?;
            let light_mode = MenuItemBuilder::with_id("light_mode", "Light Mode")
                .build(app)?;
            let dark_mode = MenuItemBuilder::with_id("dark_mode", "Dark Mode")
                .build(app)?;

            let view_menu = SubmenuBuilder::new(app, "View")
                .item(&toggle_theme)
                .separator()
                .item(&light_mode)
                .item(&dark_mode)
                .build()?;

            let menu = MenuBuilder::new(app)
                .item(&file_menu)
                .item(&edit_menu)
                .item(&query_menu)
                .item(&view_menu)
                .build()?;

            app.set_menu(menu)?;

            Ok(())
        })
        .on_menu_event(|app, event| {
            let id = event.id().0.as_str();
            let _ = app.emit("menu-event", id);
        })
        .invoke_handler(tauri::generate_handler![
            commands::get_profiles,
            commands::save_profile,
            commands::delete_profile,
            commands::connect,
            commands::disconnect,
            commands::execute_query,
            commands::get_schema_objects,
            commands::get_object_script,
            commands::read_file,
            commands::write_file,
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
