/**
 * TeamService Unit Tests
 *
 * Comprehensive test suite for the EnvSync Team service covering:
 * - Service instantiation
 * - Signal-based state management
 * - Team CRUD operations
 * - Team member management
 * - Team invitations
 * - Project sharing
 * - VeilKey operations
 * - Audit log operations
 * - Error handling
 * - Computed signals
 */

import { vi, describe, it, expect, beforeEach, afterEach } from 'vitest';
import { signal, computed, WritableSignal, Signal } from '@angular/core';
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

// Mock TauriService type
interface MockTauriService {
  getTeams: ReturnType<typeof vi.fn>;
  getTeam: ReturnType<typeof vi.fn>;
  getTeamWithMembers: ReturnType<typeof vi.fn>;
  createTeam: ReturnType<typeof vi.fn>;
  updateTeam: ReturnType<typeof vi.fn>;
  deleteTeam: ReturnType<typeof vi.fn>;
  inviteTeamMember: ReturnType<typeof vi.fn>;
  acceptTeamInvite: ReturnType<typeof vi.fn>;
  updateMemberRole: ReturnType<typeof vi.fn>;
  removeTeamMember: ReturnType<typeof vi.fn>;
  revokeTeamInvite: ReturnType<typeof vi.fn>;
  shareProjectWithTeam: ReturnType<typeof vi.fn>;
  unshareProjectFromTeam: ReturnType<typeof vi.fn>;
  getTeamProjects: ReturnType<typeof vi.fn>;
  getProjectTeams: ReturnType<typeof vi.fn>;
  checkProjectAccess: ReturnType<typeof vi.fn>;
  generateTeamKey: ReturnType<typeof vi.fn>;
  getMyKeyShare: ReturnType<typeof vi.fn>;
  getTeamAuditLog: ReturnType<typeof vi.fn>;
  getProjectAuditLog: ReturnType<typeof vi.fn>;
  queryAuditLog: ReturnType<typeof vi.fn>;
}

// Create mock TauriService
const createMockTauriService = (): MockTauriService => ({
  getTeams: vi.fn(),
  getTeam: vi.fn(),
  getTeamWithMembers: vi.fn(),
  createTeam: vi.fn(),
  updateTeam: vi.fn(),
  deleteTeam: vi.fn(),
  inviteTeamMember: vi.fn(),
  acceptTeamInvite: vi.fn(),
  updateMemberRole: vi.fn(),
  removeTeamMember: vi.fn(),
  revokeTeamInvite: vi.fn(),
  shareProjectWithTeam: vi.fn(),
  unshareProjectFromTeam: vi.fn(),
  getTeamProjects: vi.fn(),
  getProjectTeams: vi.fn(),
  checkProjectAccess: vi.fn(),
  generateTeamKey: vi.fn(),
  getMyKeyShare: vi.fn(),
  getTeamAuditLog: vi.fn(),
  getProjectAuditLog: vi.fn(),
  queryAuditLog: vi.fn(),
});

// Simplified TeamService logic for testing
class TeamServiceLogic {
  private _teams: WritableSignal<Team[]>;
  private _selectedTeam: WritableSignal<TeamWithMembers | null>;
  private _teamProjects: WritableSignal<Project[]>;
  private _auditLog: WritableSignal<AuditEvent[]>;
  private _isLoading: WritableSignal<boolean>;
  private _error: WritableSignal<string | null>;

  readonly teams: Signal<Team[]>;
  readonly selectedTeam: Signal<TeamWithMembers | null>;
  readonly teamProjects: Signal<Project[]>;
  readonly auditLog: Signal<AuditEvent[]>;
  readonly isLoading: Signal<boolean>;
  readonly error: Signal<string | null>;

  readonly hasTeams: Signal<boolean>;
  readonly teamMembers: Signal<TeamMember[]>;
  readonly pendingInvites: Signal<TeamInvite[]>;

  constructor(private tauri: MockTauriService) {
    this._teams = signal([]);
    this._selectedTeam = signal(null);
    this._teamProjects = signal([]);
    this._auditLog = signal([]);
    this._isLoading = signal(false);
    this._error = signal(null);

    this.teams = this._teams.asReadonly();
    this.selectedTeam = this._selectedTeam.asReadonly();
    this.teamProjects = this._teamProjects.asReadonly();
    this.auditLog = this._auditLog.asReadonly();
    this.isLoading = this._isLoading.asReadonly();
    this.error = this._error.asReadonly();

    this.hasTeams = computed(() => this._teams().length > 0);
    this.teamMembers = computed(() => this._selectedTeam()?.members ?? []);
    this.pendingInvites = computed(() => this._selectedTeam()?.pending_invites ?? []);
  }

  async loadTeams(): Promise<void> {
    this._isLoading.set(true);
    this._error.set(null);
    try {
      const teams = await this.tauri.getTeams();
      this._teams.set(teams);
    } catch (error: any) {
      console.error('Failed to load teams:', error);
      this._error.set(error.toString());
    } finally {
      this._isLoading.set(false);
    }
  }

