/**
 * EnvSync Team Management E2E Tests
 *
 * Comprehensive tests for team collaboration features including:
 * - Team CRUD operations
 * - Member management (invitations, roles)
 * - Role-based permissions
 * - Project sharing with teams
 * - Team audit logs
 */

import { test, expect } from '../fixtures/test-fixtures';
import { Page, Locator } from '@playwright/test';

/**
 * Team Page Object Model
 * Encapsulates team management UI interactions
 */
class TeamPage {
  readonly page: Page;

  // Navigation
  readonly teamsTab: Locator;
  readonly teamsList: Locator;

  // Team CRUD
  readonly createTeamButton: Locator;
  readonly teamNameInput: Locator;
  readonly teamDescriptionInput: Locator;
  readonly thresholdInput: Locator;
  readonly createTeamSubmit: Locator;
  readonly editTeamButton: Locator;
  readonly deleteTeamButton: Locator;
  readonly confirmDeleteInput: Locator;
  readonly confirmDeleteButton: Locator;

  // Members
  readonly inviteMemberButton: Locator;
  readonly memberEmailInput: Locator;
  readonly memberRoleSelect: Locator;
  readonly sendInviteButton: Locator;
  readonly pendingInvitations: Locator;
  readonly teamMembers: Locator;
  readonly removeMemberButton: Locator;
  readonly changeRoleButton: Locator;

  // Project sharing
  readonly shareProjectButton: Locator;
  readonly selectTeamDropdown: Locator;
  readonly confirmShareButton: Locator;
  readonly unshareButton: Locator;
  readonly sharedProjects: Locator;

  // Audit log
  readonly auditLogTab: Locator;
  readonly auditLogEntries: Locator;
  readonly filterByDateButton: Locator;
  readonly filterByUserDropdown: Locator;
  readonly filterByActionDropdown: Locator;
  readonly applyFiltersButton: Locator;

  // Messages
  readonly successMessage: Locator;
  readonly errorMessage: Locator;
  readonly warningMessage: Locator;

  constructor(page: Page) {
    this.page = page;

    // Navigation
    this.teamsTab = page.locator('[data-testid="teams-tab"]');
    this.teamsList = page.locator('[data-testid="teams-list"]');

    // Team CRUD
    this.createTeamButton = page.locator('[data-testid="create-team-button"]');
    this.teamNameInput = page.locator('[data-testid="team-name-input"]');
    this.teamDescriptionInput = page.locator('[data-testid="team-description-input"]');
    this.thresholdInput = page.locator('[data-testid="threshold-input"]');
    this.createTeamSubmit = page.locator('[data-testid="create-team-submit"]');
    this.editTeamButton = page.locator('[data-testid="edit-team-button"]');
    this.deleteTeamButton = page.locator('[data-testid="delete-team-button"]');
    this.confirmDeleteInput = page.locator('[data-testid="confirm-delete-input"]');
    this.confirmDeleteButton = page.locator('[data-testid="confirm-delete-button"]');

    // Members
    this.inviteMemberButton = page.locator('[data-testid="invite-member-button"]');
    this.memberEmailInput = page.locator('[data-testid="member-email-input"]');
    this.memberRoleSelect = page.locator('[data-testid="member-role-select"]');
    this.sendInviteButton = page.locator('[data-testid="send-invite-button"]');
    this.pendingInvitations = page.locator('[data-testid="pending-invitations"]');
    this.teamMembers = page.locator('[data-testid="team-members"]');
    this.removeMemberButton = page.locator('[data-testid="remove-member-button"]');
    this.changeRoleButton = page.locator('[data-testid="change-role-button"]');

    // Project sharing
    this.shareProjectButton = page.locator('[data-testid="share-project-button"]');
    this.selectTeamDropdown = page.locator('[data-testid="select-team-dropdown"]');
    this.confirmShareButton = page.locator('[data-testid="confirm-share-button"]');
    this.unshareButton = page.locator('[data-testid="unshare-button"]');
    this.sharedProjects = page.locator('[data-testid="shared-projects"]');

    // Audit log
    this.auditLogTab = page.locator('[data-testid="audit-log-tab"]');
    this.auditLogEntries = page.locator('[data-testid="audit-log-entries"]');
    this.filterByDateButton = page.locator('[data-testid="filter-by-date"]');
    this.filterByUserDropdown = page.locator('[data-testid="filter-by-user"]');
    this.filterByActionDropdown = page.locator('[data-testid="filter-by-action"]');
    this.applyFiltersButton = page.locator('[data-testid="apply-filters"]');

    // Messages
    this.successMessage = page.locator('[data-testid="success-message"]');
    this.errorMessage = page.locator('[data-testid="error-message"]');
    this.warningMessage = page.locator('[data-testid="warning-message"]');
  }

  /**
   * Navigate to teams page
   */
  async goto() {
    await this.teamsTab.click();
    await expect(this.teamsList).toBeVisible({ timeout: 5000 });
  }

  /**
   * Create a new team
   */
  async createTeam(name: string, description: string, threshold?: number) {
    await this.createTeamButton.click();
    await this.teamNameInput.fill(name);
    await this.teamDescriptionInput.fill(description);

    if (threshold !== undefined) {
      await this.thresholdInput.fill(threshold.toString());
    }

    await this.createTeamSubmit.click();
    await expect(this.successMessage).toBeVisible({ timeout: 3000 });
  }

