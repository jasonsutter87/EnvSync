/**
 * EnvSync Admin Console Component
 * Enterprise admin dashboard for system management
 */
import { Component, OnInit, signal, computed } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { HttpClient, HttpHeaders } from '@angular/common/http';
import { environment } from '../../../environments/environment';

interface AdminStats {
  total_users: number;
  active_users: number;
  verified_users: number;
  admin_users: number;
  total_projects: number;
  total_environments: number;
  total_variables: number;
  total_teams: number;
  total_team_members: number;
  free_users: number;
  pro_users: number;
  team_users: number;
  enterprise_users: number;
  logins_today: number;
  logins_week: number;
  syncs_today: number;
  syncs_week: number;
  storage_used_bytes: number;
  storage_limit_bytes: number;
}

interface AdminUser {
  id: string;
  email: string;
  name: string | null;
  is_active: boolean;
  is_verified: boolean;
  is_admin: boolean;
  subscription_tier: string;
  subscription_expires: string | null;
  sso_provider: string | null;
  project_count: number;
  team_count: number;
  last_login_at: string | null;
  created_at: string;
}

interface AuditEntry {
  id: string;
  user_email: string;
  action: string;
  resource_type: string;
  resource_name: string | null;
  ip_address: string | null;
  severity: string;
  timestamp: string;
}

interface SystemHealth {
  status: string;
  database: boolean;
  redis: boolean;
  veilcloud: boolean;
  storage: boolean;
  last_check: string;
}

