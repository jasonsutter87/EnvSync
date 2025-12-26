/**
 * EnvSync API Service
 * HTTP client for web deployments (replaces Tauri IPC)
 */
import { Injectable } from '@angular/core';
import { HttpClient, HttpHeaders, HttpErrorResponse } from '@angular/common/http';
import { Observable, throwError, BehaviorSubject } from 'rxjs';
import { catchError, tap, map } from 'rxjs/operators';
import { environment } from '../../../environments/environment';
import {
  Project,
  Environment,
  Variable,
  VaultStatus,
  SearchResult,
  SyncStatus,
  SyncResult,
  User,
  AuthTokens,
  ConflictInfo,
  Team,
  TeamMember,
  TeamInvite,
  TeamWithMembers,
  TeamRole,
  AuditEvent,
  AuditQuery,
} from '../models';

@Injectable({
  providedIn: 'root',
})
export class ApiService {
  private apiUrl = environment.apiUrl || '/api';
  private accessToken: string | null = null;
  private refreshToken: string | null = null;

  private currentUser$ = new BehaviorSubject<User | null>(null);
  private isAuthenticated$ = new BehaviorSubject<boolean>(false);

  constructor(private http: HttpClient) {
    // Load tokens from localStorage
    this.accessToken = localStorage.getItem('envsync_access_token');
    this.refreshToken = localStorage.getItem('envsync_refresh_token');
    const userJson = localStorage.getItem('envsync_user');
    if (userJson) {
      this.currentUser$.next(JSON.parse(userJson));
      this.isAuthenticated$.next(true);
    }
  }

  private getHeaders(): HttpHeaders {
    let headers = new HttpHeaders({
      'Content-Type': 'application/json',
    });

    if (this.accessToken) {
      headers = headers.set('Authorization', `Bearer ${this.accessToken}`);
    }

    return headers;
  }

  private handleError(error: HttpErrorResponse) {
    let message = 'An error occurred';

    if (error.error instanceof ErrorEvent) {
      message = error.error.message;
    } else if (error.error?.detail) {
      message = error.error.detail;
    } else if (error.status === 401) {
      message = 'Unauthorized - please login again';
      this.logout();
    } else if (error.status === 403) {
      message = 'Access denied';
    } else if (error.status === 404) {
      message = 'Resource not found';
    }

    return throwError(() => new Error(message));
  }

  // ========== Authentication ==========

  get user$(): Observable<User | null> {
    return this.currentUser$.asObservable();
  }

  get authenticated$(): Observable<boolean> {
    return this.isAuthenticated$.asObservable();
  }

  isAuthenticated(): boolean {
    return !!this.accessToken;
  }

  register(email: string, password: string, name?: string): Observable<{ user: User; tokens: AuthTokens }> {
    return this.http.post<any>(`${this.apiUrl}/auth/register`, {
      email,
      password,
      name,
      master_key_salt: this.generateSalt(), // Generate client-side
    }).pipe(
      tap(response => this.setAuthData(response)),
      catchError(this.handleError.bind(this))
    );
  }

  login(email: string, password: string): Observable<{ user: User; tokens: AuthTokens }> {
    return this.http.post<any>(`${this.apiUrl}/auth/login`, {
      email,
      password,
    }).pipe(
      tap(response => this.setAuthData(response)),
      catchError(this.handleError.bind(this))
    );
  }

  logout(): void {
    this.accessToken = null;
    this.refreshToken = null;
    this.currentUser$.next(null);
    this.isAuthenticated$.next(false);
    localStorage.removeItem('envsync_access_token');
    localStorage.removeItem('envsync_refresh_token');
    localStorage.removeItem('envsync_user');
  }

  refreshAuthToken(): Observable<AuthTokens> {
    return this.http.post<any>(`${this.apiUrl}/auth/refresh`, {
      refresh_token: this.refreshToken,
    }).pipe(
      tap(response => {
        this.accessToken = response.access_token;
        this.refreshToken = response.refresh_token;
        localStorage.setItem('envsync_access_token', this.accessToken!);
        localStorage.setItem('envsync_refresh_token', this.refreshToken!);
      }),
      catchError(this.handleError.bind(this))
    );
  }

