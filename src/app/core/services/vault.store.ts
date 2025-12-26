import { Injectable, signal, computed } from '@angular/core';
import { TauriService } from './tauri.service';
import {
  Project,
  Environment,
  Variable,
  VaultStatus,
  SearchResult,
} from '../models';

@Injectable({
  providedIn: 'root',
})
export class VaultStore {
  // State signals
  private readonly _status = signal<VaultStatus>({
    is_initialized: false,
    is_unlocked: false,
  });
  private readonly _projects = signal<Project[]>([]);
  private readonly _selectedProjectId = signal<string | null>(null);
  private readonly _environments = signal<Environment[]>([]);
  private readonly _selectedEnvironmentId = signal<string | null>(null);
  private readonly _variables = signal<Variable[]>([]);
  private readonly _searchResults = signal<SearchResult[]>([]);
  private readonly _isLoading = signal(false);
  private readonly _error = signal<string | null>(null);

  // Public readonly signals
  readonly status = this._status.asReadonly();
  readonly projects = this._projects.asReadonly();
  readonly selectedProjectId = this._selectedProjectId.asReadonly();
  readonly environments = this._environments.asReadonly();
  readonly selectedEnvironmentId = this._selectedEnvironmentId.asReadonly();
  readonly variables = this._variables.asReadonly();
  readonly searchResults = this._searchResults.asReadonly();
  readonly isLoading = this._isLoading.asReadonly();
  readonly error = this._error.asReadonly();

  // Computed values
  readonly isInitialized = computed(() => this._status().is_initialized);
  readonly isUnlocked = computed(() => this._status().is_unlocked);

  readonly selectedProject = computed(() => {
    const id = this._selectedProjectId();
    return this._projects().find((p) => p.id === id) ?? null;
  });

  readonly selectedEnvironment = computed(() => {
    const id = this._selectedEnvironmentId();
    return this._environments().find((e) => e.id === id) ?? null;
  });

  constructor(private readonly tauri: TauriService) {}

  // ========== Vault Operations ==========

  async checkStatus(): Promise<void> {
    try {
      const status = await this.tauri.getVaultStatus();
      this._status.set(status);
    } catch (err) {
      this.handleError(err);
    }
  }

  async initialize(masterPassword: string): Promise<boolean> {
    this._isLoading.set(true);
    this._error.set(null);
    try {
      await this.tauri.initializeVault(masterPassword);
      await this.checkStatus();
      return true;
    } catch (err) {
      this.handleError(err);
      return false;
    } finally {
      this._isLoading.set(false);
    }
  }

  async unlock(masterPassword: string): Promise<boolean> {
    this._isLoading.set(true);
    this._error.set(null);
    try {
      await this.tauri.unlockVault(masterPassword);
      await this.checkStatus();
      await this.loadProjects();
      return true;
    } catch (err) {
      this.handleError(err);
      return false;
    } finally {
      this._isLoading.set(false);
    }
  }

  async lock(): Promise<void> {
    try {
      await this.tauri.lockVault();
      this._status.update((s) => ({ ...s, is_unlocked: false }));
      this.clearState();
    } catch (err) {
      this.handleError(err);
    }
  }

  // ========== Project Operations ==========

  async loadProjects(): Promise<void> {
    try {
      const projects = await this.tauri.getProjects();
      this._projects.set(projects);
    } catch (err) {
      this.handleError(err);
    }
  }

  async createProject(name: string, description?: string): Promise<Project | null> {
    this._isLoading.set(true);
    try {
      const project = await this.tauri.createProject(name, description);
      this._projects.update((p) => [...p, project]);
      return project;
    } catch (err) {
      this.handleError(err);
      return null;
    } finally {
      this._isLoading.set(false);
    }
  }

  async updateProject(id: string, name: string, description?: string): Promise<boolean> {
    this._isLoading.set(true);
    try {
      const project = await this.tauri.updateProject(id, name, description);
      this._projects.update((projects) =>
        projects.map((p) => (p.id === id ? project : p))
      );
      return true;
    } catch (err) {
      this.handleError(err);
      return false;
    } finally {
      this._isLoading.set(false);
    }
  }

  async deleteProject(id: string): Promise<boolean> {
    this._isLoading.set(true);
    try {
      await this.tauri.deleteProject(id);
      this._projects.update((projects) => projects.filter((p) => p.id !== id));
      if (this._selectedProjectId() === id) {
        this._selectedProjectId.set(null);
        this._environments.set([]);
        this._variables.set([]);
      }
      return true;
    } catch (err) {
      this.handleError(err);
      return false;
    } finally {
      this._isLoading.set(false);
    }
  }