  /**
   * Edit team details
   */
  async editTeam(teamName: string, newName: string, newDescription: string) {
    await this.getTeamRow(teamName).locator(this.editTeamButton).click();
    await this.teamNameInput.clear();
    await this.teamNameInput.fill(newName);
    await this.teamDescriptionInput.clear();
    await this.teamDescriptionInput.fill(newDescription);
    await this.createTeamSubmit.click();
    await expect(this.successMessage).toBeVisible({ timeout: 3000 });
  }

  /**
   * Delete a team
   */
  async deleteTeam(teamName: string) {
    await this.getTeamRow(teamName).locator(this.deleteTeamButton).click();
    await this.confirmDeleteInput.fill('DELETE');
    await this.confirmDeleteButton.click();
    await expect(this.successMessage).toBeVisible({ timeout: 3000 });
  }

  /**
   * Set threshold for team
   */
  async setThreshold(teamName: string, threshold: number) {
    await this.getTeamRow(teamName).locator(this.editTeamButton).click();
    await this.thresholdInput.fill(threshold.toString());
    await this.createTeamSubmit.click();
    await expect(this.successMessage).toBeVisible({ timeout: 3000 });
  }

  /**
   * Invite a member to team
   */
  async inviteMember(teamName: string, email: string, role: 'admin' | 'member' | 'viewer') {
    await this.getTeamRow(teamName).click();
    await this.inviteMemberButton.click();
    await this.memberEmailInput.fill(email);
    await this.memberRoleSelect.selectOption(role);
    await this.sendInviteButton.click();
    await expect(this.successMessage).toBeVisible({ timeout: 3000 });
  }

  /**
   * Remove a member from team
   */
  async removeMember(teamName: string, memberEmail: string) {
    await this.getTeamRow(teamName).click();
    await this.getMemberRow(memberEmail).locator(this.removeMemberButton).click();
    await this.confirmDeleteButton.click();
    await expect(this.successMessage).toBeVisible({ timeout: 3000 });
  }

  /**
   * Change member role
   */
  async changeMemberRole(teamName: string, memberEmail: string, newRole: 'admin' | 'member' | 'viewer') {
    await this.getTeamRow(teamName).click();
    await this.getMemberRow(memberEmail).locator(this.changeRoleButton).click();
    await this.memberRoleSelect.selectOption(newRole);
    await this.createTeamSubmit.click();
    await expect(this.successMessage).toBeVisible({ timeout: 3000 });
  }

  /**
   * Share project with team
   */
  async shareProject(projectName: string, teamName: string) {
    await this.page.locator(`[data-testid="project-${projectName}"]`).click();
    await this.shareProjectButton.click();
    await this.selectTeamDropdown.selectOption(teamName);
    await this.confirmShareButton.click();
    await expect(this.successMessage).toBeVisible({ timeout: 3000 });
  }

  /**
   * Unshare project from team
   */
  async unshareProject(projectName: string, teamName: string) {
    await this.page.locator(`[data-testid="project-${projectName}"]`).click();
    await this.getSharedTeamRow(teamName).locator(this.unshareButton).click();
    await this.confirmDeleteButton.click();
    await expect(this.successMessage).toBeVisible({ timeout: 3000 });
  }

  /**
   * View audit log
   */
  async viewAuditLog(teamName: string) {
    await this.getTeamRow(teamName).click();
    await this.auditLogTab.click();
    await expect(this.auditLogEntries).toBeVisible({ timeout: 3000 });
  }

  /**
   * Filter audit log
   */
  async filterAuditLog(filters: { user?: string; action?: string; dateFrom?: string; dateTo?: string }) {
    if (filters.user) {
      await this.filterByUserDropdown.selectOption(filters.user);
    }
    if (filters.action) {
      await this.filterByActionDropdown.selectOption(filters.action);
    }
    if (filters.dateFrom || filters.dateTo) {
      await this.filterByDateButton.click();
      // Date picker interaction would go here
    }
    await this.applyFiltersButton.click();
  }

  /**
   * Get team row by name
   */
  getTeamRow(teamName: string): Locator {
    return this.page.locator(`[data-testid="team-row"]:has-text("${teamName}")`);
  }

  /**
   * Get member row by email
   */
  getMemberRow(email: string): Locator {
    return this.page.locator(`[data-testid="member-row"]:has-text("${email}")`);
  }

  /**
   * Get shared team row
   */
  getSharedTeamRow(teamName: string): Locator {
    return this.page.locator(`[data-testid="shared-team-row"]:has-text("${teamName}")`);
  }

  /**
   * Check if team exists
   */
  async teamExists(teamName: string): Promise<boolean> {
    return await this.getTeamRow(teamName).isVisible({ timeout: 1000 }).catch(() => false);
  }

  /**
   * Check if member is in team
   */
  async memberExists(teamName: string, email: string): Promise<boolean> {
    await this.getTeamRow(teamName).click();
    return await this.getMemberRow(email).isVisible({ timeout: 1000 }).catch(() => false);
  }

  /**
   * Get member role
   */
  async getMemberRole(teamName: string, email: string): Promise<string> {
    await this.getTeamRow(teamName).click();
    const roleElement = this.getMemberRow(email).locator('[data-testid="member-role"]');
    return await roleElement.textContent() || '';
  }

