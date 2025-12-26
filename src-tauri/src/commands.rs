use std::sync::Arc;
use tauri::State;

use crate::db::Database;
use crate::error::Result;
use crate::models::{
    AuthTokens, ConflictInfo, ConflictResolution, Environment, EnvironmentType, Project,
    SyncEvent, SyncStatus, User, Variable, VaultStatus,
};
use crate::sync::{SyncEngine, SyncResult};
use crate::veilcloud::VeilCloudConfig;

pub type DbState = Arc<Database>;
pub type SyncState = Arc<SyncEngine>;

// ========== Vault Commands ==========

#[tauri::command]
pub fn get_vault_status(db: State<DbState>) -> VaultStatus {
    db.get_status()
}

#[tauri::command]
pub fn initialize_vault(db: State<DbState>, master_password: String) -> Result<()> {
    db.initialize(&master_password)
}

#[tauri::command]
pub fn unlock_vault(db: State<DbState>, master_password: String) -> Result<()> {
    db.unlock(&master_password)
}

#[tauri::command]
pub fn lock_vault(db: State<DbState>) {
    db.lock()
}

#[tauri::command]
pub fn check_auto_lock(db: State<DbState>) -> bool {
    db.auto_lock_if_inactive()
}

#[tauri::command]
pub fn touch_activity(db: State<DbState>) {
    db.touch()
}

// ========== Project Commands ==========

#[tauri::command]
pub fn create_project(
    db: State<DbState>,
    name: String,
    description: Option<String>,
) -> Result<Project> {
    db.create_project(&name, description.as_deref())
}

#[tauri::command]
pub fn get_projects(db: State<DbState>) -> Result<Vec<Project>> {
    db.get_projects()
}

#[tauri::command]
pub fn get_project(db: State<DbState>, id: String) -> Result<Project> {
    db.get_project(&id)
}

#[tauri::command]
pub fn update_project(
    db: State<DbState>,
    id: String,
    name: String,
    description: Option<String>,
) -> Result<Project> {
    db.update_project(&id, &name, description.as_deref())
}

#[tauri::command]
pub fn delete_project(db: State<DbState>, id: String) -> Result<()> {
    db.delete_project(&id)
}

// ========== Environment Commands ==========

#[tauri::command]
pub fn create_environment(
    db: State<DbState>,
    project_id: String,
    name: String,
    env_type: String,
) -> Result<Environment> {
    let env_type = EnvironmentType::from_str(&env_type);
    db.create_environment(&project_id, &name, env_type)
}

#[tauri::command]
pub fn get_environments(db: State<DbState>, project_id: String) -> Result<Vec<Environment>> {
    db.get_environments(&project_id)
}

#[tauri::command]
pub fn get_environment(db: State<DbState>, id: String) -> Result<Environment> {
    db.get_environment(&id)
}

#[tauri::command]
pub fn delete_environment(db: State<DbState>, id: String) -> Result<()> {
    db.delete_environment(&id)
}

// ========== Variable Commands ==========

#[tauri::command]
pub fn create_variable(
    db: State<DbState>,
    environment_id: String,
    key: String,
    value: String,
    is_secret: bool,
) -> Result<Variable> {
    db.create_variable(&environment_id, &key, &value, is_secret)
}

#[tauri::command]
pub fn get_variables(db: State<DbState>, environment_id: String) -> Result<Vec<Variable>> {
    db.get_variables(&environment_id)
}

#[tauri::command]
pub fn get_variable(db: State<DbState>, id: String) -> Result<Variable> {
    db.get_variable(&id)
}

#[tauri::command]
pub fn update_variable(
    db: State<DbState>,
    id: String,
    key: String,
    value: String,
    is_secret: bool,
) -> Result<Variable> {
    db.update_variable(&id, &key, &value, is_secret)
}

#[tauri::command]
pub fn delete_variable(db: State<DbState>, id: String) -> Result<()> {
    db.delete_variable(&id)
}

// ========== Search Commands ==========

#[derive(serde::Serialize)]
pub struct SearchResult {
    pub project: Project,
    pub environment: Environment,
    pub variable: Variable,
}

#[tauri::command]
pub fn search_variables(db: State<DbState>, query: String) -> Result<Vec<SearchResult>> {
    let results = db.search_variables(&query)?;
    Ok(results
        .into_iter()
        .map(|(project, environment, variable)| SearchResult {
            project,
            environment,
            variable,
        })
        .collect())
}

// ========== Import/Export Commands ==========

#[tauri::command]
pub fn export_env_file(db: State<DbState>, environment_id: String) -> Result<String> {
    let variables = db.get_variables(&environment_id)?;
    let mut output = String::new();

    for var in variables {
        // Escape special characters in value
        let value = if var.value.contains(' ')
            || var.value.contains('"')
            || var.value.contains('\'')
            || var.value.contains('\n')
        {
            format!("\"{}\"", var.value.replace('"', "\\\""))
        } else {
            var.value
        };
        output.push_str(&format!("{}={}\n", var.key, value));
    }

    Ok(output)
}

