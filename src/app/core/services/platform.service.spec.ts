/**
 * PlatformService Unit Tests
 *
 * Comprehensive test suite for the EnvSync Platform service covering:
 * - Service instantiation and platform detection
 * - Platform abstraction (Tauri vs Web)
 * - Vault operations routing
 * - Authentication routing
 * - Project, Environment, and Variable operations
 * - Team operations routing
 * - Observable to Promise conversion
 * - Error handling
 * - Encryption/decryption delegation
 */

import { TestBed } from '@angular/core/testing';
import { PLATFORM_ID } from '@angular/core';
import { PlatformService } from './platform.service';
import { TauriService } from './tauri.service';
import { ApiService } from './api.service';
import { CryptoService } from './crypto.service';
import { of, throwError } from 'rxjs';
import {
  Project,
  Environment,
  Variable,
  VaultStatus,
  User,
  Team,
  TeamWithMembers,
  TeamRole,
  SyncStatus,
  SyncResult,
  SearchResult,
  AuditEvent,
} from '../models';

describe('PlatformService', () => {
  let service: PlatformService;
  let tauriService: jasmine.SpyObj<TauriService>;
  let apiService: jasmine.SpyObj<ApiService>;
  let cryptoService: jasmine.SpyObj<CryptoService>;

  // Mock data
  const mockUser: User = {
    id: 'user-1',
    email: 'test@example.com',
    name: 'Test User',
    created_at: '2024-01-01T00:00:00Z',
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
    value: 'encrypted-value',
    is_secret: true,
    created_at: '2024-01-01T00:00:00Z',
    updated_at: '2024-01-01T00:00:00Z',
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

  const mockVaultStatus: VaultStatus = {
    is_initialized: true,
    is_unlocked: true,
    last_activity: '2024-01-01T00:00:00Z',
  };

  beforeEach(() => {
    const tauriSpy = jasmine.createSpyObj('TauriService', [
      'getVaultStatus',
      'initializeVault',
      'unlockVault',
      'lockVault',
      'syncLogin',
      'syncSignup',
      'syncLogout',
      'getProjects',
      'getProject',
      'createProject',
      'updateProject',
      'deleteProject',
      'getEnvironments',
      'createEnvironment',
      'deleteEnvironment',
      'getVariables',
      'createVariable',
      'updateVariable',
      'deleteVariable',
      'searchVariables',
      'getSyncStatus',
      'syncNow',
      'getTeams',
      'getTeamWithMembers',
      'createTeam',
      'inviteTeamMember',
      'getTeamAuditLog',
      'getTeamProjects',
    ]);

    const apiSpy = jasmine.createSpyObj('ApiService', [
      'login',
      'register',
      'logout',
      'isAuthenticated',
      'getProjects',
      'getProject',
      'createProject',
      'updateProject',
      'deleteProject',
      'getEnvironments',
      'createEnvironment',
      'deleteEnvironment',
      'getVariables',
      'createVariable',
      'updateVariable',
      'deleteVariable',
      'searchVariables',
      'getSyncStatus',
      'syncNow',
      'getTeams',
      'getTeamWithMembers',
      'createTeam',
      'inviteTeamMember',
      'getTeamAuditLog',
    ]);

    const cryptoSpy = jasmine.createSpyObj('CryptoService', [
      'isInitialized',
      'initialize',
      'lock',
      'encrypt',
      'decrypt',
    ]);

    TestBed.configureTestingModule({
      providers: [
        PlatformService,
        { provide: TauriService, useValue: tauriSpy },
        { provide: ApiService, useValue: apiSpy },
        { provide: CryptoService, useValue: cryptoSpy },
        { provide: PLATFORM_ID, useValue: 'browser' },
      ],
    });

    service = TestBed.inject(PlatformService);
    tauriService = TestBed.inject(TauriService) as jasmine.SpyObj<TauriService>;
    apiService = TestBed.inject(ApiService) as jasmine.SpyObj<ApiService>;
    cryptoService = TestBed.inject(CryptoService) as jasmine.SpyObj<CryptoService>;

    localStorage.clear();
  });

  afterEach(() => {
    localStorage.clear();
  });

  // ========== Service Instantiation & Platform Detection ==========

  describe('Service Instantiation', () => {
    it('should be created', () => {
      expect(service).toBeTruthy();
    });

    it('should detect web platform by default', () => {
      expect(service.platform).toBe('web');
      expect(service.isWeb).toBe(true);
      expect(service.isTauri).toBe(false);
    });

    it('should detect Tauri platform when __TAURI__ exists', () => {
      // Mock Tauri environment
      (window as any).__TAURI__ = {};

      const newService = new PlatformService(
        'browser',
        tauriService,
        apiService,
        cryptoService
      );

      expect(newService.platform).toBe('tauri');
      expect(newService.isTauri).toBe(true);
      expect(newService.isWeb).toBe(false);

      delete (window as any).__TAURI__;
    });

    it('should detect web platform for server-side rendering', () => {
      const newService = new PlatformService(
        'server',
        tauriService,
        apiService,
        cryptoService
      );

      expect(newService.platform).toBe('web');
    });
  });

  // ========== Vault Operations ==========

  describe('Vault Operations - Web Mode', () => {
    it('should get vault status in web mode', async () => {
      apiService.isAuthenticated.and.returnValue(true);
      cryptoService.isInitialized.and.returnValue(true);

      const status = await service.getVaultStatus();

      expect(status.initialized).toBe(true);
      expect(status.locked).toBe(false);
      expect(status.lastActivity).toBeDefined();
    });

    it('should initialize vault in web mode', async () => {
      cryptoService.initialize.and.returnValue(Promise.resolve('salt-123'));

      await service.initializeVault('password123');

      expect(cryptoService.initialize).toHaveBeenCalledWith('password123');
    });

    it('should unlock vault in web mode', async () => {
      const userData = { master_key_salt: 'salt-123' };
      localStorage.setItem('envsync_user', JSON.stringify(userData));
      cryptoService.initialize.and.returnValue(Promise.resolve('salt-123'));

      await service.unlockVault('password123');

      expect(cryptoService.initialize).toHaveBeenCalledWith('password123', 'salt-123');
    });

    it('should lock vault in web mode', async () => {
      await service.lockVault();
      expect(cryptoService.lock).toHaveBeenCalled();
    });

    it('should handle unlock without stored user', async () => {
      cryptoService.initialize.and.returnValue(Promise.resolve('salt-123'));

      await service.unlockVault('password123');

      expect(cryptoService.initialize).toHaveBeenCalledWith('password123');
    });
  });

  describe('Vault Operations - Tauri Mode', () => {
    beforeEach(() => {
      (window as any).__TAURI__ = {};
      service = new PlatformService('browser', tauriService, apiService, cryptoService);
    });

    afterEach(() => {
      delete (window as any).__TAURI__;
    });

    it('should delegate vault status to Tauri', async () => {
      tauriService.getVaultStatus.and.returnValue(Promise.resolve(mockVaultStatus));

      const status = await service.getVaultStatus();

      expect(tauriService.getVaultStatus).toHaveBeenCalled();
      expect(status).toEqual(mockVaultStatus);
    });

    it('should delegate vault initialization to Tauri', async () => {
      tauriService.initializeVault.and.returnValue(Promise.resolve());

      await service.initializeVault('password123');

      expect(tauriService.initializeVault).toHaveBeenCalledWith('password123');
    });

    it('should delegate vault unlock to Tauri', async () => {
      tauriService.unlockVault.and.returnValue(Promise.resolve());

      await service.unlockVault('password123');

      expect(tauriService.unlockVault).toHaveBeenCalledWith('password123');
    });

    it('should delegate vault lock to Tauri', async () => {
      tauriService.lockVault.and.returnValue(Promise.resolve());

      await service.lockVault();

      expect(tauriService.lockVault).toHaveBeenCalled();
    });
  });

  // ========== Authentication ==========

  describe('Authentication - Web Mode', () => {
    it('should login via API service', async () => {
      apiService.login.and.returnValue(of({ user: mockUser, tokens: {} as any }));

      const user = await service.login('test@example.com', 'password');

      expect(apiService.login).toHaveBeenCalledWith('test@example.com', 'password');
      expect(user).toEqual(mockUser);
    });

    it('should signup via API service', async () => {
      apiService.register.and.returnValue(of({ user: mockUser, tokens: {} as any }));

      const user = await service.signup('test@example.com', 'password', 'Test User');

      expect(apiService.register).toHaveBeenCalledWith('test@example.com', 'password', 'Test User');
      expect(user).toEqual(mockUser);
    });

    it('should logout and lock vault', async () => {
      await service.logout();

      expect(apiService.logout).toHaveBeenCalled();
      expect(cryptoService.lock).toHaveBeenCalled();
    });

    it('should handle login errors', async () => {
      apiService.login.and.returnValue(throwError(() => new Error('Invalid credentials')));

      await expectAsync(service.login('test@example.com', 'wrong')).toBeRejectedWithError('Invalid credentials');
    });

    it('should handle signup errors', async () => {
      apiService.register.and.returnValue(throwError(() => new Error('Email exists')));

      await expectAsync(service.signup('test@example.com', 'password')).toBeRejectedWithError('Email exists');
    });
  });

  describe('Authentication - Tauri Mode', () => {
    beforeEach(() => {
      (window as any).__TAURI__ = {};
      service = new PlatformService('browser', tauriService, apiService, cryptoService);
    });

    afterEach(() => {
      delete (window as any).__TAURI__;
    });

    it('should login via Tauri service', async () => {
      tauriService.syncLogin.and.returnValue(Promise.resolve(mockUser));

      const user = await service.login('test@example.com', 'password');

      expect(tauriService.syncLogin).toHaveBeenCalledWith('test@example.com', 'password');
      expect(user).toEqual(mockUser);
    });

    it('should signup via Tauri service', async () => {
      tauriService.syncSignup.and.returnValue(Promise.resolve(mockUser));

      const user = await service.signup('test@example.com', 'password', 'Test User');

      expect(tauriService.syncSignup).toHaveBeenCalledWith('test@example.com', 'password', 'Test User');
      expect(user).toEqual(mockUser);
    });

    it('should logout via Tauri service', async () => {
      tauriService.syncLogout.and.returnValue(Promise.resolve());

      await service.logout();

      expect(tauriService.syncLogout).toHaveBeenCalled();
    });
  });

  // ========== Projects ==========

  describe('Projects - Web Mode', () => {
    it('should get all projects', async () => {
      apiService.getProjects.and.returnValue(of([mockProject]));

      const projects = await service.getProjects();

      expect(apiService.getProjects).toHaveBeenCalled();
      expect(projects).toEqual([mockProject]);
    });

    it('should get a single project', async () => {
      apiService.getProject.and.returnValue(of(mockProject));

      const project = await service.getProject('proj-1');

      expect(apiService.getProject).toHaveBeenCalledWith('proj-1');
      expect(project).toEqual(mockProject);
    });

    it('should create a project', async () => {
      apiService.createProject.and.returnValue(of(mockProject));

      const project = await service.createProject('New Project', 'Description');

      expect(apiService.createProject).toHaveBeenCalledWith('New Project', 'Description');
      expect(project).toEqual(mockProject);
    });

    it('should update a project', async () => {
      apiService.updateProject.and.returnValue(of(mockProject));

      const project = await service.updateProject('proj-1', 'Updated', 'New Desc');

      expect(apiService.updateProject).toHaveBeenCalledWith('proj-1', 'Updated', 'New Desc');
      expect(project).toEqual(mockProject);
    });

    it('should delete a project', async () => {
      apiService.deleteProject.and.returnValue(of(undefined));

      await service.deleteProject('proj-1');

      expect(apiService.deleteProject).toHaveBeenCalledWith('proj-1');
    });

    it('should handle project errors', async () => {
      apiService.getProjects.and.returnValue(throwError(() => new Error('Network error')));

      await expectAsync(service.getProjects()).toBeRejectedWithError('Network error');
    });
  });

  describe('Projects - Tauri Mode', () => {
    beforeEach(() => {
      (window as any).__TAURI__ = {};
      service = new PlatformService('browser', tauriService, apiService, cryptoService);
    });

    afterEach(() => {
      delete (window as any).__TAURI__;
    });

    it('should get projects via Tauri', async () => {
      tauriService.getProjects.and.returnValue(Promise.resolve([mockProject]));

      const projects = await service.getProjects();

      expect(tauriService.getProjects).toHaveBeenCalled();
      expect(projects).toEqual([mockProject]);
    });

    it('should create project via Tauri', async () => {
      tauriService.createProject.and.returnValue(Promise.resolve(mockProject));

      const project = await service.createProject('New Project', 'Description');

      expect(tauriService.createProject).toHaveBeenCalledWith('New Project', 'Description');
    });
  });

  // ========== Environments ==========

  describe('Environments - Web Mode', () => {
    it('should get environments', async () => {
      apiService.getEnvironments.and.returnValue(of([mockEnvironment]));

      const environments = await service.getEnvironments('proj-1');

      expect(apiService.getEnvironments).toHaveBeenCalledWith('proj-1');
      expect(environments).toEqual([mockEnvironment]);
    });

    it('should create environment', async () => {
      apiService.createEnvironment.and.returnValue(of(mockEnvironment));

      const environment = await service.createEnvironment('proj-1', 'Staging', 'Staging');

      expect(apiService.createEnvironment).toHaveBeenCalledWith('proj-1', 'Staging', 'Staging');
      expect(environment).toEqual(mockEnvironment);
    });

    it('should delete environment', async () => {
      apiService.deleteEnvironment.and.returnValue(of(undefined));

      await service.deleteEnvironment('proj-1', 'env-1');

      expect(apiService.deleteEnvironment).toHaveBeenCalledWith('proj-1', 'env-1');
    });
  });

  describe('Environments - Tauri Mode', () => {
    beforeEach(() => {
      (window as any).__TAURI__ = {};
      service = new PlatformService('browser', tauriService, apiService, cryptoService);
    });

    afterEach(() => {
      delete (window as any).__TAURI__;
    });

    it('should get environments via Tauri', async () => {
      tauriService.getEnvironments.and.returnValue(Promise.resolve([mockEnvironment]));

      const environments = await service.getEnvironments('proj-1');

      expect(tauriService.getEnvironments).toHaveBeenCalledWith('proj-1');
    });
  });

  // ========== Variables ==========

  describe('Variables - Web Mode', () => {
    beforeEach(() => {
      cryptoService.encrypt.and.returnValue(
        Promise.resolve({ ciphertext: 'encrypted', nonce: 'nonce123' })
      );
      cryptoService.decrypt.and.returnValue(Promise.resolve('decrypted-value'));
    });

    it('should get variables', async () => {
      apiService.getVariables.and.returnValue(of([mockVariable]));

      const variables = await service.getVariables('proj-1', 'env-1');

      expect(apiService.getVariables).toHaveBeenCalledWith('proj-1', 'env-1');
      expect(variables).toEqual([mockVariable]);
    });

    it('should create variable with encryption', async () => {
      apiService.createVariable.and.returnValue(of(mockVariable));

      const variable = await service.createVariable('proj-1', 'env-1', 'API_KEY', 'secret-value', true);

      expect(cryptoService.encrypt).toHaveBeenCalledWith('secret-value');
      expect(apiService.createVariable).toHaveBeenCalledWith('proj-1', 'env-1', 'API_KEY', 'encrypted', 'nonce123', true);
      expect(variable).toEqual(mockVariable);
    });

    it('should update variable with encryption', async () => {
      apiService.updateVariable.and.returnValue(of(mockVariable));

      const variable = await service.updateVariable('proj-1', 'env-1', 'var-1', 'KEY', 'new-value', false);

      expect(cryptoService.encrypt).toHaveBeenCalledWith('new-value');
      expect(apiService.updateVariable).toHaveBeenCalledWith('proj-1', 'env-1', 'var-1', 'KEY', 'encrypted', 'nonce123', false);
    });

    it('should delete variable', async () => {
      apiService.deleteVariable.and.returnValue(of(undefined));

      await service.deleteVariable('proj-1', 'env-1', 'var-1');

      expect(apiService.deleteVariable).toHaveBeenCalledWith('proj-1', 'env-1', 'var-1');
    });

    it('should decrypt variable', async () => {
      const decrypted = await service.decryptVariable('encrypted-value', 'nonce');

      expect(cryptoService.decrypt).toHaveBeenCalledWith('encrypted-value', 'nonce');
      expect(decrypted).toBe('decrypted-value');
    });
  });

  describe('Variables - Tauri Mode', () => {
    beforeEach(() => {
      (window as any).__TAURI__ = {};
      service = new PlatformService('browser', tauriService, apiService, cryptoService);
    });

    afterEach(() => {
      delete (window as any).__TAURI__;
    });

    it('should get variables via Tauri', async () => {
      tauriService.getVariables.and.returnValue(Promise.resolve([mockVariable]));

      const variables = await service.getVariables('proj-1', 'env-1');

      expect(tauriService.getVariables).toHaveBeenCalledWith('env-1');
    });

    it('should create variable via Tauri without encryption', async () => {
      tauriService.createVariable.and.returnValue(Promise.resolve(mockVariable));

      const variable = await service.createVariable('proj-1', 'env-1', 'API_KEY', 'value', true);

      expect(tauriService.createVariable).toHaveBeenCalledWith('env-1', 'API_KEY', 'value', true);
      expect(cryptoService.encrypt).not.toHaveBeenCalled();
    });

    it('should decrypt variable as passthrough in Tauri', async () => {
      const decrypted = await service.decryptVariable('encrypted-value', 'nonce');

      expect(decrypted).toBe('encrypted-value');
      expect(cryptoService.decrypt).not.toHaveBeenCalled();
    });
  });

  // ========== Search ==========

  describe('Search', () => {
    it('should search variables in web mode', async () => {
      const mockResults: SearchResult[] = [{
        project: mockProject,
        environment: mockEnvironment,
        variable: mockVariable,
      }];
      apiService.searchVariables.and.returnValue(of(mockResults));

      const results = await service.searchVariables('API_KEY');

      expect(apiService.searchVariables).toHaveBeenCalledWith('API_KEY');
      expect(results).toEqual(mockResults);
    });

    it('should search variables in Tauri mode', async () => {
      (window as any).__TAURI__ = {};
      service = new PlatformService('browser', tauriService, apiService, cryptoService);

      const mockResults: SearchResult[] = [];
      tauriService.searchVariables.and.returnValue(Promise.resolve(mockResults));

      const results = await service.searchVariables('API_KEY');

      expect(tauriService.searchVariables).toHaveBeenCalledWith('API_KEY');
      delete (window as any).__TAURI__;
    });
  });

  // ========== Sync ==========

  describe('Sync Operations', () => {
    it('should get sync status in web mode', async () => {
      const mockStatus: SyncStatus = {
        state: 'Idle',
        pending_changes: 0,
      };
      apiService.getSyncStatus.and.returnValue(of(mockStatus));

      const status = await service.getSyncStatus();

      expect(apiService.getSyncStatus).toHaveBeenCalled();
      expect(status).toEqual(mockStatus);
    });

    it('should sync now in web mode', async () => {
      const mockResult: SyncResult = {
        pushed: 1,
        pulled: 1,
        conflicts: 0,
        errors: [],
      };
      apiService.syncNow.and.returnValue(of(mockResult));

      const result = await service.syncNow();

      expect(apiService.syncNow).toHaveBeenCalled();
      expect(result).toEqual(mockResult);
    });

    it('should delegate sync to Tauri', async () => {
      (window as any).__TAURI__ = {};
      service = new PlatformService('browser', tauriService, apiService, cryptoService);

      const mockResult: SyncResult = { pushed: 0, pulled: 0, conflicts: 0, errors: [] };
      tauriService.syncNow.and.returnValue(Promise.resolve(mockResult));

      const result = await service.syncNow();

      expect(tauriService.syncNow).toHaveBeenCalled();
      delete (window as any).__TAURI__;
    });
  });

  // ========== Teams ==========

  describe('Teams - Web Mode', () => {
    it('should get all teams', async () => {
      apiService.getTeams.and.returnValue(of([mockTeam]));

      const teams = await service.getTeams();

      expect(apiService.getTeams).toHaveBeenCalled();
      expect(teams).toEqual([mockTeam]);
    });

    it('should get team with members', async () => {
      const mockTeamWithMembers: TeamWithMembers = {
        ...mockTeam,
        members: [],
        pending_invites: [],
      };
      apiService.getTeamWithMembers.and.returnValue(of(mockTeamWithMembers));

      const team = await service.getTeamWithMembers('team-1');

      expect(apiService.getTeamWithMembers).toHaveBeenCalledWith('team-1');
      expect(team).toEqual(mockTeamWithMembers);
    });

    it('should create team', async () => {
      apiService.createTeam.and.returnValue(of(mockTeam));

      const team = await service.createTeam('New Team', 'Description', 2, 3);

      expect(apiService.createTeam).toHaveBeenCalledWith('New Team', 'Description', 2, 3);
      expect(team).toEqual(mockTeam);
    });

    it('should invite team member', async () => {
      const mockInvite = {
        id: 'invite-1',
        team_id: 'team-1',
        email: 'new@example.com',
        role: 'Member' as TeamRole,
        status: 'Pending' as const,
        invited_by: 'user-1',
        token: 'token',
        expires_at: '2024-12-31',
        created_at: '2024-01-01',
      };
      apiService.inviteTeamMember.and.returnValue(of(mockInvite));

      const invite = await service.inviteTeamMember('team-1', 'new@example.com', 'Member');

      expect(apiService.inviteTeamMember).toHaveBeenCalledWith('team-1', 'new@example.com', 'Member');
      expect(invite).toEqual(mockInvite);
    });
  });

  describe('Teams - Tauri Mode', () => {
    beforeEach(() => {
      (window as any).__TAURI__ = {};
      service = new PlatformService('browser', tauriService, apiService, cryptoService);
    });

    afterEach(() => {
      delete (window as any).__TAURI__;
    });

    it('should get teams via Tauri', async () => {
      tauriService.getTeams.and.returnValue(Promise.resolve([mockTeam]));

      const teams = await service.getTeams();

      expect(tauriService.getTeams).toHaveBeenCalled();
    });

    it('should create team via Tauri', async () => {
      tauriService.createTeam.and.returnValue(Promise.resolve(mockTeam));

      const team = await service.createTeam('New Team', 'Description', 2, 3);

      expect(tauriService.createTeam).toHaveBeenCalledWith('New Team', 'Description', 2, 3);
    });
  });

  // ========== Audit Logs ==========

  describe('Audit Logs', () => {
    it('should get team audit log in web mode', async () => {
      const mockEvents: AuditEvent[] = [{
        id: 'audit-1',
        event_type: 'TeamCreated',
        actor_id: 'user-1',
        hash: 'hash',
        timestamp: '2024-01-01',
      }];
      apiService.getTeamAuditLog.and.returnValue(of({ entries: mockEvents, total: 1 }));

      const events = await service.getTeamAuditLog('team-1', 50);

      expect(apiService.getTeamAuditLog).toHaveBeenCalledWith('team-1');
      expect(events).toEqual(mockEvents);
    });

    it('should get team audit log in Tauri mode', async () => {
      (window as any).__TAURI__ = {};
      service = new PlatformService('browser', tauriService, apiService, cryptoService);

      const mockEvents: AuditEvent[] = [];
      tauriService.getTeamAuditLog.and.returnValue(Promise.resolve(mockEvents));

      const events = await service.getTeamAuditLog('team-1', 50);

      expect(tauriService.getTeamAuditLog).toHaveBeenCalledWith('team-1', 50);
      delete (window as any).__TAURI__;
    });
  });

  // ========== Error Handling ==========

  describe('Error Handling', () => {
    it('should propagate Observable errors as Promise rejections', async () => {
      apiService.getProjects.and.returnValue(throwError(() => new Error('Network error')));

      await expectAsync(service.getProjects()).toBeRejectedWithError('Network error');
    });

    it('should handle Tauri service errors', async () => {
      (window as any).__TAURI__ = {};
      service = new PlatformService('browser', tauriService, apiService, cryptoService);

      tauriService.getProjects.and.returnValue(Promise.reject(new Error('Tauri error')));

      await expectAsync(service.getProjects()).toBeRejectedWithError('Tauri error');
      delete (window as any).__TAURI__;
    });

    it('should handle encryption errors in web mode', async () => {
      cryptoService.encrypt.and.returnValue(Promise.reject(new Error('Encryption failed')));

      await expectAsync(
        service.createVariable('proj-1', 'env-1', 'KEY', 'value', true)
      ).toBeRejectedWithError('Encryption failed');
    });

    it('should handle decryption errors in web mode', async () => {
      cryptoService.decrypt.and.returnValue(Promise.reject(new Error('Decryption failed')));

      await expectAsync(
        service.decryptVariable('encrypted', 'nonce')
      ).toBeRejectedWithError('Decryption failed');
    });
  });

  // ========== Observable to Promise Conversion ==========

  describe('Observable to Promise Conversion', () => {
    it('should convert successful Observable to resolved Promise', async () => {
      apiService.getProjects.and.returnValue(of([mockProject]));

      const result = await service.getProjects();

      expect(result).toEqual([mockProject]);
    });

    it('should convert failed Observable to rejected Promise', async () => {
      const error = new Error('Test error');
      apiService.getProjects.and.returnValue(throwError(() => error));

      await expectAsync(service.getProjects()).toBeRejectedWith(error);
    });

    it('should handle void Observables', async () => {
      apiService.deleteProject.and.returnValue(of(undefined));

      await expectAsync(service.deleteProject('proj-1')).toBeResolved();
    });
  });
});
