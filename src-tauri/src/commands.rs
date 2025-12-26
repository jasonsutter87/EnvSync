use std::sync::Arc;
use tauri::State;

use crate::audit::AuditLogger;
use crate::db::Database;
use crate::error::Result;
use crate::models::{
    AuditEvent, AuditQuery, AuthTokens, ConflictInfo, ConflictResolution, Environment,
    EnvironmentType, InviteStatus, KeyShare, Project, ProjectTeamAccess, SyncEvent, SyncStatus,
    Team, TeamInvite, TeamMember, TeamRole, TeamWithMembers, User, Variable, VaultStatus,
};
use crate::sync::{SyncEngine, SyncResult};
use crate::veilkey::VeilKey;

pub type DbState = Arc<Database>;
pub type SyncState = Arc<SyncEngine>;
pub type AuditState = Arc<AuditLogger>;

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

// ========== Phase 3: Team Commands ==========

#[tauri::command]
pub fn create_team(
    db: State<DbState>,
    audit: State<AuditState>,
    sync: State<SyncState>,
    name: String,
    description: Option<String>,
    threshold: Option<u8>,
    total_shares: Option<u8>,
) -> Result<Team> {
    let user = sync.current_user().ok_or_else(|| {
        crate::error::EnvSyncError::NotAuthenticated
    })?;

    let t = threshold.unwrap_or(2);
    let n = total_shares.unwrap_or(3);

    let team = Team::new(
        name.clone(),
        description,
        user.id.clone(),
        t,
        n,
    );

    let created = db.create_team(&team)?;

    // Log the event
    let _ = audit.log_team_created(&user.id, Some(&user.email), &created.id, &name);

    Ok(created)
}

#[tauri::command]
pub fn get_team(db: State<DbState>, id: String) -> Result<Team> {
    db.get_team(&id)
}

#[tauri::command]
pub fn get_teams(db: State<DbState>, sync: State<SyncState>) -> Result<Vec<Team>> {
    let user = sync.current_user().ok_or_else(|| {
        crate::error::EnvSyncError::NotAuthenticated
    })?;

    db.get_teams_for_user(&user.id)
}

#[tauri::command]
pub fn get_team_with_members(db: State<DbState>, team_id: String) -> Result<TeamWithMembers> {
    db.get_team_with_members(&team_id)
}

#[tauri::command]
pub fn update_team(
    db: State<DbState>,
    audit: State<AuditState>,
    sync: State<SyncState>,
    id: String,
    name: String,
    description: Option<String>,
) -> Result<Team> {
    let user = sync.current_user().ok_or_else(|| {
        crate::error::EnvSyncError::NotAuthenticated
    })?;

    let updated = db.update_team(&id, &name, description.as_deref())?;

    let _ = audit.log_team_updated(
        &user.id,
        Some(&user.email),
        &id,
        &format!("{{\"name\": \"{}\"}}", name),
    );

    Ok(updated)
}

#[tauri::command]
pub fn delete_team(
    db: State<DbState>,
    audit: State<AuditState>,
    sync: State<SyncState>,
    id: String,
) -> Result<()> {
    let user = sync.current_user().ok_or_else(|| {
        crate::error::EnvSyncError::NotAuthenticated
    })?;

    let team = db.get_team(&id)?;

    // Only owner can delete
    if team.owner_id != user.id {
        return Err(crate::error::EnvSyncError::PermissionDenied(
            "Only the team owner can delete the team".to_string(),
        ));
    }

    db.delete_team(&id)?;

    let _ = audit.log_team_deleted(&user.id, Some(&user.email), &id, &team.name);

    Ok(())
}

// ========== Team Member Commands ==========

#[tauri::command]
pub fn invite_team_member(
    db: State<DbState>,
    audit: State<AuditState>,
    sync: State<SyncState>,
    team_id: String,
    email: String,
    role: String,
) -> Result<TeamInvite> {
    let user = sync.current_user().ok_or_else(|| {
        crate::error::EnvSyncError::NotAuthenticated
    })?;

    let team = db.get_team(&team_id)?;

    // Check permissions - must be owner or admin
    let member = db.get_team_member(&team_id, &user.id)?;
    let can_invite = team.owner_id == user.id
        || member.map(|m| m.role.can_admin()).unwrap_or(false);

    if !can_invite {
        return Err(crate::error::EnvSyncError::PermissionDenied(
            "You don't have permission to invite members".to_string(),
        ));
    }

    let role = TeamRole::from_str(&role);
    let invite = TeamInvite::new(team_id.clone(), email.clone(), role.clone(), user.id.clone(), 7);

    let created = db.create_invite(&invite)?;

    let _ = audit.log_member_invited(&user.id, Some(&user.email), &team_id, &email, role.as_str());

    Ok(created)
}

