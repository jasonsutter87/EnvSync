import { TestBed, fakeAsync, tick } from '@angular/core/testing';
import { VaultStore } from './vault.store';
import { TauriService } from './tauri.service';
import { Project, Environment, Variable, VaultStatus, SearchResult } from '../models';

describe.skip('VaultStore', () => {
  let store: VaultStore;
  let mockTauriService: {
    getVaultStatus: ReturnType<typeof vi.fn>;
    initializeVault: ReturnType<typeof vi.fn>;
    unlockVault: ReturnType<typeof vi.fn>;
    lockVault: ReturnType<typeof vi.fn>;
    getProjects: ReturnType<typeof vi.fn>;
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
    exportEnvFile: ReturnType<typeof vi.fn>;
    importEnvFile: ReturnType<typeof vi.fn>;
    checkAutoLock: ReturnType<typeof vi.fn>;
    touchActivity: ReturnType<typeof vi.fn>;
  };

  const mockProject: Project = {
    id: 'proj-1',
    name: 'Test Project',
    description: 'A test project',
    created_at: '2024-01-01T00:00:00Z',
    updated_at: '2024-01-01T00:00:00Z',
  };

  const mockEnvironment: Environment = {
    id: 'env-1',
    project_id: 'proj-1',
    name: 'development',
    env_type: 'Development',
    created_at: '2024-01-01T00:00:00Z',
    updated_at: '2024-01-01T00:00:00Z',
  };

  const mockVariable: Variable = {
    id: 'var-1',
    environment_id: 'env-1',
    key: 'API_KEY',
    value: 'secret123',
    is_secret: true,
    created_at: '2024-01-01T00:00:00Z',
    updated_at: '2024-01-01T00:00:00Z',
  };

  beforeEach(() => {
    mockTauriService = {
      getVaultStatus: vi.fn(),
      initializeVault: vi.fn(),
      unlockVault: vi.fn(),
      lockVault: vi.fn(),
      getProjects: vi.fn(),
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
      exportEnvFile: vi.fn(),
      importEnvFile: vi.fn(),
      checkAutoLock: vi.fn(),
      touchActivity: vi.fn(),
    };

    TestBed.configureTestingModule({
      providers: [
        VaultStore,
        { provide: TauriService, useValue: mockTauriService },
      ],
    });

    store = TestBed.inject(VaultStore);
  });

  afterEach(() => {
    if (store && typeof store.stopAutoLockCheck === 'function') {
      store.stopAutoLockCheck();
    }
  });

  describe('Initial State', () => {
    it('should be created', () => {
      expect(store).toBeTruthy();
    });

    it('should have uninitialized status', () => {
      expect(store.status().is_initialized).toBe(false);
      expect(store.status().is_unlocked).toBe(false);
    });

    it('should have empty projects', () => {
      expect(store.projects()).toEqual([]);
    });

    it('should have no selected project', () => {
      expect(store.selectedProjectId()).toBeNull();
      expect(store.selectedProject()).toBeNull();
    });

    it('should have empty environments', () => {
      expect(store.environments()).toEqual([]);
    });

    it('should have no selected environment', () => {
      expect(store.selectedEnvironmentId()).toBeNull();
      expect(store.selectedEnvironment()).toBeNull();
    });

    it('should have empty variables', () => {
      expect(store.variables()).toEqual([]);
    });

    it('should have empty search results', () => {
      expect(store.searchResults()).toEqual([]);
    });

    it('should not be loading', () => {
      expect(store.isLoading()).toBe(false);
    });

    it('should have no error', () => {
      expect(store.error()).toBeNull();
    });
  });

  describe('Computed Values', () => {
    it('should compute isInitialized from status', async () => {
      mockTauriService.getVaultStatus.mockResolvedValue({
        is_initialized: true,
        is_unlocked: false,
      });

      await store.checkStatus();

      expect(store.isInitialized()).toBe(true);
    });

    it('should compute isUnlocked from status', async () => {
      mockTauriService.getVaultStatus.mockResolvedValue({
        is_initialized: true,
        is_unlocked: true,
      });

      await store.checkStatus();

      expect(store.isUnlocked()).toBe(true);
    });
  });

  describe('Vault Operations', () => {
    describe('checkStatus', () => {
      it('should update status from Tauri', async () => {
        mockTauriService.getVaultStatus.mockResolvedValue({
          is_initialized: true,
          is_unlocked: true,
        });

        await store.checkStatus();

        expect(store.status().is_initialized).toBe(true);
        expect(store.status().is_unlocked).toBe(true);
      });

      it('should handle errors', async () => {
        mockTauriService.getVaultStatus.mockRejectedValue(new Error('Failed'));

        await store.checkStatus();

        expect(store.error()).toBe('Failed');
      });
    });

    describe('initialize', () => {
      it('should initialize vault with password', async () => {
        mockTauriService.initializeVault.mockResolvedValue(undefined);
        mockTauriService.getVaultStatus.mockResolvedValue({
          is_initialized: true,
          is_unlocked: true,
        });

        const result = await store.initialize('password123');

        expect(result).toBe(true);
        expect(mockTauriService.initializeVault).toHaveBeenCalledWith('password123');
      });

      it('should set loading during initialization', async () => {
        let loadingDuringCall = false;
        mockTauriService.initializeVault.mockImplementation(async () => {
          loadingDuringCall = store.isLoading();
        });
        mockTauriService.getVaultStatus.mockResolvedValue({
          is_initialized: true,
          is_unlocked: true,
        });

        await store.initialize('password');

        expect(loadingDuringCall).toBe(true);
        expect(store.isLoading()).toBe(false);
      });

      it('should return false on failure', async () => {
        mockTauriService.initializeVault.mockRejectedValue(new Error('Init failed'));

        const result = await store.initialize('password');

        expect(result).toBe(false);
        expect(store.error()).toBe('Init failed');
      });
    });

    describe('unlock', () => {
      it('should unlock vault and load projects', async () => {
        mockTauriService.unlockVault.mockResolvedValue(undefined);
        mockTauriService.getVaultStatus.mockResolvedValue({
          is_initialized: true,
          is_unlocked: true,
        });
        mockTauriService.getProjects.mockResolvedValue([mockProject]);

        const result = await store.unlock('password123');

        expect(result).toBe(true);
        expect(mockTauriService.unlockVault).toHaveBeenCalledWith('password123');
        expect(store.projects().length).toBe(1);
      });

      it('should return false on failure', async () => {
        mockTauriService.unlockVault.mockRejectedValue(new Error('Wrong password'));

        const result = await store.unlock('wrong');

        expect(result).toBe(false);
        expect(store.error()).toBe('Wrong password');
      });
    });

    describe('lock', () => {
      it('should lock vault and clear state', async () => {
        mockTauriService.lockVault.mockResolvedValue(undefined);

        await store.lock();

        expect(mockTauriService.lockVault).toHaveBeenCalled();
        expect(store.status().is_unlocked).toBe(false);
        expect(store.projects()).toEqual([]);
      });
    });
  });

  describe('Project Operations', () => {
    describe('loadProjects', () => {
      it('should load projects from Tauri', async () => {
        mockTauriService.getProjects.mockResolvedValue([mockProject]);

        await store.loadProjects();

        expect(store.projects().length).toBe(1);
        expect(store.projects()[0].name).toBe('Test Project');
      });
    });

    describe('createProject', () => {
      it('should create project and add to state', async () => {
        mockTauriService.createProject.mockResolvedValue(mockProject);

        const result = await store.createProject('Test Project', 'Description');

        expect(result).toEqual(mockProject);
        expect(store.projects()).toContain(mockProject);
      });

      it('should return null on failure', async () => {
        mockTauriService.createProject.mockRejectedValue(new Error('Create failed'));

        const result = await store.createProject('Test', 'Desc');

        expect(result).toBeNull();
      });
    });

    describe('updateProject', () => {
      it('should update project in state', async () => {
        mockTauriService.getProjects.mockResolvedValue([mockProject]);
        await store.loadProjects();

        const updatedProject = { ...mockProject, name: 'Updated Name' };
        mockTauriService.updateProject.mockResolvedValue(updatedProject);

        const result = await store.updateProject('proj-1', 'Updated Name', 'New desc');

        expect(result).toBe(true);
        expect(store.projects()[0].name).toBe('Updated Name');
      });
    });

    describe('deleteProject', () => {
      it('should remove project from state', async () => {
        mockTauriService.getProjects.mockResolvedValue([mockProject]);
        await store.loadProjects();

        mockTauriService.deleteProject.mockResolvedValue(undefined);

        const result = await store.deleteProject('proj-1');

        expect(result).toBe(true);
        expect(store.projects().length).toBe(0);
      });

      it('should clear selection if deleted project was selected', async () => {
        mockTauriService.getProjects.mockResolvedValue([mockProject]);
        mockTauriService.getEnvironments.mockResolvedValue([mockEnvironment]);
        mockTauriService.getVariables.mockResolvedValue([mockVariable]);
        await store.loadProjects();
        await store.selectProject('proj-1');

        mockTauriService.deleteProject.mockResolvedValue(undefined);
        await store.deleteProject('proj-1');

        expect(store.selectedProjectId()).toBeNull();
        expect(store.environments()).toEqual([]);
        expect(store.variables()).toEqual([]);
      });
    });

    describe('selectProject', () => {
      it('should select project and load environments', async () => {
        mockTauriService.getEnvironments.mockResolvedValue([mockEnvironment]);
        mockTauriService.getVariables.mockResolvedValue([mockVariable]);

        await store.selectProject('proj-1');

        expect(store.selectedProjectId()).toBe('proj-1');
        expect(store.environments().length).toBe(1);
      });
    });
  });

  describe('Environment Operations', () => {
    describe('loadEnvironments', () => {
      it('should auto-select first environment', async () => {
        mockTauriService.getEnvironments.mockResolvedValue([mockEnvironment]);
        mockTauriService.getVariables.mockResolvedValue([mockVariable]);

        await store.loadEnvironments('proj-1');

        expect(store.selectedEnvironmentId()).toBe('env-1');
      });

      it('should handle empty environments', async () => {
        mockTauriService.getEnvironments.mockResolvedValue([]);

        await store.loadEnvironments('proj-1');

        expect(store.selectedEnvironmentId()).toBeNull();
        expect(store.variables()).toEqual([]);
      });
    });

    describe('createEnvironment', () => {
      it('should create environment and add to state', async () => {
        mockTauriService.createEnvironment.mockResolvedValue(mockEnvironment);

        const result = await store.createEnvironment('proj-1', 'development', 'Development');

        expect(result).toEqual(mockEnvironment);
        expect(store.environments()).toContain(mockEnvironment);
      });
    });

    describe('deleteEnvironment', () => {
      it('should remove environment and select next one', async () => {
        const env2 = { ...mockEnvironment, id: 'env-2', name: 'staging' };
        mockTauriService.getEnvironments.mockResolvedValue([mockEnvironment, env2]);
        mockTauriService.getVariables.mockResolvedValue([]);
        await store.loadEnvironments('proj-1');

        mockTauriService.deleteEnvironment.mockResolvedValue(undefined);
        await store.deleteEnvironment('env-1');

        expect(store.environments().length).toBe(1);
        expect(store.selectedEnvironmentId()).toBe('env-2');
      });
    });
  });

  describe('Variable Operations', () => {
    describe('loadVariables', () => {
      it('should load variables for environment', async () => {
        mockTauriService.getVariables.mockResolvedValue([mockVariable]);

        await store.loadVariables('env-1');

        expect(store.variables().length).toBe(1);
      });
    });

    describe('createVariable', () => {
      it('should create variable and add to state', async () => {
        mockTauriService.createVariable.mockResolvedValue(mockVariable);

        const result = await store.createVariable('env-1', 'API_KEY', 'secret', true);

        expect(result).toEqual(mockVariable);
        expect(store.variables()).toContain(mockVariable);
      });
    });

    describe('updateVariable', () => {
      it('should update variable in state', async () => {
        mockTauriService.getVariables.mockResolvedValue([mockVariable]);
        await store.loadVariables('env-1');

        const updated = { ...mockVariable, value: 'newsecret' };
        mockTauriService.updateVariable.mockResolvedValue(updated);

        const result = await store.updateVariable('var-1', 'API_KEY', 'newsecret', true);

        expect(result).toBe(true);
        expect(store.variables()[0].value).toBe('newsecret');
      });
    });

    describe('deleteVariable', () => {
      it('should remove variable from state', async () => {
        mockTauriService.getVariables.mockResolvedValue([mockVariable]);
        await store.loadVariables('env-1');

        mockTauriService.deleteVariable.mockResolvedValue(undefined);
        const result = await store.deleteVariable('var-1');

        expect(result).toBe(true);
        expect(store.variables().length).toBe(0);
      });
    });
  });

  describe('Search Operations', () => {
    describe('search', () => {
      it('should search variables', async () => {
        const searchResult: SearchResult = {
          variable: mockVariable,
          project_name: 'Test Project',
          environment_name: 'development',
        };
        mockTauriService.searchVariables.mockResolvedValue([searchResult]);

        await store.search('API');

        expect(store.searchResults().length).toBe(1);
      });

      it('should clear results for empty query', async () => {
        await store.search('');

        expect(store.searchResults()).toEqual([]);
        expect(mockTauriService.searchVariables).not.toHaveBeenCalled();
      });

      it('should clear results for whitespace query', async () => {
        await store.search('   ');

        expect(store.searchResults()).toEqual([]);
      });
    });

    describe('clearSearch', () => {
      it('should clear search results', async () => {
        const searchResult: SearchResult = {
          variable: mockVariable,
          project_name: 'Test Project',
          environment_name: 'development',
        };
        mockTauriService.searchVariables.mockResolvedValue([searchResult]);
        await store.search('API');

        store.clearSearch();

        expect(store.searchResults()).toEqual([]);
      });
    });
  });

  describe('Import/Export Operations', () => {
    describe('exportToEnvFile', () => {
      it('should export environment to env file format', async () => {
        mockTauriService.exportEnvFile.mockResolvedValue('API_KEY=secret123');

        const result = await store.exportToEnvFile('env-1');

        expect(result).toBe('API_KEY=secret123');
      });

      it('should return null on failure', async () => {
        mockTauriService.exportEnvFile.mockRejectedValue(new Error('Export failed'));

        const result = await store.exportToEnvFile('env-1');

        expect(result).toBeNull();
      });
    });

    describe('importFromEnvFile', () => {
      it('should import variables from env file content', async () => {
        mockTauriService.importEnvFile.mockResolvedValue([mockVariable]);

        const result = await store.importFromEnvFile('env-1', 'API_KEY=secret');

        expect(result).toBe(true);
        expect(store.variables()).toContain(mockVariable);
      });

      it('should return false on failure', async () => {
        mockTauriService.importEnvFile.mockRejectedValue(new Error('Import failed'));

        const result = await store.importFromEnvFile('env-1', 'content');

        expect(result).toBe(false);
      });
    });
  });

  describe('Auto-Lock', () => {
    it('should start auto-lock check', fakeAsync(() => {
      mockTauriService.checkAutoLock.mockResolvedValue(false);

      store.startAutoLockCheck();
      tick(30000);

      expect(mockTauriService.checkAutoLock).toHaveBeenCalled();
      store.stopAutoLockCheck();
    }));

    it('should not start duplicate auto-lock check', () => {
      store.startAutoLockCheck();
      store.startAutoLockCheck();

      store.stopAutoLockCheck();
    });

    it('should clear state when auto-locked', fakeAsync(async () => {
      mockTauriService.getProjects.mockResolvedValue([mockProject]);
      await store.loadProjects();

      mockTauriService.checkAutoLock.mockResolvedValue(true);
      mockTauriService.getVaultStatus.mockResolvedValue({
        is_initialized: true,
        is_unlocked: false,
      });

      store.startAutoLockCheck();
      tick(30000);

      expect(store.projects()).toEqual([]);
      store.stopAutoLockCheck();
    }));

    it('should touch activity', async () => {
      mockTauriService.touchActivity.mockResolvedValue(undefined);

      await store.touchActivity();

      expect(mockTauriService.touchActivity).toHaveBeenCalled();
    });

    it('should ignore activity touch errors', async () => {
      mockTauriService.touchActivity.mockRejectedValue(new Error('Touch failed'));

      await store.touchActivity();
      // Should not throw
    });
  });

  describe('Error Handling', () => {
    it('should clear error', async () => {
      mockTauriService.getVaultStatus.mockRejectedValue(new Error('Error'));
      await store.checkStatus();

      expect(store.error()).toBe('Error');

      store.clearError();

      expect(store.error()).toBeNull();
    });

    it('should handle non-Error objects', async () => {
      mockTauriService.getVaultStatus.mockRejectedValue('String error');
      await store.checkStatus();

      expect(store.error()).toBe('String error');
    });
  });

  describe('Computed Selectors', () => {
    it('should compute selectedProject from projects', async () => {
      mockTauriService.getProjects.mockResolvedValue([mockProject]);
      mockTauriService.getEnvironments.mockResolvedValue([]);
      await store.loadProjects();
      await store.selectProject('proj-1');

      expect(store.selectedProject()).toEqual(mockProject);
    });

    it('should return null for selectedProject when not found', async () => {
      mockTauriService.getProjects.mockResolvedValue([]);
      await store.loadProjects();

      expect(store.selectedProject()).toBeNull();
    });

    it('should compute selectedEnvironment from environments', async () => {
      mockTauriService.getEnvironments.mockResolvedValue([mockEnvironment]);
      mockTauriService.getVariables.mockResolvedValue([]);
      await store.loadEnvironments('proj-1');

      expect(store.selectedEnvironment()).toEqual(mockEnvironment);
    });
  });
});
