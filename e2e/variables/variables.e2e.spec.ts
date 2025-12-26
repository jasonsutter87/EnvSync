/**
 * EnvSync E2E Tests - Variable Management
 *
 * Comprehensive test suite covering:
 * - Variable CRUD operations
 * - Variable display and UI
 * - Input validation
 * - Import/Export functionality
 * - Bulk operations
 * - Edge cases and error handling
 */

import { test, expect } from '../fixtures/test-fixtures';
import { DashboardPage } from '../pages/dashboard-page';
import { VariablesPage } from '../pages/variables-page';
import * as path from 'path';
import * as fs from 'fs';
import * as os from 'os';

test.describe('Variable Management', () => {
  let dashboardPage: DashboardPage;
  let variablesPage: VariablesPage;

  test.beforeEach(async ({ authenticatedPage, createProject, createEnvironment }) => {
    dashboardPage = new DashboardPage(authenticatedPage);
    variablesPage = new VariablesPage(authenticatedPage);

    // Create a test project and environment
    const project = await createProject('Test Project');
    await createEnvironment(project.id, 'development');

    // Wait for dashboard to load
    await dashboardPage.waitForLoad();
    await variablesPage.waitForLoad();
  });

  test.describe('Variable CRUD Operations', () => {
    test('should add a variable with key and value', async () => {
      await variablesPage.addVariableExpectSuccess('API_KEY', 'test-api-key-123');

      // Verify variable appears in list
      expect(await variablesPage.hasVariable('API_KEY')).toBe(true);
      expect(await variablesPage.getVariableCount()).toBe(1);
    });

    test('should add a secret variable (masked)', async () => {
      await variablesPage.addVariableExpectSuccess('DATABASE_PASSWORD', 'super-secret-pwd', true);

      // Verify variable is marked as secret
      expect(await variablesPage.isVariableSecret('DATABASE_PASSWORD')).toBe(true);

      // Value should be masked by default
      const valueText = await variablesPage.getVariableValueText('DATABASE_PASSWORD');
      expect(valueText).toContain('•');
    });

    test('should edit variable value', async () => {
      await variablesPage.addVariableExpectSuccess('PORT', '3000');
      await variablesPage.editVariableValue('PORT', '8080');

      // Verify value was updated
      const valueText = await variablesPage.getVariableValueText('PORT');
      expect(valueText).toBe('8080');
    });

    test('should edit variable key', async () => {
      await variablesPage.addVariableExpectSuccess('OLD_KEY', 'value');
      await variablesPage.editVariableKey('OLD_KEY', 'NEW_KEY');

      // Verify old key is gone and new key exists
      expect(await variablesPage.hasVariable('OLD_KEY')).toBe(false);
      expect(await variablesPage.hasVariable('NEW_KEY')).toBe(true);
    });

    test('should edit both key and value', async () => {
      await variablesPage.addVariableExpectSuccess('TEMP_VAR', 'temp_value');
      await variablesPage.editVariable('TEMP_VAR', 'FINAL_VAR', 'final_value');

      // Verify changes
      expect(await variablesPage.hasVariable('TEMP_VAR')).toBe(false);
      expect(await variablesPage.hasVariable('FINAL_VAR')).toBe(true);
      const valueText = await variablesPage.getVariableValueText('FINAL_VAR');
      expect(valueText).toBe('final_value');
    });

    test('should delete variable with confirmation', async () => {
      await variablesPage.addVariableExpectSuccess('TO_DELETE', 'value');
      await variablesPage.deleteVariable('TO_DELETE');

      // Verify variable is deleted
      expect(await variablesPage.hasVariable('TO_DELETE')).toBe(false);
      expect(await variablesPage.getVariableCount()).toBe(0);
    });

    test('should cancel delete operation', async () => {
      await variablesPage.addVariableExpectSuccess('KEEP_ME', 'value');
      await variablesPage.deleteVariableCancel('KEEP_ME');

      // Verify variable still exists
      expect(await variablesPage.hasVariable('KEEP_ME')).toBe(true);
    });

    test('should toggle secret visibility', async ({ authenticatedPage }) => {
      await variablesPage.addVariableExpectSuccess('SECRET', 'hidden-value', true);

      // Initially masked
      expect(await variablesPage.isVariableSecret('SECRET')).toBe(true);

      // Toggle to show
      await variablesPage.toggleVisibility('SECRET');
      await authenticatedPage.waitForTimeout(100);

      // Should be visible now
      const valueText = await variablesPage.getVariableValueText('SECRET');
      expect(valueText).toBe('hidden-value');

      // Toggle back to hide
      await variablesPage.toggleVisibility('SECRET');
      await authenticatedPage.waitForTimeout(100);

      // Should be masked again
      expect(await variablesPage.isVariableSecret('SECRET')).toBe(true);
    });

    test('should cancel variable creation', async () => {
      await variablesPage.addVariableButton.click();
      await variablesPage.variableKeyInput.fill('CANCELLED');
      await variablesPage.variableValueInput.fill('value');
      await variablesPage.cancelDialog();

      // Verify variable was not created
      expect(await variablesPage.hasVariable('CANCELLED')).toBe(false);
    });
  });

  test.describe('Variable Display', () => {
    test.beforeEach(async () => {
      // Add test variables
      await variablesPage.addVariableExpectSuccess('API_KEY', 'key-123');
      await variablesPage.addVariableExpectSuccess('DATABASE_URL', 'postgres://localhost', true);
      await variablesPage.addVariableExpectSuccess('PORT', '3000');
      await variablesPage.addVariableExpectSuccess('NODE_ENV', 'development');
    });

    test('should show all variables in environment', async () => {
      const count = await variablesPage.getVariableCount();
      expect(count).toBe(4);

      // Verify all variables are visible
      expect(await variablesPage.hasVariable('API_KEY')).toBe(true);
      expect(await variablesPage.hasVariable('DATABASE_URL')).toBe(true);
      expect(await variablesPage.hasVariable('PORT')).toBe(true);
      expect(await variablesPage.hasVariable('NODE_ENV')).toBe(true);
    });

    test('should search/filter variables', async () => {
      await variablesPage.search('API');

      // Should show only API_KEY
      expect(await variablesPage.hasVariable('API_KEY')).toBe(true);
      expect(await variablesPage.hasVariable('PORT')).toBe(false);
    });

    test('should clear search filter', async () => {
      await variablesPage.search('API');
      await variablesPage.clearSearch();

      // All variables should be visible again
      expect(await variablesPage.getVariableCount()).toBe(4);
    });

    test('should sort variables by key ascending', async () => {
      await variablesPage.sortByKey(true);

      // Get all variable rows and verify order
      const rows = await variablesPage.variableRows.all();
      const keys = await Promise.all(
        rows.map(row => row.locator('[data-testid="variable-key"]').textContent())
      );

      // Should be in alphabetical order
      expect(keys).toEqual(['API_KEY', 'DATABASE_URL', 'NODE_ENV', 'PORT']);
    });

    test('should sort variables by key descending', async () => {
      await variablesPage.sortByKey(false);

      const rows = await variablesPage.variableRows.all();
      const keys = await Promise.all(
        rows.map(row => row.locator('[data-testid="variable-key"]').textContent())
      );

      // Should be in reverse alphabetical order
      expect(keys).toEqual(['PORT', 'NODE_ENV', 'DATABASE_URL', 'API_KEY']);
    });

    test('should copy value to clipboard', async ({ authenticatedPage }) => {
      // Grant clipboard permissions
      await authenticatedPage.context().grantPermissions(['clipboard-read', 'clipboard-write']);

      await variablesPage.copyValue('API_KEY');

      // Verify clipboard content
      const clipboardText = await authenticatedPage.evaluate(() => navigator.clipboard.readText());
      expect(clipboardText).toBe('key-123');
    });

    test('should mask/unmask secrets', async () => {
      // Secret should be masked initially
      expect(await variablesPage.isVariableSecret('DATABASE_URL')).toBe(true);

      // Unmask
      await variablesPage.toggleVisibility('DATABASE_URL');
      const valueText = await variablesPage.getVariableValueText('DATABASE_URL');
      expect(valueText).toBe('postgres://localhost');

      // Mask again
      await variablesPage.toggleVisibility('DATABASE_URL');
      expect(await variablesPage.isVariableSecret('DATABASE_URL')).toBe(true);
    });

    test('should display empty state when no variables', async () => {
      // Delete all variables
      await variablesPage.selectAll();
      await variablesPage.deleteSelected();

      // Verify empty state is shown
      expect(await variablesPage.isEmptyStateVisible()).toBe(true);
      expect(await variablesPage.getVariableCount()).toBe(0);
    });

    test('should show variable count', async () => {
      const count = await variablesPage.getVariableCount();

      // Verify count matches expected
      expect(count).toBe(4);

      // Add one more variable
      await variablesPage.addVariableExpectSuccess('NEW_VAR', 'value');
      expect(await variablesPage.getVariableCount()).toBe(5);
    });
  });

  test.describe('Variable Validation', () => {
    test('should prevent empty key', async () => {
      await variablesPage.addVariableExpectError('', 'value');

      const error = await variablesPage.getValidationError();
      expect(error).toContain('required');
    });

    test('should prevent duplicate keys', async () => {
      await variablesPage.addVariableExpectSuccess('DUPLICATE', 'value1');
      await variablesPage.addVariableExpectError('DUPLICATE', 'value2');

      const error = await variablesPage.getValidationError();
      expect(error).toContain('already exists');
    });

    test('should handle special characters in key', async () => {
      // Valid special characters
      await variablesPage.addVariableExpectSuccess('KEY_WITH_UNDERSCORE', 'value');
      await variablesPage.addVariableExpectSuccess('KEY123', 'value');

      // Should allow uppercase and numbers
      expect(await variablesPage.hasVariable('KEY_WITH_UNDERSCORE')).toBe(true);
      expect(await variablesPage.hasVariable('KEY123')).toBe(true);
    });

    test('should handle special characters in values', async () => {
      const specialValue = 'value!@#$%^&*()_+-={}[]|\\:";\'<>?,./';
      await variablesPage.addVariableExpectSuccess('SPECIAL_VALUE', specialValue);

      const valueText = await variablesPage.getVariableValueText('SPECIAL_VALUE');
      expect(valueText).toBe(specialValue);
    });

    test('should handle multiline values', async () => {
      const multilineValue = 'line1\nline2\nline3';
      await variablesPage.addVariableExpectSuccess('MULTILINE', multilineValue);

      // Verify multiline value is stored
      expect(await variablesPage.hasVariable('MULTILINE')).toBe(true);
    });

    test('should handle very long values', async () => {
      const longValue = 'A'.repeat(10000);
      await variablesPage.addVariableExpectSuccess('LONG_VALUE', longValue);

      expect(await variablesPage.hasVariable('LONG_VALUE')).toBe(true);
    });

    test('should validate max key length', async () => {
      const longKey = 'A'.repeat(256);
      await variablesPage.addVariableExpectError(longKey, 'value');

      const error = await variablesPage.getValidationError();
      expect(error).toContain('too long');
    });

    test('should allow empty value', async () => {
      await variablesPage.addVariableExpectSuccess('EMPTY_VALUE', '');

      expect(await variablesPage.hasVariable('EMPTY_VALUE')).toBe(true);
    });

    test('should handle whitespace in keys', async () => {
      // Leading/trailing whitespace should be trimmed or rejected
      await variablesPage.addVariableButton.click();
      await variablesPage.variableKeyInput.fill(' TRIMMED ');
      await variablesPage.variableValueInput.fill('value');
      await variablesPage.saveVariableButton.click();

      // Should either trim or show error
      const hasError = await variablesPage.validationError.isVisible({ timeout: 1000 }).catch(() => false);
      if (!hasError) {
        expect(await variablesPage.hasVariable('TRIMMED')).toBe(true);
      }
    });

    test('should handle URL values', async () => {
      const url = 'https://api.example.com/v1/endpoint?key=value&token=abc123';
      await variablesPage.addVariableExpectSuccess('API_ENDPOINT', url);

      const valueText = await variablesPage.getVariableValueText('API_ENDPOINT');
      expect(valueText).toBe(url);
    });

    test('should handle JSON values', async () => {
      const json = '{"key":"value","nested":{"foo":"bar"}}';
      await variablesPage.addVariableExpectSuccess('JSON_CONFIG', json);

      const valueText = await variablesPage.getVariableValueText('JSON_CONFIG');
      expect(valueText).toBe(json);
    });
  });

  test.describe('Import/Export', () => {
    let tempDir: string;

    test.beforeEach(() => {
      tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'envsync-test-'));
    });

    test.afterEach(() => {
      // Clean up temp files
      if (fs.existsSync(tempDir)) {
        fs.rmSync(tempDir, { recursive: true, force: true });
      }
    });

    test('should import .env file', async () => {
      const envFile = path.join(tempDir, '.env');
      const content = `API_KEY=test-key
DATABASE_URL=postgres://localhost
PORT=3000
NODE_ENV=development`;
      fs.writeFileSync(envFile, content);

      await variablesPage.importEnvFileExpectSuccess(envFile);

      // Verify all variables were imported
      expect(await variablesPage.hasVariable('API_KEY')).toBe(true);
      expect(await variablesPage.hasVariable('DATABASE_URL')).toBe(true);
      expect(await variablesPage.hasVariable('PORT')).toBe(true);
      expect(await variablesPage.hasVariable('NODE_ENV')).toBe(true);
    });

    test('should export to .env file', async () => {
      // Add some variables
      await variablesPage.addVariableExpectSuccess('API_KEY', 'test-key');
      await variablesPage.addVariableExpectSuccess('PORT', '3000');

      const download = await variablesPage.exportEnvFile();
      const downloadPath = path.join(tempDir, 'exported.env');
      await download.saveAs(downloadPath);

      // Verify file contents
      const content = fs.readFileSync(downloadPath, 'utf-8');
      expect(content).toContain('API_KEY=test-key');
      expect(content).toContain('PORT=3000');
    });

    test('should handle import with duplicates - skip', async () => {
      // Add existing variable
      await variablesPage.addVariableExpectSuccess('API_KEY', 'original-value');

      const envFile = path.join(tempDir, '.env');
      fs.writeFileSync(envFile, 'API_KEY=new-value\nNEW_VAR=value');

      await variablesPage.importEnvFile(envFile, 'skip');

      // Original value should be preserved
      const valueText = await variablesPage.getVariableValueText('API_KEY');
      expect(valueText).toBe('original-value');

      // New variable should be added
      expect(await variablesPage.hasVariable('NEW_VAR')).toBe(true);
    });

    test('should handle import with duplicates - overwrite', async () => {
      await variablesPage.addVariableExpectSuccess('API_KEY', 'original-value');

      const envFile = path.join(tempDir, '.env');
      fs.writeFileSync(envFile, 'API_KEY=new-value');

      await variablesPage.importEnvFile(envFile, 'overwrite');

      // Value should be updated
      const valueText = await variablesPage.getVariableValueText('API_KEY');
      expect(valueText).toBe('new-value');
    });

    test('should handle malformed .env file - missing value', async () => {
      const envFile = path.join(tempDir, '.env');
      fs.writeFileSync(envFile, 'INVALID_LINE_NO_EQUALS\nVALID_KEY=value');

      await variablesPage.importEnvFileExpectError(envFile);
    });

    test('should handle malformed .env file - empty', async () => {
      const envFile = path.join(tempDir, '.env');
      fs.writeFileSync(envFile, '');

      await variablesPage.importEnvFileExpectError(envFile);
    });

    test('should handle .env file with comments', async () => {
      const envFile = path.join(tempDir, '.env');
      const content = `# This is a comment
API_KEY=test-key
# Another comment
PORT=3000`;
      fs.writeFileSync(envFile, content);

      await variablesPage.importEnvFileExpectSuccess(envFile);

      // Only non-comment lines should be imported
      expect(await variablesPage.getVariableCount()).toBe(2);
    });

    test('should handle .env file with quotes', async () => {
      const envFile = path.join(tempDir, '.env');
      const content = `API_KEY="quoted-value"
DATABASE_URL='single-quoted'
UNQUOTED=value`;
      fs.writeFileSync(envFile, content);

      await variablesPage.importEnvFileExpectSuccess(envFile);

      // Quotes should be handled correctly
      expect(await variablesPage.hasVariable('API_KEY')).toBe(true);
      expect(await variablesPage.hasVariable('DATABASE_URL')).toBe(true);
      expect(await variablesPage.hasVariable('UNQUOTED')).toBe(true);
    });

    test('should cancel import', async () => {
      const envFile = path.join(tempDir, '.env');
      fs.writeFileSync(envFile, 'API_KEY=test-key');

      await variablesPage.importButton.click();
      await variablesPage.fileInput.setInputFiles(envFile);
      await variablesPage.cancelImport();

      // No variables should be imported
      expect(await variablesPage.getVariableCount()).toBe(0);
    });

    test('should show import preview', async () => {
      const envFile = path.join(tempDir, '.env');
      fs.writeFileSync(envFile, 'API_KEY=test-key\nPORT=3000');

      await variablesPage.importButton.click();
      await variablesPage.fileInput.setInputFiles(envFile);

      // Verify preview shows variables to be imported
      const preview = await variablesPage.getImportPreview();
      expect(preview).toContain('API_KEY');
      expect(preview).toContain('PORT');
    });
  });

  test.describe('Bulk Operations', () => {
    test.beforeEach(async () => {
      // Add test variables
      await variablesPage.addVariableExpectSuccess('VAR1', 'value1');
      await variablesPage.addVariableExpectSuccess('VAR2', 'value2');
      await variablesPage.addVariableExpectSuccess('VAR3', 'value3');
      await variablesPage.addVariableExpectSuccess('VAR4', 'value4');
    });

    test('should select multiple variables', async () => {
      await variablesPage.selectVariables(['VAR1', 'VAR2']);

      const selectedCount = await variablesPage.getSelectedCount();
      expect(selectedCount).toBe(2);
    });

    test('should select all variables', async () => {
      await variablesPage.selectAll();

      const selectedCount = await variablesPage.getSelectedCount();
      expect(selectedCount).toBe(4);
    });

    test('should deselect all variables', async () => {
      await variablesPage.selectAll();
      await variablesPage.deselectAll();

      const selectedCount = await variablesPage.getSelectedCount();
      expect(selectedCount).toBe(0);
    });

    test('should delete multiple variables', async () => {
      await variablesPage.selectVariables(['VAR1', 'VAR2']);
      await variablesPage.deleteSelected();

      // Verify variables were deleted
      expect(await variablesPage.hasVariable('VAR1')).toBe(false);
      expect(await variablesPage.hasVariable('VAR2')).toBe(false);

      // Verify other variables remain
      expect(await variablesPage.hasVariable('VAR3')).toBe(true);
      expect(await variablesPage.hasVariable('VAR4')).toBe(true);
    });

    test('should copy multiple variables', async ({ authenticatedPage }) => {
      await authenticatedPage.context().grantPermissions(['clipboard-read', 'clipboard-write']);

      await variablesPage.selectVariables(['VAR1', 'VAR2']);
      await variablesPage.copySelected();

      // Verify clipboard contains both variables
      const clipboardText = await authenticatedPage.evaluate(() => navigator.clipboard.readText());
      expect(clipboardText).toContain('VAR1=value1');
      expect(clipboardText).toContain('VAR2=value2');
    });

    test('should delete all variables with select all', async () => {
      await variablesPage.selectAll();
      await variablesPage.deleteSelected();

      // All variables should be deleted
      expect(await variablesPage.getVariableCount()).toBe(0);
      expect(await variablesPage.isEmptyStateVisible()).toBe(true);
    });

    test('should show bulk actions bar when selecting variables', async () => {
      await variablesPage.selectVariable('VAR1');

      // Bulk actions bar should be visible
      expect(await variablesPage.bulkActionsBar.isVisible()).toBe(true);
    });

    test('should hide bulk actions bar when deselecting all', async () => {
      await variablesPage.selectAll();
      await variablesPage.deselectAll();

      // Bulk actions bar should be hidden
      expect(await variablesPage.bulkActionsBar.isVisible()).toBe(false);
    });

    test('should update selected count when selecting/deselecting', async () => {
      await variablesPage.selectVariable('VAR1');
      expect(await variablesPage.getSelectedCount()).toBe(1);

      await variablesPage.selectVariable('VAR2');
      expect(await variablesPage.getSelectedCount()).toBe(2);

      await variablesPage.deselectVariable('VAR1');
      expect(await variablesPage.getSelectedCount()).toBe(1);
    });

    test('should preserve selection when searching', async () => {
      await variablesPage.selectVariables(['VAR1', 'VAR2']);
      await variablesPage.search('VAR1');

      // Selection should be preserved
      const selectedCount = await variablesPage.getSelectedCount();
      expect(selectedCount).toBeGreaterThan(0);
    });

    test('should clear selection after bulk delete', async () => {
      await variablesPage.selectVariables(['VAR1', 'VAR2']);
      await variablesPage.deleteSelected();

      // Selection should be cleared
      const selectedCount = await variablesPage.getSelectedCount();
      expect(selectedCount).toBe(0);
    });
  });

  test.describe('Edge Cases', () => {
    test('should handle rapid consecutive additions', async () => {
      // Add multiple variables quickly
      const promises = [];
      for (let i = 0; i < 5; i++) {
        promises.push(variablesPage.addVariableExpectSuccess(`VAR_${i}`, `value_${i}`));
      }

      await Promise.all(promises);

      // All variables should be added
      expect(await variablesPage.getVariableCount()).toBe(5);
    });

    test('should handle variable with extremely long key', async () => {
      const longKey = 'A'.repeat(255); // Max allowed length
      await variablesPage.addVariableButton.click();
      await variablesPage.variableKeyInput.fill(longKey);
      await variablesPage.variableValueInput.fill('value');
      await variablesPage.saveVariableButton.click();

      // Should either succeed or show validation error
      const hasError = await variablesPage.validationError.isVisible({ timeout: 1000 }).catch(() => false);
      if (!hasError) {
        expect(await variablesPage.getVariableCount()).toBe(1);
      }
    });

    test('should handle switching environments', async ({ createEnvironment, authenticatedPage }) => {
      // Add variable to current environment
      await variablesPage.addVariableExpectSuccess('ENV1_VAR', 'value1');

      // Create and switch to new environment
      const project = { id: 'test-project-id' };
      await createEnvironment(project.id, 'staging');

      // Variable from first environment should not be visible
      expect(await variablesPage.hasVariable('ENV1_VAR')).toBe(false);
      expect(await variablesPage.getVariableCount()).toBe(0);
    });

    test('should handle concurrent edits', async ({ authenticatedPage }) => {
      await variablesPage.addVariableExpectSuccess('CONCURRENT', 'initial');

      // Start editing
      await variablesPage.getEditButton('CONCURRENT').click();
      await variablesPage.variableValueInput.clear();
      await variablesPage.variableValueInput.fill('updated');

      // Save should work
      await variablesPage.saveVariableButton.click();

      const valueText = await variablesPage.getVariableValueText('CONCURRENT');
      expect(valueText).toBe('updated');
    });

    test('should preserve secret flag when editing value', async () => {
      await variablesPage.addVariableExpectSuccess('SECRET_VAR', 'secret-value', true);
      await variablesPage.editVariableValue('SECRET_VAR', 'new-secret-value');

      // Should still be marked as secret
      expect(await variablesPage.isVariableSecret('SECRET_VAR')).toBe(true);
    });

    test('should handle network error during save', async ({ authenticatedPage }) => {
      // Simulate offline mode
      await authenticatedPage.context().setOffline(true);

      await variablesPage.addVariableButton.click();
      await variablesPage.variableKeyInput.fill('OFFLINE_VAR');
      await variablesPage.variableValueInput.fill('value');
      await variablesPage.saveVariableButton.click();

      // Should show error or retry
      const hasError = await variablesPage.validationError.isVisible({ timeout: 2000 }).catch(() => false);

      // Restore network
      await authenticatedPage.context().setOffline(false);

      // Error should be shown or save should retry
      expect(hasError).toBe(true);
    });
  });
});
