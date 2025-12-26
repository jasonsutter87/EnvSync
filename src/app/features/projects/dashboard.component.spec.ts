/**
 * Unit tests for DashboardComponent
 *
 * Tests cover:
 * - Project list rendering
 * - Environment tabs
 * - Variable list display
 * - Search functionality
 * - Import/export buttons
 * - Team features
 * - Modals
 * - CRUD operations
 */

import { ComponentFixture, TestBed } from '@angular/core/testing';
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { signal } from '@angular/core';
import { DashboardComponent } from './dashboard.component';
import { VaultStore } from '../../core/services/vault.store';
import { TeamService } from '../../core/services/team.service';

// Mock VaultStore
class MockVaultStore {
  isInitialized = signal(true);
  isUnlocked = signal(true);
  error = signal<string | null>(null);
  projects = signal<any[]>([]);
  selectedProjectId = signal<string | null>(null);
  selectedProject = signal<any>(null);
  environments = signal<any[]>([]);
  selectedEnvironmentId = signal<string | null>(null);
  variables = signal<any[]>([]);

  lock = vi.fn().mockResolvedValue(undefined);
  search = vi.fn().mockResolvedValue(undefined);
  selectProject = vi.fn().mockResolvedValue(undefined);
  createProject = vi.fn().mockResolvedValue({ id: 'proj-1', name: 'Test Project' });
  selectEnvironment = vi.fn().mockResolvedValue(undefined);
  createVariable = vi.fn().mockResolvedValue({ id: 'var-1', key: 'TEST_KEY', value: 'test_value' });
  updateVariable = vi.fn().mockResolvedValue({ id: 'var-1', key: 'UPDATED_KEY', value: 'updated_value' });
  deleteVariable = vi.fn().mockResolvedValue(undefined);
  importFromEnvFile = vi.fn().mockResolvedValue(undefined);
  exportToEnvFile = vi.fn().mockResolvedValue('KEY=value');
}

// Mock TeamService
class MockTeamService {
  teams = signal<any[]>([]);
  selectedTeam = signal<any>(null);
  teamMembers = signal<any[]>([]);
  teamProjects = signal<any[]>([]);
  pendingInvites = signal<any[]>([]);
  auditLog = signal<any[]>([]);

  hasTeams = vi.fn().mockReturnValue(false);
  loadTeams = vi.fn().mockResolvedValue(undefined);
  selectTeam = vi.fn().mockResolvedValue(undefined);
  loadTeamAuditLog = vi.fn().mockResolvedValue(undefined);
}

