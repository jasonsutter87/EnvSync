mod commands;
mod crypto;
mod db;
mod error;
mod models;

use std::sync::Arc;
use tauri::Manager;

use commands::DbState;
use db::Database;

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_fs::init())
        .plugin(tauri_plugin_shell::init())
        .setup(|app| {
            // Set up logging in debug mode
            if cfg!(debug_assertions) {
                app.handle().plugin(
                    tauri_plugin_log::Builder::default()
                        .level(log::LevelFilter::Info)
                        .build(),
                )?;
            }

            // Get app data directory for database
            let app_data_dir = app
                .path()
                .app_data_dir()
                .expect("Failed to get app data directory");

            let db_path = app_data_dir.join("envsync.db");

            // Initialize database
            let db = Arc::new(Database::new(db_path));

            // Make database available to all commands
            app.manage(db as DbState);

            Ok(())
        })
        .invoke_handler(tauri::generate_handler![
            // Vault commands
            commands::get_vault_status,
            commands::initialize_vault,
            commands::unlock_vault,
            commands::lock_vault,
            // Project commands
            commands::create_project,
            commands::get_projects,
            commands::get_project,
            commands::update_project,
            commands::delete_project,
            // Environment commands
            commands::create_environment,
            commands::get_environments,
            commands::get_environment,
            commands::delete_environment,
            // Variable commands
            commands::create_variable,
            commands::get_variables,
            commands::get_variable,
            commands::update_variable,
            commands::delete_variable,
            // Search commands
            commands::search_variables,
            // Import/Export commands
            commands::export_env_file,
            commands::import_env_file,
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
