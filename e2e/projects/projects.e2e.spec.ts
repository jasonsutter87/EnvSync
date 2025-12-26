/**
 * EnvSync Project Management E2E Tests
 *
 * Comprehensive test suite covering project CRUD operations, validation,
 * list management, and project-environment relationships.
 */

import { test, expect, assertions } from '../fixtures/test-fixtures';
import { DashboardPage } from '../pages/dashboard-page';

test.describe('Project Management', () => {
  let dashboard: DashboardPage;

  test.beforeEach(async ({ authenticatedPage }) => {
    dashboard = new DashboardPage(authenticatedPage);
    await dashboard.goto();
    await dashboard.waitForLoad();
  });

  test.describe('Project CRUD Operations', () => {
    test('should create new project with name and description', async ({ authenticatedPage }) => {
      const projectName = `Test Project ${Date.now()}`;
      const projectDescription = 'This is a comprehensive test project';

      await dashboard.newProjectButton.click();
      await authenticatedPage.locator('[data-testid="project-name-input"]').fill(projectName);
      await authenticatedPage.locator('[data-testid="project-description-input"]').fill(projectDescription);
      await authenticatedPage.locator('[data-testid="create-project-submit"]').click();

      // Verify project appears in list
      await assertions.toHaveProject(authenticatedPage, projectName);

      // Verify project has description
      const projectItem = authenticatedPage.locator(`[data-testid="project-item"]:has-text("${projectName}")`);
      await expect(projectItem.locator('[data-testid="project-description"]')).toHaveText(projectDescription);
    });

    test('should create project with only name (no description)', async ({ authenticatedPage }) => {
      const projectName = `Minimal Project ${Date.now()}`;

      await dashboard.newProjectButton.click();
      await authenticatedPage.locator('[data-testid="project-name-input"]').fill(projectName);
      // Leave description empty
      await authenticatedPage.locator('[data-testid="create-project-submit"]').click();

      // Verify project appears in list
      await assertions.toHaveProject(authenticatedPage, projectName);

      // Verify no description is shown
      const projectItem = authenticatedPage.locator(`[data-testid="project-item"]:has-text("${projectName}")`);
      const description = projectItem.locator('[data-testid="project-description"]');
      await expect(description).toBeHidden().catch(() => expect(description).toHaveText(''));
    });

    test('should edit project name', async ({ authenticatedPage }) => {
      const originalName = `Original ${Date.now()}`;
      const newName = `Updated ${Date.now()}`;

      // Create project
      await dashboard.createProject(originalName);

      // Edit project name
      const projectItem = authenticatedPage.locator(`[data-testid="project-item"]:has-text("${originalName}")`);
      await projectItem.hover();
      await projectItem.locator('[data-testid="project-menu-button"]').click();
      await authenticatedPage.locator('[data-testid="edit-project-option"]').click();

      await authenticatedPage.locator('[data-testid="project-name-input"]').clear();
      await authenticatedPage.locator('[data-testid="project-name-input"]').fill(newName);
      await authenticatedPage.locator('[data-testid="save-project-button"]').click();

      // Verify name changed
      await assertions.toHaveProject(authenticatedPage, newName);
      await expect(authenticatedPage.locator(`[data-testid="project-item"]:has-text("${originalName}")`)).not.toBeVisible();
    });

    test('should edit project description', async ({ authenticatedPage }) => {
      const projectName = `Editable Project ${Date.now()}`;
      const originalDescription = 'Original description';
      const newDescription = 'Updated description with more details';

      // Create project with description
      await dashboard.createProject(projectName, originalDescription);

      // Edit description
      const projectItem = authenticatedPage.locator(`[data-testid="project-item"]:has-text("${projectName}")`);
      await projectItem.hover();
      await projectItem.locator('[data-testid="project-menu-button"]').click();
      await authenticatedPage.locator('[data-testid="edit-project-option"]').click();

      await authenticatedPage.locator('[data-testid="project-description-input"]').clear();
      await authenticatedPage.locator('[data-testid="project-description-input"]').fill(newDescription);
      await authenticatedPage.locator('[data-testid="save-project-button"]').click();

      // Verify description changed
      await expect(projectItem.locator('[data-testid="project-description"]')).toHaveText(newDescription);
    });

    test('should delete project with confirmation', async ({ authenticatedPage }) => {
      const projectName = `To Delete ${Date.now()}`;

      // Create project
      await dashboard.createProject(projectName);
      await assertions.toHaveProject(authenticatedPage, projectName);

      // Delete project
      const projectItem = authenticatedPage.locator(`[data-testid="project-item"]:has-text("${projectName}")`);
      await projectItem.hover();
      await projectItem.locator('[data-testid="project-menu-button"]').click();
      await authenticatedPage.locator('[data-testid="delete-project-option"]').click();

      // Verify confirmation dialog appears
      await expect(authenticatedPage.locator('[data-testid="delete-confirmation-dialog"]')).toBeVisible();
      await expect(authenticatedPage.locator('[data-testid="confirm-delete-message"]')).toContainText(projectName);

      // Confirm deletion
      await authenticatedPage.locator('[data-testid="confirm-delete-input"]').fill('DELETE');
      await authenticatedPage.locator('[data-testid="confirm-delete-button"]').click();

      // Verify project is removed
      await expect(projectItem).not.toBeVisible();
    });

    test('should cancel project deletion', async ({ authenticatedPage }) => {
      const projectName = `Not Deleted ${Date.now()}`;

      // Create project
      await dashboard.createProject(projectName);
      await assertions.toHaveProject(authenticatedPage, projectName);

      // Attempt to delete project
      const projectItem = authenticatedPage.locator(`[data-testid="project-item"]:has-text("${projectName}")`);
      await projectItem.hover();
      await projectItem.locator('[data-testid="project-menu-button"]').click();
      await authenticatedPage.locator('[data-testid="delete-project-option"]').click();

      // Cancel deletion
      await authenticatedPage.locator('[data-testid="cancel-delete-button"]').click();

      // Verify project still exists
      await assertions.toHaveProject(authenticatedPage, projectName);
    });

    test('should not delete without typing DELETE confirmation', async ({ authenticatedPage }) => {
      const projectName = `Safe Project ${Date.now()}`;

      // Create project
      await dashboard.createProject(projectName);

      // Attempt to delete
      const projectItem = authenticatedPage.locator(`[data-testid="project-item"]:has-text("${projectName}")`);
      await projectItem.hover();
      await projectItem.locator('[data-testid="project-menu-button"]').click();
      await authenticatedPage.locator('[data-testid="delete-project-option"]').click();

      // Try to confirm without typing DELETE
      const confirmButton = authenticatedPage.locator('[data-testid="confirm-delete-button"]');
      await expect(confirmButton).toBeDisabled();

      // Type wrong confirmation
      await authenticatedPage.locator('[data-testid="confirm-delete-input"]').fill('delete');
      await expect(confirmButton).toBeDisabled();
    });
  });

  test.describe('Project List', () => {
    test('should display all projects', async ({ authenticatedPage }) => {
      const projectNames = [
        `Project Alpha ${Date.now()}`,
        `Project Beta ${Date.now()}`,
        `Project Gamma ${Date.now()}`,
      ];

      // Create multiple projects
      for (const name of projectNames) {
        await dashboard.createProject(name);
      }

      // Verify all projects are visible
      for (const name of projectNames) {
        await assertions.toHaveProject(authenticatedPage, name);
      }

      const projectCount = await dashboard.getProjectCount();
      expect(projectCount).toBeGreaterThanOrEqual(3);
    });

    test('should search/filter projects by name', async ({ authenticatedPage }) => {
      const searchTerm = `SearchTest${Date.now()}`;
      const matchingProjects = [
        `${searchTerm} Alpha`,
        `${searchTerm} Beta`,
      ];
      const nonMatchingProject = `Other Project ${Date.now()}`;

      // Create projects
      for (const name of matchingProjects) {
        await dashboard.createProject(name);
      }
      await dashboard.createProject(nonMatchingProject);

      // Search for projects
      await dashboard.searchProjects(searchTerm);

      // Verify only matching projects are visible
      for (const name of matchingProjects) {
        await expect(authenticatedPage.locator(`[data-testid="project-item"]:has-text("${name}")`)).toBeVisible();
      }
      await expect(authenticatedPage.locator(`[data-testid="project-item"]:has-text("${nonMatchingProject}")`)).not.toBeVisible();
    });

    test('should filter projects by partial name match', async ({ authenticatedPage }) => {
      const projects = [
        `Development ${Date.now()}`,
        `Development Test ${Date.now()}`,
        `Production ${Date.now()}`,
      ];

      for (const name of projects) {
        await dashboard.createProject(name);
      }

      // Search with partial term
      await dashboard.searchProjects('Development');

      // Verify only matching projects visible
      await expect(authenticatedPage.locator(`[data-testid="project-item"]:has-text("${projects[0]}")`)).toBeVisible();
      await expect(authenticatedPage.locator(`[data-testid="project-item"]:has-text("${projects[1]}")`)).toBeVisible();
      await expect(authenticatedPage.locator(`[data-testid="project-item"]:has-text("${projects[2]}")`)).not.toBeVisible();
    });

    test('should clear search and show all projects', async ({ authenticatedPage }) => {
      const projects = [
        `Project One ${Date.now()}`,
        `Project Two ${Date.now()}`,
      ];

      for (const name of projects) {
        await dashboard.createProject(name);
      }

      // Search to filter
      await dashboard.searchProjects('One');
      await expect(authenticatedPage.locator(`[data-testid="project-item"]:has-text("${projects[1]}")`)).not.toBeVisible();

      // Clear search
      await dashboard.projectSearchInput.clear();
      await authenticatedPage.waitForTimeout(300);

      // All projects should be visible
      for (const name of projects) {
        await expect(authenticatedPage.locator(`[data-testid="project-item"]:has-text("${name}")`)).toBeVisible();
      }
    });

    test('should sort projects by name ascending', async ({ authenticatedPage }) => {
      const timestamp = Date.now();
      const projects = [
        `Zebra Project ${timestamp}`,
        `Alpha Project ${timestamp}`,
        `Beta Project ${timestamp}`,
      ];

      for (const name of projects) {
        await dashboard.createProject(name);
      }

      // Click sort by name
      await authenticatedPage.locator('[data-testid="sort-projects"]').click();
      await authenticatedPage.locator('[data-testid="sort-name-asc"]').click();

      // Verify order
      const projectItems = await authenticatedPage.locator('[data-testid="project-item"]').allTextContents();
      const sortedNames = projectItems.filter(text => text.includes(timestamp.toString()));

      // Check that Alpha comes before Beta which comes before Zebra
      const alphaIndex = sortedNames.findIndex(text => text.includes('Alpha'));
      const betaIndex = sortedNames.findIndex(text => text.includes('Beta'));
      const zebraIndex = sortedNames.findIndex(text => text.includes('Zebra'));

      expect(alphaIndex).toBeLessThan(betaIndex);
      expect(betaIndex).toBeLessThan(zebraIndex);
    });

    test('should sort projects by name descending', async ({ authenticatedPage }) => {
      const timestamp = Date.now();
      const projects = [
        `Alpha Project ${timestamp}`,
        `Zebra Project ${timestamp}`,
        `Beta Project ${timestamp}`,
      ];

      for (const name of projects) {
        await dashboard.createProject(name);
      }

      // Click sort by name descending
      await authenticatedPage.locator('[data-testid="sort-projects"]').click();
      await authenticatedPage.locator('[data-testid="sort-name-desc"]').click();

      // Verify order (Zebra, Beta, Alpha)
      const projectItems = await authenticatedPage.locator('[data-testid="project-item"]').allTextContents();
      const sortedNames = projectItems.filter(text => text.includes(timestamp.toString()));

      const alphaIndex = sortedNames.findIndex(text => text.includes('Alpha'));
      const betaIndex = sortedNames.findIndex(text => text.includes('Beta'));
      const zebraIndex = sortedNames.findIndex(text => text.includes('Zebra'));

      expect(zebraIndex).toBeLessThan(betaIndex);
      expect(betaIndex).toBeLessThan(alphaIndex);
    });

    test('should sort projects by date created (newest first)', async ({ authenticatedPage }) => {
      // Create projects with delay to ensure different timestamps
      const project1 = `First ${Date.now()}`;
      await dashboard.createProject(project1);

      await authenticatedPage.waitForTimeout(100);

      const project2 = `Second ${Date.now()}`;
      await dashboard.createProject(project2);

      await authenticatedPage.waitForTimeout(100);

      const project3 = `Third ${Date.now()}`;
      await dashboard.createProject(project3);

      // Sort by date newest first
      await authenticatedPage.locator('[data-testid="sort-projects"]').click();
      await authenticatedPage.locator('[data-testid="sort-date-newest"]').click();

      // Verify Third appears before Second which appears before First
      const projectItems = await dashboard.projectItems.all();
      const texts = await Promise.all(projectItems.map(item => item.textContent()));

      const firstIndex = texts.findIndex(text => text?.includes('First'));
      const secondIndex = texts.findIndex(text => text?.includes('Second'));
      const thirdIndex = texts.findIndex(text => text?.includes('Third'));

      expect(thirdIndex).toBeLessThan(secondIndex);
      expect(secondIndex).toBeLessThan(firstIndex);
    });

    test('should sort projects by date created (oldest first)', async ({ authenticatedPage }) => {
      // Create projects with delay
      const project1 = `First ${Date.now()}`;
      await dashboard.createProject(project1);

      await authenticatedPage.waitForTimeout(100);

      const project2 = `Second ${Date.now()}`;
      await dashboard.createProject(project2);

      // Sort by date oldest first
      await authenticatedPage.locator('[data-testid="sort-projects"]').click();
      await authenticatedPage.locator('[data-testid="sort-date-oldest"]').click();

      // Verify First appears before Second
      const projectItems = await dashboard.projectItems.all();
      const texts = await Promise.all(projectItems.map(item => item.textContent()));

      const firstIndex = texts.findIndex(text => text?.includes('First'));
      const secondIndex = texts.findIndex(text => text?.includes('Second'));

      expect(firstIndex).toBeLessThan(secondIndex);
    });

    test('should display empty state when no projects', async ({ authenticatedPage }) => {
      // Delete all existing projects
      const existingProjects = await dashboard.projectItems.all();
      for (const project of existingProjects) {
        const projectName = await project.textContent();
        if (projectName) {
          await project.hover();
          await project.locator('[data-testid="project-menu-button"]').click();
          await authenticatedPage.locator('[data-testid="delete-project-option"]').click();
          await authenticatedPage.locator('[data-testid="confirm-delete-input"]').fill('DELETE');
          await authenticatedPage.locator('[data-testid="confirm-delete-button"]').click();
        }
      }

      // Verify empty state
      await expect(authenticatedPage.locator('[data-testid="empty-projects-state"]')).toBeVisible();
      await expect(authenticatedPage.locator('[data-testid="empty-projects-message"]')).toContainText('No projects yet');
      await expect(authenticatedPage.locator('[data-testid="empty-projects-cta"]')).toContainText('Create your first project');
    });

    test('should display empty state when search has no results', async ({ authenticatedPage }) => {
      await dashboard.createProject(`Test Project ${Date.now()}`);

      // Search for non-existent project
      await dashboard.searchProjects('NonExistentProject12345');

      // Verify empty search results state
      await expect(authenticatedPage.locator('[data-testid="no-search-results"]')).toBeVisible();
      await expect(authenticatedPage.locator('[data-testid="no-search-results-message"]')).toContainText('No projects found');
    });

    test('should select project and display its details', async ({ authenticatedPage }) => {
      const projectName = `Selectable Project ${Date.now()}`;
      const description = 'This project should be selectable';

      await dashboard.createProject(projectName, description);

      // Select project
      await dashboard.selectProject(projectName);

      // Verify project is selected (highlighted/active)
      const projectItem = authenticatedPage.locator(`[data-testid="project-item"]:has-text("${projectName}")`);
      await expect(projectItem).toHaveClass(/active|selected/);

      // Verify project details are displayed in main area
      await expect(authenticatedPage.locator('[data-testid="project-name-header"]')).toContainText(projectName);
      await expect(authenticatedPage.locator('[data-testid="project-description-display"]')).toContainText(description);
    });

    test('should maintain selection when performing other actions', async ({ authenticatedPage }) => {
      const project1 = `Project 1 ${Date.now()}`;
      const project2 = `Project 2 ${Date.now()}`;

      await dashboard.createProject(project1);
      await dashboard.createProject(project2);

      // Select first project
      await dashboard.selectProject(project1);
      const selectedProject = authenticatedPage.locator(`[data-testid="project-item"]:has-text("${project1}")`);
      await expect(selectedProject).toHaveClass(/active|selected/);

      // Perform search
      await dashboard.searchProjects(project1);

      // Verify selection maintained
      await expect(selectedProject).toHaveClass(/active|selected/);
    });
  });

  test.describe('Project Validation', () => {
    test('should prevent creating project with empty name', async ({ authenticatedPage }) => {
      await dashboard.newProjectButton.click();

      // Try to submit with empty name
      const submitButton = authenticatedPage.locator('[data-testid="create-project-submit"]');
      await expect(submitButton).toBeDisabled();

      // Verify error message
      await authenticatedPage.locator('[data-testid="project-name-input"]').blur();
      await expect(authenticatedPage.locator('[data-testid="project-name-error"]')).toContainText('required');
    });

    test('should prevent creating project with only whitespace name', async ({ authenticatedPage }) => {
      await dashboard.newProjectButton.click();

      // Fill with whitespace
      await authenticatedPage.locator('[data-testid="project-name-input"]').fill('   ');

      const submitButton = authenticatedPage.locator('[data-testid="create-project-submit"]');
      await expect(submitButton).toBeDisabled();

      await expect(authenticatedPage.locator('[data-testid="project-name-error"]')).toContainText('required');
    });

    test('should handle duplicate project names', async ({ authenticatedPage }) => {
      const projectName = `Duplicate Test ${Date.now()}`;

      // Create first project
      await dashboard.createProject(projectName);

      // Try to create second project with same name
      await dashboard.newProjectButton.click();
      await authenticatedPage.locator('[data-testid="project-name-input"]').fill(projectName);
      await authenticatedPage.locator('[data-testid="create-project-submit"]').click();

      // Verify error message
      await expect(authenticatedPage.locator('[data-testid="project-name-error"]')).toContainText('already exists');

      // Dialog should remain open
      await expect(authenticatedPage.locator('[data-testid="create-project-dialog"]')).toBeVisible();
    });

    test('should validate max length for project name', async ({ authenticatedPage }) => {
      await dashboard.newProjectButton.click();

      // Try to enter very long name (>100 characters)
      const longName = 'A'.repeat(150);
      await authenticatedPage.locator('[data-testid="project-name-input"]').fill(longName);

      // Verify error or truncation
      await expect(authenticatedPage.locator('[data-testid="project-name-error"]')).toContainText('too long');

      const submitButton = authenticatedPage.locator('[data-testid="create-project-submit"]');
      await expect(submitButton).toBeDisabled();
    });

    test('should validate max length for project description', async ({ authenticatedPage }) => {
      await dashboard.newProjectButton.click();

      const validName = `Valid Project ${Date.now()}`;
      const longDescription = 'A'.repeat(1000);

      await authenticatedPage.locator('[data-testid="project-name-input"]').fill(validName);
      await authenticatedPage.locator('[data-testid="project-description-input"]').fill(longDescription);

      // Verify error for description
      await expect(authenticatedPage.locator('[data-testid="project-description-error"]')).toContainText('too long');

      const submitButton = authenticatedPage.locator('[data-testid="create-project-submit"]');
      await expect(submitButton).toBeDisabled();
    });

    test('should accept special characters in project name', async ({ authenticatedPage }) => {
      const projectName = `Test-Project_123 (v2.0) ${Date.now()}`;

      await dashboard.createProject(projectName);

      // Verify project created successfully
      await assertions.toHaveProject(authenticatedPage, projectName);
    });

    test('should reject invalid special characters in project name', async ({ authenticatedPage }) => {
      await dashboard.newProjectButton.click();

      // Try names with invalid characters
      const invalidNames = [
        'Project/Name',
        'Project\\Name',
        'Project|Name',
        'Project<Name>',
      ];

      for (const name of invalidNames) {
        await authenticatedPage.locator('[data-testid="project-name-input"]').clear();
        await authenticatedPage.locator('[data-testid="project-name-input"]').fill(name);
        await authenticatedPage.locator('[data-testid="project-name-input"]').blur();

        // Verify error message
        await expect(authenticatedPage.locator('[data-testid="project-name-error"]')).toContainText('invalid character');
      }
    });

    test('should trim whitespace from project name', async ({ authenticatedPage }) => {
      const projectName = `Trimmed Project ${Date.now()}`;
      const nameWithWhitespace = `  ${projectName}  `;

      await dashboard.newProjectButton.click();
      await authenticatedPage.locator('[data-testid="project-name-input"]').fill(nameWithWhitespace);
      await authenticatedPage.locator('[data-testid="create-project-submit"]').click();

      // Verify project created with trimmed name
      const projectItem = authenticatedPage.locator(`[data-testid="project-item"]:has-text("${projectName}")`);
      await expect(projectItem).toBeVisible();

      const displayedName = await projectItem.locator('[data-testid="project-name"]').textContent();
      expect(displayedName?.trim()).toBe(projectName);
    });

    test('should show character count for project name', async ({ authenticatedPage }) => {
      await dashboard.newProjectButton.click();

      const nameInput = authenticatedPage.locator('[data-testid="project-name-input"]');
      const charCount = authenticatedPage.locator('[data-testid="project-name-char-count"]');

      // Verify initial count
      await expect(charCount).toContainText('0');

      // Type and verify count updates
      await nameInput.fill('Test');
      await expect(charCount).toContainText('4');

      await nameInput.fill('Test Project Name');
      await expect(charCount).toContainText('17');
    });

    test('should show character count for project description', async ({ authenticatedPage }) => {
      await dashboard.newProjectButton.click();

      const descInput = authenticatedPage.locator('[data-testid="project-description-input"]');
      const charCount = authenticatedPage.locator('[data-testid="project-description-char-count"]');

      await expect(charCount).toContainText('0');

      await descInput.fill('This is a test description');
      await expect(charCount).toContainText('26');
    });
  });

  test.describe('Project with Environments', () => {
    test('should create project then add environment', async ({ authenticatedPage }) => {
      const projectName = `Project with Env ${Date.now()}`;
      const envName = 'development';

      // Create project
      await dashboard.createProject(projectName);
      await dashboard.selectProject(projectName);

      // Add environment
      await dashboard.createEnvironment(envName);

      // Verify environment exists
      await assertions.toHaveEnvironment(authenticatedPage, envName);
    });

    test('should add multiple environments to project', async ({ authenticatedPage }) => {
      const projectName = `Multi Env Project ${Date.now()}`;
      const environments = ['development', 'staging', 'production'];

      // Create project
      await dashboard.createProject(projectName);
      await dashboard.selectProject(projectName);

      // Add multiple environments
      for (const env of environments) {
        await dashboard.createEnvironment(env);
      }

      // Verify all environments exist
      for (const env of environments) {
        await assertions.toHaveEnvironment(authenticatedPage, env);
      }
    });

    test('should delete project with environments (cascade delete)', async ({ authenticatedPage }) => {
      const projectName = `Cascade Delete ${Date.now()}`;
      const envName = 'development';

      // Create project with environment
      await dashboard.createProject(projectName);
      await dashboard.selectProject(projectName);
      await dashboard.createEnvironment(envName);
      await assertions.toHaveEnvironment(authenticatedPage, envName);

      // Delete project
      const projectItem = authenticatedPage.locator(`[data-testid="project-item"]:has-text("${projectName}")`);
      await projectItem.hover();
      await projectItem.locator('[data-testid="project-menu-button"]').click();
      await authenticatedPage.locator('[data-testid="delete-project-option"]').click();

      // Verify warning about cascade delete
      await expect(authenticatedPage.locator('[data-testid="cascade-delete-warning"]')).toBeVisible();
      await expect(authenticatedPage.locator('[data-testid="cascade-delete-warning"]')).toContainText('environment');

      // Confirm deletion
      await authenticatedPage.locator('[data-testid="confirm-delete-input"]').fill('DELETE');
      await authenticatedPage.locator('[data-testid="confirm-delete-button"]').click();

      // Verify project and environments deleted
      await expect(projectItem).not.toBeVisible();
      await expect(authenticatedPage.locator(`[data-testid="environment-tab"]:has-text("${envName}")`)).not.toBeVisible();
    });

    test('should show environment count in project list', async ({ authenticatedPage }) => {
      const projectName = `Project with Count ${Date.now()}`;

      // Create project
      await dashboard.createProject(projectName);
      await dashboard.selectProject(projectName);

      // Add environments
      await dashboard.createEnvironment('dev');
      await dashboard.createEnvironment('prod');

      // Go back to project list view
      await dashboard.projectList.click();

      // Verify environment count badge
      const projectItem = authenticatedPage.locator(`[data-testid="project-item"]:has-text("${projectName}")`);
      await expect(projectItem.locator('[data-testid="environment-count-badge"]')).toContainText('2');
    });

    test('should navigate between projects without losing environment data', async ({ authenticatedPage }) => {
      const project1 = `Project 1 ${Date.now()}`;
      const project2 = `Project 2 ${Date.now()}`;

      // Create two projects with environments
      await dashboard.createProject(project1);
      await dashboard.selectProject(project1);
      await dashboard.createEnvironment('dev1');

      await dashboard.createProject(project2);
      await dashboard.selectProject(project2);
      await dashboard.createEnvironment('dev2');

      // Navigate back to first project
      await dashboard.selectProject(project1);
      await assertions.toHaveEnvironment(authenticatedPage, 'dev1');
      await expect(authenticatedPage.locator('[data-testid="environment-tab"]:has-text("dev2")')).not.toBeVisible();

      // Navigate to second project
      await dashboard.selectProject(project2);
      await assertions.toHaveEnvironment(authenticatedPage, 'dev2');
      await expect(authenticatedPage.locator('[data-testid="environment-tab"]:has-text("dev1")')).not.toBeVisible();
    });

    test('should prevent deleting project with environments without confirmation', async ({ authenticatedPage }) => {
      const projectName = `Protected Project ${Date.now()}`;

      // Create project with environment
      await dashboard.createProject(projectName);
      await dashboard.selectProject(projectName);
      await dashboard.createEnvironment('development');

      // Attempt to delete
      const projectItem = authenticatedPage.locator(`[data-testid="project-item"]:has-text("${projectName}")`);
      await projectItem.hover();
      await projectItem.locator('[data-testid="project-menu-button"]').click();
      await authenticatedPage.locator('[data-testid="delete-project-option"]').click();

      // Verify cannot confirm without typing DELETE
      const confirmButton = authenticatedPage.locator('[data-testid="confirm-delete-button"]');
      await expect(confirmButton).toBeDisabled();

      // Type wrong confirmation
      await authenticatedPage.locator('[data-testid="confirm-delete-input"]').fill('delete');
      await expect(confirmButton).toBeDisabled();
    });

    test('should display empty state for project with no environments', async ({ authenticatedPage }) => {
      const projectName = `Empty Env Project ${Date.now()}`;

      await dashboard.createProject(projectName);
      await dashboard.selectProject(projectName);

      // Verify empty state
      await expect(authenticatedPage.locator('[data-testid="empty-environments-state"]')).toBeVisible();
      await expect(authenticatedPage.locator('[data-testid="empty-environments-message"]')).toContainText('No environments');
    });

    test('should copy project with environments', async ({ authenticatedPage }) => {
      const originalProject = `Original ${Date.now()}`;
      const copiedProject = `Copy of ${originalProject}`;

      // Create project with environment
      await dashboard.createProject(originalProject);
      await dashboard.selectProject(originalProject);
      await dashboard.createEnvironment('development');
      await dashboard.createEnvironment('production');

      // Copy project
      const projectItem = authenticatedPage.locator(`[data-testid="project-item"]:has-text("${originalProject}")`);
      await projectItem.hover();
      await projectItem.locator('[data-testid="project-menu-button"]').click();
      await authenticatedPage.locator('[data-testid="copy-project-option"]').click();

      await authenticatedPage.locator('[data-testid="copy-project-name-input"]').fill(copiedProject);
      await authenticatedPage.locator('[data-testid="copy-environments-checkbox"]').check();
      await authenticatedPage.locator('[data-testid="confirm-copy-button"]').click();

      // Verify copied project has environments
      await dashboard.selectProject(copiedProject);
      await assertions.toHaveEnvironment(authenticatedPage, 'development');
      await assertions.toHaveEnvironment(authenticatedPage, 'production');
    });

    test('should show last modified time for projects', async ({ authenticatedPage }) => {
      const projectName = `Timestamped ${Date.now()}`;

      await dashboard.createProject(projectName);

      const projectItem = authenticatedPage.locator(`[data-testid="project-item"]:has-text("${projectName}")`);
      const timestamp = projectItem.locator('[data-testid="project-last-modified"]');

      await expect(timestamp).toBeVisible();
      await expect(timestamp).toContainText(/just now|seconds ago|minutes ago/);
    });

    test('should export project with all environments', async ({ authenticatedPage }) => {
      const projectName = `Export Test ${Date.now()}`;

      // Create project with environments
      await dashboard.createProject(projectName);
      await dashboard.selectProject(projectName);
      await dashboard.createEnvironment('development');
      await dashboard.createEnvironment('production');

      // Export project
      const projectItem = authenticatedPage.locator(`[data-testid="project-item"]:has-text("${projectName}")`);
      await projectItem.hover();
      await projectItem.locator('[data-testid="project-menu-button"]').click();

      const [download] = await Promise.all([
        authenticatedPage.waitForEvent('download'),
        authenticatedPage.locator('[data-testid="export-project-option"]').click(),
      ]);

      // Verify download started
      expect(download.suggestedFilename()).toContain(projectName.replace(/\s+/g, '-').toLowerCase());
    });
  });
});
