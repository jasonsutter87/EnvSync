/**
 * SyncService Unit Tests
 *
 * Comprehensive test suite for the EnvSync Sync service covering:
 * - Service instantiation
 * - Signal-based state management
 * - Session management and restoration
 * - Authentication flows (signup, login, logout)
 * - Sync operations
 * - Conflict resolution
 * - Project sync settings
 * - Error handling
 * - LocalStorage integration
 * - Computed signals
 */

import { TestBed } from '@angular/core/testing';
import { SyncService } from './sync.service';
import { TauriService } from './tauri.service';
import {
  SyncStatus,
  SyncEvent,
  SyncResult,
  User,
  AuthTokens,
  ConflictInfo,
  ConflictResolution,
} from '../models';

describe('SyncService', () => {
  let service: SyncService;
  let tauriService: jasmine.SpyObj<TauriService>;

  // Mock data
  const mockUser: User = {
    id: 'user-1',
    email: 'test@example.com',
    name: 'Test User',
    created_at: '2024-01-01T00:00:00Z',
  };

  const mockTokens: AuthTokens = {
    access_token: 'access-token-123',
    refresh_token: 'refresh-token-456',
    expires_at: '2024-12-31T23:59:59Z',
  };

  const mockSyncStatus: SyncStatus = {
    state: 'Idle',
    last_sync: '2024-01-01T00:00:00Z',
    pending_changes: 5,
    user: mockUser,
  };

  const mockSyncResult: SyncResult = {
    pushed: 3,
    pulled: 2,
    conflicts: 0,
    errors: [],
  };

  const mockSyncEvent: SyncEvent = {
    id: 'event-1',
    event_type: 'Push',
    project_id: 'proj-1',
    timestamp: '2024-01-01T00:00:00Z',
  };

  const mockConflict: ConflictInfo = {
    project_id: 'proj-1',
    environment_id: 'env-1',
    variable_key: 'API_KEY',
    local_value: 'local-value',
    remote_value: 'remote-value',
    local_modified: '2024-01-01T00:00:00Z',
    remote_modified: '2024-01-02T00:00:00Z',
  };

  beforeEach(() => {
    const tauriSpy = jasmine.createSpyObj('TauriService', [
      'getSyncStatus',
      'getSyncConflicts',
      'getSyncHistory',
      'syncSignup',
      'syncLogin',
      'syncLogout',
      'syncGetTokens',
      'syncRestoreSession',
      'syncNow',
      'syncResolveConflict',
      'syncSetEnabled',
      'syncMarkDirty',
    ]);

    TestBed.configureTestingModule({
      providers: [
        SyncService,
        { provide: TauriService, useValue: tauriSpy },
      ],
    });

    tauriService = TestBed.inject(TauriService) as jasmine.SpyObj<TauriService>;
    localStorage.clear();

    // Mock default responses
    tauriService.getSyncStatus.and.returnValue(Promise.resolve(mockSyncStatus));
    tauriService.getSyncConflicts.and.returnValue(Promise.resolve([]));

    service = TestBed.inject(SyncService);
  });

  afterEach(() => {
    localStorage.clear();
  });

  // ========== Service Instantiation ==========

  describe('Service Instantiation', () => {
    it('should be created', () => {
      expect(service).toBeTruthy();
    });

    it('should initialize with default state', () => {
      expect(service.status().state).toBe('Disconnected');
      expect(service.status().pending_changes).toBe(0);
      expect(service.history()).toEqual([]);
      expect(service.conflicts()).toEqual([]);
      expect(service.isLoading()).toBe(false);
      expect(service.error()).toBeNull();
    });

    it('should have readonly signals', () => {
      expect(service.status).toBeDefined();
      expect(service.history).toBeDefined();
      expect(service.conflicts).toBeDefined();
      expect(service.isLoading).toBeDefined();
      expect(service.error).toBeDefined();
    });

    it('should have computed signals', () => {
      expect(service.isConnected).toBeDefined();
      expect(service.isSyncing).toBeDefined();
      expect(service.hasConflicts).toBeDefined();
      expect(service.hasError).toBeDefined();
      expect(service.user).toBeDefined();
      expect(service.pendingChanges).toBeDefined();
      expect(service.lastSync).toBeDefined();
    });
  });

  // ========== Session Management ==========

  describe('Session Management', () => {
    it('should not restore session when localStorage is empty', () => {
      expect(tauriService.syncRestoreSession).not.toHaveBeenCalled();
    });

    it('should restore valid session from localStorage', async () => {
      const session = {
        tokens: { ...mockTokens, expires_at: new Date(Date.now() + 86400000).toISOString() },
        user: mockUser,
      };
      localStorage.setItem('envsync_session', JSON.stringify(session));
      tauriService.syncRestoreSession.and.returnValue(Promise.resolve());
      tauriService.getSyncStatus.and.returnValue(Promise.resolve(mockSyncStatus));
      tauriService.getSyncConflicts.and.returnValue(Promise.resolve([]));

      // Create new service to trigger session restoration
      const newService = new SyncService(tauriService);
      await new Promise(resolve => setTimeout(resolve, 10)); // Wait for async restoration

      expect(tauriService.syncRestoreSession).toHaveBeenCalledWith(session.tokens, session.user);
    });

    it('should not restore expired session', async () => {
      const session = {
        tokens: { ...mockTokens, expires_at: new Date(Date.now() - 1000).toISOString() },
        user: mockUser,
      };
      localStorage.setItem('envsync_session', JSON.stringify(session));

      // Create new service
      const newService = new SyncService(tauriService);
      await new Promise(resolve => setTimeout(resolve, 10));

      expect(tauriService.syncRestoreSession).not.toHaveBeenCalled();
      expect(localStorage.getItem('envsync_session')).toBeNull();
    });

    it('should clear session on restore error', async () => {
      const session = {
        tokens: { ...mockTokens, expires_at: new Date(Date.now() + 86400000).toISOString() },
        user: mockUser,
      };
      localStorage.setItem('envsync_session', JSON.stringify(session));
      tauriService.syncRestoreSession.and.returnValue(Promise.reject(new Error('Invalid session')));

      // Create new service
      const newService = new SyncService(tauriService);
      await new Promise(resolve => setTimeout(resolve, 10));

      expect(localStorage.getItem('envsync_session')).toBeNull();
    });

    it('should save session after login', async () => {
      tauriService.syncLogin.and.returnValue(Promise.resolve(mockUser));
      tauriService.syncGetTokens.and.returnValue(Promise.resolve(mockTokens));

      await service.login('test@example.com', 'password');

      const stored = localStorage.getItem('envsync_session');
      expect(stored).toBeTruthy();
      const session = JSON.parse(stored!);
      expect(session.tokens).toEqual(mockTokens);
      expect(session.user).toEqual(mockUser);
    });

    it('should clear session on logout', async () => {
      localStorage.setItem('envsync_session', JSON.stringify({ tokens: mockTokens, user: mockUser }));
      tauriService.syncLogout.and.returnValue(Promise.resolve());

      await service.logout();

      expect(localStorage.getItem('envsync_session')).toBeNull();
    });
  });

  // ========== Status & Refresh ==========

  describe('Status & Refresh', () => {
    it('should refresh status', async () => {
      await service.refreshStatus();

      expect(tauriService.getSyncStatus).toHaveBeenCalled();
      expect(tauriService.getSyncConflicts).toHaveBeenCalled();
      expect(service.status()).toEqual(mockSyncStatus);
    });

    it('should handle refresh status errors gracefully', async () => {
      tauriService.getSyncStatus.and.returnValue(Promise.reject(new Error('Network error')));
      const consoleSpy = spyOn(console, 'error');

      await service.refreshStatus();

      expect(consoleSpy).toHaveBeenCalled();
    });

    it('should refresh history', async () => {
      const mockHistory = [mockSyncEvent];
      tauriService.getSyncHistory.and.returnValue(Promise.resolve(mockHistory));

      await service.refreshHistory();

      expect(tauriService.getSyncHistory).toHaveBeenCalledWith(100);
      expect(service.history()).toEqual(mockHistory);
    });

    it('should handle refresh history errors gracefully', async () => {
      tauriService.getSyncHistory.and.returnValue(Promise.reject(new Error('Error')));
      const consoleSpy = spyOn(console, 'error');

      await service.refreshHistory();

      expect(consoleSpy).toHaveBeenCalled();
    });

    it('should update conflicts from refresh', async () => {
      const mockConflicts = [mockConflict];
      tauriService.getSyncConflicts.and.returnValue(Promise.resolve(mockConflicts));

      await service.refreshStatus();

      expect(service.conflicts()).toEqual(mockConflicts);
    });
  });

  // ========== Authentication ==========

  describe('Authentication - Signup', () => {
    it('should signup successfully', async () => {
      tauriService.syncSignup.and.returnValue(Promise.resolve(mockUser));
      tauriService.syncGetTokens.and.returnValue(Promise.resolve(mockTokens));

      const user = await service.signup('test@example.com', 'password123', 'Test User');

      expect(tauriService.syncSignup).toHaveBeenCalledWith('test@example.com', 'password123', 'Test User');
      expect(user).toEqual(mockUser);
      expect(service.isLoading()).toBe(false);
      expect(service.error()).toBeNull();
    });

    it('should set loading state during signup', async () => {
      tauriService.syncSignup.and.returnValue(new Promise(resolve => setTimeout(() => resolve(mockUser), 100)));
      tauriService.syncGetTokens.and.returnValue(Promise.resolve(mockTokens));

      const signupPromise = service.signup('test@example.com', 'password');

      expect(service.isLoading()).toBe(true);
      await signupPromise;
      expect(service.isLoading()).toBe(false);
    });

    it('should handle signup errors', async () => {
      const error = new Error('Email already exists');
      tauriService.syncSignup.and.returnValue(Promise.reject(error));

      await expectAsync(service.signup('test@example.com', 'password')).toBeRejectedWith(error);
      expect(service.error()).toBe('Email already exists');
      expect(service.isLoading()).toBe(false);
    });

    it('should save session after signup', async () => {
      tauriService.syncSignup.and.returnValue(Promise.resolve(mockUser));
      tauriService.syncGetTokens.and.returnValue(Promise.resolve(mockTokens));

      await service.signup('test@example.com', 'password');

      const stored = localStorage.getItem('envsync_session');
      expect(stored).toBeTruthy();
    });

    it('should refresh status after signup', async () => {
      tauriService.syncSignup.and.returnValue(Promise.resolve(mockUser));
      tauriService.syncGetTokens.and.returnValue(Promise.resolve(mockTokens));

      await service.signup('test@example.com', 'password');

      expect(tauriService.getSyncStatus).toHaveBeenCalled();
    });
  });

  describe('Authentication - Login', () => {
    it('should login successfully', async () => {
      tauriService.syncLogin.and.returnValue(Promise.resolve(mockUser));
      tauriService.syncGetTokens.and.returnValue(Promise.resolve(mockTokens));

      const user = await service.login('test@example.com', 'password123');

      expect(tauriService.syncLogin).toHaveBeenCalledWith('test@example.com', 'password123');
      expect(user).toEqual(mockUser);
      expect(service.error()).toBeNull();
    });

    it('should set loading state during login', async () => {
      tauriService.syncLogin.and.returnValue(new Promise(resolve => setTimeout(() => resolve(mockUser), 100)));
      tauriService.syncGetTokens.and.returnValue(Promise.resolve(mockTokens));

      const loginPromise = service.login('test@example.com', 'password');

      expect(service.isLoading()).toBe(true);
      await loginPromise;
      expect(service.isLoading()).toBe(false);
    });

    it('should handle login errors', async () => {
      const error = new Error('Invalid credentials');
      tauriService.syncLogin.and.returnValue(Promise.reject(error));

      await expectAsync(service.login('test@example.com', 'wrong')).toBeRejectedWith(error);
      expect(service.error()).toBe('Invalid credentials');
    });

    it('should save session after login', async () => {
      tauriService.syncLogin.and.returnValue(Promise.resolve(mockUser));
      tauriService.syncGetTokens.and.returnValue(Promise.resolve(mockTokens));

      await service.login('test@example.com', 'password');

      const stored = localStorage.getItem('envsync_session');
      expect(stored).toBeTruthy();
    });

    it('should handle login without tokens', async () => {
      tauriService.syncLogin.and.returnValue(Promise.resolve(mockUser));
      tauriService.syncGetTokens.and.returnValue(Promise.resolve(null));

      const user = await service.login('test@example.com', 'password');

      expect(user).toEqual(mockUser);
      expect(localStorage.getItem('envsync_session')).toBeNull();
    });
  });

  describe('Authentication - Logout', () => {
    it('should logout successfully', async () => {
      tauriService.syncLogout.and.returnValue(Promise.resolve());

      await service.logout();

      expect(tauriService.syncLogout).toHaveBeenCalled();
      expect(service.isLoading()).toBe(false);
    });

    it('should clear session on logout', async () => {
      localStorage.setItem('envsync_session', JSON.stringify({ tokens: mockTokens, user: mockUser }));
      tauriService.syncLogout.and.returnValue(Promise.resolve());

      await service.logout();

      expect(localStorage.getItem('envsync_session')).toBeNull();
    });

    it('should refresh status after logout', async () => {
      tauriService.syncLogout.and.returnValue(Promise.resolve());

      await service.logout();

      expect(tauriService.getSyncStatus).toHaveBeenCalled();
    });

    it('should set loading state during logout', async () => {
      tauriService.syncLogout.and.returnValue(new Promise(resolve => setTimeout(() => resolve(), 100)));

      const logoutPromise = service.logout();

      expect(service.isLoading()).toBe(true);
      await logoutPromise;
      expect(service.isLoading()).toBe(false);
    });
  });

  // ========== Sync Operations ==========

  describe('Sync Operations', () => {
    it('should sync successfully', async () => {
      tauriService.syncNow.and.returnValue(Promise.resolve(mockSyncResult));
      tauriService.getSyncHistory.and.returnValue(Promise.resolve([]));

      const result = await service.sync();

      expect(tauriService.syncNow).toHaveBeenCalled();
      expect(result).toEqual(mockSyncResult);
      expect(service.error()).toBeNull();
    });

    it('should set loading state during sync', async () => {
      tauriService.syncNow.and.returnValue(new Promise(resolve => setTimeout(() => resolve(mockSyncResult), 100)));
      tauriService.getSyncHistory.and.returnValue(Promise.resolve([]));

      const syncPromise = service.sync();

      expect(service.isLoading()).toBe(true);
      await syncPromise;
      expect(service.isLoading()).toBe(false);
    });

    it('should refresh status after sync', async () => {
      tauriService.syncNow.and.returnValue(Promise.resolve(mockSyncResult));
      tauriService.getSyncHistory.and.returnValue(Promise.resolve([]));

      await service.sync();

      expect(tauriService.getSyncStatus).toHaveBeenCalled();
    });

    it('should refresh history after sync', async () => {
      tauriService.syncNow.and.returnValue(Promise.resolve(mockSyncResult));
      tauriService.getSyncHistory.and.returnValue(Promise.resolve([mockSyncEvent]));

      await service.sync();

      expect(tauriService.getSyncHistory).toHaveBeenCalled();
      expect(service.history()).toEqual([mockSyncEvent]);
    });

    it('should handle sync errors', async () => {
      const error = new Error('Sync failed');
      tauriService.syncNow.and.returnValue(Promise.reject(error));

      await expectAsync(service.sync()).toBeRejectedWith(error);
      expect(service.error()).toBe('Sync failed');
      expect(service.isLoading()).toBe(false);
    });

    it('should set error when sync has errors', async () => {
      const resultWithErrors: SyncResult = {
        ...mockSyncResult,
        errors: ['Error 1', 'Error 2'],
      };
      tauriService.syncNow.and.returnValue(Promise.resolve(resultWithErrors));
      tauriService.getSyncHistory.and.returnValue(Promise.resolve([]));

      await service.sync();

      expect(service.error()).toBe('Error 1; Error 2');
    });

    it('should not set error when sync succeeds without errors', async () => {
      tauriService.syncNow.and.returnValue(Promise.resolve(mockSyncResult));
      tauriService.getSyncHistory.and.returnValue(Promise.resolve([]));

      await service.sync();

      expect(service.error()).toBeNull();
    });
  });

  // ========== Conflict Resolution ==========

  describe('Conflict Resolution', () => {
    it('should resolve conflict', async () => {
      tauriService.syncResolveConflict.and.returnValue(Promise.resolve());
      tauriService.getSyncHistory.and.returnValue(Promise.resolve([]));

      await service.resolveConflict('proj-1', 'KeepLocal');

      expect(tauriService.syncResolveConflict).toHaveBeenCalledWith('proj-1', 'KeepLocal');
    });

    it('should refresh status after conflict resolution', async () => {
      tauriService.syncResolveConflict.and.returnValue(Promise.resolve());
      tauriService.getSyncHistory.and.returnValue(Promise.resolve([]));

      await service.resolveConflict('proj-1', 'KeepRemote');

      expect(tauriService.getSyncStatus).toHaveBeenCalled();
    });

    it('should refresh history after conflict resolution', async () => {
      tauriService.syncResolveConflict.and.returnValue(Promise.resolve());
      tauriService.getSyncHistory.and.returnValue(Promise.resolve([]));

      await service.resolveConflict('proj-1', 'KeepBoth');

      expect(tauriService.getSyncHistory).toHaveBeenCalled();
    });

    it('should set loading state during conflict resolution', async () => {
      tauriService.syncResolveConflict.and.returnValue(new Promise(resolve => setTimeout(() => resolve(), 100)));
      tauriService.getSyncHistory.and.returnValue(Promise.resolve([]));

      const resolvePromise = service.resolveConflict('proj-1', 'Merge');

      expect(service.isLoading()).toBe(true);
      await resolvePromise;
      expect(service.isLoading()).toBe(false);
    });

    it('should support all conflict resolution types', async () => {
      tauriService.syncResolveConflict.and.returnValue(Promise.resolve());
      tauriService.getSyncHistory.and.returnValue(Promise.resolve([]));

      const resolutions: ConflictResolution[] = ['KeepLocal', 'KeepRemote', 'KeepBoth', 'Merge'];

      for (const resolution of resolutions) {
        await service.resolveConflict('proj-1', resolution);
        expect(tauriService.syncResolveConflict).toHaveBeenCalledWith('proj-1', resolution);
      }
    });
  });

  // ========== Project Sync Settings ==========

  describe('Project Sync Settings', () => {
    it('should set project sync enabled', async () => {
      tauriService.syncSetEnabled.and.returnValue(Promise.resolve());

      await service.setProjectSyncEnabled('proj-1', true);

      expect(tauriService.syncSetEnabled).toHaveBeenCalledWith('proj-1', true);
    });

    it('should disable project sync', async () => {
      tauriService.syncSetEnabled.and.returnValue(Promise.resolve());

      await service.setProjectSyncEnabled('proj-1', false);

      expect(tauriService.syncSetEnabled).toHaveBeenCalledWith('proj-1', false);
    });

    it('should mark project dirty', async () => {
      tauriService.syncMarkDirty.and.returnValue(Promise.resolve());

      await service.markProjectDirty('proj-1');

      expect(tauriService.syncMarkDirty).toHaveBeenCalledWith('proj-1');
    });

    it('should refresh status after marking dirty', async () => {
      tauriService.syncMarkDirty.and.returnValue(Promise.resolve());

      await service.markProjectDirty('proj-1');

      expect(tauriService.getSyncStatus).toHaveBeenCalled();
    });
  });

  // ========== Computed Signals ==========

  describe('Computed Signals', () => {
    it('should compute isConnected from status', async () => {
      // Start disconnected
      expect(service.isConnected()).toBe(false);

      // Login to connect
      tauriService.syncLogin.and.returnValue(Promise.resolve(mockUser));
      tauriService.syncGetTokens.and.returnValue(Promise.resolve(mockTokens));
      const connectedStatus: SyncStatus = { ...mockSyncStatus, state: 'Idle' };
      tauriService.getSyncStatus.and.returnValue(Promise.resolve(connectedStatus));

      await service.login('test@example.com', 'password');

      expect(service.isConnected()).toBe(true);
    });

    it('should compute isSyncing from status', async () => {
      const syncingStatus: SyncStatus = { ...mockSyncStatus, state: 'Syncing' };
      tauriService.getSyncStatus.and.returnValue(Promise.resolve(syncingStatus));

      await service.refreshStatus();

      expect(service.isSyncing()).toBe(true);
    });

    it('should compute hasConflicts from status', async () => {
      const conflictStatus: SyncStatus = { ...mockSyncStatus, state: 'Conflict' };
      tauriService.getSyncStatus.and.returnValue(Promise.resolve(conflictStatus));

      await service.refreshStatus();

      expect(service.hasConflicts()).toBe(true);
    });

    it('should compute hasError from status', async () => {
      const errorStatus: SyncStatus = { ...mockSyncStatus, state: { Error: 'Network error' } };
      tauriService.getSyncStatus.and.returnValue(Promise.resolve(errorStatus));

      await service.refreshStatus();

      expect(service.hasError()).toBe(true);
    });

    it('should compute user from status', async () => {
      await service.refreshStatus();

      expect(service.user()).toEqual(mockUser);
    });

    it('should compute pendingChanges from status', async () => {
      await service.refreshStatus();

      expect(service.pendingChanges()).toBe(5);
    });

    it('should compute lastSync from status', async () => {
      await service.refreshStatus();

      expect(service.lastSync()).toEqual(new Date(mockSyncStatus.last_sync!));
    });

    it('should return null for lastSync when not available', async () => {
      const statusWithoutSync: SyncStatus = { ...mockSyncStatus, last_sync: undefined };
      tauriService.getSyncStatus.and.returnValue(Promise.resolve(statusWithoutSync));

      await service.refreshStatus();

      expect(service.lastSync()).toBeNull();
    });
  });

  // ========== Utilities ==========

  describe('Utilities', () => {
    it('should clear error', () => {
      // Set error first
      service['_error'].set('Test error');
      expect(service.error()).toBe('Test error');

      service.clearError();

      expect(service.error()).toBeNull();
    });

    it('should clear error after setting it', async () => {
      tauriService.syncLogin.and.returnValue(Promise.reject(new Error('Login failed')));

      await expectAsync(service.login('test@example.com', 'wrong')).toBeRejected();
      expect(service.error()).toBe('Login failed');

      service.clearError();
      expect(service.error()).toBeNull();
    });
  });

  // ========== Error Handling ==========

  describe('Error Handling', () => {
    it('should handle non-Error objects in signup', async () => {
      tauriService.syncSignup.and.returnValue(Promise.reject('String error'));

      await expectAsync(service.signup('test@example.com', 'password')).toBeRejected();
      expect(service.error()).toBe('String error');
    });

    it('should handle non-Error objects in login', async () => {
      tauriService.syncLogin.and.returnValue(Promise.reject({ message: 'Object error' }));

      await expectAsync(service.login('test@example.com', 'password')).toBeRejected();
      expect(service.error()).toBe('[object Object]');
    });

    it('should handle non-Error objects in sync', async () => {
      tauriService.syncNow.and.returnValue(Promise.reject(123));

      await expectAsync(service.sync()).toBeRejected();
      expect(service.error()).toBe('123');
    });
  });

  // ========== Edge Cases ==========

  describe('Edge Cases', () => {
    it('should handle rapid login/logout cycles', async () => {
      tauriService.syncLogin.and.returnValue(Promise.resolve(mockUser));
      tauriService.syncGetTokens.and.returnValue(Promise.resolve(mockTokens));
      tauriService.syncLogout.and.returnValue(Promise.resolve());

      for (let i = 0; i < 5; i++) {
        await service.login('test@example.com', 'password');
        expect(service.isLoading()).toBe(false);
        await service.logout();
        expect(service.isLoading()).toBe(false);
      }
    });

    it('should handle multiple concurrent syncs', async () => {
      tauriService.syncNow.and.returnValue(Promise.resolve(mockSyncResult));
      tauriService.getSyncHistory.and.returnValue(Promise.resolve([]));

      const syncs = [
        service.sync(),
        service.sync(),
        service.sync(),
      ];

      await Promise.all(syncs);

      expect(tauriService.syncNow).toHaveBeenCalledTimes(3);
    });

    it('should handle status refresh failures during login', async () => {
      tauriService.syncLogin.and.returnValue(Promise.resolve(mockUser));
      tauriService.syncGetTokens.and.returnValue(Promise.resolve(mockTokens));
      tauriService.getSyncStatus.and.returnValue(Promise.reject(new Error('Network error')));
      const consoleSpy = spyOn(console, 'error');

      const user = await service.login('test@example.com', 'password');

      expect(user).toEqual(mockUser);
      expect(consoleSpy).toHaveBeenCalled();
    });
  });
});