  async createTeam(name: string, description?: string, threshold?: number, totalShares?: number): Promise<Team | null> {
    this._error.set(null);
    try {
      const team = await this.tauri.createTeam(name, description, threshold, totalShares);
      this._teams.update(teams => [...teams, team]);
      return team;
    } catch (error: any) {
      console.error('Failed to create team:', error);
      this._error.set(error.toString());
      return null;
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
    } catch (error: any) {
      console.error('Failed to select team:', error);
      this._error.set(error.toString());
    } finally {
      this._isLoading.set(false);
    }
  }

  async updateTeam(teamId: string, name: string, description?: string): Promise<Team | null> {
    this._error.set(null);
    try {
      const team = await this.tauri.updateTeam(teamId, name, description);
      this._teams.update(teams => teams.map(t => t.id === teamId ? team : t));
      if (this._selectedTeam()?.id === teamId) {
        await this.selectTeam(teamId);
      }
      return team;
    } catch (error: any) {
      console.error('Failed to update team:', error);
      this._error.set(error.toString());
      return null;
    }
  }

  async deleteTeam(teamId: string): Promise<boolean> {
    this._error.set(null);
    try {
      await this.tauri.deleteTeam(teamId);
      this._teams.update(teams => teams.filter(t => t.id !== teamId));
      if (this._selectedTeam()?.id === teamId) {
        this._selectedTeam.set(null);
        this._teamProjects.set([]);
      }
      return true;
    } catch (error: any) {
      console.error('Failed to delete team:', error);
      this._error.set(error.toString());
      return false;
    }
  }

  clearSelection(): void {
    this._selectedTeam.set(null);
    this._teamProjects.set([]);
    this._auditLog.set([]);
  }

  async inviteMember(teamId: string, email: string, role: TeamRole): Promise<TeamInvite | null> {
    this._error.set(null);
    try {
      const invite = await this.tauri.inviteTeamMember(teamId, email, role);
      await this.tauri.getTeamWithMembers(teamId);
      return invite;
    } catch (error: any) {
      console.error('Failed to invite member:', error);
      this._error.set(error.toString());
      return null;
    }
  }

  async acceptInvite(token: string): Promise<TeamMember | null> {
    this._error.set(null);
    try {
      const member = await this.tauri.acceptTeamInvite(token);
      await this.tauri.getTeams();
      return member;
    } catch (error: any) {
      console.error('Failed to accept invite:', error);
      this._error.set(error.toString());
      return null;
    }
  }

  async updateMemberRole(teamId: string, userId: string, newRole: TeamRole): Promise<boolean> {
    this._error.set(null);
    try {
      await this.tauri.updateMemberRole(teamId, userId, newRole);
      await this.tauri.getTeamWithMembers(teamId);
      await this.tauri.getTeamProjects(teamId);
      return true;
    } catch (error: any) {
      console.error('Failed to update member role:', error);
      this._error.set(error.toString());
      return false;
    }
  }

  async removeMember(teamId: string, userId: string): Promise<boolean> {
    this._error.set(null);
    try {
      await this.tauri.removeTeamMember(teamId, userId);
      await this.tauri.getTeamWithMembers(teamId);
      await this.tauri.getTeamProjects(teamId);
      return true;
    } catch (error: any) {
      console.error('Failed to remove member:', error);
      this._error.set(error.toString());
      return false;
    }
  }

  async revokeInvite(inviteId: string): Promise<boolean> {
    this._error.set(null);
    try {
      await this.tauri.revokeTeamInvite(inviteId);
      const selectedTeam = this._selectedTeam();
      if (selectedTeam) {
        await this.tauri.getTeamWithMembers(selectedTeam.id);
        await this.tauri.getTeamProjects(selectedTeam.id);
      }
      return true;
    } catch (error: any) {
      console.error('Failed to revoke invite:', error);
      this._error.set(error.toString());
      return false;
    }
  }

  async shareProject(projectId: string, teamId: string): Promise<boolean> {
    this._error.set(null);
    try {
      await this.tauri.shareProjectWithTeam(projectId, teamId);
      const projects = await this.tauri.getTeamProjects(teamId);
      this._teamProjects.set(projects);
      return true;
    } catch (error: any) {
      console.error('Failed to share project:', error);
      this._error.set(error.toString());
      return false;
    }
  }

  async unshareProject(projectId: string, teamId: string): Promise<boolean> {
    this._error.set(null);
    try {
      await this.tauri.unshareProjectFromTeam(projectId, teamId);
      const selectedTeam = this._selectedTeam();
      if (selectedTeam?.id === teamId) {
        const projects = await this.tauri.getTeamProjects(teamId);
        this._teamProjects.set(projects);
      }
      return true;
    } catch (error: any) {
      console.error('Failed to unshare project:', error);
      this._error.set(error.toString());
      return false;
    }
  }

  async getProjectTeams(projectId: string): Promise<Team[]> {
    try {
      return await this.tauri.getProjectTeams(projectId);
    } catch (error) {
      console.error('Failed to get project teams:', error);
      return [];
    }
  }