@Component({
  selector: 'app-admin-console',
  standalone: true,
  imports: [CommonModule, FormsModule],
  template: `
    <div class="min-h-screen bg-gray-900 text-white">
      <!-- Header -->
      <header class="bg-gray-800 border-b border-gray-700 px-6 py-4">
        <div class="flex items-center justify-between">
          <div>
            <h1 class="text-2xl font-bold">Admin Console</h1>
            <p class="text-gray-400 text-sm">EnvSync System Administration</p>
          </div>
          <div class="flex items-center gap-4">
            <span
              [class]="systemHealth()?.status === 'healthy' ? 'text-green-400' : 'text-yellow-400'"
              class="flex items-center gap-2"
            >
              <span class="w-2 h-2 rounded-full"
                    [class.bg-green-400]="systemHealth()?.status === 'healthy'"
                    [class.bg-yellow-400]="systemHealth()?.status !== 'healthy'">
              </span>
              {{ systemHealth()?.status || 'Loading...' }}
            </span>
          </div>
        </div>

        <!-- Tabs -->
        <nav class="flex gap-6 mt-4">
          @for (tab of tabs; track tab.id) {
            <button
              (click)="activeTab.set(tab.id)"
              [class]="activeTab() === tab.id
                ? 'text-blue-400 border-b-2 border-blue-400 pb-2'
                : 'text-gray-400 hover:text-white pb-2'"
            >
              {{ tab.label }}
            </button>
          }
        </nav>
      </header>

      <main class="p-6">
        <!-- Dashboard Tab -->
        @if (activeTab() === 'dashboard') {
          <div class="space-y-6">
            <!-- Stats Grid -->
            <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
              <div class="bg-gray-800 rounded-lg p-4">
                <div class="text-gray-400 text-sm">Total Users</div>
                <div class="text-3xl font-bold">{{ stats()?.total_users || 0 }}</div>
                <div class="text-green-400 text-sm">{{ stats()?.active_users || 0 }} active</div>
              </div>
              <div class="bg-gray-800 rounded-lg p-4">
                <div class="text-gray-400 text-sm">Total Projects</div>
                <div class="text-3xl font-bold">{{ stats()?.total_projects || 0 }}</div>
                <div class="text-gray-400 text-sm">{{ stats()?.total_variables || 0 }} variables</div>
              </div>
              <div class="bg-gray-800 rounded-lg p-4">
                <div class="text-gray-400 text-sm">Teams</div>
                <div class="text-3xl font-bold">{{ stats()?.total_teams || 0 }}</div>
                <div class="text-gray-400 text-sm">{{ stats()?.total_team_members || 0 }} members</div>
              </div>
              <div class="bg-gray-800 rounded-lg p-4">
                <div class="text-gray-400 text-sm">Logins Today</div>
                <div class="text-3xl font-bold">{{ stats()?.logins_today || 0 }}</div>
                <div class="text-gray-400 text-sm">{{ stats()?.syncs_today || 0 }} syncs</div>
              </div>
            </div>

            <!-- Subscription Breakdown -->
            <div class="bg-gray-800 rounded-lg p-6">
              <h3 class="text-lg font-semibold mb-4">Subscription Tiers</h3>
              <div class="grid grid-cols-4 gap-4">
                <div class="text-center">
                  <div class="text-2xl font-bold">{{ stats()?.free_users || 0 }}</div>
                  <div class="text-gray-400 text-sm">Free</div>
                </div>
                <div class="text-center">
                  <div class="text-2xl font-bold text-blue-400">{{ stats()?.pro_users || 0 }}</div>
                  <div class="text-gray-400 text-sm">Pro</div>
                </div>
                <div class="text-center">
                  <div class="text-2xl font-bold text-purple-400">{{ stats()?.team_users || 0 }}</div>
                  <div class="text-gray-400 text-sm">Team</div>
                </div>
                <div class="text-center">
                  <div class="text-2xl font-bold text-yellow-400">{{ stats()?.enterprise_users || 0 }}</div>
                  <div class="text-gray-400 text-sm">Enterprise</div>
                </div>
              </div>
            </div>

            <!-- System Health -->
            <div class="bg-gray-800 rounded-lg p-6">
              <h3 class="text-lg font-semibold mb-4">System Health</h3>
              <div class="grid grid-cols-4 gap-4">
                @for (check of healthChecks(); track check.name) {
                  <div class="flex items-center gap-2">
                    <span
                      class="w-3 h-3 rounded-full"
                      [class.bg-green-400]="check.status"
                      [class.bg-red-400]="!check.status"
                    ></span>
                    <span>{{ check.name }}</span>
                  </div>
                }
              </div>
            </div>
          </div>
        }

        <!-- Users Tab -->
        @if (activeTab() === 'users') {
          <div class="space-y-4">
            <!-- Search and filters -->
            <div class="flex gap-4">
              <input
                type="text"
                [(ngModel)]="userSearch"
                (input)="loadUsers()"
                placeholder="Search users..."
                class="bg-gray-800 border border-gray-700 rounded px-4 py-2 flex-1"
              />
              <select
                [(ngModel)]="userFilter"
                (change)="loadUsers()"
                class="bg-gray-800 border border-gray-700 rounded px-4 py-2"
              >
                <option value="">All Tiers</option>
                <option value="free">Free</option>
                <option value="pro">Pro</option>
                <option value="team">Team</option>
                <option value="enterprise">Enterprise</option>
              </select>
            </div>

            <!-- Users Table -->
            <div class="bg-gray-800 rounded-lg overflow-hidden">
              <table class="w-full">
                <thead class="bg-gray-700">
                  <tr>
                    <th class="text-left px-4 py-3">User</th>
                    <th class="text-left px-4 py-3">Status</th>
                    <th class="text-left px-4 py-3">Tier</th>
                    <th class="text-left px-4 py-3">Projects</th>
                    <th class="text-left px-4 py-3">Last Login</th>
                    <th class="text-left px-4 py-3">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  @for (user of users(); track user.id) {
                    <tr class="border-t border-gray-700">
                      <td class="px-4 py-3">
                        <div>{{ user.email }}</div>
                        @if (user.name) {
                          <div class="text-gray-400 text-sm">{{ user.name }}</div>
                        }
                      </td>
                      <td class="px-4 py-3">
                        <span
                          [class]="user.is_active ? 'text-green-400' : 'text-red-400'"
                        >
                          {{ user.is_active ? 'Active' : 'Suspended' }}
                        </span>
                        @if (user.is_admin) {
                          <span class="ml-2 text-yellow-400 text-xs">ADMIN</span>
                        }
                      </td>
                      <td class="px-4 py-3">
                        <span class="capitalize">{{ user.subscription_tier }}</span>
                      </td>
                      <td class="px-4 py-3">{{ user.project_count }}</td>
                      <td class="px-4 py-3 text-gray-400">
                        {{ user.last_login_at ? formatDate(user.last_login_at) : 'Never' }}
                      </td>
                      <td class="px-4 py-3">
                        <div class="flex gap-2">
                          @if (user.is_active) {
                            <button
                              (click)="suspendUser(user.id)"
                              class="text-red-400 hover:text-red-300 text-sm"
                            >
                              Suspend
                            </button>
                          } @else {
                            <button
                              (click)="unsuspendUser(user.id)"
                              class="text-green-400 hover:text-green-300 text-sm"
                            >
                              Unsuspend
                            </button>
                          }
                          <button
                            (click)="editUser(user)"
                            class="text-blue-400 hover:text-blue-300 text-sm"
                          >
                            Edit
                          </button>
                        </div>
                      </td>
                    </tr>
                  }
                </tbody>
              </table>
            </div>
          </div>
        }

        <!-- Audit Log Tab -->
        @if (activeTab() === 'audit') {
          <div class="space-y-4">
            <!-- Filters -->
            <div class="flex gap-4">
              <select
                [(ngModel)]="auditAction"
                (change)="loadAuditLog()"
                class="bg-gray-800 border border-gray-700 rounded px-4 py-2"
              >
                <option value="">All Actions</option>
                <option value="user.login">Login</option>
                <option value="user.logout">Logout</option>
                <option value="project.create">Project Create</option>
                <option value="variable.update">Variable Update</option>
                <option value="team.invite">Team Invite</option>
              </select>
              <select
                [(ngModel)]="auditSeverity"
                (change)="loadAuditLog()"
                class="bg-gray-800 border border-gray-700 rounded px-4 py-2"
              >
                <option value="">All Severities</option>
                <option value="info">Info</option>
                <option value="warning">Warning</option>
                <option value="critical">Critical</option>
              </select>
            </div>

            <!-- Audit Log Table -->
            <div class="bg-gray-800 rounded-lg overflow-hidden">
              <table class="w-full">
                <thead class="bg-gray-700">
                  <tr>
                    <th class="text-left px-4 py-3">Time</th>
                    <th class="text-left px-4 py-3">User</th>
                    <th class="text-left px-4 py-3">Action</th>
                    <th class="text-left px-4 py-3">Resource</th>
                    <th class="text-left px-4 py-3">IP</th>
                    <th class="text-left px-4 py-3">Severity</th>
                  </tr>
                </thead>
                <tbody>
                  @for (entry of auditLog(); track entry.id) {
                    <tr class="border-t border-gray-700">
                      <td class="px-4 py-3 text-gray-400 text-sm">
                        {{ formatDate(entry.timestamp) }}
                      </td>
                      <td class="px-4 py-3">{{ entry.user_email }}</td>
                      <td class="px-4 py-3">
                        <code class="text-blue-400">{{ entry.action }}</code>
                      </td>
                      <td class="px-4 py-3">
                        {{ entry.resource_type }}
                        @if (entry.resource_name) {
                          <span class="text-gray-400">: {{ entry.resource_name }}</span>
                        }
                      </td>
                      <td class="px-4 py-3 text-gray-400 text-sm">
                        {{ entry.ip_address || '-' }}
                      </td>
                      <td class="px-4 py-3">
                        <span
                          [class]="{
                            'text-gray-400': entry.severity === 'info',
                            'text-yellow-400': entry.severity === 'warning',
                            'text-red-400': entry.severity === 'critical'
                          }"
                        >
                          {{ entry.severity }}
                        </span>
                      </td>
                    </tr>
                  }
                </tbody>
              </table>
            </div>
          </div>
        }

        <!-- Settings Tab -->
        @if (activeTab() === 'settings') {
          <div class="max-w-2xl space-y-6">
            <!-- Registration Settings -->
            <div class="bg-gray-800 rounded-lg p-6">
              <h3 class="text-lg font-semibold mb-4">Registration</h3>
              <div class="space-y-4">
                <label class="flex items-center gap-2">
                  <input type="checkbox" [(ngModel)]="settings.registration_enabled" class="rounded" />
                  <span>Allow new registrations</span>
                </label>
                <label class="flex items-center gap-2">
                  <input type="checkbox" [(ngModel)]="settings.require_email_verification" class="rounded" />
                  <span>Require email verification</span>
                </label>
              </div>
            </div>

            <!-- Security Settings -->
            <div class="bg-gray-800 rounded-lg p-6">
              <h3 class="text-lg font-semibold mb-4">Security</h3>
              <div class="space-y-4">
                <div>
                  <label class="block text-sm text-gray-400 mb-1">Session Timeout (minutes)</label>
                  <input
                    type="number"
                    [(ngModel)]="settings.session_timeout_minutes"
                    min="5"
                    max="1440"
                    class="bg-gray-700 border border-gray-600 rounded px-4 py-2 w-full"
                  />
                </div>
                <label class="flex items-center gap-2">
                  <input type="checkbox" [(ngModel)]="settings.require_2fa" class="rounded" />
                  <span>Require 2FA for all users</span>
                </label>
              </div>
            </div>

            <!-- Feature Flags -->
            <div class="bg-gray-800 rounded-lg p-6">
              <h3 class="text-lg font-semibold mb-4">Features</h3>
              <div class="space-y-4">
                <label class="flex items-center gap-2">
                  <input type="checkbox" [(ngModel)]="settings.veilcloud_sync_enabled" class="rounded" />
                  <span>VeilCloud Sync</span>
                </label>
                <label class="flex items-center gap-2">
                  <input type="checkbox" [(ngModel)]="settings.service_integrations_enabled" class="rounded" />
                  <span>Service Integrations (Netlify, Vercel, etc.)</span>
                </label>
                <label class="flex items-center gap-2">
                  <input type="checkbox" [(ngModel)]="settings.team_features_enabled" class="rounded" />
                  <span>Team Features</span>
                </label>
              </div>
            </div>

            <button
              (click)="saveSettings()"
              class="bg-blue-600 hover:bg-blue-500 px-6 py-2 rounded font-semibold"
            >
              Save Settings
            </button>
          </div>
        }
      </main>
    </div>
  `,
})
export class AdminConsoleComponent implements OnInit {
  private apiUrl = environment.apiUrl || '/api';