#[tauri::command]
pub fn import_env_file(
    db: State<DbState>,
    environment_id: String,
    content: String,
) -> Result<Vec<Variable>> {
    let mut variables = Vec::new();

    for line in content.lines() {
        let line = line.trim();

        // Skip empty lines and comments
        if line.is_empty() || line.starts_with('#') {
            continue;
        }

        // Parse KEY=VALUE
        if let Some(pos) = line.find('=') {
            let key = line[..pos].trim().to_string();
            let mut value = line[pos + 1..].trim().to_string();

            // Remove surrounding quotes if present
            if (value.starts_with('"') && value.ends_with('"'))
                || (value.starts_with('\'') && value.ends_with('\''))
            {
                value = value[1..value.len() - 1].to_string();
            }

            // Unescape escaped quotes
            value = value.replace("\\\"", "\"");

            let var = db.create_variable(&environment_id, &key, &value, true)?;
            variables.push(var);
        }
    }

    Ok(variables)
}

// ========== Netlify Commands ==========

use crate::netlify::{NetlifyClient, NetlifyEnvVar, NetlifySite};

#[tauri::command]
pub async fn netlify_list_sites(access_token: String) -> Result<Vec<NetlifySite>> {
    let client = NetlifyClient::new(access_token);
    client.list_sites().await
}

#[tauri::command]
pub async fn netlify_get_env_vars(
    access_token: String,
    site_id: String,
) -> Result<Vec<NetlifyEnvVar>> {
    let client = NetlifyClient::new(access_token);
    client.get_env_vars(&site_id).await
}

#[tauri::command]
pub async fn netlify_push_env_vars(
    access_token: String,
    site_id: String,
    db: State<'_, DbState>,
    environment_id: String,
) -> Result<()> {
    let variables = db.get_variables(&environment_id)?;
    let var_tuples: Vec<(String, String)> = variables
        .into_iter()
        .map(|v| (v.key, v.value))
        .collect();

    let client = NetlifyClient::new(access_token);
    client.push_variables(&site_id, &var_tuples, "all").await
}

#[tauri::command]
pub async fn netlify_pull_env_vars(
    access_token: String,
    site_id: String,
    db: State<'_, DbState>,
    environment_id: String,
) -> Result<Vec<Variable>> {
    let client = NetlifyClient::new(access_token);
    let netlify_vars = client.get_env_vars(&site_id).await?;

    let mut imported = Vec::new();
    for var in netlify_vars {
        // Get the value for "all" context, or the first available value
        let value = var
            .values
            .iter()
            .find(|v| v.context == "all")
            .or_else(|| var.values.first())
            .map(|v| v.value.clone())
            .unwrap_or_default();

        let created = db.create_variable(&environment_id, &var.key, &value, true)?;
        imported.push(created);
    }

    Ok(imported)
}

// ========== Sync Commands ==========

#[tauri::command]
pub fn get_sync_status(sync: State<SyncState>) -> SyncStatus {
    sync.get_status()
}

#[tauri::command]
pub fn is_sync_connected(sync: State<SyncState>) -> bool {
    sync.is_connected()
}

#[tauri::command]
pub fn get_sync_user(sync: State<SyncState>) -> Option<User> {
    sync.current_user()
}

#[tauri::command]
pub fn get_sync_history(sync: State<SyncState>, limit: usize) -> Vec<SyncEvent> {
    sync.get_history(limit)
}

#[tauri::command]
pub fn get_sync_conflicts(sync: State<SyncState>) -> Vec<ConflictInfo> {
    sync.get_conflicts()
}

#[tauri::command]
pub async fn sync_signup(
    sync: State<'_, SyncState>,
    email: String,
    password: String,
    name: Option<String>,
) -> Result<User> {
    sync.signup(&email, &password, name.as_deref()).await
}

#[tauri::command]
pub async fn sync_login(
    sync: State<'_, SyncState>,
    email: String,
    password: String,
) -> Result<User> {
    sync.login(&email, &password).await
}

#[tauri::command]
pub fn sync_logout(sync: State<SyncState>) {
    sync.logout()
}

#[tauri::command]
pub fn sync_restore_session(sync: State<SyncState>, tokens: AuthTokens, user: User) {
    sync.restore_session(tokens, user)
}

#[tauri::command]
pub fn sync_get_tokens(sync: State<SyncState>) -> Option<AuthTokens> {
    sync.get_tokens()
}

#[tauri::command]
pub async fn sync_now(sync: State<'_, SyncState>) -> Result<SyncResult> {
    sync.sync().await
}

#[tauri::command]
pub async fn sync_resolve_conflict(
    sync: State<'_, SyncState>,
    project_id: String,
    resolution: ConflictResolution,
) -> Result<()> {
    sync.resolve_conflict(&project_id, resolution).await
}