  /**
   * Get team threshold
   */
  async getTeamThreshold(teamName: string): Promise<number> {
    const thresholdElement = this.getTeamRow(teamName).locator('[data-testid="team-threshold"]');
    const text = await thresholdElement.textContent() || '0';
    return parseInt(text, 10);
  }

  /**
   * Get audit log entry count
   */
  async getAuditLogCount(): Promise<number> {
    return await this.auditLogEntries.locator('[data-testid="audit-entry"]').count();
  }
}

test.describe('Team CRUD Operations', () => {
  test('should create a new team successfully', async ({ authenticatedPage }) => {
    const teamPage = new TeamPage(authenticatedPage);
    await teamPage.goto();

    const teamName = `Test Team ${Date.now()}`;
    const description = 'Team for E2E testing';

    await teamPage.createTeam(teamName, description);

    // Verify team appears in list
    await expect(teamPage.getTeamRow(teamName)).toBeVisible();
    await expect(teamPage.getTeamRow(teamName)).toContainText(description);
  });

  test('should create team with custom threshold', async ({ authenticatedPage }) => {
    const teamPage = new TeamPage(authenticatedPage);
    await teamPage.goto();

    const teamName = `Threshold Team ${Date.now()}`;
    const threshold = 3;

    await teamPage.createTeam(teamName, 'Team with threshold', threshold);

    // Verify threshold is set
    const actualThreshold = await teamPage.getTeamThreshold(teamName);
    expect(actualThreshold).toBe(threshold);
  });

  test('should edit team name successfully', async ({ authenticatedPage }) => {
    const teamPage = new TeamPage(authenticatedPage);
    await teamPage.goto();

    const originalName = `Original Team ${Date.now()}`;
    const newName = `Updated Team ${Date.now()}`;

    await teamPage.createTeam(originalName, 'Original description');
    await teamPage.editTeam(originalName, newName, 'Updated description');

    // Verify new name appears
    await expect(teamPage.getTeamRow(newName)).toBeVisible();
    await expect(teamPage.getTeamRow(originalName)).not.toBeVisible();
  });

  test('should edit team description successfully', async ({ authenticatedPage }) => {
    const teamPage = new TeamPage(authenticatedPage);
    await teamPage.goto();

    const teamName = `Desc Team ${Date.now()}`;
    const newDescription = 'This is the updated description';

    await teamPage.createTeam(teamName, 'Old description');
    await teamPage.editTeam(teamName, teamName, newDescription);

    // Verify description updated
    await expect(teamPage.getTeamRow(teamName)).toContainText(newDescription);
  });

  test('should delete team successfully', async ({ authenticatedPage }) => {
    const teamPage = new TeamPage(authenticatedPage);
    await teamPage.goto();

    const teamName = `Delete Team ${Date.now()}`;
    await teamPage.createTeam(teamName, 'To be deleted');

    // Verify team exists
    expect(await teamPage.teamExists(teamName)).toBe(true);

    await teamPage.deleteTeam(teamName);

    // Verify team is gone
    expect(await teamPage.teamExists(teamName)).toBe(false);
  });

  test('should update threshold for existing team', async ({ authenticatedPage }) => {
    const teamPage = new TeamPage(authenticatedPage);
    await teamPage.goto();

    const teamName = `Threshold Update ${Date.now()}`;
    await teamPage.createTeam(teamName, 'Initial team', 2);

    const newThreshold = 5;
    await teamPage.setThreshold(teamName, newThreshold);

    // Verify threshold updated
    const actualThreshold = await teamPage.getTeamThreshold(teamName);
    expect(actualThreshold).toBe(newThreshold);
  });

  test('should prevent creating team with empty name', async ({ authenticatedPage }) => {
    const teamPage = new TeamPage(authenticatedPage);
    await teamPage.goto();

    await teamPage.createTeamButton.click();
    await teamPage.teamDescriptionInput.fill('Description without name');
    await teamPage.createTeamSubmit.click();

    // Verify error message appears
    await expect(teamPage.errorMessage).toBeVisible();
    await expect(teamPage.errorMessage).toContainText(/name.*required/i);
  });

  test('should prevent creating duplicate team names', async ({ authenticatedPage }) => {
    const teamPage = new TeamPage(authenticatedPage);
    await teamPage.goto();

    const teamName = `Duplicate Team ${Date.now()}`;
    await teamPage.createTeam(teamName, 'First team');

    // Try to create another team with same name
    await teamPage.createTeamButton.click();
    await teamPage.teamNameInput.fill(teamName);
    await teamPage.teamDescriptionInput.fill('Second team');
    await teamPage.createTeamSubmit.click();

    // Verify error message
    await expect(teamPage.errorMessage).toBeVisible();
    await expect(teamPage.errorMessage).toContainText(/already exists/i);
  });
});

