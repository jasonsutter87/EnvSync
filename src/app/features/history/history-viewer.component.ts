import { Component, Input, OnInit, computed, signal, inject, effect } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { HistoryService } from '../../core/services/history.service';
import { VariableHistory, getChangeTypeLabel, getChangeTypeIcon } from '../../core/models';

@Component({
  selector: 'app-history-viewer',
  standalone: true,
  imports: [CommonModule, FormsModule],
  template: `
    <div class="history-viewer">
      <!-- Header with filters -->
      <div class="header">
        <h2 class="title">Variable History</h2>

        <div class="filters">
          <!-- Date Range Filter -->
          <div class="filter-group">
            <label for="date-from">From:</label>
            <input
              id="date-from"
              type="date"
              [value]="dateRangeFrom() || ''"
              (change)="onDateFromChange($event)"
              class="filter-input"
            />
          </div>

          <div class="filter-group">
            <label for="date-to">To:</label>
            <input
              id="date-to"
              type="date"
              [value]="dateRangeTo() || ''"
              (change)="onDateToChange($event)"
              class="filter-input"
            />
          </div>

          <!-- User Filter -->
          <div class="filter-group">
            <label for="user-filter">User:</label>
            <select
              id="user-filter"
              [value]="selectedUserFilter() || ''"
              (change)="onUserFilterChange($event)"
              class="filter-select"
            >
              <option value="">All Users</option>
              @for (user of getUniqueUsers(); track user) {
                <option [value]="user">{{ user }}</option>
              }
            </select>
          </div>

          <!-- Variable Filter -->
          <div class="filter-group">
            <label for="variable-filter">Variable:</label>
            <select
              id="variable-filter"
              [value]="selectedVariableFilter() || ''"
              (change)="onVariableFilterChange($event)"
              class="filter-select"
            >
              <option value="">All Variables</option>
              @for (variable of getUniqueVariables(); track variable) {
                <option [value]="variable">{{ variable }}</option>
              }
            </select>
          </div>

          <button
            class="btn-secondary"
            (click)="clearFilters()"
            [disabled]="!hasActiveFilters()"
          >
            Clear Filters
          </button>

          <!-- Export Buttons -->
          <div class="export-buttons">
            <button class="btn-primary" (click)="exportHistory('csv')" title="Export as CSV">
              Export CSV
            </button>
            <button class="btn-primary" (click)="exportHistory('json')" title="Export as JSON">
              Export JSON
            </button>
          </div>

          <!-- Toggle Secret Visibility -->
          <button
            class="btn-toggle"
            (click)="toggleSecrets()"
            [class.active]="showSecrets()"
          >
            {{ showSecrets() ? 'Hide' : 'Show' }} Secrets
          </button>
        </div>
      </div>

      <!-- Error Message -->
      @if (errorMessage()) {
        <div class="error-message">
          <span class="error-icon">⚠</span>
          {{ errorMessage() }}
          <button class="close-error" (click)="clearError()">×</button>
        </div>
      }

      <!-- Compare View -->
      @if (compareVersions().length === 2) {
        <div class="compare-view">
          <div class="compare-header">
            <h3>Comparing Versions</h3>
            <button class="btn-secondary" (click)="clearComparison()">Close Comparison</button>
          </div>
          <div class="compare-content">
            <div class="compare-column">
              <h4>Version 1</h4>
              <div class="version-details">
                <p><strong>Changed By:</strong> {{ compareVersions()[0].changed_by }}</p>
                <p><strong>Timestamp:</strong> {{ formatTimestamp(compareVersions()[0].timestamp) }}</p>
                <p><strong>Variable:</strong> {{ compareVersions()[0].variable_key }}</p>
                <p><strong>Value:</strong> {{ formatValue(compareVersions()[0].new_value) }}</p>
              </div>
            </div>
            <div class="compare-column">
              <h4>Version 2</h4>
              <div class="version-details">
                <p><strong>Changed By:</strong> {{ compareVersions()[1].changed_by }}</p>
                <p><strong>Timestamp:</strong> {{ formatTimestamp(compareVersions()[1].timestamp) }}</p>
                <p><strong>Variable:</strong> {{ compareVersions()[1].variable_key }}</p>
                <p><strong>Value:</strong> {{ formatValue(compareVersions()[1].new_value) }}</p>
              </div>
            </div>
          </div>
          <div class="diff-summary">
            <p>{{ getVersionDiff() }}</p>
          </div>
        </div>
      }

      <!-- Loading State -->
      @if (historyService.loading()) {
        <div class="loading">
          <div class="spinner"></div>
          <p>Loading history...</p>
        </div>
      }

      <!-- Empty State -->
      @if (!historyService.loading() && historyService.filteredHistory().length === 0) {
        <div class="empty-state">
          <div class="empty-icon">📜</div>
          @if (hasActiveFilters()) {
            <p class="empty-state-message">No history matches your filters</p>
            <button class="btn-primary" (click)="clearFilters()">Clear Filters</button>
          } @else {
            <p class="empty-state-message">No history recorded yet</p>
          }
        </div>
      }

      <!-- Timeline View -->
      @if (!historyService.loading() && historyService.filteredHistory().length > 0) {
        <div class="timeline">
          @for (entry of historyService.filteredHistory(); track entry.id; let idx = $index) {
            <div class="timeline-entry" [class.selected]="isVersionSelected(entry)">
              <div
                class="change-indicator"
                [attr.data-change-type]="entry.change_type"
                [title]="getChangeTypeLabel(entry.change_type)"
              >
                {{ getChangeTypeIcon(entry.change_type) }}
              </div>

              <div class="timeline-content">
                <div class="timeline-header">
                  <div class="timeline-meta">
                    <span class="variable-key">{{ entry.variable_key }}</span>
                    <span class="change-type">{{ getChangeTypeLabel(entry.change_type) }}</span>
                  </div>
                  <div class="timeline-actions">
                    <button
                      class="btn-icon"
                      (click)="toggleVersionSelection(entry)"
                      [title]="isVersionSelected(entry) ? 'Deselect for comparison' : 'Select for comparison'"
                      [disabled]="!canSelectForComparison(entry)"
                    >
                      {{ isVersionSelected(entry) ? '☑' : '☐' }}
                    </button>
                    <button
                      class="btn-icon restore-btn"
                      (click)="restoreVersion(entry)"
                      [disabled]="idx === 0"
                      [title]="idx === 0 ? 'This is the current version' : 'Restore this version'"
                    >
                      ↻
                    </button>
                  </div>
                </div>

                <div class="timeline-info">
                  <div class="user-info">
                    <span class="user-email">{{ entry.changed_by || 'Unknown user' }}</span>
                    @if (entry.ip_address) {
                      <span class="ip-address" title="IP Address">{{ entry.ip_address }}</span>
                    }
                  </div>
                  <span class="timestamp">{{ formatTimestamp(entry.timestamp) }}</span>
                </div>

                <div class="timeline-changes">
                  @if (entry.old_value !== null) {
                    <div class="value-change">
                      <label>Old Value:</label>
                      <span class="old-value" [class.masked-value]="!showSecrets()">
                        {{ formatValue(entry.old_value) }}
                      </span>
                    </div>
                  } @else {
                    <div class="value-change">
                      <label>Old Value:</label>
                      <span class="old-value">None</span>
                    </div>
                  }

                  @if (entry.new_value !== null) {
                    <div class="value-change">
                      <label>New Value:</label>
                      <span class="new-value" [class.masked-value]="!showSecrets()">
                        {{ formatValue(entry.new_value) }}
                      </span>
                    </div>
                  } @else {
                    <div class="value-change">
                      <label>New Value:</label>
                      <span class="new-value">Deleted</span>
                    </div>
                  }
                </div>

                @if (entry.user_agent) {
                  <div class="timeline-metadata">
                    <span class="user-agent" title="User Agent">{{ entry.user_agent }}</span>
                  </div>
                }
              </div>
            </div>
          }
        </div>

        <!-- Pagination -->
        @if (totalPages() > 1) {
          <div class="pagination">
            <button
              class="btn-secondary"
              (click)="previousPage()"
              [disabled]="!canGoPrevious()"
            >
              Previous
            </button>

            <div class="page-info">
              <span>Page {{ currentPage() }} of {{ totalPages() }}</span>
              <select
                class="page-size-select"
                [value]="pageSize()"
                (change)="onPageSizeChange($event)"
              >
                <option value="10">10 per page</option>
                <option value="20">20 per page</option>
                <option value="50">50 per page</option>
                <option value="100">100 per page</option>
              </select>
            </div>

            <button
              class="btn-secondary"
              (click)="nextPage()"
              [disabled]="!canGoNext()"
            >
              Next
            </button>
          </div>
        }
      }
    </div>
  `,
  styles: [`
    .history-viewer {
      background: var(--bg-primary, #0f0f1e);
      border-radius: 12px;
      padding: 24px;
      color: var(--text-primary, #e0e0e0);
    }

    .header {
      margin-bottom: 24px;
    }

    .title {
      font-size: 24px;
      font-weight: 600;
      margin: 0 0 16px 0;
    }

    .filters {
      display: flex;
      flex-wrap: wrap;
      gap: 12px;
      align-items: flex-end;
    }

    .filter-group {
      display: flex;
      flex-direction: column;
      gap: 4px;
    }

    .filter-group label {
      font-size: 12px;
      color: var(--text-secondary, #888);
    }

    .filter-input,
    .filter-select {
      padding: 8px 12px;
      border: 1px solid var(--border-color, #333);
      border-radius: 6px;
      background: var(--bg-secondary, #1a1a2e);
      color: var(--text-primary, #e0e0e0);
      font-size: 14px;
      min-width: 150px;
    }

    .filter-select {
      cursor: pointer;
    }

    .export-buttons {
      display: flex;
      gap: 8px;
    }

    .btn-primary,
    .btn-secondary,
    .btn-toggle,
    .btn-icon {
      padding: 8px 16px;
      border: none;
      border-radius: 6px;
      font-size: 14px;
      cursor: pointer;
      transition: all 0.2s;
    }

    .btn-primary {
      background: var(--primary-color, #6366f1);
      color: white;
    }

    .btn-primary:hover:not(:disabled) {
      background: var(--primary-hover, #4f46e5);
    }

    .btn-secondary {
      background: var(--bg-tertiary, #252540);
      color: var(--text-secondary, #888);
    }

    .btn-secondary:hover:not(:disabled) {
      background: var(--bg-hover, #2a2a4a);
    }

    .btn-toggle {
      background: var(--bg-secondary, #1a1a2e);
      color: var(--text-secondary, #888);
      border: 1px solid var(--border-color, #333);
    }

    .btn-toggle.active {
      background: var(--primary-color, #6366f1);
      color: white;
      border-color: var(--primary-color, #6366f1);
    }

    .btn-icon {
      padding: 4px 8px;
      background: transparent;
      color: var(--text-secondary, #888);
      font-size: 16px;
    }

    .btn-icon:hover:not(:disabled) {
      color: var(--primary-color, #6366f1);
    }

    button:disabled {
      opacity: 0.5;
      cursor: not-allowed;
    }

    .error-message {
      background: rgba(239, 68, 68, 0.1);
      border: 1px solid rgba(239, 68, 68, 0.3);
      border-radius: 8px;
      padding: 12px 16px;
      margin-bottom: 16px;
      display: flex;
      align-items: center;
      gap: 8px;
      color: #ef4444;
    }

    .error-icon {
      font-size: 18px;
    }

    .close-error {
      margin-left: auto;
      background: none;
      border: none;
      color: #ef4444;
      cursor: pointer;
      font-size: 20px;
      padding: 0;
      width: 24px;
      height: 24px;
    }

    .compare-view {
      background: var(--bg-secondary, #1a1a2e);
      border-radius: 8px;
      padding: 16px;
      margin-bottom: 24px;
      border: 2px solid var(--primary-color, #6366f1);
    }

    .compare-header {
      display: flex;
      justify-content: space-between;
      align-items: center;
      margin-bottom: 16px;
    }

    .compare-header h3 {
      margin: 0;
      font-size: 18px;
    }

    .compare-content {
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: 16px;
      margin-bottom: 16px;
    }

    .compare-column {
      background: var(--bg-primary, #0f0f1e);
      border-radius: 6px;
      padding: 12px;
    }

    .compare-column h4 {
      margin: 0 0 12px 0;
      font-size: 14px;
      color: var(--primary-color, #6366f1);
    }

    .version-details p {
      margin: 4px 0;
      font-size: 13px;
    }

    .diff-summary {
      background: var(--bg-tertiary, #252540);
      border-radius: 6px;
      padding: 12px;
      font-size: 14px;
      font-style: italic;
    }

    .loading {
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      padding: 64px 0;
      gap: 16px;
    }

    .spinner {
      width: 48px;
      height: 48px;
      border: 4px solid var(--border-color, #333);
      border-top-color: var(--primary-color, #6366f1);
      border-radius: 50%;
      animation: spin 1s linear infinite;
    }

    @keyframes spin {
      to { transform: rotate(360deg); }
    }

    .empty-state {
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      padding: 64px 0;
      gap: 16px;
    }

    .empty-icon {
      font-size: 64px;
      opacity: 0.5;
    }

    .empty-state-message {
      font-size: 16px;
      color: var(--text-secondary, #888);
    }

    .timeline {
      display: flex;
      flex-direction: column;
      gap: 16px;
    }

    .timeline-entry {
      display: flex;
      gap: 16px;
      background: var(--bg-secondary, #1a1a2e);
      border-radius: 8px;
      padding: 16px;
      transition: all 0.2s;
      border: 2px solid transparent;
    }

    .timeline-entry:hover {
      background: var(--bg-hover, #252540);
    }

    .timeline-entry.selected {
      border-color: var(--primary-color, #6366f1);
    }

    .change-indicator {
      width: 40px;
      height: 40px;
      border-radius: 8px;
      display: flex;
      align-items: center;
      justify-content: center;
      font-size: 18px;
      flex-shrink: 0;
    }

    .change-indicator[data-change-type="Create"] {
      background: rgba(34, 197, 94, 0.2);
      color: #22c55e;
    }

    .change-indicator[data-change-type="Update"] {
      background: rgba(59, 130, 246, 0.2);
      color: #3b82f6;
    }

    .change-indicator[data-change-type="Delete"] {
      background: rgba(239, 68, 68, 0.2);
      color: #ef4444;
    }

    .change-indicator[data-change-type="Restore"] {
      background: rgba(168, 85, 247, 0.2);
      color: #a855f7;
    }

    .timeline-content {
      flex: 1;
      min-width: 0;
    }

    .timeline-header {
      display: flex;
      justify-content: space-between;
      align-items: center;
      margin-bottom: 8px;
    }

    .timeline-meta {
      display: flex;
      align-items: center;
      gap: 12px;
    }

    .variable-key {
      font-family: monospace;
      font-size: 14px;
      font-weight: 600;
      background: var(--bg-tertiary, #252540);
      padding: 4px 8px;
      border-radius: 4px;
    }

    .change-type {
      font-size: 12px;
      color: var(--text-secondary, #888);
    }

    .timeline-actions {
      display: flex;
      gap: 4px;
    }

    .timeline-info {
      display: flex;
      justify-content: space-between;
      align-items: center;
      margin-bottom: 12px;
      font-size: 13px;
    }

    .user-info {
      display: flex;
      align-items: center;
      gap: 8px;
    }

    .user-email {
      color: var(--primary-color, #6366f1);
    }

    .ip-address {
      font-size: 11px;
      color: var(--text-tertiary, #666);
      font-family: monospace;
    }

    .timestamp {
      color: var(--text-secondary, #888);
      font-size: 12px;
    }

    .timeline-changes {
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: 12px;
      background: var(--bg-primary, #0f0f1e);
      padding: 12px;
      border-radius: 6px;
    }

    .value-change {
      display: flex;
      flex-direction: column;
      gap: 4px;
    }

    .value-change label {
      font-size: 11px;
      color: var(--text-secondary, #888);
      text-transform: uppercase;
      letter-spacing: 0.5px;
    }

    .old-value,
    .new-value {
      font-family: monospace;
      font-size: 13px;
      word-break: break-all;
      padding: 6px;
      background: var(--bg-secondary, #1a1a2e);
      border-radius: 4px;
    }

    .masked-value {
      filter: blur(4px);
      user-select: none;
    }

    .timeline-metadata {
      margin-top: 8px;
      font-size: 11px;
      color: var(--text-tertiary, #666);
    }

    .user-agent {
      font-family: monospace;
    }

    .pagination {
      display: flex;
      justify-content: space-between;
      align-items: center;
      margin-top: 24px;
      padding-top: 24px;
      border-top: 1px solid var(--border-color, #333);
    }

    .page-info {
      display: flex;
      align-items: center;
      gap: 12px;
      font-size: 14px;
      color: var(--text-secondary, #888);
    }

    .page-size-select {
      padding: 6px 10px;
      border: 1px solid var(--border-color, #333);
      border-radius: 6px;
      background: var(--bg-secondary, #1a1a2e);
      color: var(--text-primary, #e0e0e0);
      font-size: 13px;
      cursor: pointer;
    }
  `]
})
export class HistoryViewerComponent implements OnInit {
  protected readonly historyService = inject(HistoryService);

