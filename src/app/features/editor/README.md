# EnvSync Monaco Editor

A powerful .env file editor built with Monaco Editor for the EnvSync application.

## Features

### Syntax Highlighting
- **Keys**: Bold blue highlighting for environment variable names (before `=`)
- **Values**: Red highlighting for values (after `=`)
- **Comments**: Green italic highlighting for lines starting with `#`
- **Quoted Strings**: Special highlighting for single and double quoted values
- **Variable Interpolation**: Highlighted syntax for `${VAR}` patterns

### Auto-completion
Auto-complete suggestions for common environment variables including:
- `NODE_ENV` - Node environment (development, production, test)
- `DATABASE_URL` - Database connection string
- `API_KEY` - API key for external services
- `JWT_SECRET` - JWT signing secret
- `REDIS_URL` - Redis connection string
- `AWS_ACCESS_KEY_ID` - AWS access key
- And 20+ more common variables

### Validation
- **Duplicate Key Detection**: Automatically detects and highlights duplicate keys
- **Visual Indicators**: Red decorations on lines with duplicate keys
- **Hover Information**: Hover over duplicates to see which key is duplicated
- **Status Bar**: Shows count of duplicate keys in the toolbar

### Theme Support
- **Light Theme**: Clean, readable light theme with custom .env syntax colors
- **Dark Theme**: Eye-friendly dark theme with custom .env syntax colors
- **Easy Toggle**: Switch themes with a single button click

### File Operations
- **Import**: Load .env files from your file system
- **Export**: Save editor content as .env files
- **Format**: Auto-format your .env content

### Editor Features
- Line numbers
- Minimap for easy navigation
- Word wrap
- Automatic layout adjustment
- Smooth scrolling
- Mouse wheel zoom
- Syntax folding
- Multiple cursors
- Find and replace

## Usage

### Basic Usage

```typescript
import { Component } from '@angular/core';
import { EnvEditorComponent } from './features/editor/env-editor.component';

@Component({
  selector: 'app-root',
  standalone: true,
  imports: [EnvEditorComponent],
  template: `
    <app-env-editor
      [initialContent]="envContent"
      [editorHeight]="'600px'"
      (contentChanged)="onContentChanged($event)"
      (variablesChanged)="onVariablesChanged($event)"
    />
  `
})
export class AppComponent {
  envContent = 'NODE_ENV=development\nAPI_KEY=your-api-key';

  onContentChanged(content: string) {
    console.log('Content changed:', content);
  }

  onVariablesChanged(variables: Array<{ key: string; value: string }>) {
    console.log('Variables:', variables);
  }
}
```

### Advanced Usage

```typescript
import { Component, ViewChild } from '@angular/core';
import { EnvEditorComponent } from './features/editor/env-editor.component';

@Component({
  selector: 'app-advanced',
  standalone: true,
  imports: [EnvEditorComponent],
  template: `
    <app-env-editor
      #editor
      [initialContent]="envContent"
      [editorHeight]="'100vh'"
      (contentChanged)="onContentChanged($event)"
    />
    <button (click)="toggleTheme()">Toggle Theme</button>
    <button (click)="validateContent()">Validate</button>
  `
})
export class AdvancedComponent {
  @ViewChild('editor') editor!: EnvEditorComponent;

  envContent = '';

  toggleTheme() {
    this.editor.toggleTheme();
  }

  validateContent() {
    const duplicates = this.editor.validateDuplicateKeys();
    if (duplicates.length > 0) {
      console.warn('Found duplicate keys:', duplicates);
    } else {
      console.log('No duplicates found!');
    }
  }

  exportEnv() {
    this.editor.exportToFile('my-env-file.env');
  }
}
```

### EnvSync Integration

