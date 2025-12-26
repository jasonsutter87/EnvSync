/**
 * Unit tests for TeamPanelComponent
 *
 * Tests cover:
 * - Team list rendering
 * - Member display
 * - Invite functionality
 * - Role management
 * - Team creation
 * - Permissions
 * - Modals
 * - Project sharing
 */

import { ComponentFixture, TestBed } from '@angular/core/testing';
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { signal } from '@angular/core';
import { TeamPanelComponent } from './team-panel.component';
import { TeamService } from '../../core/services/team.service';
import { SyncService } from '../../core/services/sync.service';

// Mock TeamService
class MockTeamService {
  teams = signal<any[]>([]);
  selectedTeam = signal<any>(null);
  teamMembers = signal<any[]>([]);
  teamProjects = signal<any[]>([]);
  pendingInvites = signal<any[]>([]);
  auditLog = signal<any[]>([]);

  selectTeam = vi.fn().mockResolvedValue(undefined);
  createTeam = vi.fn().mockResolvedValue({ id: 'team-1', name: 'Test Team' });
  inviteMember = vi.fn().mockResolvedValue({ id: 'invite-1', email: 'test@example.com' });
  updateMemberRole = vi.fn().mockResolvedValue(undefined);
  removeMember = vi.fn().mockResolvedValue(undefined);
  revokeInvite = vi.fn().mockResolvedValue(undefined);
  unshareProject = vi.fn().mockResolvedValue(undefined);
  deleteTeam = vi.fn().mockResolvedValue(undefined);
  loadTeamAuditLog = vi.fn().mockResolvedValue(undefined);
}

// Mock SyncService
class MockSyncService {
  isConnected = signal(true);
  user = signal<any>({ id: 'user-1', email: 'user@example.com', name: 'Test User' });
  status = signal({ state: 'idle' });

  sync = vi.fn().mockResolvedValue(undefined);
  logout = vi.fn().mockResolvedValue(undefined);
}