#[tauri::command]
pub fn sync_set_enabled(db: State<DbState>, project_id: String, enabled: bool) -> Result<()> {
    db.set_sync_enabled(&project_id, enabled)
}

#[tauri::command]
pub fn sync_mark_dirty(db: State<DbState>, project_id: String) -> Result<()> {
    db.mark_project_dirty(&project_id)
}

// ========== Vercel Commands ==========

use crate::vercel::{VercelClient, VercelEnvVar, VercelProject};

#[tauri::command]
pub async fn vercel_list_projects(
    access_token: String,
    team_id: Option<String>,
) -> Result<Vec<VercelProject>> {
    let client = VercelClient::new(access_token, team_id);
    client.list_projects().await
}

#[tauri::command]
pub async fn vercel_get_env_vars(
    access_token: String,
    team_id: Option<String>,
    project_id: String,
) -> Result<Vec<VercelEnvVar>> {
    let client = VercelClient::new(access_token, team_id);
    client.get_env_vars(&project_id).await
}

#[tauri::command]
pub async fn vercel_push_env_vars(
    db: State<'_, DbState>,
    access_token: String,
    team_id: Option<String>,
    vercel_project_id: String,
    environment_id: String,
    targets: Vec<String>,
) -> Result<()> {
    let client = VercelClient::new(access_token, team_id);
    let variables = db.get_variables(&environment_id)?;

    let vars: Vec<(String, String, bool)> = variables
        .into_iter()
        .map(|v| (v.key, v.value, v.is_secret))
        .collect();

    let target_refs: Vec<&str> = targets.iter().map(|s| s.as_str()).collect();
    client
        .push_variables(&vercel_project_id, &vars, &target_refs)
        .await
}

#[tauri::command]
pub async fn vercel_pull_env_vars(
    db: State<'_, DbState>,
    access_token: String,
    team_id: Option<String>,
    vercel_project_id: String,
    environment_id: String,
) -> Result<Vec<Variable>> {
    let client = VercelClient::new(access_token, team_id);
    let vercel_vars = client.get_env_vars(&vercel_project_id).await?;

    let mut imported = Vec::new();
    for var in vercel_vars {
        let created = db.create_variable(
            &environment_id,
            &var.key,
            &var.value,
            var.env_type == "secret",
        )?;
        imported.push(created);
    }

    Ok(imported)
}

// ========== Railway Commands ==========

use crate::railway::{RailwayClient, RailwayEnvironment, RailwayProject, RailwayService};

#[tauri::command]
pub async fn railway_list_projects(access_token: String) -> Result<Vec<RailwayProject>> {
    let client = RailwayClient::new(access_token);
    client.list_projects().await
}

#[tauri::command]
pub async fn railway_get_services(
    access_token: String,
    project_id: String,
) -> Result<Vec<RailwayService>> {
    let client = RailwayClient::new(access_token);
    client.get_services(&project_id).await
}

#[tauri::command]
pub async fn railway_get_environments(
    access_token: String,
    project_id: String,
) -> Result<Vec<RailwayEnvironment>> {
    let client = RailwayClient::new(access_token);
    client.get_environments(&project_id).await
}

#[tauri::command]
pub async fn railway_get_variables(
    access_token: String,
    project_id: String,
    environment_id: String,
    service_id: String,
) -> Result<std::collections::HashMap<String, String>> {
    let client = RailwayClient::new(access_token);
    client
        .get_variables(&project_id, &environment_id, &service_id)
        .await
}

#[tauri::command]
pub async fn railway_push_env_vars(
    db: State<'_, DbState>,
    access_token: String,
    railway_project_id: String,
    railway_environment_id: String,
    railway_service_id: String,
    environment_id: String,
) -> Result<()> {
    let client = RailwayClient::new(access_token);
    let variables = db.get_variables(&environment_id)?;

    let vars: Vec<(String, String)> = variables
        .into_iter()
        .map(|v| (v.key, v.value))
        .collect();

    client
        .push_variables(
            &railway_project_id,
            &railway_environment_id,
            &railway_service_id,
            &vars,
        )
        .await
}

#[tauri::command]
pub async fn railway_pull_env_vars(
    db: State<'_, DbState>,
    access_token: String,
    railway_project_id: String,
    railway_environment_id: String,
    railway_service_id: String,
    environment_id: String,
) -> Result<Vec<Variable>> {
    let client = RailwayClient::new(access_token);
    let railway_vars = client
        .get_variables(
            &railway_project_id,
            &railway_environment_id,
            &railway_service_id,
        )
        .await?;

    let mut imported = Vec::new();
    for (key, value) in railway_vars {
        let created = db.create_variable(&environment_id, &key, &value, true)?;
        imported.push(created);
    }

    Ok(imported)
}
