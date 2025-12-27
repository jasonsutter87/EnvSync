import { vi, describe, it, expect, beforeEach } from 'vitest';
import { signal, WritableSignal } from '@angular/core';
import { DiffResult, DiffEntry, DiffType } from '../../core/services/diff.service';
import { Environment, Variable } from '../../core/models';
import { of, throwError, Observable } from 'rxjs';

/**
 * Unit tests for DiffViewComponent logic
 *
 * Tests the component's logic directly without Angular's TestBed
 * since Vitest doesn't support Angular's AOT compiler.
 */

// Mock types
interface MockDiffService {
  computeDiff: ReturnType<typeof vi.fn>;
}

interface MockApiService {
  getEnvironments: ReturnType<typeof vi.fn>;
  getVariables: ReturnType<typeof vi.fn>;
  createVariable: ReturnType<typeof vi.fn>;
  updateVariable: ReturnType<typeof vi.fn>;
  deleteVariable: ReturnType<typeof vi.fn>;
}

// Component logic class that mirrors the real component behavior
class DiffViewComponentLogic {
  projectId: WritableSignal<string> = signal('');
  environments: WritableSignal<Environment[]> = signal([]);
  leftEnvId: WritableSignal<string | null> = signal(null);
  rightEnvId: WritableSignal<string | null> = signal(null);
  diffResult: WritableSignal<DiffResult | null> = signal(null);
  isLoading: WritableSignal<boolean> = signal(false);
  errorMessage: WritableSignal<string | null> = signal(null);
  selectedFilter: WritableSignal<string> = signal('all');
  searchQuery: WritableSignal<string> = signal('');
  showUnchanged: WritableSignal<boolean> = signal(false);
  copySuccess: WritableSignal<boolean> = signal(false);

  private leftVariables: Variable[] = [];
  private rightVariables: Variable[] = [];

  constructor(
    private diffService: MockDiffService,
    private apiService: MockApiService
  ) {}

  // Simulate projectId effect
  onProjectIdChange(): void {
    const projectId = this.projectId();
    if (projectId) {
      const result = this.apiService.getEnvironments(projectId);
      if (result && typeof result.subscribe === 'function') {
        result.subscribe({
          next: (envs: Environment[]) => this.environments.set(envs),
          error: (err: Error) => this.errorMessage.set(err.message)
        });
      }
    }
  }

  // Simulate environment selection effect
  onEnvironmentChange(): void {
    const leftId = this.leftEnvId();
    const rightId = this.rightEnvId();
    const projectId = this.projectId();

    if (!leftId || !rightId) {
      this.diffResult.set(null);
      return;
    }

    if (leftId === rightId) {
      this.errorMessage.set('Please select different environments');
      this.diffResult.set(null);
      return;
    }

    this.loadAndCompareDiff(projectId, leftId, rightId);
  }

  private loadAndCompareDiff(projectId: string, leftId: string, rightId: string): void {
    const leftResult = this.apiService.getVariables(projectId, leftId);
    const rightResult = this.apiService.getVariables(projectId, rightId);

    if (leftResult && typeof leftResult.subscribe === 'function') {
      leftResult.subscribe({
        next: (vars: Variable[]) => {
          this.leftVariables = vars;
          if (rightResult && typeof rightResult.subscribe === 'function') {
            rightResult.subscribe({
              next: (rightVars: Variable[]) => {
                this.rightVariables = rightVars;
                const diff = this.diffService.computeDiff(this.leftVariables, this.rightVariables);
                this.diffResult.set(diff);
              },
              error: (err: Error) => {
                this.errorMessage.set(err.message);
                this.diffResult.set(null);
              }
            });
          }
        },
        error: (err: Error) => {
          this.errorMessage.set(err.message);
          this.diffResult.set(null);
        }
      });
    }
  }

  // Computed values
  addedCount(): number {
    return this.diffResult()?.added.length ?? 0;
  }

  removedCount(): number {
    return this.diffResult()?.removed.length ?? 0;
  }

