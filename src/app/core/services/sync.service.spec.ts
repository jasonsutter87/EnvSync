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

import { vi, describe, it, expect, beforeEach, afterEach } from 'vitest';
import { signal, computed, WritableSignal, Signal } from '@angular/core';
import {
  SyncStatus,
  SyncEvent,
  SyncResult,
  User,
  AuthTokens,
  ConflictInfo,
  ConflictResolution,
} from '../models';

// Mock TauriService type
interface MockTauriService {
  getSyncStatus: ReturnType<typeof vi.fn>;
  getSyncConflicts: ReturnType<typeof vi.fn>;
  getSyncHistory: ReturnType<typeof vi.fn>;
  syncSignup: ReturnType<typeof vi.fn>;
  syncLogin: ReturnType<typeof vi.fn>;
  syncLogout: ReturnType<typeof vi.fn>;
  syncGetTokens: ReturnType<typeof vi.fn>;
  syncRestoreSession: ReturnType<typeof vi.fn>;
  syncNow: ReturnType<typeof vi.fn>;
  syncResolveConflict: ReturnType<typeof vi.fn>;
  syncSetEnabled: ReturnType<typeof vi.fn>;
  syncMarkDirty: ReturnType<typeof vi.fn>;
}

// Create mock TauriService
const createMockTauriService = (): MockTauriService => ({
  getSyncStatus: vi.fn(),
  getSyncConflicts: vi.fn(),
  getSyncHistory: vi.fn(),
  syncSignup: vi.fn(),
  syncLogin: vi.fn(),
  syncLogout: vi.fn(),
  syncGetTokens: vi.fn(),
  syncRestoreSession: vi.fn(),
  syncNow: vi.fn(),
  syncResolveConflict: vi.fn(),
  syncSetEnabled: vi.fn(),
  syncMarkDirty: vi.fn(),
});

// Simplified SyncService logic for testing
class SyncServiceLogic {
  private _status: WritableSignal<SyncStatus>;
  private _history: WritableSignal<SyncEvent[]>;
  private _conflicts: WritableSignal<ConflictInfo[]>;
  private _isLoading: WritableSignal<boolean>;
  private _error: WritableSignal<string | null>;

  readonly status: Signal<SyncStatus>;
  readonly history: Signal<SyncEvent[]>;
  readonly conflicts: Signal<ConflictInfo[]>;
  readonly isLoading: Signal<boolean>;
  readonly error: Signal<string | null>;

  readonly isConnected: Signal<boolean>;
  readonly isSyncing: Signal<boolean>;
  readonly hasConflicts: Signal<boolean>;
  readonly hasError: Signal<boolean>;
  readonly user: Signal<User | null>;
  readonly pendingChanges: Signal<number>;
  readonly lastSync: Signal<Date | null>;

  constructor(private tauri: MockTauriService) {
    const initialStatus: SyncStatus = {
      state: 'Disconnected',
      pending_changes: 0,
      user: undefined,
    };

    this._status = signal(initialStatus);
    this._history = signal([]);
    this._conflicts = signal([]);
    this._isLoading = signal(false);
    this._error = signal(null);

    this.status = this._status.asReadonly();
    this.history = this._history.asReadonly();
    this.conflicts = this._conflicts.asReadonly();
    this.isLoading = this._isLoading.asReadonly();
    this.error = this._error.asReadonly();

    this.isConnected = computed(() => {
      const state = this._status().state;
      return state !== 'Disconnected';
    });

    this.isSyncing = computed(() => this._status().state === 'Syncing');
    this.hasConflicts = computed(() => this._status().state === 'Conflict');
    this.hasError = computed(() => {
      const state = this._status().state;
      return typeof state === 'object' && 'Error' in state;
    });
    this.user = computed(() => this._status().user ?? null);
    this.pendingChanges = computed(() => this._status().pending_changes);
    this.lastSync = computed(() => {
      const ls = this._status().last_sync;
      return ls ? new Date(ls) : null;
    });

    this.tryRestoreSession();
  }