  tabs = [
    { id: 'dashboard', label: 'Dashboard' },
    { id: 'users', label: 'Users' },
    { id: 'audit', label: 'Audit Log' },
    { id: 'settings', label: 'Settings' },
  ];

  activeTab = signal<string>('dashboard');

  stats = signal<AdminStats | null>(null);
  users = signal<AdminUser[]>([]);
  auditLog = signal<AuditEntry[]>([]);
  systemHealth = signal<SystemHealth | null>(null);

  healthChecks = computed(() => {
    const health = this.systemHealth();
    if (!health) return [];
    return [
      { name: 'Database', status: health.database },
      { name: 'Redis', status: health.redis },
      { name: 'VeilCloud', status: health.veilcloud },
      { name: 'Storage', status: health.storage },
    ];
  });

  userSearch = '';
  userFilter = '';
  auditAction = '';
  auditSeverity = '';

  settings = {
    registration_enabled: true,
    require_email_verification: true,
    session_timeout_minutes: 30,
    require_2fa: false,
    veilcloud_sync_enabled: true,
    service_integrations_enabled: true,
    team_features_enabled: true,
  };

  constructor(private http: HttpClient) {}

  ngOnInit(): void {
    this.loadStats();
    this.loadHealth();
    this.loadUsers();
    this.loadAuditLog();
    this.loadSettings();
  }

