import { Injectable } from '@angular/core';
import { invoke } from '@tauri-apps/api/core';
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
}
