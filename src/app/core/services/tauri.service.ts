import { Injectable } from '@angular/core';
import { invoke } from '@tauri-apps/api/core';
import {
  Project,
  Environment,
  Variable,
  VaultStatus,
  SearchResult,
  NetlifySite,
  NetlifyEnvVar,
  SyncStatus,
  SyncEvent,
  SyncResult,
  User,
  AuthTokens,
  ConflictInfo,
  ConflictResolution,
} from '../models';

@Injectable({
  providedIn: 'root',
})
export class TauriService {
  // ========== Vault Operations ==========

  async getVaultStatus(): Promise<VaultStatus> {
    return invoke<VaultStatus>('get_vault_status');
  }

  async initializeVault(masterPassword: string): Promise<void> {
    return invoke('initialize_vault', { masterPassword });
  }

  async unlockVault(masterPassword: string): Promise<void> {
    return invoke('unlock_vault', { masterPassword });
  }

  async lockVault(): Promise<void> {
    return invoke('lock_vault');
  }

  async checkAutoLock(): Promise<boolean> {
    return invoke<boolean>('check_auto_lock');
  }

  async touchActivity(): Promise<void> {
    return invoke('touch_activity');
  }

  // ========== Project Operations ==========

  async createProject(name: string, description?: string): Promise<Project> {
    return invoke<Project>('create_project', { name, description });
  }

  async getProjects(): Promise<Project[]> {
    return invoke<Project[]>('get_projects');
  }

  async getProject(id: string): Promise<Project> {
    return invoke<Project>('get_project', { id });
  }

  async updateProject(
    id: string,
    name: string,
    description?: string
  ): Promise<Project> {
    return invoke<Project>('update_project', { id, name, description });
  }

  async deleteProject(id: string): Promise<void> {
    return invoke('delete_project', { id });
  }

  // ========== Environment Operations ==========

  async createEnvironment(
    projectId: string,
    name: string,
    envType: string
  ): Promise<Environment> {
    return invoke<Environment>('create_environment', {
      projectId,
      name,
      envType,
    });
  }

  async getEnvironments(projectId: string): Promise<Environment[]> {
    return invoke<Environment[]>('get_environments', { projectId });
  }

  async getEnvironment(id: string): Promise<Environment> {
    return invoke<Environment>('get_environment', { id });
  }

  async deleteEnvironment(id: string): Promise<void> {
    return invoke('delete_environment', { id });
  }

  // ========== Variable Operations ==========

  async createVariable(
    environmentId: string,
    key: string,
    value: string,
    isSecret: boolean = true
  ): Promise<Variable> {
    return invoke<Variable>('create_variable', {
      environmentId,
      key,
      value,
      isSecret,
    });
  }

  async getVariables(environmentId: string): Promise<Variable[]> {
    return invoke<Variable[]>('get_variables', { environmentId });
  }

  async getVariable(id: string): Promise<Variable> {
    return invoke<Variable>('get_variable', { id });
  }

  async updateVariable(
    id: string,
    key: string,
    value: string,
    isSecret: boolean
  ): Promise<Variable> {
    return invoke<Variable>('update_variable', { id, key, value, isSecret });
  }

  async deleteVariable(id: string): Promise<void> {
    return invoke('delete_variable', { id });
  }

  // ========== Search Operations ==========

  async searchVariables(query: string): Promise<SearchResult[]> {
    return invoke<SearchResult[]>('search_variables', { query });
  }

  // ========== Import/Export Operations ==========

  async exportEnvFile(environmentId: string): Promise<string> {
    return invoke<string>('export_env_file', { environmentId });
  }

  async importEnvFile(
    environmentId: string,
    content: string
  ): Promise<Variable[]> {
    return invoke<Variable[]>('import_env_file', { environmentId, content });
  }

  // ========== Netlify Operations ==========

  async netlifyListSites(accessToken: string): Promise<NetlifySite[]> {
    return invoke<NetlifySite[]>('netlify_list_sites', { accessToken });
  }

  async netlifyGetEnvVars(
    accessToken: string,
    siteId: string
  ): Promise<NetlifyEnvVar[]> {
    return invoke<NetlifyEnvVar[]>('netlify_get_env_vars', {
      accessToken,
      siteId,
    });
  }

  async netlifyPushEnvVars(
    accessToken: string,
    siteId: string,
    environmentId: string
  ): Promise<void> {
    return invoke('netlify_push_env_vars', {
      accessToken,
      siteId,
      environmentId,
    });
  }

  async netlifyPullEnvVars(
    accessToken: string,
    siteId: string,
    environmentId: string
  ): Promise<Variable[]> {
    return invoke<Variable[]>('netlify_pull_env_vars', {
      accessToken,
      siteId,
      environmentId,
    });
  }

  // ========== Sync Operations ==========

  async getSyncStatus(): Promise<SyncStatus> {
    return invoke<SyncStatus>('get_sync_status');
  }

  async isSyncConnected(): Promise<boolean> {
    return invoke<boolean>('is_sync_connected');
  }

  async getSyncUser(): Promise<User | null> {
    return invoke<User | null>('get_sync_user');
  }

  async getSyncHistory(limit: number = 50): Promise<SyncEvent[]> {
    return invoke<SyncEvent[]>('get_sync_history', { limit });
  }

  async getSyncConflicts(): Promise<ConflictInfo[]> {
    return invoke<ConflictInfo[]>('get_sync_conflicts');
  }

  async syncSignup(
    email: string,
    password: string,
    name?: string
  ): Promise<User> {
    return invoke<User>('sync_signup', { email, password, name });
  }

  async syncLogin(email: string, password: string): Promise<User> {
    return invoke<User>('sync_login', { email, password });
  }

  async syncLogout(): Promise<void> {
    return invoke('sync_logout');
  }

  async syncRestoreSession(tokens: AuthTokens, user: User): Promise<void> {
    return invoke('sync_restore_session', { tokens, user });
  }

  async syncGetTokens(): Promise<AuthTokens | null> {
    return invoke<AuthTokens | null>('sync_get_tokens');
  }

  async syncNow(): Promise<SyncResult> {
    return invoke<SyncResult>('sync_now');
  }

  async syncResolveConflict(
    projectId: string,
    resolution: ConflictResolution
  ): Promise<void> {
    return invoke('sync_resolve_conflict', { projectId, resolution });
  }

  async syncSetEnabled(projectId: string, enabled: boolean): Promise<void> {
    return invoke('sync_set_enabled', { projectId, enabled });
  }

  async syncMarkDirty(projectId: string): Promise<void> {
    return invoke('sync_mark_dirty', { projectId });
  }
}