#[tauri::command]
pub fn accept_team_invite(
    db: State<DbState>,
    audit: State<AuditState>,
    sync: State<SyncState>,
    token: String,
) -> Result<TeamMember> {
    let user = sync.current_user().ok_or_else(|| {
        crate::error::EnvSyncError::NotAuthenticated
    })?;

    let invite = db.get_invite_by_token(&token)?.ok_or_else(|| {
        crate::error::EnvSyncError::InviteNotFound(token.clone())
    })?;

    if !invite.is_valid() {
        return Err(crate::error::EnvSyncError::InviteNotFound(
            "Invite is expired or already used".to_string(),
        ));
    }

    // Create the member
    let member = TeamMember::new(
        invite.team_id.clone(),
        user.id.clone(),
        user.email.clone(),
        user.name.clone(),
        invite.role.clone(),
        invite.invited_by.clone(),
    );

    let created = db.add_team_member(&member)?;

    // Update invite status
    db.update_invite_status(&invite.id, InviteStatus::Accepted)?;

    let _ = audit.log_member_joined(&user.id, Some(&user.email), &invite.team_id);

    Ok(created)
}

#[tauri::command]
pub fn get_team_members(db: State<DbState>, team_id: String) -> Result<Vec<TeamMember>> {
    db.get_team_members(&team_id)
}

#[tauri::command]
pub fn update_member_role(
    db: State<DbState>,
    audit: State<AuditState>,
    sync: State<SyncState>,
    team_id: String,
    user_id: String,
    new_role: String,
) -> Result<()> {
    let actor = sync.current_user().ok_or_else(|| {
        crate::error::EnvSyncError::NotAuthenticated
    })?;

    let team = db.get_team(&team_id)?;

    // Check permissions
    let actor_member = db.get_team_member(&team_id, &actor.id)?;
    let can_change = team.owner_id == actor.id
        || actor_member.map(|m| m.role.can_admin()).unwrap_or(false);

    if !can_change {
        return Err(crate::error::EnvSyncError::PermissionDenied(
            "You don't have permission to change roles".to_string(),
        ));
    }

    let target_member = db.get_team_member(&team_id, &user_id)?.ok_or_else(|| {
        crate::error::EnvSyncError::MemberNotFound(user_id.clone())
    })?;

    let old_role = target_member.role.as_str().to_string();
    let new_role_enum = TeamRole::from_str(&new_role);

    db.update_member_role(&team_id, &user_id, new_role_enum)?;

    let _ = audit.log_member_role_changed(
        &actor.id,
        Some(&actor.email),
        &team_id,
        &user_id,
        &old_role,
        &new_role,
    );

    Ok(())
}

#[tauri::command]
pub fn remove_team_member(
    db: State<DbState>,
    audit: State<AuditState>,
    sync: State<SyncState>,
    team_id: String,
    user_id: String,
) -> Result<()> {
    let actor = sync.current_user().ok_or_else(|| {
        crate::error::EnvSyncError::NotAuthenticated
    })?;

    let team = db.get_team(&team_id)?;

    // Can't remove the owner
    if user_id == team.owner_id {
        return Err(crate::error::EnvSyncError::PermissionDenied(
            "Cannot remove the team owner".to_string(),
        ));
    }

    // Check permissions - owner, admin, or self
    let is_self = actor.id == user_id;
    let actor_member = db.get_team_member(&team_id, &actor.id)?;
    let can_remove = is_self
        || team.owner_id == actor.id
        || actor_member.map(|m| m.role.can_admin()).unwrap_or(false);

    if !can_remove {
        return Err(crate::error::EnvSyncError::PermissionDenied(
            "You don't have permission to remove members".to_string(),
        ));
    }

    db.remove_team_member(&team_id, &user_id)?;

    let _ = audit.log_member_removed(&actor.id, Some(&actor.email), &team_id, &user_id);

    Ok(())
}

#[tauri::command]
pub fn revoke_team_invite(
    db: State<DbState>,
    sync: State<SyncState>,
    invite_id: String,
) -> Result<()> {
    // Verify user is authenticated
    let _user = sync.current_user().ok_or_else(|| {
        crate::error::EnvSyncError::NotAuthenticated
    })?;

    db.revoke_invite(&invite_id)
}

// ========== Project Sharing Commands ==========

#[tauri::command]
pub fn share_project_with_team(
    db: State<DbState>,
    audit: State<AuditState>,
    sync: State<SyncState>,
    project_id: String,
    team_id: String,
) -> Result<ProjectTeamAccess> {
    let user = sync.current_user().ok_or_else(|| {
        crate::error::EnvSyncError::NotAuthenticated
    })?;

    let team = db.get_team(&team_id)?;

    // Check permissions - must be team owner or admin
    let member = db.get_team_member(&team_id, &user.id)?;
    let can_share = team.owner_id == user.id
        || member.map(|m| m.role.can_admin()).unwrap_or(false);

    if !can_share {
        return Err(crate::error::EnvSyncError::PermissionDenied(
            "You don't have permission to share projects".to_string(),
        ));
    }

    let access = ProjectTeamAccess::new(project_id.clone(), team_id.clone(), user.id.clone());
    let created = db.share_project_with_team(&access)?;

    let _ = audit.log_project_shared(&user.id, Some(&user.email), &project_id, &team_id);

    Ok(created)
}