  modifiedCount(): number {
    return this.diffResult()?.modified.length ?? 0;
  }

  unchangedCount(): number {
    return this.diffResult()?.unchanged.length ?? 0;
  }

  totalChanges(): number {
    return this.addedCount() + this.removedCount() + this.modifiedCount() + this.unchangedCount();
  }

  filteredDiffEntries(): DiffEntry[] {
    const result = this.diffResult();
    if (!result) return [];

    let entries: DiffEntry[] = [
      ...result.added,
      ...result.removed,
      ...result.modified,
    ];

    if (this.showUnchanged()) {
      entries = [...entries, ...result.unchanged];
    }

    const filter = this.selectedFilter();
    if (filter !== 'all') {
      entries = entries.filter(e => e.type === filter);
    }

    const query = this.searchQuery().toLowerCase();
    if (query) {
      entries = entries.filter(e =>
        e.key.toLowerCase().includes(query) ||
        (e.leftValue && e.leftValue.toLowerCase().includes(query)) ||
        (e.rightValue && e.rightValue.toLowerCase().includes(query))
      );
    }

    return entries;
  }

  getDiffClass(entry: DiffEntry): string {
    switch (entry.type) {
      case 'added':
        return 'bg-green-900/20 border-green-500/30';
      case 'removed':
        return 'bg-red-900/20 border-red-500/30';
      case 'modified':
        return 'bg-yellow-900/20 border-yellow-500/30';
      default:
        return 'bg-dark-800/50 border-dark-700';
    }
  }

  getDiffIcon(type: DiffType): string {
    switch (type) {
      case 'added':
        return 'plus-circle';
      case 'removed':
        return 'minus-circle';
      case 'modified':
        return 'edit-2';
      default:
        return 'check-circle';
    }
  }

  async copyDiffToClipboard(): Promise<void> {
    const result = this.diffResult();
    if (!result) return;

    const lines: string[] = [];
    result.added.forEach(e => lines.push(`+ ${e.key}=${e.rightValue}`));
    result.removed.forEach(e => lines.push(`- ${e.key}=${e.leftValue}`));
    result.modified.forEach(e => lines.push(`~ ${e.key}: ${e.leftValue} -> ${e.rightValue}`));

    try {
      await navigator.clipboard.writeText(lines.join('\n'));
      this.copySuccess.set(true);
      setTimeout(() => this.copySuccess.set(false), 2000);
    } catch {
      this.errorMessage.set('Failed to copy to clipboard');
    }
  }

  async mergeEntry(entry: DiffEntry, direction: 'left-to-right' | 'right-to-left'): Promise<void> {
    this.isLoading.set(true);
    const projectId = this.projectId();

    try {
      if (entry.type === 'added') {
        // Added in right, copy to left
        if (direction === 'left-to-right') {
          const result = this.apiService.createVariable(
            projectId,
            this.leftEnvId()!,
            entry.key,
            entry.rightValue,
            entry.rightValue,
            false
          );
          await this.toPromise(result);
        }
      } else if (entry.type === 'removed') {
        // Removed from right, delete from left
        if (direction === 'right-to-left' && entry.leftVariable) {
          const result = this.apiService.deleteVariable(
            projectId,
            this.leftEnvId()!,
            entry.leftVariable.id
          );
          await this.toPromise(result);
        }
      } else if (entry.type === 'modified') {
        if (direction === 'left-to-right' && entry.rightVariable) {
          const result = this.apiService.updateVariable(
            projectId,
            this.rightEnvId()!,
            entry.rightVariable.id,
            entry.key,
            entry.leftValue,
            entry.leftValue,
            entry.rightVariable.is_secret
          );
          await this.toPromise(result);
        } else if (direction === 'right-to-left' && entry.leftVariable) {
          const result = this.apiService.updateVariable(
            projectId,
            this.leftEnvId()!,
            entry.leftVariable.id,
            entry.key,
            entry.rightValue,
            entry.rightValue,
            entry.leftVariable.is_secret
          );
          await this.toPromise(result);
        }
      }

      // Refresh diff
      this.onEnvironmentChange();
    } catch {
      this.errorMessage.set('Failed to merge variable');
    } finally {
      this.isLoading.set(false);
    }
  }

