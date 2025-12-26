import { Injectable, signal, computed } from '@angular/core';
import { invoke } from '@tauri-apps/api/core';
import { VariableHistory, HistoryQuery, HistoryExportOptions } from '../models';

@Injectable({
  providedIn: 'root'
})
export class HistoryService {
  // State
  private _history = signal<VariableHistory[]>([]);
  private _totalCount = signal(0);
  private _loading = signal(false);
  private _currentFilters = signal<HistoryQuery | null>(null);

  // Public read-only signals
  readonly history = this._history.asReadonly();
  readonly totalCount = this._totalCount.asReadonly();
  readonly loading = this._loading.asReadonly();

  // Computed filtered history (in case we want client-side filtering too)
  readonly filteredHistory = computed(() => {
    return this._history();
  });

  /**
   * Load variable history from the database
   */
  async loadHistory(query: HistoryQuery): Promise<void> {
    this._loading.set(true);
    this._currentFilters.set(query);

    try {
      const result = await invoke<{ entries: VariableHistory[]; total_count: number }>(
        'get_variable_history',
        { query }
      );

      this._history.set(result.entries);
      this._totalCount.set(result.total_count);
    } catch (error) {
      console.error('Failed to load history:', error);
      throw error;
    } finally {
      this._loading.set(false);
    }
  }

  /**
   * Restore a variable to a previous version
   */
  async restoreVersion(historyId: string): Promise<void> {
    try {
      await invoke('restore_variable_version', { historyId });
    } catch (error) {
      console.error('Failed to restore version:', error);
      throw error;
    }
  }

  /**
   * Export history to CSV or JSON
   */
  async exportHistory(options: HistoryExportOptions): Promise<string> {
    try {
      const data = await invoke<string>('export_variable_history', { options });
      return data;
    } catch (error) {
      console.error('Failed to export history:', error);
      throw error;
    }
  }

  /**
   * Record a history entry (called internally by variable operations)
   */
  async recordHistory(entry: Omit<VariableHistory, 'id' | 'timestamp'>): Promise<void> {
    try {
      await invoke('save_variable_history', { entry });
    } catch (error) {
      console.error('Failed to record history:', error);
      throw error;
    }
  }

  /**
   * Clear the current history state
   */
  clear(): void {
    this._history.set([]);
    this._totalCount.set(0);
    this._currentFilters.set(null);
  }
}
