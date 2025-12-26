/**
 * Dashboard Page Object Model
 *
 * Main dashboard with project list, environment management, and variables.
 */

import { Page, Locator, expect } from '@playwright/test';

export class DashboardPage {
  readonly page: Page;

  // Layout locators
  readonly sidebar: Locator;
  readonly mainContent: Locator;
  readonly header: Locator;

  // Project list locators
  readonly projectList: Locator;
  readonly newProjectButton: Locator;
  readonly projectSearchInput: Locator;
  readonly projectItems: Locator;

  // Environment tabs
  readonly environmentTabs: Locator;
  readonly newEnvironmentButton: Locator;
  readonly activeEnvironmentTab: Locator;

  // Variable list locators
  readonly variableList: Locator;
  readonly addVariableButton: Locator;
  readonly variableRows: Locator;
  readonly variableSearchInput: Locator;

  // Import/Export
  readonly importButton: Locator;
  readonly exportButton: Locator;
  readonly fileInput: Locator;

  // Sync status
  readonly syncIndicator: Locator;
  readonly syncButton: Locator;

  // Settings and actions
  readonly settingsButton: Locator;
  readonly lockVaultButton: Locator;
  readonly userMenu: Locator;

  constructor(page: Page) {
    this.page = page;

    // Layout
    this.sidebar = page.locator('[data-testid="sidebar"]');
    this.mainContent = page.locator('[data-testid="main-content"]');
    this.header = page.locator('[data-testid="header"]');

    // Projects
    this.projectList = page.locator('[data-testid="project-list"]');
    this.newProjectButton = page.locator('[data-testid="new-project-button"]');
    this.projectSearchInput = page.locator('[data-testid="project-search"]');
    this.projectItems = page.locator('[data-testid="project-item"]');

    // Environments
    this.environmentTabs = page.locator('[data-testid="environment-tabs"]');
    this.newEnvironmentButton = page.locator('[data-testid="new-environment-button"]');
    this.activeEnvironmentTab = page.locator('[data-testid="environment-tab"].active');

    // Variables
    this.variableList = page.locator('[data-testid="variable-list"]');
    this.addVariableButton = page.locator('[data-testid="add-variable-button"]');
    this.variableRows = page.locator('[data-testid="variable-row"]');
    this.variableSearchInput = page.locator('[data-testid="variable-search"]');

    // Import/Export
    this.importButton = page.locator('[data-testid="import-button"]');
    this.exportButton = page.locator('[data-testid="export-button"]');
    this.fileInput = page.locator('input[type="file"]');

    // Sync
    this.syncIndicator = page.locator('[data-testid="sync-indicator"]');
    this.syncButton = page.locator('[data-testid="sync-button"]');

    // Settings
    this.settingsButton = page.locator('[data-testid="settings-button"]');
    this.lockVaultButton = page.locator('[data-testid="lock-vault-button"]');
    this.userMenu = page.locator('[data-testid="user-menu"]');
  }

  /**
   * Navigate to dashboard
   */
  async goto() {
    await this.page.goto('/dashboard');
  }

  /**
   * Wait for dashboard to be fully loaded
   */
  async waitForLoad() {
    await expect(this.sidebar).toBeVisible();
    await expect(this.mainContent).toBeVisible();
  }

  // Project Management

  /**
   * Create a new project
   */
  async createProject(name: string, description?: string) {
    await this.newProjectButton.click();
    await this.page.locator('[data-testid="project-name-input"]').fill(name);
    if (description) {
      await this.page.locator('[data-testid="project-description-input"]').fill(description);
    }
    await this.page.locator('[data-testid="create-project-submit"]').click();
    await expect(this.page.locator(`[data-testid="project-item"]:has-text("${name}")`)).toBeVisible();
  }

  /**
   * Select a project by name
   */
  async selectProject(name: string) {
    await this.page.locator(`[data-testid="project-item"]:has-text("${name}")`).click();
  }

  /**
   * Delete a project by name
   */
  async deleteProject(name: string) {
    const projectItem = this.page.locator(`[data-testid="project-item"]:has-text("${name}")`);
    await projectItem.hover();
    await projectItem.locator('[data-testid="project-menu-button"]').click();
    await this.page.locator('[data-testid="delete-project-option"]').click();
    await this.page.locator('[data-testid="confirm-delete-input"]').fill('DELETE');
    await this.page.locator('[data-testid="confirm-delete-button"]').click();
    await expect(projectItem).not.toBeVisible();
  }

  /**
   * Search for projects
   */
  async searchProjects(query: string) {
    await this.projectSearchInput.fill(query);
    await this.page.waitForTimeout(300); // Debounce
  }

  /**
   * Get project count
   */
  async getProjectCount(): Promise<number> {
    return await this.projectItems.count();
  }

