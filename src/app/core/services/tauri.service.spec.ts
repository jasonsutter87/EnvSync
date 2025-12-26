/**
 * TauriService Unit Tests
 *
 * Comprehensive test suite for the EnvSync Tauri service covering:
 * - Service instantiation
 * - Vault operations IPC calls
 * - Project CRUD operations
 * - Environment operations
 * - Variable operations
 * - Search operations
 * - Import/Export operations
 * - Netlify integration
 * - Sync operations
 * - Team operations
 * - Audit log operations
 * - Tauri IPC mocking
 */

import { TestBed } from '@angular/core/testing';
import { TauriService } from './tauri.service';
import { vi } from 'vitest';
import {
  Project,
  Environment,
  Variable,
  VaultStatus,
  SearchResult,
  User,
  Team,
  TeamMember,
  TeamInvite,
  TeamWithMembers,
  TeamRole,
  SyncStatus,
  SyncResult,
  ConflictResolution,
  AuditEvent,
} from '../models';

// Mock Tauri invoke
vi.mock('@tauri-apps/api/core', () => ({
  invoke: vi.fn(),
}));

import { invoke } from '@tauri-apps/api/core';

describe('TauriService', () => {
  let service: TauriService;
  const mockInvoke = invoke as any;

  // Mock data
  const mockVaultStatus: VaultStatus = {
    is_initialized: true,
    is_unlocked: true,
    last_activity: '2024-01-01T00:00:00Z',
  };

  const mockProject: Project = {
    id: 'proj-1',
    name: 'Test Project',
    description: 'Test Description',
    created_at: '2024-01-01T00:00:00Z',
    updated_at: '2024-01-01T00:00:00Z',
  };

  const mockEnvironment: Environment = {
    id: 'env-1',
    project_id: 'proj-1',
    name: 'Development',
    env_type: 'Development',
    created_at: '2024-01-01T00:00:00Z',
    updated_at: '2024-01-01T00:00:00Z',
  };

  const mockVariable: Variable = {
    id: 'var-1',
    environment_id: 'env-1',
    key: 'API_KEY',
    value: 'secret-value',
    is_secret: true,
    created_at: '2024-01-01T00:00:00Z',
    updated_at: '2024-01-01T00:00:00Z',
  };

  const mockUser: User = {
    id: 'user-1',
    email: 'test@example.com',
    name: 'Test User',
    created_at: '2024-01-01T00:00:00Z',
  };

  const mockTeam: Team = {
    id: 'team-1',
    name: 'Test Team',
    owner_id: 'user-1',
    threshold: 2,
    total_shares: 3,
    created_at: '2024-01-01T00:00:00Z',
    updated_at: '2024-01-01T00:00:00Z',
  };

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [TauriService],
    });
    service = TestBed.inject(TauriService);
    mockInvoke.mockClear();
  });

  // ========== Service Instantiation ==========

  describe('Service Instantiation', () => {
    it('should be created', () => {
      expect(service).toBeTruthy();
    });
  });

  // ========== Vault Operations ==========

  describe('Vault Operations', () => {
    it('should get vault status', async () => {
      mockInvoke.mockResolvedValue(mockVaultStatus);

      const status = await service.getVaultStatus();

      expect(mockInvoke).toHaveBeenCalledWith('get_vault_status');
      expect(status).toEqual(mockVaultStatus);
    });

    it('should initialize vault', async () => {
      mockInvoke.mockResolvedValue(undefined);

      await service.initializeVault('password123');

      expect(mockInvoke).toHaveBeenCalledWith('initialize_vault', {
        masterPassword: 'password123',
      });
    });

    it('should unlock vault', async () => {
      mockInvoke.mockResolvedValue(undefined);

      await service.unlockVault('password123');

      expect(mockInvoke).toHaveBeenCalledWith('unlock_vault', {
        masterPassword: 'password123',
      });
    });

    it('should lock vault', async () => {
      mockInvoke.mockResolvedValue(undefined);

      await service.lockVault();

      expect(mockInvoke).toHaveBeenCalledWith('lock_vault');
    });

    it('should check auto lock', async () => {
      mockInvoke.mockResolvedValue(true);

      const result = await service.checkAutoLock();

      expect(mockInvoke).toHaveBeenCalledWith('check_auto_lock');
      expect(result).toBe(true);
    });

    it('should touch activity', async () => {
      mockInvoke.mockResolvedValue(undefined);

      await service.touchActivity();

      expect(mockInvoke).toHaveBeenCalledWith('touch_activity');
    });

    it('should handle vault initialization errors', async () => {
      mockInvoke.mockRejectedValue(new Error('Vault already initialized'));

      await expectAsync(service.initializeVault('password')).toBeRejectedWithError(
        'Vault already initialized'
      );
    });

    it('should handle unlock errors', async () => {
      mockInvoke.mockRejectedValue(new Error('Invalid password'));

      await expectAsync(service.unlockVault('wrong')).toBeRejectedWithError('Invalid password');
    });
  });

  // ========== Project Operations ==========

  describe('Project Operations', () => {
    it('should create a project', async () => {
      mockInvoke.mockResolvedValue(mockProject);

      const project = await service.createProject('Test Project', 'Description');

      expect(mockInvoke).toHaveBeenCalledWith('create_project', {
        name: 'Test Project',
        description: 'Description',
      });
      expect(project).toEqual(mockProject);
    });

    it('should get all projects', async () => {
      const mockProjects = [mockProject];
      mockInvoke.mockResolvedValue(mockProjects);

      const projects = await service.getProjects();

      expect(mockInvoke).toHaveBeenCalledWith('get_projects');
      expect(projects).toEqual(mockProjects);
    });

    it('should get a single project', async () => {
      mockInvoke.mockResolvedValue(mockProject);

      const project = await service.getProject('proj-1');

      expect(mockInvoke).toHaveBeenCalledWith('get_project', { id: 'proj-1' });
      expect(project).toEqual(mockProject);
    });

    it('should update a project', async () => {
      mockInvoke.mockResolvedValue(mockProject);

      const project = await service.updateProject('proj-1', 'Updated Name', 'Updated Desc');

      expect(mockInvoke).toHaveBeenCalledWith('update_project', {
        id: 'proj-1',
        name: 'Updated Name',
        description: 'Updated Desc',
      });
      expect(project).toEqual(mockProject);
    });

    it('should delete a project', async () => {
      mockInvoke.mockResolvedValue(undefined);

      await service.deleteProject('proj-1');

      expect(mockInvoke).toHaveBeenCalledWith('delete_project', { id: 'proj-1' });
    });

    it('should create project without description', async () => {
      mockInvoke.mockResolvedValue(mockProject);

      await service.createProject('Test Project');

      expect(mockInvoke).toHaveBeenCalledWith('create_project', {
        name: 'Test Project',
        description: undefined,
      });
    });

    it('should handle project creation errors', async () => {
      mockInvoke.mockRejectedValue(new Error('Project name already exists'));

      await expectAsync(service.createProject('Duplicate')).toBeRejectedWithError(
        'Project name already exists'
      );
    });

    it('should handle project not found errors', async () => {
      mockInvoke.mockRejectedValue(new Error('Project not found'));

      await expectAsync(service.getProject('non-existent')).toBeRejectedWithError(
        'Project not found'
      );
    });
  });

  // ========== Environment Operations ==========

  describe('Environment Operations', () => {
    it('should create an environment', async () => {
      mockInvoke.mockResolvedValue(mockEnvironment);

      const environment = await service.createEnvironment('proj-1', 'Staging', 'Staging');

      expect(mockInvoke).toHaveBeenCalledWith('create_environment', {
        projectId: 'proj-1',
        name: 'Staging',
        envType: 'Staging',
      });
      expect(environment).toEqual(mockEnvironment);
    });

    it('should get environments for a project', async () => {
      const mockEnvironments = [mockEnvironment];
      mockInvoke.mockResolvedValue(mockEnvironments);

      const environments = await service.getEnvironments('proj-1');

      expect(mockInvoke).toHaveBeenCalledWith('get_environments', { projectId: 'proj-1' });
      expect(environments).toEqual(mockEnvironments);
    });

    it('should get a single environment', async () => {
      mockInvoke.mockResolvedValue(mockEnvironment);

      const environment = await service.getEnvironment('env-1');

      expect(mockInvoke).toHaveBeenCalledWith('get_environment', { id: 'env-1' });
      expect(environment).toEqual(mockEnvironment);
    });

    it('should delete an environment', async () => {
      mockInvoke.mockResolvedValue(undefined);

      await service.deleteEnvironment('env-1');

      expect(mockInvoke).toHaveBeenCalledWith('delete_environment', { id: 'env-1' });
    });

    it('should handle environment creation with custom type', async () => {
      mockInvoke.mockResolvedValue(mockEnvironment);

      await service.createEnvironment('proj-1', 'QA', 'Custom');

      expect(mockInvoke).toHaveBeenCalledWith('create_environment', {
        projectId: 'proj-1',
        name: 'QA',
        envType: 'Custom',
      });
    });
  });

  // ========== Variable Operations ==========

  describe('Variable Operations', () => {
    it('should create a variable', async () => {
      mockInvoke.mockResolvedValue(mockVariable);

      const variable = await service.createVariable('env-1', 'API_KEY', 'secret', true);

      expect(mockInvoke).toHaveBeenCalledWith('create_variable', {
        environmentId: 'env-1',
        key: 'API_KEY',
        value: 'secret',
        isSecret: true,
      });
      expect(variable).toEqual(mockVariable);
    });

    it('should create non-secret variable', async () => {
      mockInvoke.mockResolvedValue(mockVariable);

      await service.createVariable('env-1', 'PUBLIC_KEY', 'public-value', false);

      expect(mockInvoke).toHaveBeenCalledWith('create_variable', {
        environmentId: 'env-1',
        key: 'PUBLIC_KEY',
        value: 'public-value',
        isSecret: false,
      });
    });

    it('should default isSecret to true', async () => {
      mockInvoke.mockResolvedValue(mockVariable);

      await service.createVariable('env-1', 'API_KEY', 'secret');

      expect(mockInvoke).toHaveBeenCalledWith('create_variable', {
        environmentId: 'env-1',
        key: 'API_KEY',
        value: 'secret',
        isSecret: true,
      });
    });

    it('should get variables for an environment', async () => {
      const mockVariables = [mockVariable];
      mockInvoke.mockResolvedValue(mockVariables);

      const variables = await service.getVariables('env-1');

      expect(mockInvoke).toHaveBeenCalledWith('get_variables', { environmentId: 'env-1' });
      expect(variables).toEqual(mockVariables);
    });

    it('should get a single variable', async () => {
      mockInvoke.mockResolvedValue(mockVariable);

      const variable = await service.getVariable('var-1');

      expect(mockInvoke).toHaveBeenCalledWith('get_variable', { id: 'var-1' });
      expect(variable).toEqual(mockVariable);
    });

    it('should update a variable', async () => {
      mockInvoke.mockResolvedValue(mockVariable);

      const variable = await service.updateVariable('var-1', 'NEW_KEY', 'new-value', false);

      expect(mockInvoke).toHaveBeenCalledWith('update_variable', {
        id: 'var-1',
        key: 'NEW_KEY',
        value: 'new-value',
        isSecret: false,
      });
      expect(variable).toEqual(mockVariable);
    });

    it('should delete a variable', async () => {
      mockInvoke.mockResolvedValue(undefined);

      await service.deleteVariable('var-1');

      expect(mockInvoke).toHaveBeenCalledWith('delete_variable', { id: 'var-1' });
    });
  });

  // ========== Search Operations ==========

  describe('Search Operations', () => {
    it('should search variables', async () => {
      const mockResults: SearchResult[] = [{
        project: mockProject,
        environment: mockEnvironment,
        variable: mockVariable,
      }];
      mockInvoke.mockResolvedValue(mockResults);

      const results = await service.searchVariables('API_KEY');

      expect(mockInvoke).toHaveBeenCalledWith('search_variables', { query: 'API_KEY' });
      expect(results).toEqual(mockResults);
    });

    it('should handle empty search results', async () => {
      mockInvoke.mockResolvedValue([]);

      const results = await service.searchVariables('nonexistent');

      expect(results).toEqual([]);
    });

    it('should search with special characters', async () => {
      mockInvoke.mockResolvedValue([]);

      await service.searchVariables('API_KEY*');

      expect(mockInvoke).toHaveBeenCalledWith('search_variables', { query: 'API_KEY*' });
    });
  });

  // ========== Import/Export Operations ==========

  describe('Import/Export Operations', () => {
    it('should export env file', async () => {
      const mockContent = 'API_KEY=value\nSECRET=secret\n';
      mockInvoke.mockResolvedValue(mockContent);

      const content = await service.exportEnvFile('env-1');

      expect(mockInvoke).toHaveBeenCalledWith('export_env_file', { environmentId: 'env-1' });
      expect(content).toBe(mockContent);
    });

    it('should import env file', async () => {
      const importContent = 'API_KEY=value\nSECRET=secret\n';
      const mockVariables = [mockVariable];
      mockInvoke.mockResolvedValue(mockVariables);

      const variables = await service.importEnvFile('env-1', importContent);

      expect(mockInvoke).toHaveBeenCalledWith('import_env_file', {
        environmentId: 'env-1',
        content: importContent,
      });
      expect(variables).toEqual(mockVariables);
    });

    it('should handle empty import content', async () => {
      mockInvoke.mockResolvedValue([]);

      const variables = await service.importEnvFile('env-1', '');

      expect(variables).toEqual([]);
    });
  });

  // ========== Netlify Operations ==========

  describe('Netlify Operations', () => {
    it('should list Netlify sites', async () => {
      const mockSites = [
        { id: 'site-1', name: 'My Site', url: 'https://example.com', account_slug: 'my-account', admin_url: 'https://app.netlify.com' },
      ];
      mockInvoke.mockResolvedValue(mockSites);

      const sites = await service.netlifyListSites('access-token');

      expect(mockInvoke).toHaveBeenCalledWith('netlify_list_sites', { accessToken: 'access-token' });
      expect(sites).toEqual(mockSites);
    });

    it('should get Netlify env vars', async () => {
      const mockEnvVars = [
        { key: 'API_KEY', scopes: ['builds'], values: [{ value: 'secret', context: 'production' }] },
      ];
      mockInvoke.mockResolvedValue(mockEnvVars);

      const envVars = await service.netlifyGetEnvVars('access-token', 'site-1');

      expect(mockInvoke).toHaveBeenCalledWith('netlify_get_env_vars', {
        accessToken: 'access-token',
        siteId: 'site-1',
      });
      expect(envVars).toEqual(mockEnvVars);
    });

    it('should push env vars to Netlify', async () => {
      mockInvoke.mockResolvedValue(undefined);

      await service.netlifyPushEnvVars('access-token', 'site-1', 'env-1');

      expect(mockInvoke).toHaveBeenCalledWith('netlify_push_env_vars', {
        accessToken: 'access-token',
        siteId: 'site-1',
        environmentId: 'env-1',
      });
    });

    it('should pull env vars from Netlify', async () => {
      const mockVariables = [mockVariable];
      mockInvoke.mockResolvedValue(mockVariables);

      const variables = await service.netlifyPullEnvVars('access-token', 'site-1', 'env-1');

      expect(mockInvoke).toHaveBeenCalledWith('netlify_pull_env_vars', {
        accessToken: 'access-token',
        siteId: 'site-1',
        environmentId: 'env-1',
      });
      expect(variables).toEqual(mockVariables);
    });
  });

  // ========== Sync Operations ==========

  describe('Sync Operations', () => {
    it('should get sync status', async () => {
      const mockStatus: SyncStatus = {
        state: 'Idle',
        pending_changes: 5,
        user: mockUser,
      };
      mockInvoke.mockResolvedValue(mockStatus);

      const status = await service.getSyncStatus();

      expect(mockInvoke).toHaveBeenCalledWith('get_sync_status');
      expect(status).toEqual(mockStatus);
    });

    it('should check if sync is connected', async () => {
      mockInvoke.mockResolvedValue(true);

      const connected = await service.isSyncConnected();

      expect(mockInvoke).toHaveBeenCalledWith('is_sync_connected');
      expect(connected).toBe(true);
    });

    it('should get sync user', async () => {
      mockInvoke.mockResolvedValue(mockUser);

      const user = await service.getSyncUser();

      expect(mockInvoke).toHaveBeenCalledWith('get_sync_user');
      expect(user).toEqual(mockUser);
    });

    it('should get sync history', async () => {
      const mockHistory = [
        { id: 'event-1', event_type: 'Push', timestamp: '2024-01-01' },
      ];
      mockInvoke.mockResolvedValue(mockHistory);

      const history = await service.getSyncHistory(100);

      expect(mockInvoke).toHaveBeenCalledWith('get_sync_history', { limit: 100 });
      expect(history).toEqual(mockHistory);
    });

    it('should use default limit for sync history', async () => {
      mockInvoke.mockResolvedValue([]);

      await service.getSyncHistory();

      expect(mockInvoke).toHaveBeenCalledWith('get_sync_history', { limit: 50 });
    });

    it('should get sync conflicts', async () => {
      const mockConflicts = [];
      mockInvoke.mockResolvedValue(mockConflicts);

      const conflicts = await service.getSyncConflicts();

      expect(mockInvoke).toHaveBeenCalledWith('get_sync_conflicts');
      expect(conflicts).toEqual(mockConflicts);
    });

    it('should signup for sync', async () => {
      mockInvoke.mockResolvedValue(mockUser);

      const user = await service.syncSignup('test@example.com', 'password', 'Test User');

      expect(mockInvoke).toHaveBeenCalledWith('sync_signup', {
        email: 'test@example.com',
        password: 'password',
        name: 'Test User',
      });
      expect(user).toEqual(mockUser);
    });

    it('should login to sync', async () => {
      mockInvoke.mockResolvedValue(mockUser);

      const user = await service.syncLogin('test@example.com', 'password');

      expect(mockInvoke).toHaveBeenCalledWith('sync_login', {
        email: 'test@example.com',
        password: 'password',
      });
      expect(user).toEqual(mockUser);
    });

    it('should logout from sync', async () => {
      mockInvoke.mockResolvedValue(undefined);

      await service.syncLogout();

      expect(mockInvoke).toHaveBeenCalledWith('sync_logout');
    });

    it('should restore sync session', async () => {
      const mockTokens = {
        access_token: 'token',
        refresh_token: 'refresh',
        expires_at: '2024-12-31',
      };
      mockInvoke.mockResolvedValue(undefined);

      await service.syncRestoreSession(mockTokens, mockUser);

      expect(mockInvoke).toHaveBeenCalledWith('sync_restore_session', {
        tokens: mockTokens,
        user: mockUser,
      });
    });

    it('should get sync tokens', async () => {
      const mockTokens = {
        access_token: 'token',
        refresh_token: 'refresh',
        expires_at: '2024-12-31',
      };
      mockInvoke.mockResolvedValue(mockTokens);

      const tokens = await service.syncGetTokens();

      expect(mockInvoke).toHaveBeenCalledWith('sync_get_tokens');
      expect(tokens).toEqual(mockTokens);
    });

    it('should sync now', async () => {
      const mockResult: SyncResult = {
        pushed: 3,
        pulled: 2,
        conflicts: 0,
        errors: [],
      };
      mockInvoke.mockResolvedValue(mockResult);

      const result = await service.syncNow();

      expect(mockInvoke).toHaveBeenCalledWith('sync_now');
      expect(result).toEqual(mockResult);
    });

    it('should resolve conflict', async () => {
      mockInvoke.mockResolvedValue(undefined);

      await service.syncResolveConflict('proj-1', 'KeepLocal');

      expect(mockInvoke).toHaveBeenCalledWith('sync_resolve_conflict', {
        projectId: 'proj-1',
        resolution: 'KeepLocal',
      });
    });

    it('should set sync enabled', async () => {
      mockInvoke.mockResolvedValue(undefined);

      await service.syncSetEnabled('proj-1', true);

      expect(mockInvoke).toHaveBeenCalledWith('sync_set_enabled', {
        projectId: 'proj-1',
        enabled: true,
      });
    });

    it('should mark project dirty', async () => {
      mockInvoke.mockResolvedValue(undefined);

      await service.syncMarkDirty('proj-1');

      expect(mockInvoke).toHaveBeenCalledWith('sync_mark_dirty', { projectId: 'proj-1' });
    });
  });

  // ========== Team Operations ==========

  describe('Team Operations', () => {
    it('should create a team', async () => {
      mockInvoke.mockResolvedValue(mockTeam);

      const team = await service.createTeam('Test Team', 'Description', 2, 3);

      expect(mockInvoke).toHaveBeenCalledWith('create_team', {
        name: 'Test Team',
        description: 'Description',
        threshold: 2,
        totalShares: 3,
      });
      expect(team).toEqual(mockTeam);
    });

    it('should get a team', async () => {
      mockInvoke.mockResolvedValue(mockTeam);

      const team = await service.getTeam('team-1');

      expect(mockInvoke).toHaveBeenCalledWith('get_team', { id: 'team-1' });
      expect(team).toEqual(mockTeam);
    });

    it('should get all teams', async () => {
      const mockTeams = [mockTeam];
      mockInvoke.mockResolvedValue(mockTeams);

      const teams = await service.getTeams();

      expect(mockInvoke).toHaveBeenCalledWith('get_teams');
      expect(teams).toEqual(mockTeams);
    });

    it('should get team with members', async () => {
      const mockTeamWithMembers: TeamWithMembers = {
        ...mockTeam,
        members: [],
        pending_invites: [],
      };
      mockInvoke.mockResolvedValue(mockTeamWithMembers);

      const team = await service.getTeamWithMembers('team-1');

      expect(mockInvoke).toHaveBeenCalledWith('get_team_with_members', { teamId: 'team-1' });
      expect(team).toEqual(mockTeamWithMembers);
    });

    it('should update a team', async () => {
      mockInvoke.mockResolvedValue(mockTeam);

      const team = await service.updateTeam('team-1', 'Updated Name', 'Updated Desc');

      expect(mockInvoke).toHaveBeenCalledWith('update_team', {
        id: 'team-1',
        name: 'Updated Name',
        description: 'Updated Desc',
      });
      expect(team).toEqual(mockTeam);
    });

    it('should delete a team', async () => {
      mockInvoke.mockResolvedValue(undefined);

      await service.deleteTeam('team-1');

      expect(mockInvoke).toHaveBeenCalledWith('delete_team', { id: 'team-1' });
    });
  });

  // ========== Team Member Operations ==========

  describe('Team Member Operations', () => {
    it('should invite team member', async () => {
      const mockInvite: TeamInvite = {
        id: 'invite-1',
        team_id: 'team-1',
        email: 'new@example.com',
        role: 'Member',
        status: 'Pending',
        invited_by: 'user-1',
        token: 'token',
        expires_at: '2024-12-31',
        created_at: '2024-01-01',
      };
      mockInvoke.mockResolvedValue(mockInvite);

      const invite = await service.inviteTeamMember('team-1', 'new@example.com', 'Member');

      expect(mockInvoke).toHaveBeenCalledWith('invite_team_member', {
        teamId: 'team-1',
        email: 'new@example.com',
        role: 'Member',
      });
      expect(invite).toEqual(mockInvite);
    });

    it('should accept team invite', async () => {
      const mockMember: TeamMember = {
        id: 'member-1',
        team_id: 'team-1',
        user_id: 'user-2',
        email: 'new@example.com',
        role: 'Member',
        joined_at: '2024-01-01',
        invited_by: 'user-1',
      };
      mockInvoke.mockResolvedValue(mockMember);

      const member = await service.acceptTeamInvite('invite-token');

      expect(mockInvoke).toHaveBeenCalledWith('accept_team_invite', { token: 'invite-token' });
      expect(member).toEqual(mockMember);
    });

    it('should get team members', async () => {
      const mockMembers: TeamMember[] = [];
      mockInvoke.mockResolvedValue(mockMembers);

      const members = await service.getTeamMembers('team-1');

      expect(mockInvoke).toHaveBeenCalledWith('get_team_members', { teamId: 'team-1' });
      expect(members).toEqual(mockMembers);
    });

    it('should update member role', async () => {
      mockInvoke.mockResolvedValue(undefined);

      await service.updateMemberRole('team-1', 'user-2', 'Admin');

      expect(mockInvoke).toHaveBeenCalledWith('update_member_role', {
        teamId: 'team-1',
        userId: 'user-2',
        newRole: 'Admin',
      });
    });

    it('should remove team member', async () => {
      mockInvoke.mockResolvedValue(undefined);

      await service.removeTeamMember('team-1', 'user-2');

      expect(mockInvoke).toHaveBeenCalledWith('remove_team_member', {
        teamId: 'team-1',
        userId: 'user-2',
      });
    });

    it('should revoke team invite', async () => {
      mockInvoke.mockResolvedValue(undefined);

      await service.revokeTeamInvite('invite-1');

      expect(mockInvoke).toHaveBeenCalledWith('revoke_team_invite', { inviteId: 'invite-1' });
    });
  });

  // ========== Project Sharing Operations ==========

  describe('Project Sharing Operations', () => {
    it('should share project with team', async () => {
      const mockAccess = {
        id: 'access-1',
        project_id: 'proj-1',
        team_id: 'team-1',
        granted_at: '2024-01-01',
        granted_by: 'user-1',
      };
      mockInvoke.mockResolvedValue(mockAccess);

      const access = await service.shareProjectWithTeam('proj-1', 'team-1');

      expect(mockInvoke).toHaveBeenCalledWith('share_project_with_team', {
        projectId: 'proj-1',
        teamId: 'team-1',
      });
      expect(access).toEqual(mockAccess);
    });

    it('should unshare project from team', async () => {
      mockInvoke.mockResolvedValue(undefined);

      await service.unshareProjectFromTeam('proj-1', 'team-1');

      expect(mockInvoke).toHaveBeenCalledWith('unshare_project_from_team', {
        projectId: 'proj-1',
        teamId: 'team-1',
      });
    });

    it('should get project teams', async () => {
      const mockTeams = [mockTeam];
      mockInvoke.mockResolvedValue(mockTeams);

      const teams = await service.getProjectTeams('proj-1');

      expect(mockInvoke).toHaveBeenCalledWith('get_project_teams', { projectId: 'proj-1' });
      expect(teams).toEqual(mockTeams);
    });

    it('should get team projects', async () => {
      const mockProjects = [mockProject];
      mockInvoke.mockResolvedValue(mockProjects);

      const projects = await service.getTeamProjects('team-1');

      expect(mockInvoke).toHaveBeenCalledWith('get_team_projects', { teamId: 'team-1' });
      expect(projects).toEqual(mockProjects);
    });

    it('should check project access', async () => {
      mockInvoke.mockResolvedValue('Admin');

      const role = await service.checkProjectAccess('proj-1');

      expect(mockInvoke).toHaveBeenCalledWith('check_project_access', { projectId: 'proj-1' });
      expect(role).toBe('Admin');
    });
  });

  // ========== VeilKey Operations ==========

  describe('VeilKey Operations', () => {
    it('should generate team key', async () => {
      mockInvoke.mockResolvedValue(undefined);

      await service.generateTeamKey('team-1');

      expect(mockInvoke).toHaveBeenCalledWith('generate_team_key', { teamId: 'team-1' });
    });

    it('should get team key shares', async () => {
      const mockShares = [
        { id: 'share-1', team_id: 'team-1', share_index: 0, encrypted_share: 'share', user_id: 'user-1', created_at: '2024-01-01' },
      ];
      mockInvoke.mockResolvedValue(mockShares);

      const shares = await service.getTeamKeyShares('team-1');

      expect(mockInvoke).toHaveBeenCalledWith('get_team_key_shares', { teamId: 'team-1' });
      expect(shares).toEqual(mockShares);
    });

    it('should get my key share', async () => {
      const mockShare = {
        id: 'share-1',
        team_id: 'team-1',
        share_index: 0,
        encrypted_share: 'share',
        user_id: 'user-1',
        created_at: '2024-01-01',
      };
      mockInvoke.mockResolvedValue(mockShare);

      const share = await service.getMyKeyShare('team-1');

      expect(mockInvoke).toHaveBeenCalledWith('get_my_key_share', { teamId: 'team-1' });
      expect(share).toEqual(mockShare);
    });
  });

  // ========== Audit Log Operations ==========

  describe('Audit Log Operations', () => {
    it('should get project audit log', async () => {
      const mockEvents: AuditEvent[] = [{
        id: 'audit-1',
        event_type: 'SecretWrite',
        actor_id: 'user-1',
        hash: 'hash',
        timestamp: '2024-01-01',
      }];
      mockInvoke.mockResolvedValue(mockEvents);

      const events = await service.getProjectAuditLog('proj-1', 100);

      expect(mockInvoke).toHaveBeenCalledWith('get_project_audit_log', {
        projectId: 'proj-1',
        limit: 100,
      });
      expect(events).toEqual(mockEvents);
    });

    it('should get team audit log', async () => {
      const mockEvents: AuditEvent[] = [];
      mockInvoke.mockResolvedValue(mockEvents);

      const events = await service.getTeamAuditLog('team-1', 50);

      expect(mockInvoke).toHaveBeenCalledWith('get_team_audit_log', {
        teamId: 'team-1',
        limit: 50,
      });
      expect(events).toEqual(mockEvents);
    });

    it('should query audit log', async () => {
      const query = {
        event_types: ['TeamCreated', 'TeamUpdated'],
        team_id: 'team-1',
        limit: 100,
      };
      const mockEvents: AuditEvent[] = [];
      mockInvoke.mockResolvedValue(mockEvents);

      const events = await service.queryAuditLog(query as any);

      expect(mockInvoke).toHaveBeenCalledWith('query_audit_log', { query });
      expect(events).toEqual(mockEvents);
    });
  });

  // ========== Error Handling ==========

  describe('Error Handling', () => {
    it('should propagate Tauri IPC errors', async () => {
      mockInvoke.mockRejectedValue(new Error('Tauri IPC error'));

      await expectAsync(service.getVaultStatus()).toBeRejectedWithError('Tauri IPC error');
    });

    it('should handle authentication errors', async () => {
      mockInvoke.mockRejectedValue(new Error('Invalid credentials'));

      await expectAsync(service.syncLogin('test@example.com', 'wrong')).toBeRejectedWithError(
        'Invalid credentials'
      );
    });

    it('should handle resource not found errors', async () => {
      mockInvoke.mockRejectedValue(new Error('Project not found'));

      await expectAsync(service.getProject('non-existent')).toBeRejectedWithError(
        'Project not found'
      );
    });
  });
});