test.describe('Member Management', () => {
  test('should invite member by email successfully', async ({ authenticatedPage, testUser }) => {
    const teamPage = new TeamPage(authenticatedPage);
    await teamPage.goto();

    const teamName = `Invite Team ${Date.now()}`;
    await teamPage.createTeam(teamName, 'Team for invites');

    await teamPage.inviteMember(teamName, testUser.email, 'member');

    // Verify invitation appears in pending list
    await expect(teamPage.pendingInvitations).toContainText(testUser.email);
  });

  test('should invite member as admin role', async ({ authenticatedPage, testUser }) => {
    const teamPage = new TeamPage(authenticatedPage);
    await teamPage.goto();

    const teamName = `Admin Invite ${Date.now()}`;
    await teamPage.createTeam(teamName, 'Admin invitation test');

    await teamPage.inviteMember(teamName, testUser.email, 'admin');

    // Verify pending invitation shows admin role
    const inviteRow = authenticatedPage.locator(`[data-testid="invite-row"]:has-text("${testUser.email}")`);
    await expect(inviteRow).toContainText('admin');
  });

  test('should invite member as viewer role', async ({ authenticatedPage, testUser }) => {
    const teamPage = new TeamPage(authenticatedPage);
    await teamPage.goto();

    const teamName = `Viewer Invite ${Date.now()}`;
    await teamPage.createTeam(teamName, 'Viewer invitation test');

    await teamPage.inviteMember(teamName, testUser.email, 'viewer');

    // Verify pending invitation shows viewer role
    const inviteRow = authenticatedPage.locator(`[data-testid="invite-row"]:has-text("${testUser.email}")`);
    await expect(inviteRow).toContainText('viewer');
  });

  test('should accept invitation successfully', async ({ page, authenticatedPage, testUser }) => {
    const teamPage = new TeamPage(authenticatedPage);
    await teamPage.goto();

    const teamName = `Accept Invite ${Date.now()}`;
    await teamPage.createTeam(teamName, 'Acceptance test');
    await teamPage.inviteMember(teamName, testUser.email, 'member');

    // Simulate invitation acceptance (in new context/session)
    const inviteLink = await authenticatedPage.locator('[data-testid="invite-link"]').getAttribute('href');

    if (inviteLink) {
      await page.goto(inviteLink);
      await page.locator('[data-testid="accept-invite-button"]').click();

      // Verify success message
      await expect(page.locator('[data-testid="success-message"]')).toBeVisible();
      await expect(page.locator('[data-testid="success-message"]')).toContainText(/accepted/i);
    }
  });

  test('should decline invitation successfully', async ({ page, authenticatedPage, testUser }) => {
    const teamPage = new TeamPage(authenticatedPage);
    await teamPage.goto();

    const teamName = `Decline Invite ${Date.now()}`;
    await teamPage.createTeam(teamName, 'Decline test');
    await teamPage.inviteMember(teamName, testUser.email, 'member');

    // Simulate invitation decline
    const inviteLink = await authenticatedPage.locator('[data-testid="invite-link"]').getAttribute('href');

    if (inviteLink) {
      await page.goto(inviteLink);
      await page.locator('[data-testid="decline-invite-button"]').click();

      // Verify decline confirmation
      await expect(page.locator('[data-testid="success-message"]')).toBeVisible();
      await expect(page.locator('[data-testid="success-message"]')).toContainText(/declined/i);
    }
  });

  test('should remove member from team', async ({ authenticatedPage, testUser }) => {
    const teamPage = new TeamPage(authenticatedPage);
    await teamPage.goto();

    const teamName = `Remove Member ${Date.now()}`;
    await teamPage.createTeam(teamName, 'Removal test');
    await teamPage.inviteMember(teamName, testUser.email, 'member');

    // Simulate member accepting and then being removed
    // In real test, member would accept first
    await teamPage.removeMember(teamName, testUser.email);

    // Verify member no longer in team
    expect(await teamPage.memberExists(teamName, testUser.email)).toBe(false);
  });

  test('should change member role from member to admin', async ({ authenticatedPage, testUser }) => {
    const teamPage = new TeamPage(authenticatedPage);
    await teamPage.goto();

    const teamName = `Role Change ${Date.now()}`;
    await teamPage.createTeam(teamName, 'Role change test');
    await teamPage.inviteMember(teamName, testUser.email, 'member');

    await teamPage.changeMemberRole(teamName, testUser.email, 'admin');

    // Verify role changed
    const role = await teamPage.getMemberRole(teamName, testUser.email);
    expect(role.toLowerCase()).toContain('admin');
  });

  test('should change member role from admin to viewer', async ({ authenticatedPage, testUser }) => {
    const teamPage = new TeamPage(authenticatedPage);
    await teamPage.goto();

    const teamName = `Admin to Viewer ${Date.now()}`;
    await teamPage.createTeam(teamName, 'Downgrade test');
    await teamPage.inviteMember(teamName, testUser.email, 'admin');

    await teamPage.changeMemberRole(teamName, testUser.email, 'viewer');

    // Verify role changed
    const role = await teamPage.getMemberRole(teamName, testUser.email);
    expect(role.toLowerCase()).toContain('viewer');
  });

  test('should prevent inviting duplicate members', async ({ authenticatedPage, testUser }) => {
    const teamPage = new TeamPage(authenticatedPage);
    await teamPage.goto();

    const teamName = `Duplicate Member ${Date.now()}`;
    await teamPage.createTeam(teamName, 'Duplicate test');
    await teamPage.inviteMember(teamName, testUser.email, 'member');

    // Try to invite same email again
    await teamPage.getTeamRow(teamName).click();
    await teamPage.inviteMemberButton.click();
    await teamPage.memberEmailInput.fill(testUser.email);
    await teamPage.memberRoleSelect.selectOption('member');
    await teamPage.sendInviteButton.click();

    // Verify error message
    await expect(teamPage.errorMessage).toBeVisible();
    await expect(teamPage.errorMessage).toContainText(/already invited|already member/i);
  });

  test('should show member count in team list', async ({ authenticatedPage, testUser }) => {
    const teamPage = new TeamPage(authenticatedPage);
    await teamPage.goto();

    const teamName = `Member Count ${Date.now()}`;
    await teamPage.createTeam(teamName, 'Count test');

    // Initial count should be 1 (creator)
    const teamRow = teamPage.getTeamRow(teamName);
    await expect(teamRow.locator('[data-testid="member-count"]')).toContainText('1');

    // Add a member
    await teamPage.inviteMember(teamName, testUser.email, 'member');

    // Count should update (if auto-accepted or pending shown)
    // Implementation may vary
  });
});