  // Environment Management

  /**
   * Create a new environment
   */
  async createEnvironment(name: string) {
    await this.newEnvironmentButton.click();
    await this.page.locator('[data-testid="environment-name-input"]').fill(name);
    await this.page.locator('[data-testid="create-environment-submit"]').click();
    await expect(this.page.locator(`[data-testid="environment-tab"]:has-text("${name}")`)).toBeVisible();
  }

  /**
   * Select an environment by name
   */
  async selectEnvironment(name: string) {
    await this.page.locator(`[data-testid="environment-tab"]:has-text("${name}")`).click();
  }

  /**
   * Get active environment name
   */
  async getActiveEnvironment(): Promise<string> {
    return await this.activeEnvironmentTab.textContent() || '';
  }

  /**
   * Delete an environment
   */
  async deleteEnvironment(name: string) {
    const tab = this.page.locator(`[data-testid="environment-tab"]:has-text("${name}")`);
    await tab.click({ button: 'right' });
    await this.page.locator('[data-testid="delete-environment-option"]').click();
    await this.page.locator('[data-testid="confirm-delete-button"]').click();
    await expect(tab).not.toBeVisible();
  }

  // Variable Management

  /**
   * Add a new variable
   */
  async addVariable(key: string, value: string, isSecret = false) {
    await this.addVariableButton.click();
    await this.page.locator('[data-testid="variable-key-input"]').fill(key);
    await this.page.locator('[data-testid="variable-value-input"]').fill(value);
    if (isSecret) {
      await this.page.locator('[data-testid="variable-secret-checkbox"]').check();
    }
    await this.page.locator('[data-testid="save-variable-button"]').click();
    await expect(this.page.locator(`[data-testid="variable-row"]:has-text("${key}")`)).toBeVisible();
  }

  /**
   * Edit a variable
   */
  async editVariable(key: string, newValue: string) {
    const row = this.page.locator(`[data-testid="variable-row"]:has-text("${key}")`);
    await row.locator('[data-testid="edit-variable-button"]').click();
    await this.page.locator('[data-testid="variable-value-input"]').clear();
    await this.page.locator('[data-testid="variable-value-input"]').fill(newValue);
    await this.page.locator('[data-testid="save-variable-button"]').click();
  }

  /**
   * Delete a variable
   */
  async deleteVariable(key: string) {
    const row = this.page.locator(`[data-testid="variable-row"]:has-text("${key}")`);
    await row.locator('[data-testid="delete-variable-button"]').click();
    await this.page.locator('[data-testid="confirm-delete-button"]').click();
    await expect(row).not.toBeVisible();
  }

  /**
   * Copy variable value to clipboard
   */
  async copyVariableValue(key: string) {
    const row = this.page.locator(`[data-testid="variable-row"]:has-text("${key}")`);
    await row.locator('[data-testid="copy-value-button"]').click();
  }

  /**
   * Toggle variable visibility (show/hide secret)
   */
  async toggleVariableVisibility(key: string) {
    const row = this.page.locator(`[data-testid="variable-row"]:has-text("${key}")`);
    await row.locator('[data-testid="toggle-visibility-button"]').click();
  }

  /**
   * Get variable count
   */
  async getVariableCount(): Promise<number> {
    return await this.variableRows.count();
  }

  /**
   * Search variables
   */
  async searchVariables(query: string) {
    await this.variableSearchInput.fill(query);
    await this.page.waitForTimeout(300); // Debounce
  }

  // Import/Export

  /**
   * Import .env file
   */
  async importEnvFile(filePath: string) {
    await this.importButton.click();
    await this.fileInput.setInputFiles(filePath);
    await expect(this.page.locator('[data-testid="import-success"]')).toBeVisible();
  }

  /**
   * Export to .env file
   */
  async exportEnvFile() {
    const [download] = await Promise.all([
      this.page.waitForEvent('download'),
      this.exportButton.click(),
    ]);
    return download;
  }

  // Sync

  /**
   * Trigger sync
   */
  async sync() {
    await this.syncButton.click();
    await expect(this.syncIndicator).toHaveAttribute('data-status', 'synced', { timeout: 10000 });
  }

  /**
   * Get sync status
   */
  async getSyncStatus(): Promise<string> {
    return await this.syncIndicator.getAttribute('data-status') || 'unknown';
  }

  // Navigation

  /**
   * Open settings
   */
  async openSettings() {
    await this.settingsButton.click();
  }

  /**
   * Lock vault
   */
  async lockVault() {
    await this.lockVaultButton.click();
    await expect(this.page.locator('[data-testid="vault-lock"]')).toBeVisible();
  }

  /**
   * Open user menu
   */
  async openUserMenu() {
    await this.userMenu.click();
  }
}