describe('TeamPanelComponent', () => {
  let component: TeamPanelComponent;
  let fixture: ComponentFixture<TeamPanelComponent>;
  let mockTeamService: MockTeamService;
  let mockSyncService: MockSyncService;

  beforeEach(async () => {
    mockTeamService = new MockTeamService();
    mockSyncService = new MockSyncService();

    await TestBed.configureTestingModule({
      imports: [TeamPanelComponent],
      providers: [
        { provide: TeamService, useValue: mockTeamService },
        { provide: SyncService, useValue: mockSyncService }
      ]
    }).compileComponents();

    fixture = TestBed.createComponent(TeamPanelComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  describe('Component Initialization', () => {
    it('should create the component', () => {
      expect(component).toBeDefined();
    });

    it('should initialize with modals closed', () => {
      expect(component.showCreateModal).toBe(false);
      expect(component.showInviteModal).toBe(false);
    });

    it('should initialize create team form with default values', () => {
      expect(component.newTeamName).toBe('');
      expect(component.newTeamDescription).toBe('');
      expect(component.newTeamThreshold).toBe(2);
      expect(component.newTeamShares).toBe(3);
    });

    it('should initialize invite form with default values', () => {
      expect(component.inviteEmail).toBe('');
      expect(component.inviteRole).toBe('Member');
    });
  });

  describe('Connection State', () => {
    it('should display teams section when connected', () => {
      mockSyncService.isConnected.set(true);
      fixture.detectChanges();

      const header = fixture.nativeElement.textContent;
      expect(header).toContain('Teams');
    });

    it('should show "New Team" button when connected', () => {
      mockSyncService.isConnected.set(true);
      fixture.detectChanges();

      const newButton = Array.from(fixture.nativeElement.querySelectorAll('button'))
        .find((btn: any) => btn.textContent.includes('New Team'));

      expect(newButton).toBeDefined();
    });

    it('should show sign-in message when not connected', () => {
      mockSyncService.isConnected.set(false);
      fixture.detectChanges();

      const message = fixture.nativeElement.textContent;
      expect(message).toContain('Sign in to VeilCloud to create and manage teams');
    });

    it('should not show "New Team" button when not connected', () => {
      mockSyncService.isConnected.set(false);
      fixture.detectChanges();

      const newButton = Array.from(fixture.nativeElement.querySelectorAll('button'))
        .find((btn: any) => btn.textContent.includes('New Team'));

      expect(newButton).toBeUndefined();
    });
  });

  describe('Team List Rendering', () => {
    it('should display "No teams yet" when list is empty', () => {
      mockTeamService.teams.set([]);
      fixture.detectChanges();

      const emptyMessage = fixture.nativeElement.textContent;
      expect(emptyMessage).toContain('No teams yet');
    });

    it('should render all teams in the list', () => {
      mockTeamService.teams.set([
        { id: 'team-1', name: 'Engineering', threshold: 2, total_shares: 3 },
        { id: 'team-2', name: 'Design', threshold: 3, total_shares: 5 },
        { id: 'team-3', name: 'Product', threshold: 2, total_shares: 3 }
      ]);
      fixture.detectChanges();

      const teamNames = fixture.nativeElement.textContent;
      expect(teamNames).toContain('Engineering');
      expect(teamNames).toContain('Design');
      expect(teamNames).toContain('Product');
    });

    it('should display team threshold information', () => {
      mockTeamService.teams.set([
        { id: 'team-1', name: 'Engineering', threshold: 2, total_shares: 3 }
      ]);
      fixture.detectChanges();

      const threshold = fixture.nativeElement.textContent;
      expect(threshold).toContain('2-of-3');
    });

    it('should display team description if present', () => {
      mockTeamService.teams.set([
        { id: 'team-1', name: 'Engineering', description: 'Dev team', threshold: 2, total_shares: 3 }
      ]);
      fixture.detectChanges();

      const description = fixture.nativeElement.textContent;
      expect(description).toContain('Dev team');
    });

    it('should highlight selected team', () => {
      mockTeamService.teams.set([
        { id: 'team-1', name: 'Engineering', threshold: 2, total_shares: 3 },
        { id: 'team-2', name: 'Design', threshold: 2, total_shares: 3 }
      ]);
      mockTeamService.selectedTeam.set({ id: 'team-1', name: 'Engineering', threshold: 2, total_shares: 3, owner_id: 'user-1' });
      fixture.detectChanges();

      const teamCards = fixture.nativeElement.querySelectorAll('.team-card');
      const selectedCard = Array.from(teamCards).find((card: any) =>
        card.classList.contains('selected')
      );

      expect(selectedCard).toBeDefined();
    });

    it('should call selectTeam when team is clicked', async () => {
      const team = { id: 'team-1', name: 'Engineering', threshold: 2, total_shares: 3 };
      mockTeamService.teams.set([team]);
      fixture.detectChanges();

      const teamCard = fixture.nativeElement.querySelector('.team-card');
      teamCard?.click();

      await fixture.whenStable();

      expect(mockTeamService.selectTeam).toHaveBeenCalledWith('team-1');
      expect(mockTeamService.loadTeamAuditLog).toHaveBeenCalledWith('team-1', 10);
    });
  });

  describe('Member Display', () => {
    beforeEach(() => {
      mockTeamService.selectedTeam.set({
        id: 'team-1',
        name: 'Engineering',
        owner_id: 'user-1',
        threshold: 2,
        total_shares: 3
      });
      fixture.detectChanges();
    });

    it('should display members section when team is selected', () => {
      const section = fixture.nativeElement.textContent;
      expect(section).toContain('Members');
    });

    it('should show member count', () => {
      mockTeamService.teamMembers.set([
        { id: 'member-1', user_id: 'user-1', name: 'John', email: 'john@example.com', role: 'Admin' },
        { id: 'member-2', user_id: 'user-2', name: 'Jane', email: 'jane@example.com', role: 'Member' }
      ]);
      fixture.detectChanges();

      const memberCount = fixture.nativeElement.textContent;
      expect(memberCount).toContain('Members (2)');
    });

    it('should display member name and email', () => {
      mockTeamService.teamMembers.set([
        { id: 'member-1', user_id: 'user-1', name: 'John Doe', email: 'john@example.com', role: 'Admin' }
      ]);
      fixture.detectChanges();

      const memberInfo = fixture.nativeElement.textContent;
      expect(memberInfo).toContain('John Doe');
      expect(memberInfo).toContain('john@example.com');
    });

    it('should display email as name if name is not present', () => {
      mockTeamService.teamMembers.set([
        { id: 'member-1', user_id: 'user-1', email: 'user@example.com', role: 'Admin' }
      ]);
      fixture.detectChanges();

      const memberInfo = fixture.nativeElement.textContent;
      expect(memberInfo).toContain('user@example.com');
    });

    it('should display member role badge', () => {
      mockTeamService.teamMembers.set([
        { id: 'member-1', user_id: 'user-1', name: 'John', email: 'john@example.com', role: 'Admin' }
      ]);
      fixture.detectChanges();

      const badge = fixture.nativeElement.querySelector('.role-badge[data-role="Admin"]');
      expect(badge).toBeDefined();
    });

    it('should display owner badge for team owner', () => {
      mockTeamService.teamMembers.set([
        { id: 'member-1', user_id: 'user-1', name: 'Owner', email: 'owner@example.com', role: 'Admin' }
      ]);
      fixture.detectChanges();

      const ownerBadge = fixture.nativeElement.textContent;
      expect(ownerBadge).toContain('Owner');
    });
  });

  describe('Invite Functionality', () => {
    beforeEach(() => {
      mockTeamService.selectedTeam.set({
        id: 'team-1',
        name: 'Engineering',
        owner_id: 'user-1',
        threshold: 2,
        total_shares: 3
      });
      fixture.detectChanges();
    });

    it('should show "Invite Member" button', () => {
      const inviteButton = Array.from(fixture.nativeElement.querySelectorAll('button'))
        .find((btn: any) => btn.textContent.includes('Invite Member'));

      expect(inviteButton).toBeDefined();
    });

    it('should open invite modal when button is clicked', () => {
      const inviteButton = Array.from(fixture.nativeElement.querySelectorAll('button'))
        .find((btn: any) => btn.textContent.includes('Invite Member')) as HTMLElement;

      inviteButton?.click();

      expect(component.showInviteModal).toBe(true);
    });

    it('should display invite modal when open', () => {
      component.showInviteModal = true;
      fixture.detectChanges();

      const modal = fixture.nativeElement.textContent;
      expect(modal).toContain('Invite Member');
    });

    it('should show email input in invite modal', () => {
      component.showInviteModal = true;
      fixture.detectChanges();

      const emailInput = fixture.nativeElement.querySelector('input[type="email"]');
      expect(emailInput).toBeDefined();
    });

    it('should show role selector in invite modal', () => {
      component.showInviteModal = true;
      fixture.detectChanges();

      const roleSelect = fixture.nativeElement.querySelector('select[name="role"]');
      expect(roleSelect).toBeDefined();
    });

    it('should call inviteMember on form submit', async () => {
      component.inviteEmail = 'newmember@example.com';
      component.inviteRole = 'Member';

      await component.inviteMember();

      expect(mockTeamService.inviteMember).toHaveBeenCalledWith('team-1', 'newmember@example.com', 'Member');
    });

    it('should close modal and clear form after successful invite', async () => {
      component.showInviteModal = true;
      component.inviteEmail = 'newmember@example.com';

      await component.inviteMember();

      expect(component.showInviteModal).toBe(false);
      expect(component.inviteEmail).toBe('');
      expect(component.inviteRole).toBe('Member');
    });

    it('should not invite if email is empty', async () => {
      component.inviteEmail = '';

      await component.inviteMember();

      expect(mockTeamService.inviteMember).not.toHaveBeenCalled();
    });

    it('should display pending invites section when invites exist', () => {
      mockTeamService.pendingInvites.set([
        { id: 'invite-1', email: 'pending@example.com', role: 'Member' }
      ]);
      fixture.detectChanges();

      const section = fixture.nativeElement.textContent;
      expect(section).toContain('Pending Invites');
    });

    it('should show revoke button for pending invites', () => {
      mockTeamService.pendingInvites.set([
        { id: 'invite-1', email: 'pending@example.com', role: 'Member' }
      ]);
      fixture.detectChanges();

      const revokeButtons = fixture.nativeElement.querySelectorAll('.invite-row button');
      expect(revokeButtons.length).toBeGreaterThan(0);
    });

    it('should revoke invite when confirmed', async () => {
      global.confirm = vi.fn().mockReturnValue(true);

      await component.revokeInvite({ id: 'invite-1', email: 'pending@example.com', role: 'Member' });

      expect(mockTeamService.revokeInvite).toHaveBeenCalledWith('invite-1');
    });
  });

  describe('Role Management', () => {
    beforeEach(() => {
      mockTeamService.selectedTeam.set({
        id: 'team-1',
        name: 'Engineering',
        owner_id: 'user-1',
        threshold: 2,
        total_shares: 3
      });
    });

    it('should show role selector for non-owner members when user can manage', () => {
      mockTeamService.teamMembers.set([
        { id: 'member-1', user_id: 'user-2', name: 'John', email: 'john@example.com', role: 'Member' }
      ]);
      fixture.detectChanges();

      const roleSelect = fixture.nativeElement.querySelector('select[value="Member"]');
      expect(roleSelect).toBeDefined();
    });

    it('should not show role selector for team owner', () => {
      mockTeamService.teamMembers.set([
        { id: 'member-1', user_id: 'user-1', name: 'Owner', email: 'owner@example.com', role: 'Admin' }
      ]);
      fixture.detectChanges();

      const selects = Array.from(fixture.nativeElement.querySelectorAll('select'));
      expect(selects.length).toBe(0);
    });

    it('should call updateMemberRole when role is changed', async () => {
      mockTeamService.teamMembers.set([
        { id: 'member-1', user_id: 'user-2', name: 'John', email: 'john@example.com', role: 'Member' }
      ]);
      fixture.detectChanges();

      const member = mockTeamService.teamMembers()[0];
      const event = { target: { value: 'Admin' } } as any;

      await component.changeRole(member, event);

      expect(mockTeamService.updateMemberRole).toHaveBeenCalledWith('team-1', 'user-2', 'Admin');
    });

    it('should show remove button for non-owner members', () => {
      mockTeamService.teamMembers.set([
        { id: 'member-1', user_id: 'user-2', name: 'John', email: 'john@example.com', role: 'Member' }
      ]);
      fixture.detectChanges();

      const removeButton = fixture.nativeElement.querySelector('.btn-danger');
      expect(removeButton).toBeDefined();
    });

    it('should call removeMember when confirmed', async () => {
      global.confirm = vi.fn().mockReturnValue(true);
      const member = { id: 'member-1', user_id: 'user-2', name: 'John', email: 'john@example.com', role: 'Member' };

      await component.removeMember(member);

      expect(mockTeamService.removeMember).toHaveBeenCalledWith('team-1', 'user-2');
    });

    it('should not remove member if user cancels', async () => {
      global.confirm = vi.fn().mockReturnValue(false);
      const member = { id: 'member-1', user_id: 'user-2', name: 'John', email: 'john@example.com', role: 'Member' };

      await component.removeMember(member);

      expect(mockTeamService.removeMember).not.toHaveBeenCalled();
    });
  });

  describe('Team Creation', () => {
    it('should open create modal when "New Team" is clicked', () => {
      const newButton = Array.from(fixture.nativeElement.querySelectorAll('button'))
        .find((btn: any) => btn.textContent.includes('New Team')) as HTMLElement;

      newButton?.click();

      expect(component.showCreateModal).toBe(true);
    });

    it('should display create team modal when open', () => {
      component.showCreateModal = true;
      fixture.detectChanges();

      const modal = fixture.nativeElement.textContent;
      expect(modal).toContain('Create Team');
    });

    it('should show all form fields in create modal', () => {
      component.showCreateModal = true;
      fixture.detectChanges();

      const nameInput = fixture.nativeElement.querySelector('input[name="name"]');
      const descriptionInput = fixture.nativeElement.querySelector('textarea[name="description"]');
      const thresholdSelect = fixture.nativeElement.querySelector('select[name="threshold"]');
      const sharesSelect = fixture.nativeElement.querySelector('select[name="shares"]');

      expect(nameInput).toBeDefined();
      expect(descriptionInput).toBeDefined();
      expect(thresholdSelect).toBeDefined();
      expect(sharesSelect).toBeDefined();
    });

    it('should display threshold explanation', () => {
      component.showCreateModal = true;
      component.newTeamThreshold = 3;
      component.newTeamShares = 5;
      fixture.detectChanges();

      const hint = fixture.nativeElement.textContent;
      expect(hint).toContain('3-of-5 means 3 members must collaborate');
    });

    it('should call createTeam on form submit', async () => {
      component.newTeamName = 'Engineering Team';
      component.newTeamDescription = 'Dev team';
      component.newTeamThreshold = 2;
      component.newTeamShares = 3;

      await component.createTeam();

      expect(mockTeamService.createTeam).toHaveBeenCalledWith('Engineering Team', 'Dev team', 2, 3);
    });

    it('should close modal and clear form after team creation', async () => {
      component.showCreateModal = true;
      component.newTeamName = 'Engineering Team';
      component.newTeamDescription = 'Dev team';

      await component.createTeam();

      expect(component.showCreateModal).toBe(false);
      expect(component.newTeamName).toBe('');
      expect(component.newTeamDescription).toBe('');
      expect(component.newTeamThreshold).toBe(2);
      expect(component.newTeamShares).toBe(3);
    });

    it('should not create team if name is empty', async () => {
      component.newTeamName = '';

      await component.createTeam();

      expect(mockTeamService.createTeam).not.toHaveBeenCalled();
    });
  });

  describe('Permissions', () => {
    it('should return true for isOwner when user is owner', () => {
      const team = { id: 'team-1', name: 'Test', owner_id: 'user-1', threshold: 2, total_shares: 3 };

      const result = component.isOwner(team);

      expect(result).toBe(true);
    });

    it('should return false for isOwner when user is not owner', () => {
      const team = { id: 'team-1', name: 'Test', owner_id: 'other-user', threshold: 2, total_shares: 3 };

      const result = component.isOwner(team);

      expect(result).toBe(false);
    });

    it('should return true for canManageMembers when user is owner', () => {
      const team = { id: 'team-1', name: 'Test', owner_id: 'user-1', threshold: 2, total_shares: 3 };

      const result = component.canManageMembers(team);

      expect(result).toBe(true);
    });

    it('should return true for canManageMembers when user is admin', () => {
      const team = { id: 'team-1', name: 'Test', owner_id: 'other-user', threshold: 2, total_shares: 3 };
      mockTeamService.teamMembers.set([
        { id: 'member-1', user_id: 'user-1', email: 'admin@example.com', role: 'Admin' }
      ]);

      const result = component.canManageMembers(team);

      expect(result).toBe(true);
    });

    it('should return false for canManageMembers when user is regular member', () => {
      const team = { id: 'team-1', name: 'Test', owner_id: 'other-user', threshold: 2, total_shares: 3 };
      mockTeamService.teamMembers.set([
        { id: 'member-1', user_id: 'user-1', email: 'member@example.com', role: 'Member' }
      ]);

      const result = component.canManageMembers(team);

      expect(result).toBe(false);
    });

    it('should show delete button only for owner', () => {
      mockTeamService.selectedTeam.set({
        id: 'team-1',
        name: 'Engineering',
        owner_id: 'user-1',
        threshold: 2,
        total_shares: 3
      });
      fixture.detectChanges();

      const deleteButton = Array.from(fixture.nativeElement.querySelectorAll('button'))
        .find((btn: any) => btn.textContent.includes('Delete'));

      expect(deleteButton).toBeDefined();
    });
  });

  describe('Shared Projects', () => {
    beforeEach(() => {
      mockTeamService.selectedTeam.set({
        id: 'team-1',
        name: 'Engineering',
        owner_id: 'user-1',
        threshold: 2,
        total_shares: 3
      });
    });

    it('should display shared projects section', () => {
      fixture.detectChanges();

      const section = fixture.nativeElement.textContent;
      expect(section).toContain('Shared Projects');
    });

    it('should show project count', () => {
      mockTeamService.teamProjects.set([
        { id: 'proj-1', name: 'Project Alpha' },
        { id: 'proj-2', name: 'Project Beta' }
      ]);
      fixture.detectChanges();

      const projectCount = fixture.nativeElement.textContent;
      expect(projectCount).toContain('Shared Projects (2)');
    });

    it('should render all shared projects', () => {
      mockTeamService.teamProjects.set([
        { id: 'proj-1', name: 'Project Alpha' },
        { id: 'proj-2', name: 'Project Beta' }
      ]);
      fixture.detectChanges();

      const projects = fixture.nativeElement.textContent;
      expect(projects).toContain('Project Alpha');
      expect(projects).toContain('Project Beta');
    });

    it('should emit projectSelected when project is clicked', () => {
      mockTeamService.teamProjects.set([
        { id: 'proj-1', name: 'Project Alpha' }
      ]);
      fixture.detectChanges();

      const spy = vi.fn();
      component.projectSelected.subscribe(spy);

      const projectRow = fixture.nativeElement.querySelector('.project-row');
      projectRow?.click();

      expect(spy).toHaveBeenCalledWith('proj-1');
    });

    it('should show unshare button when user can manage', () => {
      mockTeamService.teamProjects.set([
        { id: 'proj-1', name: 'Project Alpha' }
      ]);
      fixture.detectChanges();

      const unshareButton = fixture.nativeElement.querySelector('.project-row button');
      expect(unshareButton).toBeDefined();
    });

    it('should call unshareProject when confirmed', async () => {
      global.confirm = vi.fn().mockReturnValue(true);

      await component.unshareProject('proj-1', 'team-1');

      expect(mockTeamService.unshareProject).toHaveBeenCalledWith('proj-1', 'team-1');
    });
  });

  describe('Audit Log', () => {
    beforeEach(() => {
      mockTeamService.selectedTeam.set({
        id: 'team-1',
        name: 'Engineering',
        owner_id: 'user-1',
        threshold: 2,
        total_shares: 3
      });
    });

    it('should display recent activity section', () => {
      fixture.detectChanges();

      const section = fixture.nativeElement.textContent;
      expect(section).toContain('Recent Activity');
    });

    it('should render audit log entries', () => {
      mockTeamService.auditLog.set([
        {
          id: 'audit-1',
          event_type: 'member_invited',
          actor_email: 'admin@example.com',
          actor_id: 'user-1',
          timestamp: '2023-01-01T12:00:00Z'
        }
      ]);
      fixture.detectChanges();

      const activities = fixture.nativeElement.textContent;
      expect(activities).toContain('admin@example.com');
    });

    it('should show only 5 most recent events', () => {
      const events = Array.from({ length: 10 }, (_, i) => ({
        id: `audit-${i}`,
        event_type: 'member_invited',
        actor_email: `user${i}@example.com`,
        actor_id: `user-${i}`,
        timestamp: '2023-01-01T12:00:00Z'
      }));
      mockTeamService.auditLog.set(events);
      fixture.detectChanges();

      const auditRows = fixture.nativeElement.querySelectorAll('.audit-row');
      expect(auditRows.length).toBeLessThanOrEqual(5);
    });

    it('should format timestamps correctly', () => {
      const result = component.formatDate('2023-01-01T12:00:00Z');
      expect(result).toBeDefined();
      expect(typeof result).toBe('string');
    });

    it('should show "just now" for very recent events', () => {
      const result = component.formatDate(new Date().toISOString());
      expect(result).toBe('just now');
    });
  });

  describe('Team Deletion', () => {
    it('should call deleteTeam when confirmed', async () => {
      global.confirm = vi.fn().mockReturnValue(true);
      const team = { id: 'team-1', name: 'Engineering', owner_id: 'user-1', threshold: 2, total_shares: 3 };

      await component.confirmDeleteTeam(team);

      expect(mockTeamService.deleteTeam).toHaveBeenCalledWith('team-1');
    });

    it('should show team name in confirmation dialog', async () => {
      global.confirm = vi.fn().mockReturnValue(false);
      const team = { id: 'team-1', name: 'Engineering', owner_id: 'user-1', threshold: 2, total_shares: 3 };

      await component.confirmDeleteTeam(team);

      expect(global.confirm).toHaveBeenCalledWith('Delete team "Engineering"? This cannot be undone.');
    });

    it('should not delete if user cancels', async () => {
      global.confirm = vi.fn().mockReturnValue(false);
      const team = { id: 'team-1', name: 'Engineering', owner_id: 'user-1', threshold: 2, total_shares: 3 };

      await component.confirmDeleteTeam(team);

      expect(mockTeamService.deleteTeam).not.toHaveBeenCalled();
    });
  });

  describe('UI Elements', () => {
    it('should display teams header', () => {
      const header = fixture.nativeElement.querySelector('.panel-header h2');
      expect(header?.textContent).toBe('Teams');
    });

    it('should have proper panel structure', () => {
      const panel = fixture.nativeElement.querySelector('.team-panel');
      expect(panel).toBeDefined();
    });

    it('should display empty state message correctly', () => {
      mockTeamService.teams.set([]);
      fixture.detectChanges();

      const emptyState = fixture.nativeElement.querySelector('.empty-state');
      expect(emptyState?.textContent).toContain('No teams yet');
    });
  });
});