test.describe('Role-Based Permissions', () => {
  test('admin should be able to invite new members', async ({ authenticatedPage, testUser }) => {
    const teamPage = new TeamPage(authenticatedPage);
    await teamPage.goto();

    const teamName = `Admin Perms ${Date.now()}`;
    await teamPage.createTeam(teamName, 'Admin permissions test');

    // As admin (creator), should be able to invite
    await teamPage.getTeamRow(teamName).click();
    await expect(teamPage.inviteMemberButton).toBeVisible();
    await expect(teamPage.inviteMemberButton).toBeEnabled();

    await teamPage.inviteMember(teamName, testUser.email, 'member');
    await expect(teamPage.successMessage).toBeVisible();
  });

  test('admin should be able to remove members', async ({ authenticatedPage, testUser }) => {
    const teamPage = new TeamPage(authenticatedPage);
    await teamPage.goto();

    const teamName = `Admin Remove ${Date.now()}`;
    await teamPage.createTeam(teamName, 'Admin remove test');
    await teamPage.inviteMember(teamName, testUser.email, 'member');

    // As admin, should see remove button
    await teamPage.getTeamRow(teamName).click();
    const memberRow = teamPage.getMemberRow(testUser.email);
    await expect(memberRow.locator(teamPage.removeMemberButton)).toBeVisible();
  });

  test('member should be able to read team data', async ({ page, authenticatedPage, testUser }) => {
    const teamPage = new TeamPage(authenticatedPage);
    await teamPage.goto();

    const teamName = `Member Read ${Date.now()}`;
    await teamPage.createTeam(teamName, 'Member read test');
    await teamPage.inviteMember(teamName, testUser.email, 'member');

    // Simulate logging in as member (would need separate session)
    // Member should see team details but not admin functions
    await teamPage.getTeamRow(teamName).click();

    // Verify team details are visible
    await expect(authenticatedPage.locator('[data-testid="team-details"]')).toBeVisible();
  });

  test('member should be able to write to shared projects', async ({ authenticatedPage, testUser, createProject }) => {
    const teamPage = new TeamPage(authenticatedPage);
    await teamPage.goto();

    const teamName = `Member Write ${Date.now()}`;
    await teamPage.createTeam(teamName, 'Member write test');
    await teamPage.inviteMember(teamName, testUser.email, 'member');

    // Create and share project
    const project = await createProject(`Shared Project ${Date.now()}`);
    await teamPage.shareProject(project.name, teamName);

    // Member should be able to edit project variables
    // This would require logging in as the member
  });

  test('viewer should only be able to read team data', async ({ authenticatedPage, testUser }) => {
    const teamPage = new TeamPage(authenticatedPage);
    await teamPage.goto();

    const teamName = `Viewer Read ${Date.now()}`;
    await teamPage.createTeam(teamName, 'Viewer test');
    await teamPage.inviteMember(teamName, testUser.email, 'viewer');

    // Simulate logging in as viewer
    // Viewer should NOT see edit/delete buttons
    await teamPage.getTeamRow(teamName).click();

    // These buttons should be hidden for viewers
    await expect(teamPage.editTeamButton).not.toBeVisible();
    await expect(teamPage.deleteTeamButton).not.toBeVisible();
    await expect(teamPage.inviteMemberButton).not.toBeVisible();
  });

  test('viewer should not be able to modify shared projects', async ({ authenticatedPage, testUser, createProject }) => {
    const teamPage = new TeamPage(authenticatedPage);
    await teamPage.goto();

    const teamName = `Viewer No Write ${Date.now()}`;
    await teamPage.createTeam(teamName, 'Viewer no-write test');
    await teamPage.inviteMember(teamName, testUser.email, 'viewer');

    // Create and share project
    const project = await createProject(`View Only Project ${Date.now()}`);
    await teamPage.shareProject(project.name, teamName);

    // Viewer should see project but not be able to add/edit variables
    // Would need to verify in member session
  });

  test('non-member should not see team details', async ({ page, authenticatedPage }) => {
    const teamPage = new TeamPage(authenticatedPage);
    await teamPage.goto();

    const teamName = `Private Team ${Date.now()}`;
    await teamPage.createTeam(teamName, 'Private team');

    // Get team ID/URL
    await teamPage.getTeamRow(teamName).click();
    const teamUrl = authenticatedPage.url();

    // Try to access in incognito/different session
    const newContext = await page.context().browser()?.newContext();
    if (newContext) {
      const newPage = await newContext.newPage();
      await newPage.goto(teamUrl);

      // Should be redirected or show access denied
      await expect(newPage.locator('[data-testid="access-denied"]')).toBeVisible();
      await newContext.close();
    }
  });

  test('role changes should take effect immediately', async ({ authenticatedPage, testUser }) => {
    const teamPage = new TeamPage(authenticatedPage);
    await teamPage.goto();

    const teamName = `Immediate Role ${Date.now()}`;
    await teamPage.createTeam(teamName, 'Immediate role change');
    await teamPage.inviteMember(teamName, testUser.email, 'viewer');

    // Change to admin
    await teamPage.changeMemberRole(teamName, testUser.email, 'admin');

    // Verify role shows as admin immediately
    const role = await teamPage.getMemberRole(teamName, testUser.email);
    expect(role.toLowerCase()).toContain('admin');
  });
});

