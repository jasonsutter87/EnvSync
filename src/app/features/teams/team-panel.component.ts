import { Component, inject, signal, computed } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { TeamService } from '../../core/services/team.service';
import { SyncService } from '../../core/services/sync.service';
import { Team, TeamMember, TeamInvite, TeamRole, getAuditEventLabel } from '../../core/models';

@Component({
  selector: 'app-team-panel',
  standalone: true,
  imports: [CommonModule, FormsModule],
  template: `
    <div class="team-panel">
      <!-- Header -->
      <div class="panel-header">
        <h2>Teams</h2>
        @if (syncService.isConnected()) {
          <button class="btn-primary" (click)="showCreateModal = true">
            + New Team
          </button>
        }
      </div>

      @if (!syncService.isConnected()) {
        <div class="not-connected">
          <p>Sign in to VeilCloud to create and manage teams.</p>
        </div>
      } @else {
        <!-- Team List -->
        <div class="team-list">
          @for (team of teamService.teams(); track team.id) {
            <div
              class="team-card"
              [class.selected]="teamService.selectedTeam()?.id === team.id"
              (click)="selectTeam(team)"
            >
              <div class="team-info">
                <h3>{{ team.name }}</h3>
                @if (team.description) {
                  <p>{{ team.description }}</p>
                }
                <div class="team-meta">
                  <span class="threshold">{{ team.threshold }}-of-{{ team.total_shares }}</span>
                </div>
              </div>
            </div>
          } @empty {
            <div class="empty-state">
              <p>No teams yet. Create one to start sharing secrets.</p>
            </div>
          }
        </div>

        <!-- Selected Team Details -->
        @if (teamService.selectedTeam(); as team) {
          <div class="team-details">
            <div class="details-header">
              <h3>{{ team.name }}</h3>
              <div class="actions">
                <button class="btn-secondary" (click)="showInviteModal = true">
                  Invite Member
                </button>
                @if (isOwner(team)) {
                  <button class="btn-danger" (click)="confirmDeleteTeam(team)">
                    Delete
                  </button>
                }
              </div>
            </div>

            <!-- Members Section -->
            <div class="section">
              <h4>Members ({{ teamService.teamMembers().length }})</h4>
              <div class="member-list">
                @for (member of teamService.teamMembers(); track member.id) {
                  <div class="member-row">
                    <div class="member-info">
                      <span class="name">{{ member.name || member.email }}</span>
                      <span class="email">{{ member.email }}</span>
                    </div>
                    <div class="member-role">
                      @if (canManageMembers(team) && member.user_id !== team.owner_id) {
                        <select
                          [value]="member.role"
                          (change)="changeRole(member, $event)"
                        >
                          <option value="Admin">Admin</option>
                          <option value="Member">Member</option>
                          <option value="Viewer">Viewer</option>
                        </select>
                        <button class="btn-icon btn-danger" (click)="removeMember(member)">
                          &times;
                        </button>
                      } @else {
                        <span class="role-badge" [attr.data-role]="member.role">
                          {{ member.role }}
                        </span>
                        @if (member.user_id === team.owner_id) {
                          <span class="owner-badge">Owner</span>
                        }
                      }
                    </div>
                  </div>
                }
              </div>
            </div>

            <!-- Pending Invites -->
            @if (teamService.pendingInvites().length > 0) {
              <div class="section">
                <h4>Pending Invites</h4>
                <div class="invite-list">
                  @for (invite of teamService.pendingInvites(); track invite.id) {
                    <div class="invite-row">
                      <span class="email">{{ invite.email }}</span>
                      <span class="role-badge" [attr.data-role]="invite.role">
                        {{ invite.role }}
                      </span>
                      <button class="btn-icon" (click)="revokeInvite(invite)">
                        &times;
                      </button>
                    </div>
                  }
                </div>
              </div>
            }

            <!-- Shared Projects -->
            <div class="section">
              <h4>Shared Projects ({{ teamService.teamProjects().length }})</h4>
              <div class="project-list">
                @for (project of teamService.teamProjects(); track project.id) {
                  <div class="project-row">
                    <span class="name">{{ project.name }}</span>
                    @if (canManageMembers(team)) {
                      <button class="btn-icon" (click)="unshareProject(project.id, team.id)">
                        &times;
                      </button>
                    }
                  </div>
                } @empty {
                  <p class="empty">No projects shared with this team.</p>
                }
              </div>
            </div>

            <!-- Audit Log Preview -->
            <div class="section">
              <h4>Recent Activity</h4>
              <div class="audit-list">
                @for (event of teamService.auditLog().slice(0, 5); track event.id) {
                  <div class="audit-row">
                    <span class="event-type">{{ getAuditEventLabel(event.event_type) }}</span>
                    <span class="actor">{{ event.actor_email || event.actor_id }}</span>
                    <span class="time">{{ formatDate(event.timestamp) }}</span>
                  </div>
                } @empty {
                  <p class="empty">No activity yet.</p>
                }
              </div>
            </div>
          </div>
        }
      }

      <!-- Create Team Modal -->
      @if (showCreateModal) {
        <div class="modal-overlay" (click)="showCreateModal = false">
          <div class="modal" (click)="$event.stopPropagation()">
            <h3>Create Team</h3>
            <form (ngSubmit)="createTeam()">
              <div class="form-group">
                <label>Team Name</label>
                <input
                  type="text"
                  [(ngModel)]="newTeamName"
                  name="name"
                  required
                  placeholder="Engineering Team"
                />
              </div>
              <div class="form-group">
                <label>Description (optional)</label>
                <textarea
                  [(ngModel)]="newTeamDescription"
                  name="description"
                  placeholder="Team description..."
                ></textarea>
              </div>
              <div class="form-row">
                <div class="form-group">
                  <label>Threshold (t)</label>
                  <select [(ngModel)]="newTeamThreshold" name="threshold">
                    <option [value]="2">2</option>
                    <option [value]="3">3</option>
                    <option [value]="4">4</option>
                    <option [value]="5">5</option>
                  </select>
                </div>
                <div class="form-group">
                  <label>Total Shares (n)</label>
                  <select [(ngModel)]="newTeamShares" name="shares">
                    <option [value]="3">3</option>
                    <option [value]="5">5</option>
                    <option [value]="7">7</option>
                    <option [value]="9">9</option>
                  </select>
                </div>
              </div>
              <p class="hint">
                {{ newTeamThreshold }}-of-{{ newTeamShares }} means {{ newTeamThreshold }}
                members must collaborate to decrypt team secrets.
              </p>
              <div class="modal-actions">
                <button type="button" class="btn-secondary" (click)="showCreateModal = false">
                  Cancel
                </button>
                <button type="submit" class="btn-primary" [disabled]="!newTeamName">
                  Create Team
                </button>
              </div>
            </form>
          </div>
        </div>
      }

      <!-- Invite Member Modal -->
      @if (showInviteModal) {
        <div class="modal-overlay" (click)="showInviteModal = false">
          <div class="modal" (click)="$event.stopPropagation()">
            <h3>Invite Member</h3>
            <form (ngSubmit)="inviteMember()">
              <div class="form-group">
                <label>Email Address</label>
                <input
                  type="email"
                  [(ngModel)]="inviteEmail"
                  name="email"
                  required
                  placeholder="colleague@company.com"
                />
              </div>
              <div class="form-group">
                <label>Role</label>
                <select [(ngModel)]="inviteRole" name="role">
                  <option value="Admin">Admin - Can manage team</option>
                  <option value="Member">Member - Can read/write</option>
                  <option value="Viewer">Viewer - Read only</option>
                </select>
              </div>
              <div class="modal-actions">
                <button type="button" class="btn-secondary" (click)="showInviteModal = false">
                  Cancel
                </button>
                <button type="submit" class="btn-primary" [disabled]="!inviteEmail">
                  Send Invite
                </button>
              </div>
            </form>
          </div>
        </div>
      }
    </div>
  `,
  styles: [`
    .team-panel {
      display: flex;
      flex-direction: column;
      height: 100%;
      background: var(--bg-secondary, #1a1a2e);
      border-radius: 8px;
      overflow: hidden;
    }

    .panel-header {
      display: flex;
      justify-content: space-between;
      align-items: center;
      padding: 16px;
      border-bottom: 1px solid var(--border-color, #333);
    }

    .panel-header h2 {
      margin: 0;
      font-size: 18px;
    }

    .not-connected {
      padding: 32px;
      text-align: center;
      color: var(--text-secondary, #888);
    }

    .team-list {
      flex: 0 0 auto;
      max-height: 200px;
      overflow-y: auto;
      padding: 8px;
    }

    .team-card {
      padding: 12px;
      border-radius: 6px;
      cursor: pointer;
      transition: background 0.2s;
    }

    .team-card:hover {
      background: var(--bg-hover, #252540);
    }

    .team-card.selected {
      background: var(--bg-selected, #2a2a4a);
      border-left: 3px solid var(--primary-color, #6366f1);
    }

    .team-info h3 {
      margin: 0 0 4px;
      font-size: 14px;
    }

    .team-info p {
      margin: 0;
      font-size: 12px;
      color: var(--text-secondary, #888);
    }

    .team-meta {
      margin-top: 4px;
    }

    .threshold {
      font-size: 11px;
      padding: 2px 6px;
      background: var(--bg-tertiary, #333);
      border-radius: 4px;
    }

    .empty-state {
      padding: 24px;
      text-align: center;
      color: var(--text-secondary, #888);
    }

    .team-details {
      flex: 1;
      overflow-y: auto;
      padding: 16px;
      border-top: 1px solid var(--border-color, #333);
    }

    .details-header {
      display: flex;
      justify-content: space-between;
      align-items: center;
      margin-bottom: 16px;
    }

    .details-header h3 {
      margin: 0;
    }

    .actions {
      display: flex;
      gap: 8px;
    }

    .section {
      margin-bottom: 20px;
    }

    .section h4 {
      margin: 0 0 8px;
      font-size: 13px;
      color: var(--text-secondary, #888);
      text-transform: uppercase;
    }

    .member-list, .invite-list, .project-list, .audit-list {
      display: flex;
      flex-direction: column;
      gap: 4px;
    }

    .member-row, .invite-row, .project-row, .audit-row {
      display: flex;
      justify-content: space-between;
      align-items: center;
      padding: 8px;
      background: var(--bg-tertiary, #252540);
      border-radius: 4px;
    }

    .member-info {
      display: flex;
      flex-direction: column;
    }

    .member-info .name {
      font-weight: 500;
    }

    .member-info .email {
      font-size: 12px;
      color: var(--text-secondary, #888);
    }

    .member-role {
      display: flex;
      align-items: center;
      gap: 8px;
    }

    .role-badge {
      font-size: 11px;
      padding: 2px 8px;
      border-radius: 4px;
      background: var(--bg-secondary, #333);
    }

    .role-badge[data-role="Admin"] {
      background: var(--danger-color, #ef4444);
      color: white;
    }

    .role-badge[data-role="Member"] {
      background: var(--primary-color, #6366f1);
      color: white;
    }

    .owner-badge {
      font-size: 11px;
      padding: 2px 6px;
      background: gold;
      color: black;
      border-radius: 4px;
    }

    .audit-row {
      font-size: 12px;
    }

    .audit-row .event-type {
      font-weight: 500;
    }

    .audit-row .actor {
      color: var(--text-secondary, #888);
    }

    .audit-row .time {
      font-size: 11px;
      color: var(--text-secondary, #666);
    }

    .empty {
      font-size: 13px;
      color: var(--text-secondary, #888);
      padding: 8px;
    }

    /* Buttons */
    .btn-primary, .btn-secondary, .btn-danger {
      padding: 6px 12px;
      border: none;
      border-radius: 4px;
      cursor: pointer;
      font-size: 13px;
      transition: opacity 0.2s;
    }

    .btn-primary {
      background: var(--primary-color, #6366f1);
      color: white;
    }

    .btn-secondary {
      background: var(--bg-tertiary, #333);
      color: white;
    }

    .btn-danger {
      background: var(--danger-color, #ef4444);
      color: white;
    }

    .btn-icon {
      width: 24px;
      height: 24px;
      padding: 0;
      border: none;
      background: transparent;
      color: var(--text-secondary, #888);
      cursor: pointer;
      font-size: 16px;
    }

    .btn-icon.btn-danger {
      background: transparent;
      color: var(--danger-color, #ef4444);
    }

    button:disabled {
      opacity: 0.5;
      cursor: not-allowed;
    }

    /* Modal */
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
    }

    .modal h3 {
      margin: 0 0 16px;
    }

    .form-group {
      margin-bottom: 12px;
    }

    .form-group label {
      display: block;
      margin-bottom: 4px;
      font-size: 13px;
      color: var(--text-secondary, #888);
    }

    .form-group input,
    .form-group textarea,
    .form-group select {
      width: 100%;
      padding: 8px;
      border: 1px solid var(--border-color, #333);
      border-radius: 4px;
      background: var(--bg-tertiary, #252540);
      color: white;
      font-size: 14px;
    }

    .form-group textarea {
      min-height: 80px;
      resize: vertical;
    }

    .form-row {
      display: flex;
      gap: 12px;
    }

    .form-row .form-group {
      flex: 1;
    }

    .hint {
      font-size: 12px;
      color: var(--text-secondary, #888);
      margin: 8px 0 16px;
    }

    .modal-actions {
      display: flex;
      justify-content: flex-end;
      gap: 8px;
      margin-top: 16px;
    }
  `]
})
export class TeamPanelComponent {
  teamService = inject(TeamService);
  syncService = inject(SyncService);

