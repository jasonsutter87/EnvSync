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

import { TestBed } from '@angular/core/testing';
import { TeamService } from './team.service';
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

describe('TeamService', () => {
  let service: TeamService;
  let tauriService: jasmine.SpyObj<TauriService>;

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
    const tauriSpy = jasmine.createSpyObj('TauriService', [
      'getTeams',
      'getTeam',
      'getTeamWithMembers',
      'createTeam',
      'updateTeam',
      'deleteTeam',
      'inviteTeamMember',
      'acceptTeamInvite',
      'updateMemberRole',
      'removeTeamMember',
      'revokeTeamInvite',
      'shareProjectWithTeam',
      'unshareProjectFromTeam',
      'getTeamProjects',
      'getProjectTeams',
      'checkProjectAccess',
      'generateTeamKey',
      'getMyKeyShare',
      'getTeamAuditLog',
      'getProjectAuditLog',
      'queryAuditLog',
    ]);

    TestBed.configureTestingModule({
      providers: [
        TeamService,
        { provide: TauriService, useValue: tauriSpy },
      ],
    });

    service = TestBed.inject(TeamService);
    tauriService = TestBed.inject(TauriService) as jasmine.SpyObj<TauriService>;
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
      tauriService.getTeams.and.returnValue(Promise.resolve(mockTeams));

      await service.loadTeams();

      expect(tauriService.getTeams).toHaveBeenCalled();
      expect(service.teams()).toEqual(mockTeams);
      expect(service.isLoading()).toBe(false);
      expect(service.error()).toBeNull();
    });

    it('should set loading state during load', async () => {
      tauriService.getTeams.and.returnValue(new Promise(resolve => setTimeout(() => resolve([mockTeam]), 100)));

      const loadPromise = service.loadTeams();

      expect(service.isLoading()).toBe(true);
      await loadPromise;
      expect(service.isLoading()).toBe(false);
    });

    it('should handle load teams errors', async () => {
      const error = new Error('Failed to load teams');
      tauriService.getTeams.and.returnValue(Promise.reject(error));
      const consoleSpy = spyOn(console, 'error');

      await service.loadTeams();

      expect(service.error()).toBe(error.toString());
      expect(consoleSpy).toHaveBeenCalled();
    });

    it('should handle empty teams list', async () => {
      tauriService.getTeams.and.returnValue(Promise.resolve([]));

      await service.loadTeams();

      expect(service.teams()).toEqual([]);
    });
  });

  describe('Team CRUD - Create Team', () => {
    it('should create team successfully', async () => {
      tauriService.createTeam.and.returnValue(Promise.resolve(mockTeam));

      const team = await service.createTeam('New Team', 'Description', 2, 3);

      expect(tauriService.createTeam).toHaveBeenCalledWith('New Team', 'Description', 2, 3);
      expect(team).toEqual(mockTeam);
      expect(service.teams()).toContain(mockTeam);
    });

    it('should create team without optional parameters', async () => {
      tauriService.createTeam.and.returnValue(Promise.resolve(mockTeam));

      await service.createTeam('New Team');

      expect(tauriService.createTeam).toHaveBeenCalledWith('New Team', undefined, undefined, undefined);
    });

    it('should handle create team errors', async () => {
      const error = new Error('Team name exists');
      tauriService.createTeam.and.returnValue(Promise.reject(error));
      const consoleSpy = spyOn(console, 'error');

      const team = await service.createTeam('Duplicate');

      expect(team).toBeNull();
      expect(service.error()).toBe(error.toString());
      expect(consoleSpy).toHaveBeenCalled();
    });

    it('should add created team to teams list', async () => {
      tauriService.createTeam.and.returnValue(Promise.resolve(mockTeam));
      tauriService.getTeams.and.returnValue(Promise.resolve([]));

      await service.loadTeams();
      expect(service.teams().length).toBe(0);

      await service.createTeam('New Team');

      expect(service.teams().length).toBe(1);
      expect(service.teams()[0]).toEqual(mockTeam);
    });
  });

  describe('Team CRUD - Select Team', () => {
    it('should select team and load details', async () => {
      tauriService.getTeamWithMembers.and.returnValue(Promise.resolve(mockTeamWithMembers));
      tauriService.getTeamProjects.and.returnValue(Promise.resolve([mockProject]));

      await service.selectTeam('team-1');

      expect(tauriService.getTeamWithMembers).toHaveBeenCalledWith('team-1');
      expect(tauriService.getTeamProjects).toHaveBeenCalledWith('team-1');
      expect(service.selectedTeam()).toEqual(mockTeamWithMembers);
      expect(service.teamProjects()).toEqual([mockProject]);
    });

    it('should handle select team errors', async () => {
      const error = new Error('Team not found');
      tauriService.getTeamWithMembers.and.returnValue(Promise.reject(error));
      tauriService.getTeamProjects.and.returnValue(Promise.resolve([]));
      const consoleSpy = spyOn(console, 'error');

      await service.selectTeam('non-existent');

      expect(service.error()).toBe(error.toString());
      expect(consoleSpy).toHaveBeenCalled();
    });

    it('should set loading state during select', async () => {
      tauriService.getTeamWithMembers.and.returnValue(new Promise(resolve => setTimeout(() => resolve(mockTeamWithMembers), 100)));
      tauriService.getTeamProjects.and.returnValue(Promise.resolve([]));

      const selectPromise = service.selectTeam('team-1');

      expect(service.isLoading()).toBe(true);
      await selectPromise;
      expect(service.isLoading()).toBe(false);
    });
  });

  describe('Team CRUD - Update Team', () => {
    it('should update team successfully', async () => {
      const updatedTeam = { ...mockTeam, name: 'Updated Name' };
      tauriService.updateTeam.and.returnValue(Promise.resolve(updatedTeam));
      tauriService.getTeams.and.returnValue(Promise.resolve([mockTeam]));

      await service.loadTeams();
      const team = await service.updateTeam('team-1', 'Updated Name', 'Updated Description');

      expect(tauriService.updateTeam).toHaveBeenCalledWith('team-1', 'Updated Name', 'Updated Description');
      expect(team).toEqual(updatedTeam);
      expect(service.teams()[0]).toEqual(updatedTeam);
    });

    it('should refresh selected team after update', async () => {
      tauriService.updateTeam.and.returnValue(Promise.resolve(mockTeam));
      tauriService.getTeamWithMembers.and.returnValue(Promise.resolve(mockTeamWithMembers));
      tauriService.getTeamProjects.and.returnValue(Promise.resolve([]));

      // Select team first
      await service.selectTeam('team-1');

      // Update it
      await service.updateTeam('team-1', 'Updated');

      expect(tauriService.getTeamWithMembers).toHaveBeenCalledTimes(2);
    });

    it('should handle update team errors', async () => {
      const error = new Error('Update failed');
      tauriService.updateTeam.and.returnValue(Promise.reject(error));
      const consoleSpy = spyOn(console, 'error');

      const team = await service.updateTeam('team-1', 'Name');

      expect(team).toBeNull();
      expect(service.error()).toBe(error.toString());
      expect(consoleSpy).toHaveBeenCalled();
    });
  });

  describe('Team CRUD - Delete Team', () => {
    it('should delete team successfully', async () => {
      tauriService.deleteTeam.and.returnValue(Promise.resolve());
      tauriService.getTeams.and.returnValue(Promise.resolve([mockTeam]));

      await service.loadTeams();
      const result = await service.deleteTeam('team-1');

      expect(tauriService.deleteTeam).toHaveBeenCalledWith('team-1');
      expect(result).toBe(true);
      expect(service.teams()).toEqual([]);
    });

    it('should clear selected team if deleted', async () => {
      tauriService.deleteTeam.and.returnValue(Promise.resolve());
      tauriService.getTeamWithMembers.and.returnValue(Promise.resolve(mockTeamWithMembers));
      tauriService.getTeamProjects.and.returnValue(Promise.resolve([mockProject]));

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
      tauriService.deleteTeam.and.returnValue(Promise.reject(error));
      const consoleSpy = spyOn(console, 'error');

      const result = await service.deleteTeam('team-1');

      expect(result).toBe(false);
      expect(service.error()).toBe(error.toString());
      expect(consoleSpy).toHaveBeenCalled();
    });

    it('should not clear different selected team', async () => {
      tauriService.deleteTeam.and.returnValue(Promise.resolve());
      tauriService.getTeamWithMembers.and.returnValue(Promise.resolve(mockTeamWithMembers));
      tauriService.getTeamProjects.and.returnValue(Promise.resolve([]));

      // Select team-1
      await service.selectTeam('team-1');

      // Delete team-2
      await service.deleteTeam('team-2');

      expect(service.selectedTeam()).not.toBeNull();
    });
  });

  describe('Team CRUD - Clear Selection', () => {
    it('should clear selected team and projects', async () => {
      tauriService.getTeamWithMembers.and.returnValue(Promise.resolve(mockTeamWithMembers));
      tauriService.getTeamProjects.and.returnValue(Promise.resolve([mockProject]));

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
      tauriService.inviteTeamMember.and.returnValue(Promise.resolve(mockInvite));
      tauriService.getTeamWithMembers.and.returnValue(Promise.resolve(mockTeamWithMembers));
      tauriService.getTeamProjects.and.returnValue(Promise.resolve([]));

      const invite = await service.inviteMember('team-1', 'new@example.com', 'Member');

      expect(tauriService.inviteTeamMember).toHaveBeenCalledWith('team-1', 'new@example.com', 'Member');
      expect(invite).toEqual(mockInvite);
      expect(tauriService.getTeamWithMembers).toHaveBeenCalled();
    });

    it('should handle invite errors', async () => {
      const error = new Error('Email already invited');
      tauriService.inviteTeamMember.and.returnValue(Promise.reject(error));
      const consoleSpy = spyOn(console, 'error');

      const invite = await service.inviteMember('team-1', 'duplicate@example.com', 'Member');

      expect(invite).toBeNull();
      expect(service.error()).toBe(error.toString());
      expect(consoleSpy).toHaveBeenCalled();
    });

    it('should invite members with different roles', async () => {
      tauriService.inviteTeamMember.and.returnValue(Promise.resolve(mockInvite));
      tauriService.getTeamWithMembers.and.returnValue(Promise.resolve(mockTeamWithMembers));
      tauriService.getTeamProjects.and.returnValue(Promise.resolve([]));

      const roles: TeamRole[] = ['Admin', 'Member', 'Viewer'];

      for (const role of roles) {
        await service.inviteMember('team-1', 'user@example.com', role);
        expect(tauriService.inviteTeamMember).toHaveBeenCalledWith('team-1', 'user@example.com', role);
      }
    });
  });

  describe('Member Management - Accept Invite', () => {
    it('should accept invite successfully', async () => {
      tauriService.acceptTeamInvite.and.returnValue(Promise.resolve(mockMember));
      tauriService.getTeams.and.returnValue(Promise.resolve([mockTeam]));

      const member = await service.acceptInvite('invite-token');

      expect(tauriService.acceptTeamInvite).toHaveBeenCalledWith('invite-token');
      expect(member).toEqual(mockMember);
      expect(tauriService.getTeams).toHaveBeenCalled();
    });

    it('should handle accept invite errors', async () => {
      const error = new Error('Invalid or expired token');
      tauriService.acceptTeamInvite.and.returnValue(Promise.reject(error));
      const consoleSpy = spyOn(console, 'error');

      const member = await service.acceptInvite('invalid-token');

      expect(member).toBeNull();
      expect(service.error()).toBe(error.toString());
      expect(consoleSpy).toHaveBeenCalled();
    });
  });

  describe('Member Management - Update Role', () => {
    it('should update member role successfully', async () => {
      tauriService.updateMemberRole.and.returnValue(Promise.resolve());
      tauriService.getTeamWithMembers.and.returnValue(Promise.resolve(mockTeamWithMembers));
      tauriService.getTeamProjects.and.returnValue(Promise.resolve([]));

      const result = await service.updateMemberRole('team-1', 'user-2', 'Admin');

      expect(tauriService.updateMemberRole).toHaveBeenCalledWith('team-1', 'user-2', 'Admin');
      expect(result).toBe(true);
    });

    it('should handle update role errors', async () => {
      const error = new Error('Permission denied');
      tauriService.updateMemberRole.and.returnValue(Promise.reject(error));
      const consoleSpy = spyOn(console, 'error');

      const result = await service.updateMemberRole('team-1', 'user-2', 'Admin');

      expect(result).toBe(false);
      expect(service.error()).toBe(error.toString());
      expect(consoleSpy).toHaveBeenCalled();
    });
  });

  describe('Member Management - Remove Member', () => {
    it('should remove member successfully', async () => {
      tauriService.removeTeamMember.and.returnValue(Promise.resolve());
      tauriService.getTeamWithMembers.and.returnValue(Promise.resolve(mockTeamWithMembers));
      tauriService.getTeamProjects.and.returnValue(Promise.resolve([]));

      const result = await service.removeMember('team-1', 'user-2');

      expect(tauriService.removeTeamMember).toHaveBeenCalledWith('team-1', 'user-2');
      expect(result).toBe(true);
    });

    it('should handle remove member errors', async () => {
      const error = new Error('Cannot remove owner');
      tauriService.removeTeamMember.and.returnValue(Promise.reject(error));
      const consoleSpy = spyOn(console, 'error');

      const result = await service.removeMember('team-1', 'user-1');

      expect(result).toBe(false);
      expect(service.error()).toBe(error.toString());
      expect(consoleSpy).toHaveBeenCalled();
    });
  });

  describe('Member Management - Revoke Invite', () => {
    it('should revoke invite successfully', async () => {
      tauriService.revokeTeamInvite.and.returnValue(Promise.resolve());
      tauriService.getTeamWithMembers.and.returnValue(Promise.resolve(mockTeamWithMembers));
      tauriService.getTeamProjects.and.returnValue(Promise.resolve([]));

      // Select team first
      await service.selectTeam('team-1');

      const result = await service.revokeInvite('invite-1');

      expect(tauriService.revokeTeamInvite).toHaveBeenCalledWith('invite-1');
      expect(result).toBe(true);
    });

    it('should handle revoke invite errors', async () => {
      const error = new Error('Invite not found');
      tauriService.revokeTeamInvite.and.returnValue(Promise.reject(error));
      const consoleSpy = spyOn(console, 'error');

      const result = await service.revokeInvite('invalid-invite');

      expect(result).toBe(false);
      expect(service.error()).toBe(error.toString());
      expect(consoleSpy).toHaveBeenCalled();
    });

    it('should not refresh when no team selected', async () => {
      tauriService.revokeTeamInvite.and.returnValue(Promise.resolve());

      await service.revokeInvite('invite-1');

      expect(tauriService.getTeamWithMembers).not.toHaveBeenCalled();
    });
  });

  // ========== Project Sharing ==========

  describe('Project Sharing - Share Project', () => {
    it('should share project with team', async () => {
      tauriService.shareProjectWithTeam.and.returnValue(Promise.resolve({} as any));
      tauriService.getTeamProjects.and.returnValue(Promise.resolve([mockProject]));
      tauriService.getTeamWithMembers.and.returnValue(Promise.resolve(mockTeamWithMembers));

      // Select team first
      await service.selectTeam('team-1');

      const result = await service.shareProject('proj-1', 'team-1');

      expect(tauriService.shareProjectWithTeam).toHaveBeenCalledWith('proj-1', 'team-1');
      expect(result).toBe(true);
      expect(service.teamProjects()).toContain(mockProject);
    });

    it('should handle share project errors', async () => {
      const error = new Error('Already shared');
      tauriService.shareProjectWithTeam.and.returnValue(Promise.reject(error));
      const consoleSpy = spyOn(console, 'error');

      const result = await service.shareProject('proj-1', 'team-1');

      expect(result).toBe(false);
      expect(service.error()).toBe(error.toString());
      expect(consoleSpy).toHaveBeenCalled();
    });
  });

  describe('Project Sharing - Unshare Project', () => {
    it('should unshare project from team', async () => {
      tauriService.unshareProjectFromTeam.and.returnValue(Promise.resolve());
      tauriService.getTeamWithMembers.and.returnValue(Promise.resolve(mockTeamWithMembers));
      tauriService.getTeamProjects.and.returnValue(Promise.resolve([mockProject]));

      // Select team and add project
      await service.selectTeam('team-1');

      const result = await service.unshareProject('proj-1', 'team-1');

      expect(tauriService.unshareProjectFromTeam).toHaveBeenCalledWith('proj-1', 'team-1');
      expect(result).toBe(true);
    });

    it('should handle unshare project errors', async () => {
      const error = new Error('Project not shared');
      tauriService.unshareProjectFromTeam.and.returnValue(Promise.reject(error));
      const consoleSpy = spyOn(console, 'error');

      const result = await service.unshareProject('proj-1', 'team-1');

      expect(result).toBe(false);
      expect(service.error()).toBe(error.toString());
      expect(consoleSpy).toHaveBeenCalled();
    });
  });

  describe('Project Sharing - Get Project Teams', () => {
    it('should get teams for a project', async () => {
      const mockTeams = [mockTeam];
      tauriService.getProjectTeams.and.returnValue(Promise.resolve(mockTeams));

      const teams = await service.getProjectTeams('proj-1');

      expect(tauriService.getProjectTeams).toHaveBeenCalledWith('proj-1');
      expect(teams).toEqual(mockTeams);
    });

    it('should handle get project teams errors', async () => {
      tauriService.getProjectTeams.and.returnValue(Promise.reject(new Error('Error')));
      const consoleSpy = spyOn(console, 'error');

      const teams = await service.getProjectTeams('proj-1');

      expect(teams).toEqual([]);
      expect(consoleSpy).toHaveBeenCalled();
    });
  });

  describe('Project Sharing - Check Access', () => {
    it('should check project access', async () => {
      tauriService.checkProjectAccess.and.returnValue(Promise.resolve('Admin'));

      const role = await service.checkProjectAccess('proj-1');

      expect(tauriService.checkProjectAccess).toHaveBeenCalledWith('proj-1');
      expect(role).toBe('Admin');
    });

    it('should handle check access errors', async () => {
      tauriService.checkProjectAccess.and.returnValue(Promise.reject(new Error('Error')));
      const consoleSpy = spyOn(console, 'error');

      const role = await service.checkProjectAccess('proj-1');

      expect(role).toBeNull();
      expect(consoleSpy).toHaveBeenCalled();
    });
  });

  // ========== VeilKey Operations ==========

  describe('VeilKey Operations', () => {
    it('should generate team key', async () => {
      tauriService.generateTeamKey.and.returnValue(Promise.resolve());
      tauriService.getTeamWithMembers.and.returnValue(Promise.resolve(mockTeamWithMembers));
      tauriService.getTeamProjects.and.returnValue(Promise.resolve([]));

      const result = await service.generateTeamKey('team-1');

      expect(tauriService.generateTeamKey).toHaveBeenCalledWith('team-1');
      expect(result).toBe(true);
    });

    it('should handle generate key errors', async () => {
      const error = new Error('Key already exists');
      tauriService.generateTeamKey.and.returnValue(Promise.reject(error));
      const consoleSpy = spyOn(console, 'error');

      const result = await service.generateTeamKey('team-1');

      expect(result).toBe(false);
      expect(service.error()).toBe(error.toString());
      expect(consoleSpy).toHaveBeenCalled();
    });

    it('should get my key share', async () => {
      tauriService.getMyKeyShare.and.returnValue(Promise.resolve(mockKeyShare));

      const share = await service.getMyKeyShare('team-1');

      expect(tauriService.getMyKeyShare).toHaveBeenCalledWith('team-1');
      expect(share).toEqual(mockKeyShare);
    });

    it('should handle get key share errors', async () => {
      tauriService.getMyKeyShare.and.returnValue(Promise.reject(new Error('Error')));
      const consoleSpy = spyOn(console, 'error');

      const share = await service.getMyKeyShare('team-1');

      expect(share).toBeNull();
      expect(consoleSpy).toHaveBeenCalled();
    });
  });

  // ========== Audit Log Operations ==========

  describe('Audit Log Operations', () => {
    it('should load team audit log', async () => {
      const mockEvents = [mockAuditEvent];
      tauriService.getTeamAuditLog.and.returnValue(Promise.resolve(mockEvents));

      await service.loadTeamAuditLog('team-1', 100);

      expect(tauriService.getTeamAuditLog).toHaveBeenCalledWith('team-1', 100);
      expect(service.auditLog()).toEqual(mockEvents);
    });

    it('should load audit log with default limit', async () => {
      tauriService.getTeamAuditLog.and.returnValue(Promise.resolve([]));

      await service.loadTeamAuditLog('team-1');

      expect(tauriService.getTeamAuditLog).toHaveBeenCalledWith('team-1', undefined);
    });

    it('should handle audit log errors', async () => {
      tauriService.getTeamAuditLog.and.returnValue(Promise.reject(new Error('Error')));
      const consoleSpy = spyOn(console, 'error');

      await service.loadTeamAuditLog('team-1');

      expect(consoleSpy).toHaveBeenCalled();
    });

    it('should load project audit log', async () => {
      const mockEvents = [mockAuditEvent];
      tauriService.getProjectAuditLog.and.returnValue(Promise.resolve(mockEvents));

      const events = await service.loadProjectAuditLog('proj-1', 50);

      expect(tauriService.getProjectAuditLog).toHaveBeenCalledWith('proj-1', 50);
      expect(events).toEqual(mockEvents);
    });

    it('should handle project audit log errors', async () => {
      tauriService.getProjectAuditLog.and.returnValue(Promise.reject(new Error('Error')));
      const consoleSpy = spyOn(console, 'error');

      const events = await service.loadProjectAuditLog('proj-1');

      expect(events).toEqual([]);
      expect(consoleSpy).toHaveBeenCalled();
    });

    it('should query audit log', async () => {
      const query: AuditQuery = {
        event_types: ['TeamCreated', 'TeamUpdated'],
        team_id: 'team-1',
        limit: 100,
      };
      const mockEvents = [mockAuditEvent];
      tauriService.queryAuditLog.and.returnValue(Promise.resolve(mockEvents));

      const events = await service.queryAuditLog(query);

      expect(tauriService.queryAuditLog).toHaveBeenCalledWith(query);
      expect(events).toEqual(mockEvents);
    });

    it('should handle query audit log errors', async () => {
      tauriService.queryAuditLog.and.returnValue(Promise.reject(new Error('Error')));
      const consoleSpy = spyOn(console, 'error');

      const events = await service.queryAuditLog({});

      expect(events).toEqual([]);
      expect(consoleSpy).toHaveBeenCalled();
    });
  });

  // ========== Computed Signals ==========

  describe('Computed Signals', () => {
    it('should compute hasTeams from teams', async () => {
      expect(service.hasTeams()).toBe(false);

      tauriService.getTeams.and.returnValue(Promise.resolve([mockTeam]));
      await service.loadTeams();

      expect(service.hasTeams()).toBe(true);
    });

    it('should compute teamMembers from selectedTeam', async () => {
      expect(service.teamMembers()).toEqual([]);

      tauriService.getTeamWithMembers.and.returnValue(Promise.resolve(mockTeamWithMembers));
      tauriService.getTeamProjects.and.returnValue(Promise.resolve([]));
      await service.selectTeam('team-1');

      expect(service.teamMembers()).toEqual([mockMember]);
    });

    it('should compute pendingInvites from selectedTeam', async () => {
      expect(service.pendingInvites()).toEqual([]);

      tauriService.getTeamWithMembers.and.returnValue(Promise.resolve(mockTeamWithMembers));
      tauriService.getTeamProjects.and.returnValue(Promise.resolve([]));
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
      tauriService.getTeams.and.returnValue(Promise.reject(error));
      spyOn(console, 'error');

      await service.loadTeams();

      expect(service.error()).toBe(error.toString());
    });

    it('should clear error on successful operations', async () => {
      // Set error first
      const error = new Error('First error');
      tauriService.getTeams.and.returnValue(Promise.reject(error));
      spyOn(console, 'error');
      await service.loadTeams();
      expect(service.error()).not.toBeNull();

      // Successful operation should clear error
      tauriService.getTeams.and.returnValue(Promise.resolve([mockTeam]));
      await service.loadTeams();

      expect(service.error()).toBeNull();
    });
  });

  // ========== Edge Cases ==========

  describe('Edge Cases', () => {
    it('should handle rapid team selection changes', async () => {
      tauriService.getTeamWithMembers.and.returnValue(Promise.resolve(mockTeamWithMembers));
      tauriService.getTeamProjects.and.returnValue(Promise.resolve([]));

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
      tauriService.getTeamWithMembers.and.returnValue(Promise.resolve(emptyTeam));
      tauriService.getTeamProjects.and.returnValue(Promise.resolve([]));

      await service.selectTeam('team-1');

      expect(service.teamMembers()).toEqual([]);
      expect(service.pendingInvites()).toEqual([]);
    });

    it('should handle null responses gracefully', async () => {
      tauriService.getMyKeyShare.and.returnValue(Promise.resolve(null));

      const share = await service.getMyKeyShare('team-1');

      expect(share).toBeNull();
    });
  });
});