  // Inputs
  projectId = signal<string | null>(null);
  environmentId = signal<string | null>(null);

  @Input() set project(id: string) {
    this.projectId.set(id);
  }

  @Input() set environment(id: string) {
    this.environmentId.set(id);
  }

  // Filters
  selectedVariableFilter = signal<string | null>(null);
  selectedUserFilter = signal<string | null>(null);
  dateRangeFrom = signal<string | null>(null);
  dateRangeTo = signal<string | null>(null);

  // Pagination
  currentPage = signal(1);
  pageSize = signal(20);

  // UI State
  showSecrets = signal(false);
  compareVersions = signal<VariableHistory[]>([]);
  selectedVersion = signal<VariableHistory | null>(null);
  errorMessage = signal<string | null>(null);

  // Computed
  totalPages = computed(() => {
    const total = this.historyService.totalCount();
    const size = this.pageSize();
    return Math.ceil(total / size);
  });

  canGoPrevious = computed(() => this.currentPage() > 1);
  canGoNext = computed(() => this.currentPage() < this.totalPages());

  // Helper methods for template
  getChangeTypeLabel = getChangeTypeLabel;
  getChangeTypeIcon = getChangeTypeIcon;

  constructor() {
    // Auto-reload when filters change
    effect(() => {
      const projectId = this.projectId();
      if (projectId) {
        this.loadHistory();
      }
    }, { allowSignalWrites: true });
  }

