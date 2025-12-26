/**
 * EnvSync Platform Service
 * Abstracts between Tauri (desktop) and Web (browser) platforms
 */
import { Injectable, Inject, PLATFORM_ID } from '@angular/core';
import { isPlatformBrowser } from '@angular/common';
import { Observable, from, of } from 'rxjs';
import { map, switchMap } from 'rxjs/operators';

import { TauriService } from './tauri.service';
import { ApiService } from './api.service';
import { CryptoService } from './crypto.service';
import {
  Project,
  Environment,
  Variable,
  VaultStatus,
  SearchResult,
  SyncStatus,
  SyncResult,
  User,
  AuthTokens,
  ConflictInfo,
  Team,
  TeamMember,
  TeamInvite,
  TeamWithMembers,
  TeamRole,
  AuditEvent,
  AuditQuery,
} from '../models';

export type Platform = 'tauri' | 'web';

@Injectable({
  providedIn: 'root',
})
export class PlatformService {
  readonly platform: Platform;
  private vaultPassword: string | null = null;

  constructor(
    @Inject(PLATFORM_ID) private platformId: Object,
    private tauriService: TauriService,
    private apiService: ApiService,
    private cryptoService: CryptoService
  ) {
    // Detect if running in Tauri
    this.platform = this.detectPlatform();
  }

  private detectPlatform(): Platform {
    if (!isPlatformBrowser(this.platformId)) {
      return 'web';
    }

    // Check for Tauri window object
    if (typeof window !== 'undefined' && '__TAURI__' in window) {
      return 'tauri';
    }

    return 'web';
  }

  get isTauri(): boolean {
    return this.platform === 'tauri';
  }

  get isWeb(): boolean {
    return this.platform === 'web';
  }

  // ========== Vault Operations (Web-specific) ==========

  async getVaultStatus(): Promise<VaultStatus> {
    if (this.isTauri) {
      return this.tauriService.getVaultStatus();
    }

    // Web mode: vault status based on auth and crypto
    return {
      initialized: this.apiService.isAuthenticated(),
      locked: !this.cryptoService.isInitialized(),
      lastActivity: Date.now(),
    };
  }

  async initializeVault(masterPassword: string): Promise<void> {
    if (this.isTauri) {
      return this.tauriService.initializeVault(masterPassword);
    }

    // Web mode: initialize crypto with password
    this.vaultPassword = masterPassword;
    await this.cryptoService.initialize(masterPassword);
  }

  async unlockVault(masterPassword: string): Promise<void> {
    if (this.isTauri) {
      return this.tauriService.unlockVault(masterPassword);
    }

    // Web mode: re-initialize crypto
    this.vaultPassword = masterPassword;
    const user = localStorage.getItem('envsync_user');
    if (user) {
      const userData = JSON.parse(user);
      await this.cryptoService.initialize(masterPassword, userData.master_key_salt);
    } else {
      await this.cryptoService.initialize(masterPassword);
    }
  }

  async lockVault(): Promise<void> {
    if (this.isTauri) {
      return this.tauriService.lockVault();
    }

    // Web mode: clear crypto key
    this.vaultPassword = null;
    this.cryptoService.lock();
  }

  // ========== Authentication (Web-specific) ==========

  async login(email: string, password: string): Promise<User> {
    if (this.isTauri) {
      return this.tauriService.syncLogin(email, password);
    }

    return new Promise((resolve, reject) => {
      this.apiService.login(email, password).subscribe({
        next: (result) => resolve(result.user),
        error: (err) => reject(err),
      });
    });
  }

  async signup(email: string, password: string, name?: string): Promise<User> {
    if (this.isTauri) {
      return this.tauriService.syncSignup(email, password, name);
    }

    return new Promise((resolve, reject) => {
      this.apiService.register(email, password, name).subscribe({
        next: (result) => resolve(result.user),
        error: (err) => reject(err),
      });
    });
  }

  async logout(): Promise<void> {
    if (this.isTauri) {
      return this.tauriService.syncLogout();
    }

    this.apiService.logout();
    this.cryptoService.lock();
  }

