import { Component, Input, inject, OnInit, OnChanges, SimpleChanges } from '@angular/core';
import { CommonModule } from '@angular/common';
import { TeamService } from '../../core/services/team.service';
import { AuditEvent, getAuditEventLabel, getAuditEventIcon } from '../../core/models';

@Component({
  selector: 'app-audit-log-viewer',
  standalone: true,
  imports: [CommonModule],
  template: `
    <div class="audit-viewer">
      <div class="header">
        <h3>Activity Log</h3>
        @if (loading) {
          <span class="loading-indicator">Loading...</span>
        }
      </div>

      <div class="event-list">
        @for (event of events; track event.id) {
          <div class="event-row">
            <div class="event-icon" [attr.data-category]="getEventCategory(event.event_type)">
              {{ getEventIcon(event.event_type) }}
            </div>
            <div class="event-content">
              <div class="event-header">
                <span class="event-type">{{ getEventLabel(event.event_type) }}</span>
                <span class="event-time">{{ formatTime(event.timestamp) }}</span>
              </div>
              <div class="event-details">
                <span class="actor">
                  {{ event.actor_email || 'Unknown user' }}
                </span>
                @if (event.project_id && projectName) {
                  <span class="target">in {{ projectName }}</span>
                }
                @if (event.variable_key) {
                  <span class="variable">{{ event.variable_key }}</span>
                }
                @if (event.target_user_id) {
                  <span class="target-user">{{ event.target_user_id }}</span>
                }
              </div>
              @if (event.details) {
                <div class="event-metadata">
                  {{ formatDetails(event.details) }}
                </div>
              }
            </div>
          </div>
        } @empty {
          <div class="empty">
            @if (loading) {
              <p>Loading activity...</p>
            } @else {
              <p>No activity recorded yet.</p>
            }
          </div>
        }
      </div>

      @if (events.length >= limit && !loading) {
        <button class="load-more" (click)="loadMore()">
          Load More
        </button>
      }
    </div>
  `,
  styles: [`
    .audit-viewer {
      background: var(--bg-secondary, #1a1a2e);
      border-radius: 8px;
      overflow: hidden;
    }

    .header {
      display: flex;
      justify-content: space-between;
      align-items: center;
      padding: 16px;
      border-bottom: 1px solid var(--border-color, #333);
    }

    .header h3 {
      margin: 0;
      font-size: 16px;
    }

    .loading-indicator {
      font-size: 12px;
      color: var(--text-secondary, #888);
    }

    .event-list {
      max-height: 400px;
      overflow-y: auto;
    }

    .event-row {
      display: flex;
      gap: 12px;
      padding: 12px 16px;
      border-bottom: 1px solid var(--border-color, #222);
      transition: background 0.2s;
    }

    .event-row:hover {
      background: var(--bg-hover, #252540);
    }

    .event-icon {
      width: 32px;
      height: 32px;
      display: flex;
      align-items: center;
      justify-content: center;
      border-radius: 8px;
      font-size: 14px;
      flex-shrink: 0;
    }

    .event-icon[data-category="secret"] {
      background: rgba(234, 179, 8, 0.2);
      color: #eab308;
    }

    .event-icon[data-category="team"] {
      background: rgba(99, 102, 241, 0.2);
      color: #6366f1;
    }

    .event-icon[data-category="member"] {
      background: rgba(34, 197, 94, 0.2);
      color: #22c55e;
    }

    .event-icon[data-category="access"] {
      background: rgba(168, 85, 247, 0.2);
      color: #a855f7;
    }

    .event-icon[data-category="auth"] {
      background: rgba(14, 165, 233, 0.2);
      color: #0ea5e9;
    }

    .event-icon[data-category="sync"] {
      background: rgba(249, 115, 22, 0.2);
      color: #f97316;
    }

    .event-icon[data-category="key"] {
      background: rgba(239, 68, 68, 0.2);
      color: #ef4444;
    }

    .event-content {
      flex: 1;
      min-width: 0;
    }

    .event-header {
      display: flex;
      justify-content: space-between;
      align-items: center;
      margin-bottom: 4px;
    }

    .event-type {
      font-weight: 500;
      font-size: 14px;
    }

    .event-time {
      font-size: 12px;
      color: var(--text-secondary, #888);
    }

    .event-details {
      font-size: 13px;
      color: var(--text-secondary, #888);
    }

    .event-details .actor {
      color: var(--primary-color, #6366f1);
    }

    .event-details .variable {
      font-family: monospace;
      background: var(--bg-tertiary, #333);
      padding: 1px 4px;
      border-radius: 3px;
      margin-left: 4px;
    }

    .event-metadata {
      margin-top: 4px;
      font-size: 12px;
      color: var(--text-tertiary, #666);
      font-family: monospace;
    }

    .empty {
      padding: 32px;
      text-align: center;
      color: var(--text-secondary, #888);
    }

    .load-more {
      width: 100%;
      padding: 12px;
      border: none;
      background: var(--bg-tertiary, #252540);
      color: var(--text-secondary, #888);
      cursor: pointer;
      transition: background 0.2s;
    }

    .load-more:hover {
      background: var(--bg-hover, #2a2a4a);
    }
  `]
})
export class AuditLogViewerComponent implements OnInit, OnChanges {
  @Input() projectId?: string;
  @Input() teamId?: string;
  @Input() projectName?: string;

