import { Component, EventEmitter, Input, Output, inject, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { TeamService } from '../../core/services/team.service';
import { Team, Project } from '../../core/models';

@Component({
  selector: 'app-share-project-modal',
  standalone: true,
  imports: [CommonModule, FormsModule],
  template: `
    <div class="modal-overlay" (click)="close.emit()">
      <div class="modal" (click)="$event.stopPropagation()">
        <h3>Share "{{ project?.name }}" with Team</h3>

        @if (loading) {
          <div class="loading">Loading teams...</div>
        } @else if (availableTeams.length === 0) {
          <div class="empty">
            <p>No teams available. Create a team first to share projects.</p>
          </div>
        } @else {
          <div class="team-list">
            @for (team of availableTeams; track team.id) {
              <div
                class="team-option"
                [class.selected]="selectedTeamId === team.id"
                (click)="selectTeam(team.id)"
              >
                <div class="team-info">
                  <span class="name">{{ team.name }}</span>
                  @if (team.description) {
                    <span class="desc">{{ team.description }}</span>
                  }
                </div>
                <div class="checkbox">
                  @if (selectedTeamId === team.id) {
                    <span class="check">&#10003;</span>
                  }
                </div>
              </div>
            }
          </div>

          <!-- Already shared teams -->
          @if (sharedTeams.length > 0) {
            <div class="shared-section">
              <h4>Already Shared With</h4>
              @for (team of sharedTeams; track team.id) {
                <div class="shared-team">
                  <span>{{ team.name }}</span>
                  <button class="btn-icon btn-danger" (click)="unshare(team)">
                    &times;
                  </button>
                </div>
              }
            </div>
          }
        }

        <div class="modal-actions">
          <button class="btn-secondary" (click)="close.emit()">Cancel</button>
          <button
            class="btn-primary"
            [disabled]="!selectedTeamId || sharing"
            (click)="shareProject()"
          >
            {{ sharing ? 'Sharing...' : 'Share' }}
          </button>
        </div>
      </div>
    </div>
  `,
  styles: [`
    .modal-overlay {
      position: fixed;
      top: 0;
      left: 0;
      right: 0;
      bottom: 0;
      background: rgba(0, 0, 0, 0.7);
      display: flex;
      align-items: center;
      justify-content: center;
      z-index: 1000;
    }

    .modal {
      background: var(--bg-secondary, #1a1a2e);
      border-radius: 8px;
      padding: 24px;
      width: 400px;
      max-width: 90vw;
      max-height: 80vh;
      overflow-y: auto;
    }

    .modal h3 {
      margin: 0 0 16px;
    }

    .loading, .empty {
      padding: 24px;
      text-align: center;
      color: var(--text-secondary, #888);
    }

    .team-list {
      display: flex;
      flex-direction: column;
      gap: 8px;
      margin-bottom: 16px;
    }

    .team-option {
      display: flex;
      justify-content: space-between;
      align-items: center;
      padding: 12px;
      background: var(--bg-tertiary, #252540);
      border-radius: 6px;
      cursor: pointer;
      transition: background 0.2s;
    }

    .team-option:hover {
      background: var(--bg-hover, #2a2a4a);
    }

    .team-option.selected {
      background: var(--primary-color-alpha, rgba(99, 102, 241, 0.2));
      border: 1px solid var(--primary-color, #6366f1);
    }

    .team-info {
      display: flex;
      flex-direction: column;
    }

    .team-info .name {
      font-weight: 500;
    }

    .team-info .desc {
      font-size: 12px;
      color: var(--text-secondary, #888);
    }

    .checkbox .check {
      color: var(--primary-color, #6366f1);
      font-weight: bold;
    }

    .shared-section {
      margin-top: 16px;
      padding-top: 16px;
      border-top: 1px solid var(--border-color, #333);
    }

    .shared-section h4 {
      margin: 0 0 8px;
      font-size: 13px;
      color: var(--text-secondary, #888);
    }

    .shared-team {
      display: flex;
      justify-content: space-between;
      align-items: center;
      padding: 8px;
      background: var(--bg-tertiary, #252540);
      border-radius: 4px;
      margin-bottom: 4px;
    }

    .btn-primary, .btn-secondary {
      padding: 8px 16px;
      border: none;
      border-radius: 4px;
      cursor: pointer;
      font-size: 14px;
    }

    .btn-primary {
      background: var(--primary-color, #6366f1);
      color: white;
    }

    .btn-secondary {
      background: var(--bg-tertiary, #333);
      color: white;
    }

    .btn-icon {
      width: 24px;
      height: 24px;
      padding: 0;
      border: none;
      background: transparent;
      cursor: pointer;
      font-size: 16px;
    }

    .btn-icon.btn-danger {
      color: var(--danger-color, #ef4444);
    }

    button:disabled {
      opacity: 0.5;
      cursor: not-allowed;
    }

    .modal-actions {
      display: flex;
      justify-content: flex-end;
      gap: 8px;
      margin-top: 16px;
    }
  `]
})
export class ShareProjectModalComponent implements OnInit {
  @Input() project: Project | null = null;
  @Output() close = new EventEmitter<void>();
  @Output() shared = new EventEmitter<void>();

  private teamService = inject(TeamService);

  loading = true;
  sharing = false;
  selectedTeamId: string | null = null;
  availableTeams: Team[] = [];
  sharedTeams: Team[] = [];

  async ngOnInit() {
    if (!this.project) return;

    this.loading = true;

    try {
      // Load all teams and already shared teams
      await this.teamService.loadTeams();
      this.sharedTeams = await this.teamService.getProjectTeams(this.project.id);

      // Filter out already shared teams
      const sharedIds = new Set(this.sharedTeams.map(t => t.id));
      this.availableTeams = this.teamService.teams().filter(t => !sharedIds.has(t.id));
    } finally {
      this.loading = false;
    }
  }

  selectTeam(teamId: string) {
    this.selectedTeamId = this.selectedTeamId === teamId ? null : teamId;
  }

  async shareProject() {
    if (!this.project || !this.selectedTeamId) return;

    this.sharing = true;
    try {
      const success = await this.teamService.shareProject(this.project.id, this.selectedTeamId);
      if (success) {
        this.shared.emit();
        this.close.emit();
      }
    } finally {
      this.sharing = false;
    }
  }

  async unshare(team: Team) {
    if (!this.project) return;

    if (confirm(`Remove "${this.project.name}" from "${team.name}"?`)) {
      const success = await this.teamService.unshareProject(this.project.id, team.id);
      if (success) {
        this.sharedTeams = this.sharedTeams.filter(t => t.id !== team.id);
        this.availableTeams = [...this.availableTeams, team];
      }
    }
  }
}
