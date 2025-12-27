import { TestBed } from '@angular/core/testing';
import { DiffService, DiffEntry, DiffResult } from './diff.service';
import { Variable } from '../models';

describe('DiffService', () => {
  let service: DiffService;

  const createVariable = (key: string, value: string): Variable => ({
    id: `var-${key}`,
    environment_id: 'env-1',
    key,
    value,
    is_secret: false,
    created_at: '2024-01-01T00:00:00Z',
    updated_at: '2024-01-01T00:00:00Z',
  });

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [DiffService],
    });

    service = TestBed.inject(DiffService);
  });

  describe('computeDiff', () => {
    describe('Basic Operations', () => {
      it('should identify added variables', () => {
        const left: Variable[] = [];
        const right: Variable[] = [createVariable('NEW_KEY', 'value')];

        const result = service.computeDiff(left, right);

        expect(result.added.length).toBe(1);
        expect(result.added[0].key).toBe('NEW_KEY');
        expect(result.added[0].type).toBe('added');
        expect(result.added[0].leftValue).toBeNull();
        expect(result.added[0].rightValue).toBe('value');
      });

      it('should identify removed variables', () => {
        const left: Variable[] = [createVariable('OLD_KEY', 'value')];
        const right: Variable[] = [];

        const result = service.computeDiff(left, right);

        expect(result.removed.length).toBe(1);
        expect(result.removed[0].key).toBe('OLD_KEY');
        expect(result.removed[0].type).toBe('removed');
        expect(result.removed[0].leftValue).toBe('value');
        expect(result.removed[0].rightValue).toBeNull();
      });

      it('should identify modified variables', () => {
        const left: Variable[] = [createVariable('KEY', 'old_value')];
        const right: Variable[] = [createVariable('KEY', 'new_value')];

        const result = service.computeDiff(left, right);

        expect(result.modified.length).toBe(1);
        expect(result.modified[0].key).toBe('KEY');
        expect(result.modified[0].type).toBe('modified');
        expect(result.modified[0].leftValue).toBe('old_value');
        expect(result.modified[0].rightValue).toBe('new_value');
      });

      it('should identify unchanged variables', () => {
        const left: Variable[] = [createVariable('KEY', 'same_value')];
        const right: Variable[] = [createVariable('KEY', 'same_value')];

        const result = service.computeDiff(left, right);

        expect(result.unchanged.length).toBe(1);
        expect(result.unchanged[0].key).toBe('KEY');
        expect(result.unchanged[0].type).toBe('unchanged');
      });
    });

    describe('Complex Scenarios', () => {
      it('should handle mixed operations', () => {
        const left: Variable[] = [
          createVariable('KEPT', 'same'),
          createVariable('MODIFIED', 'old'),
          createVariable('REMOVED', 'gone'),
        ];
        const right: Variable[] = [
          createVariable('KEPT', 'same'),
          createVariable('MODIFIED', 'new'),
          createVariable('ADDED', 'fresh'),
        ];

        const result = service.computeDiff(left, right);

        expect(result.unchanged.length).toBe(1);
        expect(result.modified.length).toBe(1);
        expect(result.removed.length).toBe(1);
        expect(result.added.length).toBe(1);
      });

      it('should handle empty left array', () => {
        const left: Variable[] = [];
        const right: Variable[] = [
          createVariable('KEY1', 'value1'),
          createVariable('KEY2', 'value2'),
        ];

        const result = service.computeDiff(left, right);

        expect(result.added.length).toBe(2);
        expect(result.removed.length).toBe(0);
        expect(result.modified.length).toBe(0);
        expect(result.unchanged.length).toBe(0);
      });

      it('should handle empty right array', () => {
        const left: Variable[] = [
          createVariable('KEY1', 'value1'),
          createVariable('KEY2', 'value2'),
        ];
        const right: Variable[] = [];

        const result = service.computeDiff(left, right);

        expect(result.removed.length).toBe(2);
        expect(result.added.length).toBe(0);
        expect(result.modified.length).toBe(0);
        expect(result.unchanged.length).toBe(0);
      });

      it('should handle both arrays empty', () => {
        const result = service.computeDiff([], []);

        expect(result.added.length).toBe(0);
        expect(result.removed.length).toBe(0);
        expect(result.modified.length).toBe(0);
        expect(result.unchanged.length).toBe(0);
      });

      it('should handle identical arrays', () => {
        const variables: Variable[] = [
          createVariable('KEY1', 'value1'),
          createVariable('KEY2', 'value2'),
          createVariable('KEY3', 'value3'),
        ];

        const result = service.computeDiff(variables, variables);

        expect(result.unchanged.length).toBe(3);
        expect(result.added.length).toBe(0);
        expect(result.removed.length).toBe(0);
        expect(result.modified.length).toBe(0);
      });
    });

    describe('Sorting', () => {
      it('should sort added entries alphabetically', () => {
        const left: Variable[] = [];
        const right: Variable[] = [
          createVariable('ZEBRA', 'value'),
          createVariable('APPLE', 'value'),
          createVariable('MANGO', 'value'),
        ];

        const result = service.computeDiff(left, right);

        expect(result.added[0].key).toBe('APPLE');
        expect(result.added[1].key).toBe('MANGO');
        expect(result.added[2].key).toBe('ZEBRA');
      });

      it('should sort removed entries alphabetically', () => {
        const left: Variable[] = [
          createVariable('ZEBRA', 'value'),
          createVariable('APPLE', 'value'),
          createVariable('MANGO', 'value'),
        ];
        const right: Variable[] = [];

        const result = service.computeDiff(left, right);

        expect(result.removed[0].key).toBe('APPLE');
        expect(result.removed[1].key).toBe('MANGO');
        expect(result.removed[2].key).toBe('ZEBRA');
      });

      it('should sort modified entries alphabetically', () => {
        const left: Variable[] = [
          createVariable('ZEBRA', 'old'),
          createVariable('APPLE', 'old'),
          createVariable('MANGO', 'old'),
        ];
        const right: Variable[] = [
          createVariable('ZEBRA', 'new'),
          createVariable('APPLE', 'new'),
          createVariable('MANGO', 'new'),
        ];

        const result = service.computeDiff(left, right);

        expect(result.modified[0].key).toBe('APPLE');
        expect(result.modified[1].key).toBe('MANGO');
        expect(result.modified[2].key).toBe('ZEBRA');
      });
    });

    describe('Edge Cases', () => {
      it('should handle empty string values', () => {
        const left: Variable[] = [createVariable('KEY', '')];
        const right: Variable[] = [createVariable('KEY', 'value')];

        const result = service.computeDiff(left, right);

        expect(result.modified.length).toBe(1);
        expect(result.modified[0].leftValue).toBe('');
      });

      it('should handle keys with special characters', () => {
        const left: Variable[] = [createVariable('KEY.WITH.DOTS', 'value')];
        const right: Variable[] = [createVariable('KEY-WITH-DASHES', 'value')];

        const result = service.computeDiff(left, right);

        expect(result.removed[0].key).toBe('KEY.WITH.DOTS');
        expect(result.added[0].key).toBe('KEY-WITH-DASHES');
      });

      it('should handle very long values', () => {
        const longValue = 'x'.repeat(10000);
        const left: Variable[] = [createVariable('KEY', longValue)];
        const right: Variable[] = [createVariable('KEY', longValue + '!')];

        const result = service.computeDiff(left, right);

        expect(result.modified.length).toBe(1);
      });

      it('should preserve variable references in entries', () => {
        const leftVar = createVariable('KEY', 'value');
        const rightVar = createVariable('KEY', 'new_value');

        const result = service.computeDiff([leftVar], [rightVar]);

        expect(result.modified[0].leftVariable).toBe(leftVar);
        expect(result.modified[0].rightVariable).toBe(rightVar);
      });
    });
  });

  describe('formatDiffSummary', () => {
    it('should format diff summary with environment names', () => {
      const diffResult: DiffResult = {
        added: [{ type: 'added', key: 'NEW', leftValue: null, rightValue: 'val', leftVariable: null, rightVariable: null }],
        removed: [],
        modified: [],
        unchanged: [],
      };

      const summary = service.formatDiffSummary(diffResult, 'dev', 'prod');

      expect(summary).toContain('dev');
      expect(summary).toContain('prod');
      expect(summary).toContain('Added: 1');
    });

    it('should include all sections in summary', () => {
      const diffResult: DiffResult = {
        added: [{ type: 'added', key: 'A', leftValue: null, rightValue: 'v', leftVariable: null, rightVariable: null }],
        removed: [{ type: 'removed', key: 'R', leftValue: 'v', rightValue: null, leftVariable: null, rightVariable: null }],
        modified: [{ type: 'modified', key: 'M', leftValue: 'old', rightValue: 'new', leftVariable: null, rightVariable: null }],
        unchanged: [{ type: 'unchanged', key: 'U', leftValue: 'v', rightValue: 'v', leftVariable: null, rightVariable: null }],
      };

      const summary = service.formatDiffSummary(diffResult, 'env1', 'env2');

      expect(summary).toContain('Added Variables');
      expect(summary).toContain('Removed Variables');
      expect(summary).toContain('Modified Variables');
      expect(summary).toContain('Unchanged Variables');
    });

    it('should format summary correctly for empty diff', () => {
      const diffResult: DiffResult = {
        added: [],
        removed: [],
        modified: [],
        unchanged: [],
      };

      const summary = service.formatDiffSummary(diffResult, 'dev', 'prod');

      expect(summary).toContain('Added: 0');
      expect(summary).toContain('Removed: 0');
      expect(summary).toContain('Modified: 0');
      expect(summary).toContain('Unchanged: 0');
    });

    it('should include variable values in summary', () => {
      const diffResult: DiffResult = {
        added: [],
        removed: [],
        modified: [{ type: 'modified', key: 'API_KEY', leftValue: 'secret1', rightValue: 'secret2', leftVariable: null, rightVariable: null }],
        unchanged: [],
      };

      const summary = service.formatDiffSummary(diffResult, 'dev', 'prod');

      expect(summary).toContain('API_KEY');
      expect(summary).toContain('secret1');
      expect(summary).toContain('secret2');
    });
  });

  describe('getDiffStats', () => {
    it('should calculate correct statistics', () => {
      const diffResult: DiffResult = {
        added: [
          { type: 'added', key: 'A1', leftValue: null, rightValue: 'v', leftVariable: null, rightVariable: null },
          { type: 'added', key: 'A2', leftValue: null, rightValue: 'v', leftVariable: null, rightVariable: null },
        ],
        removed: [{ type: 'removed', key: 'R1', leftValue: 'v', rightValue: null, leftVariable: null, rightVariable: null }],
        modified: [
          { type: 'modified', key: 'M1', leftValue: 'old', rightValue: 'new', leftVariable: null, rightVariable: null },
          { type: 'modified', key: 'M2', leftValue: 'old', rightValue: 'new', leftVariable: null, rightVariable: null },
          { type: 'modified', key: 'M3', leftValue: 'old', rightValue: 'new', leftVariable: null, rightVariable: null },
        ],
        unchanged: [
          { type: 'unchanged', key: 'U1', leftValue: 'v', rightValue: 'v', leftVariable: null, rightVariable: null },
          { type: 'unchanged', key: 'U2', leftValue: 'v', rightValue: 'v', leftVariable: null, rightVariable: null },
        ],
      };

      const stats = service.getDiffStats(diffResult);

      expect(stats.addedCount).toBe(2);
      expect(stats.removedCount).toBe(1);
      expect(stats.modifiedCount).toBe(3);
      expect(stats.unchangedCount).toBe(2);
      expect(stats.totalChanges).toBe(6);
      expect(stats.totalVariables).toBe(8);
    });

    it('should return zeros for empty diff', () => {
      const diffResult: DiffResult = {
        added: [],
        removed: [],
        modified: [],
        unchanged: [],
      };

      const stats = service.getDiffStats(diffResult);

      expect(stats.addedCount).toBe(0);
      expect(stats.removedCount).toBe(0);
      expect(stats.modifiedCount).toBe(0);
      expect(stats.unchangedCount).toBe(0);
      expect(stats.totalChanges).toBe(0);
      expect(stats.totalVariables).toBe(0);
    });
  });

  describe('filterBySearch', () => {
    const entries: DiffEntry[] = [
      { type: 'added', key: 'API_KEY', leftValue: null, rightValue: 'secret123', leftVariable: null, rightVariable: null },
      { type: 'modified', key: 'DB_URL', leftValue: 'localhost', rightValue: 'production', leftVariable: null, rightVariable: null },
      { type: 'removed', key: 'DEBUG_MODE', leftValue: 'true', rightValue: null, leftVariable: null, rightVariable: null },
    ];

    it('should filter by key match', () => {
      const result = service.filterBySearch(entries, 'API');

      expect(result.length).toBe(1);
      expect(result[0].key).toBe('API_KEY');
    });

    it('should filter by left value match', () => {
      const result = service.filterBySearch(entries, 'localhost');

      expect(result.length).toBe(1);
      expect(result[0].key).toBe('DB_URL');
    });

    it('should filter by right value match', () => {
      const result = service.filterBySearch(entries, 'production');

      expect(result.length).toBe(1);
      expect(result[0].key).toBe('DB_URL');
    });

    it('should be case insensitive', () => {
      const result = service.filterBySearch(entries, 'api');

      expect(result.length).toBe(1);
      expect(result[0].key).toBe('API_KEY');
    });

    it('should return all entries for empty search', () => {
      const result = service.filterBySearch(entries, '');

      expect(result.length).toBe(3);
    });

    it('should return all entries for whitespace search', () => {
      const result = service.filterBySearch(entries, '   ');

      expect(result.length).toBe(3);
    });

    it('should return empty array when no matches', () => {
      const result = service.filterBySearch(entries, 'nonexistent');

      expect(result.length).toBe(0);
    });

    it('should handle null values in search', () => {
      const result = service.filterBySearch(entries, 'true');

      expect(result.length).toBe(1);
      expect(result[0].key).toBe('DEBUG_MODE');
    });
  });

  describe('filterByType', () => {
    const diffResult: DiffResult = {
      added: [{ type: 'added', key: 'A', leftValue: null, rightValue: 'v', leftVariable: null, rightVariable: null }],
      removed: [{ type: 'removed', key: 'R', leftValue: 'v', rightValue: null, leftVariable: null, rightVariable: null }],
      modified: [{ type: 'modified', key: 'M', leftValue: 'old', rightValue: 'new', leftVariable: null, rightVariable: null }],
      unchanged: [{ type: 'unchanged', key: 'U', leftValue: 'v', rightValue: 'v', leftVariable: null, rightVariable: null }],
    };

    it('should filter by added type', () => {
      const result = service.filterByType(diffResult, 'added');

      expect(result.length).toBe(1);
      expect(result[0].type).toBe('added');
    });

    it('should filter by removed type', () => {
      const result = service.filterByType(diffResult, 'removed');

      expect(result.length).toBe(1);
      expect(result[0].type).toBe('removed');
    });

    it('should filter by modified type', () => {
      const result = service.filterByType(diffResult, 'modified');

      expect(result.length).toBe(1);
      expect(result[0].type).toBe('modified');
    });

    it('should filter by unchanged type', () => {
      const result = service.filterByType(diffResult, 'unchanged');

      expect(result.length).toBe(1);
      expect(result[0].type).toBe('unchanged');
    });

    it('should return all entries for "all" filter', () => {
      const result = service.filterByType(diffResult, 'all');

      expect(result.length).toBe(4);
    });

    it('should return all entries for unknown filter type', () => {
      const result = service.filterByType(diffResult, 'unknown');

      expect(result.length).toBe(4);
    });
  });
});