  showCreateModal = false;
  showInviteModal = false;

  // Create team form
  newTeamName = '';
  newTeamDescription = '';
  newTeamThreshold = 2;
  newTeamShares = 3;

  // Invite form
  inviteEmail = '';
  inviteRole: TeamRole = 'Member';

  getAuditEventLabel = getAuditEventLabel;

  async selectTeam(team: Team) {
    await this.teamService.selectTeam(team.id);
    await this.teamService.loadTeamAuditLog(team.id, 10);
  }

  isOwner(team: Team): boolean {
    const user = this.syncService.user();
    return user?.id === team.owner_id;
  }

  canManageMembers(team: Team): boolean {
    const user = this.syncService.user();
    if (!user) return false;
    if (user.id === team.owner_id) return true;
    const member = this.teamService.teamMembers().find(m => m.user_id === user.id);
    return member?.role === 'Admin';
  }

  async createTeam() {
    if (!this.newTeamName) return;

    const team = await this.teamService.createTeam(
      this.newTeamName,
      this.newTeamDescription || undefined,
      this.newTeamThreshold,
      this.newTeamShares
    );

    if (team) {
      this.showCreateModal = false;
      this.newTeamName = '';
      this.newTeamDescription = '';
      this.newTeamThreshold = 2;
      this.newTeamShares = 3;
    }
  }