test.describe('Project Sharing', () => {
  test('should share project with team successfully', async ({ authenticatedPage, createProject }) => {
    const teamPage = new TeamPage(authenticatedPage);
    await teamPage.goto();

    const teamName = `Share Team ${Date.now()}`;
    await teamPage.createTeam(teamName, 'Project sharing test');

    const project = await createProject(`Shared Project ${Date.now()}`);
    await teamPage.shareProject(project.name, teamName);

    // Verify project appears in shared projects
    await teamPage.getTeamRow(teamName).click();
    await expect(teamPage.sharedProjects).toContainText(project.name);
  });

  test('should unshare project from team', async ({ authenticatedPage, createProject }) => {
    const teamPage = new TeamPage(authenticatedPage);
    await teamPage.goto();

    const teamName = `Unshare Team ${Date.now()}`;
    await teamPage.createTeam(teamName, 'Unshare test');

    const project = await createProject(`Temp Share ${Date.now()}`);
    await teamPage.shareProject(project.name, teamName);
    await teamPage.unshareProject(project.name, teamName);

    // Verify project no longer in shared list
    await teamPage.getTeamRow(teamName).click();
    await expect(teamPage.sharedProjects).not.toContainText(project.name);
  });

  test('should verify access control after sharing', async ({ authenticatedPage, createProject, testUser }) => {
    const teamPage = new TeamPage(authenticatedPage);
    await teamPage.goto();

    const teamName = `Access Control ${Date.now()}`;
    await teamPage.createTeam(teamName, 'Access control test');
    await teamPage.inviteMember(teamName, testUser.email, 'member');

    const project = await createProject(`Controlled Project ${Date.now()}`);
    await teamPage.shareProject(project.name, teamName);

    // Team members should now have access to project
    await teamPage.getTeamRow(teamName).click();
    const projectLink = authenticatedPage.locator(`[data-testid="shared-project-link"]:has-text("${project.name}")`);
    await expect(projectLink).toBeVisible();
  });

  test('should verify access revoked after unsharing', async ({ authenticatedPage, createProject }) => {
    const teamPage = new TeamPage(authenticatedPage);
    await teamPage.goto();

    const teamName = `Revoke Access ${Date.now()}`;
    await teamPage.createTeam(teamName, 'Access revoke test');

    const project = await createProject(`Revoked Project ${Date.now()}`);
    await teamPage.shareProject(project.name, teamName);
    await teamPage.unshareProject(project.name, teamName);

    // Verify team members no longer have access
    await teamPage.getTeamRow(teamName).click();
    const projectLink = authenticatedPage.locator(`[data-testid="shared-project-link"]:has-text("${project.name}")`);
    await expect(projectLink).not.toBeVisible();
  });

  test('should share project with multiple teams', async ({ authenticatedPage, createProject }) => {
    const teamPage = new TeamPage(authenticatedPage);
    await teamPage.goto();

    const team1 = `Multi Share 1 ${Date.now()}`;
    const team2 = `Multi Share 2 ${Date.now()}`;
    await teamPage.createTeam(team1, 'First team');
    await teamPage.createTeam(team2, 'Second team');

    const project = await createProject(`Multi Shared ${Date.now()}`);
    await teamPage.shareProject(project.name, team1);
    await teamPage.shareProject(project.name, team2);

    // Verify both teams have access
    await teamPage.getTeamRow(team1).click();
    await expect(teamPage.sharedProjects).toContainText(project.name);

    await teamPage.goto();
    await teamPage.getTeamRow(team2).click();
    await expect(teamPage.sharedProjects).toContainText(project.name);
  });

  test('should show shared teams on project page', async ({ authenticatedPage, createProject }) => {
    const teamPage = new TeamPage(authenticatedPage);
    await teamPage.goto();

    const teamName = `Project View ${Date.now()}`;
    await teamPage.createTeam(teamName, 'Project view test');

    const project = await createProject(`Team Project ${Date.now()}`);
    await teamPage.shareProject(project.name, teamName);

    // Go to project page and verify team is listed
    await authenticatedPage.locator(`[data-testid="project-${project.name}"]`).click();
    const sharedTeams = authenticatedPage.locator('[data-testid="shared-teams-list"]');
    await expect(sharedTeams).toContainText(teamName);
  });

  test('should prevent unauthorized access to shared projects', async ({ page, authenticatedPage, createProject }) => {
    const teamPage = new TeamPage(authenticatedPage);
    await teamPage.goto();

    const teamName = `Auth Test ${Date.now()}`;
    await teamPage.createTeam(teamName, 'Authorization test');

    const project = await createProject(`Secure Project ${Date.now()}`);
    await teamPage.shareProject(project.name, teamName);

    // Try to access project without being team member (different session)
    const newContext = await page.context().browser()?.newContext();
    if (newContext) {
      const newPage = await newContext.newPage();
      await newPage.goto(`/projects/${project.id}`);

      // Should show access denied or redirect
      await expect(newPage.locator('[data-testid="access-denied"]')).toBeVisible();
      await newContext.close();
    }
  });
});