  async selectProject(id: string): Promise<void> {
    this._selectedProjectId.set(id);
    await this.loadEnvironments(id);
  }

  // ========== Environment Operations ==========

  async loadEnvironments(projectId: string): Promise<void> {
    try {
      const environments = await this.tauri.getEnvironments(projectId);
      this._environments.set(environments);
      // Auto-select first environment
      if (environments.length > 0) {
        await this.selectEnvironment(environments[0].id);
      } else {
        this._selectedEnvironmentId.set(null);
        this._variables.set([]);
      }
    } catch (err) {
      this.handleError(err);
    }
  }

  async selectEnvironment(id: string): Promise<void> {
    this._selectedEnvironmentId.set(id);
    await this.loadVariables(id);
  }

  async createEnvironment(
    projectId: string,
    name: string,
    envType: string
  ): Promise<Environment | null> {
    this._isLoading.set(true);
    try {
      const environment = await this.tauri.createEnvironment(
        projectId,
        name,
        envType
      );
      this._environments.update((e) => [...e, environment]);
      return environment;
    } catch (err) {
      this.handleError(err);
      return null;
    } finally {
      this._isLoading.set(false);
    }
  }

  async deleteEnvironment(id: string): Promise<boolean> {
    this._isLoading.set(true);
    try {
      await this.tauri.deleteEnvironment(id);
      this._environments.update((envs) => envs.filter((e) => e.id !== id));
      if (this._selectedEnvironmentId() === id) {
        const remaining = this._environments();
        if (remaining.length > 0) {
          await this.selectEnvironment(remaining[0].id);
        } else {
          this._selectedEnvironmentId.set(null);
          this._variables.set([]);
        }
      }
      return true;
    } catch (err) {
      this.handleError(err);
      return false;
    } finally {
      this._isLoading.set(false);
    }
  }

  // ========== Variable Operations ==========

  async loadVariables(environmentId: string): Promise<void> {
    try {
      const variables = await this.tauri.getVariables(environmentId);
      this._variables.set(variables);
    } catch (err) {
      this.handleError(err);
    }
  }

  async createVariable(
    environmentId: string,
    key: string,
    value: string,
    isSecret: boolean = true
  ): Promise<Variable | null> {
    try {
      const variable = await this.tauri.createVariable(
        environmentId,
        key,
        value,
        isSecret
      );
      this._variables.update((v) => [...v, variable]);
      return variable;
    } catch (err) {
      this.handleError(err);
      return null;
    }
  }

  async updateVariable(
    id: string,
    key: string,
    value: string,
    isSecret: boolean
  ): Promise<boolean> {
    try {
      const variable = await this.tauri.updateVariable(id, key, value, isSecret);
      this._variables.update((vars) =>
        vars.map((v) => (v.id === id ? variable : v))
      );
      return true;
    } catch (err) {
      this.handleError(err);
      return false;
    }
  }

  async deleteVariable(id: string): Promise<boolean> {
    try {
      await this.tauri.deleteVariable(id);
      this._variables.update((vars) => vars.filter((v) => v.id !== id));
      return true;
    } catch (err) {
      this.handleError(err);
      return false;
    }
  }

  // ========== Search Operations ==========

  async search(query: string): Promise<void> {
    if (!query.trim()) {
      this._searchResults.set([]);
      return;
    }
    try {
      const results = await this.tauri.searchVariables(query);
      this._searchResults.set(results);
    } catch (err) {
      this.handleError(err);
    }
  }

  clearSearch(): void {
    this._searchResults.set([]);
  }

  // ========== Import/Export Operations ==========

  async exportToEnvFile(environmentId: string): Promise<string | null> {
    try {
      return await this.tauri.exportEnvFile(environmentId);
    } catch (err) {
      this.handleError(err);
      return null;
    }
  }

  async importFromEnvFile(
    environmentId: string,
    content: string
  ): Promise<boolean> {
    this._isLoading.set(true);
    try {
      const variables = await this.tauri.importEnvFile(environmentId, content);
      this._variables.update((v) => [...v, ...variables]);
      return true;
    } catch (err) {
      this.handleError(err);
      return false;
    } finally {
      this._isLoading.set(false);
    }
  }

  // ========== Helpers ==========

  clearError(): void {
    this._error.set(null);
  }

  private clearState(): void {
    this._projects.set([]);
    this._selectedProjectId.set(null);
    this._environments.set([]);
    this._selectedEnvironmentId.set(null);
    this._variables.set([]);
    this._searchResults.set([]);
  }

  private handleError(err: unknown): void {
    const message = err instanceof Error ? err.message : String(err);
    this._error.set(message);
    console.error('VaultStore error:', err);
  }
}
