/**
 * Variables Page Object Model
 *
 * Handles variable management functionality including CRUD operations,
 * import/export, bulk operations, and validation.
 */

import { Page, Locator, expect } from '@playwright/test';

export class VariablesPage {
  readonly page: Page;

  // Variable list locators
  readonly variableList: Locator;
  readonly variableRows: Locator;
  readonly emptyState: Locator;
  readonly variableCount: Locator;

  // Add/Edit variable dialog
  readonly addVariableButton: Locator;
  readonly variableDialog: Locator;
  readonly variableKeyInput: Locator;
  readonly variableValueInput: Locator;
  readonly variableSecretCheckbox: Locator;
  readonly saveVariableButton: Locator;
  readonly cancelVariableButton: Locator;
  readonly dialogTitle: Locator;
  readonly validationError: Locator;

  // Search and filter
  readonly searchInput: Locator;
  readonly clearSearchButton: Locator;
  readonly filterButton: Locator;
  readonly filterSecretsOnly: Locator;
  readonly filterNonSecretsOnly: Locator;

  // Sort controls
  readonly sortButton: Locator;
  readonly sortByKey: Locator;
  readonly sortByValue: Locator;
  readonly sortAscending: Locator;
  readonly sortDescending: Locator;

  // Import/Export
  readonly importButton: Locator;
  readonly exportButton: Locator;
  readonly fileInput: Locator;
  readonly importDialog: Locator;
  readonly importPreview: Locator;
  readonly confirmImportButton: Locator;
  readonly cancelImportButton: Locator;
  readonly importSuccessMessage: Locator;
  readonly importErrorMessage: Locator;
  readonly handleDuplicatesDropdown: Locator;

  // Bulk operations
  readonly selectAllCheckbox: Locator;
  readonly selectedCount: Locator;
  readonly bulkDeleteButton: Locator;
  readonly bulkCopyButton: Locator;
  readonly bulkActionsBar: Locator;

  // Confirmation dialog
  readonly confirmDialog: Locator;
  readonly confirmDeleteButton: Locator;
  readonly cancelDeleteButton: Locator;
  readonly confirmMessage: Locator;

  constructor(page: Page) {
    this.page = page;

    // Variable list
    this.variableList = page.locator('[data-testid="variable-list"]');
    this.variableRows = page.locator('[data-testid="variable-row"]');
    this.emptyState = page.locator('[data-testid="empty-state"]');
    this.variableCount = page.locator('[data-testid="variable-count"]');

    // Add/Edit dialog
    this.addVariableButton = page.locator('[data-testid="add-variable-button"]');
    this.variableDialog = page.locator('[data-testid="variable-dialog"]');
    this.variableKeyInput = page.locator('[data-testid="variable-key-input"]');
    this.variableValueInput = page.locator('[data-testid="variable-value-input"]');
    this.variableSecretCheckbox = page.locator('[data-testid="variable-secret-checkbox"]');
    this.saveVariableButton = page.locator('[data-testid="save-variable-button"]');
    this.cancelVariableButton = page.locator('[data-testid="cancel-variable-button"]');
    this.dialogTitle = page.locator('[data-testid="dialog-title"]');
    this.validationError = page.locator('[data-testid="validation-error"]');

    // Search and filter
    this.searchInput = page.locator('[data-testid="variable-search"]');
    this.clearSearchButton = page.locator('[data-testid="clear-search"]');
    this.filterButton = page.locator('[data-testid="filter-button"]');
    this.filterSecretsOnly = page.locator('[data-testid="filter-secrets-only"]');
    this.filterNonSecretsOnly = page.locator('[data-testid="filter-non-secrets-only"]');

    // Sort controls
    this.sortButton = page.locator('[data-testid="sort-button"]');
    this.sortByKey = page.locator('[data-testid="sort-by-key"]');
    this.sortByValue = page.locator('[data-testid="sort-by-value"]');
    this.sortAscending = page.locator('[data-testid="sort-ascending"]');
    this.sortDescending = page.locator('[data-testid="sort-descending"]');

    // Import/Export
    this.importButton = page.locator('[data-testid="import-button"]');
    this.exportButton = page.locator('[data-testid="export-button"]');
    this.fileInput = page.locator('input[type="file"]');
    this.importDialog = page.locator('[data-testid="import-dialog"]');
    this.importPreview = page.locator('[data-testid="import-preview"]');
    this.confirmImportButton = page.locator('[data-testid="confirm-import-button"]');
    this.cancelImportButton = page.locator('[data-testid="cancel-import-button"]');
    this.importSuccessMessage = page.locator('[data-testid="import-success"]');
    this.importErrorMessage = page.locator('[data-testid="import-error"]');
    this.handleDuplicatesDropdown = page.locator('[data-testid="handle-duplicates-dropdown"]');

    // Bulk operations
    this.selectAllCheckbox = page.locator('[data-testid="select-all-checkbox"]');
    this.selectedCount = page.locator('[data-testid="selected-count"]');
    this.bulkDeleteButton = page.locator('[data-testid="bulk-delete-button"]');
    this.bulkCopyButton = page.locator('[data-testid="bulk-copy-button"]');
    this.bulkActionsBar = page.locator('[data-testid="bulk-actions-bar"]');

    // Confirmation dialog
    this.confirmDialog = page.locator('[data-testid="confirm-dialog"]');
    this.confirmDeleteButton = page.locator('[data-testid="confirm-delete-button"]');
    this.cancelDeleteButton = page.locator('[data-testid="cancel-delete-button"]');
    this.confirmMessage = page.locator('[data-testid="confirm-message"]');
  }