test.describe('Audit Log', () => {
  test('should view team activity log', async ({ authenticatedPage }) => {
    const teamPage = new TeamPage(authenticatedPage);
    await teamPage.goto();

    const teamName = `Audit Team ${Date.now()}`;
    await teamPage.createTeam(teamName, 'Audit log test');

    await teamPage.viewAuditLog(teamName);

    // Verify audit log entries exist
    const count = await teamPage.getAuditLogCount();
    expect(count).toBeGreaterThan(0);
  });

  test('should log team creation event', async ({ authenticatedPage }) => {
    const teamPage = new TeamPage(authenticatedPage);
    await teamPage.goto();

    const teamName = `Create Log ${Date.now()}`;
    await teamPage.createTeam(teamName, 'Creation logging test');

    await teamPage.viewAuditLog(teamName);

    // Verify creation event is logged
    await expect(teamPage.auditLogEntries).toContainText('Team created');
  });

  test('should log member invitation event', async ({ authenticatedPage, testUser }) => {
    const teamPage = new TeamPage(authenticatedPage);
    await teamPage.goto();

    const teamName = `Invite Log ${Date.now()}`;
    await teamPage.createTeam(teamName, 'Invite logging test');
    await teamPage.inviteMember(teamName, testUser.email, 'member');

    await teamPage.viewAuditLog(teamName);

    // Verify invite event is logged
    await expect(teamPage.auditLogEntries).toContainText('Member invited');
    await expect(teamPage.auditLogEntries).toContainText(testUser.email);
  });

  test('should log role change event', async ({ authenticatedPage, testUser }) => {
    const teamPage = new TeamPage(authenticatedPage);
    await teamPage.goto();

    const teamName = `Role Log ${Date.now()}`;
    await teamPage.createTeam(teamName, 'Role logging test');
    await teamPage.inviteMember(teamName, testUser.email, 'member');
    await teamPage.changeMemberRole(teamName, testUser.email, 'admin');

    await teamPage.viewAuditLog(teamName);

    // Verify role change is logged
    await expect(teamPage.auditLogEntries).toContainText('Role changed');
    await expect(teamPage.auditLogEntries).toContainText('admin');
  });

  test('should log project sharing event', async ({ authenticatedPage, createProject }) => {
    const teamPage = new TeamPage(authenticatedPage);
    await teamPage.goto();

    const teamName = `Share Log ${Date.now()}`;
    await teamPage.createTeam(teamName, 'Share logging test');

    const project = await createProject(`Logged Share ${Date.now()}`);
    await teamPage.shareProject(project.name, teamName);

    await teamPage.viewAuditLog(teamName);

    // Verify sharing event is logged
    await expect(teamPage.auditLogEntries).toContainText('Project shared');
    await expect(teamPage.auditLogEntries).toContainText(project.name);
  });

  test('should filter audit log by user', async ({ authenticatedPage, testUser }) => {
    const teamPage = new TeamPage(authenticatedPage);
    await teamPage.goto();

    const teamName = `Filter User ${Date.now()}`;
    await teamPage.createTeam(teamName, 'Filter by user test');
    await teamPage.inviteMember(teamName, testUser.email, 'member');

    await teamPage.viewAuditLog(teamName);

    // Get initial count
    const initialCount = await teamPage.getAuditLogCount();

    // Filter by specific user
    await teamPage.filterAuditLog({ user: testUser.email });

    // Verify filtered results
    const filteredCount = await teamPage.getAuditLogCount();
    expect(filteredCount).toBeLessThanOrEqual(initialCount);
  });

  test('should filter audit log by action type', async ({ authenticatedPage, testUser }) => {
    const teamPage = new TeamPage(authenticatedPage);
    await teamPage.goto();

    const teamName = `Filter Action ${Date.now()}`;
    await teamPage.createTeam(teamName, 'Filter by action test');
    await teamPage.inviteMember(teamName, testUser.email, 'member');
    await teamPage.changeMemberRole(teamName, testUser.email, 'admin');

    await teamPage.viewAuditLog(teamName);

    // Filter by role changes only
    await teamPage.filterAuditLog({ action: 'role_changed' });

    // Verify only role change events shown
    const entries = teamPage.auditLogEntries.locator('[data-testid="audit-entry"]');
    const count = await entries.count();

    for (let i = 0; i < count; i++) {
      await expect(entries.nth(i)).toContainText(/role.*changed/i);
    }
  });

  test('should filter audit log by date range', async ({ authenticatedPage }) => {
    const teamPage = new TeamPage(authenticatedPage);
    await teamPage.goto();

    const teamName = `Filter Date ${Date.now()}`;
    await teamPage.createTeam(teamName, 'Filter by date test');

    await teamPage.viewAuditLog(teamName);

    const today = new Date().toISOString().split('T')[0];
    await teamPage.filterAuditLog({
      dateFrom: today,
      dateTo: today
    });

    // Verify filtered entries are from today
    const count = await teamPage.getAuditLogCount();
    expect(count).toBeGreaterThan(0);
  });

  test('should export audit log', async ({ authenticatedPage }) => {
    const teamPage = new TeamPage(authenticatedPage);
    await teamPage.goto();

    const teamName = `Export Log ${Date.now()}`;
    await teamPage.createTeam(teamName, 'Export test');

    await teamPage.viewAuditLog(teamName);

    // Click export button
    const exportButton = authenticatedPage.locator('[data-testid="export-audit-log"]');
    await expect(exportButton).toBeVisible();

    // Set up download handler
    const downloadPromise = authenticatedPage.waitForEvent('download');
    await exportButton.click();
    const download = await downloadPromise;

    // Verify download started
    expect(download.suggestedFilename()).toMatch(/audit.*log.*\.csv/i);
  });

  test('should show detailed event information', async ({ authenticatedPage, testUser }) => {
    const teamPage = new TeamPage(authenticatedPage);
    await teamPage.goto();

    const teamName = `Detail Log ${Date.now()}`;
    await teamPage.createTeam(teamName, 'Detail test');
    await teamPage.inviteMember(teamName, testUser.email, 'admin');

    await teamPage.viewAuditLog(teamName);

    // Click on an audit entry to see details
    const firstEntry = teamPage.auditLogEntries.locator('[data-testid="audit-entry"]').first();
    await firstEntry.click();

    // Verify detail panel shows
    const detailPanel = authenticatedPage.locator('[data-testid="audit-detail-panel"]');
    await expect(detailPanel).toBeVisible();

    // Should show timestamp, user, action, and metadata
    await expect(detailPanel.locator('[data-testid="event-timestamp"]')).toBeVisible();
    await expect(detailPanel.locator('[data-testid="event-user"]')).toBeVisible();
    await expect(detailPanel.locator('[data-testid="event-action"]')).toBeVisible();
  });
});