  getCurrentUser(): Observable<User> {
    return this.http.get<User>(`${this.apiUrl}/auth/me`, {
      headers: this.getHeaders(),
    }).pipe(
      tap(user => this.currentUser$.next(user)),
      catchError(this.handleError.bind(this))
    );
  }

  private setAuthData(response: any): void {
    this.accessToken = response.access_token;
    this.refreshToken = response.refresh_token;
    this.currentUser$.next(response.user);
    this.isAuthenticated$.next(true);

    localStorage.setItem('envsync_access_token', this.accessToken!);
    localStorage.setItem('envsync_refresh_token', this.refreshToken!);
    localStorage.setItem('envsync_user', JSON.stringify(response.user));
  }

  private generateSalt(): string {
    const array = new Uint8Array(16);
    crypto.getRandomValues(array);
    return btoa(String.fromCharCode(...array));
  }

  // ========== Projects ==========

  getProjects(): Observable<Project[]> {
    return this.http.get<{ projects: Project[] }>(`${this.apiUrl}/projects`, {
      headers: this.getHeaders(),
    }).pipe(
      map(response => response.projects),
      catchError(this.handleError.bind(this))
    );
  }

  getProject(id: string): Observable<Project> {
    return this.http.get<Project>(`${this.apiUrl}/projects/${id}`, {
      headers: this.getHeaders(),
    }).pipe(catchError(this.handleError.bind(this)));
  }

  createProject(name: string, description?: string): Observable<Project> {
    return this.http.post<Project>(`${this.apiUrl}/projects`, {
      name,
      description,
      key_salt: this.generateSalt(),
    }, {
      headers: this.getHeaders(),
    }).pipe(catchError(this.handleError.bind(this)));
  }

  updateProject(id: string, name: string, description?: string): Observable<Project> {
    return this.http.put<Project>(`${this.apiUrl}/projects/${id}`, {
      name,
      description,
    }, {
      headers: this.getHeaders(),
    }).pipe(catchError(this.handleError.bind(this)));
  }

  deleteProject(id: string): Observable<void> {
    return this.http.delete<void>(`${this.apiUrl}/projects/${id}`, {
      headers: this.getHeaders(),
    }).pipe(catchError(this.handleError.bind(this)));
  }

  searchVariables(query: string): Observable<SearchResult[]> {
    return this.http.post<{ results: SearchResult[] }>(`${this.apiUrl}/projects/search`, {
      query,
    }, {
      headers: this.getHeaders(),
    }).pipe(
      map(response => response.results),
      catchError(this.handleError.bind(this))
    );
  }

  // ========== Environments ==========

  getEnvironments(projectId: string): Observable<Environment[]> {
    return this.http.get<Environment[]>(`${this.apiUrl}/projects/${projectId}/environments`, {
      headers: this.getHeaders(),
    }).pipe(catchError(this.handleError.bind(this)));
  }

  createEnvironment(projectId: string, name: string, envType: string): Observable<Environment> {
    return this.http.post<Environment>(`${this.apiUrl}/projects/${projectId}/environments`, {
      name,
      display_order: 0,
    }, {
      headers: this.getHeaders(),
    }).pipe(catchError(this.handleError.bind(this)));
  }

  deleteEnvironment(projectId: string, id: string): Observable<void> {
    return this.http.delete<void>(`${this.apiUrl}/projects/${projectId}/environments/${id}`, {
      headers: this.getHeaders(),
    }).pipe(catchError(this.handleError.bind(this)));
  }

  // ========== Variables ==========

  getVariables(projectId: string, environmentId: string): Observable<Variable[]> {
    return this.http.get<Variable[]>(
      `${this.apiUrl}/projects/${projectId}/environments/${environmentId}/variables`,
      { headers: this.getHeaders() }
    ).pipe(catchError(this.handleError.bind(this)));
  }

