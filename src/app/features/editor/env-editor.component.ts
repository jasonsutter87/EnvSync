import {
  Component,
  OnDestroy,
  signal,
  ViewEncapsulation,
  effect,
  input,
  output,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import type * as monacoType from 'monaco-editor';

/**
 * EnvEditorComponent - Monaco Editor integration for .env file editing
 *
 * Features:
 * - Custom .env syntax highlighting
 * - Auto-completion for common environment variables
 * - Duplicate key validation
 * - Dark/light theme support
 * - Import/export .env files
 * - Integration with EnvSync variable management
 */
@Component({
  selector: 'app-env-editor',
  standalone: true,
  imports: [CommonModule, FormsModule],
  template: `
    <div class="env-editor-container">
      <div class="editor-toolbar">
        <div class="toolbar-group">
          <button
            (click)="importFileClick()"
            class="toolbar-button"
            [disabled]="readonly()"
            title="Import .env file"
          >
            Import
          </button>
          <button
            (click)="exportToFile()"
            class="toolbar-button"
            title="Export to .env file"
          >
            Export
          </button>
          <input
            #fileInput
            type="file"
            accept=".env"
            (change)="onFileSelected($event)"
            style="display: none"
          />
        </div>
        <div class="toolbar-group">
          <button
            (click)="formatDocument()"
            class="toolbar-button"
            [disabled]="readonly()"
            title="Format document"
          >
            Format
          </button>
          <button
            (click)="toggleTheme()"
            class="toolbar-button"
            title="Toggle theme"
          >
            {{ theme() === 'vs' ? '🌙' : '☀️' }}
          </button>
        </div>
        <div class="toolbar-group">
          <span class="validation-status" [class.has-errors]="duplicateKeys().length > 0">
            {{ duplicateKeys().length > 0 ? `${duplicateKeys().length} duplicate key(s)` : 'Valid' }}
          </span>
        </div>
      </div>
      <div
        #editorContainer
        class="editor-content"
        [style.height]="editorHeight()"
      ></div>
    </div>
  `,
  styles: [
    `
      .env-editor-container {
        display: flex;
        flex-direction: column;
        height: 100%;
        border: 1px solid #ddd;
        border-radius: 4px;
        overflow: hidden;
      }

      .editor-toolbar {
        display: flex;
        justify-content: space-between;
        align-items: center;
        padding: 8px 12px;
        background-color: #f5f5f5;
        border-bottom: 1px solid #ddd;
        gap: 12px;
      }

      .toolbar-group {
        display: flex;
        gap: 8px;
        align-items: center;
      }

      .toolbar-button {
        padding: 6px 12px;
        background-color: #fff;
        border: 1px solid #ccc;
        border-radius: 4px;
        cursor: pointer;
        font-size: 14px;
        transition: all 0.2s;
      }

      .toolbar-button:hover:not(:disabled) {
        background-color: #f0f0f0;
        border-color: #999;
      }

      .toolbar-button:disabled {
        opacity: 0.5;
        cursor: not-allowed;
      }

      .validation-status {
        font-size: 12px;
        padding: 4px 8px;
        border-radius: 4px;
        background-color: #d4edda;
        color: #155724;
        font-weight: 500;
      }

      .validation-status.has-errors {
        background-color: #f8d7da;
        color: #721c24;
      }

      .editor-content {
        flex: 1;
        overflow: hidden;
      }
    `,
  ],
  encapsulation: ViewEncapsulation.None,
})
export class EnvEditorComponent implements OnDestroy {
  // Inputs
  editorHeight = input<string>('500px');
  initialContent = input<string>('');

  // Outputs
  contentChanged = output<string>();
  variablesChanged = output<Array<{ key: string; value: string }>>();

  // Signals
  content = signal<string>('');
  theme = signal<'vs' | 'vs-dark'>('vs');
  readonly = signal<boolean>(false);
  duplicateKeys = signal<Array<{ key: string; lines: number[] }>>([]);
  editorOptions = signal({
    language: 'env',
    theme: 'vs',
    lineNumbers: 'on' as const,
    automaticLayout: true,
    minimap: { enabled: true },
    scrollBeyondLastLine: false,
    fontSize: 14,
    tabSize: 2,
    insertSpaces: true,
    wordWrap: 'on' as const,
    lineDecorationsWidth: 10,
    lineNumbersMinChars: 3,
    glyphMargin: true,
    folding: true,
    renderLineHighlight: 'all' as const,
    renderWhitespace: 'selection' as const,
    cursorBlinking: 'smooth' as const,
    cursorStyle: 'line' as const,
    smoothScrolling: true,
    mouseWheelZoom: true,
  });

  // Private fields
  private editor: monacoType.editor.IStandaloneCodeEditor | null = null;
  private monaco: typeof monacoType | null = null;
  private contentChangeDisposable: monacoType.IDisposable | null = null;
  private decorationIds: string[] = [];

  constructor() {
    // Effect to update editor when initial content changes
    effect(() => {
      const initial = this.initialContent();
      if (initial && this.editor) {
        this.setContent(initial);
      }
    });
  }

  /**
   * Initialize Monaco Editor instance
   */
  onEditorInit(
    editor: monacoType.editor.IStandaloneCodeEditor,
    monaco: typeof monacoType
  ): void {
    this.editor = editor;
    this.monaco = monaco;

    // Register .env language
    this.registerEnvLanguage(monaco);

    // Define custom themes
    this.defineCustomThemes(monaco);

    // Set up content change listener
    this.setupContentChangeListener();

    // Set initial content if provided
    if (this.initialContent()) {
      this.setContent(this.initialContent());
    }
  }

  /**
   * Register custom .env language definition
   */
  private registerEnvLanguage(monaco: typeof monacoType): void {
    // Register language
    monaco.languages.register({ id: 'env' });

    // Set language configuration
    monaco.languages.setLanguageConfiguration('env', {
      comments: {
        lineComment: '#',
      },
      brackets: [
        ['{', '}'],
        ['[', ']'],
        ['(', ')'],
      ],
      autoClosingPairs: [
        { open: '{', close: '}' },
        { open: '[', close: ']' },
        { open: '(', close: ')' },
        { open: '"', close: '"' },
        { open: "'", close: "'" },
      ],
      surroundingPairs: [
        { open: '{', close: '}' },
        { open: '[', close: ']' },
        { open: '(', close: ')' },
        { open: '"', close: '"' },
        { open: "'", close: "'" },
      ],
    });

    // Set tokenizer for syntax highlighting
    monaco.languages.setMonarchTokensProvider('env', {
      tokenizer: {
        root: [
          // Comments
          [/^#.*$/, 'comment'],

          // Variable interpolation ${VAR}
          [/\$\{[^}]+\}/, 'variable'],

          // Double quoted strings
          [/"([^"\\]|\\.)*$/, 'string.invalid'], // Unterminated string
          [/"/, 'string', '@string_double'],

          // Single quoted strings
          [/'([^'\\]|\\.)*$/, 'string.invalid'], // Unterminated string
          [/'/, 'string', '@string_single'],

          // Key-value pairs (key before =)
          [/^[A-Z_][A-Z0-9_]*(?==)/, 'key'],

          // Equals sign
          [/=/, 'delimiter'],

          // Values (everything after =)
          [/[^\s]+/, 'value'],

          // Whitespace
          [/\s+/, 'white'],
        ],

        string_double: [
          [/[^\\"]+/, 'string'],
          [/\\./, 'string.escape'],
          [/"/, 'string', '@pop'],
        ],

        string_single: [
          [/[^\\']+/, 'string'],
          [/\\./, 'string.escape'],
          [/'/, 'string', '@pop'],
        ],
      },
    });

    // Register completion item provider
    monaco.languages.registerCompletionItemProvider('env', {
      provideCompletionItems: (model, position) => {
        const suggestions = this.getCompletionSuggestions(monaco);
        return { suggestions };
      },
    });
  }

  /**
   * Get auto-completion suggestions for common env vars
   */
  private getCompletionSuggestions(
    monaco: typeof monacoType
  ): monacoType.languages.CompletionItem[] {
    const commonEnvVars = [
      { label: 'NODE_ENV', detail: 'Node environment (development, production, test)' },
      { label: 'PORT', detail: 'Server port number' },
      { label: 'HOST', detail: 'Server host address' },
      { label: 'DATABASE_URL', detail: 'Database connection string' },
      { label: 'DATABASE_HOST', detail: 'Database host address' },
      { label: 'DATABASE_PORT', detail: 'Database port number' },
      { label: 'DATABASE_NAME', detail: 'Database name' },
      { label: 'DATABASE_USER', detail: 'Database username' },
      { label: 'DATABASE_PASSWORD', detail: 'Database password' },
      { label: 'API_KEY', detail: 'API key for external services' },
      { label: 'API_SECRET', detail: 'API secret for external services' },
      { label: 'API_URL', detail: 'API base URL' },
      { label: 'JWT_SECRET', detail: 'JWT signing secret' },
      { label: 'JWT_EXPIRES_IN', detail: 'JWT expiration time' },
      { label: 'REDIS_URL', detail: 'Redis connection string' },
      { label: 'REDIS_HOST', detail: 'Redis host address' },
      { label: 'REDIS_PORT', detail: 'Redis port number' },
      { label: 'SMTP_HOST', detail: 'SMTP server host' },
      { label: 'SMTP_PORT', detail: 'SMTP server port' },
      { label: 'SMTP_USER', detail: 'SMTP username' },
      { label: 'SMTP_PASSWORD', detail: 'SMTP password' },
      { label: 'AWS_ACCESS_KEY_ID', detail: 'AWS access key' },
      { label: 'AWS_SECRET_ACCESS_KEY', detail: 'AWS secret key' },
      { label: 'AWS_REGION', detail: 'AWS region' },
      { label: 'S3_BUCKET', detail: 'S3 bucket name' },
      { label: 'LOG_LEVEL', detail: 'Logging level (debug, info, warn, error)' },
      { label: 'DEBUG', detail: 'Debug mode flag' },
      { label: 'CORS_ORIGIN', detail: 'CORS allowed origins' },
      { label: 'SESSION_SECRET', detail: 'Session signing secret' },
    ];

    return commonEnvVars.map((item) => ({
      label: item.label,
      kind: monaco.languages.CompletionItemKind.Variable,
      detail: item.detail,
      insertText: `${item.label}=`,
      range: undefined as any,
    }));
  }

  /**
   * Define custom themes for .env editor
   */
  private defineCustomThemes(monaco: typeof monacoType): void {
    // Light theme
    monaco.editor.defineTheme('env-light', {
      base: 'vs',
      inherit: true,
      rules: [
        { token: 'comment', foreground: '008000', fontStyle: 'italic' },
        { token: 'key', foreground: '0000FF', fontStyle: 'bold' },
        { token: 'delimiter', foreground: '000000' },
        { token: 'value', foreground: 'A31515' },
        { token: 'string', foreground: 'A31515' },
        { token: 'string.escape', foreground: 'FF0000' },
        { token: 'variable', foreground: '001080', fontStyle: 'italic' },
      ],
      colors: {
        'editor.foreground': '#000000',
        'editor.background': '#FFFFFF',
        'editorLineNumber.foreground': '#237893',
        'editor.selectionBackground': '#ADD6FF',
        'editor.inactiveSelectionBackground': '#E5EBF1',
      },
    });

    // Dark theme
    monaco.editor.defineTheme('env-dark', {
      base: 'vs-dark',
      inherit: true,
      rules: [
        { token: 'comment', foreground: '6A9955', fontStyle: 'italic' },
        { token: 'key', foreground: '9CDCFE', fontStyle: 'bold' },
        { token: 'delimiter', foreground: 'D4D4D4' },
        { token: 'value', foreground: 'CE9178' },
        { token: 'string', foreground: 'CE9178' },
        { token: 'string.escape', foreground: 'D7BA7D' },
        { token: 'variable', foreground: '4EC9B0', fontStyle: 'italic' },
      ],
      colors: {
        'editor.foreground': '#D4D4D4',
        'editor.background': '#1E1E1E',
        'editorLineNumber.foreground': '#858585',
        'editor.selectionBackground': '#264F78',
        'editor.inactiveSelectionBackground': '#3A3D41',
      },
    });
  }

  /**
   * Set up content change listener
   */
  private setupContentChangeListener(): void {
    if (!this.editor) return;

    this.contentChangeDisposable = this.editor.onDidChangeModelContent(() => {
      if (!this.editor) return;

      const newContent = this.editor.getValue();
      this.content.set(newContent);
      this.contentChanged.emit(newContent);

      // Validate for duplicate keys
      const duplicates = this.validateDuplicateKeys();
      this.duplicateKeys.set(duplicates);
      this.markDuplicateLines(duplicates);

      // Emit parsed variables
      const variables = this.parseEnvContent(newContent);
      this.variablesChanged.emit(variables);
    });
  }

  /**
   * Validate for duplicate keys
   */
  validateDuplicateKeys(): Array<{ key: string; lines: number[] }> {
    if (!this.editor) return [];

    const content = this.editor.getValue();
    const lines = content.split('\n');
    const keyMap = new Map<string, number[]>();

    lines.forEach((line, index) => {
      const trimmedLine = line.trim();

      // Skip comments and empty lines
      if (trimmedLine.startsWith('#') || trimmedLine === '') {
        return;
      }

      // Extract key from KEY=VALUE
      const match = trimmedLine.match(/^([A-Z_][A-Z0-9_]*)=/);
      if (match) {
        const key = match[1];
        const lineNumbers = keyMap.get(key) || [];
        lineNumbers.push(index + 1); // 1-based line numbers
        keyMap.set(key, lineNumbers);
      }
    });

    // Filter to only duplicates
    const duplicates: Array<{ key: string; lines: number[] }> = [];
    keyMap.forEach((lines, key) => {
      if (lines.length > 1) {
        duplicates.push({ key, lines });
      }
    });

    return duplicates;
  }

  /**
   * Mark duplicate lines with decorations
   */
  private markDuplicateLines(duplicates: Array<{ key: string; lines: number[] }>): void {
    if (!this.editor) return;

    const decorations: monacoType.editor.IModelDeltaDecoration[] = [];

    duplicates.forEach(({ key, lines }) => {
      lines.forEach((lineNumber) => {
        decorations.push({
          range: {
            startLineNumber: lineNumber,
            startColumn: 1,
            endLineNumber: lineNumber,
            endColumn: 1000,
          },
          options: {
            isWholeLine: true,
            className: 'duplicate-key-line',
            glyphMarginClassName: 'duplicate-key-glyph',
            hoverMessage: { value: `Duplicate key: **${key}**` },
            glyphMarginHoverMessage: { value: `Duplicate key: **${key}**` },
            overviewRuler: {
              color: 'rgba(255, 0, 0, 0.5)',
              position: 1,
            },
          },
        });
      });
    });

    this.decorationIds = this.editor.deltaDecorations(this.decorationIds, decorations);
  }

  /**
   * Set editor theme
   */
  setTheme(theme: 'vs' | 'vs-dark'): void {
    this.theme.set(theme);
    if (this.monaco && this.editor) {
      const customTheme = theme === 'vs' ? 'env-light' : 'env-dark';
      this.monaco.editor.setTheme(customTheme);
    }
  }

  /**
   * Toggle between light and dark theme
   */
  toggleTheme(): void {
    const newTheme = this.theme() === 'vs' ? 'vs-dark' : 'vs';
    this.setTheme(newTheme);
  }

  /**
   * Set editor content
   */
  setContent(content: string): void {
    if (!this.editor) return;
    this.editor.setValue(content);
    this.content.set(content);
  }

  /**
   * Get current editor content
   */
  getContent(): string {
    if (!this.editor) return '';
    return this.editor.getValue();
  }

  /**
   * Set readonly mode
   */
  setReadonly(readonly: boolean): void {
    this.readonly.set(readonly);
    if (this.editor) {
      this.editor.updateOptions({ readOnly: readonly });
    }
  }

  /**
   * Import content from .env file
   */
  async importFromFile(file: File): Promise<void> {
    try {
      const content = await file.text();
      this.setContent(content);
    } catch (error) {
      console.error('Failed to import file:', error);
      throw error;
    }
  }

  /**
   * Trigger file input click
   */
  importFileClick(): void {
    const fileInput = document.querySelector('input[type="file"]') as HTMLInputElement;
    if (fileInput) {
      fileInput.click();
    }
  }

  /**
   * Handle file selection
   */
  async onFileSelected(event: Event): Promise<void> {
    const input = event.target as HTMLInputElement;
    const file = input.files?.[0];
    if (file) {
      await this.importFromFile(file);
      // Reset input so same file can be selected again
      input.value = '';
    }
  }

  /**
   * Export content to .env file
   */
  exportToFile(filename: string = '.env'): void {
    const content = this.getContent();
    const blob = new Blob([content], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);

    const anchor = document.createElement('a');
    anchor.href = url;
    anchor.download = filename;
    document.body.appendChild(anchor);
    anchor.click();
    document.body.removeChild(anchor);

    URL.revokeObjectURL(url);
  }

  /**
   * Parse .env content into key-value pairs
   */
  parseEnvContent(content: string): Array<{ key: string; value: string }> {
    const lines = content.split('\n');
    const variables: Array<{ key: string; value: string }> = [];

    lines.forEach((line) => {
      const trimmedLine = line.trim();

      // Skip comments and empty lines
      if (trimmedLine.startsWith('#') || trimmedLine === '') {
        return;
      }

      // Split on first = sign
      const equalIndex = trimmedLine.indexOf('=');
      if (equalIndex !== -1) {
        const key = trimmedLine.substring(0, equalIndex).trim();
        const value = trimmedLine.substring(equalIndex + 1);
        variables.push({ key, value });
      }
    });

    return variables;
  }

  /**
   * Format key-value pairs as .env content
   */
  formatEnvContent(variables: Array<{ key: string; value: string }>): string {
    return variables.map((v) => `${v.key}=${v.value}`).join('\n');
  }

  /**
   * Focus the editor
   */
  focusEditor(): void {
    if (this.editor) {
      this.editor.focus();
    }
  }

  /**
   * Trigger editor layout (useful after resize)
   */
  layoutEditor(): void {
    if (this.editor) {
      this.editor.layout();
    }
  }

  /**
   * Format document
   */
  formatDocument(): void {
    if (!this.editor) return;

    const action = this.editor.getAction('editor.action.formatDocument');
    if (action) {
      action.run();
    }
  }

  /**
   * Cleanup on component destroy
   */
  ngOnDestroy(): void {
    if (this.contentChangeDisposable) {
      this.contentChangeDisposable.dispose();
    }
    if (this.editor) {
      this.editor.dispose();
    }
  }
}