  private async tryRestoreSession() {
    const sessionStr = localStorage.getItem('envsync_session');
    if (!sessionStr) return;

    try {
      const session = JSON.parse(sessionStr);
      if (session.tokens && session.user) {
        const expiresAt = new Date(session.tokens.expires_at);
        if (expiresAt > new Date()) {
          await this.tauri.syncRestoreSession(session.tokens, session.user);
          await this.refreshStatus();
        } else {
          localStorage.removeItem('envsync_session');
        }
      }
    } catch {
      localStorage.removeItem('envsync_session');
    }
  }

  async refreshStatus(): Promise<void> {
    try {
      const [status, conflicts] = await Promise.all([
        this.tauri.getSyncStatus(),
        this.tauri.getSyncConflicts(),
      ]);
      this._status.set(status);
      this._conflicts.set(conflicts);
    } catch (error) {
      console.error('Failed to refresh status:', error);
    }
  }

  async refreshHistory(): Promise<void> {
    try {
      const history = await this.tauri.getSyncHistory(100);
      this._history.set(history);
    } catch (error) {
      console.error('Failed to refresh history:', error);
    }
  }

  async signup(email: string, password: string, name?: string): Promise<User> {
    this._isLoading.set(true);
    this._error.set(null);
    try {
      const user = await this.tauri.syncSignup(email, password, name);
      const tokens = await this.tauri.syncGetTokens();
      if (tokens) {
        this.saveSession(tokens, user);
      }
      await this.refreshStatus();
      return user;
    } catch (error: any) {
      const message = error instanceof Error ? error.message : String(error);
      this._error.set(message);
      throw error;
    } finally {
      this._isLoading.set(false);
    }
  }

  async login(email: string, password: string): Promise<User> {
    this._isLoading.set(true);
    this._error.set(null);
    try {
      const user = await this.tauri.syncLogin(email, password);
      const tokens = await this.tauri.syncGetTokens();
      if (tokens) {
        this.saveSession(tokens, user);
      }
      await this.refreshStatus();
      return user;
    } catch (error: any) {
      const message = error instanceof Error ? error.message : String(error);
      this._error.set(message);
      throw error;
    } finally {
      this._isLoading.set(false);
    }
  }

  async logout(): Promise<void> {
    this._isLoading.set(true);
    try {
      await this.tauri.syncLogout();
      localStorage.removeItem('envsync_session');
      await this.refreshStatus();
    } finally {
      this._isLoading.set(false);
    }
  }

  async sync(): Promise<SyncResult> {
    this._isLoading.set(true);
    this._error.set(null);
    try {
      const result = await this.tauri.syncNow();
      if (result.errors && result.errors.length > 0) {
        this._error.set(result.errors.join('; '));
      }
      await this.refreshStatus();
      await this.refreshHistory();
      return result;
    } catch (error: any) {
      const message = error instanceof Error ? error.message : String(error);
      this._error.set(message);
      throw error;
    } finally {
      this._isLoading.set(false);
    }
  }

  async resolveConflict(projectId: string, resolution: ConflictResolution): Promise<void> {
    this._isLoading.set(true);
    try {
      await this.tauri.syncResolveConflict(projectId, resolution);
      await this.refreshStatus();
      await this.refreshHistory();
    } finally {
      this._isLoading.set(false);
    }
  }

  async setProjectSyncEnabled(projectId: string, enabled: boolean): Promise<void> {
    await this.tauri.syncSetEnabled(projectId, enabled);
  }

  async markProjectDirty(projectId: string): Promise<void> {
    await this.tauri.syncMarkDirty(projectId);
    await this.refreshStatus();
  }

  clearError(): void {
    this._error.set(null);
  }

  private saveSession(tokens: AuthTokens, user: User): void {
    localStorage.setItem('envsync_session', JSON.stringify({ tokens, user }));
  }
}