  createVariable(
    projectId: string,
    environmentId: string,
    key: string,
    encryptedValue: string,
    nonce: string,
    isSecret: boolean = true
  ): Observable<Variable> {
    return this.http.post<Variable>(
      `${this.apiUrl}/projects/${projectId}/environments/${environmentId}/variables`,
      {
        key,
        encrypted_value: encryptedValue,
        value_nonce: nonce,
        is_secret: isSecret,
      },
      { headers: this.getHeaders() }
    ).pipe(catchError(this.handleError.bind(this)));
  }

  updateVariable(
    projectId: string,
    environmentId: string,
    id: string,
    key: string,
    encryptedValue: string,
    nonce: string,
    isSecret: boolean
  ): Observable<Variable> {
    return this.http.put<Variable>(
      `${this.apiUrl}/projects/${projectId}/environments/${environmentId}/variables/${id}`,
      {
        encrypted_value: encryptedValue,
        value_nonce: nonce,
        is_secret: isSecret,
      },
      { headers: this.getHeaders() }
    ).pipe(catchError(this.handleError.bind(this)));
  }

  deleteVariable(projectId: string, environmentId: string, id: string): Observable<void> {
    return this.http.delete<void>(
      `${this.apiUrl}/projects/${projectId}/environments/${environmentId}/variables/${id}`,
      { headers: this.getHeaders() }
    ).pipe(catchError(this.handleError.bind(this)));
  }

  importEnvFile(projectId: string, environmentId: string, content: string, overwrite: boolean = false): Observable<Variable[]> {
    return this.http.post<Variable[]>(
      `${this.apiUrl}/projects/${projectId}/environments/${environmentId}/import`,
      {
        content,
        environment_id: environmentId,
        overwrite,
      },
      { headers: this.getHeaders() }
    ).pipe(catchError(this.handleError.bind(this)));
  }

  exportEnvFile(projectId: string, environmentId: string): Observable<string> {
    return this.http.post<{ content: string }>(
      `${this.apiUrl}/projects/${projectId}/environments/${environmentId}/export`,
      {
        environment_id: environmentId,
        include_comments: true,
        include_empty: false,
      },
      { headers: this.getHeaders() }
    ).pipe(
      map(response => response.content),
      catchError(this.handleError.bind(this))
    );
  }

  // ========== Sync ==========

  getSyncStatus(): Observable<SyncStatus> {
    return this.http.get<SyncStatus>(`${this.apiUrl}/sync/status`, {
      headers: this.getHeaders(),
    }).pipe(catchError(this.handleError.bind(this)));
  }

  syncNow(projectIds?: string[]): Observable<SyncResult> {
    return this.http.post<SyncResult>(`${this.apiUrl}/sync/sync`, {
      project_ids: projectIds,
    }, {
      headers: this.getHeaders(),
    }).pipe(catchError(this.handleError.bind(this)));
  }

  getSyncConflicts(): Observable<ConflictInfo[]> {
    return this.http.get<{ conflicts: ConflictInfo[] }>(`${this.apiUrl}/sync/conflicts`, {
      headers: this.getHeaders(),
    }).pipe(
      map(response => response.conflicts),
      catchError(this.handleError.bind(this))
    );
  }

  resolveConflict(conflictId: string, resolution: string, resolvedData?: string): Observable<void> {
    return this.http.post<void>(`${this.apiUrl}/sync/conflicts/${conflictId}/resolve`, {
      conflict_id: conflictId,
      resolution,
      resolved_data: resolvedData,
    }, {
      headers: this.getHeaders(),
    }).pipe(catchError(this.handleError.bind(this)));
  }

  // ========== Teams ==========

  getTeams(): Observable<Team[]> {
    return this.http.get<Team[]>(`${this.apiUrl}/teams`, {
      headers: this.getHeaders(),
    }).pipe(catchError(this.handleError.bind(this)));
  }