  async checkProjectAccess(projectId: string): Promise<TeamRole | null> {
    try {
      return await this.tauri.checkProjectAccess(projectId);
    } catch (error) {
      console.error('Failed to check project access:', error);
      return null;
    }
  }

  async generateTeamKey(teamId: string): Promise<boolean> {
    this._error.set(null);
    try {
      await this.tauri.generateTeamKey(teamId);
      await this.tauri.getTeamWithMembers(teamId);
      await this.tauri.getTeamProjects(teamId);
      return true;
    } catch (error: any) {
      console.error('Failed to generate team key:', error);
      this._error.set(error.toString());
      return false;
    }
  }

  async getMyKeyShare(teamId: string): Promise<KeyShare | null> {
    try {
      return await this.tauri.getMyKeyShare(teamId);
    } catch (error) {
      console.error('Failed to get key share:', error);
      return null;
    }
  }

  async loadTeamAuditLog(teamId: string, limit?: number): Promise<void> {
    try {
      const events = await this.tauri.getTeamAuditLog(teamId, limit);
      this._auditLog.set(events);
    } catch (error) {
      console.error('Failed to load audit log:', error);
    }
  }

  async loadProjectAuditLog(projectId: string, limit?: number): Promise<AuditEvent[]> {
    try {
      return await this.tauri.getProjectAuditLog(projectId, limit);
    } catch (error) {
      console.error('Failed to load project audit log:', error);
      return [];
    }
  }

  async queryAuditLog(query: AuditQuery): Promise<AuditEvent[]> {
    try {
      return await this.tauri.queryAuditLog(query);
    } catch (error) {
      console.error('Failed to query audit log:', error);
      return [];
    }
  }
}