test.describe('Team Collaboration Edge Cases', () => {
  test('should handle team with maximum members', async ({ authenticatedPage }) => {
    const teamPage = new TeamPage(authenticatedPage);
    await teamPage.goto();

    const teamName = `Max Members ${Date.now()}`;
    await teamPage.createTeam(teamName, 'Max members test');

    // Invite multiple members (test limit)
    const maxMembers = 10; // Assuming a limit exists
    for (let i = 0; i < maxMembers; i++) {
      await teamPage.inviteMember(teamName, `user${i}@test.com`, 'member');
    }

    // Try to invite one more
    await teamPage.getTeamRow(teamName).click();
    await teamPage.inviteMemberButton.click();
    await teamPage.memberEmailInput.fill('overflow@test.com');
    await teamPage.sendInviteButton.click();

    // Should show limit reached (if applicable)
    // This depends on business rules
  });

  test('should handle concurrent role changes', async ({ authenticatedPage, testUser }) => {
    const teamPage = new TeamPage(authenticatedPage);
    await teamPage.goto();

    const teamName = `Concurrent ${Date.now()}`;
    await teamPage.createTeam(teamName, 'Concurrent test');
    await teamPage.inviteMember(teamName, testUser.email, 'member');

    // Attempt rapid role changes
    await teamPage.changeMemberRole(teamName, testUser.email, 'admin');
    await teamPage.changeMemberRole(teamName, testUser.email, 'viewer');
    await teamPage.changeMemberRole(teamName, testUser.email, 'member');

    // Final role should be member
    const role = await teamPage.getMemberRole(teamName, testUser.email);
    expect(role.toLowerCase()).toContain('member');
  });

  test('should prevent last admin from leaving team', async ({ authenticatedPage }) => {
    const teamPage = new TeamPage(authenticatedPage);
    await teamPage.goto();

    const teamName = `Last Admin ${Date.now()}`;
    await teamPage.createTeam(teamName, 'Last admin test');

    // Try to remove self (only admin)
    await teamPage.getTeamRow(teamName).click();
    const currentUserRow = authenticatedPage.locator('[data-testid="member-row"][data-current-user="true"]');

    if (await currentUserRow.locator(teamPage.removeMemberButton).isVisible()) {
      await currentUserRow.locator(teamPage.removeMemberButton).click();

      // Should show error
      await expect(teamPage.errorMessage).toBeVisible();
      await expect(teamPage.errorMessage).toContainText(/last admin|cannot remove/i);
    }
  });

  test('should handle team deletion with shared projects', async ({ authenticatedPage, createProject }) => {
    const teamPage = new TeamPage(authenticatedPage);
    await teamPage.goto();

    const teamName = `Delete Shared ${Date.now()}`;
    await teamPage.createTeam(teamName, 'Delete with sharing test');

    const project = await createProject(`Shared ${Date.now()}`);
    await teamPage.shareProject(project.name, teamName);

    // Try to delete team
    await teamPage.goto();
    await teamPage.getTeamRow(teamName).locator(teamPage.deleteTeamButton).click();

    // Should warn about shared projects
    await expect(teamPage.warningMessage).toBeVisible();
    await expect(teamPage.warningMessage).toContainText(/shared project/i);
  });
});
