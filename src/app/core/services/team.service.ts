import { Injectable, signal, computed } from '@angular/core';
import { TauriService } from './tauri.service';
import {
  Team,
  TeamMember,
  TeamInvite,
  TeamWithMembers,
  TeamRole,
  Project,
  KeyShare,
  AuditEvent,
  AuditQuery,
} from '../models';

@Injectable({
  providedIn: 'root',
})
export class TeamService {
  // Reactive state
  private _teams = signal<Team[]>([]);
  private _selectedTeam = signal<TeamWithMembers | null>(null);
  private _teamProjects = signal<Project[]>([]);
  private _auditLog = signal<AuditEvent[]>([]);
  private _isLoading = signal(false);
  private _error = signal<string | null>(null);

  // Public computed signals
  readonly teams = this._teams.asReadonly();
  readonly selectedTeam = this._selectedTeam.asReadonly();
  readonly teamProjects = this._teamProjects.asReadonly();
  readonly auditLog = this._auditLog.asReadonly();
  readonly isLoading = this._isLoading.asReadonly();
  readonly error = this._error.asReadonly();

  readonly hasTeams = computed(() => this._teams().length > 0);
  readonly teamMembers = computed(() => this._selectedTeam()?.members ?? []);
  readonly pendingInvites = computed(() => this._selectedTeam()?.pending_invites ?? []);

  constructor(private tauri: TauriService) {}

  // ========== Team CRUD ==========

  async loadTeams(): Promise<void> {
    this._isLoading.set(true);
    this._error.set(null);

    try {
      const teams = await this.tauri.getTeams();
      this._teams.set(teams);
    } catch (e: any) {
      this._error.set(e.toString());
      console.error('Failed to load teams:', e);
    } finally {
      this._isLoading.set(false);
    }
  }

  async createTeam(
    name: string,
    description?: string,
    threshold?: number,
    totalShares?: number
  ): Promise<Team | null> {
    this._isLoading.set(true);
    this._error.set(null);

    try {
      const team = await this.tauri.createTeam(name, description, threshold, totalShares);
      this._teams.update(teams => [...teams, team]);
      return team;
    } catch (e: any) {
      this._error.set(e.toString());
      console.error('Failed to create team:', e);
      return null;
    } finally {
      this._isLoading.set(false);
    }
  }

  async selectTeam(teamId: string): Promise<void> {
    this._isLoading.set(true);
    this._error.set(null);

    try {
      const [team, projects] = await Promise.all([
        this.tauri.getTeamWithMembers(teamId),
        this.tauri.getTeamProjects(teamId),
      ]);
      this._selectedTeam.set(team);
      this._teamProjects.set(projects);
    } catch (e: any) {
      this._error.set(e.toString());
      console.error('Failed to load team details:', e);
    } finally {
      this._isLoading.set(false);
    }
  }

  async updateTeam(id: string, name: string, description?: string): Promise<Team | null> {
    this._isLoading.set(true);
    this._error.set(null);

    try {
      const team = await this.tauri.updateTeam(id, name, description);
      this._teams.update(teams =>
        teams.map(t => (t.id === id ? team : t))
      );
      if (this._selectedTeam()?.id === id) {
        await this.selectTeam(id);
      }
      return team;
    } catch (e: any) {
      this._error.set(e.toString());
      console.error('Failed to update team:', e);
      return null;
    } finally {
      this._isLoading.set(false);
    }
  }

  async deleteTeam(id: string): Promise<boolean> {
    this._isLoading.set(true);
    this._error.set(null);

    try {
      await this.tauri.deleteTeam(id);
      this._teams.update(teams => teams.filter(t => t.id !== id));
      if (this._selectedTeam()?.id === id) {
        this._selectedTeam.set(null);
        this._teamProjects.set([]);
      }
      return true;
    } catch (e: any) {
      this._error.set(e.toString());
      console.error('Failed to delete team:', e);
      return false;
    } finally {
      this._isLoading.set(false);
    }
  }

  clearSelection(): void {
    this._selectedTeam.set(null);
    this._teamProjects.set([]);
    this._auditLog.set([]);
  }

  // ========== Member Management ==========

  async inviteMember(teamId: string, email: string, role: TeamRole): Promise<TeamInvite | null> {
    this._isLoading.set(true);
    this._error.set(null);

    try {
      const invite = await this.tauri.inviteTeamMember(teamId, email, role);
      // Refresh team to show new invite
      await this.selectTeam(teamId);
      return invite;
    } catch (e: any) {
      this._error.set(e.toString());
      console.error('Failed to invite member:', e);
      return null;
    } finally {
      this._isLoading.set(false);
    }
  }

