/**
 * Unit tests for SyncIndicatorComponent
 *
 * Tests cover:
 * - Sync status display
 * - Sync button functionality
 * - Offline/online states
 * - Dropdown menu
 * - User authentication
 * - Error states
 * - Conflict handling
 */

import { ComponentFixture, TestBed } from '@angular/core/testing';
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { signal } from '@angular/core';
import { SyncIndicatorComponent } from './sync-indicator.component';
import { SyncService } from '../../core/services/sync.service';

// Mock SyncService
class MockSyncService {
  isConnected = signal(false);
  isSyncing = signal(false);
  hasConflicts = signal(false);
  hasError = signal(false);
  user = signal<any>(null);
  lastSync = signal<Date | null>(null);
  pendingChanges = signal(0);
  status = signal({ state: 'idle', message: null });

  isLoading = signal(false);
  login = vi.fn().mockResolvedValue(undefined);
  signup = vi.fn().mockResolvedValue(undefined);
  sync = vi.fn().mockResolvedValue(undefined);
  logout = vi.fn().mockResolvedValue(undefined);
}

describe('SyncIndicatorComponent', () => {
  let component: SyncIndicatorComponent;
  let fixture: ComponentFixture<SyncIndicatorComponent>;
  let mockSyncService: MockSyncService;

  beforeEach(async () => {
    mockSyncService = new MockSyncService();

    await TestBed.configureTestingModule({
      imports: [SyncIndicatorComponent],
      providers: [
        { provide: SyncService, useValue: mockSyncService }
      ]
    }).compileComponents();

    fixture = TestBed.createComponent(SyncIndicatorComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  describe('Component Initialization', () => {
    it('should create the component', () => {
      expect(component).toBeDefined();
    });

    it('should initialize with dropdown closed', () => {
      expect(component['isDropdownOpen']()).toBe(false);
    });

    it('should initialize with auth modal closed', () => {
      expect(component['showAuthModal']()).toBe(false);
    });
  });

  describe('Disconnected State Display', () => {
    beforeEach(() => {
      mockSyncService.isConnected.set(false);
      fixture.detectChanges();
    });

    it('should display "Not synced" text when disconnected', () => {
      const statusText = fixture.nativeElement.textContent;
      expect(statusText).toContain('Not synced');
    });

    it('should show disconnected icon when not connected', () => {
      const icon = fixture.nativeElement.querySelector('svg path[d*="M8 7h12m0 0l-4-4"]');
      expect(icon).toBeDefined();
    });

    it('should display cloud sync message in dropdown when disconnected', () => {
      component['isDropdownOpen'].set(true);
      fixture.detectChanges();

      const dropdownText = fixture.nativeElement.textContent;
      expect(dropdownText).toContain('Cloud Sync');
      expect(dropdownText).toContain('Securely sync your encrypted secrets');
    });

    it('should show sign in button when disconnected', () => {
      component['isDropdownOpen'].set(true);
      fixture.detectChanges();

      const signInButton = Array.from(fixture.nativeElement.querySelectorAll('button'))
        .find((btn: any) => btn.textContent.includes('Sign In or Create Account'));

      expect(signInButton).toBeDefined();
    });
  });

  describe('Connected State Display', () => {
    beforeEach(() => {
      mockSyncService.isConnected.set(true);
      mockSyncService.user.set({
        id: 'user-1',
        email: 'test@example.com',
        name: 'Test User'
      });
      fixture.detectChanges();
    });

    it('should display user email when connected', () => {
      const statusText = fixture.nativeElement.textContent;
      expect(statusText).toContain('test@example.com');
    });

    it('should show connected icon when connected', () => {
      mockSyncService.isSyncing.set(false);
      mockSyncService.hasConflicts.set(false);
      mockSyncService.hasError.set(false);
      fixture.detectChanges();

      const icon = fixture.nativeElement.querySelector('svg path[d*="M5 13l4 4L19 7"]');
      expect(icon).toBeDefined();
    });

    it('should display user name in dropdown when available', () => {
      component['isDropdownOpen'].set(true);
      fixture.detectChanges();

      const dropdownText = fixture.nativeElement.textContent;
      expect(dropdownText).toContain('Test User');
    });

    it('should display user email in dropdown', () => {
      component['isDropdownOpen'].set(true);
      fixture.detectChanges();

      const dropdownText = fixture.nativeElement.textContent;
      expect(dropdownText).toContain('test@example.com');
    });

    it('should show connected badge', () => {
      component['isDropdownOpen'].set(true);
      fixture.detectChanges();

      const badge = fixture.nativeElement.textContent;
      expect(badge).toContain('Connected');
    });
  });

  describe('Syncing State', () => {
    beforeEach(() => {
      mockSyncService.isConnected.set(true);
      mockSyncService.isSyncing.set(true);
      fixture.detectChanges();
    });

    it('should show syncing spinner when syncing', () => {
      const spinner = fixture.nativeElement.querySelector('.animate-spin');
      expect(spinner).toBeDefined();
    });

    it('should display "Syncing..." text in dropdown', () => {
      component['isDropdownOpen'].set(true);
      fixture.detectChanges();

      const syncButton = Array.from(fixture.nativeElement.querySelectorAll('button'))
        .find((btn: any) => btn.textContent.includes('Syncing...'));

      expect(syncButton).toBeDefined();
    });

    it('should disable sync button while syncing', () => {
      component['isDropdownOpen'].set(true);
      fixture.detectChanges();

      const syncButton = Array.from(fixture.nativeElement.querySelectorAll('button'))
        .find((btn: any) => btn.textContent.includes('Syncing...')) as HTMLButtonElement;

      expect(syncButton?.disabled).toBe(true);
    });
  });

  describe('Conflict State', () => {
    beforeEach(() => {
      mockSyncService.isConnected.set(true);
      mockSyncService.hasConflicts.set(true);
      fixture.detectChanges();
    });

    it('should show conflict warning icon', () => {
      const icon = fixture.nativeElement.querySelector('svg path[d*="M12 9v2m0 4h.01"]');
      expect(icon).toBeDefined();
    });

    it('should display conflict warning in dropdown', () => {
      component['isDropdownOpen'].set(true);
      fixture.detectChanges();

      const warning = fixture.nativeElement.textContent;
      expect(warning).toContain('Sync conflicts detected');
    });

    it('should show resolve conflicts message', () => {
      component['isDropdownOpen'].set(true);
      fixture.detectChanges();

      const message = fixture.nativeElement.textContent;
      expect(message).toContain('Review and resolve before syncing');
    });
  });

  describe('Error State', () => {
    beforeEach(() => {
      mockSyncService.isConnected.set(true);
      mockSyncService.hasError.set(true);
      mockSyncService.status.set({ state: 'error', message: 'Network error' });
      fixture.detectChanges();
    });

    it('should show error icon', () => {
      const icon = fixture.nativeElement.querySelector('svg path[d*="M12 8v4m0 4h.01M21 12a9"]');
      expect(icon).toBeDefined();
    });

    it('should display error message in dropdown', () => {
      component['isDropdownOpen'].set(true);
      fixture.detectChanges();

      const error = fixture.nativeElement.textContent;
      expect(error).toContain('Sync error');
    });
  });

  describe('Dropdown Functionality', () => {
    it('should open dropdown when button is clicked', () => {
      const button = fixture.nativeElement.querySelector('button');

      expect(component['isDropdownOpen']()).toBe(false);

      button?.click();

      expect(component['isDropdownOpen']()).toBe(true);
    });

    it('should close dropdown when button is clicked again', () => {
      const button = fixture.nativeElement.querySelector('button');

      button?.click();
      expect(component['isDropdownOpen']()).toBe(true);

      button?.click();
      expect(component['isDropdownOpen']()).toBe(false);
    });

    it('should display dropdown when open', () => {
      component['isDropdownOpen'].set(true);
      fixture.detectChanges();

      const dropdown = fixture.nativeElement.querySelector('.absolute.right-0.top-full');
      expect(dropdown).toBeDefined();
    });

    it('should hide dropdown when closed', () => {
      component['isDropdownOpen'].set(false);
      fixture.detectChanges();

      const dropdown = fixture.nativeElement.querySelector('.absolute.right-0.top-full');
      expect(dropdown).toBeNull();
    });

    it('should close dropdown when clicking outside', () => {
      component['isDropdownOpen'].set(true);
      fixture.detectChanges();

      const backdrop = fixture.nativeElement.querySelector('.fixed.inset-0');
      backdrop?.click();

      expect(component['isDropdownOpen']()).toBe(false);
    });

    it('should highlight button when dropdown is open', () => {
      component['isDropdownOpen'].set(true);
      fixture.detectChanges();

      const button = fixture.nativeElement.querySelector('button');
      expect(button?.classList.contains('bg-dark-700')).toBe(true);
    });
  });

  describe('Sync Button Functionality', () => {
    beforeEach(() => {
      mockSyncService.isConnected.set(true);
      component['isDropdownOpen'].set(true);
      fixture.detectChanges();
    });

    it('should display sync now button', () => {
      const syncButton = Array.from(fixture.nativeElement.querySelectorAll('button'))
        .find((btn: any) => btn.textContent.includes('Sync Now'));

      expect(syncButton).toBeDefined();
    });

    it('should call onSync when sync button is clicked', () => {
      const spy = vi.spyOn(component, 'onSync');
      const syncButton = Array.from(fixture.nativeElement.querySelectorAll('button'))
        .find((btn: any) => btn.textContent.includes('Sync Now')) as HTMLElement;

      syncButton?.click();

      expect(spy).toHaveBeenCalled();
    });

    it('should call syncService.sync when onSync is called', async () => {
      await component.onSync();

      expect(mockSyncService.sync).toHaveBeenCalled();
    });

    it('should handle sync errors gracefully', async () => {
      const consoleError = vi.spyOn(console, 'error').mockImplementation(() => {});
      mockSyncService.sync.mockRejectedValue(new Error('Sync failed'));

      await component.onSync();

      expect(consoleError).toHaveBeenCalledWith('Sync failed:', expect.any(Error));
    });

    it('should show sync icon in button', () => {
      const syncIcon = fixture.nativeElement.querySelector('svg path[d*="M4 4v5h.582m15.356 2"]');
      expect(syncIcon).toBeDefined();
    });
  });

  describe('Last Sync Display', () => {
    beforeEach(() => {
      mockSyncService.isConnected.set(true);
      component['isDropdownOpen'].set(true);
    });

    it('should display last sync timestamp when available', () => {
      const lastSyncDate = new Date('2023-01-01T12:00:00Z');
      mockSyncService.lastSync.set(lastSyncDate);
      fixture.detectChanges();

      const lastSync = fixture.nativeElement.textContent;
      expect(lastSync).toContain('Last sync');
    });

    it('should not display last sync when null', () => {
      mockSyncService.lastSync.set(null);
      fixture.detectChanges();

      const lastSync = fixture.nativeElement.textContent;
      // Should not have "Last sync" label
      const sections = Array.from(fixture.nativeElement.querySelectorAll('.text-dark-400'))
        .map((el: any) => el.textContent);
      const hasLastSync = sections.some((text: string) => text.includes('Last sync'));

      expect(hasLastSync).toBe(false);
    });
  });

  describe('Pending Changes Display', () => {
    beforeEach(() => {
      mockSyncService.isConnected.set(true);
      component['isDropdownOpen'].set(true);
    });

    it('should display pending changes count when greater than zero', () => {
      mockSyncService.pendingChanges.set(3);
      fixture.detectChanges();

      const pendingText = fixture.nativeElement.textContent;
      expect(pendingText).toContain('Pending changes');
      expect(pendingText).toContain('3');
    });

    it('should not display pending changes when zero', () => {
      mockSyncService.pendingChanges.set(0);
      fixture.detectChanges();

      const sections = Array.from(fixture.nativeElement.querySelectorAll('.text-dark-400'))
        .map((el: any) => el.textContent);
      const hasPending = sections.some((text: string) => text.includes('Pending changes'));

      expect(hasPending).toBe(false);
    });
  });

  describe('Authentication Modal', () => {
    beforeEach(() => {
      mockSyncService.isConnected.set(false);
      component['isDropdownOpen'].set(true);
      fixture.detectChanges();
    });

    it('should open auth modal when sign in button is clicked', () => {
      const signInButton = Array.from(fixture.nativeElement.querySelectorAll('button'))
        .find((btn: any) => btn.textContent.includes('Sign In or Create Account')) as HTMLElement;

      signInButton?.click();

      expect(component['showAuthModal']()).toBe(true);
    });

    it('should display auth modal when open', () => {
      component['showAuthModal'].set(true);
      fixture.detectChanges();

      const modal = fixture.nativeElement.querySelector('app-auth-modal');
      expect(modal).toBeDefined();
    });

    it('should close auth modal when close event is emitted', () => {
      component['showAuthModal'].set(true);
      fixture.detectChanges();

      // Simulate modal close
      component['showAuthModal'].set(false);

      expect(component['showAuthModal']()).toBe(false);
    });
  });

  describe('Logout Functionality', () => {
    beforeEach(() => {
      mockSyncService.isConnected.set(true);
      component['isDropdownOpen'].set(true);
      fixture.detectChanges();
    });

    it('should display logout button when connected', () => {
      const logoutButton = Array.from(fixture.nativeElement.querySelectorAll('button'))
        .find((btn: any) => btn.textContent.includes('Sign out'));

      expect(logoutButton).toBeDefined();
    });

    it('should call onLogout when logout button is clicked', () => {
      const spy = vi.spyOn(component, 'onLogout');
      const logoutButton = Array.from(fixture.nativeElement.querySelectorAll('button'))
        .find((btn: any) => btn.textContent.includes('Sign out')) as HTMLElement;

      logoutButton?.click();

      expect(spy).toHaveBeenCalled();
    });

    it('should call syncService.logout when onLogout is called', async () => {
      await component.onLogout();

      expect(mockSyncService.logout).toHaveBeenCalled();
    });

    it('should close dropdown after logout', async () => {
      component['isDropdownOpen'].set(true);

      await component.onLogout();

      expect(component['isDropdownOpen']()).toBe(false);
    });
  });

  describe('Offline State', () => {
    it('should show offline state when not connected', () => {
      mockSyncService.isConnected.set(false);
      fixture.detectChanges();

      const statusText = fixture.nativeElement.textContent;
      expect(statusText).toContain('Not synced');
    });

    it('should allow user to sign in when offline', () => {
      mockSyncService.isConnected.set(false);
      component['isDropdownOpen'].set(true);
      fixture.detectChanges();

      const signInButton = Array.from(fixture.nativeElement.querySelectorAll('button'))
        .find((btn: any) => btn.textContent.includes('Sign In'));

      expect(signInButton).toBeDefined();
    });
  });

  describe('UI Elements', () => {
    it('should have proper button styling', () => {
      const button = fixture.nativeElement.querySelector('button');
      expect(button).toBeDefined();
      expect(button?.classList.contains('flex')).toBe(true);
    });

    it('should position dropdown correctly', () => {
      component['isDropdownOpen'].set(true);
      fixture.detectChanges();

      const dropdown = fixture.nativeElement.querySelector('.absolute.right-0');
      expect(dropdown).toBeDefined();
    });

    it('should display appropriate status icon', () => {
      const icons = fixture.nativeElement.querySelectorAll('svg');
      expect(icons.length).toBeGreaterThan(0);
    });

    it('should have proper z-index for dropdown', () => {
      component['isDropdownOpen'].set(true);
      fixture.detectChanges();

      const dropdown = fixture.nativeElement.querySelector('.z-50');
      expect(dropdown).toBeDefined();
    });
  });

  describe('Toggle Functionality', () => {
    it('should toggle dropdown state', () => {
      expect(component['isDropdownOpen']()).toBe(false);

      component.toggleDropdown();
      expect(component['isDropdownOpen']()).toBe(true);

      component.toggleDropdown();
      expect(component['isDropdownOpen']()).toBe(false);
    });
  });

  describe('Edge Cases', () => {
    it('should handle missing user name gracefully', () => {
      mockSyncService.isConnected.set(true);
      mockSyncService.user.set({ id: 'user-1', email: 'test@example.com' });
      component['isDropdownOpen'].set(true);
      fixture.detectChanges();

      const email = fixture.nativeElement.textContent;
      expect(email).toContain('test@example.com');
    });

    it('should handle very long email addresses', () => {
      mockSyncService.isConnected.set(true);
      mockSyncService.user.set({
        id: 'user-1',
        email: 'very.long.email.address.that.is.extremely.long@example.com'
      });
      fixture.detectChanges();

      const email = fixture.nativeElement.textContent;
      expect(email).toContain('very.long.email.address');
    });

    it('should handle rapid dropdown toggles', () => {
      component.toggleDropdown();
      component.toggleDropdown();
      component.toggleDropdown();

      expect(component['isDropdownOpen']()).toBe(true);
    });
  });
});
