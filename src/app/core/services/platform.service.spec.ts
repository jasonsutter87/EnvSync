/**
 * PlatformService Unit Tests
 *
 * Tests for the EnvSync Platform service covering:
 * - Platform detection (Tauri vs Web)
 * - Vault operations routing
 * - Authentication routing
 * - Project, Environment, and Variable operations
 * - Team operations routing
 * - Error handling
 */

import { vi, describe, it, expect, beforeEach, afterEach } from 'vitest';
import { of, throwError } from 'rxjs';
import {
  Project,
  Environment,
  Variable,
  VaultStatus,
  User,
  Team,
  TeamWithMembers,
  SyncStatus,
  SyncResult,
  SearchResult,
  AuditEvent,
  TeamInvite,
  TeamMember,
} from '../models';

// Mock services
interface MockTauriService {
  getVaultStatus: ReturnType<typeof vi.fn>;
  initializeVault: ReturnType<typeof vi.fn>;
  unlockVault: ReturnType<typeof vi.fn>;
  lockVault: ReturnType<typeof vi.fn>;
  syncLogin: ReturnType<typeof vi.fn>;
  syncSignup: ReturnType<typeof vi.fn>;
  syncLogout: ReturnType<typeof vi.fn>;
  getProjects: ReturnType<typeof vi.fn>;
  getProject: ReturnType<typeof vi.fn>;
  createProject: ReturnType<typeof vi.fn>;
  updateProject: ReturnType<typeof vi.fn>;
  deleteProject: ReturnType<typeof vi.fn>;
  getEnvironments: ReturnType<typeof vi.fn>;
  createEnvironment: ReturnType<typeof vi.fn>;
  deleteEnvironment: ReturnType<typeof vi.fn>;
  getVariables: ReturnType<typeof vi.fn>;
  createVariable: ReturnType<typeof vi.fn>;
  updateVariable: ReturnType<typeof vi.fn>;
  deleteVariable: ReturnType<typeof vi.fn>;
  searchVariables: ReturnType<typeof vi.fn>;
  syncNow: ReturnType<typeof vi.fn>;
  getTeams: ReturnType<typeof vi.fn>;
  getTeamWithMembers: ReturnType<typeof vi.fn>;
  createTeam: ReturnType<typeof vi.fn>;
  inviteTeamMember: ReturnType<typeof vi.fn>;
  getTeamAuditLog: ReturnType<typeof vi.fn>;
}

interface MockApiService {
  isAuthenticated: ReturnType<typeof vi.fn>;
  login: ReturnType<typeof vi.fn>;
  register: ReturnType<typeof vi.fn>;
  logout: ReturnType<typeof vi.fn>;
  getProjects: ReturnType<typeof vi.fn>;
  getProject: ReturnType<typeof vi.fn>;
  createProject: ReturnType<typeof vi.fn>;
  updateProject: ReturnType<typeof vi.fn>;
  deleteProject: ReturnType<typeof vi.fn>;
  getEnvironments: ReturnType<typeof vi.fn>;
  createEnvironment: ReturnType<typeof vi.fn>;
  deleteEnvironment: ReturnType<typeof vi.fn>;
  getVariables: ReturnType<typeof vi.fn>;
  createVariable: ReturnType<typeof vi.fn>;
  updateVariable: ReturnType<typeof vi.fn>;
  deleteVariable: ReturnType<typeof vi.fn>;
  searchVariables: ReturnType<typeof vi.fn>;
  getSyncStatus: ReturnType<typeof vi.fn>;
  syncNow: ReturnType<typeof vi.fn>;
  getTeams: ReturnType<typeof vi.fn>;
  getTeamWithMembers: ReturnType<typeof vi.fn>;
  createTeam: ReturnType<typeof vi.fn>;
  inviteTeamMember: ReturnType<typeof vi.fn>;
  getTeamAuditLog: ReturnType<typeof vi.fn>;
}

interface MockCryptoService {
  isInitialized: ReturnType<typeof vi.fn>;
  initialize: ReturnType<typeof vi.fn>;
  encrypt: ReturnType<typeof vi.fn>;
  decrypt: ReturnType<typeof vi.fn>;
  destroy: ReturnType<typeof vi.fn>;
}

const createMockTauriService = (): MockTauriService => ({
  getVaultStatus: vi.fn(),
  initializeVault: vi.fn(),
  unlockVault: vi.fn(),
  lockVault: vi.fn(),
  syncLogin: vi.fn(),
  syncSignup: vi.fn(),
  syncLogout: vi.fn(),
  getProjects: vi.fn(),
  getProject: vi.fn(),
  createProject: vi.fn(),
  updateProject: vi.fn(),
  deleteProject: vi.fn(),
  getEnvironments: vi.fn(),
  createEnvironment: vi.fn(),
  deleteEnvironment: vi.fn(),
  getVariables: vi.fn(),
  createVariable: vi.fn(),
  updateVariable: vi.fn(),
  deleteVariable: vi.fn(),
  searchVariables: vi.fn(),
  syncNow: vi.fn(),
  getTeams: vi.fn(),
  getTeamWithMembers: vi.fn(),
  createTeam: vi.fn(),
  inviteTeamMember: vi.fn(),
  getTeamAuditLog: vi.fn(),
});