  /**
   * Get a specific variable row by key
   */
  getVariableRow(key: string): Locator {
    return this.page.locator(`[data-testid="variable-row"]:has-text("${key}")`);
  }

  /**
   * Get edit button for a variable
   */
  getEditButton(key: string): Locator {
    return this.getVariableRow(key).locator('[data-testid="edit-variable-button"]');
  }

  /**
   * Get delete button for a variable
   */
  getDeleteButton(key: string): Locator {
    return this.getVariableRow(key).locator('[data-testid="delete-variable-button"]');
  }

  /**
   * Get copy button for a variable
   */
  getCopyButton(key: string): Locator {
    return this.getVariableRow(key).locator('[data-testid="copy-value-button"]');
  }

  /**
   * Get toggle visibility button for a variable
   */
  getToggleVisibilityButton(key: string): Locator {
    return this.getVariableRow(key).locator('[data-testid="toggle-visibility-button"]');
  }

  /**
   * Get checkbox for a variable row
   */
  getVariableCheckbox(key: string): Locator {
    return this.getVariableRow(key).locator('[data-testid="variable-checkbox"]');
  }

  /**
   * Get variable value display
   */
  getVariableValue(key: string): Locator {
    return this.getVariableRow(key).locator('[data-testid="variable-value"]');
  }

  /**
   * Add a new variable
   */
  async addVariable(key: string, value: string, isSecret = false) {
    await this.addVariableButton.click();
    await expect(this.variableDialog).toBeVisible();
    await this.variableKeyInput.fill(key);
    await this.variableValueInput.fill(value);
    if (isSecret) {
      await this.variableSecretCheckbox.check();
    }
    await this.saveVariableButton.click();
    await expect(this.variableDialog).not.toBeVisible();
  }

  /**
   * Add a variable and expect success
   */
  async addVariableExpectSuccess(key: string, value: string, isSecret = false) {
    await this.addVariable(key, value, isSecret);
    await expect(this.getVariableRow(key)).toBeVisible();
  }

  /**
   * Add a variable and expect validation error
   */
  async addVariableExpectError(key: string, value: string, isSecret = false) {
    await this.addVariableButton.click();
    await this.variableKeyInput.fill(key);
    await this.variableValueInput.fill(value);
    if (isSecret) {
      await this.variableSecretCheckbox.check();
    }
    await this.saveVariableButton.click();
    await expect(this.validationError).toBeVisible();
  }

  /**
   * Edit a variable's value
   */
  async editVariableValue(key: string, newValue: string) {
    await this.getEditButton(key).click();
    await expect(this.variableDialog).toBeVisible();
    await this.variableValueInput.clear();
    await this.variableValueInput.fill(newValue);
    await this.saveVariableButton.click();
    await expect(this.variableDialog).not.toBeVisible();
  }

  /**
   * Edit a variable's key
   */
  async editVariableKey(oldKey: string, newKey: string) {
    await this.getEditButton(oldKey).click();
    await expect(this.variableDialog).toBeVisible();
    await this.variableKeyInput.clear();
    await this.variableKeyInput.fill(newKey);
    await this.saveVariableButton.click();
    await expect(this.variableDialog).not.toBeVisible();
  }

  /**
   * Edit both key and value
   */
  async editVariable(oldKey: string, newKey: string, newValue: string) {
    await this.getEditButton(oldKey).click();
    await expect(this.variableDialog).toBeVisible();
    await this.variableKeyInput.clear();
    await this.variableKeyInput.fill(newKey);
    await this.variableValueInput.clear();
    await this.variableValueInput.fill(newValue);
    await this.saveVariableButton.click();
    await expect(this.variableDialog).not.toBeVisible();
  }

  /**
   * Delete a variable with confirmation
   */
  async deleteVariable(key: string) {
    await this.getDeleteButton(key).click();
    await expect(this.confirmDialog).toBeVisible();
    await this.confirmDeleteButton.click();
    await expect(this.confirmDialog).not.toBeVisible();
    await expect(this.getVariableRow(key)).not.toBeVisible();
  }

  /**
   * Delete a variable and cancel confirmation
   */
  async deleteVariableCancel(key: string) {
    await this.getDeleteButton(key).click();
    await expect(this.confirmDialog).toBeVisible();
    await this.cancelDeleteButton.click();
    await expect(this.confirmDialog).not.toBeVisible();
    await expect(this.getVariableRow(key)).toBeVisible();
  }

  /**
   * Toggle secret visibility
   */
  async toggleVisibility(key: string) {
    await this.getToggleVisibilityButton(key).click();
  }