  // ========== Projects ==========

  async getProjects(): Promise<Project[]> {
    if (this.isTauri) {
      return this.tauriService.getProjects();
    }

    return new Promise((resolve, reject) => {
      this.apiService.getProjects().subscribe({
        next: (projects) => resolve(projects),
        error: (err) => reject(err),
      });
    });
  }

  async getProject(id: string): Promise<Project> {
    if (this.isTauri) {
      return this.tauriService.getProject(id);
    }

    return new Promise((resolve, reject) => {
      this.apiService.getProject(id).subscribe({
        next: (project) => resolve(project),
        error: (err) => reject(err),
      });
    });
  }

  async createProject(name: string, description?: string): Promise<Project> {
    if (this.isTauri) {
      return this.tauriService.createProject(name, description);
    }

    return new Promise((resolve, reject) => {
      this.apiService.createProject(name, description).subscribe({
        next: (project) => resolve(project),
        error: (err) => reject(err),
      });
    });
  }

  async updateProject(id: string, name: string, description?: string): Promise<Project> {
    if (this.isTauri) {
      return this.tauriService.updateProject(id, name, description);
    }

    return new Promise((resolve, reject) => {
      this.apiService.updateProject(id, name, description).subscribe({
        next: (project) => resolve(project),
        error: (err) => reject(err),
      });
    });
  }

  async deleteProject(id: string): Promise<void> {
    if (this.isTauri) {
      return this.tauriService.deleteProject(id);
    }

    return new Promise((resolve, reject) => {
      this.apiService.deleteProject(id).subscribe({
        next: () => resolve(),
        error: (err) => reject(err),
      });
    });
  }

  // ========== Environments ==========

  async getEnvironments(projectId: string): Promise<Environment[]> {
    if (this.isTauri) {
      return this.tauriService.getEnvironments(projectId);
    }

    return new Promise((resolve, reject) => {
      this.apiService.getEnvironments(projectId).subscribe({
        next: (envs) => resolve(envs),
        error: (err) => reject(err),
      });
    });
  }

  async createEnvironment(projectId: string, name: string, envType: string): Promise<Environment> {
    if (this.isTauri) {
      return this.tauriService.createEnvironment(projectId, name, envType);
    }

    return new Promise((resolve, reject) => {
      this.apiService.createEnvironment(projectId, name, envType).subscribe({
        next: (env) => resolve(env),
        error: (err) => reject(err),
      });
    });
  }

  async deleteEnvironment(projectId: string, id: string): Promise<void> {
    if (this.isTauri) {
      return this.tauriService.deleteEnvironment(id);
    }

    return new Promise((resolve, reject) => {
      this.apiService.deleteEnvironment(projectId, id).subscribe({
        next: () => resolve(),
        error: (err) => reject(err),
      });
    });
  }

  // ========== Variables ==========

  async getVariables(projectId: string, environmentId: string): Promise<Variable[]> {
    if (this.isTauri) {
      return this.tauriService.getVariables(environmentId);
    }

    return new Promise((resolve, reject) => {
      this.apiService.getVariables(projectId, environmentId).subscribe({
        next: (vars) => resolve(vars),
        error: (err) => reject(err),
      });
    });
  }

  async createVariable(
    projectId: string,
    environmentId: string,
    key: string,
    value: string,
    isSecret: boolean = true
  ): Promise<Variable> {
    if (this.isTauri) {
      return this.tauriService.createVariable(environmentId, key, value, isSecret);
    }

    // Web mode: encrypt value before sending
    const { ciphertext, nonce } = await this.cryptoService.encrypt(value);

    return new Promise((resolve, reject) => {
      this.apiService.createVariable(projectId, environmentId, key, ciphertext, nonce, isSecret).subscribe({
        next: (variable) => resolve(variable),
        error: (err) => reject(err),
      });
    });
  }

