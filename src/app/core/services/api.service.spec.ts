/**
 * ApiService Unit Tests
 *
 * Comprehensive test suite for the EnvSync API service covering:
 * - Service instantiation and initialization
 * - HTTP operations for all resources
 * - Authentication flows
 * - Error handling and HTTP error responses
 * - Observable behavior
 * - Header management
 * - LocalStorage integration
 */

import { TestBed } from '@angular/core/testing';
import { HttpClientTestingModule, HttpTestingController } from '@angular/common/http/testing';
import { ApiService } from './api.service';
import {
  Project,
  Environment,
  Variable,
  User,
  AuthTokens,
  Team,
  TeamMember,
  TeamInvite,
  TeamWithMembers,
  TeamRole,
  SyncStatus,
  SyncResult,
  ConflictInfo,
  SearchResult,
  AuditEvent,
  AuditQuery,
} from '../models';

describe('ApiService', () => {
  let service: ApiService;
  let httpMock: HttpTestingController;
  const baseApiUrl = '/api';

  // Mock data
  const mockUser: User = {
    id: 'user-1',
    email: 'test@example.com',
    name: 'Test User',
    created_at: '2024-01-01T00:00:00Z',
  };

  const mockTokens: AuthTokens = {
    access_token: 'mock-access-token',
    refresh_token: 'mock-refresh-token',
    expires_at: '2024-12-31T23:59:59Z',
  };

  const mockProject: Project = {
    id: 'proj-1',
    name: 'Test Project',
    description: 'Test Description',
    created_at: '2024-01-01T00:00:00Z',
    updated_at: '2024-01-01T00:00:00Z',
  };

  const mockEnvironment: Environment = {
    id: 'env-1',
    project_id: 'proj-1',
    name: 'Development',
    env_type: 'Development',
    created_at: '2024-01-01T00:00:00Z',
    updated_at: '2024-01-01T00:00:00Z',
  };

  const mockVariable: Variable = {
    id: 'var-1',
    environment_id: 'env-1',
    key: 'API_KEY',
    value: 'encrypted-value',
    is_secret: true,
    created_at: '2024-01-01T00:00:00Z',
    updated_at: '2024-01-01T00:00:00Z',
  };

  const mockTeam: Team = {
    id: 'team-1',
    name: 'Test Team',
    description: 'Test Team Description',
    owner_id: 'user-1',
    threshold: 2,
    total_shares: 3,
    created_at: '2024-01-01T00:00:00Z',
    updated_at: '2024-01-01T00:00:00Z',
  };

  beforeEach(() => {
    TestBed.configureTestingModule({
      imports: [HttpClientTestingModule],
      providers: [ApiService],
    });

    service = TestBed.inject(ApiService);
    httpMock = TestBed.inject(HttpTestingController);

    // Clear localStorage before each test
    localStorage.clear();
  });

  afterEach(() => {
    httpMock.verify();
    localStorage.clear();
  });

  // ========== Service Instantiation ==========

  describe('Service Instantiation', () => {
    it('should be created', () => {
      expect(service).toBeTruthy();
    });

    it('should initialize with no tokens when localStorage is empty', () => {
      expect(service.isAuthenticated()).toBe(false);
    });

    it('should load tokens from localStorage on initialization', () => {
      localStorage.setItem('envsync_access_token', 'stored-token');
      localStorage.setItem('envsync_refresh_token', 'stored-refresh');
      localStorage.setItem('envsync_user', JSON.stringify(mockUser));

      // Create new service instance to trigger constructor
      const newService = new ApiService(TestBed.inject(HttpClientTestingModule) as any);
      expect(newService.isAuthenticated()).toBe(true);
    });

    it('should emit user observable when loaded from localStorage', (done) => {
      localStorage.setItem('envsync_access_token', 'stored-token');
      localStorage.setItem('envsync_user', JSON.stringify(mockUser));

      const newService = new ApiService(TestBed.inject(HttpClientTestingModule) as any);

      newService.user$.subscribe((user) => {
        if (user) {
          expect(user.email).toBe(mockUser.email);
          done();
        }
      });
    });

    it('should emit authenticated observable when tokens are loaded', (done) => {
      localStorage.setItem('envsync_access_token', 'stored-token');
      localStorage.setItem('envsync_user', JSON.stringify(mockUser));

      const newService = new ApiService(TestBed.inject(HttpClientTestingModule) as any);

      newService.authenticated$.subscribe((authenticated) => {
        if (authenticated) {
          expect(authenticated).toBe(true);
          done();
        }
      });
    });
  });

  // ========== Authentication ==========

  describe('Authentication', () => {
    it('should register a new user', (done) => {
      const email = 'new@example.com';
      const password = 'password123';
      const name = 'New User';

      service.register(email, password, name).subscribe((response) => {
        expect(response.user).toEqual(mockUser);
        expect(response.tokens).toEqual(mockTokens);
        expect(localStorage.getItem('envsync_access_token')).toBe(mockTokens.access_token);
        expect(localStorage.getItem('envsync_refresh_token')).toBe(mockTokens.refresh_token);
        done();
      });

      const req = httpMock.expectOne(`${baseApiUrl}/auth/register`);
      expect(req.request.method).toBe('POST');
      expect(req.request.body.email).toBe(email);
      expect(req.request.body.password).toBe(password);
      expect(req.request.body.name).toBe(name);
      expect(req.request.body.master_key_salt).toBeDefined();
      req.flush({ user: mockUser, access_token: mockTokens.access_token, refresh_token: mockTokens.refresh_token });
    });

    it('should login an existing user', (done) => {
      const email = 'test@example.com';
      const password = 'password123';

      service.login(email, password).subscribe((response) => {
        expect(response.user).toEqual(mockUser);
        expect(localStorage.getItem('envsync_access_token')).toBe(mockTokens.access_token);
        done();
      });

      const req = httpMock.expectOne(`${baseApiUrl}/auth/login`);
      expect(req.request.method).toBe('POST');
      expect(req.request.body).toEqual({ email, password });
      req.flush({ user: mockUser, access_token: mockTokens.access_token, refresh_token: mockTokens.refresh_token });
    });

    it('should set authentication state after login', (done) => {
      service.login('test@example.com', 'password').subscribe(() => {
        expect(service.isAuthenticated()).toBe(true);
        done();
      });

      const req = httpMock.expectOne(`${baseApiUrl}/auth/login`);
      req.flush({ user: mockUser, access_token: mockTokens.access_token, refresh_token: mockTokens.refresh_token });
    });

    it('should logout and clear tokens', () => {
      // Set tokens first
      localStorage.setItem('envsync_access_token', 'token');
      localStorage.setItem('envsync_refresh_token', 'refresh');
      localStorage.setItem('envsync_user', JSON.stringify(mockUser));

      service.logout();

      expect(localStorage.getItem('envsync_access_token')).toBeNull();
      expect(localStorage.getItem('envsync_refresh_token')).toBeNull();
      expect(localStorage.getItem('envsync_user')).toBeNull();
      expect(service.isAuthenticated()).toBe(false);
    });

    it('should refresh auth tokens', (done) => {
      localStorage.setItem('envsync_refresh_token', 'old-refresh-token');

      const newTokens = {
        access_token: 'new-access-token',
        refresh_token: 'new-refresh-token',
      };

      service.refreshAuthToken().subscribe((tokens) => {
        expect(localStorage.getItem('envsync_access_token')).toBe(newTokens.access_token);
        expect(localStorage.getItem('envsync_refresh_token')).toBe(newTokens.refresh_token);
        done();
      });

      const req = httpMock.expectOne(`${baseApiUrl}/auth/refresh`);
      expect(req.request.method).toBe('POST');
      expect(req.request.body.refresh_token).toBe('old-refresh-token');
      req.flush(newTokens);
    });

    it('should get current user', (done) => {
      localStorage.setItem('envsync_access_token', mockTokens.access_token);

      service.getCurrentUser().subscribe((user) => {
        expect(user).toEqual(mockUser);
        done();
      });

      const req = httpMock.expectOne(`${baseApiUrl}/auth/me`);
      expect(req.request.method).toBe('GET');
      expect(req.request.headers.get('Authorization')).toBe(`Bearer ${mockTokens.access_token}`);
      req.flush(mockUser);
    });

    it('should include Authorization header when token is set', (done) => {
      localStorage.setItem('envsync_access_token', mockTokens.access_token);

      // Create new service to load token
      const authenticatedService = new ApiService(TestBed.inject(HttpClientTestingModule) as any);

      authenticatedService.getProjects().subscribe(() => {
        done();
      });

      const req = httpMock.expectOne(`${baseApiUrl}/projects`);
      expect(req.request.headers.get('Authorization')).toBe(`Bearer ${mockTokens.access_token}`);
      req.flush({ projects: [] });
    });
  });

  // ========== Projects ==========

  describe('Projects', () => {
    beforeEach(() => {
      localStorage.setItem('envsync_access_token', mockTokens.access_token);
    });

    it('should get all projects', (done) => {
      const mockProjects = [mockProject];

      service.getProjects().subscribe((projects) => {
        expect(projects).toEqual(mockProjects);
        done();
      });

      const req = httpMock.expectOne(`${baseApiUrl}/projects`);
      expect(req.request.method).toBe('GET');
      req.flush({ projects: mockProjects });
    });

    it('should get a single project by id', (done) => {
      service.getProject('proj-1').subscribe((project) => {
        expect(project).toEqual(mockProject);
        done();
      });

      const req = httpMock.expectOne(`${baseApiUrl}/projects/proj-1`);
      expect(req.request.method).toBe('GET');
      req.flush(mockProject);
    });

    it('should create a new project', (done) => {
      const name = 'New Project';
      const description = 'New Description';

      service.createProject(name, description).subscribe((project) => {
        expect(project).toEqual(mockProject);
        done();
      });

      const req = httpMock.expectOne(`${baseApiUrl}/projects`);
      expect(req.request.method).toBe('POST');
      expect(req.request.body.name).toBe(name);
      expect(req.request.body.description).toBe(description);
      expect(req.request.body.key_salt).toBeDefined();
      req.flush(mockProject);
    });

    it('should update an existing project', (done) => {
      const name = 'Updated Project';
      const description = 'Updated Description';

      service.updateProject('proj-1', name, description).subscribe((project) => {
        expect(project).toEqual(mockProject);
        done();
      });

      const req = httpMock.expectOne(`${baseApiUrl}/projects/proj-1`);
      expect(req.request.method).toBe('PUT');
      expect(req.request.body).toEqual({ name, description });
      req.flush(mockProject);
    });

    it('should delete a project', (done) => {
      service.deleteProject('proj-1').subscribe(() => {
        done();
      });

      const req = httpMock.expectOne(`${baseApiUrl}/projects/proj-1`);
      expect(req.request.method).toBe('DELETE');
      req.flush(null);
    });

    it('should search variables', (done) => {
      const query = 'API_KEY';
      const mockResults: SearchResult[] = [{
        project: mockProject,
        environment: mockEnvironment,
        variable: mockVariable,
      }];

      service.searchVariables(query).subscribe((results) => {
        expect(results).toEqual(mockResults);
        done();
      });

      const req = httpMock.expectOne(`${baseApiUrl}/projects/search`);
      expect(req.request.method).toBe('POST');
      expect(req.request.body).toEqual({ query });
      req.flush({ results: mockResults });
    });
  });

  // ========== Environments ==========

  describe('Environments', () => {
    beforeEach(() => {
      localStorage.setItem('envsync_access_token', mockTokens.access_token);
    });

    it('should get environments for a project', (done) => {
      const mockEnvironments = [mockEnvironment];

      service.getEnvironments('proj-1').subscribe((environments) => {
        expect(environments).toEqual(mockEnvironments);
        done();
      });

      const req = httpMock.expectOne(`${baseApiUrl}/projects/proj-1/environments`);
      expect(req.request.method).toBe('GET');
      req.flush(mockEnvironments);
    });

    it('should create a new environment', (done) => {
      const name = 'Staging';
      const envType = 'Staging';

      service.createEnvironment('proj-1', name, envType).subscribe((environment) => {
        expect(environment).toEqual(mockEnvironment);
        done();
      });

      const req = httpMock.expectOne(`${baseApiUrl}/projects/proj-1/environments`);
      expect(req.request.method).toBe('POST');
      expect(req.request.body.name).toBe(name);
      req.flush(mockEnvironment);
    });

    it('should delete an environment', (done) => {
      service.deleteEnvironment('proj-1', 'env-1').subscribe(() => {
        done();
      });

      const req = httpMock.expectOne(`${baseApiUrl}/projects/proj-1/environments/env-1`);
      expect(req.request.method).toBe('DELETE');
      req.flush(null);
    });
  });

  // ========== Variables ==========

  describe('Variables', () => {
    beforeEach(() => {
      localStorage.setItem('envsync_access_token', mockTokens.access_token);
    });

    it('should get variables for an environment', (done) => {
      const mockVariables = [mockVariable];

      service.getVariables('proj-1', 'env-1').subscribe((variables) => {
        expect(variables).toEqual(mockVariables);
        done();
      });

      const req = httpMock.expectOne(`${baseApiUrl}/projects/proj-1/environments/env-1/variables`);
      expect(req.request.method).toBe('GET');
      req.flush(mockVariables);
    });

    it('should create a new variable', (done) => {
      const key = 'NEW_VAR';
      const encryptedValue = 'encrypted';
      const nonce = 'nonce123';

      service.createVariable('proj-1', 'env-1', key, encryptedValue, nonce, true).subscribe((variable) => {
        expect(variable).toEqual(mockVariable);
        done();
      });

      const req = httpMock.expectOne(`${baseApiUrl}/projects/proj-1/environments/env-1/variables`);
      expect(req.request.method).toBe('POST');
      expect(req.request.body).toEqual({
        key,
        encrypted_value: encryptedValue,
        value_nonce: nonce,
        is_secret: true,
      });
      req.flush(mockVariable);
    });

    it('should update a variable', (done) => {
      const key = 'UPDATED_VAR';
      const encryptedValue = 'new-encrypted';
      const nonce = 'new-nonce';

      service.updateVariable('proj-1', 'env-1', 'var-1', key, encryptedValue, nonce, false).subscribe((variable) => {
        expect(variable).toEqual(mockVariable);
        done();
      });

      const req = httpMock.expectOne(`${baseApiUrl}/projects/proj-1/environments/env-1/variables/var-1`);
      expect(req.request.method).toBe('PUT');
      expect(req.request.body).toEqual({
        encrypted_value: encryptedValue,
        value_nonce: nonce,
        is_secret: false,
      });
      req.flush(mockVariable);
    });

    it('should delete a variable', (done) => {
      service.deleteVariable('proj-1', 'env-1', 'var-1').subscribe(() => {
        done();
      });

      const req = httpMock.expectOne(`${baseApiUrl}/projects/proj-1/environments/env-1/variables/var-1`);
      expect(req.request.method).toBe('DELETE');
      req.flush(null);
    });

    it('should import env file', (done) => {
      const content = 'API_KEY=value\nSECRET=secret';
      const mockVariables = [mockVariable];

      service.importEnvFile('proj-1', 'env-1', content, true).subscribe((variables) => {
        expect(variables).toEqual(mockVariables);
        done();
      });

      const req = httpMock.expectOne(`${baseApiUrl}/projects/proj-1/environments/env-1/import`);
      expect(req.request.method).toBe('POST');
      expect(req.request.body).toEqual({
        content,
        environment_id: 'env-1',
        overwrite: true,
      });
      req.flush(mockVariables);
    });

    it('should export env file', (done) => {
      const expectedContent = 'API_KEY=value\n';

      service.exportEnvFile('proj-1', 'env-1').subscribe((content) => {
        expect(content).toBe(expectedContent);
        done();
      });

      const req = httpMock.expectOne(`${baseApiUrl}/projects/proj-1/environments/env-1/export`);
      expect(req.request.method).toBe('POST');
      expect(req.request.body).toEqual({
        environment_id: 'env-1',
        include_comments: true,
        include_empty: false,
      });
      req.flush({ content: expectedContent });
    });
  });

  // ========== Sync ==========

  describe('Sync', () => {
    beforeEach(() => {
      localStorage.setItem('envsync_access_token', mockTokens.access_token);
    });

    it('should get sync status', (done) => {
      const mockStatus: SyncStatus = {
        state: 'Idle',
        pending_changes: 5,
        user: mockUser,
      };

      service.getSyncStatus().subscribe((status) => {
        expect(status).toEqual(mockStatus);
        done();
      });

      const req = httpMock.expectOne(`${baseApiUrl}/sync/status`);
      expect(req.request.method).toBe('GET');
      req.flush(mockStatus);
    });

    it('should trigger sync now', (done) => {
      const mockResult: SyncResult = {
        pushed: 3,
        pulled: 2,
        conflicts: 0,
        errors: [],
      };

      service.syncNow().subscribe((result) => {
        expect(result).toEqual(mockResult);
        done();
      });

      const req = httpMock.expectOne(`${baseApiUrl}/sync/sync`);
      expect(req.request.method).toBe('POST');
      expect(req.request.body).toEqual({ project_ids: undefined });
      req.flush(mockResult);
    });

    it('should trigger sync for specific projects', (done) => {
      const projectIds = ['proj-1', 'proj-2'];
      const mockResult: SyncResult = {
        pushed: 1,
        pulled: 1,
        conflicts: 0,
        errors: [],
      };

      service.syncNow(projectIds).subscribe((result) => {
        expect(result).toEqual(mockResult);
        done();
      });

      const req = httpMock.expectOne(`${baseApiUrl}/sync/sync`);
      expect(req.request.body).toEqual({ project_ids: projectIds });
      req.flush(mockResult);
    });

    it('should get sync conflicts', (done) => {
      const mockConflicts: ConflictInfo[] = [{
        project_id: 'proj-1',
        environment_id: 'env-1',
        variable_key: 'API_KEY',
        local_value: 'local',
        remote_value: 'remote',
        local_modified: '2024-01-01T00:00:00Z',
        remote_modified: '2024-01-02T00:00:00Z',
      }];

      service.getSyncConflicts().subscribe((conflicts) => {
        expect(conflicts).toEqual(mockConflicts);
        done();
      });

      const req = httpMock.expectOne(`${baseApiUrl}/sync/conflicts`);
      expect(req.request.method).toBe('GET');
      req.flush({ conflicts: mockConflicts });
    });

    it('should resolve a conflict', (done) => {
      service.resolveConflict('conflict-1', 'KeepLocal').subscribe(() => {
        done();
      });

      const req = httpMock.expectOne(`${baseApiUrl}/sync/conflicts/conflict-1/resolve`);
      expect(req.request.method).toBe('POST');
      expect(req.request.body).toEqual({
        conflict_id: 'conflict-1',
        resolution: 'KeepLocal',
        resolved_data: undefined,
      });
      req.flush(null);
    });
  });

  // ========== Teams ==========

  describe('Teams', () => {
    beforeEach(() => {
      localStorage.setItem('envsync_access_token', mockTokens.access_token);
    });

    it('should get all teams', (done) => {
      const mockTeams = [mockTeam];

      service.getTeams().subscribe((teams) => {
        expect(teams).toEqual(mockTeams);
        done();
      });

      const req = httpMock.expectOne(`${baseApiUrl}/teams`);
      expect(req.request.method).toBe('GET');
      req.flush(mockTeams);
    });

    it('should get a single team', (done) => {
      service.getTeam('team-1').subscribe((team) => {
        expect(team).toEqual(mockTeam);
        done();
      });

      const req = httpMock.expectOne(`${baseApiUrl}/teams/team-1`);
      expect(req.request.method).toBe('GET');
      req.flush(mockTeam);
    });

    it('should get team with members', (done) => {
      const mockTeamWithMembers: TeamWithMembers = {
        ...mockTeam,
        members: [],
        pending_invites: [],
      };

      service.getTeamWithMembers('team-1').subscribe((team) => {
        expect(team).toEqual(mockTeamWithMembers);
        done();
      });

      const req = httpMock.expectOne(`${baseApiUrl}/teams/team-1`);
      expect(req.request.method).toBe('GET');
      req.flush(mockTeamWithMembers);
    });

    it('should create a new team', (done) => {
      const name = 'New Team';
      const description = 'Team Description';

      service.createTeam(name, description, 2, 3).subscribe((team) => {
        expect(team).toEqual(mockTeam);
        done();
      });

      const req = httpMock.expectOne(`${baseApiUrl}/teams`);
      expect(req.request.method).toBe('POST');
      expect(req.request.body.name).toBe(name);
      expect(req.request.body.description).toBe(description);
      expect(req.request.body.veilkey_threshold).toBe(2);
      expect(req.request.body.veilkey_total_shares).toBe(3);
      expect(req.request.body.slug).toBe('new-team');
      req.flush(mockTeam);
    });

    it('should update a team', (done) => {
      service.updateTeam('team-1', 'Updated Team', 'Updated Description').subscribe((team) => {
        expect(team).toEqual(mockTeam);
        done();
      });

      const req = httpMock.expectOne(`${baseApiUrl}/teams/team-1`);
      expect(req.request.method).toBe('PUT');
      req.flush(mockTeam);
    });

    it('should delete a team', (done) => {
      service.deleteTeam('team-1').subscribe(() => {
        done();
      });

      const req = httpMock.expectOne(`${baseApiUrl}/teams/team-1`);
      expect(req.request.method).toBe('DELETE');
      req.flush(null);
    });
  });

  // ========== Team Members ==========

  describe('Team Members', () => {
    beforeEach(() => {
      localStorage.setItem('envsync_access_token', mockTokens.access_token);
    });

    it('should get team members', (done) => {
      const mockMembers: TeamMember[] = [];

      service.getTeamMembers('team-1').subscribe((members) => {
        expect(members).toEqual(mockMembers);
        done();
      });

      const req = httpMock.expectOne(`${baseApiUrl}/teams/team-1/members`);
      expect(req.request.method).toBe('GET');
      req.flush(mockMembers);
    });

    it('should invite a team member', (done) => {
      const mockInvite: TeamInvite = {
        id: 'invite-1',
        team_id: 'team-1',
        email: 'newmember@example.com',
        role: 'Member',
        status: 'Pending',
        invited_by: 'user-1',
        token: 'invite-token',
        expires_at: '2024-12-31T23:59:59Z',
        created_at: '2024-01-01T00:00:00Z',
      };

      service.inviteTeamMember('team-1', 'newmember@example.com', 'Member').subscribe((invite) => {
        expect(invite).toEqual(mockInvite);
        done();
      });

      const req = httpMock.expectOne(`${baseApiUrl}/teams/team-1/invites`);
      expect(req.request.method).toBe('POST');
      expect(req.request.body).toEqual({ email: 'newmember@example.com', role: 'Member' });
      req.flush(mockInvite);
    });

    it('should accept team invite', (done) => {
      const mockMember: TeamMember = {
        id: 'member-1',
        team_id: 'team-1',
        user_id: 'user-2',
        email: 'newmember@example.com',
        role: 'Member',
        joined_at: '2024-01-01T00:00:00Z',
        invited_by: 'user-1',
      };

      service.acceptTeamInvite('invite-token').subscribe((member) => {
        expect(member).toEqual(mockMember);
        done();
      });

      const req = httpMock.expectOne(`${baseApiUrl}/teams/invites/accept`);
      expect(req.request.method).toBe('POST');
      expect(req.request.body).toEqual({ token: 'invite-token' });
      req.flush(mockMember);
    });

    it('should update member role', (done) => {
      const mockMember: TeamMember = {
        id: 'member-1',
        team_id: 'team-1',
        user_id: 'user-2',
        email: 'member@example.com',
        role: 'Admin',
        joined_at: '2024-01-01T00:00:00Z',
        invited_by: 'user-1',
      };

      service.updateMemberRole('team-1', 'member-1', 'Admin').subscribe((member) => {
        expect(member).toEqual(mockMember);
        done();
      });

      const req = httpMock.expectOne(`${baseApiUrl}/teams/team-1/members/member-1`);
      expect(req.request.method).toBe('PUT');
      expect(req.request.body).toEqual({ role: 'Admin' });
      req.flush(mockMember);
    });

    it('should remove team member', (done) => {
      service.removeTeamMember('team-1', 'member-1').subscribe(() => {
        done();
      });

      const req = httpMock.expectOne(`${baseApiUrl}/teams/team-1/members/member-1`);
      expect(req.request.method).toBe('DELETE');
      req.flush(null);
    });
  });

  // ========== Audit Logs ==========

  describe('Audit Logs', () => {
    beforeEach(() => {
      localStorage.setItem('envsync_access_token', mockTokens.access_token);
    });

    it('should get team audit log', (done) => {
      const mockAuditEvents: AuditEvent[] = [{
        id: 'audit-1',
        event_type: 'TeamCreated',
        actor_id: 'user-1',
        actor_email: 'test@example.com',
        team_id: 'team-1',
        hash: 'hash123',
        timestamp: '2024-01-01T00:00:00Z',
      }];

      service.getTeamAuditLog('team-1', 1, 50).subscribe((result) => {
        expect(result.entries).toEqual(mockAuditEvents);
        expect(result.total).toBe(1);
        done();
      });

      const req = httpMock.expectOne(`${baseApiUrl}/teams/team-1/audit?page=1&page_size=50`);
      expect(req.request.method).toBe('GET');
      req.flush({ entries: mockAuditEvents, total: 1 });
    });

    it('should query audit log', (done) => {
      const query: AuditQuery = {
        event_types: ['TeamCreated', 'TeamUpdated'],
        team_id: 'team-1',
        limit: 100,
      };

      const mockAuditEvents: AuditEvent[] = [];

      service.queryAuditLog(query).subscribe((events) => {
        expect(events).toEqual(mockAuditEvents);
        done();
      });

      const req = httpMock.expectOne((request) => request.url === `${baseApiUrl}/admin/audit`);
      expect(req.request.method).toBe('GET');
      req.flush({ entries: mockAuditEvents });
    });
  });

  // ========== Error Handling ==========

  describe('Error Handling', () => {
    beforeEach(() => {
      localStorage.setItem('envsync_access_token', mockTokens.access_token);
    });

    it('should handle 401 unauthorized errors and logout', (done) => {
      service.getProjects().subscribe({
        next: () => fail('Should have errored'),
        error: (error) => {
          expect(error.message).toBe('Unauthorized - please login again');
          expect(localStorage.getItem('envsync_access_token')).toBeNull();
          done();
        },
      });

      const req = httpMock.expectOne(`${baseApiUrl}/projects`);
      req.flush({ detail: 'Invalid token' }, { status: 401, statusText: 'Unauthorized' });
    });

    it('should handle 403 forbidden errors', (done) => {
      service.getProjects().subscribe({
        next: () => fail('Should have errored'),
        error: (error) => {
          expect(error.message).toBe('Access denied');
          done();
        },
      });

      const req = httpMock.expectOne(`${baseApiUrl}/projects`);
      req.flush({}, { status: 403, statusText: 'Forbidden' });
    });

    it('should handle 404 not found errors', (done) => {
      service.getProject('non-existent').subscribe({
        next: () => fail('Should have errored'),
        error: (error) => {
          expect(error.message).toBe('Resource not found');
          done();
        },
      });

      const req = httpMock.expectOne(`${baseApiUrl}/projects/non-existent`);
      req.flush({}, { status: 404, statusText: 'Not Found' });
    });

    it('should handle server error with detail message', (done) => {
      service.getProjects().subscribe({
        next: () => fail('Should have errored'),
        error: (error) => {
          expect(error.message).toBe('Database connection failed');
          done();
        },
      });

      const req = httpMock.expectOne(`${baseApiUrl}/projects`);
      req.flush({ detail: 'Database connection failed' }, { status: 500, statusText: 'Internal Server Error' });
    });

    it('should handle network errors', (done) => {
      service.getProjects().subscribe({
        next: () => fail('Should have errored'),
        error: (error) => {
          expect(error.message).toBe('Network error');
          done();
        },
      });

      const req = httpMock.expectOne(`${baseApiUrl}/projects`);
      req.error(new ProgressEvent('error', { type: 'Network error' }));
    });
  });

  // ========== Observable Behavior ==========

  describe('Observable Behavior', () => {
    it('should emit user updates to subscribers', (done) => {
      let emissionCount = 0;

      service.user$.subscribe((user) => {
        emissionCount++;
        if (emissionCount === 2) {
          expect(user).toEqual(mockUser);
          done();
        }
      });

      service.login('test@example.com', 'password').subscribe();

      const req = httpMock.expectOne(`${baseApiUrl}/auth/login`);
      req.flush({ user: mockUser, access_token: mockTokens.access_token, refresh_token: mockTokens.refresh_token });
    });

    it('should emit authentication state to subscribers', (done) => {
      let emissionCount = 0;

      service.authenticated$.subscribe((authenticated) => {
        emissionCount++;
        if (emissionCount === 2) {
          expect(authenticated).toBe(true);
          done();
        }
      });

      service.login('test@example.com', 'password').subscribe();

      const req = httpMock.expectOne(`${baseApiUrl}/auth/login`);
      req.flush({ user: mockUser, access_token: mockTokens.access_token, refresh_token: mockTokens.refresh_token });
    });

    it('should update user on getCurrentUser call', (done) => {
      localStorage.setItem('envsync_access_token', mockTokens.access_token);

      service.user$.subscribe((user) => {
        if (user) {
          expect(user).toEqual(mockUser);
          done();
        }
      });

      service.getCurrentUser().subscribe();

      const req = httpMock.expectOne(`${baseApiUrl}/auth/me`);
      req.flush(mockUser);
    });
  });
});
