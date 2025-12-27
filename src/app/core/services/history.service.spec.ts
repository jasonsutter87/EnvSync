import { TestBed } from '@angular/core/testing';
import { HistoryService } from './history.service';
import { invoke } from '@tauri-apps/api/core';
import { VariableHistory, HistoryQuery } from '../models';

vi.mock('@tauri-apps/api/core', () => ({
  invoke: vi.fn(),
}));

describe('HistoryService', () => {
  let service: HistoryService;
  let mockInvoke: ReturnType<typeof vi.fn>;

  const mockHistoryEntries: VariableHistory[] = [
    {
      id: 'hist-1',
      variable_id: 'var-1',
      variable_key: 'API_KEY',
      action: 'Created',
      old_value: null,
      new_value: 'secret123',
      actor_id: 'user-1',
      actor_email: 'user@example.com',
      timestamp: '2024-01-01T10:00:00Z',
    },
    {
      id: 'hist-2',
      variable_id: 'var-1',
      variable_key: 'API_KEY',
      action: 'Updated',
      old_value: 'secret123',
      new_value: 'newsecret456',
      actor_id: 'user-1',
      actor_email: 'user@example.com',
      timestamp: '2024-01-02T10:00:00Z',
    },
    {
      id: 'hist-3',
      variable_id: 'var-2',
      variable_key: 'DB_URL',
      action: 'Deleted',
      old_value: 'postgres://localhost',
      new_value: null,
      actor_id: 'user-2',
      actor_email: 'admin@example.com',
      timestamp: '2024-01-03T10:00:00Z',
    },
  ];

  beforeEach(() => {
    mockInvoke = invoke as ReturnType<typeof vi.fn>;
    mockInvoke.mockReset();

    TestBed.configureTestingModule({
      providers: [HistoryService],
    });

    service = TestBed.inject(HistoryService);
  });

  afterEach(() => {
    service.clear();
  });

  describe('Initial State', () => {
    it('should be created', () => {
      expect(service).toBeTruthy();
    });

    it('should have empty history initially', () => {
      expect(service.history()).toEqual([]);
    });

    it('should have zero total count initially', () => {
      expect(service.totalCount()).toBe(0);
    });

    it('should not be loading initially', () => {
      expect(service.loading()).toBe(false);
    });

    it('should have empty filtered history initially', () => {
      expect(service.filteredHistory()).toEqual([]);
    });
  });

  describe('loadHistory', () => {
    it('should load history entries successfully', async () => {
      const query: HistoryQuery = { variable_id: 'var-1' };
      mockInvoke.mockResolvedValue({
        entries: mockHistoryEntries.slice(0, 2),
        total_count: 2,
      });

      await service.loadHistory(query);

      expect(mockInvoke).toHaveBeenCalledWith('get_variable_history', { query });
      expect(service.history().length).toBe(2);
      expect(service.totalCount()).toBe(2);
    });

    it('should set loading state during load', async () => {
      const query: HistoryQuery = { variable_id: 'var-1' };
      let loadingDuringCall = false;

      mockInvoke.mockImplementation(async () => {
        loadingDuringCall = service.loading();
        return { entries: [], total_count: 0 };
      });

      await service.loadHistory(query);

      expect(loadingDuringCall).toBe(true);
      expect(service.loading()).toBe(false);
    });

    it('should handle empty results', async () => {
      const query: HistoryQuery = { variable_id: 'nonexistent' };
      mockInvoke.mockResolvedValue({ entries: [], total_count: 0 });

      await service.loadHistory(query);

      expect(service.history()).toEqual([]);
      expect(service.totalCount()).toBe(0);
    });

    it('should throw error on failure', async () => {
      const query: HistoryQuery = { variable_id: 'var-1' };
      mockInvoke.mockRejectedValue(new Error('Database error'));

      await expect(service.loadHistory(query)).rejects.toThrow('Database error');
    });

    it('should reset loading state on error', async () => {
      const query: HistoryQuery = { variable_id: 'var-1' };
      mockInvoke.mockRejectedValue(new Error('Database error'));

      try {
        await service.loadHistory(query);
      } catch {
        // Expected error
      }

      expect(service.loading()).toBe(false);
    });

    it('should load history with pagination query', async () => {
      const query: HistoryQuery = {
        variable_id: 'var-1',
        limit: 10,
        offset: 20,
      };
      mockInvoke.mockResolvedValue({ entries: [], total_count: 100 });

      await service.loadHistory(query);

      expect(mockInvoke).toHaveBeenCalledWith('get_variable_history', { query });
    });

    it('should load history with date range query', async () => {
      const query: HistoryQuery = {
        from_date: '2024-01-01',
        to_date: '2024-12-31',
      };
      mockInvoke.mockResolvedValue({ entries: mockHistoryEntries, total_count: 3 });

      await service.loadHistory(query);

      expect(service.history().length).toBe(3);
    });

    it('should load history by action type', async () => {
      const query: HistoryQuery = { action: 'Updated' };
      mockInvoke.mockResolvedValue({
        entries: [mockHistoryEntries[1]],
        total_count: 1,
      });

      await service.loadHistory(query);

      expect(service.history()[0].action).toBe('Updated');
    });
  });

  describe('restoreVersion', () => {
    it('should restore variable to previous version', async () => {
      mockInvoke.mockResolvedValue(undefined);

      await service.restoreVersion('hist-1');

      expect(mockInvoke).toHaveBeenCalledWith('restore_variable_version', {
        historyId: 'hist-1',
      });
    });

    it('should throw error on restore failure', async () => {
      mockInvoke.mockRejectedValue(new Error('Version not found'));

      await expect(service.restoreVersion('invalid')).rejects.toThrow(
        'Version not found'
      );
    });
  });

  describe('exportHistory', () => {
    it('should export history to JSON format', async () => {
      const options = { format: 'json', variable_id: 'var-1' };
      const exportedData = JSON.stringify(mockHistoryEntries);
      mockInvoke.mockResolvedValue(exportedData);

      const result = await service.exportHistory(options);

      expect(mockInvoke).toHaveBeenCalledWith('export_variable_history', { options });
      expect(result).toBe(exportedData);
    });

    it('should export history to CSV format', async () => {
      const options = { format: 'csv', variable_id: 'var-1' };
      const exportedData = 'id,variable_id,action\nhist-1,var-1,Created';
      mockInvoke.mockResolvedValue(exportedData);

      const result = await service.exportHistory(options);

      expect(result).toContain('id,variable_id,action');
    });

    it('should throw error on export failure', async () => {
      const options = { format: 'json', variable_id: 'var-1' };
      mockInvoke.mockRejectedValue(new Error('Export failed'));

      await expect(service.exportHistory(options)).rejects.toThrow('Export failed');
    });
  });

  describe('recordHistory', () => {
    it('should record a new history entry', async () => {
      const entry = {
        variable_id: 'var-1',
        variable_key: 'NEW_KEY',
        action: 'Created' as const,
        old_value: null,
        new_value: 'value',
        actor_id: 'user-1',
        actor_email: 'user@example.com',
      };
      mockInvoke.mockResolvedValue(undefined);

      await service.recordHistory(entry);

      expect(mockInvoke).toHaveBeenCalledWith('save_variable_history', { entry });
    });

    it('should throw error on record failure', async () => {
      const entry = {
        variable_id: 'var-1',
        variable_key: 'KEY',
        action: 'Created' as const,
        old_value: null,
        new_value: 'value',
        actor_id: 'user-1',
        actor_email: 'user@example.com',
      };
      mockInvoke.mockRejectedValue(new Error('Failed to save'));

      await expect(service.recordHistory(entry)).rejects.toThrow('Failed to save');
    });
  });

  describe('clear', () => {
    it('should clear all history state', async () => {
      const query: HistoryQuery = { variable_id: 'var-1' };
      mockInvoke.mockResolvedValue({
        entries: mockHistoryEntries,
        total_count: 3,
      });

      await service.loadHistory(query);
      expect(service.history().length).toBe(3);

      service.clear();

      expect(service.history()).toEqual([]);
      expect(service.totalCount()).toBe(0);
    });
  });

  describe('filteredHistory', () => {
    it('should return current history as filtered history', async () => {
      const query: HistoryQuery = { variable_id: 'var-1' };
      mockInvoke.mockResolvedValue({
        entries: mockHistoryEntries,
        total_count: 3,
      });

      await service.loadHistory(query);

      expect(service.filteredHistory()).toEqual(service.history());
    });
  });

  describe('Edge Cases', () => {
    it('should handle history with null old_value (Created action)', async () => {
      const query: HistoryQuery = { action: 'Created' };
      mockInvoke.mockResolvedValue({
        entries: [mockHistoryEntries[0]],
        total_count: 1,
      });

      await service.loadHistory(query);

      expect(service.history()[0].old_value).toBeNull();
    });

    it('should handle history with null new_value (Deleted action)', async () => {
      const query: HistoryQuery = { action: 'Deleted' };
      mockInvoke.mockResolvedValue({
        entries: [mockHistoryEntries[2]],
        total_count: 1,
      });

      await service.loadHistory(query);

      expect(service.history()[0].new_value).toBeNull();
    });

    it('should handle multiple sequential loads', async () => {
      const query1: HistoryQuery = { variable_id: 'var-1' };
      const query2: HistoryQuery = { variable_id: 'var-2' };

      mockInvoke.mockResolvedValueOnce({
        entries: [mockHistoryEntries[0]],
        total_count: 1,
      });

      await service.loadHistory(query1);
      expect(service.history().length).toBe(1);

      mockInvoke.mockResolvedValueOnce({
        entries: [mockHistoryEntries[2]],
        total_count: 1,
      });

      await service.loadHistory(query2);
      expect(service.history().length).toBe(1);
      expect(service.history()[0].variable_id).toBe('var-2');
    });

    it('should handle large history datasets', async () => {
      const largeHistory = Array.from({ length: 1000 }, (_, i) => ({
        ...mockHistoryEntries[0],
        id: `hist-${i}`,
      }));

      mockInvoke.mockResolvedValue({
        entries: largeHistory,
        total_count: 1000,
      });

      await service.loadHistory({ limit: 1000 });

      expect(service.history().length).toBe(1000);
      expect(service.totalCount()).toBe(1000);
    });
  });
});