```typescript
import { Component } from '@angular/core';
import { EnvEditorComponent } from './features/editor/env-editor.component';

@Component({
  selector: 'app-integration',
  standalone: true,
  imports: [EnvEditorComponent],
  template: `
    <app-env-editor
      [initialContent]="envContent"
      (variablesChanged)="syncWithEnvSync($event)"
    />
  `
})
export class IntegrationComponent {
  envContent = '';

  syncWithEnvSync(variables: Array<{ key: string; value: string }>) {
    // Sync with EnvSync backend
    variables.forEach(({ key, value }) => {
      // Call EnvSync API to save variable
      console.log(`Saving ${key}=${value}`);
    });
  }

  loadFromEnvSync(variables: Array<{ key: string; value: string }>) {
    // Convert EnvSync variables to .env format
    this.envContent = variables
      .map(v => `${v.key}=${v.value}`)
      .join('\n');
  }
}
```

## API Reference

### Inputs

| Input | Type | Default | Description |
|-------|------|---------|-------------|
| `editorHeight` | `string` | `'500px'` | Height of the editor container |
| `initialContent` | `string` | `''` | Initial content to load in the editor |

### Outputs

| Output | Type | Description |
|--------|------|-------------|
| `contentChanged` | `string` | Emitted when editor content changes |
| `variablesChanged` | `Array<{ key: string; value: string }>` | Emitted when variables are parsed from content |

### Signals

| Signal | Type | Description |
|--------|------|-------------|
| `content` | `string` | Current editor content |
| `theme` | `'vs' \| 'vs-dark'` | Current theme |
| `readonly` | `boolean` | Whether editor is in readonly mode |
| `duplicateKeys` | `Array<{ key: string; lines: number[] }>` | List of duplicate keys found |

### Methods

| Method | Parameters | Returns | Description |
|--------|------------|---------|-------------|
| `setContent` | `content: string` | `void` | Set editor content |
| `getContent` | - | `string` | Get current editor content |
| `setTheme` | `theme: 'vs' \| 'vs-dark'` | `void` | Set editor theme |
| `toggleTheme` | - | `void` | Toggle between light and dark theme |
| `setReadonly` | `readonly: boolean` | `void` | Enable/disable readonly mode |
| `importFromFile` | `file: File` | `Promise<void>` | Import content from file |
| `exportToFile` | `filename?: string` | `void` | Export content to file |
| `parseEnvContent` | `content: string` | `Array<{ key: string; value: string }>` | Parse .env content to variables |
| `formatEnvContent` | `variables: Array<{ key: string; value: string }>` | `string` | Format variables to .env content |
| `validateDuplicateKeys` | - | `Array<{ key: string; lines: number[] }>` | Find duplicate keys |
| `focusEditor` | - | `void` | Focus the editor |
| `layoutEditor` | - | `void` | Trigger editor layout (after resize) |
| `formatDocument` | - | `void` | Format the document |

## Setup

### 1. Install Dependencies

```bash
npm install monaco-editor ngx-monaco-editor-v2
```

### 2. Configure Angular Assets

Add to `angular.json` under `projects.your-app.architect.build.options.assets`:

```json
{
  "glob": "**/*",
  "input": "node_modules/monaco-editor/min/vs",
  "output": "assets/monaco-editor/vs"
}
```

### 3. Add Global Styles

Add to `src/styles.css`:

```css
.duplicate-key-line {
  background-color: rgba(255, 0, 0, 0.1);
}

.duplicate-key-glyph {
  background-color: rgba(255, 0, 0, 0.5);
  width: 10px !important;
  margin-left: 3px;
}

.monaco-editor .duplicate-key-line {
  border-left: 3px solid rgba(255, 0, 0, 0.5);
}
```

## Testing

The component includes comprehensive test coverage (30+ tests) covering:
- Component initialization
- Monaco Editor setup
- Language definition and syntax highlighting
- Auto-completion
- Duplicate key validation
- Theme switching
- Content management
- File import/export
- EnvSync integration
- Component lifecycle

Run tests:
```bash
npm test
```

## Browser Support

Monaco Editor supports:
- Chrome (latest)
- Firefox (latest)
- Safari (latest)
- Edge (latest)

## Performance

The editor is optimized for:
- Large .env files (1000+ lines)
- Real-time validation
- Smooth syntax highlighting
- Fast auto-completion

## License

Part of the EnvSync project.