  async updateVariable(
    projectId: string,
    environmentId: string,
    id: string,
    key: string,
    value: string,
    isSecret: boolean
  ): Promise<Variable> {
    if (this.isTauri) {
      return this.tauriService.updateVariable(id, key, value, isSecret);
    }

    // Web mode: encrypt value before sending
    const { ciphertext, nonce } = await this.cryptoService.encrypt(value);

    return new Promise((resolve, reject) => {
      this.apiService.updateVariable(projectId, environmentId, id, key, ciphertext, nonce, isSecret).subscribe({
        next: (variable) => resolve(variable),
        error: (err) => reject(err),
      });
    });
  }

  async deleteVariable(projectId: string, environmentId: string, id: string): Promise<void> {
    if (this.isTauri) {
      return this.tauriService.deleteVariable(id);
    }

    return new Promise((resolve, reject) => {
      this.apiService.deleteVariable(projectId, environmentId, id).subscribe({
        next: () => resolve(),
        error: (err) => reject(err),
      });
    });
  }

  async decryptVariable(encryptedValue: string, nonce: string): Promise<string> {
    if (this.isTauri) {
      // Tauri handles decryption internally
      return encryptedValue;
    }

    return this.cryptoService.decrypt(encryptedValue, nonce);
  }

  // ========== Search ==========

  async searchVariables(query: string): Promise<SearchResult[]> {
    if (this.isTauri) {
      return this.tauriService.searchVariables(query);
    }

    return new Promise((resolve, reject) => {
      this.apiService.searchVariables(query).subscribe({
        next: (results) => resolve(results),
        error: (err) => reject(err),
      });
    });
  }

  // ========== Sync ==========

  async getSyncStatus(): Promise<SyncStatus> {
    if (this.isTauri) {
      return this.tauriService.getSyncStatus();
    }

    return new Promise((resolve, reject) => {
      this.apiService.getSyncStatus().subscribe({
        next: (status) => resolve(status),
        error: (err) => reject(err),
      });
    });
  }

  async syncNow(): Promise<SyncResult> {
    if (this.isTauri) {
      return this.tauriService.syncNow();
    }

    return new Promise((resolve, reject) => {
      this.apiService.syncNow().subscribe({
        next: (result) => resolve(result),
        error: (err) => reject(err),
      });
    });
  }

  // ========== Teams ==========

  async getTeams(): Promise<Team[]> {
    if (this.isTauri) {
      return this.tauriService.getTeams();
    }

    return new Promise((resolve, reject) => {
      this.apiService.getTeams().subscribe({
        next: (teams) => resolve(teams),
        error: (err) => reject(err),
      });
    });
  }

  async getTeamWithMembers(teamId: string): Promise<TeamWithMembers> {
    if (this.isTauri) {
      return this.tauriService.getTeamWithMembers(teamId);
    }

    return new Promise((resolve, reject) => {
      this.apiService.getTeamWithMembers(teamId).subscribe({
        next: (team) => resolve(team),
        error: (err) => reject(err),
      });
    });
  }

  async createTeam(name: string, description?: string, threshold?: number, totalShares?: number): Promise<Team> {
    if (this.isTauri) {
      return this.tauriService.createTeam(name, description, threshold, totalShares);
    }

    return new Promise((resolve, reject) => {
      this.apiService.createTeam(name, description, threshold, totalShares).subscribe({
        next: (team) => resolve(team),
        error: (err) => reject(err),
      });
    });
  }

  async inviteTeamMember(teamId: string, email: string, role: TeamRole): Promise<TeamInvite> {
    if (this.isTauri) {
      return this.tauriService.inviteTeamMember(teamId, email, role);
    }

    return new Promise((resolve, reject) => {
      this.apiService.inviteTeamMember(teamId, email, role).subscribe({
        next: (invite) => resolve(invite),
        error: (err) => reject(err),
      });
    });
  }

  // ========== Audit ==========

  async getTeamAuditLog(teamId: string, limit?: number): Promise<AuditEvent[]> {
    if (this.isTauri) {
      return this.tauriService.getTeamAuditLog(teamId, limit);
    }

    return new Promise((resolve, reject) => {
      this.apiService.getTeamAuditLog(teamId).subscribe({
        next: (result) => resolve(result.entries),
        error: (err) => reject(err),
      });
    });
  }
}
