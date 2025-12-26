import { Component, computed, effect, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { DiffService, DiffResult, DiffEntry, DiffType } from '../../core/services/diff.service';
import { ApiService } from '../../core/services/api.service';
import { CryptoService } from '../../core/services/crypto.service';
import { Environment, Variable } from '../../core/models';

@Component({
  selector: 'app-diff-view',
  standalone: true,
  imports: [CommonModule, FormsModule],
  template: `
    <div class="h-full flex flex-col bg-dark-900">
      <!-- Header -->
      <div class="flex-none border-b border-dark-700 bg-dark-800 px-6 py-4">
        <div class="flex items-center justify-between mb-4">
          <h1 class="text-2xl font-bold text-white">Environment Comparison</h1>
          @if (totalChanges() > 0) {
            <div class="flex items-center gap-4 text-sm">
              <div class="flex items-center gap-2">
                <span class="w-3 h-3 rounded-full bg-green-500"></span>
                <span class="text-dark-300">{{ addedCount() }} added</span>
              </div>
              <div class="flex items-center gap-2">
                <span class="w-3 h-3 rounded-full bg-red-500"></span>
                <span class="text-dark-300">{{ removedCount() }} removed</span>
              </div>
              <div class="flex items-center gap-2">
                <span class="w-3 h-3 rounded-full bg-yellow-500"></span>
                <span class="text-dark-300">{{ modifiedCount() }} modified</span>
              </div>
            </div>
          }
        </div>

        <!-- Environment Selectors -->
        <div class="grid grid-cols-2 gap-4">
          <div>
            <label class="block text-sm font-medium text-dark-300 mb-2">Left Environment</label>
            <select
              [(ngModel)]="leftEnvId"
              (ngModelChange)="onEnvironmentChange()"
              class="input w-full"
            >
              <option [value]="null">Select environment...</option>
              @for (env of environments(); track env.id) {
                <option [value]="env.id" [disabled]="env.id === rightEnvId()">
                  {{ env.name }}
                </option>
              }
            </select>
          </div>

          <div>
            <label class="block text-sm font-medium text-dark-300 mb-2">Right Environment</label>
            <select
              [(ngModel)]="rightEnvId"
              (ngModelChange)="onEnvironmentChange()"
              class="input w-full"
            >
              <option [value]="null">Select environment...</option>
              @for (env of environments(); track env.id) {
                <option [value]="env.id" [disabled]="env.id === leftEnvId()">
                  {{ env.name }}
                </option>
              }
            </select>
          </div>
        </div>

        <!-- Filters and Actions -->
        @if (diffResult()) {
          <div class="flex items-center gap-4 mt-4">
            <!-- Filter by type -->
            <div class="flex-1">
              <select [(ngModel)]="selectedFilter" class="input">
                <option value="all">All Changes ({{ totalChanges() }})</option>
                <option value="added">Added ({{ addedCount() }})</option>
                <option value="removed">Removed ({{ removedCount() }})</option>
                <option value="modified">Modified ({{ modifiedCount() }})</option>
                <option value="unchanged">Unchanged ({{ unchangedCount() }})</option>
              </select>
            </div>

            <!-- Search -->
            <div class="flex-1">
              <input
                type="text"
                [(ngModel)]="searchQuery"
                placeholder="Search variables..."
                class="input w-full"
              />
            </div>

            <!-- Show unchanged toggle -->
            <label class="flex items-center gap-2 text-dark-300 cursor-pointer">
              <input
                type="checkbox"
                [(ngModel)]="showUnchanged"
                class="rounded border-dark-600 bg-dark-700 text-primary-500 focus:ring-primary-500"
              />
              <span class="text-sm">Show unchanged</span>
            </label>

            <!-- Copy to clipboard -->
            <button
              (click)="copyDiffToClipboard()"
              class="btn btn-secondary"
              title="Copy diff to clipboard"
            >
              @if (copySuccess()) {
                <svg class="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 13l4 4L19 7" />
                </svg>
                Copied!
              } @else {
                <svg class="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2"
                    d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
                </svg>
                Copy
              }
            </button>
          </div>
        }
      </div>

      <!-- Error Message -->
      @if (errorMessage()) {
        <div class="flex-none bg-red-900/20 border-l-4 border-red-500 px-6 py-3">
          <p class="text-red-400 text-sm">{{ errorMessage() }}</p>
        </div>
      }

      <!-- Loading State -->
      @if (isLoading()) {
        <div class="flex-1 flex items-center justify-center">
          <div class="text-center">
            <svg class="animate-spin h-8 w-8 text-primary-500 mx-auto mb-4" fill="none" viewBox="0 0 24 24">
              <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle>
              <path class="opacity-75" fill="currentColor"
                d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z">
              </path>
            </svg>
            <p class="text-dark-400">Loading comparison...</p>
          </div>
        </div>
      }

      <!-- Empty State -->
      @else if (!leftEnvId() || !rightEnvId()) {
        <div class="flex-1 flex items-center justify-center">
          <div class="text-center max-w-md px-4">
            <svg class="w-16 h-16 text-dark-600 mx-auto mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2"
                d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
            </svg>
            <h3 class="text-lg font-medium text-white mb-2">Select Environments to Compare</h3>
            <p class="text-dark-400 text-sm">
              Choose two different environments from the dropdowns above to see their differences.
            </p>
          </div>
        </div>
      }

      <!-- No Changes -->
      @else if (diffResult() && totalChanges() === 0 && !showUnchanged()) {
        <div class="flex-1 flex items-center justify-center">
          <div class="text-center max-w-md px-4">
            <svg class="w-16 h-16 text-green-500 mx-auto mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 13l4 4L19 7" />
            </svg>
            <h3 class="text-lg font-medium text-white mb-2">Environments Match</h3>
            <p class="text-dark-400 text-sm">
              These environments have identical variables. No differences found.
            </p>
          </div>
        </div>
      }

      <!-- Diff Results -->
      @else if (diffResult()) {
        <div class="flex-1 overflow-y-auto">
          <div class="px-6 py-4">
            <!-- Diff Entries -->
            @if (filteredDiffEntries().length === 0) {
              <div class="text-center py-12">
                <p class="text-dark-400">No variables match your search or filter.</p>
              </div>
            } @else {
              <div class="space-y-2">
                @for (entry of filteredDiffEntries(); track entry.key) {
                  <div
                    class="rounded-lg border p-4 {{ getDiffClass(entry) }}"
                  >
                    <div class="flex items-start justify-between">
                      <div class="flex-1 min-w-0">
                        <!-- Key and Type Badge -->
                        <div class="flex items-center gap-2 mb-3">
                          <svg class="w-5 h-5 flex-none {{ getDiffIconColor(entry.type) }}" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            @switch (entry.type) {
                              @case ('added') {
                                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 9v3m0 0v3m0-3h3m-3 0H9m12 0a9 9 0 11-18 0 9 9 0 0118 0z" />
                              }
                              @case ('removed') {
                                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 12H9m12 0a9 9 0 11-18 0 9 9 0 0118 0z" />
                              }
                              @case ('modified') {
                                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                              }
                              @case ('unchanged') {
                                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                              }
                            }
                          </svg>
                          <span class="font-mono font-medium text-white">{{ entry.key }}</span>
                          <span class="px-2 py-0.5 rounded text-xs font-medium {{ getTypeBadgeClass(entry.type) }}">
                            {{ entry.type }}
                          </span>
                        </div>

                        <!-- Side-by-side values -->
                        <div class="grid grid-cols-2 gap-4">
                          <!-- Left value -->
                          <div>
                            <div class="text-xs font-medium text-dark-400 mb-1">
                              {{ getLeftEnvironmentName() }}
                            </div>
                            @if (entry.leftValue !== null) {
                              <div class="font-mono text-sm text-white bg-dark-900/50 rounded px-3 py-2 break-all">
                                {{ entry.leftValue }}
                              </div>
                            } @else {
                              <div class="font-mono text-sm text-dark-500 italic bg-dark-900/30 rounded px-3 py-2">
                                (not present)
                              </div>
                            }
                          </div>

                          <!-- Right value -->
                          <div>
                            <div class="text-xs font-medium text-dark-400 mb-1">
                              {{ getRightEnvironmentName() }}
                            </div>
                            @if (entry.rightValue !== null) {
                              <div class="font-mono text-sm text-white bg-dark-900/50 rounded px-3 py-2 break-all">
                                {{ entry.rightValue }}
                              </div>
                            } @else {
                              <div class="font-mono text-sm text-dark-500 italic bg-dark-900/30 rounded px-3 py-2">
                                (not present)
                              </div>
                            }
                          </div>
                        </div>
                      </div>

                      <!-- Merge buttons -->
                      @if (entry.type !== 'unchanged') {
                        <div class="flex flex-col gap-2 ml-4">
                          @if (entry.rightValue !== null) {
                            <button
                              (click)="mergeEntry(entry, 'left-to-right')"
                              class="btn btn-sm btn-secondary"
                              title="Copy to {{ getLeftEnvironmentName() }}"
                            >
                              <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M7 16l-4-4m0 0l4-4m-4 4h18" />
                              </svg>
                            </button>
                          }
                          @if (entry.leftValue !== null) {
                            <button
                              (click)="mergeEntry(entry, 'right-to-left')"
                              class="btn btn-sm btn-secondary"
                              title="Copy to {{ getRightEnvironmentName() }}"
                            >
                              <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M17 8l4 4m0 0l-4 4m4-4H3" />
                              </svg>
                            </button>
                          }
                        </div>
                      }
                    </div>
                  </div>
                }
              </div>
            }
          </div>
        </div>
      }
    </div>
  `,
})
export class DiffViewComponent {
  private readonly diffService = inject(DiffService);
  private readonly apiService = inject(ApiService);
  private readonly cryptoService = inject(CryptoService);

  // Input
  readonly projectId = signal<string>('');

  // State
  readonly environments = signal<Environment[]>([]);
  readonly leftEnvId = signal<string | null>(null);
  readonly rightEnvId = signal<string | null>(null);
  readonly diffResult = signal<DiffResult | null>(null);
  readonly isLoading = signal(false);
  readonly errorMessage = signal<string | null>(null);

  // Filters and search
  readonly selectedFilter = signal<string>('all');
  readonly searchQuery = signal<string>('');
  readonly showUnchanged = signal(false);
  readonly copySuccess = signal(false);

  // Computed values
  readonly addedCount = computed(() => this.diffResult()?.added.length ?? 0);
  readonly removedCount = computed(() => this.diffResult()?.removed.length ?? 0);
  readonly modifiedCount = computed(() => this.diffResult()?.modified.length ?? 0);
  readonly unchangedCount = computed(() => this.diffResult()?.unchanged.length ?? 0);
  readonly totalChanges = computed(() => this.addedCount() + this.removedCount() + this.modifiedCount());

  readonly filteredDiffEntries = computed(() => {
    const result = this.diffResult();
    if (!result) return [];

    let entries: DiffEntry[] = [];

    // Filter by type
    const filter = this.selectedFilter();
    if (filter === 'all') {
      entries = [
        ...result.added,
        ...result.removed,
        ...result.modified,
      ];
      if (this.showUnchanged()) {
        entries.push(...result.unchanged);
      }
    } else {
      entries = this.diffService.filterByType(result, filter);
    }

    // Filter by search query
    const query = this.searchQuery();
    if (query.trim()) {
      entries = this.diffService.filterBySearch(entries, query);
    }

    return entries;
  });

  constructor() {
    // Load environments when projectId changes
    effect(() => {
      const projectId = this.projectId();
      if (projectId) {
        this.loadEnvironments(projectId);
      }
    });

    // Compare environments when both are selected
    effect(() => {
      const leftId = this.leftEnvId();
      const rightId = this.rightEnvId();

      if (leftId && rightId) {
        if (leftId === rightId) {
          this.errorMessage.set('Please select different environments');
          this.diffResult.set(null);
          return;
        }
        this.compareEnvironments(leftId, rightId);
      } else {
        this.diffResult.set(null);
      }
    });
  }

  private async loadEnvironments(projectId: string): Promise<void> {
    try {
      this.errorMessage.set(null);
      const environments = await this.apiService.getEnvironments(projectId).toPromise();
      this.environments.set(environments ?? []);
    } catch (error) {
      this.errorMessage.set('Failed to load environments');
      this.environments.set([]);
    }
  }

  onEnvironmentChange(): void {
    // Clear error when selection changes
    this.errorMessage.set(null);
  }

  private async compareEnvironments(leftEnvId: string, rightEnvId: string): Promise<void> {
    this.isLoading.set(true);
    this.errorMessage.set(null);

    try {
      const projectId = this.projectId();

      // Load variables from both environments
      const [leftVariables, rightVariables] = await Promise.all([
        this.apiService.getVariables(projectId, leftEnvId).toPromise(),
        this.apiService.getVariables(projectId, rightEnvId).toPromise(),
      ]);

      // Compute diff
      const diff = this.diffService.computeDiff(leftVariables ?? [], rightVariables ?? []);
      this.diffResult.set(diff);
    } catch (error) {
      this.errorMessage.set('Failed to load variables');
      this.diffResult.set(null);
    } finally {
      this.isLoading.set(false);
    }
  }

  async copyDiffToClipboard(): Promise<void> {
    const result = this.diffResult();
    if (!result) return;

    try {
      const leftEnvName = this.getLeftEnvironmentName();
      const rightEnvName = this.getRightEnvironmentName();
      const text = this.diffService.formatDiffSummary(result, leftEnvName, rightEnvName);

      await navigator.clipboard.writeText(text);
      this.copySuccess.set(true);

      // Reset success message after 2 seconds
      setTimeout(() => {
        this.copySuccess.set(false);
      }, 2000);
    } catch (error) {
      this.errorMessage.set('Failed to copy to clipboard');
    }
  }

  async mergeEntry(entry: DiffEntry, direction: 'left-to-right' | 'right-to-left'): Promise<void> {
    this.isLoading.set(true);
    this.errorMessage.set(null);

    try {
      const projectId = this.projectId();

      if (direction === 'left-to-right') {
        // Copy from left to right
        const targetEnvId = this.rightEnvId()!;

        if (entry.type === 'removed') {
          // Delete from right
          if (entry.rightVariable) {
            await this.apiService.deleteVariable(projectId, targetEnvId, entry.rightVariable.id).toPromise();
          }
        } else if (entry.type === 'added') {
          // Copy to left
          const sourceEnvId = this.leftEnvId()!;
          if (entry.rightVariable) {
            const encrypted = await this.cryptoService.encrypt(entry.rightVariable.value);
            await this.apiService.createVariable(
              projectId,
              sourceEnvId,
              entry.rightVariable.key,
              encrypted.ciphertext,
              encrypted.nonce,
              entry.rightVariable.is_secret
            ).toPromise();
          }
        } else if (entry.type === 'modified') {
          // Update right with left value
          if (entry.leftVariable && entry.rightVariable) {
            const encrypted = await this.cryptoService.encrypt(entry.leftVariable.value);
            await this.apiService.updateVariable(
              projectId,
              targetEnvId,
              entry.rightVariable.id,
              entry.rightVariable.key,
              encrypted.ciphertext,
              encrypted.nonce,
              entry.rightVariable.is_secret
            ).toPromise();
          }
        }
      } else {
        // Copy from right to left
        const targetEnvId = this.leftEnvId()!;

        if (entry.type === 'added') {
          // Delete from left
          if (entry.leftVariable) {
            await this.apiService.deleteVariable(projectId, targetEnvId, entry.leftVariable.id).toPromise();
          }
        } else if (entry.type === 'removed') {
          // Copy to right
          const sourceEnvId = this.rightEnvId()!;
          if (entry.leftVariable) {
            const encrypted = await this.cryptoService.encrypt(entry.leftVariable.value);
            await this.apiService.createVariable(
              projectId,
              sourceEnvId,
              entry.leftVariable.key,
              encrypted.ciphertext,
              encrypted.nonce,
              entry.leftVariable.is_secret
            ).toPromise();
          }
        } else if (entry.type === 'modified') {
          // Update left with right value
          if (entry.rightVariable && entry.leftVariable) {
            const encrypted = await this.cryptoService.encrypt(entry.rightVariable.value);
            await this.apiService.updateVariable(
              projectId,
              targetEnvId,
              entry.leftVariable.id,
              entry.leftVariable.key,
              encrypted.ciphertext,
              encrypted.nonce,
              entry.leftVariable.is_secret
            ).toPromise();
          }
        }
      }

      // Refresh the diff
      const leftId = this.leftEnvId();
      const rightId = this.rightEnvId();
      if (leftId && rightId) {
        await this.compareEnvironments(leftId, rightId);
      }
    } catch (error) {
      this.errorMessage.set('Failed to merge variable');
    } finally {
      this.isLoading.set(false);
    }
  }

  getDiffClass(entry: DiffEntry): string {
    switch (entry.type) {
      case 'added':
        return 'bg-green-900/20 border-green-500/30';
      case 'removed':
        return 'bg-red-900/20 border-red-500/30';
      case 'modified':
        return 'bg-yellow-900/20 border-yellow-500/30';
      case 'unchanged':
        return 'bg-dark-800/50 border-dark-700';
      default:
        return 'bg-dark-800 border-dark-700';
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
      case 'unchanged':
        return 'check-circle';
      default:
        return 'circle';
    }
  }

  getDiffIconColor(type: DiffType): string {
    switch (type) {
      case 'added':
        return 'text-green-400';
      case 'removed':
        return 'text-red-400';
      case 'modified':
        return 'text-yellow-400';
      case 'unchanged':
        return 'text-dark-500';
      default:
        return 'text-dark-500';
    }
  }

  getTypeBadgeClass(type: DiffType): string {
    switch (type) {
      case 'added':
        return 'bg-green-900/30 text-green-400 border border-green-500/30';
      case 'removed':
        return 'bg-red-900/30 text-red-400 border border-red-500/30';
      case 'modified':
        return 'bg-yellow-900/30 text-yellow-400 border border-yellow-500/30';
      case 'unchanged':
        return 'bg-dark-700 text-dark-400 border border-dark-600';
      default:
        return 'bg-dark-700 text-dark-400 border border-dark-600';
    }
  }

  getLeftEnvironmentName(): string {
    const envId = this.leftEnvId();
    const env = this.environments().find(e => e.id === envId);
    return env?.name ?? 'Left';
  }

  getRightEnvironmentName(): string {
    const envId = this.rightEnvId();
    const env = this.environments().find(e => e.id === envId);
    return env?.name ?? 'Right';
  }
}