  getTeam(id: string): Observable<Team> {
    return this.http.get<Team>(`${this.apiUrl}/teams/${id}`, {
      headers: this.getHeaders(),
    }).pipe(catchError(this.handleError.bind(this)));
  }

  getTeamWithMembers(id: string): Observable<TeamWithMembers> {
    return this.http.get<TeamWithMembers>(`${this.apiUrl}/teams/${id}`, {
      headers: this.getHeaders(),
    }).pipe(catchError(this.handleError.bind(this)));
  }

  createTeam(name: string, description?: string, threshold?: number, totalShares?: number): Observable<Team> {
    return this.http.post<Team>(`${this.apiUrl}/teams`, {
      name,
      description,
      slug: name.toLowerCase().replace(/\s+/g, '-'),
      veilkey_enabled: threshold !== undefined,
      veilkey_threshold: threshold || 2,
      veilkey_total_shares: totalShares || 3,
    }, {
      headers: this.getHeaders(),
    }).pipe(catchError(this.handleError.bind(this)));
  }

  updateTeam(id: string, name: string, description?: string): Observable<Team> {
    return this.http.put<Team>(`${this.apiUrl}/teams/${id}`, {
      name,
      description,
    }, {
      headers: this.getHeaders(),
    }).pipe(catchError(this.handleError.bind(this)));
  }

  deleteTeam(id: string): Observable<void> {
    return this.http.delete<void>(`${this.apiUrl}/teams/${id}`, {
      headers: this.getHeaders(),
    }).pipe(catchError(this.handleError.bind(this)));
  }

  // ========== Team Members ==========

  getTeamMembers(teamId: string): Observable<TeamMember[]> {
    return this.http.get<TeamMember[]>(`${this.apiUrl}/teams/${teamId}/members`, {
      headers: this.getHeaders(),
    }).pipe(catchError(this.handleError.bind(this)));
  }

  inviteTeamMember(teamId: string, email: string, role: TeamRole): Observable<TeamInvite> {
    return this.http.post<TeamInvite>(`${this.apiUrl}/teams/${teamId}/invites`, {
      email,
      role,
    }, {
      headers: this.getHeaders(),
    }).pipe(catchError(this.handleError.bind(this)));
  }

  acceptTeamInvite(token: string): Observable<TeamMember> {
    return this.http.post<TeamMember>(`${this.apiUrl}/teams/invites/accept`, {
      token,
    }, {
      headers: this.getHeaders(),
    }).pipe(catchError(this.handleError.bind(this)));
  }

  updateMemberRole(teamId: string, memberId: string, newRole: TeamRole): Observable<TeamMember> {
    return this.http.put<TeamMember>(`${this.apiUrl}/teams/${teamId}/members/${memberId}`, {
      role: newRole,
    }, {
      headers: this.getHeaders(),
    }).pipe(catchError(this.handleError.bind(this)));
  }

  removeTeamMember(teamId: string, memberId: string): Observable<void> {
    return this.http.delete<void>(`${this.apiUrl}/teams/${teamId}/members/${memberId}`, {
      headers: this.getHeaders(),
    }).pipe(catchError(this.handleError.bind(this)));
  }

  // ========== Audit Logs ==========

  getTeamAuditLog(teamId: string, page: number = 1, pageSize: number = 50): Observable<{ entries: AuditEvent[]; total: number }> {
    return this.http.get<{ entries: AuditEvent[]; total: number }>(`${this.apiUrl}/teams/${teamId}/audit`, {
      headers: this.getHeaders(),
      params: { page: page.toString(), page_size: pageSize.toString() },
    }).pipe(catchError(this.handleError.bind(this)));
  }

  queryAuditLog(query: AuditQuery): Observable<AuditEvent[]> {
    return this.http.get<{ entries: AuditEvent[] }>(`${this.apiUrl}/admin/audit`, {
      headers: this.getHeaders(),
      params: query as any,
    }).pipe(
      map(response => response.entries),
      catchError(this.handleError.bind(this))
    );
  }
}