  /**
   * Copy variable value to clipboard
   */
  async copyValue(key: string) {
    await this.getCopyButton(key).click();
  }

  /**
   * Search for variables
   */
  async search(query: string) {
    await this.searchInput.fill(query);
    await this.page.waitForTimeout(300); // Debounce
  }

  /**
   * Clear search
   */
  async clearSearch() {
    await this.clearSearchButton.click();
  }

  /**
   * Sort variables by key
   */
  async sortByKey(ascending = true) {
    await this.sortButton.click();
    await this.sortByKey.click();
    if (ascending) {
      await this.sortAscending.click();
    } else {
      await this.sortDescending.click();
    }
  }

  /**
   * Sort variables by value
   */
  async sortByValue(ascending = true) {
    await this.sortButton.click();
    await this.sortByValue.click();
    if (ascending) {
      await this.sortAscending.click();
    } else {
      await this.sortDescending.click();
    }
  }

  /**
   * Import .env file
   */
  async importEnvFile(filePath: string, handleDuplicates?: 'skip' | 'overwrite' | 'merge') {
    await this.importButton.click();
    await this.fileInput.setInputFiles(filePath);
    await expect(this.importDialog).toBeVisible();

    if (handleDuplicates) {
      await this.handleDuplicatesDropdown.selectOption(handleDuplicates);
    }

    await this.confirmImportButton.click();
  }

  /**
   * Import .env file and expect success
   */
  async importEnvFileExpectSuccess(filePath: string, handleDuplicates?: 'skip' | 'overwrite' | 'merge') {
    await this.importEnvFile(filePath, handleDuplicates);
    await expect(this.importSuccessMessage).toBeVisible();
  }

  /**
   * Import .env file and expect error
   */
  async importEnvFileExpectError(filePath: string) {
    await this.importButton.click();
    await this.fileInput.setInputFiles(filePath);
    await expect(this.importErrorMessage).toBeVisible();
  }

  /**
   * Cancel import
   */
  async cancelImport() {
    await this.importButton.click();
    await expect(this.importDialog).toBeVisible();
    await this.cancelImportButton.click();
    await expect(this.importDialog).not.toBeVisible();
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

  /**
   * Select all variables
   */
  async selectAll() {
    await this.selectAllCheckbox.check();
    await expect(this.bulkActionsBar).toBeVisible();
  }

  /**
   * Deselect all variables
   */
  async deselectAll() {
    await this.selectAllCheckbox.uncheck();
    await expect(this.bulkActionsBar).not.toBeVisible();
  }

  /**
   * Select a specific variable
   */
  async selectVariable(key: string) {
    await this.getVariableCheckbox(key).check();
  }

  /**
   * Deselect a specific variable
   */
  async deselectVariable(key: string) {
    await this.getVariableCheckbox(key).uncheck();
  }

  /**
   * Select multiple variables
   */
  async selectVariables(keys: string[]) {
    for (const key of keys) {
      await this.selectVariable(key);
    }
    await expect(this.bulkActionsBar).toBeVisible();
  }

  /**
   * Delete selected variables
   */
  async deleteSelected() {
    await this.bulkDeleteButton.click();
    await expect(this.confirmDialog).toBeVisible();
    await this.confirmDeleteButton.click();
    await expect(this.confirmDialog).not.toBeVisible();
  }

  /**
   * Copy selected variables
   */
  async copySelected() {
    await this.bulkCopyButton.click();
  }

  /**
   * Get count of selected variables
   */
  async getSelectedCount(): Promise<number> {
    const text = await this.selectedCount.textContent();
    return parseInt(text || '0', 10);
  }

  /**
   * Get total variable count
   */
  async getVariableCount(): Promise<number> {
    return await this.variableRows.count();
  }

  /**
   * Check if variable exists
   */
  async hasVariable(key: string): Promise<boolean> {
    return await this.getVariableRow(key).isVisible({ timeout: 1000 }).catch(() => false);
  }

  /**
   * Check if variable is secret (masked)
   */
  async isVariableSecret(key: string): Promise<boolean> {
    const value = this.getVariableValue(key);
    const text = await value.textContent();
    return text === '••••••••' || text?.includes('•') || false;
  }

  /**
   * Get variable value text
   */
  async getVariableValueText(key: string): Promise<string> {
    return await this.getVariableValue(key).textContent() || '';
  }

  /**
   * Wait for variable list to load
   */
  async waitForLoad() {
    await expect(this.variableList).toBeVisible();
  }

  /**
   * Check if empty state is shown
   */
  async isEmptyStateVisible(): Promise<boolean> {
    return await this.emptyState.isVisible({ timeout: 1000 }).catch(() => false);
  }

  /**
   * Get validation error message
   */
  async getValidationError(): Promise<string> {
    return await this.validationError.textContent() || '';
  }

  /**
   * Get import preview text
   */
  async getImportPreview(): Promise<string> {
    return await this.importPreview.textContent() || '';
  }

  /**
   * Cancel variable dialog
   */
  async cancelDialog() {
    await this.cancelVariableButton.click();
    await expect(this.variableDialog).not.toBeVisible();
  }
}
