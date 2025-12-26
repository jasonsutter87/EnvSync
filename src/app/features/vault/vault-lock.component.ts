import { Component, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { VaultStore } from '../../core/services/vault.store';

@Component({
  selector: 'app-vault-lock',
  standalone: true,
  imports: [FormsModule],
  template: `
    <div class="min-h-screen flex items-center justify-center bg-dark-900 p-4">
      <div class="w-full max-w-md">
        <div class="text-center mb-8">
          <div class="inline-flex items-center justify-center w-16 h-16 rounded-full bg-primary-600/20 mb-4">
            <svg class="w-8 h-8 text-primary-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2"
                d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
            </svg>
          </div>
          <h1 class="text-3xl font-bold text-white mb-2">EnvSync</h1>
          <p class="text-dark-400">Sync secrets. Not trust.</p>
        </div>

        <div class="card p-6">
          @if (!store.isInitialized()) {
            <h2 class="text-xl font-semibold text-white mb-4">Create Master Password</h2>
            <p class="text-dark-400 text-sm mb-6">
              Your master password encrypts all your secrets locally.
              Choose a strong password - if you forget it, your data cannot be recovered.
            </p>

            <form (ngSubmit)="onSetup()" class="space-y-4">
              <div>
                <label class="block text-sm font-medium text-dark-300 mb-1">Master Password</label>
                <input
                  type="password"
                  [(ngModel)]="password"
                  name="password"
                  class="input"
                  placeholder="Enter a strong password"
                  required
                  minlength="8"
                />
              </div>

              <div>
                <label class="block text-sm font-medium text-dark-300 mb-1">Confirm Password</label>
                <input
                  type="password"
                  [(ngModel)]="confirmPassword"
                  name="confirmPassword"
                  class="input"
                  placeholder="Confirm your password"
                  required
                />
              </div>

              @if (errorMessage()) {
                <p class="text-red-400 text-sm">{{ errorMessage() }}</p>
              }

              <button
                type="submit"
                [disabled]="isLoading()"
                class="btn btn-primary w-full"
              >
                @if (isLoading()) {
                  <svg class="animate-spin -ml-1 mr-2 h-4 w-4" fill="none" viewBox="0 0 24 24">
                    <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle>
                    <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                  </svg>
                  Creating vault...
                } @else {
                  Create Vault
                }
              </button>
            </form>
          } @else {
            <h2 class="text-xl font-semibold text-white mb-4">Unlock Vault</h2>
            <p class="text-dark-400 text-sm mb-6">
              Enter your master password to unlock your secrets.
            </p>

            <form (ngSubmit)="onUnlock()" class="space-y-4">
              <div>
                <label class="block text-sm font-medium text-dark-300 mb-1">Master Password</label>
                <input
                  type="password"
                  [(ngModel)]="password"
                  name="password"
                  class="input"
                  placeholder="Enter your master password"
                  required
                  autofocus
                />
              </div>

              @if (errorMessage()) {
                <p class="text-red-400 text-sm">{{ errorMessage() }}</p>
              }

              <button
                type="submit"
                [disabled]="isLoading()"
                class="btn btn-primary w-full"
              >
                @if (isLoading()) {
                  <svg class="animate-spin -ml-1 mr-2 h-4 w-4" fill="none" viewBox="0 0 24 24">
                    <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle>
                    <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                  </svg>
                  Unlocking...
                } @else {
                  Unlock
                }
              </button>
            </form>
          }
        </div>

        <p class="text-center text-dark-500 text-xs mt-6">
          Zero-knowledge encryption. Your secrets never leave your device unencrypted.
        </p>
      </div>
    </div>
  `,
})
export class VaultLockComponent {
  protected readonly store = inject(VaultStore);

  protected password = '';
  protected confirmPassword = '';
  protected isLoading = signal(false);
  protected errorMessage = signal<string | null>(null);

  async onSetup(): Promise<void> {
    this.errorMessage.set(null);

    if (this.password.length < 8) {
      this.errorMessage.set('Password must be at least 8 characters');
      return;
    }

    if (this.password !== this.confirmPassword) {
      this.errorMessage.set('Passwords do not match');
      return;
    }

    this.isLoading.set(true);
    const success = await this.store.initialize(this.password);
    this.isLoading.set(false);

    if (!success) {
      this.errorMessage.set(this.store.error() ?? 'Failed to create vault');
    }
  }

  async onUnlock(): Promise<void> {
    this.errorMessage.set(null);

    if (!this.password) {
      this.errorMessage.set('Please enter your password');
      return;
    }

    this.isLoading.set(true);
    const success = await this.store.unlock(this.password);
    this.isLoading.set(false);

    if (!success) {
      this.errorMessage.set('Invalid password');
      this.password = '';
    }
  }
}