  ngOnInit(): void {
    if (this.projectId()) {
      this.loadHistory();
    }
  }

  async loadHistory(): Promise<void> {
    const projectId = this.projectId();
    if (!projectId) return;

    try {
      const query: any = {
        project_id: projectId,
        limit: this.pageSize(),
        offset: (this.currentPage() - 1) * this.pageSize()
      };

      if (this.environmentId()) {
        query.environment_id = this.environmentId();
      }

      if (this.selectedVariableFilter()) {
        query.variable_key = this.selectedVariableFilter();
      }

      if (this.selectedUserFilter()) {
        query.changed_by = this.selectedUserFilter();
      }

      if (this.dateRangeFrom()) {
        query.from_date = this.dateRangeFrom();
      }

      if (this.dateRangeTo()) {
        query.to_date = this.dateRangeTo();
      }

      await this.historyService.loadHistory(query);
      this.errorMessage.set(null);
    } catch (error) {
      this.errorMessage.set(
        error instanceof Error ? error.message : 'Failed to load history'
      );
    }
  }

  applyFilters(): void {
    this.currentPage.set(1);
    this.loadHistory();
  }

  clearFilters(): void {
    this.selectedVariableFilter.set(null);
    this.selectedUserFilter.set(null);
    this.dateRangeFrom.set(null);
    this.dateRangeTo.set(null);
    this.applyFilters();
  }

