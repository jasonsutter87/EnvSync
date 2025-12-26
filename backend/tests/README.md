# EnvSync Backend Tests

Comprehensive test suite for the EnvSync FastAPI backend.

## Overview

This test suite provides extensive coverage of:
- **Authentication & Authorization** - User registration, login, JWT tokens, API keys
- **Project Management** - CRUD operations, archiving, search
- **Environment Management** - Environment lifecycle, cloning, ordering
- **Variable Management** - Encrypted variables, secret handling, bulk operations, import/export
- **Data Validation** - Input validation, error handling
- **Security** - Password hashing, encryption, access control

## Test Structure

```
tests/
├── conftest.py              # Test fixtures and configuration
├── test_auth.py             # Authentication tests (20+ tests)
├── test_projects.py         # Project API tests (30+ tests)
├── test_environments.py     # Environment API tests (30+ tests)
├── test_variables.py        # Variable API tests (30+ tests)
└── README.md               # This file
```

## Running Tests

### Prerequisites

1. **PostgreSQL Test Database**
   ```bash
   createdb envsync_test
   ```

2. **Install Dependencies**
   ```bash
   pip install -r requirements.txt
   ```

### Run All Tests

```bash
pytest
```

### Run Specific Test Files

```bash
# Authentication tests only
pytest tests/test_auth.py

# Project tests only
pytest tests/test_projects.py

# Environment tests only
pytest tests/test_environments.py

# Variable tests only
pytest tests/test_variables.py
```

### Run Tests by Marker

```bash
# Run only authentication tests
pytest -m auth

# Run only API tests
pytest -m api

# Skip slow tests
pytest -m "not slow"
```

### Run Specific Tests

```bash
# Run a specific test function
pytest tests/test_auth.py::test_login_success

# Run tests matching a pattern
pytest -k "test_create"
```

### Coverage Reports

```bash
# Run with coverage
pytest --cov=app --cov-report=html

# View HTML coverage report
open htmlcov/index.html
```

### Verbose Output

```bash
# Show detailed output
pytest -v

# Show even more detail
pytest -vv

# Show print statements
pytest -s
```

## Test Database

Tests use a separate `envsync_test` database that is:
- Created fresh for each test
- Isolated from production data
- Automatically cleaned up after tests

**Database URL**: `postgresql://envsync:envsync@localhost:5432/envsync_test`

To change the test database, update `TEST_DATABASE_URL` in `conftest.py`.

## Fixtures

The test suite provides rich fixtures for common test scenarios:

### User Fixtures
- `test_user` - Standard active user
- `admin_user` - Admin user with elevated privileges
- `inactive_user` - Suspended/inactive user
- `auth_headers` - Authentication headers for test_user
- `admin_headers` - Authentication headers for admin_user

### Project Fixtures
- `test_project` - Standard project with owner
- `archived_project` - Archived project

### Environment Fixtures
- `test_environment` - Development environment
- `staging_environment` - Staging environment
- `production_environment` - Production environment

### Variable Fixtures
- `test_variable` - Secret database variable
- `api_key_variable` - API key variable
- `public_variable` - Non-secret configuration variable

### Factory Fixtures
- `user_factory` - Create users with custom attributes
- `project_factory` - Create projects with environments
- `environment_factory` - Create environments
- `variable_factory` - Create variables

### Example Usage

```python
@pytest.mark.asyncio
async def test_example(
    client: AsyncClient,
    auth_headers: dict,
    test_project: Project,
    variable_factory,
):
    # Create a custom variable
    var = await variable_factory.create(
        db_session,
        test_environment,
        key="CUSTOM_VAR",
        is_secret=False
    )

    # Make authenticated request
    response = await client.get(
        f"/api/projects/{test_project.id}",
        headers=auth_headers
    )
    assert response.status_code == 200
```

## Test Categories

### Authentication Tests (test_auth.py)
- ✅ User registration with validation
- ✅ Login with credentials and device info
- ✅ Token refresh and expiration
- ✅ Logout and session invalidation
- ✅ Password change with verification
- ✅ API key creation and management
- ✅ Token validation and security
- ✅ Multiple sessions per user

### Project Tests (test_projects.py)
- ✅ List projects with pagination
- ✅ Create projects with environments
- ✅ Get project details with relationships
- ✅ Update project metadata
- ✅ Delete projects with cascade
- ✅ Archive/unarchive functionality
- ✅ Search variables across projects
- ✅ Authorization checks

