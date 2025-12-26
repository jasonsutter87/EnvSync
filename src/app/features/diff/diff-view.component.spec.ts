import { ComponentFixture, TestBed } from '@angular/core/testing';
import { signal } from '@angular/core';
import { DiffViewComponent } from './diff-view.component';
import { DiffService, DiffResult, DiffEntry, DiffType } from '../../core/services/diff.service';
import { ApiService } from '../../core/services/api.service';
import { Environment, Variable } from '../../core/models';
import { of, throwError } from 'rxjs';

describe('DiffViewComponent', () => {
  let component: DiffViewComponent;
  let fixture: ComponentFixture<DiffViewComponent>;
  let mockDiffService: jasmine.SpyObj<DiffService>;
  let mockApiService: jasmine.SpyObj<ApiService>;

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

  beforeEach(async () => {
    mockDiffService = jasmine.createSpyObj('DiffService', ['computeDiff']);
    mockApiService = jasmine.createSpyObj('ApiService', [
      'getEnvironments',
      'getVariables',
      'createVariable',
      'updateVariable',
      'deleteVariable',
    ]);

    await TestBed.configureTestingModule({
      imports: [DiffViewComponent],
      providers: [
        { provide: DiffService, useValue: mockDiffService },
        { provide: ApiService, useValue: mockApiService },
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(DiffViewComponent);
    component = fixture.componentInstance;
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
      mockApiService.getEnvironments.and.returnValue(of(mockEnvironments));

      component.projectId.set('project-1');

      expect(mockApiService.getEnvironments).toHaveBeenCalledWith('project-1');
      expect(component.environments()).toEqual(mockEnvironments);
    });

    it('should handle error when loading environments fails', () => {
      const error = new Error('Failed to load environments');
      mockApiService.getEnvironments.and.returnValue(throwError(() => error));

      component.projectId.set('project-1');

      expect(component.errorMessage()).toBe('Failed to load environments');
    });
  });

  describe('Environment Selection', () => {
    beforeEach(() => {
      mockApiService.getEnvironments.and.returnValue(of(mockEnvironments));
      component.projectId.set('project-1');
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

      expect(component.errorMessage()).toBe('Please select different environments');
      expect(component.diffResult()).toBeNull();
    });

    it('should load and compare variables when both environments are selected', () => {
      mockApiService.getVariables.and.returnValues(
        of(mockVariables1),
        of(mockVariables2)
      );
      mockDiffService.computeDiff.and.returnValue(mockDiffResult);

      component.leftEnvId.set('env-1');
      component.rightEnvId.set('env-2');

      expect(mockApiService.getVariables).toHaveBeenCalledWith('project-1', 'env-1');
      expect(mockApiService.getVariables).toHaveBeenCalledWith('project-1', 'env-2');
      expect(mockDiffService.computeDiff).toHaveBeenCalledWith(mockVariables1, mockVariables2);
      expect(component.diffResult()).toEqual(mockDiffResult);
    });

    it('should handle error when loading variables fails', () => {
      const error = new Error('Failed to load variables');
      mockApiService.getVariables.and.returnValue(throwError(() => error));

      component.leftEnvId.set('env-1');
      component.rightEnvId.set('env-2');

      expect(component.errorMessage()).toBe('Failed to load variables');
      expect(component.diffResult()).toBeNull();
    });
  });

  describe('Diff Computation', () => {
    beforeEach(() => {
      mockApiService.getEnvironments.and.returnValue(of(mockEnvironments));
      mockApiService.getVariables.and.returnValues(
        of(mockVariables1),
        of(mockVariables2)
      );
      mockDiffService.computeDiff.and.returnValue(mockDiffResult);
      component.projectId.set('project-1');
    });

    it('should compute diff with added variables', () => {
      component.leftEnvId.set('env-1');
      component.rightEnvId.set('env-2');

      const result = component.diffResult();
      expect(result?.added.length).toBe(1);
      expect(result?.added[0].key).toBe('CACHE_TTL');
      expect(result?.added[0].type).toBe('added');
    });

    it('should compute diff with removed variables', () => {
      component.leftEnvId.set('env-1');
      component.rightEnvId.set('env-2');

      const result = component.diffResult();
      expect(result?.removed.length).toBe(1);
      expect(result?.removed[0].key).toBe('API_KEY');
      expect(result?.removed[0].type).toBe('removed');
    });

    it('should compute diff with modified variables', () => {
      component.leftEnvId.set('env-1');
      component.rightEnvId.set('env-2');

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
          type: 'unchanged',
          key: v.key,
          leftValue: v.value,
          rightValue: v.value,
          leftVariable: v,
          rightVariable: v,
        })),
      };
      mockDiffService.computeDiff.and.returnValue(emptyDiff);
      mockApiService.getVariables.and.returnValue(of(mockVariables1));

      component.leftEnvId.set('env-1');
      component.rightEnvId.set('env-1');

      expect(component.diffResult()?.added.length).toBe(0);
      expect(component.diffResult()?.removed.length).toBe(0);
      expect(component.diffResult()?.modified.length).toBe(0);
    });
  });

  describe('Variable Count Summary', () => {
    beforeEach(() => {
      mockApiService.getEnvironments.and.returnValue(of(mockEnvironments));
      mockApiService.getVariables.and.returnValues(
        of(mockVariables1),
        of(mockVariables2)
      );
      mockDiffService.computeDiff.and.returnValue(mockDiffResult);
      component.projectId.set('project-1');
      component.leftEnvId.set('env-1');
      component.rightEnvId.set('env-2');
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

      expect(component.addedCount()).toBe(0);
      expect(component.removedCount()).toBe(0);
      expect(component.modifiedCount()).toBe(0);
      expect(component.unchangedCount()).toBe(0);
      expect(component.totalChanges()).toBe(0);
    });
  });

  describe('Filter by Change Type', () => {
    beforeEach(() => {
      mockApiService.getEnvironments.and.returnValue(of(mockEnvironments));
      mockApiService.getVariables.and.returnValues(
        of(mockVariables1),
        of(mockVariables2)
      );
      mockDiffService.computeDiff.and.returnValue(mockDiffResult);
      component.projectId.set('project-1');
      component.leftEnvId.set('env-1');
      component.rightEnvId.set('env-2');
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
      expect(component.filteredDiffEntries()).toEqual([]);
    });
  });

  describe('Search within Diff', () => {
    beforeEach(() => {
      mockApiService.getEnvironments.and.returnValue(of(mockEnvironments));
      mockApiService.getVariables.and.returnValues(
        of(mockVariables1),
        of(mockVariables2)
      );
      mockDiffService.computeDiff.and.returnValue(mockDiffResult);
      component.projectId.set('project-1');
      component.leftEnvId.set('env-1');
      component.rightEnvId.set('env-2');
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
      mockApiService.getEnvironments.and.returnValue(of(mockEnvironments));
      mockApiService.getVariables.and.returnValues(
        of(mockVariables1),
        of(mockVariables2)
      );
      mockDiffService.computeDiff.and.returnValue(diffWithUnchanged);
      component.projectId.set('project-1');
      component.leftEnvId.set('env-1');
      component.rightEnvId.set('env-2');
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
      mockApiService.getEnvironments.and.returnValue(of(mockEnvironments));
      mockApiService.getVariables.and.returnValues(
        of(mockVariables1),
        of(mockVariables2)
      );
      mockDiffService.computeDiff.and.returnValue(mockDiffResult);
      component.projectId.set('project-1');
      component.leftEnvId.set('env-1');
      component.rightEnvId.set('env-2');

      // Mock clipboard API
      Object.assign(navigator, {
        clipboard: {
          writeText: jasmine.createSpy('writeText').and.returnValue(Promise.resolve()),
        },
      });
    });

    it('should copy diff summary to clipboard', async () => {
      await component.copyDiffToClipboard();

      expect(navigator.clipboard.writeText).toHaveBeenCalled();
      const copiedText = (navigator.clipboard.writeText as jasmine.Spy).calls.mostRecent().args[0];
      expect(copiedText).toContain('CACHE_TTL');
      expect(copiedText).toContain('API_KEY');
      expect(copiedText).toContain('DATABASE_URL');
    });

    it('should show success message after copying', async () => {
      await component.copyDiffToClipboard();

      expect(component.copySuccess()).toBe(true);
    });

    it('should reset copy success message after timeout', (done) => {
      component.copyDiffToClipboard().then(() => {
        expect(component.copySuccess()).toBe(true);

        setTimeout(() => {
          expect(component.copySuccess()).toBe(false);
          done();
        }, 2100);
      });
    });

    it('should handle clipboard copy errors', async () => {
      (navigator.clipboard.writeText as jasmine.Spy).and.returnValue(
        Promise.reject(new Error('Clipboard access denied'))
      );

      await component.copyDiffToClipboard();

      expect(component.errorMessage()).toBe('Failed to copy to clipboard');
    });
  });

  describe('Merge Functionality', () => {
    beforeEach(() => {
      mockApiService.getEnvironments.and.returnValue(of(mockEnvironments));
      mockApiService.getVariables.and.returnValues(
        of(mockVariables1),
        of(mockVariables2)
      );
      mockDiffService.computeDiff.and.returnValue(mockDiffResult);
      component.projectId.set('project-1');
      component.leftEnvId.set('env-1');
      component.rightEnvId.set('env-2');
    });

    it('should merge from left to right (copy added variable)', async () => {
      const addedEntry = mockDiffResult.added[0];
      mockApiService.createVariable.and.returnValue(of(mockVariables1[0]));

      await component.mergeEntry(addedEntry, 'left-to-right');

      expect(mockApiService.createVariable).toHaveBeenCalledWith(
        'project-1',
        'env-1',
        'CACHE_TTL',
        jasmine.any(String),
        jasmine.any(String),
        false
      );
    });

    it('should merge from right to left (copy removed variable)', async () => {
      const removedEntry = mockDiffResult.removed[0];
      mockApiService.deleteVariable.and.returnValue(of(void 0));

      await component.mergeEntry(removedEntry, 'right-to-left');

      expect(mockApiService.deleteVariable).toHaveBeenCalledWith(
        'project-1',
        'env-1',
        'var-2'
      );
    });

    it('should merge modified value from left to right', async () => {
      const modifiedEntry = mockDiffResult.modified[0];
      mockApiService.updateVariable.and.returnValue(of(mockVariables2[0]));

      await component.mergeEntry(modifiedEntry, 'left-to-right');

      expect(mockApiService.updateVariable).toHaveBeenCalledWith(
        'project-1',
        'env-2',
        'var-4',
        'DATABASE_URL',
        jasmine.any(String),
        jasmine.any(String),
        true
      );
    });

    it('should merge modified value from right to left', async () => {
      const modifiedEntry = mockDiffResult.modified[0];
      mockApiService.updateVariable.and.returnValue(of(mockVariables1[0]));

      await component.mergeEntry(modifiedEntry, 'right-to-left');

      expect(mockApiService.updateVariable).toHaveBeenCalledWith(
        'project-1',
        'env-1',
        'var-1',
        'DATABASE_URL',
        jasmine.any(String),
        jasmine.any(String),
        true
      );
    });

    it('should handle merge errors gracefully', async () => {
      const error = new Error('Merge failed');
      mockApiService.updateVariable.and.returnValue(throwError(() => error));
      const modifiedEntry = mockDiffResult.modified[0];

      await component.mergeEntry(modifiedEntry, 'left-to-right');

      expect(component.errorMessage()).toBe('Failed to merge variable');
    });

    it('should show loading state during merge', async () => {
      const modifiedEntry = mockDiffResult.modified[0];
      mockApiService.updateVariable.and.returnValue(of(mockVariables2[0]));

      const mergePromise = component.mergeEntry(modifiedEntry, 'left-to-right');
      expect(component.isLoading()).toBe(true);

      await mergePromise;
      expect(component.isLoading()).toBe(false);
    });

    it('should refresh diff after successful merge', async () => {
      const modifiedEntry = mockDiffResult.modified[0];
      mockApiService.updateVariable.and.returnValue(of(mockVariables2[0]));
      const computeDiffSpy = mockDiffService.computeDiff;

      await component.mergeEntry(modifiedEntry, 'left-to-right');

      expect(computeDiffSpy.calls.count()).toBeGreaterThan(1);
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
      mockApiService.getEnvironments.and.returnValue(of(mockEnvironments));
      mockApiService.getVariables.and.returnValue(of([]));
      const emptyDiff: DiffResult = {
        added: [],
        removed: [],
        modified: [],
        unchanged: [],
      };
      mockDiffService.computeDiff.and.returnValue(emptyDiff);

      component.projectId.set('project-1');
      component.leftEnvId.set('env-1');
      component.rightEnvId.set('env-2');

      expect(component.diffResult()).toEqual(emptyDiff);
      expect(component.totalChanges()).toBe(0);
    });

    it('should handle null project ID gracefully', () => {
      component.projectId.set('');
      expect(component.environments()).toEqual([]);
    });

    it('should clear diff when environments are deselected', () => {
      mockApiService.getEnvironments.and.returnValue(of(mockEnvironments));
      mockApiService.getVariables.and.returnValues(
        of(mockVariables1),
        of(mockVariables2)
      );
      mockDiffService.computeDiff.and.returnValue(mockDiffResult);

      component.projectId.set('project-1');
      component.leftEnvId.set('env-1');
      component.rightEnvId.set('env-2');

      expect(component.diffResult()).toBeTruthy();

      component.leftEnvId.set(null);

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

      mockApiService.getEnvironments.and.returnValue(of(mockEnvironments));
      mockApiService.getVariables.and.returnValue(of(longVariables));
      mockDiffService.computeDiff.and.returnValue({
        added: [],
        removed: [],
        modified: [],
        unchanged: [],
      });

      component.projectId.set('project-1');
      component.leftEnvId.set('env-1');
      component.rightEnvId.set('env-2');

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

      mockApiService.getEnvironments.and.returnValue(of(mockEnvironments));
      mockApiService.getVariables.and.returnValue(of(specialVariables));
      mockDiffService.computeDiff.and.returnValue({
        added: [],
        removed: [],
        modified: [],
        unchanged: [],
      });

      component.projectId.set('project-1');
      component.leftEnvId.set('env-1');
      component.rightEnvId.set('env-2');

      expect(component.diffResult()).toBeTruthy();
    });
  });
});
