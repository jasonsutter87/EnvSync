/**
 * Vault Page Object Model
 *
 * Handles vault lock/unlock functionality and master password management.
 */

import { Page, Locator, expect } from '@playwright/test';

export class VaultPage {
  readonly page: Page;

  // Locators
  readonly lockScreen: Locator;
  readonly passwordInput: Locator;
  readonly unlockButton: Locator;
  readonly createVaultButton: Locator;
  readonly confirmPasswordInput: Locator;
  readonly lockButton: Locator;
  readonly errorMessage: Locator;
  readonly passwordStrength: Locator;
  readonly rememberDeviceCheckbox: Locator;
  readonly forgotPasswordLink: Locator;
  readonly biometricButton: Locator;

  constructor(page: Page) {
    this.page = page;

    // Lock screen elements
    this.lockScreen = page.locator('[data-testid="vault-lock"]');
    this.passwordInput = page.locator('[data-testid="password-input"]');
    this.unlockButton = page.locator('[data-testid="unlock-button"]');
    this.createVaultButton = page.locator('[data-testid="create-vault-button"]');
    this.confirmPasswordInput = page.locator('[data-testid="confirm-password-input"]');
    this.lockButton = page.locator('[data-testid="lock-button"]');
    this.errorMessage = page.locator('[data-testid="error-message"]');
    this.passwordStrength = page.locator('[data-testid="password-strength"]');
    this.rememberDeviceCheckbox = page.locator('[data-testid="remember-device"]');
    this.forgotPasswordLink = page.locator('[data-testid="forgot-password"]');
    this.biometricButton = page.locator('[data-testid="biometric-unlock"]');
  }

  /**
   * Navigate to the vault page
   */
  async goto() {
    await this.page.goto('/');
  }

  /**
   * Check if vault is locked
   */
  async isLocked(): Promise<boolean> {
    return await this.lockScreen.isVisible({ timeout: 1000 }).catch(() => false);
  }

  /**
   * Unlock the vault with master password
   */
  async unlock(password: string) {
    await this.passwordInput.fill(password);
    await this.unlockButton.click();
  }

  /**
   * Attempt to unlock and expect success
   */
  async unlockExpectSuccess(password: string) {
    await this.unlock(password);
    await expect(this.lockScreen).not.toBeVisible({ timeout: 5000 });
  }

  /**
   * Attempt to unlock and expect failure
   */
  async unlockExpectFailure(password: string) {
    await this.unlock(password);
    await expect(this.errorMessage).toBeVisible();
  }

  /**
   * Create a new vault with master password
   */
  async createVault(password: string) {
    if (await this.createVaultButton.isVisible()) {
      await this.createVaultButton.click();
    }
    await this.passwordInput.fill(password);
    await this.confirmPasswordInput.fill(password);
    await this.createVaultButton.click();
  }

  /**
   * Lock the vault
   */
  async lock() {
    await this.lockButton.click();
    await expect(this.lockScreen).toBeVisible();
  }

  /**
   * Check password strength indicator
   */
  async getPasswordStrength(): Promise<string> {
    return await this.passwordStrength.textContent() || '';
  }

  /**
   * Enable remember device option
   */
  async enableRememberDevice() {
    await this.rememberDeviceCheckbox.check();
  }

  /**
   * Disable remember device option
   */
  async disableRememberDevice() {
    await this.rememberDeviceCheckbox.uncheck();
  }

  /**
   * Check if biometric unlock is available
   */
  async isBiometricAvailable(): Promise<boolean> {
    return await this.biometricButton.isVisible({ timeout: 1000 }).catch(() => false);
  }

  /**
   * Attempt biometric unlock
   */
  async unlockWithBiometric() {
    await this.biometricButton.click();
  }

  /**
   * Get error message text
   */
  async getErrorMessage(): Promise<string> {
    return await this.errorMessage.textContent() || '';
  }

  /**
   * Clear password input
   */
  async clearPassword() {
    await this.passwordInput.clear();
  }

  /**
   * Type password with delay (for realistic testing)
   */
  async typePassword(password: string, delay = 50) {
    await this.passwordInput.pressSequentially(password, { delay });
  }
}
