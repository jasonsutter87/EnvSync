import { Injectable, signal, computed } from '@angular/core';
import { TauriService } from './tauri.service';
import {
  SyncStatus,
  SyncEvent,
  SyncResult,
  User,
  AuthTokens,
  ConflictInfo,
  ConflictResolution,
  isSyncError,
} from '../models';

const SESSION_STORAGE_KEY = 'envsync_session';

interface StoredSession {
  tokens: AuthTokens;
  user: User;
}

@Injectable({
  providedIn: 'root',
})
export class SyncService {
  // Reactive state
  private _status = signal<SyncStatus>({
    state: 'Disconnected',
    pending_changes: 0,
  });
  private _history = signal<SyncEvent[]>([]);
  private _conflicts = signal<ConflictInfo[]>([]);
  private _isLoading = signal(false);
  private _error = signal<string | null>(null);

  // Public computed signals
  readonly status = this._status.asReadonly();
  readonly history = this._history.asReadonly();
  readonly conflicts = this._conflicts.asReadonly();
  readonly isLoading = this._isLoading.asReadonly();
  readonly error = this._error.asReadonly();

  readonly isConnected = computed(() => this._status().state !== 'Disconnected');
  readonly isSyncing = computed(() => this._status().state === 'Syncing');
  readonly hasConflicts = computed(() => this._status().state === 'Conflict');
  readonly hasError = computed(() => isSyncError(this._status().state));
  readonly user = computed(() => this._status().user ?? null);
  readonly pendingChanges = computed(() => this._status().pending_changes);
  readonly lastSync = computed(() => {
    const ls = this._status().last_sync;
    return ls ? new Date(ls) : null;
  });

  constructor(private tauri: TauriService) {
    // Try to restore session on startup
    this.restoreSession();
  }

  // ========== Session Management ==========

  private async restoreSession(): Promise<void> {
    try {
      const stored = localStorage.getItem(SESSION_STORAGE_KEY);
      if (!stored) return;

      const session: StoredSession = JSON.parse(stored);

      // Check if credential is expired
      const expiresAt = new Date(session.tokens.expires_at);
      if (expiresAt <= new Date()) {
        localStorage.removeItem(SESSION_STORAGE_KEY);
        return;
      }

      // Restore session in backend
      await this.tauri.syncRestoreSession(session.tokens, session.user);

      // Refresh status
      await this.refreshStatus();
    } catch (e) {
      console.error('Failed to restore session:', e);
      localStorage.removeItem(SESSION_STORAGE_KEY);
    }
  }

  private saveSession(tokens: AuthTokens, user: User): void {
    const session: StoredSession = { tokens, user };
    localStorage.setItem(SESSION_STORAGE_KEY, JSON.stringify(session));
  }

  private clearSession(): void {
    localStorage.removeItem(SESSION_STORAGE_KEY);
  }

  // ========== Status & Refresh ==========

  async refreshStatus(): Promise<void> {
    try {
      const [status, conflicts] = await Promise.all([
        this.tauri.getSyncStatus(),
        this.tauri.getSyncConflicts(),
      ]);
      this._status.set(status);
      this._conflicts.set(conflicts);
    } catch (e) {
      console.error('Failed to refresh sync status:', e);
    }
  }

  async refreshHistory(): Promise<void> {
    try {
      const history = await this.tauri.getSyncHistory(100);
      this._history.set(history);
    } catch (e) {
      console.error('Failed to refresh sync history:', e);
    }
  }

  // ========== Authentication ==========

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
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      this._error.set(msg);
      throw e;
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
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      this._error.set(msg);
      throw e;
    } finally {
      this._isLoading.set(false);
    }
  }

  async logout(): Promise<void> {
    this._isLoading.set(true);

    try {
      await this.tauri.syncLogout();
      this.clearSession();
      await this.refreshStatus();
    } finally {
      this._isLoading.set(false);
    }
  }

  // ========== Sync Operations ==========

  async sync(): Promise<SyncResult> {
    this._isLoading.set(true);
    this._error.set(null);

    try {
      const result = await this.tauri.syncNow();
      await this.refreshStatus();
      await this.refreshHistory();

      if (result.errors.length > 0) {
        this._error.set(result.errors.join('; '));
      }

      return result;
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      this._error.set(msg);
      throw e;
    } finally {
      this._isLoading.set(false);
    }
  }

  async resolveConflict(
    projectId: string,
    resolution: ConflictResolution
  ): Promise<void> {
    this._isLoading.set(true);

    try {
      await this.tauri.syncResolveConflict(projectId, resolution);
      await this.refreshStatus();
      await this.refreshHistory();
    } finally {
      this._isLoading.set(false);
    }
  }

  // ========== Project Sync Settings ==========

  async setProjectSyncEnabled(
    projectId: string,
    enabled: boolean
  ): Promise<void> {
    await this.tauri.syncSetEnabled(projectId, enabled);
  }

  async markProjectDirty(projectId: string): Promise<void> {
    await this.tauri.syncMarkDirty(projectId);
    await this.refreshStatus();
  }

  // ========== Utilities ==========

  clearError(): void {
    this._error.set(null);
  }
}