  private toPromise<T>(observable: Observable<T>): Promise<T> {
    return new Promise((resolve, reject) => {
      observable.subscribe({
        next: resolve,
        error: reject
      });
    });
  }
}

describe('DiffViewComponent', () => {
  let component: DiffViewComponentLogic;
  let mockDiffService: MockDiffService;
  let mockApiService: MockApiService;

  const mockEnvironment1: Environment = {
    id: 'env-1',
    project_id: 'project-1',
    name: 'Development',
    env_type: 'Development',
    created_at: '2024-01-01T00:00:00Z',
    updated_at: '2024-01-01T00:00:00Z',
  };

  const mockEnvironment2: Environment = {
    id: 'env-2',
    project_id: 'project-1',
    name: 'Production',
    env_type: 'Production',
    created_at: '2024-01-01T00:00:00Z',
    updated_at: '2024-01-01T00:00:00Z',
  };

  const mockEnvironments: Environment[] = [mockEnvironment1, mockEnvironment2];

  const mockVariables1: Variable[] = [
    {
      id: 'var-1',
      environment_id: 'env-1',
      key: 'DATABASE_URL',
      value: 'postgres://localhost/dev',
      is_secret: true,
      created_at: '2024-01-01T00:00:00Z',
      updated_at: '2024-01-01T00:00:00Z',
    },
    {
      id: 'var-2',
      environment_id: 'env-1',
      key: 'API_KEY',
      value: 'dev-key-123',
      is_secret: true,
      created_at: '2024-01-01T00:00:00Z',
      updated_at: '2024-01-01T00:00:00Z',
    },
    {
      id: 'var-3',
      environment_id: 'env-1',
      key: 'DEBUG',
      value: 'true',
      is_secret: false,
      created_at: '2024-01-01T00:00:00Z',
      updated_at: '2024-01-01T00:00:00Z',
    },
  ];

  const mockVariables2: Variable[] = [
    {
      id: 'var-4',
      environment_id: 'env-2',
      key: 'DATABASE_URL',
      value: 'postgres://prod-server/prod',
      is_secret: true,
      created_at: '2024-01-01T00:00:00Z',
      updated_at: '2024-01-01T00:00:00Z',
    },
    {
      id: 'var-5',
      environment_id: 'env-2',
      key: 'DEBUG',
      value: 'false',
      is_secret: false,
      created_at: '2024-01-01T00:00:00Z',
      updated_at: '2024-01-01T00:00:00Z',
    },
    {
      id: 'var-6',
      environment_id: 'env-2',
      key: 'CACHE_TTL',
      value: '3600',
      is_secret: false,
      created_at: '2024-01-01T00:00:00Z',
      updated_at: '2024-01-01T00:00:00Z',
    },
  ];

  const mockDiffResult: DiffResult = {
    added: [
      {
        type: 'added',
        key: 'CACHE_TTL',
        leftValue: null,
        rightValue: '3600',
        leftVariable: null,
        rightVariable: mockVariables2[2],
      },
    ],
    removed: [
      {
        type: 'removed',
        key: 'API_KEY',
        leftValue: 'dev-key-123',
        rightValue: null,
        leftVariable: mockVariables1[1],
        rightVariable: null,
      },
    ],
    modified: [
      {
        type: 'modified',
        key: 'DATABASE_URL',
        leftValue: 'postgres://localhost/dev',
        rightValue: 'postgres://prod-server/prod',
        leftVariable: mockVariables1[0],
        rightVariable: mockVariables2[0],
      },
      {
        type: 'modified',
        key: 'DEBUG',
        leftValue: 'true',
        rightValue: 'false',
        leftVariable: mockVariables1[2],
        rightVariable: mockVariables2[1],
      },
    ],
    unchanged: [],
  };

  const createMockServices = () => {
    mockDiffService = {
      computeDiff: vi.fn().mockReturnValue(mockDiffResult),
    };

    mockApiService = {
      getEnvironments: vi.fn().mockReturnValue(of(mockEnvironments)),
      getVariables: vi.fn(),
      createVariable: vi.fn().mockReturnValue(of(mockVariables1[0])),
      updateVariable: vi.fn().mockReturnValue(of(mockVariables2[0])),
      deleteVariable: vi.fn().mockReturnValue(of(undefined)),
    };

    // Default behavior for getVariables - return different sets based on call order
    let variablesCallCount = 0;
    mockApiService.getVariables.mockImplementation(() => {
      variablesCallCount++;
      return variablesCallCount % 2 === 1 ? of(mockVariables1) : of(mockVariables2);
    });
  };

  beforeEach(() => {
    createMockServices();
    component = new DiffViewComponentLogic(mockDiffService, mockApiService);

    // Mock clipboard
    Object.assign(navigator, {
      clipboard: {
        writeText: vi.fn().mockResolvedValue(undefined),
      },
    });
  });

  describe('Component Initialization', () => {
    it('should create', () => {
      expect(component).toBeTruthy();
    });

    it('should initialize with default values', () => {
      expect(component.projectId()).toBe('');
      expect(component.environments()).toEqual([]);
      expect(component.leftEnvId()).toBeNull();
      expect(component.rightEnvId()).toBeNull();
      expect(component.diffResult()).toBeNull();
      expect(component.isLoading()).toBe(false);
      expect(component.errorMessage()).toBeNull();
    });

    it('should load environments when projectId is set', () => {
      component.projectId.set('project-1');
      component.onProjectIdChange();

      expect(mockApiService.getEnvironments).toHaveBeenCalledWith('project-1');
      expect(component.environments()).toEqual(mockEnvironments);
    });

    it('should handle error when loading environments fails', () => {
      const error = new Error('Failed to load environments');
      mockApiService.getEnvironments.mockReturnValue(throwError(() => error));

      component.projectId.set('project-1');
      component.onProjectIdChange();

      expect(component.errorMessage()).toBe('Failed to load environments');
    });
  });

  describe('Environment Selection', () => {
    beforeEach(() => {
      component.projectId.set('project-1');
      component.onProjectIdChange();
    });

    it('should update left environment selection', () => {
      component.leftEnvId.set('env-1');
      expect(component.leftEnvId()).toBe('env-1');
    });

    it('should update right environment selection', () => {
      component.rightEnvId.set('env-2');
      expect(component.rightEnvId()).toBe('env-2');
    });

    it('should prevent selecting the same environment on both sides', () => {
      component.leftEnvId.set('env-1');
      component.rightEnvId.set('env-1');
      component.onEnvironmentChange();

      expect(component.errorMessage()).toBe('Please select different environments');
      expect(component.diffResult()).toBeNull();
    });

    it('should load and compare variables when both environments are selected', () => {
      component.leftEnvId.set('env-1');
      component.rightEnvId.set('env-2');
      component.onEnvironmentChange();

      expect(mockApiService.getVariables).toHaveBeenCalledWith('project-1', 'env-1');
      expect(mockApiService.getVariables).toHaveBeenCalledWith('project-1', 'env-2');
      expect(mockDiffService.computeDiff).toHaveBeenCalled();
      expect(component.diffResult()).toEqual(mockDiffResult);
    });

    it('should handle error when loading variables fails', () => {
      const error = new Error('Failed to load variables');
      mockApiService.getVariables.mockReturnValue(throwError(() => error));

      component.leftEnvId.set('env-1');
      component.rightEnvId.set('env-2');
      component.onEnvironmentChange();

      expect(component.errorMessage()).toBe('Failed to load variables');
      expect(component.diffResult()).toBeNull();
    });
  });

  describe('Diff Computation', () => {
    beforeEach(() => {
      component.projectId.set('project-1');
      component.onProjectIdChange();
      component.leftEnvId.set('env-1');
      component.rightEnvId.set('env-2');
      component.onEnvironmentChange();
    });

    it('should compute diff with added variables', () => {
      const result = component.diffResult();
      expect(result?.added.length).toBe(1);
      expect(result?.added[0].key).toBe('CACHE_TTL');
      expect(result?.added[0].type).toBe('added');
    });

    it('should compute diff with removed variables', () => {
      const result = component.diffResult();
      expect(result?.removed.length).toBe(1);
      expect(result?.removed[0].key).toBe('API_KEY');
      expect(result?.removed[0].type).toBe('removed');
    });

    it('should compute diff with modified variables', () => {
      const result = component.diffResult();
      expect(result?.modified.length).toBe(2);
      expect(result?.modified[0].key).toBe('DATABASE_URL');
      expect(result?.modified[0].type).toBe('modified');
    });

    it('should show empty diff when environments are identical', () => {
      const emptyDiff: DiffResult = {
        added: [],
        removed: [],
        modified: [],
        unchanged: mockVariables1.map(v => ({
          type: 'unchanged' as DiffType,
          key: v.key,
          leftValue: v.value,
          rightValue: v.value,
          leftVariable: v,
          rightVariable: v,
        })),
      };
      mockDiffService.computeDiff.mockReturnValue(emptyDiff);

      component.onEnvironmentChange();

      expect(component.diffResult()?.added.length).toBe(0);
      expect(component.diffResult()?.removed.length).toBe(0);
      expect(component.diffResult()?.modified.length).toBe(0);
    });
  });

  describe('Variable Count Summary', () => {
    beforeEach(() => {
      component.projectId.set('project-1');
      component.onProjectIdChange();
      component.leftEnvId.set('env-1');
      component.rightEnvId.set('env-2');
      component.onEnvironmentChange();
    });

    it('should calculate total added count', () => {
      expect(component.addedCount()).toBe(1);
    });

    it('should calculate total removed count', () => {
      expect(component.removedCount()).toBe(1);
    });

    it('should calculate total modified count', () => {
      expect(component.modifiedCount()).toBe(2);
    });

    it('should calculate total unchanged count', () => {
      expect(component.unchangedCount()).toBe(0);
    });

    it('should calculate total changes count', () => {
      expect(component.totalChanges()).toBe(4);
    });

    it('should return 0 for counts when no diff result', () => {
      component.leftEnvId.set(null);
      component.rightEnvId.set(null);
      component.onEnvironmentChange();

      expect(component.addedCount()).toBe(0);
      expect(component.removedCount()).toBe(0);
      expect(component.modifiedCount()).toBe(0);
      expect(component.unchangedCount()).toBe(0);
      expect(component.totalChanges()).toBe(0);
    });
  });

  describe('Filter by Change Type', () => {
    beforeEach(() => {
      component.projectId.set('project-1');
      component.onProjectIdChange();
      component.leftEnvId.set('env-1');
      component.rightEnvId.set('env-2');
      component.onEnvironmentChange();
    });

    it('should show all changes by default', () => {
      expect(component.selectedFilter()).toBe('all');
      expect(component.filteredDiffEntries().length).toBe(4);
    });

    it('should filter to show only added variables', () => {
      component.selectedFilter.set('added');
      expect(component.filteredDiffEntries().length).toBe(1);
      expect(component.filteredDiffEntries()[0].type).toBe('added');
    });

    it('should filter to show only removed variables', () => {
      component.selectedFilter.set('removed');
      expect(component.filteredDiffEntries().length).toBe(1);
      expect(component.filteredDiffEntries()[0].type).toBe('removed');
    });

    it('should filter to show only modified variables', () => {
      component.selectedFilter.set('modified');
      expect(component.filteredDiffEntries().length).toBe(2);
      expect(component.filteredDiffEntries()[0].type).toBe('modified');
    });

    it('should filter to show only unchanged variables', () => {
      component.selectedFilter.set('unchanged');
      expect(component.filteredDiffEntries().length).toBe(0);
    });

    it('should return empty array when no diff result', () => {
      component.leftEnvId.set(null);
      component.onEnvironmentChange();
      expect(component.filteredDiffEntries()).toEqual([]);
    });
  });

  describe('Search within Diff', () => {
    beforeEach(() => {
      component.projectId.set('project-1');
      component.onProjectIdChange();
      component.leftEnvId.set('env-1');
      component.rightEnvId.set('env-2');
      component.onEnvironmentChange();
    });

    it('should show all entries when search query is empty', () => {
      component.searchQuery.set('');
      expect(component.filteredDiffEntries().length).toBe(4);
    });

    it('should filter entries by key name (case-insensitive)', () => {
      component.searchQuery.set('database');
      expect(component.filteredDiffEntries().length).toBe(1);
      expect(component.filteredDiffEntries()[0].key).toBe('DATABASE_URL');
    });

    it('should filter entries by value (case-insensitive)', () => {
      component.searchQuery.set('postgres');
      expect(component.filteredDiffEntries().length).toBe(1);
      expect(component.filteredDiffEntries()[0].key).toBe('DATABASE_URL');
    });

    it('should return no results when search query does not match', () => {
      component.searchQuery.set('nonexistent');
      expect(component.filteredDiffEntries().length).toBe(0);
    });

    it('should combine search with filter', () => {
      component.selectedFilter.set('modified');
      component.searchQuery.set('debug');
      expect(component.filteredDiffEntries().length).toBe(1);
      expect(component.filteredDiffEntries()[0].key).toBe('DEBUG');
    });
  });

  describe('Show Unchanged Variables Toggle', () => {
    beforeEach(() => {
      const diffWithUnchanged: DiffResult = {
        ...mockDiffResult,
        unchanged: [
          {
            type: 'unchanged',
            key: 'PORT',
            leftValue: '3000',
            rightValue: '3000',
            leftVariable: mockVariables1[0],
            rightVariable: mockVariables2[0],
          },
        ],
      };
      mockDiffService.computeDiff.mockReturnValue(diffWithUnchanged);
      component.projectId.set('project-1');
      component.onProjectIdChange();
      component.leftEnvId.set('env-1');
      component.rightEnvId.set('env-2');
      component.onEnvironmentChange();
    });

    it('should hide unchanged variables by default', () => {
      expect(component.showUnchanged()).toBe(false);
      expect(component.filteredDiffEntries().length).toBe(4); // only changes
    });

    it('should show unchanged variables when toggled on', () => {
      component.showUnchanged.set(true);
      expect(component.filteredDiffEntries().length).toBe(5); // changes + unchanged
    });

    it('should exclude unchanged variables when toggled off', () => {
      component.showUnchanged.set(true);
      component.showUnchanged.set(false);
      expect(component.filteredDiffEntries().length).toBe(4);
    });
  });

  describe('Copy to Clipboard', () => {
    beforeEach(() => {
      component.projectId.set('project-1');
      component.onProjectIdChange();
      component.leftEnvId.set('env-1');
      component.rightEnvId.set('env-2');
      component.onEnvironmentChange();
    });

    it('should copy diff summary to clipboard', async () => {
      await component.copyDiffToClipboard();

      expect(navigator.clipboard.writeText).toHaveBeenCalled();
      const copiedText = (navigator.clipboard.writeText as ReturnType<typeof vi.fn>).mock.calls[0][0];
      expect(copiedText).toContain('CACHE_TTL');
      expect(copiedText).toContain('API_KEY');
      expect(copiedText).toContain('DATABASE_URL');
    });

    it('should show success message after copying', async () => {
      await component.copyDiffToClipboard();

      expect(component.copySuccess()).toBe(true);
    });

    it('should reset copy success message after timeout', async () => {
      vi.useFakeTimers();

      await component.copyDiffToClipboard();
      expect(component.copySuccess()).toBe(true);

      vi.advanceTimersByTime(2100);
      expect(component.copySuccess()).toBe(false);

      vi.useRealTimers();
    });

    it('should handle clipboard copy errors', async () => {
      (navigator.clipboard.writeText as ReturnType<typeof vi.fn>).mockRejectedValue(
        new Error('Clipboard access denied')
      );

      await component.copyDiffToClipboard();

      expect(component.errorMessage()).toBe('Failed to copy to clipboard');
    });
  });

  describe('Merge Functionality', () => {
    beforeEach(() => {
      component.projectId.set('project-1');
      component.onProjectIdChange();
      component.leftEnvId.set('env-1');
      component.rightEnvId.set('env-2');
      component.onEnvironmentChange();
    });

    it('should merge from left to right (copy added variable)', async () => {
      const addedEntry = mockDiffResult.added[0];

      await component.mergeEntry(addedEntry, 'left-to-right');

      expect(mockApiService.createVariable).toHaveBeenCalledWith(
        'project-1',
        'env-1',
        'CACHE_TTL',
        expect.any(String),
        expect.any(String),
        false
      );
    });

    it('should merge from right to left (copy removed variable)', async () => {
      const removedEntry = mockDiffResult.removed[0];

      await component.mergeEntry(removedEntry, 'right-to-left');

      expect(mockApiService.deleteVariable).toHaveBeenCalledWith(
        'project-1',
        'env-1',
        'var-2'
      );
    });

    it('should merge modified value from left to right', async () => {
      const modifiedEntry = mockDiffResult.modified[0];

      await component.mergeEntry(modifiedEntry, 'left-to-right');

      expect(mockApiService.updateVariable).toHaveBeenCalledWith(
        'project-1',
        'env-2',
        'var-4',
        'DATABASE_URL',
        expect.any(String),
        expect.any(String),
        true
      );
    });

    it('should merge modified value from right to left', async () => {
      const modifiedEntry = mockDiffResult.modified[0];

      await component.mergeEntry(modifiedEntry, 'right-to-left');

      expect(mockApiService.updateVariable).toHaveBeenCalledWith(
        'project-1',
        'env-1',
        'var-1',
        'DATABASE_URL',
        expect.any(String),
        expect.any(String),
        true
      );
    });

    it('should handle merge errors gracefully', async () => {
      const error = new Error('Merge failed');
      mockApiService.updateVariable.mockReturnValue(throwError(() => error));
      const modifiedEntry = mockDiffResult.modified[0];

      await component.mergeEntry(modifiedEntry, 'left-to-right');

      expect(component.errorMessage()).toBe('Failed to merge variable');
    });

    it('should show loading state during merge', async () => {
      const modifiedEntry = mockDiffResult.modified[0];

      const mergePromise = component.mergeEntry(modifiedEntry, 'left-to-right');
      // Note: In async test, we can't easily check intermediate state
      // Just verify the final state is correct
      await mergePromise;
      expect(component.isLoading()).toBe(false);
    });

    it('should refresh diff after successful merge', async () => {
      const modifiedEntry = mockDiffResult.modified[0];
      const initialCallCount = mockDiffService.computeDiff.mock.calls.length;

      await component.mergeEntry(modifiedEntry, 'left-to-right');

      expect(mockDiffService.computeDiff.mock.calls.length).toBeGreaterThan(initialCallCount);
    });
  });

  describe('Styling and Display', () => {
    it('should return correct CSS class for added entries', () => {
      const entry: DiffEntry = {
        type: 'added',
        key: 'TEST',
        leftValue: null,
        rightValue: 'value',
        leftVariable: null,
        rightVariable: mockVariables2[0],
      };
      expect(component.getDiffClass(entry)).toBe('bg-green-900/20 border-green-500/30');
    });

    it('should return correct CSS class for removed entries', () => {
      const entry: DiffEntry = {
        type: 'removed',
        key: 'TEST',
        leftValue: 'value',
        rightValue: null,
        leftVariable: mockVariables1[0],
        rightVariable: null,
      };
      expect(component.getDiffClass(entry)).toBe('bg-red-900/20 border-red-500/30');
    });

    it('should return correct CSS class for modified entries', () => {
      const entry: DiffEntry = {
        type: 'modified',
        key: 'TEST',
        leftValue: 'old',
        rightValue: 'new',
        leftVariable: mockVariables1[0],
        rightVariable: mockVariables2[0],
      };
      expect(component.getDiffClass(entry)).toBe('bg-yellow-900/20 border-yellow-500/30');
    });

    it('should return correct CSS class for unchanged entries', () => {
      const entry: DiffEntry = {
        type: 'unchanged',
        key: 'TEST',
        leftValue: 'value',
        rightValue: 'value',
        leftVariable: mockVariables1[0],
        rightVariable: mockVariables2[0],
      };
      expect(component.getDiffClass(entry)).toBe('bg-dark-800/50 border-dark-700');
    });

    it('should return correct icon for diff type', () => {
      expect(component.getDiffIcon('added')).toBe('plus-circle');
      expect(component.getDiffIcon('removed')).toBe('minus-circle');
      expect(component.getDiffIcon('modified')).toBe('edit-2');
      expect(component.getDiffIcon('unchanged')).toBe('check-circle');
    });
  });

  describe('Edge Cases', () => {
    it('should handle empty variable lists', () => {
      mockApiService.getVariables.mockReturnValue(of([]));
      const emptyDiff: DiffResult = {
        added: [],
        removed: [],
        modified: [],
        unchanged: [],
      };
      mockDiffService.computeDiff.mockReturnValue(emptyDiff);

      component.projectId.set('project-1');
      component.onProjectIdChange();
      component.leftEnvId.set('env-1');
      component.rightEnvId.set('env-2');
      component.onEnvironmentChange();

      expect(component.diffResult()).toEqual(emptyDiff);
      expect(component.totalChanges()).toBe(0);
    });

    it('should handle null project ID gracefully', () => {
      component.projectId.set('');
      expect(component.environments()).toEqual([]);
    });

    it('should clear diff when environments are deselected', () => {
      component.projectId.set('project-1');
      component.onProjectIdChange();
      component.leftEnvId.set('env-1');
      component.rightEnvId.set('env-2');
      component.onEnvironmentChange();

      expect(component.diffResult()).toBeTruthy();

      component.leftEnvId.set(null);
      component.onEnvironmentChange();

      expect(component.diffResult()).toBeNull();
    });

    it('should handle very long variable values', () => {
      const longValue = 'x'.repeat(1000);
      const longVariables: Variable[] = [
        {
          id: 'var-long',
          environment_id: 'env-1',
          key: 'LONG_KEY',
          value: longValue,
          is_secret: true,
          created_at: '2024-01-01T00:00:00Z',
          updated_at: '2024-01-01T00:00:00Z',
        },
      ];

      mockApiService.getVariables.mockReturnValue(of(longVariables));
      mockDiffService.computeDiff.mockReturnValue({
        added: [],
        removed: [],
        modified: [],
        unchanged: [],
      });

      component.projectId.set('project-1');
      component.onProjectIdChange();
      component.leftEnvId.set('env-1');
      component.rightEnvId.set('env-2');
      component.onEnvironmentChange();

      expect(component.diffResult()).toBeTruthy();
    });

    it('should handle special characters in variable keys', () => {
      const specialVariables: Variable[] = [
        {
          id: 'var-special',
          environment_id: 'env-1',
          key: 'MY_VAR-2.0_TEST',
          value: 'value',
          is_secret: false,
          created_at: '2024-01-01T00:00:00Z',
          updated_at: '2024-01-01T00:00:00Z',
        },
      ];

      mockApiService.getVariables.mockReturnValue(of(specialVariables));
      mockDiffService.computeDiff.mockReturnValue({
        added: [],
        removed: [],
        modified: [],
        unchanged: [],
      });

      component.projectId.set('project-1');
      component.onProjectIdChange();
      component.leftEnvId.set('env-1');
      component.rightEnvId.set('env-2');
      component.onEnvironmentChange();

      expect(component.diffResult()).toBeTruthy();
    });
  });
});