  hasActiveFilters(): boolean {
    return !!(
      this.selectedVariableFilter() ||
      this.selectedUserFilter() ||
      this.dateRangeFrom() ||
      this.dateRangeTo()
    );
  }

  getUniqueUsers(): string[] {
    const history = this.historyService.history();
    const users = new Set<string>();
    history.forEach(entry => {
      if (entry.changed_by) {
        users.add(entry.changed_by);
      }
    });
    return Array.from(users).sort();
  }

  getUniqueVariables(): string[] {
    const history = this.historyService.history();
    const variables = new Set<string>();
    history.forEach(entry => {
      variables.add(entry.variable_key);
    });
    return Array.from(variables).sort();
  }

  formatTimestamp(timestamp: string): string {
    const date = new Date(timestamp);
    const now = new Date();
    const diff = now.getTime() - date.getTime();

    const minutes = Math.floor(diff / 60000);
    const hours = Math.floor(diff / 3600000);
    const days = Math.floor(diff / 86400000);

    if (minutes < 1) return 'just now';
    if (minutes < 60) return `${minutes}m ago`;
    if (hours < 24) return `${hours}h ago`;
    if (days < 7) return `${days}d ago`;

    return date.toLocaleString(undefined, {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  }

  formatValue(value: string | null): string {
    if (value === null) return '';
    if (!this.showSecrets()) {
      return '•'.repeat(Math.min(value.length, 20));
    }
    return value;
  }

  toggleSecrets(): void {
    this.showSecrets.update(v => !v);
  }

  async restoreVersion(entry: VariableHistory): Promise<void> {
    const confirmed = confirm(
      `Are you sure you want to restore "${entry.variable_key}" to the value from ${this.formatTimestamp(entry.timestamp)}?`
    );

    if (!confirmed) return;

    try {
      await this.historyService.restoreVersion(entry.id);
      this.errorMessage.set(null);
      await this.loadHistory();
    } catch (error) {
      this.errorMessage.set(
        error instanceof Error ? error.message : 'Failed to restore version'
      );
    }
  }

  toggleVersionSelection(entry: VariableHistory): void {
    const current = this.compareVersions();
    const index = current.findIndex(v => v.id === entry.id);

    if (index >= 0) {
      // Remove if already selected
      this.compareVersions.set(current.filter(v => v.id !== entry.id));
    } else {
      // Add if less than 2 selected
      if (current.length < 2) {
        this.compareVersions.set([...current, entry]);
      } else {
        // Replace oldest selection
        this.compareVersions.set([current[1], entry]);
      }
    }
  }

  isVersionSelected(entry: VariableHistory): boolean {
    return this.compareVersions().some(v => v.id === entry.id);
  }

  canSelectForComparison(entry: VariableHistory): boolean {
    const current = this.compareVersions();
    return current.length < 2 || this.isVersionSelected(entry);
  }

  clearComparison(): void {
    this.compareVersions.set([]);
  }

  getVersionDiff(): string {
    const versions = this.compareVersions();
    if (versions.length !== 2) return '';

    const [v1, v2] = versions;

    if (v1.variable_key !== v2.variable_key) {
      return 'These changes are for different variables';
    }

    if (v1.new_value === v2.new_value) {
      return 'Both versions have the same value';
    }

    return `Value changed from "${this.formatValue(v1.new_value)}" to "${this.formatValue(v2.new_value)}"`;
  }

  async exportHistory(format: 'csv' | 'json'): Promise<void> {
    try {
      const options: any = {
        format,
        project_id: this.projectId()
      };

      if (this.environmentId()) {
        options.environment_id = this.environmentId();
      }

      if (this.selectedVariableFilter()) {
        options.variable_key = this.selectedVariableFilter();
      }

      if (this.selectedUserFilter()) {
        options.changed_by = this.selectedUserFilter();
      }

      if (this.dateRangeFrom()) {
        options.from_date = this.dateRangeFrom();
      }

      if (this.dateRangeTo()) {
        options.to_date = this.dateRangeTo();
      }

      const data = await this.historyService.exportHistory(options);
      this.downloadFile(data, format);
      this.errorMessage.set(null);
    } catch (error) {
      this.errorMessage.set(
        error instanceof Error ? error.message : 'Failed to export history'
      );
    }
  }

  downloadFile(data: string, format: 'csv' | 'json'): void {
    const blob = new Blob([data], {
      type: format === 'csv' ? 'text/csv' : 'application/json'
    });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `history-${new Date().toISOString()}.${format}`;
    link.click();
    URL.revokeObjectURL(url);
  }

  nextPage(): void {
    if (this.canGoNext()) {
      this.currentPage.update(p => p + 1);
      this.loadHistory();
    }
  }

  previousPage(): void {
    if (this.canGoPrevious()) {
      this.currentPage.update(p => p - 1);
      this.loadHistory();
    }
  }

  goToPage(page: number): void {
    if (page >= 1 && page <= this.totalPages()) {
      this.currentPage.set(page);
      this.loadHistory();
    }
  }

  updatePageSize(size: number): void {
    this.pageSize.set(size);
    this.currentPage.set(1);
    this.loadHistory();
  }

  clearError(): void {
    this.errorMessage.set(null);
  }

  // Event handlers for template
  onDateFromChange(event: Event): void {
    const value = (event.target as HTMLInputElement).value;
    this.dateRangeFrom.set(value || null);
    this.applyFilters();
  }

  onDateToChange(event: Event): void {
    const value = (event.target as HTMLInputElement).value;
    this.dateRangeTo.set(value || null);
    this.applyFilters();
  }

  onUserFilterChange(event: Event): void {
    const value = (event.target as HTMLSelectElement).value;
    this.selectedUserFilter.set(value || null);
    this.applyFilters();
  }

  onVariableFilterChange(event: Event): void {
    const value = (event.target as HTMLSelectElement).value;
    this.selectedVariableFilter.set(value || null);
    this.applyFilters();
  }

  onPageSizeChange(event: Event): void {
    const value = parseInt((event.target as HTMLSelectElement).value, 10);
    this.updatePageSize(value);
  }
}
