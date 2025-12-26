mod audit;
mod commands;
mod crypto;
mod db;
pub mod error;
mod models;
mod netlify;
mod railway;
mod sync;
mod veilcloud;
mod veilkey;
mod vercel;

use std::sync::Arc;
use tauri::Manager;

use audit::AuditLogger;
use commands::{AuditState, DbState, SyncState};
use db::Database;
use sync::SyncEngine;

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

            // Initialize sync engine
            let sync = Arc::new(SyncEngine::new(Arc::clone(&db)));

            // Initialize audit logger
            let audit = Arc::new(AuditLogger::new(Arc::clone(&db)));

            // Make database, sync engine, and audit logger available to all commands
            app.manage(db as DbState);
            app.manage(sync as SyncState);
            app.manage(audit as AuditState);

            Ok(())
        })
        .invoke_handler(tauri::generate_handler![
            // Vault commands
            commands::get_vault_status,
            commands::initialize_vault,
            commands::unlock_vault,
            commands::lock_vault,
            commands::check_auto_lock,
            commands::touch_activity,
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
            // Netlify commands
            commands::netlify_list_sites,
            commands::netlify_get_env_vars,
            commands::netlify_push_env_vars,
            commands::netlify_pull_env_vars,
            // Sync commands
            commands::get_sync_status,
            commands::is_sync_connected,
            commands::get_sync_user,
            commands::get_sync_history,
            commands::get_sync_conflicts,
            commands::sync_signup,
            commands::sync_login,
            commands::sync_logout,
            commands::sync_restore_session,
            commands::sync_get_tokens,
            commands::sync_now,
            commands::sync_resolve_conflict,
            commands::sync_set_enabled,
            commands::sync_mark_dirty,
            // Vercel commands
            commands::vercel_list_projects,
            commands::vercel_get_env_vars,
            commands::vercel_push_env_vars,
            commands::vercel_pull_env_vars,
            // Railway commands
            commands::railway_list_projects,
            commands::railway_get_services,
            commands::railway_get_environments,
            commands::railway_get_variables,
            commands::railway_push_env_vars,
            commands::railway_pull_env_vars,
            // Phase 3: Team commands
            commands::create_team,
            commands::get_team,
            commands::get_teams,
            commands::get_team_with_members,
            commands::update_team,
            commands::delete_team,
            // Team member commands
            commands::invite_team_member,
            commands::accept_team_invite,
            commands::get_team_members,
            commands::update_member_role,
            commands::remove_team_member,
            commands::revoke_team_invite,
            // Project sharing commands
            commands::share_project_with_team,
            commands::unshare_project_from_team,
            commands::get_project_teams,
            commands::get_team_projects,
            commands::check_project_access,
            // VeilKey commands
            commands::generate_team_key,
            commands::get_team_key_shares,
            commands::get_my_key_share,
            // Audit log commands
            commands::get_project_audit_log,
            commands::get_team_audit_log,
            commands::query_audit_log,
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