  private teamService = inject(TeamService);

  events: AuditEvent[] = [];
  loading = false;
  limit = 20;

  getEventLabel = getAuditEventLabel;
  getEventIcon = getAuditEventIcon;

  ngOnInit() {
    this.loadEvents();
  }

  ngOnChanges(changes: SimpleChanges) {
    if (changes['projectId'] || changes['teamId']) {
      this.events = [];
      this.loadEvents();
    }
  }

  async loadEvents() {
    this.loading = true;

    try {
      if (this.projectId) {
        this.events = await this.teamService.loadProjectAuditLog(this.projectId, this.limit);
      } else if (this.teamId) {
        await this.teamService.loadTeamAuditLog(this.teamId, this.limit);
        this.events = this.teamService.auditLog();
      }
    } finally {
      this.loading = false;
    }
  }

  async loadMore() {
    this.limit += 20;
    await this.loadEvents();
  }

  getEventCategory(eventType: string): string {
    if (eventType.startsWith('Secret')) return 'secret';
    if (eventType.startsWith('Team')) return 'team';
    if (eventType.startsWith('Member')) return 'member';
    if (eventType.startsWith('Project') || eventType.startsWith('Access')) return 'access';
    if (eventType === 'Login' || eventType === 'Logout' || eventType === 'SessionRestored') return 'auth';
    if (eventType.startsWith('Sync') || eventType === 'ConflictResolved') return 'sync';
    if (eventType.startsWith('Key')) return 'key';
    return 'default';
  }

  formatTime(dateStr: string): string {
    const date = new Date(dateStr);
    const now = new Date();
    const diff = now.getTime() - date.getTime();
    const mins = Math.floor(diff / 60000);
    const hours = Math.floor(diff / 3600000);
    const days = Math.floor(diff / 86400000);

    if (mins < 1) return 'just now';
    if (mins < 60) return `${mins}m ago`;
    if (hours < 24) return `${hours}h ago`;
    if (days < 7) return `${days}d ago`;

    return date.toLocaleDateString() + ' ' + date.toLocaleTimeString([], {
      hour: '2-digit',
      minute: '2-digit'
    });
  }

  formatDetails(details: string): string {
    try {
      const parsed = JSON.parse(details);
      return Object.entries(parsed)
        .map(([k, v]) => `${k}: ${v}`)
        .join(', ');
    } catch {
      return details;
    }
  }
}