const createMockApiService = (): MockApiService => ({
  isAuthenticated: vi.fn(),
  login: vi.fn(),
  register: vi.fn(),
  logout: vi.fn(),
  getProjects: vi.fn(),
  getProject: vi.fn(),
  createProject: vi.fn(),
  updateProject: vi.fn(),
  deleteProject: vi.fn(),
  getEnvironments: vi.fn(),
  createEnvironment: vi.fn(),
  deleteEnvironment: vi.fn(),
  getVariables: vi.fn(),
  createVariable: vi.fn(),
  updateVariable: vi.fn(),
  deleteVariable: vi.fn(),
  searchVariables: vi.fn(),
  getSyncStatus: vi.fn(),
  syncNow: vi.fn(),
  getTeams: vi.fn(),
  getTeamWithMembers: vi.fn(),
  createTeam: vi.fn(),
  inviteTeamMember: vi.fn(),
  getTeamAuditLog: vi.fn(),
});

const createMockCryptoService = (): MockCryptoService => ({
  isInitialized: vi.fn(),
  initialize: vi.fn(),
  encrypt: vi.fn(),
  decrypt: vi.fn(),
  destroy: vi.fn(),
});

// Simplified PlatformService for testing
class PlatformServiceLogic {
  private isTauriPlatform: boolean;

  constructor(
    private tauri: MockTauriService,
    private api: MockApiService,
    private crypto: MockCryptoService,
    isTauri = false
  ) {
    this.isTauriPlatform = isTauri;
  }

  get isTauri(): boolean {
    return this.isTauriPlatform;
  }

  get isWeb(): boolean {
    return !this.isTauriPlatform;
  }

  // Vault operations
  async getVaultStatus(): Promise<VaultStatus> {
    if (this.isTauriPlatform) {
      return this.tauri.getVaultStatus();
    }
    return {
      is_initialized: true,
      is_unlocked: this.api.isAuthenticated() && this.crypto.isInitialized(),
    };
  }

  async initializeVault(password: string): Promise<void> {
    if (this.isTauriPlatform) {
      return this.tauri.initializeVault(password);
    }
    await this.crypto.initialize(password);
  }

  async unlockVault(password: string): Promise<void> {
    if (this.isTauriPlatform) {
      return this.tauri.unlockVault(password);
    }
    const storedUser = localStorage.getItem('envsync_user');
    if (!storedUser) {
      throw new Error('No stored user found');
    }
    await this.crypto.initialize(password);
  }

  async lockVault(): Promise<void> {
    if (this.isTauriPlatform) {
      return this.tauri.lockVault();
    }
    this.crypto.destroy();
  }

  // Authentication
  async login(email: string, password: string): Promise<User> {
    if (this.isTauriPlatform) {
      return this.tauri.syncLogin(email, password);
    }
    return new Promise((resolve, reject) => {
      this.api.login(email, password).subscribe({
        next: (response: any) => resolve(response.user),
        error: reject,
      });
    });
  }

  async signup(email: string, password: string, name?: string): Promise<User> {
    if (this.isTauriPlatform) {
      return this.tauri.syncSignup(email, password, name);
    }
    return new Promise((resolve, reject) => {
      this.api.register(email, password, name).subscribe({
        next: (response: any) => resolve(response.user),
        error: reject,
      });
    });
  }

  async logout(): Promise<void> {
    if (this.isTauriPlatform) {
      await this.tauri.syncLogout();
    } else {
      this.api.logout();
    }
    await this.lockVault();
  }

  // Projects
  async getProjects(): Promise<Project[]> {
    if (this.isTauriPlatform) {
      return this.tauri.getProjects();
    }
    return new Promise((resolve, reject) => {
      this.api.getProjects().subscribe({ next: resolve, error: reject });
    });
  }

  async getProject(id: string): Promise<Project> {
    if (this.isTauriPlatform) {
      return this.tauri.getProject(id);
    }
    return new Promise((resolve, reject) => {
      this.api.getProject(id).subscribe({ next: resolve, error: reject });
    });
  }

  async createProject(name: string, description?: string): Promise<Project> {
    if (this.isTauriPlatform) {
      return this.tauri.createProject(name, description);
    }
    return new Promise((resolve, reject) => {
      this.api.createProject(name, description).subscribe({ next: resolve, error: reject });
    });
  }