  async acceptInvite(token: string): Promise<TeamMember | null> {
    this._isLoading.set(true);
    this._error.set(null);

    try {
      const member = await this.tauri.acceptTeamInvite(token);
      // Refresh teams list
      await this.loadTeams();
      return member;
    } catch (e: any) {
      this._error.set(e.toString());
      console.error('Failed to accept invite:', e);
      return null;
    } finally {
      this._isLoading.set(false);
    }
  }

  async updateMemberRole(teamId: string, userId: string, newRole: TeamRole): Promise<boolean> {
    this._isLoading.set(true);
    this._error.set(null);

    try {
      await this.tauri.updateMemberRole(teamId, userId, newRole);
      await this.selectTeam(teamId);
      return true;
    } catch (e: any) {
      this._error.set(e.toString());
      console.error('Failed to update member role:', e);
      return false;
    } finally {
      this._isLoading.set(false);
    }
  }

  async removeMember(teamId: string, userId: string): Promise<boolean> {
    this._isLoading.set(true);
    this._error.set(null);

    try {
      await this.tauri.removeTeamMember(teamId, userId);
      await this.selectTeam(teamId);
      return true;
    } catch (e: any) {
      this._error.set(e.toString());
      console.error('Failed to remove member:', e);
      return false;
    } finally {
      this._isLoading.set(false);
    }
  }

  async revokeInvite(inviteId: string): Promise<boolean> {
    this._isLoading.set(true);
    this._error.set(null);

    try {
      await this.tauri.revokeTeamInvite(inviteId);
      const teamId = this._selectedTeam()?.id;
      if (teamId) {
        await this.selectTeam(teamId);
      }
      return true;
    } catch (e: any) {
      this._error.set(e.toString());
      console.error('Failed to revoke invite:', e);
      return false;
    } finally {
      this._isLoading.set(false);
    }
  }

  // ========== Project Sharing ==========

  async shareProject(projectId: string, teamId: string): Promise<boolean> {
    this._isLoading.set(true);
    this._error.set(null);

    try {
      await this.tauri.shareProjectWithTeam(projectId, teamId);
      if (this._selectedTeam()?.id === teamId) {
        const projects = await this.tauri.getTeamProjects(teamId);
        this._teamProjects.set(projects);
      }
      return true;
    } catch (e: any) {
      this._error.set(e.toString());
      console.error('Failed to share project:', e);
      return false;
    } finally {
      this._isLoading.set(false);
    }
  }

  async unshareProject(projectId: string, teamId: string): Promise<boolean> {
    this._isLoading.set(true);
    this._error.set(null);

    try {
      await this.tauri.unshareProjectFromTeam(projectId, teamId);
      if (this._selectedTeam()?.id === teamId) {
        this._teamProjects.update(projects =>
          projects.filter(p => p.id !== projectId)
        );
      }
      return true;
    } catch (e: any) {
      this._error.set(e.toString());
      console.error('Failed to unshare project:', e);
      return false;
    } finally {
      this._isLoading.set(false);
    }
  }

  async getProjectTeams(projectId: string): Promise<Team[]> {
    try {
      return await this.tauri.getProjectTeams(projectId);
    } catch (e: any) {
      console.error('Failed to get project teams:', e);
      return [];
    }
  }

  async checkProjectAccess(projectId: string): Promise<TeamRole | null> {
    try {
      const role = await this.tauri.checkProjectAccess(projectId);
      return role as TeamRole | null;
    } catch (e: any) {
      console.error('Failed to check project access:', e);
      return null;
    }
  }

  // ========== VeilKey ==========

  async generateTeamKey(teamId: string): Promise<boolean> {
    this._isLoading.set(true);
    this._error.set(null);

    try {
      await this.tauri.generateTeamKey(teamId);
      await this.selectTeam(teamId);
      return true;
    } catch (e: any) {
      this._error.set(e.toString());
      console.error('Failed to generate team key:', e);
      return false;
    } finally {
      this._isLoading.set(false);
    }
  }

  async getMyKeyShare(teamId: string): Promise<KeyShare | null> {
    try {
      return await this.tauri.getMyKeyShare(teamId);
    } catch (e: any) {
      console.error('Failed to get key share:', e);
      return null;
    }
  }

  // ========== Audit Log ==========

  async loadTeamAuditLog(teamId: string, limit?: number): Promise<void> {
    try {
      const events = await this.tauri.getTeamAuditLog(teamId, limit);
      this._auditLog.set(events);
    } catch (e: any) {
      console.error('Failed to load audit log:', e);
    }
  }

  async loadProjectAuditLog(projectId: string, limit?: number): Promise<AuditEvent[]> {
    try {
      return await this.tauri.getProjectAuditLog(projectId, limit);
    } catch (e: any) {
      console.error('Failed to load project audit log:', e);
      return [];
    }
  }

  async queryAuditLog(query: AuditQuery): Promise<AuditEvent[]> {
    try {
      return await this.tauri.queryAuditLog(query);
    } catch (e: any) {
      console.error('Failed to query audit log:', e);
      return [];
    }
  }
}