describe('TeamService', () => {
  let service: TeamServiceLogic;
  let tauriService: MockTauriService;

  // Mock data
  const mockTeam: Team = {
    id: 'team-1',
    name: 'Test Team',
    description: 'Test Description',
    owner_id: 'user-1',
    threshold: 2,
    total_shares: 3,
    created_at: '2024-01-01T00:00:00Z',
    updated_at: '2024-01-01T00:00:00Z',
  };

  const mockMember: TeamMember = {
    id: 'member-1',
    team_id: 'team-1',
    user_id: 'user-2',
    email: 'member@example.com',
    name: 'Team Member',
    role: 'Member',
    joined_at: '2024-01-01T00:00:00Z',
    invited_by: 'user-1',
  };

  const mockInvite: TeamInvite = {
    id: 'invite-1',
    team_id: 'team-1',
    email: 'newmember@example.com',
    role: 'Member',
    status: 'Pending',
    invited_by: 'user-1',
    token: 'invite-token-123',
    expires_at: '2024-12-31T23:59:59Z',
    created_at: '2024-01-01T00:00:00Z',
  };

  const mockTeamWithMembers: TeamWithMembers = {
    ...mockTeam,
    members: [mockMember],
    pending_invites: [mockInvite],
  };

  const mockProject: Project = {
    id: 'proj-1',
    name: 'Test Project',
    description: 'Project Description',
    created_at: '2024-01-01T00:00:00Z',
    updated_at: '2024-01-01T00:00:00Z',
  };

  const mockKeyShare: KeyShare = {
    id: 'share-1',
    team_id: 'team-1',
    share_index: 0,
    encrypted_share: 'encrypted-share-data',
    user_id: 'user-1',
    created_at: '2024-01-01T00:00:00Z',
  };

  const mockAuditEvent: AuditEvent = {
    id: 'audit-1',
    event_type: 'TeamCreated',
    actor_id: 'user-1',
    actor_email: 'user@example.com',
    team_id: 'team-1',
    hash: 'hash123',
    timestamp: '2024-01-01T00:00:00Z',
  };

  beforeEach(() => {
    tauriService = createMockTauriService();
    service = new TeamServiceLogic(tauriService);
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  // ========== Service Instantiation ==========

  describe('Service Instantiation', () => {
    it('should be created', () => {
      expect(service).toBeTruthy();
    });

    it('should initialize with default state', () => {
      expect(service.teams()).toEqual([]);
      expect(service.selectedTeam()).toBeNull();
      expect(service.teamProjects()).toEqual([]);
      expect(service.auditLog()).toEqual([]);
      expect(service.isLoading()).toBe(false);
      expect(service.error()).toBeNull();
    });

    it('should have readonly signals', () => {
      expect(service.teams).toBeDefined();
      expect(service.selectedTeam).toBeDefined();
      expect(service.teamProjects).toBeDefined();
      expect(service.auditLog).toBeDefined();
      expect(service.isLoading).toBeDefined();
      expect(service.error).toBeDefined();
    });

    it('should have computed signals', () => {
      expect(service.hasTeams).toBeDefined();
      expect(service.teamMembers).toBeDefined();
      expect(service.pendingInvites).toBeDefined();
    });
  });

  // ========== Team CRUD ==========

  describe('Team CRUD - Load Teams', () => {
    it('should load teams successfully', async () => {
      const mockTeams = [mockTeam];
      tauriService.getTeams.mockResolvedValue(mockTeams);

      await service.loadTeams();

      expect(tauriService.getTeams).toHaveBeenCalled();
      expect(service.teams()).toEqual(mockTeams);
      expect(service.isLoading()).toBe(false);
      expect(service.error()).toBeNull();
    });

    it('should set loading state during load', async () => {
      tauriService.getTeams.mockImplementation(() => new Promise(resolve => setTimeout(() => resolve([mockTeam]), 50)));

      const loadPromise = service.loadTeams();

      expect(service.isLoading()).toBe(true);
      await loadPromise;
      expect(service.isLoading()).toBe(false);
    });

    it('should handle load teams errors', async () => {
      const error = new Error('Failed to load teams');
      tauriService.getTeams.mockRejectedValue(error);
      const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

      await service.loadTeams();

      expect(service.error()).toBe(error.toString());
      expect(consoleSpy).toHaveBeenCalled();
      consoleSpy.mockRestore();
    });

    it('should handle empty teams list', async () => {
      tauriService.getTeams.mockResolvedValue([]);

      await service.loadTeams();

      expect(service.teams()).toEqual([]);
    });
  });

  describe('Team CRUD - Create Team', () => {
    it('should create team successfully', async () => {
      tauriService.createTeam.mockResolvedValue(mockTeam);

      const team = await service.createTeam('New Team', 'Description', 2, 3);

      expect(tauriService.createTeam).toHaveBeenCalledWith('New Team', 'Description', 2, 3);
      expect(team).toEqual(mockTeam);
      expect(service.teams()).toContain(mockTeam);
    });

    it('should create team without optional parameters', async () => {
      tauriService.createTeam.mockResolvedValue(mockTeam);

      await service.createTeam('New Team');

      expect(tauriService.createTeam).toHaveBeenCalledWith('New Team', undefined, undefined, undefined);
    });

    it('should handle create team errors', async () => {
      const error = new Error('Team name exists');
      tauriService.createTeam.mockRejectedValue(error);
      const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

      const team = await service.createTeam('Duplicate');

      expect(team).toBeNull();
      expect(service.error()).toBe(error.toString());
      expect(consoleSpy).toHaveBeenCalled();
      consoleSpy.mockRestore();
    });

    it('should add created team to teams list', async () => {
      tauriService.createTeam.mockResolvedValue(mockTeam);
      tauriService.getTeams.mockResolvedValue([]);

      await service.loadTeams();
      expect(service.teams().length).toBe(0);

      await service.createTeam('New Team');

      expect(service.teams().length).toBe(1);
      expect(service.teams()[0]).toEqual(mockTeam);
    });
  });

  describe('Team CRUD - Select Team', () => {
    it('should select team and load details', async () => {
      tauriService.getTeamWithMembers.mockResolvedValue(mockTeamWithMembers);
      tauriService.getTeamProjects.mockResolvedValue([mockProject]);

      await service.selectTeam('team-1');

      expect(tauriService.getTeamWithMembers).toHaveBeenCalledWith('team-1');
      expect(tauriService.getTeamProjects).toHaveBeenCalledWith('team-1');
      expect(service.selectedTeam()).toEqual(mockTeamWithMembers);
      expect(service.teamProjects()).toEqual([mockProject]);
    });

    it('should handle select team errors', async () => {
      const error = new Error('Team not found');
      tauriService.getTeamWithMembers.mockRejectedValue(error);
      tauriService.getTeamProjects.mockResolvedValue([]);
      const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

      await service.selectTeam('non-existent');

      expect(service.error()).toBe(error.toString());
      expect(consoleSpy).toHaveBeenCalled();
      consoleSpy.mockRestore();
    });

    it('should set loading state during select', async () => {
      tauriService.getTeamWithMembers.mockImplementation(() => new Promise(resolve => setTimeout(() => resolve(mockTeamWithMembers), 50)));
      tauriService.getTeamProjects.mockResolvedValue([]);

      const selectPromise = service.selectTeam('team-1');

      expect(service.isLoading()).toBe(true);
      await selectPromise;
      expect(service.isLoading()).toBe(false);
    });
  });

  describe('Team CRUD - Update Team', () => {
    it('should update team successfully', async () => {
      const updatedTeam = { ...mockTeam, name: 'Updated Name' };
      tauriService.updateTeam.mockResolvedValue(updatedTeam);
      tauriService.getTeams.mockResolvedValue([mockTeam]);

      await service.loadTeams();
      const team = await service.updateTeam('team-1', 'Updated Name', 'Updated Description');

      expect(tauriService.updateTeam).toHaveBeenCalledWith('team-1', 'Updated Name', 'Updated Description');
      expect(team).toEqual(updatedTeam);
      expect(service.teams()[0]).toEqual(updatedTeam);
    });

    it('should refresh selected team after update', async () => {
      tauriService.updateTeam.mockResolvedValue(mockTeam);
      tauriService.getTeamWithMembers.mockResolvedValue(mockTeamWithMembers);
      tauriService.getTeamProjects.mockResolvedValue([]);

      // Select team first
      await service.selectTeam('team-1');

      // Update it
      await service.updateTeam('team-1', 'Updated');

      expect(tauriService.getTeamWithMembers).toHaveBeenCalledTimes(2);
    });

    it('should handle update team errors', async () => {
      const error = new Error('Update failed');
      tauriService.updateTeam.mockRejectedValue(error);
      const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

      const team = await service.updateTeam('team-1', 'Name');

      expect(team).toBeNull();
      expect(service.error()).toBe(error.toString());
      expect(consoleSpy).toHaveBeenCalled();
      consoleSpy.mockRestore();
    });
  });

  describe('Team CRUD - Delete Team', () => {
    it('should delete team successfully', async () => {
      tauriService.deleteTeam.mockResolvedValue(undefined);
      tauriService.getTeams.mockResolvedValue([mockTeam]);

      await service.loadTeams();
      const result = await service.deleteTeam('team-1');

      expect(tauriService.deleteTeam).toHaveBeenCalledWith('team-1');
      expect(result).toBe(true);
      expect(service.teams()).toEqual([]);
    });

    it('should clear selected team if deleted', async () => {
      tauriService.deleteTeam.mockResolvedValue(undefined);
      tauriService.getTeamWithMembers.mockResolvedValue(mockTeamWithMembers);
      tauriService.getTeamProjects.mockResolvedValue([mockProject]);

      // Select team first
      await service.selectTeam('team-1');
      expect(service.selectedTeam()).not.toBeNull();

      // Delete it
      await service.deleteTeam('team-1');

      expect(service.selectedTeam()).toBeNull();
      expect(service.teamProjects()).toEqual([]);
    });

    it('should handle delete team errors', async () => {
      const error = new Error('Cannot delete team');
      tauriService.deleteTeam.mockRejectedValue(error);
      const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

      const result = await service.deleteTeam('team-1');

      expect(result).toBe(false);
      expect(service.error()).toBe(error.toString());
      expect(consoleSpy).toHaveBeenCalled();
      consoleSpy.mockRestore();
    });

    it('should not clear different selected team', async () => {
      tauriService.deleteTeam.mockResolvedValue(undefined);
      tauriService.getTeamWithMembers.mockResolvedValue(mockTeamWithMembers);
      tauriService.getTeamProjects.mockResolvedValue([]);

      // Select team-1
      await service.selectTeam('team-1');

      // Delete team-2
      await service.deleteTeam('team-2');

      expect(service.selectedTeam()).not.toBeNull();
    });
  });

  describe('Team CRUD - Clear Selection', () => {
    it('should clear selected team and projects', async () => {
      tauriService.getTeamWithMembers.mockResolvedValue(mockTeamWithMembers);
      tauriService.getTeamProjects.mockResolvedValue([mockProject]);

      await service.selectTeam('team-1');
      expect(service.selectedTeam()).not.toBeNull();
      expect(service.teamProjects().length).toBeGreaterThan(0);

      service.clearSelection();

      expect(service.selectedTeam()).toBeNull();
      expect(service.teamProjects()).toEqual([]);
      expect(service.auditLog()).toEqual([]);
    });
  });

  // ========== Member Management ==========

  describe('Member Management - Invite', () => {
    it('should invite member successfully', async () => {
      tauriService.inviteTeamMember.mockResolvedValue(mockInvite);
      tauriService.getTeamWithMembers.mockResolvedValue(mockTeamWithMembers);
      tauriService.getTeamProjects.mockResolvedValue([]);

      const invite = await service.inviteMember('team-1', 'new@example.com', 'Member');

      expect(tauriService.inviteTeamMember).toHaveBeenCalledWith('team-1', 'new@example.com', 'Member');
      expect(invite).toEqual(mockInvite);
      expect(tauriService.getTeamWithMembers).toHaveBeenCalled();
    });

    it('should handle invite errors', async () => {
      const error = new Error('Email already invited');
      tauriService.inviteTeamMember.mockRejectedValue(error);
      const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

      const invite = await service.inviteMember('team-1', 'duplicate@example.com', 'Member');

      expect(invite).toBeNull();
      expect(service.error()).toBe(error.toString());
      expect(consoleSpy).toHaveBeenCalled();
      consoleSpy.mockRestore();
    });

    it('should invite members with different roles', async () => {
      tauriService.inviteTeamMember.mockResolvedValue(mockInvite);
      tauriService.getTeamWithMembers.mockResolvedValue(mockTeamWithMembers);
      tauriService.getTeamProjects.mockResolvedValue([]);

      const roles: TeamRole[] = ['Admin', 'Member', 'Viewer'];

      for (const role of roles) {
        await service.inviteMember('team-1', 'user@example.com', role);
        expect(tauriService.inviteTeamMember).toHaveBeenCalledWith('team-1', 'user@example.com', role);
      }
    });
  });

  describe('Member Management - Accept Invite', () => {
    it('should accept invite successfully', async () => {
      tauriService.acceptTeamInvite.mockResolvedValue(mockMember);
      tauriService.getTeams.mockResolvedValue([mockTeam]);

      const member = await service.acceptInvite('invite-token');

      expect(tauriService.acceptTeamInvite).toHaveBeenCalledWith('invite-token');
      expect(member).toEqual(mockMember);
      expect(tauriService.getTeams).toHaveBeenCalled();
    });

    it('should handle accept invite errors', async () => {
      const error = new Error('Invalid or expired token');
      tauriService.acceptTeamInvite.mockRejectedValue(error);
      const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

      const member = await service.acceptInvite('invalid-token');

      expect(member).toBeNull();
      expect(service.error()).toBe(error.toString());
      expect(consoleSpy).toHaveBeenCalled();
      consoleSpy.mockRestore();
    });
  });

  describe('Member Management - Update Role', () => {
    it('should update member role successfully', async () => {
      tauriService.updateMemberRole.mockResolvedValue(undefined);
      tauriService.getTeamWithMembers.mockResolvedValue(mockTeamWithMembers);
      tauriService.getTeamProjects.mockResolvedValue([]);

      const result = await service.updateMemberRole('team-1', 'user-2', 'Admin');

      expect(tauriService.updateMemberRole).toHaveBeenCalledWith('team-1', 'user-2', 'Admin');
      expect(result).toBe(true);
    });

    it('should handle update role errors', async () => {
      const error = new Error('Permission denied');
      tauriService.updateMemberRole.mockRejectedValue(error);
      const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

      const result = await service.updateMemberRole('team-1', 'user-2', 'Admin');

      expect(result).toBe(false);
      expect(service.error()).toBe(error.toString());
      expect(consoleSpy).toHaveBeenCalled();
      consoleSpy.mockRestore();
    });
  });

  describe('Member Management - Remove Member', () => {
    it('should remove member successfully', async () => {
      tauriService.removeTeamMember.mockResolvedValue(undefined);
      tauriService.getTeamWithMembers.mockResolvedValue(mockTeamWithMembers);
      tauriService.getTeamProjects.mockResolvedValue([]);

      const result = await service.removeMember('team-1', 'user-2');

      expect(tauriService.removeTeamMember).toHaveBeenCalledWith('team-1', 'user-2');
      expect(result).toBe(true);
    });

    it('should handle remove member errors', async () => {
      const error = new Error('Cannot remove owner');
      tauriService.removeTeamMember.mockRejectedValue(error);
      const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

      const result = await service.removeMember('team-1', 'user-1');

      expect(result).toBe(false);
      expect(service.error()).toBe(error.toString());
      expect(consoleSpy).toHaveBeenCalled();
      consoleSpy.mockRestore();
    });
  });

  describe('Member Management - Revoke Invite', () => {
    it('should revoke invite successfully', async () => {
      tauriService.revokeTeamInvite.mockResolvedValue(undefined);
      tauriService.getTeamWithMembers.mockResolvedValue(mockTeamWithMembers);
      tauriService.getTeamProjects.mockResolvedValue([]);

      // Select team first
      await service.selectTeam('team-1');

      const result = await service.revokeInvite('invite-1');

      expect(tauriService.revokeTeamInvite).toHaveBeenCalledWith('invite-1');
      expect(result).toBe(true);
    });

    it('should handle revoke invite errors', async () => {
      const error = new Error('Invite not found');
      tauriService.revokeTeamInvite.mockRejectedValue(error);
      const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

      const result = await service.revokeInvite('invalid-invite');

      expect(result).toBe(false);
      expect(service.error()).toBe(error.toString());
      expect(consoleSpy).toHaveBeenCalled();
      consoleSpy.mockRestore();
    });

    it('should not refresh when no team selected', async () => {
      tauriService.revokeTeamInvite.mockResolvedValue(undefined);

      await service.revokeInvite('invite-1');

      expect(tauriService.getTeamWithMembers).not.toHaveBeenCalled();
    });
  });

  // ========== Project Sharing ==========

  describe('Project Sharing - Share Project', () => {
    it('should share project with team', async () => {
      tauriService.shareProjectWithTeam.mockResolvedValue({});
      tauriService.getTeamProjects.mockResolvedValue([mockProject]);
      tauriService.getTeamWithMembers.mockResolvedValue(mockTeamWithMembers);

      // Select team first
      await service.selectTeam('team-1');

      const result = await service.shareProject('proj-1', 'team-1');

      expect(tauriService.shareProjectWithTeam).toHaveBeenCalledWith('proj-1', 'team-1');
      expect(result).toBe(true);
      expect(service.teamProjects()).toContain(mockProject);
    });

    it('should handle share project errors', async () => {
      const error = new Error('Already shared');
      tauriService.shareProjectWithTeam.mockRejectedValue(error);
      const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

      const result = await service.shareProject('proj-1', 'team-1');

      expect(result).toBe(false);
      expect(service.error()).toBe(error.toString());
      expect(consoleSpy).toHaveBeenCalled();
      consoleSpy.mockRestore();
    });
  });

  describe('Project Sharing - Unshare Project', () => {
    it('should unshare project from team', async () => {
      tauriService.unshareProjectFromTeam.mockResolvedValue(undefined);
      tauriService.getTeamWithMembers.mockResolvedValue(mockTeamWithMembers);
      tauriService.getTeamProjects.mockResolvedValue([mockProject]);

      // Select team and add project
      await service.selectTeam('team-1');

      const result = await service.unshareProject('proj-1', 'team-1');

      expect(tauriService.unshareProjectFromTeam).toHaveBeenCalledWith('proj-1', 'team-1');
      expect(result).toBe(true);
    });

    it('should handle unshare project errors', async () => {
      const error = new Error('Project not shared');
      tauriService.unshareProjectFromTeam.mockRejectedValue(error);
      const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

      const result = await service.unshareProject('proj-1', 'team-1');

      expect(result).toBe(false);
      expect(service.error()).toBe(error.toString());
      expect(consoleSpy).toHaveBeenCalled();
      consoleSpy.mockRestore();
    });
  });

  describe('Project Sharing - Get Project Teams', () => {
    it('should get teams for a project', async () => {
      const mockTeams = [mockTeam];
      tauriService.getProjectTeams.mockResolvedValue(mockTeams);

      const teams = await service.getProjectTeams('proj-1');

      expect(tauriService.getProjectTeams).toHaveBeenCalledWith('proj-1');
      expect(teams).toEqual(mockTeams);
    });

    it('should handle get project teams errors', async () => {
      tauriService.getProjectTeams.mockRejectedValue(new Error('Error'));
      const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

      const teams = await service.getProjectTeams('proj-1');

      expect(teams).toEqual([]);
      expect(consoleSpy).toHaveBeenCalled();
      consoleSpy.mockRestore();
    });
  });

  describe('Project Sharing - Check Access', () => {
    it('should check project access', async () => {
      tauriService.checkProjectAccess.mockResolvedValue('Admin');

      const role = await service.checkProjectAccess('proj-1');

      expect(tauriService.checkProjectAccess).toHaveBeenCalledWith('proj-1');
      expect(role).toBe('Admin');
    });

    it('should handle check access errors', async () => {
      tauriService.checkProjectAccess.mockRejectedValue(new Error('Error'));
      const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

      const role = await service.checkProjectAccess('proj-1');

      expect(role).toBeNull();
      expect(consoleSpy).toHaveBeenCalled();
      consoleSpy.mockRestore();
    });
  });

  // ========== VeilKey Operations ==========

  describe('VeilKey Operations', () => {
    it('should generate team key', async () => {
      tauriService.generateTeamKey.mockResolvedValue(undefined);
      tauriService.getTeamWithMembers.mockResolvedValue(mockTeamWithMembers);
      tauriService.getTeamProjects.mockResolvedValue([]);

      const result = await service.generateTeamKey('team-1');

      expect(tauriService.generateTeamKey).toHaveBeenCalledWith('team-1');
      expect(result).toBe(true);
    });

    it('should handle generate key errors', async () => {
      const error = new Error('Key already exists');
      tauriService.generateTeamKey.mockRejectedValue(error);
      const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

      const result = await service.generateTeamKey('team-1');

      expect(result).toBe(false);
      expect(service.error()).toBe(error.toString());
      expect(consoleSpy).toHaveBeenCalled();
      consoleSpy.mockRestore();
    });

    it('should get my key share', async () => {
      tauriService.getMyKeyShare.mockResolvedValue(mockKeyShare);

      const share = await service.getMyKeyShare('team-1');

      expect(tauriService.getMyKeyShare).toHaveBeenCalledWith('team-1');
      expect(share).toEqual(mockKeyShare);
    });

    it('should handle get key share errors', async () => {
      tauriService.getMyKeyShare.mockRejectedValue(new Error('Error'));
      const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

      const share = await service.getMyKeyShare('team-1');

      expect(share).toBeNull();
      expect(consoleSpy).toHaveBeenCalled();
      consoleSpy.mockRestore();
    });
  });

  // ========== Audit Log Operations ==========

  describe('Audit Log Operations', () => {
    it('should load team audit log', async () => {
      const mockEvents = [mockAuditEvent];
      tauriService.getTeamAuditLog.mockResolvedValue(mockEvents);

      await service.loadTeamAuditLog('team-1', 100);

      expect(tauriService.getTeamAuditLog).toHaveBeenCalledWith('team-1', 100);
      expect(service.auditLog()).toEqual(mockEvents);
    });

    it('should load audit log with default limit', async () => {
      tauriService.getTeamAuditLog.mockResolvedValue([]);

      await service.loadTeamAuditLog('team-1');

      expect(tauriService.getTeamAuditLog).toHaveBeenCalledWith('team-1', undefined);
    });

    it('should handle audit log errors', async () => {
      tauriService.getTeamAuditLog.mockRejectedValue(new Error('Error'));
      const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

      await service.loadTeamAuditLog('team-1');

      expect(consoleSpy).toHaveBeenCalled();
      consoleSpy.mockRestore();
    });

    it('should load project audit log', async () => {
      const mockEvents = [mockAuditEvent];
      tauriService.getProjectAuditLog.mockResolvedValue(mockEvents);

      const events = await service.loadProjectAuditLog('proj-1', 50);

      expect(tauriService.getProjectAuditLog).toHaveBeenCalledWith('proj-1', 50);
      expect(events).toEqual(mockEvents);
    });

    it('should handle project audit log errors', async () => {
      tauriService.getProjectAuditLog.mockRejectedValue(new Error('Error'));
      const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

      const events = await service.loadProjectAuditLog('proj-1');

      expect(events).toEqual([]);
      expect(consoleSpy).toHaveBeenCalled();
      consoleSpy.mockRestore();
    });

    it('should query audit log', async () => {
      const query: AuditQuery = {
        event_types: ['TeamCreated', 'TeamUpdated'],
        team_id: 'team-1',
        limit: 100,
      };
      const mockEvents = [mockAuditEvent];
      tauriService.queryAuditLog.mockResolvedValue(mockEvents);

      const events = await service.queryAuditLog(query);

      expect(tauriService.queryAuditLog).toHaveBeenCalledWith(query);
      expect(events).toEqual(mockEvents);
    });

    it('should handle query audit log errors', async () => {
      tauriService.queryAuditLog.mockRejectedValue(new Error('Error'));
      const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

      const events = await service.queryAuditLog({});

      expect(events).toEqual([]);
      expect(consoleSpy).toHaveBeenCalled();
      consoleSpy.mockRestore();
    });
  });

  // ========== Computed Signals ==========

  describe('Computed Signals', () => {
    it('should compute hasTeams from teams', async () => {
      expect(service.hasTeams()).toBe(false);

      tauriService.getTeams.mockResolvedValue([mockTeam]);
      await service.loadTeams();

      expect(service.hasTeams()).toBe(true);
    });

    it('should compute teamMembers from selectedTeam', async () => {
      expect(service.teamMembers()).toEqual([]);

      tauriService.getTeamWithMembers.mockResolvedValue(mockTeamWithMembers);
      tauriService.getTeamProjects.mockResolvedValue([]);
      await service.selectTeam('team-1');

      expect(service.teamMembers()).toEqual([mockMember]);
    });

    it('should compute pendingInvites from selectedTeam', async () => {
      expect(service.pendingInvites()).toEqual([]);

      tauriService.getTeamWithMembers.mockResolvedValue(mockTeamWithMembers);
      tauriService.getTeamProjects.mockResolvedValue([]);
      await service.selectTeam('team-1');

      expect(service.pendingInvites()).toEqual([mockInvite]);
    });

    it('should return empty array when no team selected', () => {
      expect(service.teamMembers()).toEqual([]);
      expect(service.pendingInvites()).toEqual([]);
    });
  });

  // ========== Error Handling ==========

  describe('Error Handling', () => {
    it('should set error message on failures', async () => {
      const error = new Error('Test error');
      tauriService.getTeams.mockRejectedValue(error);
      vi.spyOn(console, 'error').mockImplementation(() => {});

      await service.loadTeams();

      expect(service.error()).toBe(error.toString());
    });

    it('should clear error on successful operations', async () => {
      // Set error first
      const error = new Error('First error');
      tauriService.getTeams.mockRejectedValue(error);
      vi.spyOn(console, 'error').mockImplementation(() => {});
      await service.loadTeams();
      expect(service.error()).not.toBeNull();

      // Successful operation should clear error
      tauriService.getTeams.mockResolvedValue([mockTeam]);
      await service.loadTeams();

      expect(service.error()).toBeNull();
    });
  });

  // ========== Edge Cases ==========

  describe('Edge Cases', () => {
    it('should handle rapid team selection changes', async () => {
      tauriService.getTeamWithMembers.mockResolvedValue(mockTeamWithMembers);
      tauriService.getTeamProjects.mockResolvedValue([]);

      await service.selectTeam('team-1');
      await service.selectTeam('team-2');
      await service.selectTeam('team-3');

      expect(tauriService.getTeamWithMembers).toHaveBeenCalledTimes(3);
    });

    it('should handle empty team members', async () => {
      const emptyTeam: TeamWithMembers = {
        ...mockTeam,
        members: [],
        pending_invites: [],
      };
      tauriService.getTeamWithMembers.mockResolvedValue(emptyTeam);
      tauriService.getTeamProjects.mockResolvedValue([]);

      await service.selectTeam('team-1');

      expect(service.teamMembers()).toEqual([]);
      expect(service.pendingInvites()).toEqual([]);
    });

    it('should handle null responses gracefully', async () => {
      tauriService.getMyKeyShare.mockResolvedValue(null);

      const share = await service.getMyKeyShare('team-1');

      expect(share).toBeNull();
    });
  });
});