  async updateProject(id: string, name: string, description?: string): Promise<Project> {
    if (this.isTauriPlatform) {
      return this.tauri.updateProject(id, name, description);
    }
    return new Promise((resolve, reject) => {
      this.api.updateProject(id, name, description).subscribe({ next: resolve, error: reject });
    });
  }

  async deleteProject(id: string): Promise<void> {
    if (this.isTauriPlatform) {
      return this.tauri.deleteProject(id);
    }
    return new Promise((resolve, reject) => {
      this.api.deleteProject(id).subscribe({ next: () => resolve(), error: reject });
    });
  }

  // Environments
  async getEnvironments(projectId: string): Promise<Environment[]> {
    if (this.isTauriPlatform) {
      return this.tauri.getEnvironments(projectId);
    }
    return new Promise((resolve, reject) => {
      this.api.getEnvironments(projectId).subscribe({ next: resolve, error: reject });
    });
  }

  async createEnvironment(projectId: string, name: string, envType: string): Promise<Environment> {
    if (this.isTauriPlatform) {
      return this.tauri.createEnvironment(projectId, name, envType);
    }
    return new Promise((resolve, reject) => {
      this.api.createEnvironment(projectId, name, envType).subscribe({ next: resolve, error: reject });
    });
  }

  async deleteEnvironment(projectId: string, id: string): Promise<void> {
    if (this.isTauriPlatform) {
      return this.tauri.deleteEnvironment(projectId, id);
    }
    return new Promise((resolve, reject) => {
      this.api.deleteEnvironment(projectId, id).subscribe({ next: () => resolve(), error: reject });
    });
  }

  // Variables
  async getVariables(projectId: string, environmentId: string): Promise<Variable[]> {
    if (this.isTauriPlatform) {
      return this.tauri.getVariables(projectId, environmentId);
    }
    const variables = await new Promise<Variable[]>((resolve, reject) => {
      this.api.getVariables(projectId, environmentId).subscribe({ next: resolve, error: reject });
    });
    // Decrypt values
    for (const variable of variables) {
      if (variable.is_secret && variable.value) {
        variable.value = await this.crypto.decrypt(variable.value, variable.nonce || '');
      }
    }
    return variables;
  }

  async createVariable(projectId: string, environmentId: string, key: string, value: string, isSecret: boolean): Promise<Variable> {
    if (this.isTauriPlatform) {
      return this.tauri.createVariable(projectId, environmentId, key, value, isSecret);
    }
    const { ciphertext, nonce } = await this.crypto.encrypt(value);
    return new Promise((resolve, reject) => {
      this.api.createVariable(projectId, environmentId, key, ciphertext, nonce, isSecret).subscribe({ next: resolve, error: reject });
    });
  }

  async updateVariable(projectId: string, environmentId: string, id: string, key: string, value: string, isSecret: boolean): Promise<Variable> {
    if (this.isTauriPlatform) {
      return this.tauri.updateVariable(projectId, environmentId, id, key, value, isSecret);
    }
    const { ciphertext, nonce } = await this.crypto.encrypt(value);
    return new Promise((resolve, reject) => {
      this.api.updateVariable(projectId, environmentId, id, key, ciphertext, nonce, isSecret).subscribe({ next: resolve, error: reject });
    });
  }

  async deleteVariable(projectId: string, environmentId: string, id: string): Promise<void> {
    if (this.isTauriPlatform) {
      return this.tauri.deleteVariable(projectId, environmentId, id);
    }
    return new Promise((resolve, reject) => {
      this.api.deleteVariable(projectId, environmentId, id).subscribe({ next: () => resolve(), error: reject });
    });
  }

  // Search
  async searchVariables(query: string): Promise<SearchResult[]> {
    if (this.isTauriPlatform) {
      return this.tauri.searchVariables(query);
    }
    return new Promise((resolve, reject) => {
      this.api.searchVariables(query).subscribe({ next: resolve, error: reject });
    });
  }

  // Sync
  async getSyncStatus(): Promise<SyncStatus> {
    if (this.isTauriPlatform) {
      return { state: 'Idle', pending_changes: 0 };
    }
    return new Promise((resolve, reject) => {
      this.api.getSyncStatus().subscribe({ next: resolve, error: reject });
    });
  }

  async syncNow(): Promise<SyncResult> {
    if (this.isTauriPlatform) {
      return this.tauri.syncNow();
    }
    return new Promise((resolve, reject) => {
      this.api.syncNow().subscribe({ next: resolve, error: reject });
    });
  }

  // Teams
  async getTeams(): Promise<Team[]> {
    if (this.isTauriPlatform) {
      return this.tauri.getTeams();
    }
    return new Promise((resolve, reject) => {
      this.api.getTeams().subscribe({ next: resolve, error: reject });
    });
  }

  async getTeamWithMembers(teamId: string): Promise<TeamWithMembers> {
    if (this.isTauriPlatform) {
      return this.tauri.getTeamWithMembers(teamId);
    }
    return new Promise((resolve, reject) => {
      this.api.getTeamWithMembers(teamId).subscribe({ next: resolve, error: reject });
    });
  }