  private getHeaders(): HttpHeaders {
    const token = localStorage.getItem('envsync_access_token');
    return new HttpHeaders({
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
    });
  }

  loadStats(): void {
    this.http
      .get<AdminStats>(`${this.apiUrl}/admin/stats`, { headers: this.getHeaders() })
      .subscribe({
        next: (stats) => this.stats.set(stats),
        error: (err) => console.error('Failed to load stats', err),
      });
  }

  loadHealth(): void {
    this.http
      .get<SystemHealth>(`${this.apiUrl}/admin/health`, { headers: this.getHeaders() })
      .subscribe({
        next: (health) => this.systemHealth.set(health),
        error: (err) => console.error('Failed to load health', err),
      });
  }

  loadUsers(): void {
    const params: any = { page: 1, page_size: 50 };
    if (this.userSearch) params.search = this.userSearch;
    if (this.userFilter) params.subscription_tier = this.userFilter;

    this.http
      .get<{ users: AdminUser[] }>(`${this.apiUrl}/admin/users`, {
        headers: this.getHeaders(),
        params,
      })
      .subscribe({
        next: (response) => this.users.set(response.users),
        error: (err) => console.error('Failed to load users', err),
      });
  }

  loadAuditLog(): void {
    const params: any = { page: 1, page_size: 100 };
    if (this.auditAction) params.action = this.auditAction;
    if (this.auditSeverity) params.severity = this.auditSeverity;

    this.http
      .get<{ entries: AuditEntry[] }>(`${this.apiUrl}/admin/audit`, {
        headers: this.getHeaders(),
        params,
      })
      .subscribe({
        next: (response) => this.auditLog.set(response.entries),
        error: (err) => console.error('Failed to load audit log', err),
      });
  }

  loadSettings(): void {
    this.http
      .get<typeof this.settings>(`${this.apiUrl}/admin/settings`, { headers: this.getHeaders() })
      .subscribe({
        next: (settings) => (this.settings = settings),
        error: (err) => console.error('Failed to load settings', err),
      });
  }

  saveSettings(): void {
    this.http
      .put(`${this.apiUrl}/admin/settings`, this.settings, { headers: this.getHeaders() })
      .subscribe({
        next: () => alert('Settings saved'),
        error: (err) => alert('Failed to save settings'),
      });
  }

  suspendUser(userId: string): void {
    if (!confirm('Are you sure you want to suspend this user?')) return;

    this.http
      .post(`${this.apiUrl}/admin/users/${userId}/suspend`, {}, { headers: this.getHeaders() })
      .subscribe({
        next: () => this.loadUsers(),
        error: (err) => alert('Failed to suspend user'),
      });
  }

  unsuspendUser(userId: string): void {
    this.http
      .post(`${this.apiUrl}/admin/users/${userId}/unsuspend`, {}, { headers: this.getHeaders() })
      .subscribe({
        next: () => this.loadUsers(),
        error: (err) => alert('Failed to unsuspend user'),
      });
  }

  editUser(user: AdminUser): void {
    // In production, open a modal dialog
    console.log('Edit user', user);
  }

  formatDate(dateString: string): string {
    return new Date(dateString).toLocaleString();
  }
}