### Environment Tests (test_environments.py)
- ✅ List environments ordered by display_order
- ✅ Create environments with validation
- ✅ Get environment with variables
- ✅ Update environment details
- ✅ Delete environments with cascade
- ✅ Clone environments with variables
- ✅ Duplicate name prevention
- ✅ Color and ordering management

### Variable Tests (test_variables.py)
- ✅ List variables ordered by key
- ✅ Create encrypted variables
- ✅ Bulk variable creation
- ✅ Get variable with metadata
- ✅ Update variables with versioning
- ✅ Delete variables
- ✅ Import/export .env files
- ✅ Secret vs public variables
- ✅ Encryption format validation
- ✅ Version history tracking

## Writing New Tests

### Test Naming Convention

```python
# Good test names describe what they test
async def test_create_project_success(...)
async def test_create_project_duplicate_name(...)
async def test_create_project_unauthorized(...)

# Follow pattern: test_<action>_<scenario>
```

### Test Structure

```python
@pytest.mark.asyncio
async def test_example(
    client: AsyncClient,  # Test HTTP client
    auth_headers: dict,   # Authentication
    db_session: AsyncSession,  # Database access
):
    """Test description explaining what this tests."""
    # Arrange - Setup test data
    test_data = {"key": "value"}

    # Act - Perform the action
    response = await client.post("/api/endpoint", json=test_data, headers=auth_headers)

    # Assert - Verify the outcome
    assert response.status_code == 200
    assert response.json()["key"] == "value"
```

### Common Patterns

```python
# Testing success cases
async def test_operation_success(...)

# Testing validation
async def test_operation_missing_required_field(...)
async def test_operation_invalid_format(...)

# Testing authorization
async def test_operation_unauthorized(...)
async def test_operation_forbidden(...)

# Testing not found
async def test_operation_not_found(...)

# Testing edge cases
async def test_operation_empty_list(...)
async def test_operation_max_length(...)
```

## Continuous Integration

Tests are designed to run in CI/CD pipelines:

```yaml
# Example GitHub Actions
- name: Run tests
  run: |
    pytest --cov=app --cov-report=xml

- name: Upload coverage
  uses: codecov/codecov-action@v3
```

## Troubleshooting

### Database Connection Issues

```bash
# Check PostgreSQL is running
pg_isready

# Create test database
createdb envsync_test

# Grant permissions
psql -c "GRANT ALL PRIVILEGES ON DATABASE envsync_test TO envsync;"
```

### Import Errors

```bash
# Install in editable mode
pip install -e .

# Or add to PYTHONPATH
export PYTHONPATH="${PYTHONPATH}:$(pwd)"
```

### Async Warnings

If you see warnings about event loops, ensure:
1. `pytest-asyncio` is installed
2. `asyncio_mode = auto` is set in pytest.ini
3. Tests are marked with `@pytest.mark.asyncio`

## Best Practices

1. **Isolation** - Each test is independent and doesn't rely on others
2. **Cleanup** - Database is reset between tests
3. **Factories** - Use factories for creating test data
4. **Assertions** - Clear, specific assertions
5. **Documentation** - Docstrings explain what each test verifies
6. **Coverage** - Aim for >80% code coverage
7. **Performance** - Keep tests fast (<100ms each)

## Contributing

When adding new features:
1. Write tests first (TDD)
2. Ensure tests pass locally
3. Maintain >80% coverage
4. Add docstrings to test functions
5. Use existing fixtures when possible
6. Follow naming conventions

## Test Metrics

Current test statistics:
- **Total Tests**: 110+
- **Authentication**: 25+ tests
- **Projects**: 30+ tests
- **Environments**: 30+ tests
- **Variables**: 30+ tests
- **Coverage Target**: >80%

## Resources

- [Pytest Documentation](https://docs.pytest.org/)
- [pytest-asyncio](https://pytest-asyncio.readthedocs.io/)
- [FastAPI Testing](https://fastapi.tiangolo.com/tutorial/testing/)
- [SQLAlchemy Testing](https://docs.sqlalchemy.org/en/20/orm/session_transaction.html#joining-a-session-into-an-external-transaction-such-as-for-test-suites)
