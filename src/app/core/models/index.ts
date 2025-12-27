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

/** VeilSign credential-based authentication */
export interface AuthTokens {
  /** VeilSign credential (base64) */
  credential: string;
  /** VeilSign signature (base64) */
  signature: string;
  /** When the credential expires */
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

// ========== Phase 3: Team Types ==========

export type TeamRole = 'Admin' | 'Member' | 'Viewer';

export interface Team {
  id: string;
  name: string;
  description?: string;
  owner_id: string;
  threshold: number;
  total_shares: number;
  created_at: string;
  updated_at: string;
}

export interface TeamMember {
  id: string;
  team_id: string;
  user_id: string;
  email: string;
  name?: string;
  role: TeamRole;
  share_index?: number;
  joined_at: string;
  invited_by: string;
}

export type InviteStatus = 'Pending' | 'Accepted' | 'Declined' | 'Expired' | 'Revoked';

export interface TeamInvite {
  id: string;
  team_id: string;
  email: string;
  role: TeamRole;
  status: InviteStatus;
  invited_by: string;
  token: string;
  expires_at: string;
  created_at: string;
}

export interface TeamWithMembers extends Team {
  members: TeamMember[];
  pending_invites: TeamInvite[];
}

export interface ProjectTeamAccess {
  id: string;
  project_id: string;
  team_id: string;
  granted_at: string;
  granted_by: string;
}

export interface KeyShare {
  id: string;
  team_id: string;
  share_index: number;
  encrypted_share: string;
  user_id: string;
  created_at: string;
}

// ========== VeilChain Audit Types ==========

export type AuditEventType =
  // Secret operations
  | 'SecretRead'
  | 'SecretWrite'
  | 'SecretDelete'
  | 'SecretExport'
  | 'SecretImport'
  // Team operations
  | 'TeamCreated'
  | 'TeamUpdated'
  | 'TeamDeleted'
  // Member operations
  | 'MemberInvited'
  | 'MemberJoined'
  | 'MemberRemoved'
  | 'MemberRoleChanged'
  // Access operations
  | 'ProjectShared'
  | 'ProjectUnshared'
  | 'AccessGranted'
  | 'AccessRevoked'
  // Auth operations
  | 'Login'
  | 'Logout'
  | 'SessionRestored'
  // Sync operations
  | 'SyncPush'
  | 'SyncPull'
  | 'ConflictResolved'
  // Threshold operations
  | 'KeyShareDistributed'
  | 'KeyReconstructionRequested'
  | 'KeyReconstructionApproved'
  | 'KeyReconstructed';

export interface AuditEvent {
  id: string;
  event_type: AuditEventType;
  actor_id: string;
  actor_email?: string;
  team_id?: string;
  project_id?: string;
  environment_id?: string;
  variable_key?: string;
  target_user_id?: string;
  ip_address?: string;
  user_agent?: string;
  details?: string;
  previous_hash?: string;
  hash: string;
  timestamp: string;
}

export interface AuditQuery {
  event_types?: AuditEventType[];
  actor_id?: string;
  team_id?: string;
  project_id?: string;
  from_date?: string;
  to_date?: string;
  limit?: number;
  offset?: number;
}

// Helper functions for teams
export function getTeamRoleLabel(role: TeamRole): string {
  return role;
}

export function canTeamRoleWrite(role: TeamRole): boolean {
  return role === 'Admin' || role === 'Member';
}

export function canTeamRoleAdmin(role: TeamRole): boolean {
  return role === 'Admin';
}

export function getAuditEventLabel(eventType: AuditEventType): string {
  const labels: Record<AuditEventType, string> = {
    SecretRead: 'Secret Read',
    SecretWrite: 'Secret Updated',
    SecretDelete: 'Secret Deleted',
    SecretExport: 'Secrets Exported',
    SecretImport: 'Secrets Imported',
    TeamCreated: 'Team Created',
    TeamUpdated: 'Team Updated',
    TeamDeleted: 'Team Deleted',
    MemberInvited: 'Member Invited',
    MemberJoined: 'Member Joined',
    MemberRemoved: 'Member Removed',
    MemberRoleChanged: 'Role Changed',
    ProjectShared: 'Project Shared',
    ProjectUnshared: 'Project Unshared',
    AccessGranted: 'Access Granted',
    AccessRevoked: 'Access Revoked',
    Login: 'Login',
    Logout: 'Logout',
    SessionRestored: 'Session Restored',
    SyncPush: 'Sync Push',
    SyncPull: 'Sync Pull',
    ConflictResolved: 'Conflict Resolved',
    KeyShareDistributed: 'Key Share Distributed',
    KeyReconstructionRequested: 'Key Reconstruction Requested',
    KeyReconstructionApproved: 'Key Reconstruction Approved',
    KeyReconstructed: 'Key Reconstructed',
  };
  return labels[eventType] || eventType;
}

export function getAuditEventIcon(eventType: AuditEventType): string {
  if (eventType.startsWith('Secret')) return 'key';
  if (eventType.startsWith('Team')) return 'users';
  if (eventType.startsWith('Member')) return 'user';
  if (eventType.startsWith('Project') || eventType.startsWith('Access')) return 'share';
  if (eventType === 'Login' || eventType === 'Logout' || eventType === 'SessionRestored') return 'log-in';
  if (eventType.startsWith('Sync') || eventType === 'ConflictResolved') return 'refresh-cw';
  if (eventType.startsWith('Key')) return 'shield';
  return 'activity';
}

// ========== Phase 5: Variable History Types ==========

export type VariableChangeType = 'Create' | 'Update' | 'Delete' | 'Restore';

export interface VariableHistory {
  id: string;
  variable_id: string;
  environment_id: string;
  project_id: string;
  variable_key: string;
  old_value: string | null;
  new_value: string | null;
  changed_by: string;
  changed_by_id: string;
  change_type: VariableChangeType;
  timestamp: string;
  ip_address?: string;
  user_agent?: string;
}

export interface HistoryQuery {
  project_id?: string;
  environment_id?: string;
  variable_key?: string;
  changed_by?: string;
  from_date?: string;
  to_date?: string;
  limit?: number;
  offset?: number;
}

export interface HistoryExportOptions {
  format: 'csv' | 'json';
  project_id?: string;
  environment_id?: string;
  variable_key?: string;
  changed_by?: string;
  from_date?: string;
  to_date?: string;
}

export function getChangeTypeLabel(changeType: VariableChangeType): string {
  const labels: Record<VariableChangeType, string> = {
    Create: 'Created',
    Update: 'Updated',
    Delete: 'Deleted',
    Restore: 'Restored'
  };
  return labels[changeType];
}

export function getChangeTypeIcon(changeType: VariableChangeType): string {
  const icons: Record<VariableChangeType, string> = {
    Create: 'plus-circle',
    Update: 'edit',
    Delete: 'trash-2',
    Restore: 'rotate-ccw'
  };
  return icons[changeType];
}