#[tauri::command]
pub fn unshare_project_from_team(
    db: State<DbState>,
    audit: State<AuditState>,
    sync: State<SyncState>,
    project_id: String,
    team_id: String,
) -> Result<()> {
    let user = sync.current_user().ok_or_else(|| {
        crate::error::EnvSyncError::NotAuthenticated
    })?;

    let team = db.get_team(&team_id)?;

    // Check permissions
    let member = db.get_team_member(&team_id, &user.id)?;
    let can_unshare = team.owner_id == user.id
        || member.map(|m| m.role.can_admin()).unwrap_or(false);

    if !can_unshare {
        return Err(crate::error::EnvSyncError::PermissionDenied(
            "You don't have permission to unshare projects".to_string(),
        ));
    }

    db.unshare_project_from_team(&project_id, &team_id)?;

    let _ = audit.log_project_unshared(&user.id, Some(&user.email), &project_id, &team_id);

    Ok(())
}

#[tauri::command]
pub fn get_project_teams(db: State<DbState>, project_id: String) -> Result<Vec<Team>> {
    db.get_project_teams(&project_id)
}

#[tauri::command]
pub fn get_team_projects(db: State<DbState>, team_id: String) -> Result<Vec<Project>> {
    db.get_team_projects(&team_id)
}

#[tauri::command]
pub fn check_project_access(
    db: State<DbState>,
    sync: State<SyncState>,
    project_id: String,
) -> Result<Option<String>> {
    let user = sync.current_user().ok_or_else(|| {
        crate::error::EnvSyncError::NotAuthenticated
    })?;

    let role = db.user_can_access_project(&user.id, &project_id)?;
    Ok(role.map(|r| r.as_str().to_string()))
}

// ========== VeilKey Commands ==========

#[tauri::command]
pub fn generate_team_key(
    db: State<DbState>,
    audit: State<AuditState>,
    sync: State<SyncState>,
    team_id: String,
) -> Result<()> {
    let user = sync.current_user().ok_or_else(|| {
        crate::error::EnvSyncError::NotAuthenticated
    })?;

    let team = db.get_team(&team_id)?;

    // Only owner can generate keys
    if team.owner_id != user.id {
        return Err(crate::error::EnvSyncError::PermissionDenied(
            "Only the team owner can generate team keys".to_string(),
        ));
    }

    let veilkey = VeilKey::new(team.threshold, team.total_shares)?;
    let (_master_key, shares) = veilkey.generate_team_key()?;

    // Get team members to distribute shares
    let members = db.get_team_members(&team_id)?;

    if members.len() < team.total_shares as usize {
        return Err(crate::error::EnvSyncError::InvalidThreshold(
            format!(
                "Need at least {} members to distribute shares, have {}",
                team.total_shares,
                members.len()
            ),
        ));
    }

    // For now, store shares without encryption (would need user's public key in practice)
    for (i, (share_index, share_data)) in shares.iter().enumerate() {
        if i >= members.len() {
            break;
        }

        let member = &members[i];
        let key_share = KeyShare::new(
            team_id.clone(),
            *share_index,
            share_data.clone(),
            member.user_id.clone(),
        );

        db.store_key_share(&key_share)?;
        db.update_member_share_index(&team_id, &member.user_id, *share_index)?;

        let _ = audit.log_key_share_distributed(
            &user.id,
            Some(&user.email),
            &team_id,
            &member.user_id,
            *share_index,
        );
    }

    Ok(())
}

#[tauri::command]
pub fn get_team_key_shares(db: State<DbState>, team_id: String) -> Result<Vec<KeyShare>> {
    db.get_team_key_shares(&team_id)
}

#[tauri::command]
pub fn get_my_key_share(
    db: State<DbState>,
    sync: State<SyncState>,
    team_id: String,
) -> Result<Option<KeyShare>> {
    let user = sync.current_user().ok_or_else(|| {
        crate::error::EnvSyncError::NotAuthenticated
    })?;

    db.get_user_key_share(&team_id, &user.id)
}

// ========== Audit Log Commands ==========

#[tauri::command]
pub fn get_project_audit_log(
    db: State<DbState>,
    project_id: String,
    limit: Option<u32>,
) -> Result<Vec<AuditEvent>> {
    db.get_project_audit_log(&project_id, limit)
}

#[tauri::command]
pub fn get_team_audit_log(
    db: State<DbState>,
    team_id: String,
    limit: Option<u32>,
) -> Result<Vec<AuditEvent>> {
    db.get_team_audit_log(&team_id, limit)
}

#[tauri::command]
pub fn query_audit_log(
    db: State<DbState>,
    query: AuditQuery,
) -> Result<Vec<AuditEvent>> {
    db.query_audit_log(&query)
}