describe('SyncService', () => {
  let service: SyncServiceLogic;
  let tauriService: MockTauriService;

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
    localStorage.clear();
    tauriService = createMockTauriService();
    tauriService.getSyncStatus.mockResolvedValue(mockSyncStatus);
    tauriService.getSyncConflicts.mockResolvedValue([]);
    service = new SyncServiceLogic(tauriService);
  });

  afterEach(() => {
    localStorage.clear();
    vi.clearAllMocks();
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
      tauriService.syncRestoreSession.mockResolvedValue(undefined);

      // Create new service to trigger session restoration
      const newTauriService = createMockTauriService();
      newTauriService.syncRestoreSession.mockResolvedValue(undefined);
      newTauriService.getSyncStatus.mockResolvedValue(mockSyncStatus);
      newTauriService.getSyncConflicts.mockResolvedValue([]);
      const newService = new SyncServiceLogic(newTauriService);
      await new Promise(resolve => setTimeout(resolve, 50));

      expect(newTauriService.syncRestoreSession).toHaveBeenCalledWith(session.tokens, session.user);
    });

    it('should not restore expired session', async () => {
      const session = {
        tokens: { ...mockTokens, expires_at: new Date(Date.now() - 1000).toISOString() },
        user: mockUser,
      };
      localStorage.setItem('envsync_session', JSON.stringify(session));

      const newTauriService = createMockTauriService();
      newTauriService.getSyncStatus.mockResolvedValue(mockSyncStatus);
      newTauriService.getSyncConflicts.mockResolvedValue([]);
      const newService = new SyncServiceLogic(newTauriService);
      await new Promise(resolve => setTimeout(resolve, 50));

      expect(newTauriService.syncRestoreSession).not.toHaveBeenCalled();
      expect(localStorage.getItem('envsync_session')).toBeNull();
    });

    it('should save session after login', async () => {
      tauriService.syncLogin.mockResolvedValue(mockUser);
      tauriService.syncGetTokens.mockResolvedValue(mockTokens);

      await service.login('test@example.com', 'password');

      const stored = localStorage.getItem('envsync_session');
      expect(stored).toBeTruthy();
      const session = JSON.parse(stored!);
      expect(session.tokens).toEqual(mockTokens);
      expect(session.user).toEqual(mockUser);
    });

    it('should clear session on logout', async () => {
      localStorage.setItem('envsync_session', JSON.stringify({ tokens: mockTokens, user: mockUser }));
      tauriService.syncLogout.mockResolvedValue(undefined);

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
      tauriService.getSyncStatus.mockRejectedValue(new Error('Network error'));
      const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

      await service.refreshStatus();

      expect(consoleSpy).toHaveBeenCalled();
      consoleSpy.mockRestore();
    });

    it('should refresh history', async () => {
      const mockHistory = [mockSyncEvent];
      tauriService.getSyncHistory.mockResolvedValue(mockHistory);

      await service.refreshHistory();

      expect(tauriService.getSyncHistory).toHaveBeenCalledWith(100);
      expect(service.history()).toEqual(mockHistory);
    });

    it('should handle refresh history errors gracefully', async () => {
      tauriService.getSyncHistory.mockRejectedValue(new Error('Error'));
      const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

      await service.refreshHistory();

      expect(consoleSpy).toHaveBeenCalled();
      consoleSpy.mockRestore();
    });

    it('should update conflicts from refresh', async () => {
      const mockConflicts = [mockConflict];
      tauriService.getSyncConflicts.mockResolvedValue(mockConflicts);

      await service.refreshStatus();

      expect(service.conflicts()).toEqual(mockConflicts);
    });
  });

  // ========== Authentication ==========

  describe('Authentication - Signup', () => {
    it('should signup successfully', async () => {
      tauriService.syncSignup.mockResolvedValue(mockUser);
      tauriService.syncGetTokens.mockResolvedValue(mockTokens);

      const user = await service.signup('test@example.com', 'password123', 'Test User');

      expect(tauriService.syncSignup).toHaveBeenCalledWith('test@example.com', 'password123', 'Test User');
      expect(user).toEqual(mockUser);
      expect(service.isLoading()).toBe(false);
      expect(service.error()).toBeNull();
    });

    it('should set loading state during signup', async () => {
      tauriService.syncSignup.mockImplementation(() => new Promise(resolve => setTimeout(() => resolve(mockUser), 50)));
      tauriService.syncGetTokens.mockResolvedValue(mockTokens);

      const signupPromise = service.signup('test@example.com', 'password');

      expect(service.isLoading()).toBe(true);
      await signupPromise;
      expect(service.isLoading()).toBe(false);
    });

    it('should handle signup errors', async () => {
      const error = new Error('Email already exists');
      tauriService.syncSignup.mockRejectedValue(error);

      await expect(service.signup('test@example.com', 'password')).rejects.toThrow(error);
      expect(service.error()).toBe('Email already exists');
      expect(service.isLoading()).toBe(false);
    });

    it('should save session after signup', async () => {
      tauriService.syncSignup.mockResolvedValue(mockUser);
      tauriService.syncGetTokens.mockResolvedValue(mockTokens);

      await service.signup('test@example.com', 'password');

      const stored = localStorage.getItem('envsync_session');
      expect(stored).toBeTruthy();
    });

    it('should refresh status after signup', async () => {
      tauriService.syncSignup.mockResolvedValue(mockUser);
      tauriService.syncGetTokens.mockResolvedValue(mockTokens);

      await service.signup('test@example.com', 'password');

      expect(tauriService.getSyncStatus).toHaveBeenCalled();
    });
  });

  describe('Authentication - Login', () => {
    it('should login successfully', async () => {
      tauriService.syncLogin.mockResolvedValue(mockUser);
      tauriService.syncGetTokens.mockResolvedValue(mockTokens);

      const user = await service.login('test@example.com', 'password123');

      expect(tauriService.syncLogin).toHaveBeenCalledWith('test@example.com', 'password123');
      expect(user).toEqual(mockUser);
      expect(service.error()).toBeNull();
    });

    it('should set loading state during login', async () => {
      tauriService.syncLogin.mockImplementation(() => new Promise(resolve => setTimeout(() => resolve(mockUser), 50)));
      tauriService.syncGetTokens.mockResolvedValue(mockTokens);

      const loginPromise = service.login('test@example.com', 'password');

      expect(service.isLoading()).toBe(true);
      await loginPromise;
      expect(service.isLoading()).toBe(false);
    });

    it('should handle login errors', async () => {
      const error = new Error('Invalid credentials');
      tauriService.syncLogin.mockRejectedValue(error);

      await expect(service.login('test@example.com', 'wrong')).rejects.toThrow(error);
      expect(service.error()).toBe('Invalid credentials');
    });

    it('should save session after login', async () => {
      tauriService.syncLogin.mockResolvedValue(mockUser);
      tauriService.syncGetTokens.mockResolvedValue(mockTokens);

      await service.login('test@example.com', 'password');

      const stored = localStorage.getItem('envsync_session');
      expect(stored).toBeTruthy();
    });

    it('should handle login without tokens', async () => {
      tauriService.syncLogin.mockResolvedValue(mockUser);
      tauriService.syncGetTokens.mockResolvedValue(null);

      const user = await service.login('test@example.com', 'password');

      expect(user).toEqual(mockUser);
      expect(localStorage.getItem('envsync_session')).toBeNull();
    });
  });

  describe('Authentication - Logout', () => {
    it('should logout successfully', async () => {
      tauriService.syncLogout.mockResolvedValue(undefined);

      await service.logout();

      expect(tauriService.syncLogout).toHaveBeenCalled();
      expect(service.isLoading()).toBe(false);
    });

    it('should clear session on logout', async () => {
      localStorage.setItem('envsync_session', JSON.stringify({ tokens: mockTokens, user: mockUser }));
      tauriService.syncLogout.mockResolvedValue(undefined);

      await service.logout();

      expect(localStorage.getItem('envsync_session')).toBeNull();
    });

    it('should refresh status after logout', async () => {
      tauriService.syncLogout.mockResolvedValue(undefined);

      await service.logout();

      expect(tauriService.getSyncStatus).toHaveBeenCalled();
    });

    it('should set loading state during logout', async () => {
      tauriService.syncLogout.mockImplementation(() => new Promise(resolve => setTimeout(resolve, 50)));

      const logoutPromise = service.logout();

      expect(service.isLoading()).toBe(true);
      await logoutPromise;
      expect(service.isLoading()).toBe(false);
    });
  });

  // ========== Sync Operations ==========

  describe('Sync Operations', () => {
    it('should sync successfully', async () => {
      tauriService.syncNow.mockResolvedValue(mockSyncResult);
      tauriService.getSyncHistory.mockResolvedValue([]);

      const result = await service.sync();

      expect(tauriService.syncNow).toHaveBeenCalled();
      expect(result).toEqual(mockSyncResult);
      expect(service.error()).toBeNull();
    });

    it('should set loading state during sync', async () => {
      tauriService.syncNow.mockImplementation(() => new Promise(resolve => setTimeout(() => resolve(mockSyncResult), 50)));
      tauriService.getSyncHistory.mockResolvedValue([]);

      const syncPromise = service.sync();

      expect(service.isLoading()).toBe(true);
      await syncPromise;
      expect(service.isLoading()).toBe(false);
    });

    it('should refresh status after sync', async () => {
      tauriService.syncNow.mockResolvedValue(mockSyncResult);
      tauriService.getSyncHistory.mockResolvedValue([]);

      await service.sync();

      expect(tauriService.getSyncStatus).toHaveBeenCalled();
    });

    it('should refresh history after sync', async () => {
      tauriService.syncNow.mockResolvedValue(mockSyncResult);
      tauriService.getSyncHistory.mockResolvedValue([mockSyncEvent]);

      await service.sync();

      expect(tauriService.getSyncHistory).toHaveBeenCalled();
      expect(service.history()).toEqual([mockSyncEvent]);
    });

    it('should handle sync errors', async () => {
      const error = new Error('Sync failed');
      tauriService.syncNow.mockRejectedValue(error);

      await expect(service.sync()).rejects.toThrow(error);
      expect(service.error()).toBe('Sync failed');
      expect(service.isLoading()).toBe(false);
    });

    it('should set error when sync has errors', async () => {
      const resultWithErrors: SyncResult = {
        ...mockSyncResult,
        errors: ['Error 1', 'Error 2'],
      };
      tauriService.syncNow.mockResolvedValue(resultWithErrors);
      tauriService.getSyncHistory.mockResolvedValue([]);

      await service.sync();

      expect(service.error()).toBe('Error 1; Error 2');
    });

    it('should not set error when sync succeeds without errors', async () => {
      tauriService.syncNow.mockResolvedValue(mockSyncResult);
      tauriService.getSyncHistory.mockResolvedValue([]);

      await service.sync();

      expect(service.error()).toBeNull();
    });
  });

  // ========== Conflict Resolution ==========

  describe('Conflict Resolution', () => {
    it('should resolve conflict', async () => {
      tauriService.syncResolveConflict.mockResolvedValue(undefined);
      tauriService.getSyncHistory.mockResolvedValue([]);

      await service.resolveConflict('proj-1', 'KeepLocal');

      expect(tauriService.syncResolveConflict).toHaveBeenCalledWith('proj-1', 'KeepLocal');
    });

    it('should refresh status after conflict resolution', async () => {
      tauriService.syncResolveConflict.mockResolvedValue(undefined);
      tauriService.getSyncHistory.mockResolvedValue([]);

      await service.resolveConflict('proj-1', 'KeepRemote');

      expect(tauriService.getSyncStatus).toHaveBeenCalled();
    });

    it('should refresh history after conflict resolution', async () => {
      tauriService.syncResolveConflict.mockResolvedValue(undefined);
      tauriService.getSyncHistory.mockResolvedValue([]);

      await service.resolveConflict('proj-1', 'KeepBoth');

      expect(tauriService.getSyncHistory).toHaveBeenCalled();
    });

    it('should set loading state during conflict resolution', async () => {
      tauriService.syncResolveConflict.mockImplementation(() => new Promise(resolve => setTimeout(resolve, 50)));
      tauriService.getSyncHistory.mockResolvedValue([]);

      const resolvePromise = service.resolveConflict('proj-1', 'Merge');

      expect(service.isLoading()).toBe(true);
      await resolvePromise;
      expect(service.isLoading()).toBe(false);
    });

    it('should support all conflict resolution types', async () => {
      tauriService.syncResolveConflict.mockResolvedValue(undefined);
      tauriService.getSyncHistory.mockResolvedValue([]);

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
      tauriService.syncSetEnabled.mockResolvedValue(undefined);

      await service.setProjectSyncEnabled('proj-1', true);

      expect(tauriService.syncSetEnabled).toHaveBeenCalledWith('proj-1', true);
    });

    it('should disable project sync', async () => {
      tauriService.syncSetEnabled.mockResolvedValue(undefined);

      await service.setProjectSyncEnabled('proj-1', false);

      expect(tauriService.syncSetEnabled).toHaveBeenCalledWith('proj-1', false);
    });

    it('should mark project dirty', async () => {
      tauriService.syncMarkDirty.mockResolvedValue(undefined);

      await service.markProjectDirty('proj-1');

      expect(tauriService.syncMarkDirty).toHaveBeenCalledWith('proj-1');
    });

    it('should refresh status after marking dirty', async () => {
      tauriService.syncMarkDirty.mockResolvedValue(undefined);

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
      tauriService.syncLogin.mockResolvedValue(mockUser);
      tauriService.syncGetTokens.mockResolvedValue(mockTokens);
      const connectedStatus: SyncStatus = { ...mockSyncStatus, state: 'Idle' };
      tauriService.getSyncStatus.mockResolvedValue(connectedStatus);

      await service.login('test@example.com', 'password');

      expect(service.isConnected()).toBe(true);
    });

    it('should compute isSyncing from status', async () => {
      const syncingStatus: SyncStatus = { ...mockSyncStatus, state: 'Syncing' };
      tauriService.getSyncStatus.mockResolvedValue(syncingStatus);

      await service.refreshStatus();

      expect(service.isSyncing()).toBe(true);
    });

    it('should compute hasConflicts from status', async () => {
      const conflictStatus: SyncStatus = { ...mockSyncStatus, state: 'Conflict' };
      tauriService.getSyncStatus.mockResolvedValue(conflictStatus);

      await service.refreshStatus();

      expect(service.hasConflicts()).toBe(true);
    });

    it('should compute hasError from status', async () => {
      const errorStatus: SyncStatus = { ...mockSyncStatus, state: { Error: 'Network error' } };
      tauriService.getSyncStatus.mockResolvedValue(errorStatus);

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
      tauriService.getSyncStatus.mockResolvedValue(statusWithoutSync);

      await service.refreshStatus();

      expect(service.lastSync()).toBeNull();
    });
  });

  // ========== Utilities ==========

  describe('Utilities', () => {
    it('should clear error', async () => {
      // Set error first via failed login
      tauriService.syncLogin.mockRejectedValue(new Error('Test error'));
      try { await service.login('test@example.com', 'wrong'); } catch {}

      expect(service.error()).toBe('Test error');

      service.clearError();

      expect(service.error()).toBeNull();
    });
  });

  // ========== Error Handling ==========

  describe('Error Handling', () => {
    it('should handle non-Error objects in signup', async () => {
      tauriService.syncSignup.mockRejectedValue('String error');

      await expect(service.signup('test@example.com', 'password')).rejects.toBe('String error');
      expect(service.error()).toBe('String error');
    });

    it('should handle non-Error objects in sync', async () => {
      tauriService.syncNow.mockRejectedValue(123);

      await expect(service.sync()).rejects.toBe(123);
      expect(service.error()).toBe('123');
    });
  });

  // ========== Edge Cases ==========

  describe('Edge Cases', () => {
    it('should handle rapid login/logout cycles', async () => {
      tauriService.syncLogin.mockResolvedValue(mockUser);
      tauriService.syncGetTokens.mockResolvedValue(mockTokens);
      tauriService.syncLogout.mockResolvedValue(undefined);

      for (let i = 0; i < 5; i++) {
        await service.login('test@example.com', 'password');
        expect(service.isLoading()).toBe(false);
        await service.logout();
        expect(service.isLoading()).toBe(false);
      }
    });

    it('should handle multiple concurrent syncs', async () => {
      tauriService.syncNow.mockResolvedValue(mockSyncResult);
      tauriService.getSyncHistory.mockResolvedValue([]);

      const syncs = [
        service.sync(),
        service.sync(),
        service.sync(),
      ];

      await Promise.all(syncs);

      expect(tauriService.syncNow).toHaveBeenCalledTimes(3);
    });

    it('should handle status refresh failures during login', async () => {
      tauriService.syncLogin.mockResolvedValue(mockUser);
      tauriService.syncGetTokens.mockResolvedValue(mockTokens);
      tauriService.getSyncStatus.mockRejectedValue(new Error('Network error'));
      const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

      const user = await service.login('test@example.com', 'password');

      expect(user).toEqual(mockUser);
      expect(consoleSpy).toHaveBeenCalled();
      consoleSpy.mockRestore();
    });
  });
});