  async inviteMember() {
    const team = this.teamService.selectedTeam();
    if (!team || !this.inviteEmail) return;

    const invite = await this.teamService.inviteMember(team.id, this.inviteEmail, this.inviteRole);

    if (invite) {
      this.showInviteModal = false;
      this.inviteEmail = '';
      this.inviteRole = 'Member';
    }
  }

  async changeRole(member: TeamMember, event: Event) {
    const team = this.teamService.selectedTeam();
    if (!team) return;

    const select = event.target as HTMLSelectElement;
    await this.teamService.updateMemberRole(team.id, member.user_id, select.value as TeamRole);
  }

  async removeMember(member: TeamMember) {
    const team = this.teamService.selectedTeam();
    if (!team) return;

    if (confirm(`Remove ${member.email} from the team?`)) {
      await this.teamService.removeMember(team.id, member.user_id);
    }
  }

  async revokeInvite(invite: TeamInvite) {
    if (confirm(`Revoke invite for ${invite.email}?`)) {
      await this.teamService.revokeInvite(invite.id);
    }
  }

  async unshareProject(projectId: string, teamId: string) {
    if (confirm('Remove this project from the team?')) {
      await this.teamService.unshareProject(projectId, teamId);
    }
  }

  async confirmDeleteTeam(team: Team) {
    if (confirm(`Delete team "${team.name}"? This cannot be undone.`)) {
      await this.teamService.deleteTeam(team.id);
    }
  }

  formatDate(dateStr: string): string {
    const date = new Date(dateStr);
    const now = new Date();
    const diff = now.getTime() - date.getTime();
    const mins = Math.floor(diff / 60000);
    const hours = Math.floor(diff / 3600000);
    const days = Math.floor(diff / 86400000);

    if (mins < 1) return 'just now';
    if (mins < 60) return `${mins}m ago`;
    if (hours < 24) return `${hours}h ago`;
    if (days < 7) return `${days}d ago`;
    return date.toLocaleDateString();
  }
}
