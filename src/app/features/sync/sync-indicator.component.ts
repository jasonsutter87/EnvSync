import { Component, inject, signal } from '@angular/core';
import { DatePipe } from '@angular/common';
import { SyncService } from '../../core/services/sync.service';
import { AuthModalComponent } from './auth-modal.component';
import { getSyncStateLabel } from '../../core/models';

@Component({
  selector: 'app-sync-indicator',
  standalone: true,
  imports: [DatePipe, AuthModalComponent],
  template: `
    <div class="relative">
      <button
        (click)="toggleDropdown()"
        class="flex items-center space-x-2 px-3 py-1.5 rounded-md text-sm transition-colors"
        [class.bg-dark-700]="isDropdownOpen()"
        [class.hover:bg-dark-700]="!isDropdownOpen()"
      >
        <!-- Sync status icon -->
        @if (syncService.isSyncing()) {
          <svg class="w-4 h-4 text-primary-400 animate-spin" fill="none" viewBox="0 0 24 24">
            <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle>
            <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
          </svg>
        } @else if (syncService.hasConflicts()) {
          <svg class="w-4 h-4 text-yellow-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
          </svg>
        } @else if (syncService.hasError()) {
          <svg class="w-4 h-4 text-red-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
        } @else if (syncService.isConnected()) {
          <svg class="w-4 h-4 text-green-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 13l4 4L19 7" />
          </svg>
        } @else {
          <svg class="w-4 h-4 text-dark-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M8 7h12m0 0l-4-4m4 4l-4 4m0 6H4m0 0l4 4m-4-4l4-4" />
          </svg>
        }

        <!-- Status text -->
        @if (syncService.isConnected()) {
          <span class="text-dark-300">{{ syncService.user()?.email }}</span>
        } @else {
          <span class="text-dark-400">Not synced</span>
        }
      </button>

      <!-- Dropdown -->
      @if (isDropdownOpen()) {
        <div class="absolute right-0 top-full mt-1 w-72 bg-dark-800 rounded-lg shadow-xl border border-dark-700 z-50">
          <div class="p-4">
            @if (syncService.isConnected()) {
              <!-- Connected state -->
              <div class="flex items-center justify-between mb-4">
                <div>
                  <p class="text-white font-medium">{{ syncService.user()?.name || syncService.user()?.email }}</p>
                  @if (syncService.user()?.name) {
                    <p class="text-dark-400 text-sm">{{ syncService.user()?.email }}</p>
                  }
                </div>
                <span class="px-2 py-1 text-xs rounded bg-green-500/20 text-green-400">Connected</span>
              </div>

              <!-- Sync status -->
              <div class="border-t border-dark-700 pt-4 space-y-3">
                @if (syncService.lastSync()) {
                  <div class="flex items-center justify-between text-sm">
                    <span class="text-dark-400">Last sync</span>
                    <span class="text-dark-300">{{ syncService.lastSync() | date:'short' }}</span>
                  </div>
                }

                @if (syncService.pendingChanges() > 0) {
                  <div class="flex items-center justify-between text-sm">
                    <span class="text-dark-400">Pending changes</span>
                    <span class="text-yellow-400">{{ syncService.pendingChanges() }}</span>
                  </div>
                }

                @if (syncService.hasConflicts()) {
                  <div class="p-2 bg-yellow-500/10 rounded text-yellow-400 text-sm">
                    <p class="font-medium">Sync conflicts detected</p>
                    <p class="text-yellow-500 text-xs mt-1">Review and resolve before syncing</p>
                  </div>
                }

                @if (syncService.hasError()) {
                  <div class="p-2 bg-red-500/10 rounded text-red-400 text-sm">
                    <p class="font-medium">Sync error</p>
                    <p class="text-red-500 text-xs mt-1">{{ getSyncStateLabel(syncService.status().state) }}</p>
                  </div>
                }

                <button
                  (click)="onSync()"
                  [disabled]="syncService.isSyncing()"
                  class="btn btn-primary w-full text-sm"
                >
                  @if (syncService.isSyncing()) {
                    <svg class="animate-spin -ml-1 mr-2 h-4 w-4" fill="none" viewBox="0 0 24 24">
                      <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle>
                      <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                    </svg>
                    Syncing...
                  } @else {
                    <svg class="w-4 h-4 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                    </svg>
                    Sync Now
                  }
                </button>
              </div>

              <!-- Logout -->
              <div class="border-t border-dark-700 pt-4 mt-4">
                <button
                  (click)="onLogout()"
                  class="text-dark-400 hover:text-red-400 text-sm"
                >
                  Sign out
                </button>
              </div>
            } @else {
              <!-- Disconnected state -->
              <div class="text-center">
                <svg class="w-12 h-12 mx-auto text-dark-600 mb-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
                </svg>
                <h3 class="text-white font-medium mb-1">Cloud Sync</h3>
                <p class="text-dark-400 text-sm mb-4">
                  Securely sync your encrypted secrets across devices with VeilCloud
                </p>
                <button
                  (click)="showAuthModal.set(true)"
                  class="btn btn-primary w-full"
                >
                  Sign In or Create Account
                </button>
              </div>
            }
          </div>
        </div>
      }
    </div>

    <!-- Auth Modal -->
    @if (showAuthModal()) {
      <app-auth-modal (close)="showAuthModal.set(false)" />
    }

    <!-- Click outside to close dropdown -->
    @if (isDropdownOpen()) {
      <div
        class="fixed inset-0 z-40"
        (click)="isDropdownOpen.set(false)"
      ></div>
    }
  `,
})
export class SyncIndicatorComponent {
  protected readonly syncService = inject(SyncService);

  protected isDropdownOpen = signal(false);
  protected showAuthModal = signal(false);
  protected getSyncStateLabel = getSyncStateLabel;

  toggleDropdown(): void {
    this.isDropdownOpen.update((v) => !v);
  }

  async onSync(): Promise<void> {
    try {
      await this.syncService.sync();
    } catch (e) {
      console.error('Sync failed:', e);
    }
  }

  async onLogout(): Promise<void> {
    await this.syncService.logout();
    this.isDropdownOpen.set(false);
  }
}
