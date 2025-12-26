import { Component, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { VaultStore } from '../../core/services/vault.store';
import { TeamService } from '../../core/services/team.service';
import { getEnvTypeLabel, Project } from '../../core/models';
import { SyncIndicatorComponent } from '../sync/sync-indicator.component';
import { TeamPanelComponent } from '../teams/team-panel.component';
import { ShareProjectModalComponent } from '../teams/share-project-modal.component';
import { AuditLogViewerComponent } from '../teams/audit-log-viewer.component';

@Component({
  selector: 'app-dashboard',
  standalone: true,
  imports: [
    FormsModule,
    SyncIndicatorComponent,
    TeamPanelComponent,
    ShareProjectModalComponent,
    AuditLogViewerComponent,
  ],
  template: `
    <div class="h-full flex">
      <!-- Sidebar -->
      <aside class="w-64 bg-dark-800 border-r border-dark-700 flex flex-col">
        <!-- Header -->
        <div class="p-4 border-b border-dark-700">
          <div class="flex items-center justify-between">
            <h1 class="text-lg font-semibold text-white">EnvSync</h1>
            <div class="flex items-center space-x-1">
              <app-sync-indicator />
              <button
                (click)="onLock()"
                class="p-1.5 rounded text-dark-400 hover:text-white hover:bg-dark-700"
                title="Lock vault"
              >
                <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2"
                    d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
                </svg>
              </button>
            </div>
          </div>

          <!-- Search -->
          <div class="mt-3 relative">
            <input
              type="text"
              [(ngModel)]="searchQuery"
              (input)="onSearch()"
              class="input pl-9 text-sm"
              placeholder="Search variables..."
            />
            <svg class="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-dark-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
            </svg>
          </div>
        </div>

        <!-- Projects List -->
        <div class="flex-1 overflow-y-auto p-2">
          <div class="flex items-center justify-between px-2 mb-2">
            <span class="text-xs font-medium text-dark-400 uppercase tracking-wider">Projects</span>
            <button
              (click)="showCreateProject.set(true)"
              class="p-1 rounded text-dark-400 hover:text-white hover:bg-dark-700"
              title="New project"
            >
              <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 4v16m8-8H4" />
              </svg>
            </button>
          </div>

          @for (project of store.projects(); track project.id) {
            <button
              (click)="store.selectProject(project.id)"
              class="w-full text-left px-3 py-2 rounded-md mb-1 transition-colors"
              [class.bg-primary-600]="store.selectedProjectId() === project.id"
              [class.text-white]="store.selectedProjectId() === project.id"
              [class.text-dark-300]="store.selectedProjectId() !== project.id"
              [class.hover:bg-dark-700]="store.selectedProjectId() !== project.id"
            >
              <div class="flex items-center">
                <svg class="w-4 h-4 mr-2 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2"
                    d="M3 7v10a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-6l-2-2H5a2 2 0 00-2 2z" />
                </svg>
                <span class="truncate">{{ project.name }}</span>
              </div>
            </button>
          } @empty {
            <p class="text-dark-500 text-sm text-center py-4">No projects yet</p>
          }

          <!-- Teams Section -->
          <div class="mt-4 pt-4 border-t border-dark-700">
            <div class="flex items-center justify-between px-2 mb-2">
              <span class="text-xs font-medium text-dark-400 uppercase tracking-wider">Teams</span>
              <button
                (click)="showTeamPanel.set(!showTeamPanel())"
                class="p-1 rounded text-dark-400 hover:text-white hover:bg-dark-700"
                [title]="showTeamPanel() ? 'Hide teams' : 'Show teams'"
              >
                <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2"
                    d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
                </svg>
              </button>
            </div>
            @if (teamService.hasTeams()) {
              @for (team of teamService.teams(); track team.id) {
                <div class="px-3 py-2 text-dark-400 text-sm flex items-center">
                  <svg class="w-4 h-4 mr-2 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2"
                      d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197m13.5-9a2.5 2.5 0 11-5 0 2.5 2.5 0 015 0z" />
                  </svg>
                  <span class="truncate">{{ team.name }}</span>
                </div>
              }
            } @else {
              <p class="text-dark-500 text-xs text-center py-2">No teams yet</p>
            }
          </div>
        </div>
      </aside>

      <!-- Main Content -->
      <main class="flex-1 flex flex-col overflow-hidden">
        @if (store.selectedProject()) {
          <!-- Environment Tabs -->
          <div class="bg-dark-800 border-b border-dark-700 px-4">
            <div class="flex items-center justify-between">
              <div class="flex items-center space-x-1 py-2">
                @for (env of store.environments(); track env.id) {
                  <button
                    (click)="store.selectEnvironment(env.id)"
                    class="px-4 py-2 rounded-t-md text-sm font-medium transition-colors"
                    [class.bg-dark-900]="store.selectedEnvironmentId() === env.id"
                    [class.text-white]="store.selectedEnvironmentId() === env.id"
                    [class.text-dark-400]="store.selectedEnvironmentId() !== env.id"
                    [class.hover:text-dark-200]="store.selectedEnvironmentId() !== env.id"
                  >
                    {{ env.name }}
                  </button>
                }
              </div>

              <div class="flex items-center space-x-2">
                <button
                  (click)="openShareModal()"
                  class="btn btn-secondary text-sm py-1.5"
                  title="Share with team"
                >
                  <svg class="w-4 h-4 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2"
                      d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z" />
                  </svg>
                  Share
                </button>
                <button
                  (click)="showAuditLog.set(!showAuditLog())"
                  class="btn text-sm py-1.5"
                  [class.btn-primary]="showAuditLog()"
                  [class.btn-secondary]="!showAuditLog()"
                  title="Activity log"
                >
                  <svg class="w-4 h-4 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2"
                      d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                  Activity
                </button>
                <div class="w-px h-6 bg-dark-600"></div>
                <button
                  (click)="onImport()"
                  class="btn btn-secondary text-sm py-1.5"
                >
                  <svg class="w-4 h-4 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12" />
                  </svg>
                  Import
                </button>
                <button
                  (click)="onExport()"
                  class="btn btn-secondary text-sm py-1.5"
                >
                  <svg class="w-4 h-4 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
                  </svg>
                  Export
                </button>
              </div>
            </div>
          </div>

          <!-- Variables + Audit Log Split -->
          <div class="flex-1 overflow-hidden flex bg-dark-900">
            <!-- Variables Panel -->
            <div class="flex-1 overflow-y-auto p-4" [class.w-1/2]="showAuditLog()">
              <!-- Add Variable -->
              <div class="mb-4">
                <button
                  (click)="showAddVariable.set(true)"
                  class="btn btn-primary"
                >
                  <svg class="w-4 h-4 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 4v16m8-8H4" />
                  </svg>
                  Add Variable
                </button>
              </div>

            <!-- Variable List -->
            <div class="space-y-2">
              @for (variable of store.variables(); track variable.id) {
                <div class="card p-4">
                  <div class="flex items-start justify-between">
                    <div class="flex-1 min-w-0">
                      <div class="flex items-center space-x-2">
                        <span class="font-mono text-sm text-primary-400">{{ variable.key }}</span>
                        @if (variable.is_secret) {
                          <span class="px-1.5 py-0.5 text-xs bg-yellow-500/20 text-yellow-400 rounded">secret</span>
                        }
                      </div>
                      <div class="mt-1 flex items-center">
                        @if (revealedVariables().has(variable.id)) {
                          <code class="text-sm text-dark-300 font-mono break-all">{{ variable.value }}</code>
                        } @else {
                          <code class="text-sm text-dark-500 font-mono">••••••••</code>
                        }
                      </div>
                    </div>
                    <div class="flex items-center space-x-1 ml-4">
                      <button
                        (click)="toggleReveal(variable.id)"
                        class="p-1.5 rounded text-dark-400 hover:text-white hover:bg-dark-700"
                        [title]="revealedVariables().has(variable.id) ? 'Hide' : 'Reveal'"
                      >
                        @if (revealedVariables().has(variable.id)) {
                          <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2"
                              d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.88 9.88l-3.29-3.29m7.532 7.532l3.29 3.29M3 3l3.59 3.59m0 0A9.953 9.953 0 0112 5c4.478 0 8.268 2.943 9.543 7a10.025 10.025 0 01-4.132 5.411m0 0L21 21" />
                          </svg>
                        } @else {
                          <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2"
                              d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2"
                              d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                          </svg>
                        }
                      </button>
                      <button
                        (click)="copyToClipboard(variable.value)"
                        class="p-1.5 rounded text-dark-400 hover:text-white hover:bg-dark-700"
                        title="Copy value"
                      >
                        <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2"
                            d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
                        </svg>
                      </button>
                      <button
                        (click)="editVariable(variable)"
                        class="p-1.5 rounded text-dark-400 hover:text-white hover:bg-dark-700"
                        title="Edit"
                      >
                        <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2"
                            d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                        </svg>
                      </button>
                      <button
                        (click)="deleteVariable(variable.id)"
                        class="p-1.5 rounded text-dark-400 hover:text-red-400 hover:bg-dark-700"
                        title="Delete"
                      >
                        <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2"
                            d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                        </svg>
                      </button>
                    </div>
                  </div>
                </div>
              } @empty {
                <div class="text-center py-12">
                  <svg class="w-12 h-12 mx-auto text-dark-600 mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2"
                      d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                  </svg>
                  <p class="text-dark-400">No variables yet</p>
                  <p class="text-dark-500 text-sm mt-1">Add your first environment variable</p>
                </div>
              }
            </div>
            </div>

            <!-- Audit Log Panel -->
            @if (showAuditLog()) {
              <div class="w-1/2 border-l border-dark-700 overflow-y-auto p-4">
                <app-audit-log-viewer
                  [projectId]="store.selectedProjectId() ?? undefined"
                  [projectName]="store.selectedProject()?.name"
                />
              </div>
            }
          </div>
        } @else {
          <!-- No Project Selected -->
          <div class="flex-1 flex items-center justify-center bg-dark-900">
            <div class="text-center">
              <svg class="w-16 h-16 mx-auto text-dark-600 mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2"
                  d="M3 7v10a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-6l-2-2H5a2 2 0 00-2 2z" />
              </svg>
              <h2 class="text-xl font-semibold text-dark-300 mb-2">No Project Selected</h2>
              <p class="text-dark-500 mb-4">Select a project from the sidebar or create a new one</p>
              <button
                (click)="showCreateProject.set(true)"
                class="btn btn-primary"
              >
                Create Project
              </button>
            </div>
          </div>
        }
      </main>

      <!-- Team Panel Sidebar -->
      @if (showTeamPanel()) {
        <aside class="w-80 border-l border-dark-700 bg-dark-800 overflow-y-auto">
          <app-team-panel (projectSelected)="onTeamProjectSelected($event)" />
        </aside>
      }

      <!-- Share Project Modal -->
      @if (showShareModal()) {
        <app-share-project-modal
          [project]="store.selectedProject()"
          (close)="showShareModal.set(false)"
          (shared)="onProjectShared()"
        />
      }

      <!-- Create Project Modal -->
      @if (showCreateProject()) {
        <div class="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div class="card p-6 w-full max-w-md mx-4">
            <h2 class="text-xl font-semibold text-white mb-4">Create Project</h2>
            <form (ngSubmit)="createProject()">
              <div class="space-y-4">
                <div>
                  <label class="block text-sm font-medium text-dark-300 mb-1">Project Name</label>
                  <input
                    type="text"
                    [(ngModel)]="newProjectName"
                    name="name"
                    class="input"
                    placeholder="my-awesome-project"
                    required
                    autofocus
                  />
                </div>
                <div>
                  <label class="block text-sm font-medium text-dark-300 mb-1">Description (optional)</label>
                  <input
                    type="text"
                    [(ngModel)]="newProjectDescription"
                    name="description"
                    class="input"
                    placeholder="Project description"
                  />
                </div>
              </div>
              <div class="flex justify-end space-x-3 mt-6">
                <button
                  type="button"
                  (click)="showCreateProject.set(false)"
                  class="btn btn-secondary"
                >
                  Cancel
                </button>
                <button type="submit" class="btn btn-primary">
                  Create
                </button>
              </div>
            </form>
          </div>
        </div>
      }

      <!-- Add Variable Modal -->
      @if (showAddVariable()) {
        <div class="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div class="card p-6 w-full max-w-md mx-4">
            <h2 class="text-xl font-semibold text-white mb-4">
              {{ editingVariable() ? 'Edit Variable' : 'Add Variable' }}
            </h2>
            <form (ngSubmit)="saveVariable()">
              <div class="space-y-4">
                <div>
                  <label class="block text-sm font-medium text-dark-300 mb-1">Key</label>
                  <input
                    type="text"
                    [(ngModel)]="variableKey"
                    name="key"
                    class="input font-mono"
                    placeholder="DATABASE_URL"
                    required
                    [autofocus]="!editingVariable()"
                  />
                </div>
                <div>
                  <label class="block text-sm font-medium text-dark-300 mb-1">Value</label>
                  <textarea
                    [(ngModel)]="variableValue"
                    name="value"
                    class="input font-mono"
                    placeholder="postgres://..."
                    rows="3"
                    required
                  ></textarea>
                </div>
                <div class="flex items-center">
                  <input
                    type="checkbox"
                    [(ngModel)]="variableIsSecret"
                    name="isSecret"
                    id="isSecret"
                    class="rounded bg-dark-700 border-dark-600 text-primary-600 focus:ring-primary-500"
                  />
                  <label for="isSecret" class="ml-2 text-sm text-dark-300">
                    Mark as secret (hide by default)
                  </label>
                </div>
              </div>
              <div class="flex justify-end space-x-3 mt-6">
                <button
                  type="button"
                  (click)="closeVariableModal()"
                  class="btn btn-secondary"
                >
                  Cancel
                </button>
                <button type="submit" class="btn btn-primary">
                  {{ editingVariable() ? 'Save' : 'Add' }}
                </button>
              </div>
            </form>
          </div>
        </div>
      }
    </div>
  `,
})
export class DashboardComponent {
  protected readonly store = inject(VaultStore);
  protected readonly teamService = inject(TeamService);

  // Search
  protected searchQuery = '';

  // Project modal
  protected showCreateProject = signal(false);
  protected newProjectName = '';
  protected newProjectDescription = '';

  // Variable modal
  protected showAddVariable = signal(false);
  protected editingVariable = signal<string | null>(null);
  protected variableKey = '';
  protected variableValue = '';
  protected variableIsSecret = true;

  // Revealed variables
  protected revealedVariables = signal(new Set<string>());

  // Team features
  protected showTeamPanel = signal(false);
  protected showShareModal = signal(false);
  protected showAuditLog = signal(false);

  protected getEnvTypeLabel = getEnvTypeLabel;

  constructor() {
    // Load teams when component initializes
    this.teamService.loadTeams();
  }

  async onLock(): Promise<void> {
    await this.store.lock();
  }

  async onSearch(): Promise<void> {
    await this.store.search(this.searchQuery);
  }

  async createProject(): Promise<void> {
    if (!this.newProjectName.trim()) return;

    const project = await this.store.createProject(
      this.newProjectName.trim(),
      this.newProjectDescription.trim() || undefined
    );

    if (project) {
      this.showCreateProject.set(false);
      this.newProjectName = '';
      this.newProjectDescription = '';
      await this.store.selectProject(project.id);
    }
  }

  editVariable(variable: { id: string; key: string; value: string; is_secret: boolean }): void {
    this.editingVariable.set(variable.id);
    this.variableKey = variable.key;
    this.variableValue = variable.value;
    this.variableIsSecret = variable.is_secret;
    this.showAddVariable.set(true);
  }

  async saveVariable(): Promise<void> {
    if (!this.variableKey.trim() || !this.variableValue) return;

    const environmentId = this.store.selectedEnvironmentId();
    if (!environmentId) return;

    const editing = this.editingVariable();
    if (editing) {
      await this.store.updateVariable(
        editing,
        this.variableKey.trim(),
        this.variableValue,
        this.variableIsSecret
      );
    } else {
      await this.store.createVariable(
        environmentId,
        this.variableKey.trim(),
        this.variableValue,
        this.variableIsSecret
      );
    }

    this.closeVariableModal();
  }

  closeVariableModal(): void {
    this.showAddVariable.set(false);
    this.editingVariable.set(null);
    this.variableKey = '';
    this.variableValue = '';
    this.variableIsSecret = true;
  }

  async deleteVariable(id: string): Promise<void> {
    if (confirm('Are you sure you want to delete this variable?')) {
      await this.store.deleteVariable(id);
    }
  }

  toggleReveal(id: string): void {
    this.revealedVariables.update((set) => {
      const newSet = new Set(set);
      if (newSet.has(id)) {
        newSet.delete(id);
      } else {
        newSet.add(id);
      }
      return newSet;
    });
  }

  async copyToClipboard(value: string): Promise<void> {
    try {
      await navigator.clipboard.writeText(value);
      // Could add a toast notification here
    } catch (err) {
      console.error('Failed to copy:', err);
    }
  }

  async onImport(): Promise<void> {
    // For now, prompt for file content
    const content = prompt('Paste your .env file content:');
    if (content) {
      const environmentId = this.store.selectedEnvironmentId();
      if (environmentId) {
        await this.store.importFromEnvFile(environmentId, content);
      }
    }
  }

  async onExport(): Promise<void> {
    const environmentId = this.store.selectedEnvironmentId();
    if (!environmentId) return;

    const content = await this.store.exportToEnvFile(environmentId);
    if (content) {
      // For now, just show in alert - could use file dialog later
      const blob = new Blob([content], { type: 'text/plain' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = '.env';
      a.click();
      URL.revokeObjectURL(url);
    }
  }

  // Team feature methods
  openShareModal(): void {
    if (this.store.selectedProject()) {
      this.showShareModal.set(true);
    }
  }

  onProjectShared(): void {
    // Refresh data after sharing
    this.teamService.loadTeams();
  }

  onTeamProjectSelected(projectId: string): void {
    this.store.selectProject(projectId);
    this.showTeamPanel.set(false);
  }
}
