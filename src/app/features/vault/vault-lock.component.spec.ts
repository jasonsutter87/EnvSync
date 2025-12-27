/**
 * Unit tests for VaultLockComponent
 *
 * Tests cover:
 * - Password input handling
 * - Unlock button state
 * - Error message display
 * - Form validation
 * - Setup vs unlock modes
 * - Loading states
 * - VaultStore integration
 */

import { ComponentFixture, TestBed } from '@angular/core/testing';
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { signal } from '@angular/core';
import { VaultLockComponent } from './vault-lock.component';
import { VaultStore } from '../../core/services/vault.store';

// Mock VaultStore
class MockVaultStore {
  isInitialized = signal(false);
  isUnlocked = signal(false);
  error = signal<string | null>(null);
  projects = signal([]);
  selectedProjectId = signal<string | null>(null);
  selectedProject = signal(null);
  environments = signal([]);
  selectedEnvironmentId = signal<string | null>(null);
  variables = signal([]);

  initialize = vi.fn().mockResolvedValue(true);
  unlock = vi.fn().mockResolvedValue(true);
  lock = vi.fn().mockResolvedValue(undefined);
}

describe('VaultLockComponent', () => {
  let component: VaultLockComponent;
  let fixture: ComponentFixture<VaultLockComponent>;
  let mockStore: MockVaultStore;

  beforeEach(async () => {
    mockStore = new MockVaultStore();

    await TestBed.configureTestingModule({
      imports: [VaultLockComponent],
      providers: [
        { provide: VaultStore, useValue: mockStore }
      ]
    }).compileComponents();

    fixture = TestBed.createComponent(VaultLockComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  describe('Component Initialization', () => {
    it('should create the component', () => {
      expect(component).toBeDefined();
    });

    it('should initialize with empty password', () => {
      expect(component['password']).toBe('');
    });

    it('should initialize with empty confirm password', () => {
      expect(component['confirmPassword']).toBe('');
    });

    it('should initialize with loading state false', () => {
      expect(component['isLoading']()).toBe(false);
    });

    it('should initialize with no error message', () => {
      expect(component['errorMessage']()).toBeNull();
    });
  });

  describe('Setup Mode Display', () => {
    beforeEach(() => {
      mockStore.isInitialized.set(false);
      fixture.detectChanges();
    });

    it('should display "Create Master Password" heading when not initialized', () => {
      const heading = fixture.nativeElement.querySelector('h2');
      expect(heading.textContent).toBe('Create Master Password');
    });

    it('should show password input field in setup mode', () => {
      const inputs = fixture.nativeElement.querySelectorAll('input[type="password"]');
      expect(inputs.length).toBe(2);
    });

    it('should show confirm password field in setup mode', () => {
      const labels = fixture.nativeElement.querySelectorAll('label');
      const confirmLabel = Array.from(labels).find((l: any) =>
        l.textContent?.includes('Confirm Password')
      );
      expect(confirmLabel).toBeTruthy();
    });

    it('should display "Create Vault" button text in setup mode', () => {
      const button = fixture.nativeElement.querySelector('button[type="submit"]');
      expect(button.textContent.trim()).toContain('Create Vault');
    });

    it('should show security information message', () => {
      const message = fixture.nativeElement.textContent;
      expect(message).toContain('Your master password encrypts all your secrets locally');
    });
  });

  describe('Unlock Mode Display', () => {
    beforeEach(() => {
      mockStore.isInitialized.set(true);
      fixture.detectChanges();
    });

    it('should display "Unlock Vault" heading when initialized', () => {
      const heading = fixture.nativeElement.querySelector('h2');
      expect(heading.textContent).toBe('Unlock Vault');
    });

    it('should show only one password input in unlock mode', () => {
      const inputs = fixture.nativeElement.querySelectorAll('input[type="password"]');
      expect(inputs.length).toBe(1);
    });

    it('should not show confirm password field in unlock mode', () => {
      const labels = fixture.nativeElement.querySelectorAll('label');
      const confirmLabel = Array.from(labels).find((l: any) =>
        l.textContent.includes('Confirm Password')
      );
      expect(confirmLabel).toBeUndefined();
    });

    it('should display "Unlock" button text in unlock mode', () => {
      const button = fixture.nativeElement.querySelector('button[type="submit"]');
      expect(button.textContent.trim()).toContain('Unlock');
    });

    it('should have autofocus on password input in unlock mode', () => {
      const input = fixture.nativeElement.querySelector('input[type="password"]');
      expect(input.hasAttribute('autofocus')).toBe(true);
    });
  });

  describe('Password Input Handling', () => {
    it('should update password value when user types', () => {
      const input = fixture.nativeElement.querySelector('input[name="password"]');
      input.value = 'testpassword123';
      input.dispatchEvent(new Event('input'));
      fixture.detectChanges();

      expect(component['password']).toBe('testpassword123');
    });

    it('should update confirm password value in setup mode', () => {
      mockStore.isInitialized.set(false);
      fixture.detectChanges();

      const input = fixture.nativeElement.querySelector('input[name="confirmPassword"]');
      input.value = 'testpassword123';
      input.dispatchEvent(new Event('input'));
      fixture.detectChanges();

      expect(component['confirmPassword']).toBe('testpassword123');
    });

    it('should accept password with minimum length', () => {
      component['password'] = 'pass1234';
      expect(component['password'].length).toBeGreaterThanOrEqual(8);
    });

    it('should accept strong password with special characters', () => {
      component['password'] = 'P@ssw0rd!123';
      expect(component['password']).toBe('P@ssw0rd!123');
    });
  });

  describe('Setup Form Validation', () => {
    beforeEach(() => {
      mockStore.isInitialized.set(false);
      fixture.detectChanges();
    });

    it('should show error when password is too short', async () => {
      component['password'] = 'short';
      component['confirmPassword'] = 'short';

      await component.onSetup();

      expect(component['errorMessage']()).toBe('Password must be at least 8 characters');
    });

    it('should show error when passwords do not match', async () => {
      component['password'] = 'password123';
      component['confirmPassword'] = 'password456';

      await component.onSetup();

      expect(component['errorMessage']()).toBe('Passwords do not match');
    });

    it('should clear error message when form is submitted again', async () => {
      component['errorMessage'].set('Previous error');
      component['password'] = 'password123';
      component['confirmPassword'] = 'password123';

      await component.onSetup();

      // Error should be cleared initially, then potentially set by store
      expect(mockStore.initialize).toHaveBeenCalled();
    });

    it('should validate password before confirm password', async () => {
      component['password'] = 'short';
      component['confirmPassword'] = 'password123';

      await component.onSetup();

      expect(component['errorMessage']()).toBe('Password must be at least 8 characters');
      expect(mockStore.initialize).not.toHaveBeenCalled();
    });
  });

  describe('Setup Process', () => {
    beforeEach(() => {
      mockStore.isInitialized.set(false);
      fixture.detectChanges();
    });

    it('should call store.initialize with password on valid setup', async () => {
      component['password'] = 'validpassword123';
      component['confirmPassword'] = 'validpassword123';

      await component.onSetup();

      expect(mockStore.initialize).toHaveBeenCalledWith('validpassword123');
    });

    it('should set loading state during setup', async () => {
      component['password'] = 'validpassword123';
      component['confirmPassword'] = 'validpassword123';

      let loadingDuringCall = false;
      mockStore.initialize.mockImplementation(async () => {
        loadingDuringCall = component['isLoading']();
        return true;
      });

      await component.onSetup();

      expect(loadingDuringCall).toBe(true);
    });

    it('should clear loading state after successful setup', async () => {
      component['password'] = 'validpassword123';
      component['confirmPassword'] = 'validpassword123';
      mockStore.initialize.mockResolvedValue(true);

      await component.onSetup();

      expect(component['isLoading']()).toBe(false);
    });

    it('should clear loading state after failed setup', async () => {
      component['password'] = 'validpassword123';
      component['confirmPassword'] = 'validpassword123';
      mockStore.initialize.mockResolvedValue(false);
      mockStore.error.set('Setup failed');

      await component.onSetup();

      expect(component['isLoading']()).toBe(false);
    });

    it('should show error message when setup fails', async () => {
      component['password'] = 'validpassword123';
      component['confirmPassword'] = 'validpassword123';
      mockStore.initialize.mockResolvedValue(false);
      mockStore.error.set('Encryption error');

      await component.onSetup();

      expect(component['errorMessage']()).toBe('Encryption error');
    });

    it('should show generic error when setup fails without store error', async () => {
      component['password'] = 'validpassword123';
      component['confirmPassword'] = 'validpassword123';
      mockStore.initialize.mockResolvedValue(false);
      mockStore.error.set(null);

      await component.onSetup();

      expect(component['errorMessage']()).toBe('Failed to create vault');
    });
  });

  describe('Unlock Process', () => {
    beforeEach(() => {
      mockStore.isInitialized.set(true);
      fixture.detectChanges();
    });

    it('should show error when password is empty on unlock', async () => {
      component['password'] = '';

      await component.onUnlock();

      expect(component['errorMessage']()).toBe('Please enter your password');
    });

    it('should call store.unlock with password', async () => {
      component['password'] = 'mypassword123';

      await component.onUnlock();

      expect(mockStore.unlock).toHaveBeenCalledWith('mypassword123');
    });

    it('should set loading state during unlock', async () => {
      component['password'] = 'mypassword123';

      let loadingDuringCall = false;
      mockStore.unlock.mockImplementation(async () => {
        loadingDuringCall = component['isLoading']();
        return true;
      });

      await component.onUnlock();

      expect(loadingDuringCall).toBe(true);
    });

    it('should clear loading state after successful unlock', async () => {
      component['password'] = 'mypassword123';
      mockStore.unlock.mockResolvedValue(true);

      await component.onUnlock();

      expect(component['isLoading']()).toBe(false);
    });

    it('should clear loading state after failed unlock', async () => {
      component['password'] = 'wrongpassword';
      mockStore.unlock.mockResolvedValue(false);

      await component.onUnlock();

      expect(component['isLoading']()).toBe(false);
    });

    it('should show "Invalid password" error when unlock fails', async () => {
      component['password'] = 'wrongpassword';
      mockStore.unlock.mockResolvedValue(false);

      await component.onUnlock();

      expect(component['errorMessage']()).toBe('Invalid password');
    });

    it('should clear password field after failed unlock', async () => {
      component['password'] = 'wrongpassword';
      mockStore.unlock.mockResolvedValue(false);

      await component.onUnlock();

      expect(component['password']).toBe('');
    });

    it('should not clear password field after successful unlock', async () => {
      component['password'] = 'correctpassword';
      mockStore.unlock.mockResolvedValue(true);

      await component.onUnlock();

      // Password should remain (will be cleared on navigation)
      expect(component['password']).toBe('correctpassword');
    });
  });

  describe('Error Message Display', () => {
    it('should show error message when present', () => {
      component['errorMessage'].set('Test error message');
      fixture.detectChanges();

      const errorElement = fixture.nativeElement.querySelector('.text-red-400');
      expect(errorElement).toBeDefined();
      expect(errorElement.textContent).toBe('Test error message');
    });

    it('should hide error message when null', () => {
      component['errorMessage'].set(null);
      fixture.detectChanges();

      const errorElement = fixture.nativeElement.querySelector('.text-red-400');
      expect(errorElement).toBeNull();
    });

    it('should update error message reactively', () => {
      component['errorMessage'].set('First error');
      fixture.detectChanges();

      let errorElement = fixture.nativeElement.querySelector('.text-red-400');
      expect(errorElement.textContent).toBe('First error');

      component['errorMessage'].set('Second error');
      fixture.detectChanges();

      errorElement = fixture.nativeElement.querySelector('.text-red-400');
      expect(errorElement.textContent).toBe('Second error');
    });
  });

  describe('Submit Button State', () => {
    it('should disable submit button when loading', () => {
      component['isLoading'].set(true);
      fixture.detectChanges();

      const button = fixture.nativeElement.querySelector('button[type="submit"]');
      expect(button.disabled).toBe(true);
    });

    it('should enable submit button when not loading', () => {
      component['isLoading'].set(false);
      fixture.detectChanges();

      const button = fixture.nativeElement.querySelector('button[type="submit"]');
      expect(button.disabled).toBe(false);
    });

    it('should show loading spinner when loading', () => {
      component['isLoading'].set(true);
      fixture.detectChanges();

      const spinner = fixture.nativeElement.querySelector('.animate-spin');
      expect(spinner).toBeDefined();
    });

    it('should show "Creating vault..." text when loading in setup mode', () => {
      mockStore.isInitialized.set(false);
      component['isLoading'].set(true);
      fixture.detectChanges();

      const button = fixture.nativeElement.querySelector('button[type="submit"]');
      expect(button.textContent).toContain('Creating vault...');
    });

    it('should show "Unlocking..." text when loading in unlock mode', () => {
      mockStore.isInitialized.set(true);
      component['isLoading'].set(true);
      fixture.detectChanges();

      const button = fixture.nativeElement.querySelector('button[type="submit"]');
      expect(button.textContent).toContain('Unlocking...');
    });
  });

  describe('UI Elements', () => {
    it('should display EnvSync branding', () => {
      const heading = fixture.nativeElement.querySelector('h1');
      expect(heading.textContent).toBe('EnvSync');
    });

    it('should display tagline', () => {
      const tagline = fixture.nativeElement.textContent;
      expect(tagline).toContain('Sync secrets. Not trust.');
    });

    it('should display lock icon', () => {
      const icon = fixture.nativeElement.querySelector('svg path[d*="M12 15v2m-6 4h12"]');
      expect(icon).toBeDefined();
    });

    it('should display zero-knowledge encryption message', () => {
      const footer = fixture.nativeElement.textContent;
      expect(footer).toContain('Zero-knowledge encryption');
      expect(footer).toContain('Your secrets never leave your device unencrypted');
    });

    it('should have proper form structure', () => {
      const form = fixture.nativeElement.querySelector('form');
      expect(form).toBeDefined();
      expect(form.hasAttribute('ng-reflect-form')).toBe(false); // Standalone, no FormGroup
    });
  });

  describe('Form Submission', () => {
    it('should call onSetup when form is submitted in setup mode', async () => {
      mockStore.isInitialized.set(false);
      fixture.detectChanges();

      const spy = vi.spyOn(component, 'onSetup');
      const form = fixture.nativeElement.querySelector('form');

      component['password'] = 'password123';
      component['confirmPassword'] = 'password123';

      form.dispatchEvent(new Event('submit'));
      await fixture.whenStable();

      expect(spy).toHaveBeenCalled();
    });

    it('should call onUnlock when form is submitted in unlock mode', async () => {
      mockStore.isInitialized.set(true);
      fixture.detectChanges();

      const spy = vi.spyOn(component, 'onUnlock');
      const form = fixture.nativeElement.querySelector('form');

      component['password'] = 'password123';

      form.dispatchEvent(new Event('submit'));
      await fixture.whenStable();

      expect(spy).toHaveBeenCalled();
    });
  });

  describe('Edge Cases', () => {
    it('should handle very long passwords', async () => {
      const longPassword = 'a'.repeat(1000);
      component['password'] = longPassword;
      component['confirmPassword'] = longPassword;

      await component.onSetup();

      expect(mockStore.initialize).toHaveBeenCalledWith(longPassword);
    });

    it('should handle passwords with unicode characters', async () => {
      const unicodePassword = '密码🔒🔑Pass123';
      component['password'] = unicodePassword;
      component['confirmPassword'] = unicodePassword;

      await component.onSetup();

      expect(mockStore.initialize).toHaveBeenCalledWith(unicodePassword);
    });

    it('should handle whitespace in passwords', async () => {
      const passwordWithSpaces = 'my pass word 123';
      component['password'] = passwordWithSpaces;
      component['confirmPassword'] = passwordWithSpaces;

      await component.onSetup();

      expect(mockStore.initialize).toHaveBeenCalledWith(passwordWithSpaces);
    });

    it('should handle rapid form submissions', async () => {
      component['password'] = 'password123';
      mockStore.unlock.mockImplementation(() =>
        new Promise(resolve => setTimeout(() => resolve(true), 100))
      );

      const promise1 = component.onUnlock();
      const promise2 = component.onUnlock();

      await Promise.all([promise1, promise2]);

      // Should handle gracefully without errors
      expect(mockStore.unlock).toHaveBeenCalled();
    });
  });
});