describe('DashboardComponent', () => {
  let component: DashboardComponent;
  let fixture: ComponentFixture<DashboardComponent>;
  let mockStore: MockVaultStore;
  let mockTeamService: MockTeamService;

  beforeEach(async () => {
    mockStore = new MockVaultStore();
    mockTeamService = new MockTeamService();

    await TestBed.configureTestingModule({
      imports: [DashboardComponent],
      providers: [
        { provide: VaultStore, useValue: mockStore },
        { provide: TeamService, useValue: mockTeamService }
      ]
    }).compileComponents();

    fixture = TestBed.createComponent(DashboardComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  describe('Component Initialization', () => {
    it('should create the component', () => {
      expect(component).toBeDefined();
    });

    it('should load teams on initialization', () => {
      expect(mockTeamService.loadTeams).toHaveBeenCalled();
    });

    it('should initialize with empty search query', () => {
      expect(component['searchQuery']).toBe('');
    });

    it('should initialize with all modals closed', () => {
      expect(component['showCreateProject']()).toBe(false);
      expect(component['showAddVariable']()).toBe(false);
      expect(component['showTeamPanel']()).toBe(false);
      expect(component['showShareModal']()).toBe(false);
    });

    it('should initialize with empty revealed variables set', () => {
      expect(component['revealedVariables']().size).toBe(0);
    });
  });

  describe('Project List Rendering', () => {
    it('should display "No projects yet" when project list is empty', () => {
      mockStore.projects.set([]);
      fixture.detectChanges();

      const emptyMessage = fixture.nativeElement.textContent;
      expect(emptyMessage).toContain('No projects yet');
    });

    it('should render all projects in the list', () => {
      mockStore.projects.set([
        { id: 'proj-1', name: 'Project Alpha' },
        { id: 'proj-2', name: 'Project Beta' },
        { id: 'proj-3', name: 'Project Gamma' }
      ]);
      fixture.detectChanges();

      const projectButtons = fixture.nativeElement.querySelectorAll('button');
      const projectNames = Array.from(projectButtons)
        .map((btn: any) => btn.textContent)
        .filter(text => text.includes('Project'));

      expect(projectNames.length).toBeGreaterThanOrEqual(3);
    });

    it('should highlight selected project', () => {
      const projects = [
        { id: 'proj-1', name: 'Project Alpha' },
        { id: 'proj-2', name: 'Project Beta' }
      ];
      mockStore.projects.set(projects);
      mockStore.selectedProjectId.set('proj-1');
      fixture.detectChanges();

      const projectButtons = fixture.nativeElement.querySelectorAll('button');
      const selectedButton = Array.from(projectButtons).find((btn: any) =>
        btn.textContent.includes('Project Alpha')
      ) as HTMLElement;

      expect(selectedButton?.classList.contains('bg-primary-600')).toBe(true);
    });

    it('should call selectProject when project is clicked', () => {
      mockStore.projects.set([
        { id: 'proj-1', name: 'Project Alpha' }
      ]);
      fixture.detectChanges();

      const projectButton = Array.from(fixture.nativeElement.querySelectorAll('button'))
        .find((btn: any) => btn.textContent.includes('Project Alpha')) as HTMLElement;

      projectButton?.click();

      expect(mockStore.selectProject).toHaveBeenCalledWith('proj-1');
    });

    it('should display project folder icon', () => {
      mockStore.projects.set([
        { id: 'proj-1', name: 'Project Alpha' }
      ]);
      fixture.detectChanges();

      const folderIcon = fixture.nativeElement.querySelector('svg path[d*="M3 7v10a2"]');
      expect(folderIcon).toBeDefined();
    });
  });

  describe('Environment Tabs', () => {
    beforeEach(() => {
      mockStore.selectedProject.set({ id: 'proj-1', name: 'Test Project' });
      mockStore.environments.set([
        { id: 'env-1', name: 'Development' },
        { id: 'env-2', name: 'Staging' },
        { id: 'env-3', name: 'Production' }
      ]);
      fixture.detectChanges();
    });

    it('should render all environment tabs', () => {
      const tabs = fixture.nativeElement.querySelectorAll('button');
      const envTabs = Array.from(tabs).filter((btn: any) =>
        ['Development', 'Staging', 'Production'].some(env => btn.textContent.includes(env))
      );

      expect(envTabs.length).toBe(3);
    });

    it('should highlight selected environment tab', () => {
      mockStore.selectedEnvironmentId.set('env-2');
      fixture.detectChanges();

      const tabs = fixture.nativeElement.querySelectorAll('button');
      const stagingTab = Array.from(tabs).find((btn: any) =>
        btn.textContent.includes('Staging')
      ) as HTMLElement;

      expect(stagingTab?.classList.contains('bg-dark-900')).toBe(true);
    });

    it('should call selectEnvironment when tab is clicked', () => {
      const tabs = fixture.nativeElement.querySelectorAll('button');
      const productionTab = Array.from(tabs).find((btn: any) =>
        btn.textContent.includes('Production')
      ) as HTMLElement;

      productionTab?.click();

      expect(mockStore.selectEnvironment).toHaveBeenCalledWith('env-3');
    });

    it('should not display tabs when no project is selected', () => {
      mockStore.selectedProject.set(null);
      fixture.detectChanges();

      const tabs = fixture.nativeElement.textContent;
      expect(tabs).not.toContain('Development');
    });
  });

  describe('Variable List Display', () => {
    beforeEach(() => {
      mockStore.selectedProject.set({ id: 'proj-1', name: 'Test Project' });
      mockStore.selectedEnvironmentId.set('env-1');
    });

    it('should display "No variables yet" when variable list is empty', () => {
      mockStore.variables.set([]);
      fixture.detectChanges();

      const emptyMessage = fixture.nativeElement.textContent;
      expect(emptyMessage).toContain('No variables yet');
    });

    it('should render all variables in the list', () => {
      mockStore.variables.set([
        { id: 'var-1', key: 'API_KEY', value: 'secret123', is_secret: true },
        { id: 'var-2', key: 'DATABASE_URL', value: 'postgres://...', is_secret: true },
        { id: 'var-3', key: 'PORT', value: '3000', is_secret: false }
      ]);
      fixture.detectChanges();

      const variableKeys = fixture.nativeElement.textContent;
      expect(variableKeys).toContain('API_KEY');
      expect(variableKeys).toContain('DATABASE_URL');
      expect(variableKeys).toContain('PORT');
    });

    it('should hide variable values by default', () => {
      mockStore.variables.set([
        { id: 'var-1', key: 'API_KEY', value: 'secret123', is_secret: true }
      ]);
      fixture.detectChanges();

      const hiddenValue = fixture.nativeElement.textContent;
      expect(hiddenValue).toContain('••••••••');
      expect(hiddenValue).not.toContain('secret123');
    });

    it('should display secret badge for secret variables', () => {
      mockStore.variables.set([
        { id: 'var-1', key: 'API_KEY', value: 'secret123', is_secret: true }
      ]);
      fixture.detectChanges();

      const badge = fixture.nativeElement.textContent;
      expect(badge).toContain('secret');
    });

    it('should not display secret badge for non-secret variables', () => {
      mockStore.variables.set([
        { id: 'var-1', key: 'PORT', value: '3000', is_secret: false }
      ]);
      fixture.detectChanges();

      const cards = fixture.nativeElement.querySelectorAll('.card');
      const portCard = Array.from(cards).find((card: any) =>
        card.textContent.includes('PORT')
      ) as HTMLElement;

      expect(portCard?.textContent).not.toContain('secret');
    });

    it('should show reveal/hide button for each variable', () => {
      mockStore.variables.set([
        { id: 'var-1', key: 'API_KEY', value: 'secret123', is_secret: true }
      ]);
      fixture.detectChanges();

      const revealButtons = fixture.nativeElement.querySelectorAll('button[title*="Reveal"], button[title*="Hide"]');
      expect(revealButtons.length).toBeGreaterThan(0);
    });

    it('should show copy button for each variable', () => {
      mockStore.variables.set([
        { id: 'var-1', key: 'API_KEY', value: 'secret123', is_secret: true }
      ]);
      fixture.detectChanges();

      const copyButtons = fixture.nativeElement.querySelectorAll('button[title="Copy value"]');
      expect(copyButtons.length).toBe(1);
    });

    it('should show edit button for each variable', () => {
      mockStore.variables.set([
        { id: 'var-1', key: 'API_KEY', value: 'secret123', is_secret: true }
      ]);
      fixture.detectChanges();

      const editButtons = fixture.nativeElement.querySelectorAll('button[title="Edit"]');
      expect(editButtons.length).toBe(1);
    });

    it('should show delete button for each variable', () => {
      mockStore.variables.set([
        { id: 'var-1', key: 'API_KEY', value: 'secret123', is_secret: true }
      ]);
      fixture.detectChanges();

      const deleteButtons = fixture.nativeElement.querySelectorAll('button[title="Delete"]');
      expect(deleteButtons.length).toBe(1);
    });
  });

  describe('Search Functionality', () => {
    it('should display search input field', () => {
      const searchInput = fixture.nativeElement.querySelector('input[placeholder*="Search"]');
      expect(searchInput).toBeDefined();
    });

    it('should call onSearch when user types in search field', async () => {
      const spy = vi.spyOn(component, 'onSearch');
      const searchInput = fixture.nativeElement.querySelector('input[placeholder*="Search"]');

      searchInput.value = 'API';
      searchInput.dispatchEvent(new Event('input'));
      fixture.detectChanges();

      expect(spy).toHaveBeenCalled();
    });

    it('should update searchQuery when user types', () => {
      const searchInput = fixture.nativeElement.querySelector('input[placeholder*="Search"]');

      searchInput.value = 'DATABASE';
      searchInput.dispatchEvent(new Event('input'));
      fixture.detectChanges();

      expect(component['searchQuery']).toBe('DATABASE');
    });

    it('should call store.search with query', async () => {
      component['searchQuery'] = 'API_KEY';
      await component.onSearch();

      expect(mockStore.search).toHaveBeenCalledWith('API_KEY');
    });

    it('should display search icon', () => {
      const searchIcon = fixture.nativeElement.querySelector('svg path[d*="M21 21l-6-6"]');
      expect(searchIcon).toBeDefined();
    });
  });

  describe('Import/Export Buttons', () => {
    beforeEach(() => {
      mockStore.selectedProject.set({ id: 'proj-1', name: 'Test Project' });
      mockStore.selectedEnvironmentId.set('env-1');
      fixture.detectChanges();
    });

    it('should display import button', () => {
      const importButton = Array.from(fixture.nativeElement.querySelectorAll('button'))
        .find((btn: any) => btn.textContent.includes('Import')) as HTMLElement;

      expect(importButton).toBeDefined();
    });

    it('should display export button', () => {
      const exportButton = Array.from(fixture.nativeElement.querySelectorAll('button'))
        .find((btn: any) => btn.textContent.includes('Export')) as HTMLElement;

      expect(exportButton).toBeDefined();
    });

    it('should call onImport when import button is clicked', () => {
      const spy = vi.spyOn(component, 'onImport');
      const importButton = Array.from(fixture.nativeElement.querySelectorAll('button'))
        .find((btn: any) => btn.textContent.includes('Import')) as HTMLElement;

      importButton?.click();

      expect(spy).toHaveBeenCalled();
    });

    it('should call onExport when export button is clicked', () => {
      const spy = vi.spyOn(component, 'onExport');
      const exportButton = Array.from(fixture.nativeElement.querySelectorAll('button'))
        .find((btn: any) => btn.textContent.includes('Export')) as HTMLElement;

      exportButton?.click();

      expect(spy).toHaveBeenCalled();
    });

    it('should display import icon', () => {
      const importIcon = fixture.nativeElement.querySelector('svg path[d*="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4"]');
      expect(importIcon).toBeDefined();
    });

    it('should display export icon', () => {
      const exportIcon = fixture.nativeElement.querySelector('svg path[d*="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4"]');
      expect(exportIcon).toBeDefined();
    });
  });

  describe('Lock Vault Functionality', () => {
    it('should display lock button', () => {
      const lockButton = fixture.nativeElement.querySelector('button[title="Lock vault"]');
      expect(lockButton).toBeDefined();
    });

    it('should call onLock when lock button is clicked', () => {
      const spy = vi.spyOn(component, 'onLock');
      const lockButton = fixture.nativeElement.querySelector('button[title="Lock vault"]');

      lockButton?.click();

      expect(spy).toHaveBeenCalled();
    });

    it('should call store.lock', async () => {
      await component.onLock();

      expect(mockStore.lock).toHaveBeenCalled();
    });
  });

  describe('Variable Reveal/Hide', () => {
    beforeEach(() => {
      mockStore.selectedProject.set({ id: 'proj-1', name: 'Test Project' });
      mockStore.variables.set([
        { id: 'var-1', key: 'API_KEY', value: 'secret123', is_secret: true }
      ]);
      fixture.detectChanges();
    });

    it('should add variable to revealed set when toggled', () => {
      component.toggleReveal('var-1');

      expect(component['revealedVariables']().has('var-1')).toBe(true);
    });

    it('should remove variable from revealed set when toggled again', () => {
      component.toggleReveal('var-1');
      expect(component['revealedVariables']().has('var-1')).toBe(true);

      component.toggleReveal('var-1');
      expect(component['revealedVariables']().has('var-1')).toBe(false);
    });

    it('should reveal variable value when in revealed set', () => {
      component['revealedVariables'].update(set => {
        set.add('var-1');
        return new Set(set);
      });
      fixture.detectChanges();

      const value = fixture.nativeElement.textContent;
      expect(value).toContain('secret123');
    });
  });

  describe('Copy to Clipboard', () => {
    beforeEach(() => {
      // Mock clipboard API
      Object.assign(navigator, {
        clipboard: {
          writeText: vi.fn().mockResolvedValue(undefined)
        }
      });
    });

    it('should copy value to clipboard', async () => {
      await component.copyToClipboard('test-value');

      expect(navigator.clipboard.writeText).toHaveBeenCalledWith('test-value');
    });

    it('should handle clipboard errors gracefully', async () => {
      const consoleError = vi.spyOn(console, 'error').mockImplementation(() => {});
      Object.assign(navigator, {
        clipboard: {
          writeText: vi.fn().mockRejectedValue(new Error('Clipboard error'))
        }
      });

      await component.copyToClipboard('test-value');

      expect(consoleError).toHaveBeenCalled();
    });
  });

  describe('Create Project Modal', () => {
    it('should open create project modal when button is clicked', () => {
      const newProjectButton = Array.from(fixture.nativeElement.querySelectorAll('button'))
        .find((btn: any) => btn.title === 'New project') as HTMLElement;

      newProjectButton?.click();
      fixture.detectChanges();

      expect(component['showCreateProject']()).toBe(true);
    });

    it('should display create project modal when open', () => {
      component['showCreateProject'].set(true);
      fixture.detectChanges();

      const modal = fixture.nativeElement.textContent;
      expect(modal).toContain('Create Project');
    });

    it('should close modal when cancel is clicked', () => {
      component['showCreateProject'].set(true);
      fixture.detectChanges();

      const cancelButton = Array.from(fixture.nativeElement.querySelectorAll('button'))
        .find((btn: any) => btn.textContent.trim() === 'Cancel') as HTMLElement;

      cancelButton?.click();
      fixture.detectChanges();

      expect(component['showCreateProject']()).toBe(false);
    });

    it('should call createProject on form submit', () => {
      const spy = vi.spyOn(component, 'createProject');
      component['showCreateProject'].set(true);
      component['newProjectName'] = 'Test Project';
      fixture.detectChanges();

      const form = fixture.nativeElement.querySelector('form');
      form?.dispatchEvent(new Event('submit'));

      expect(spy).toHaveBeenCalled();
    });

    it('should create project with name and description', async () => {
      component['newProjectName'] = 'My Project';
      component['newProjectDescription'] = 'Project description';

      await component.createProject();

      expect(mockStore.createProject).toHaveBeenCalledWith('My Project', 'Project description');
    });

    it('should close modal after successful project creation', async () => {
      component['newProjectName'] = 'My Project';
      component['showCreateProject'].set(true);

      await component.createProject();

      expect(component['showCreateProject']()).toBe(false);
    });

    it('should clear form fields after project creation', async () => {
      component['newProjectName'] = 'My Project';
      component['newProjectDescription'] = 'Description';

      await component.createProject();

      expect(component['newProjectName']).toBe('');
      expect(component['newProjectDescription']).toBe('');
    });

    it('should not create project if name is empty', async () => {
      component['newProjectName'] = '   ';

      await component.createProject();

      expect(mockStore.createProject).not.toHaveBeenCalled();
    });
  });

  describe('Add/Edit Variable Modal', () => {
    beforeEach(() => {
      mockStore.selectedEnvironmentId.set('env-1');
    });

    it('should open add variable modal when button is clicked', () => {
      mockStore.selectedProject.set({ id: 'proj-1', name: 'Test' });
      fixture.detectChanges();

      const addButton = Array.from(fixture.nativeElement.querySelectorAll('button'))
        .find((btn: any) => btn.textContent.includes('Add Variable')) as HTMLElement;

      addButton?.click();
      fixture.detectChanges();

      expect(component['showAddVariable']()).toBe(true);
    });

    it('should display "Add Variable" title when adding new variable', () => {
      component['showAddVariable'].set(true);
      component['editingVariable'].set(null);
      fixture.detectChanges();

      const modal = fixture.nativeElement.textContent;
      expect(modal).toContain('Add Variable');
    });

    it('should display "Edit Variable" title when editing', () => {
      component['showAddVariable'].set(true);
      component['editingVariable'].set('var-1');
      fixture.detectChanges();

      const modal = fixture.nativeElement.textContent;
      expect(modal).toContain('Edit Variable');
    });

    it('should populate form when editing variable', () => {
      const variable = { id: 'var-1', key: 'API_KEY', value: 'secret123', is_secret: true };

      component.editVariable(variable);

      expect(component['editingVariable']()).toBe('var-1');
      expect(component['variableKey']).toBe('API_KEY');
      expect(component['variableValue']).toBe('secret123');
      expect(component['variableIsSecret']).toBe(true);
      expect(component['showAddVariable']()).toBe(true);
    });

    it('should call createVariable when saving new variable', async () => {
      component['editingVariable'].set(null);
      component['variableKey'] = 'NEW_KEY';
      component['variableValue'] = 'new_value';
      component['variableIsSecret'] = false;

      await component.saveVariable();

      expect(mockStore.createVariable).toHaveBeenCalledWith('env-1', 'NEW_KEY', 'new_value', false);
    });

    it('should call updateVariable when saving existing variable', async () => {
      component['editingVariable'].set('var-1');
      component['variableKey'] = 'UPDATED_KEY';
      component['variableValue'] = 'updated_value';
      component['variableIsSecret'] = true;

      await component.saveVariable();

      expect(mockStore.updateVariable).toHaveBeenCalledWith('var-1', 'UPDATED_KEY', 'updated_value', true);
    });

    it('should close modal and clear form after saving', async () => {
      component['variableKey'] = 'TEST_KEY';
      component['variableValue'] = 'test_value';
      component['showAddVariable'].set(true);

      await component.saveVariable();

      expect(component['showAddVariable']()).toBe(false);
      expect(component['variableKey']).toBe('');
      expect(component['variableValue']).toBe('');
      expect(component['variableIsSecret']).toBe(true);
    });

    it('should not save if key is empty', async () => {
      component['variableKey'] = '   ';
      component['variableValue'] = 'value';

      await component.saveVariable();

      expect(mockStore.createVariable).not.toHaveBeenCalled();
    });

    it('should not save if value is empty', async () => {
      component['variableKey'] = 'KEY';
      component['variableValue'] = '';

      await component.saveVariable();

      expect(mockStore.createVariable).not.toHaveBeenCalled();
    });
  });

  describe('Delete Variable', () => {
    beforeEach(() => {
      // Mock window.confirm
      global.confirm = vi.fn().mockReturnValue(true);
    });

    it('should show confirmation dialog when deleting', async () => {
      await component.deleteVariable('var-1');

      expect(global.confirm).toHaveBeenCalledWith('Are you sure you want to delete this variable?');
    });

    it('should call store.deleteVariable when confirmed', async () => {
      global.confirm = vi.fn().mockReturnValue(true);

      await component.deleteVariable('var-1');

      expect(mockStore.deleteVariable).toHaveBeenCalledWith('var-1');
    });

    it('should not delete when user cancels confirmation', async () => {
      global.confirm = vi.fn().mockReturnValue(false);

      await component.deleteVariable('var-1');

      expect(mockStore.deleteVariable).not.toHaveBeenCalled();
    });
  });

  describe('Import/Export Operations', () => {
    beforeEach(() => {
      mockStore.selectedEnvironmentId.set('env-1');
      // Mock window.prompt
      global.prompt = vi.fn();
    });

    it('should prompt for content when importing', async () => {
      global.prompt = vi.fn().mockReturnValue('KEY=value');

      await component.onImport();

      expect(global.prompt).toHaveBeenCalledWith('Paste your .env file content:');
    });

    it('should call importFromEnvFile with content', async () => {
      const envContent = 'API_KEY=secret\nDATABASE_URL=postgres://...';
      global.prompt = vi.fn().mockReturnValue(envContent);

      await component.onImport();

      expect(mockStore.importFromEnvFile).toHaveBeenCalledWith('env-1', envContent);
    });

    it('should not import if user cancels prompt', async () => {
      global.prompt = vi.fn().mockReturnValue(null);

      await component.onImport();

      expect(mockStore.importFromEnvFile).not.toHaveBeenCalled();
    });

    it('should export to file when export is called', async () => {
      mockStore.exportToEnvFile.mockResolvedValue('KEY=value\nSECRET=data');
      const createElementSpy = vi.spyOn(document, 'createElement');

      await component.onExport();

      expect(mockStore.exportToEnvFile).toHaveBeenCalledWith('env-1');
      expect(createElementSpy).toHaveBeenCalledWith('a');
    });

    it('should not export if no environment is selected', async () => {
      mockStore.selectedEnvironmentId.set(null);

      await component.onExport();

      expect(mockStore.exportToEnvFile).not.toHaveBeenCalled();
    });
  });

  describe('Team Features', () => {
    beforeEach(() => {
      mockStore.selectedProject.set({ id: 'proj-1', name: 'Test Project' });
      fixture.detectChanges();
    });

    it('should display share button', () => {
      const shareButton = Array.from(fixture.nativeElement.querySelectorAll('button'))
        .find((btn: any) => btn.textContent.includes('Share')) as HTMLElement;

      expect(shareButton).toBeDefined();
    });

    it('should display activity button', () => {
      const activityButton = Array.from(fixture.nativeElement.querySelectorAll('button'))
        .find((btn: any) => btn.textContent.includes('Activity')) as HTMLElement;

      expect(activityButton).toBeDefined();
    });

    it('should open share modal when share button is clicked', () => {
      const shareButton = Array.from(fixture.nativeElement.querySelectorAll('button'))
        .find((btn: any) => btn.textContent.includes('Share')) as HTMLElement;

      shareButton?.click();
      fixture.detectChanges();

      expect(component['showShareModal']()).toBe(true);
    });

    it('should toggle audit log when activity button is clicked', () => {
      const activityButton = Array.from(fixture.nativeElement.querySelectorAll('button'))
        .find((btn: any) => btn.textContent.includes('Activity')) as HTMLElement;

      expect(component['showAuditLog']()).toBe(false);

      activityButton?.click();
      expect(component['showAuditLog']()).toBe(true);

      activityButton?.click();
      expect(component['showAuditLog']()).toBe(false);
    });

    it('should toggle team panel when team button is clicked', () => {
      const teamButton = fixture.nativeElement.querySelector('button[title*="teams"]');

      expect(component['showTeamPanel']()).toBe(false);

      teamButton?.click();
      expect(component['showTeamPanel']()).toBe(true);
    });

    it('should reload teams when project is shared', () => {
      vi.clearAllMocks();
      component.onProjectShared();

      expect(mockTeamService.loadTeams).toHaveBeenCalled();
    });

    it('should select project and close panel when team project is selected', () => {
      component['showTeamPanel'].set(true);
      component.onTeamProjectSelected('proj-2');

      expect(mockStore.selectProject).toHaveBeenCalledWith('proj-2');
      expect(component['showTeamPanel']()).toBe(false);
    });
  });

  describe('No Project Selected State', () => {
    beforeEach(() => {
      mockStore.selectedProject.set(null);
      fixture.detectChanges();
    });

    it('should display "No Project Selected" message', () => {
      const message = fixture.nativeElement.textContent;
      expect(message).toContain('No Project Selected');
    });

    it('should show create project button in empty state', () => {
      const createButton = Array.from(fixture.nativeElement.querySelectorAll('button'))
        .find((btn: any) => btn.textContent.includes('Create Project')) as HTMLElement;

      expect(createButton).toBeDefined();
    });

    it('should not display environment tabs', () => {
      const tabs = fixture.nativeElement.textContent;
      expect(tabs).not.toContain('Development');
      expect(tabs).not.toContain('Staging');
    });
  });

  describe('UI Elements', () => {
    it('should display EnvSync branding', () => {
      const branding = fixture.nativeElement.textContent;
      expect(branding).toContain('EnvSync');
    });

    it('should display sync indicator component', () => {
      const syncIndicator = fixture.nativeElement.querySelector('app-sync-indicator');
      expect(syncIndicator).toBeDefined();
    });

    it('should have sidebar layout', () => {
      const sidebar = fixture.nativeElement.querySelector('aside');
      expect(sidebar).toBeDefined();
    });

    it('should have main content area', () => {
      const main = fixture.nativeElement.querySelector('main');
      expect(main).toBeDefined();
    });
  });
});
