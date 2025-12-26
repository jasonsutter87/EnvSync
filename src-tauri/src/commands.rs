use std::sync::Arc;
use tauri::State;

use crate::db::Database;
use crate::error::Result;
use crate::models::{Environment, EnvironmentType, Project, Variable, VaultStatus};

pub type DbState = Arc<Database>;

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