  async createTeam(name: string, description?: string, threshold?: number, totalShares?: number): Promise<Team> {
    if (this.isTauriPlatform) {
      return this.tauri.createTeam(name, description, threshold, totalShares);
    }
    return new Promise((resolve, reject) => {
      this.api.createTeam(name, description, threshold, totalShares).subscribe({ next: resolve, error: reject });
    });
  }

  async inviteTeamMember(teamId: string, email: string, role: string): Promise<TeamInvite> {
    if (this.isTauriPlatform) {
      return this.tauri.inviteTeamMember(teamId, email, role);
    }
    return new Promise((resolve, reject) => {
      this.api.inviteTeamMember(teamId, email, role).subscribe({ next: resolve, error: reject });
    });
  }

  async getTeamAuditLog(teamId: string, limit?: number): Promise<AuditEvent[]> {
    if (this.isTauriPlatform) {
      return this.tauri.getTeamAuditLog(teamId, limit);
    }
    return new Promise((resolve, reject) => {
      this.api.getTeamAuditLog(teamId, limit).subscribe({
        next: (response: any) => resolve(response.entries),
        error: reject,
      });
    });
  }
}

describe('PlatformService', () => {
  let tauriService: MockTauriService;
  let apiService: MockApiService;
  let cryptoService: MockCryptoService;

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
    localStorage.clear();
    tauriService = createMockTauriService();
    apiService = createMockApiService();
    cryptoService = createMockCryptoService();
  });

  afterEach(() => {
    localStorage.clear();
    vi.clearAllMocks();
  });

  // ========== Service Instantiation ==========

  describe('Service Instantiation', () => {
    it('should be created', () => {
      const service = new PlatformServiceLogic(tauriService, apiService, cryptoService);
      expect(service).toBeTruthy();
    });

    it('should detect web platform by default', () => {
      const service = new PlatformServiceLogic(tauriService, apiService, cryptoService, false);
      expect(service.isWeb).toBe(true);
      expect(service.isTauri).toBe(false);
    });

    it('should detect Tauri platform when configured', () => {
      const service = new PlatformServiceLogic(tauriService, apiService, cryptoService, true);
      expect(service.isTauri).toBe(true);
      expect(service.isWeb).toBe(false);
    });
  });

  // ========== Vault Operations - Web Mode ==========

  describe('Vault Operations - Web Mode', () => {
    it('should get vault status in web mode', async () => {
      const service = new PlatformServiceLogic(tauriService, apiService, cryptoService, false);
      apiService.isAuthenticated.mockReturnValue(true);
      cryptoService.isInitialized.mockReturnValue(true);

      const status = await service.getVaultStatus();

      expect(status.is_initialized).toBe(true);
      expect(status.is_unlocked).toBe(true);
    });

    it('should initialize vault in web mode', async () => {
      const service = new PlatformServiceLogic(tauriService, apiService, cryptoService, false);
      cryptoService.initialize.mockResolvedValue('salt-123');

      await service.initializeVault('password123');

      expect(cryptoService.initialize).toHaveBeenCalledWith('password123');
    });

    it('should unlock vault in web mode', async () => {
      const service = new PlatformServiceLogic(tauriService, apiService, cryptoService, false);
      localStorage.setItem('envsync_user', JSON.stringify(mockUser));
      cryptoService.initialize.mockResolvedValue('salt-123');

      await service.unlockVault('password123');

      expect(cryptoService.initialize).toHaveBeenCalledWith('password123');
    });

    it('should lock vault in web mode', async () => {
      const service = new PlatformServiceLogic(tauriService, apiService, cryptoService, false);

      await service.lockVault();

      expect(cryptoService.destroy).toHaveBeenCalled();
    });

    it('should handle unlock without stored user', async () => {
      const service = new PlatformServiceLogic(tauriService, apiService, cryptoService, false);

      await expect(service.unlockVault('password123')).rejects.toThrow('No stored user found');
    });
  });

  // ========== Vault Operations - Tauri Mode ==========

  describe('Vault Operations - Tauri Mode', () => {
    it('should delegate vault status to Tauri', async () => {
      const service = new PlatformServiceLogic(tauriService, apiService, cryptoService, true);
      tauriService.getVaultStatus.mockResolvedValue(mockVaultStatus);

      const status = await service.getVaultStatus();

      expect(tauriService.getVaultStatus).toHaveBeenCalled();
      expect(status).toEqual(mockVaultStatus);
    });

    it('should delegate vault initialization to Tauri', async () => {
      const service = new PlatformServiceLogic(tauriService, apiService, cryptoService, true);
      tauriService.initializeVault.mockResolvedValue(undefined);

      await service.initializeVault('password123');

      expect(tauriService.initializeVault).toHaveBeenCalledWith('password123');
    });

    it('should delegate vault unlock to Tauri', async () => {
      const service = new PlatformServiceLogic(tauriService, apiService, cryptoService, true);
      tauriService.unlockVault.mockResolvedValue(undefined);

      await service.unlockVault('password123');

      expect(tauriService.unlockVault).toHaveBeenCalledWith('password123');
    });

    it('should delegate vault lock to Tauri', async () => {
      const service = new PlatformServiceLogic(tauriService, apiService, cryptoService, true);
      tauriService.lockVault.mockResolvedValue(undefined);

      await service.lockVault();

      expect(tauriService.lockVault).toHaveBeenCalled();
    });
  });

  // ========== Authentication - Web Mode ==========

  describe('Authentication - Web Mode', () => {
    it('should login via API service', async () => {
      const service = new PlatformServiceLogic(tauriService, apiService, cryptoService, false);
      apiService.login.mockReturnValue(of({ user: mockUser, tokens: {} }));

      const user = await service.login('test@example.com', 'password');

      expect(apiService.login).toHaveBeenCalledWith('test@example.com', 'password');
      expect(user).toEqual(mockUser);
    });

    it('should signup via API service', async () => {
      const service = new PlatformServiceLogic(tauriService, apiService, cryptoService, false);
      apiService.register.mockReturnValue(of({ user: mockUser, tokens: {} }));

      const user = await service.signup('test@example.com', 'password', 'Test User');

      expect(apiService.register).toHaveBeenCalledWith('test@example.com', 'password', 'Test User');
      expect(user).toEqual(mockUser);
    });

    it('should logout and lock vault', async () => {
      const service = new PlatformServiceLogic(tauriService, apiService, cryptoService, false);

      await service.logout();

      expect(apiService.logout).toHaveBeenCalled();
      expect(cryptoService.destroy).toHaveBeenCalled();
    });

    it('should handle login errors', async () => {
      const service = new PlatformServiceLogic(tauriService, apiService, cryptoService, false);
      apiService.login.mockReturnValue(throwError(() => new Error('Invalid credentials')));

      await expect(service.login('test@example.com', 'wrong')).rejects.toThrow('Invalid credentials');
    });

    it('should handle signup errors', async () => {
      const service = new PlatformServiceLogic(tauriService, apiService, cryptoService, false);
      apiService.register.mockReturnValue(throwError(() => new Error('Email exists')));

      await expect(service.signup('test@example.com', 'password')).rejects.toThrow('Email exists');
    });
  });

  // ========== Authentication - Tauri Mode ==========

  describe('Authentication - Tauri Mode', () => {
    it('should login via Tauri service', async () => {
      const service = new PlatformServiceLogic(tauriService, apiService, cryptoService, true);
      tauriService.syncLogin.mockResolvedValue(mockUser);

      const user = await service.login('test@example.com', 'password');

      expect(tauriService.syncLogin).toHaveBeenCalledWith('test@example.com', 'password');
      expect(user).toEqual(mockUser);
    });

    it('should signup via Tauri service', async () => {
      const service = new PlatformServiceLogic(tauriService, apiService, cryptoService, true);
      tauriService.syncSignup.mockResolvedValue(mockUser);

      const user = await service.signup('test@example.com', 'password', 'Test User');

      expect(tauriService.syncSignup).toHaveBeenCalledWith('test@example.com', 'password', 'Test User');
      expect(user).toEqual(mockUser);
    });

    it('should logout via Tauri service', async () => {
      const service = new PlatformServiceLogic(tauriService, apiService, cryptoService, true);
      tauriService.syncLogout.mockResolvedValue(undefined);
      tauriService.lockVault.mockResolvedValue(undefined);

      await service.logout();

      expect(tauriService.syncLogout).toHaveBeenCalled();
    });
  });

  // ========== Project Operations - Web Mode ==========

  describe('Project Operations - Web Mode', () => {
    it('should get projects via API', async () => {
      const service = new PlatformServiceLogic(tauriService, apiService, cryptoService, false);
      apiService.getProjects.mockReturnValue(of([mockProject]));

      const projects = await service.getProjects();

      expect(apiService.getProjects).toHaveBeenCalled();
      expect(projects).toEqual([mockProject]);
    });

    it('should get single project via API', async () => {
      const service = new PlatformServiceLogic(tauriService, apiService, cryptoService, false);
      apiService.getProject.mockReturnValue(of(mockProject));

      const project = await service.getProject('proj-1');

      expect(apiService.getProject).toHaveBeenCalledWith('proj-1');
      expect(project).toEqual(mockProject);
    });

    it('should create project via API', async () => {
      const service = new PlatformServiceLogic(tauriService, apiService, cryptoService, false);
      apiService.createProject.mockReturnValue(of(mockProject));

      const project = await service.createProject('Test Project', 'Description');

      expect(apiService.createProject).toHaveBeenCalledWith('Test Project', 'Description');
      expect(project).toEqual(mockProject);
    });

    it('should update project via API', async () => {
      const service = new PlatformServiceLogic(tauriService, apiService, cryptoService, false);
      apiService.updateProject.mockReturnValue(of(mockProject));

      const project = await service.updateProject('proj-1', 'Updated', 'New Description');

      expect(apiService.updateProject).toHaveBeenCalledWith('proj-1', 'Updated', 'New Description');
      expect(project).toEqual(mockProject);
    });

    it('should delete project via API', async () => {
      const service = new PlatformServiceLogic(tauriService, apiService, cryptoService, false);
      apiService.deleteProject.mockReturnValue(of(undefined));

      await service.deleteProject('proj-1');

      expect(apiService.deleteProject).toHaveBeenCalledWith('proj-1');
    });

    it('should handle get projects errors', async () => {
      const service = new PlatformServiceLogic(tauriService, apiService, cryptoService, false);
      apiService.getProjects.mockReturnValue(throwError(() => new Error('Network error')));

      await expect(service.getProjects()).rejects.toThrow('Network error');
    });
  });

  // ========== Project Operations - Tauri Mode ==========

  describe('Project Operations - Tauri Mode', () => {
    it('should get projects via Tauri', async () => {
      const service = new PlatformServiceLogic(tauriService, apiService, cryptoService, true);
      tauriService.getProjects.mockResolvedValue([mockProject]);

      const projects = await service.getProjects();

      expect(tauriService.getProjects).toHaveBeenCalled();
      expect(projects).toEqual([mockProject]);
    });

    it('should create project via Tauri', async () => {
      const service = new PlatformServiceLogic(tauriService, apiService, cryptoService, true);
      tauriService.createProject.mockResolvedValue(mockProject);

      const project = await service.createProject('Test Project', 'Description');

      expect(tauriService.createProject).toHaveBeenCalledWith('Test Project', 'Description');
      expect(project).toEqual(mockProject);
    });
  });

  // ========== Environment Operations ==========

  describe('Environment Operations', () => {
    it('should get environments via API', async () => {
      const service = new PlatformServiceLogic(tauriService, apiService, cryptoService, false);
      apiService.getEnvironments.mockReturnValue(of([mockEnvironment]));

      const envs = await service.getEnvironments('proj-1');

      expect(apiService.getEnvironments).toHaveBeenCalledWith('proj-1');
      expect(envs).toEqual([mockEnvironment]);
    });

    it('should create environment via API', async () => {
      const service = new PlatformServiceLogic(tauriService, apiService, cryptoService, false);
      apiService.createEnvironment.mockReturnValue(of(mockEnvironment));

      const env = await service.createEnvironment('proj-1', 'Staging', 'Staging');

      expect(apiService.createEnvironment).toHaveBeenCalledWith('proj-1', 'Staging', 'Staging');
      expect(env).toEqual(mockEnvironment);
    });

    it('should delete environment via API', async () => {
      const service = new PlatformServiceLogic(tauriService, apiService, cryptoService, false);
      apiService.deleteEnvironment.mockReturnValue(of(undefined));

      await service.deleteEnvironment('proj-1', 'env-1');

      expect(apiService.deleteEnvironment).toHaveBeenCalledWith('proj-1', 'env-1');
    });

    it('should get environments via Tauri', async () => {
      const service = new PlatformServiceLogic(tauriService, apiService, cryptoService, true);
      tauriService.getEnvironments.mockResolvedValue([mockEnvironment]);

      const envs = await service.getEnvironments('proj-1');

      expect(tauriService.getEnvironments).toHaveBeenCalledWith('proj-1');
      expect(envs).toEqual([mockEnvironment]);
    });
  });

  // ========== Variable Operations ==========

  describe('Variable Operations', () => {
    it('should get variables and decrypt via API', async () => {
      const service = new PlatformServiceLogic(tauriService, apiService, cryptoService, false);
      cryptoService.encrypt.mockResolvedValue({ ciphertext: 'encrypted', nonce: 'nonce123' });
      cryptoService.decrypt.mockResolvedValue('decrypted-value');
      apiService.getVariables.mockReturnValue(of([mockVariable]));

      const vars = await service.getVariables('proj-1', 'env-1');

      expect(apiService.getVariables).toHaveBeenCalledWith('proj-1', 'env-1');
      expect(cryptoService.decrypt).toHaveBeenCalled();
    });

    it('should create variable with encryption via API', async () => {
      const service = new PlatformServiceLogic(tauriService, apiService, cryptoService, false);
      cryptoService.encrypt.mockResolvedValue({ ciphertext: 'encrypted', nonce: 'nonce123' });
      apiService.createVariable.mockReturnValue(of(mockVariable));

      const variable = await service.createVariable('proj-1', 'env-1', 'KEY', 'value', true);

      expect(cryptoService.encrypt).toHaveBeenCalledWith('value');
      expect(apiService.createVariable).toHaveBeenCalledWith('proj-1', 'env-1', 'KEY', 'encrypted', 'nonce123', true);
    });

    it('should update variable with encryption via API', async () => {
      const service = new PlatformServiceLogic(tauriService, apiService, cryptoService, false);
      cryptoService.encrypt.mockResolvedValue({ ciphertext: 'encrypted', nonce: 'nonce123' });
      apiService.updateVariable.mockReturnValue(of(mockVariable));

      const variable = await service.updateVariable('proj-1', 'env-1', 'var-1', 'KEY', 'new-value', true);

      expect(cryptoService.encrypt).toHaveBeenCalledWith('new-value');
      expect(apiService.updateVariable).toHaveBeenCalledWith('proj-1', 'env-1', 'var-1', 'KEY', 'encrypted', 'nonce123', true);
    });

    it('should delete variable via API', async () => {
      const service = new PlatformServiceLogic(tauriService, apiService, cryptoService, false);
      apiService.deleteVariable.mockReturnValue(of(undefined));

      await service.deleteVariable('proj-1', 'env-1', 'var-1');

      expect(apiService.deleteVariable).toHaveBeenCalledWith('proj-1', 'env-1', 'var-1');
    });

    it('should get variables via Tauri', async () => {
      const service = new PlatformServiceLogic(tauriService, apiService, cryptoService, true);
      tauriService.getVariables.mockResolvedValue([mockVariable]);

      const vars = await service.getVariables('proj-1', 'env-1');

      expect(tauriService.getVariables).toHaveBeenCalledWith('proj-1', 'env-1');
      expect(vars).toEqual([mockVariable]);
    });

    it('should create variable via Tauri', async () => {
      const service = new PlatformServiceLogic(tauriService, apiService, cryptoService, true);
      tauriService.createVariable.mockResolvedValue(mockVariable);

      const variable = await service.createVariable('proj-1', 'env-1', 'KEY', 'value', true);

      expect(tauriService.createVariable).toHaveBeenCalledWith('proj-1', 'env-1', 'KEY', 'value', true);
    });
  });

  // ========== Search Operations ==========

  describe('Search Operations', () => {
    it('should search variables via API', async () => {
      const service = new PlatformServiceLogic(tauriService, apiService, cryptoService, false);
      const mockResults: SearchResult[] = [];
      apiService.searchVariables.mockReturnValue(of(mockResults));

      const results = await service.searchVariables('API_KEY');

      expect(apiService.searchVariables).toHaveBeenCalledWith('API_KEY');
      expect(results).toEqual(mockResults);
    });

    it('should search variables via Tauri', async () => {
      const service = new PlatformServiceLogic(tauriService, apiService, cryptoService, true);
      const mockResults: SearchResult[] = [];
      tauriService.searchVariables.mockResolvedValue(mockResults);

      const results = await service.searchVariables('API_KEY');

      expect(tauriService.searchVariables).toHaveBeenCalledWith('API_KEY');
      expect(results).toEqual(mockResults);
    });
  });

  // ========== Sync Operations ==========

  describe('Sync Operations', () => {
    it('should get sync status via API', async () => {
      const service = new PlatformServiceLogic(tauriService, apiService, cryptoService, false);
      const mockStatus: SyncStatus = { state: 'Idle', pending_changes: 5 };
      apiService.getSyncStatus.mockReturnValue(of(mockStatus));

      const status = await service.getSyncStatus();

      expect(apiService.getSyncStatus).toHaveBeenCalled();
      expect(status).toEqual(mockStatus);
    });

    it('should sync now via API', async () => {
      const service = new PlatformServiceLogic(tauriService, apiService, cryptoService, false);
      const mockResult: SyncResult = { pushed: 3, pulled: 2, conflicts: 0, errors: [] };
      apiService.syncNow.mockReturnValue(of(mockResult));

      const result = await service.syncNow();

      expect(apiService.syncNow).toHaveBeenCalled();
      expect(result).toEqual(mockResult);
    });

    it('should sync now via Tauri', async () => {
      const service = new PlatformServiceLogic(tauriService, apiService, cryptoService, true);
      const mockResult: SyncResult = { pushed: 3, pulled: 2, conflicts: 0, errors: [] };
      tauriService.syncNow.mockResolvedValue(mockResult);

      const result = await service.syncNow();

      expect(tauriService.syncNow).toHaveBeenCalled();
      expect(result).toEqual(mockResult);
    });
  });

  // ========== Team Operations ==========

  describe('Team Operations', () => {
    it('should get teams via API', async () => {
      const service = new PlatformServiceLogic(tauriService, apiService, cryptoService, false);
      apiService.getTeams.mockReturnValue(of([mockTeam]));

      const teams = await service.getTeams();

      expect(apiService.getTeams).toHaveBeenCalled();
      expect(teams).toEqual([mockTeam]);
    });

    it('should get teams via Tauri', async () => {
      const service = new PlatformServiceLogic(tauriService, apiService, cryptoService, true);
      tauriService.getTeams.mockResolvedValue([mockTeam]);

      const teams = await service.getTeams();

      expect(tauriService.getTeams).toHaveBeenCalled();
      expect(teams).toEqual([mockTeam]);
    });

    it('should create team via API', async () => {
      const service = new PlatformServiceLogic(tauriService, apiService, cryptoService, false);
      apiService.createTeam.mockReturnValue(of(mockTeam));

      const team = await service.createTeam('Test Team', 'Description', 2, 3);

      expect(apiService.createTeam).toHaveBeenCalledWith('Test Team', 'Description', 2, 3);
      expect(team).toEqual(mockTeam);
    });

    it('should create team via Tauri', async () => {
      const service = new PlatformServiceLogic(tauriService, apiService, cryptoService, true);
      tauriService.createTeam.mockResolvedValue(mockTeam);

      const team = await service.createTeam('Test Team', 'Description', 2, 3);

      expect(tauriService.createTeam).toHaveBeenCalledWith('Test Team', 'Description', 2, 3);
      expect(team).toEqual(mockTeam);
    });
  });

  // ========== Audit Log Operations ==========

  describe('Audit Log Operations', () => {
    it('should get team audit log via API', async () => {
      const service = new PlatformServiceLogic(tauriService, apiService, cryptoService, false);
      const mockEvents: AuditEvent[] = [];
      apiService.getTeamAuditLog.mockReturnValue(of({ entries: mockEvents, total: 0 }));

      const events = await service.getTeamAuditLog('team-1', 100);

      expect(apiService.getTeamAuditLog).toHaveBeenCalledWith('team-1', 100);
      expect(events).toEqual(mockEvents);
    });

    it('should get team audit log via Tauri', async () => {
      const service = new PlatformServiceLogic(tauriService, apiService, cryptoService, true);
      const mockEvents: AuditEvent[] = [];
      tauriService.getTeamAuditLog.mockResolvedValue(mockEvents);

      const events = await service.getTeamAuditLog('team-1', 100);

      expect(tauriService.getTeamAuditLog).toHaveBeenCalledWith('team-1', 100);
      expect(events).toEqual(mockEvents);
    });
  });

  // ========== Error Handling ==========

  describe('Error Handling', () => {
    it('should handle API errors gracefully', async () => {
      const service = new PlatformServiceLogic(tauriService, apiService, cryptoService, false);
      apiService.getProjects.mockReturnValue(throwError(() => new Error('Network error')));

      await expect(service.getProjects()).rejects.toThrow('Network error');
    });

    it('should handle Tauri errors gracefully', async () => {
      const service = new PlatformServiceLogic(tauriService, apiService, cryptoService, true);
      tauriService.getProjects.mockRejectedValue(new Error('Tauri error'));

      await expect(service.getProjects()).rejects.toThrow('Tauri error');
    });

    it('should handle encryption errors', async () => {
      const service = new PlatformServiceLogic(tauriService, apiService, cryptoService, false);
      cryptoService.encrypt.mockRejectedValue(new Error('Encryption failed'));

      await expect(service.createVariable('proj-1', 'env-1', 'KEY', 'value', true)).rejects.toThrow('Encryption failed');
    });

    it('should handle decryption errors', async () => {
      const service = new PlatformServiceLogic(tauriService, apiService, cryptoService, false);
      apiService.getVariables.mockReturnValue(of([mockVariable]));
      cryptoService.decrypt.mockRejectedValue(new Error('Decryption failed'));

      await expect(service.getVariables('proj-1', 'env-1')).rejects.toThrow('Decryption failed');
    });
  });

  // ========== Observable Behavior ==========

  describe('Observable Behavior', () => {
    it('should convert Observable to Promise for get operations', async () => {
      const service = new PlatformServiceLogic(tauriService, apiService, cryptoService, false);
      apiService.getProjects.mockReturnValue(of([mockProject]));

      const projects = await service.getProjects();

      expect(Array.isArray(projects)).toBe(true);
      expect(projects).toEqual([mockProject]);
    });

    it('should handle Observable errors properly', async () => {
      const service = new PlatformServiceLogic(tauriService, apiService, cryptoService, false);
      const error = new Error('Network error');
      apiService.getProjects.mockReturnValue(throwError(() => error));

      await expect(service.getProjects()).rejects.toThrow('Network error');
    });

    it('should complete delete operations successfully', async () => {
      const service = new PlatformServiceLogic(tauriService, apiService, cryptoService, false);
      apiService.deleteProject.mockReturnValue(of(undefined));

      await expect(service.deleteProject('proj-1')).resolves.toBeUndefined();
    });
  });
});
