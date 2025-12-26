import { Component, inject, OnInit } from '@angular/core';
import { VaultStore } from './core/services/vault.store';
import { VaultLockComponent } from './features/vault/vault-lock.component';
import { DashboardComponent } from './features/projects/dashboard.component';

@Component({
  selector: 'app-root',
  standalone: true,
  imports: [VaultLockComponent, DashboardComponent],
  template: `
    @if (store.isUnlocked()) {
      <app-dashboard />
    } @else {
      <app-vault-lock />
    }
  `,
  styleUrl: './app.scss',
})
export class App implements OnInit {
  protected readonly store = inject(VaultStore);

  async ngOnInit(): Promise<void> {
    await this.store.checkStatus();
  }
}
