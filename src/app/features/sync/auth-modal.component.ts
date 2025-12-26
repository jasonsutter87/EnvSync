import { Component, inject, signal, output } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { SyncService } from '../../core/services/sync.service';

type AuthMode = 'login' | 'signup';

@Component({
  selector: 'app-auth-modal',
  standalone: true,
  imports: [FormsModule],
  template: `
    <div class="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
      <div class="card p-6 w-full max-w-md mx-4">
        <div class="flex items-center justify-between mb-6">
          <h2 class="text-xl font-semibold text-white">
            {{ mode() === 'login' ? 'Sign In to VeilCloud' : 'Create VeilCloud Account' }}
          </h2>
          <button
            (click)="close.emit()"
            class="p-1.5 rounded text-dark-400 hover:text-white hover:bg-dark-700"
          >
            <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        <form (ngSubmit)="onSubmit()">
          <div class="space-y-4">
            @if (mode() === 'signup') {
              <div>
                <label class="block text-sm font-medium text-dark-300 mb-1">Name (optional)</label>
                <input
                  type="text"
                  [(ngModel)]="name"
                  name="name"
                  class="input"
                  placeholder="Your name"
                />
              </div>
            }

            <div>
              <label class="block text-sm font-medium text-dark-300 mb-1">Email</label>
              <input
                type="email"
                [(ngModel)]="email"
                name="email"
                class="input"
                placeholder="you@example.com"
                required
                autofocus
              />
            </div>

            <div>
              <label class="block text-sm font-medium text-dark-300 mb-1">Password</label>
              <input
                type="password"
                [(ngModel)]="password"
                name="password"
                class="input"
                placeholder="Enter your password"
                required
                minlength="8"
              />
            </div>

            @if (mode() === 'signup') {
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
            }

            @if (errorMessage()) {
              <p class="text-red-400 text-sm">{{ errorMessage() }}</p>
            }
          </div>

          <div class="mt-6">
            <button
              type="submit"
              [disabled]="syncService.isLoading()"
              class="btn btn-primary w-full"
            >
              @if (syncService.isLoading()) {
                <svg class="animate-spin -ml-1 mr-2 h-4 w-4" fill="none" viewBox="0 0 24 24">
                  <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle>
                  <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                </svg>
                {{ mode() === 'login' ? 'Signing in...' : 'Creating account...' }}
              } @else {
                {{ mode() === 'login' ? 'Sign In' : 'Create Account' }}
              }
            </button>
          </div>
        </form>

        <div class="mt-4 text-center">
          @if (mode() === 'login') {
            <p class="text-dark-400 text-sm">
              Don't have an account?
              <button
                (click)="mode.set('signup')"
                class="text-primary-400 hover:text-primary-300"
              >
                Sign up
              </button>
            </p>
          } @else {
            <p class="text-dark-400 text-sm">
              Already have an account?
              <button
                (click)="mode.set('login')"
                class="text-primary-400 hover:text-primary-300"
              >
                Sign in
              </button>
            </p>
          }
        </div>

        <p class="text-center text-dark-500 text-xs mt-6">
          Your vault password encrypts data before syncing.
          VeilCloud never sees your secrets.
        </p>
      </div>
    </div>
  `,
})
export class AuthModalComponent {
  protected readonly syncService = inject(SyncService);

  readonly close = output<void>();

  protected mode = signal<AuthMode>('login');
  protected name = '';
  protected email = '';
  protected password = '';
  protected confirmPassword = '';
  protected errorMessage = signal<string | null>(null);

  async onSubmit(): Promise<void> {
    this.errorMessage.set(null);

    if (!this.email || !this.password) {
      this.errorMessage.set('Please fill in all required fields');
      return;
    }

    if (this.mode() === 'signup') {
      if (this.password.length < 8) {
        this.errorMessage.set('Password must be at least 8 characters');
        return;
      }
      if (this.password !== this.confirmPassword) {
        this.errorMessage.set('Passwords do not match');
        return;
      }

      try {
        await this.syncService.signup(this.email, this.password, this.name || undefined);
        this.close.emit();
      } catch (e) {
        this.errorMessage.set(e instanceof Error ? e.message : 'Failed to create account');
      }
    } else {
      try {
        await this.syncService.login(this.email, this.password);
        this.close.emit();
      } catch (e) {
        this.errorMessage.set(e instanceof Error ? e.message : 'Invalid credentials');
      }
    }
  }
}
