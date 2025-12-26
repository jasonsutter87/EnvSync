export interface Project {
  id: string;
  name: string;
  description?: string;
  created_at: string;
  updated_at: string;
}

export interface Environment {
  id: string;
  project_id: string;
  name: string;
  env_type: 'Development' | 'Staging' | 'Production' | { Custom: string };
  created_at: string;
  updated_at: string;
}

export interface Variable {
  id: string;
  environment_id: string;
  key: string;
  value: string;
  is_secret: boolean;
  created_at: string;
  updated_at: string;
}

export interface VaultStatus {
  is_initialized: boolean;
  is_unlocked: boolean;
  last_activity?: string;
}

export interface SearchResult {
  project: Project;
  environment: Environment;
  variable: Variable;
}

export function getEnvTypeLabel(envType: Environment['env_type']): string {
  if (typeof envType === 'string') {
    return envType;
  }
  return envType.Custom;
}

export function getEnvTypeClass(envType: Environment['env_type']): string {
  const type = typeof envType === 'string' ? envType.toLowerCase() : 'custom';
  return `env-${type}`;
}

// Netlify types
export interface NetlifySite {
  id: string;
  name: string;
  url: string;
  account_slug: string;
  admin_url: string;
}

export interface NetlifyEnvVar {
  key: string;
  scopes: string[];
  values: NetlifyEnvValue[];
}

export interface NetlifyEnvValue {
  value: string;
  context: string;
}

// ========== Sync Types ==========

export interface User {
  id: string;
  email: string;
  name?: string;
  created_at: string;
}

export interface AuthTokens {
  access_token: string;
  refresh_token: string;
  expires_at: string;
}

export type SyncState =
  | 'Disconnected'
  | 'Idle'
  | 'Syncing'
  | { Error: string }
  | 'Conflict';

export interface SyncStatus {
  state: SyncState;
  last_sync?: string;
  pending_changes: number;
  user?: User;
}

export type SyncEventType =
  | 'Push'
  | 'Pull'
  | 'Conflict'
  | 'Resolved'
  | 'Created'
  | 'Updated'
  | 'Deleted';

export interface SyncEvent {
  id: string;
  event_type: SyncEventType;
  project_id?: string;
  environment_id?: string;
  variable_key?: string;
  details?: string;
  timestamp: string;
}

export interface ConflictInfo {
  project_id: string;
  environment_id?: string;
  variable_key?: string;
  local_value: string;
  remote_value: string;
  local_modified: string;
  remote_modified: string;
}

export type ConflictResolution = 'KeepLocal' | 'KeepRemote' | 'KeepBoth' | 'Merge';

export interface SyncResult {
  pushed: number;
  pulled: number;
  conflicts: number;
  errors: string[];
}

export function getSyncStateLabel(state: SyncState): string {
  if (typeof state === 'string') {
    return state;
  }
  return `Error: ${state.Error}`;
}

export function isSyncError(state: SyncState): boolean {
  return typeof state === 'object' && 'Error' in state;
}
