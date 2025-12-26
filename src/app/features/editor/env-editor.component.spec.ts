import { ComponentFixture, TestBed } from '@angular/core/testing';
import { signal } from '@angular/core';
import { EnvEditorComponent } from './env-editor.component';
import type * as monacoType from 'monaco-editor';

describe('EnvEditorComponent', () => {
  let component: EnvEditorComponent;
  let fixture: ComponentFixture<EnvEditorComponent>;
  let mockMonacoEditor: any;

  beforeEach(async () => {
    // Mock Monaco Editor
    mockMonacoEditor = {
      getValue: vi.fn().mockReturnValue(''),
      setValue: vi.fn(),
      getModel: vi.fn().mockReturnValue({
        getValueInRange: vi.fn(),
        getLineCount: vi.fn().mockReturnValue(1),
        getLineContent: vi.fn(),
        findMatches: vi.fn().mockReturnValue([]),
      }),
      onDidChangeModelContent: vi.fn().mockReturnValue({ dispose: vi.fn() }),
      updateOptions: vi.fn(),
      dispose: vi.fn(),
      layout: vi.fn(),
      focus: vi.fn(),
      setPosition: vi.fn(),
      revealLine: vi.fn(),
      deltaDecorations: vi.fn().mockReturnValue([]),
      getAction: vi.fn().mockReturnValue({ run: vi.fn() }),
    };

    await TestBed.configureTestingModule({
      imports: [EnvEditorComponent],
    }).compileComponents();

    fixture = TestBed.createComponent(EnvEditorComponent);
    component = fixture.componentInstance;
  });

  describe('Component Initialization', () => {
    it('should create the component', () => {
      expect(component).toBeTruthy();
    });

    it('should initialize with empty content signal', () => {
      expect(component.content()).toBe('');
    });

    it('should initialize with light theme by default', () => {
      expect(component.theme()).toBe('vs');
    });

    it('should initialize with readonly mode disabled by default', () => {
      expect(component.readonly()).toBe(false);
    });

    it('should initialize editor options with correct defaults', () => {
      const options = component.editorOptions();
      expect(options.language).toBe('env');
      expect(options.lineNumbers).toBe('on');
      expect(options.automaticLayout).toBe(true);
      expect(options.minimap?.enabled).toBe(true);
      expect(options.scrollBeyondLastLine).toBe(false);
    });
  });

  describe('Monaco Editor Initialization', () => {
    it('should set up .env language definition on editor init', () => {
      const mockMonaco = {
        languages: {
          register: vi.fn(),
          setMonarchTokensProvider: vi.fn(),
          setLanguageConfiguration: vi.fn(),
          registerCompletionItemProvider: vi.fn(),
        },
        editor: {
          defineTheme: vi.fn(),
        },
      };

      component.onEditorInit(mockMonacoEditor, mockMonaco as any);

      expect(mockMonaco.languages.register).toHaveBeenCalledWith({ id: 'env' });
      expect(mockMonaco.languages.setMonarchTokensProvider).toHaveBeenCalled();
      expect(mockMonaco.languages.setLanguageConfiguration).toHaveBeenCalled();
    });

    it('should register custom completion provider on editor init', () => {
      const mockMonaco = {
        languages: {
          register: vi.fn(),
          setMonarchTokensProvider: vi.fn(),
          setLanguageConfiguration: vi.fn(),
          registerCompletionItemProvider: vi.fn(),
        },
        editor: {
          defineTheme: vi.fn(),
        },
      };

      component.onEditorInit(mockMonacoEditor, mockMonaco as any);

      expect(mockMonaco.languages.registerCompletionItemProvider).toHaveBeenCalledWith(
        'env',
        expect.any(Object)
      );
    });

    it('should define custom themes on editor init', () => {
      const mockMonaco = {
        languages: {
          register: vi.fn(),
          setMonarchTokensProvider: vi.fn(),
          setLanguageConfiguration: vi.fn(),
          registerCompletionItemProvider: vi.fn(),
        },
        editor: {
          defineTheme: vi.fn(),
        },
      };

      component.onEditorInit(mockMonacoEditor, mockMonaco as any);

      expect(mockMonaco.editor.defineTheme).toHaveBeenCalledWith('env-light', expect.any(Object));
      expect(mockMonaco.editor.defineTheme).toHaveBeenCalledWith('env-dark', expect.any(Object));
    });

    it('should store editor instance reference', () => {
      const mockMonaco = {
        languages: {
          register: vi.fn(),
          setMonarchTokensProvider: vi.fn(),
          setLanguageConfiguration: vi.fn(),
          registerCompletionItemProvider: vi.fn(),
        },
        editor: {
          defineTheme: vi.fn(),
        },
      };

      component.onEditorInit(mockMonacoEditor, mockMonaco as any);

      expect(component['editor']).toBe(mockMonacoEditor);
    });

    it('should set up content change listener on editor init', () => {
      const mockMonaco = {
        languages: {
          register: vi.fn(),
          setMonarchTokensProvider: vi.fn(),
          setLanguageConfiguration: vi.fn(),
          registerCompletionItemProvider: vi.fn(),
        },
        editor: {
          defineTheme: vi.fn(),
        },
      };

      component.onEditorInit(mockMonacoEditor, mockMonaco as any);

      expect(mockMonacoEditor.onDidChangeModelContent).toHaveBeenCalled();
    });
  });

  describe('Syntax Highlighting - Language Definition', () => {
    it('should define tokenizer for env language', () => {
      const mockMonaco = {
        languages: {
          register: vi.fn(),
          setMonarchTokensProvider: vi.fn(),
          setLanguageConfiguration: vi.fn(),
          registerCompletionItemProvider: vi.fn(),
        },
        editor: {
          defineTheme: vi.fn(),
        },
      };

      component.onEditorInit(mockMonacoEditor, mockMonaco as any);

      const tokenizerCall = mockMonaco.languages.setMonarchTokensProvider.mock.calls[0];
      const languageDefinition = tokenizerCall[1];

      expect(languageDefinition.tokenizer).toBeDefined();
      expect(languageDefinition.tokenizer.root).toBeDefined();
    });

    it('should define tokens for comments in language definition', () => {
      const mockMonaco = {
        languages: {
          register: vi.fn(),
          setMonarchTokensProvider: vi.fn(),
          setLanguageConfiguration: vi.fn(),
          registerCompletionItemProvider: vi.fn(),
        },
        editor: {
          defineTheme: vi.fn(),
        },
      };

      component.onEditorInit(mockMonacoEditor, mockMonaco as any);

      const tokenizerCall = mockMonaco.languages.setMonarchTokensProvider.mock.calls[0];
      const languageDefinition = tokenizerCall[1];
      const rootTokens = languageDefinition.tokenizer.root;

      // Should have comment token pattern
      const commentToken = rootTokens.find((token: any) =>
        token[0] && token[0].toString().includes('#')
      );
      expect(commentToken).toBeDefined();
    });

    it('should define tokens for key-value pairs', () => {
      const mockMonaco = {
        languages: {
          register: vi.fn(),
          setMonarchTokensProvider: vi.fn(),
          setLanguageConfiguration: vi.fn(),
          registerCompletionItemProvider: vi.fn(),
        },
        editor: {
          defineTheme: vi.fn(),
        },
      };

      component.onEditorInit(mockMonacoEditor, mockMonaco as any);

      const tokenizerCall = mockMonaco.languages.setMonarchTokensProvider.mock.calls[0];
      const languageDefinition = tokenizerCall[1];
      const rootTokens = languageDefinition.tokenizer.root;

      // Should have key token pattern
      const keyToken = rootTokens.find((token: any) =>
        token[1] && token[1].toString().includes('key')
      );
      expect(keyToken).toBeDefined();
    });

    it('should define tokens for quoted strings', () => {
      const mockMonaco = {
        languages: {
          register: vi.fn(),
          setMonarchTokensProvider: vi.fn(),
          setLanguageConfiguration: vi.fn(),
          registerCompletionItemProvider: vi.fn(),
        },
        editor: {
          defineTheme: vi.fn(),
        },
      };

      component.onEditorInit(mockMonacoEditor, mockMonaco as any);

      const tokenizerCall = mockMonaco.languages.setMonarchTokensProvider.mock.calls[0];
      const languageDefinition = tokenizerCall[1];
      const rootTokens = languageDefinition.tokenizer.root;

      // Should have string token patterns
      const stringToken = rootTokens.find((token: any) =>
        token[1] && token[1].toString().includes('string')
      );
      expect(stringToken).toBeDefined();
    });

    it('should define tokens for variable interpolation', () => {
      const mockMonaco = {
        languages: {
          register: vi.fn(),
          setMonarchTokensProvider: vi.fn(),
          setLanguageConfiguration: vi.fn(),
          registerCompletionItemProvider: vi.fn(),
        },
        editor: {
          defineTheme: vi.fn(),
        },
      };

      component.onEditorInit(mockMonacoEditor, mockMonaco as any);

      const tokenizerCall = mockMonaco.languages.setMonarchTokensProvider.mock.calls[0];
      const languageDefinition = tokenizerCall[1];
      const rootTokens = languageDefinition.tokenizer.root;

      // Should have variable interpolation token pattern for ${VAR}
      const variableToken = rootTokens.find((token: any) =>
        token[1] && token[1].toString().includes('variable')
      );
      expect(variableToken).toBeDefined();
    });

    it('should configure language with bracket pairs and comments', () => {
      const mockMonaco = {
        languages: {
          register: vi.fn(),
          setMonarchTokensProvider: vi.fn(),
          setLanguageConfiguration: vi.fn(),
          registerCompletionItemProvider: vi.fn(),
        },
        editor: {
          defineTheme: vi.fn(),
        },
      };

      component.onEditorInit(mockMonacoEditor, mockMonaco as any);

      const configCall = mockMonaco.languages.setLanguageConfiguration.mock.calls[0];
      const languageConfig = configCall[1];

      expect(languageConfig.comments).toBeDefined();
      expect(languageConfig.comments.lineComment).toBe('#');
      expect(languageConfig.brackets).toBeDefined();
    });
  });

  describe('Auto-completion', () => {
    it('should provide completion suggestions for common env vars', () => {
      const mockMonaco = {
        languages: {
          register: vi.fn(),
          setMonarchTokensProvider: vi.fn(),
          setLanguageConfiguration: vi.fn(),
          registerCompletionItemProvider: vi.fn(),
        },
        editor: {
          defineTheme: vi.fn(),
        },
        Position: class {},
        languages: {
          CompletionItemKind: { Variable: 1 },
        },
      };

      component.onEditorInit(mockMonacoEditor, mockMonaco as any);

      const providerCall = mockMonaco.languages.registerCompletionItemProvider.mock.calls[0];
      const provider = providerCall[1];

      expect(provider.provideCompletionItems).toBeDefined();
    });

    it('should include NODE_ENV in completion suggestions', async () => {
      const mockMonaco = {
        languages: {
          register: vi.fn(),
          setMonarchTokensProvider: vi.fn(),
          setLanguageConfiguration: vi.fn(),
          registerCompletionItemProvider: vi.fn(),
        },
        editor: {
          defineTheme: vi.fn(),
        },
        Position: class {},
        languages: {
          CompletionItemKind: { Variable: 1 },
        },
      };

      component.onEditorInit(mockMonacoEditor, mockMonaco as any);

      const providerCall = mockMonaco.languages.registerCompletionItemProvider.mock.calls[0];
      const provider = providerCall[1];
      const mockModel = {} as any;
      const mockPosition = {} as any;

      const suggestions = await provider.provideCompletionItems(mockModel, mockPosition);

      const nodeEnvSuggestion = suggestions.suggestions.find(
        (s: any) => s.label === 'NODE_ENV'
      );
      expect(nodeEnvSuggestion).toBeDefined();
    });

    it('should include DATABASE_URL in completion suggestions', async () => {
      const mockMonaco = {
        languages: {
          register: vi.fn(),
          setMonarchTokensProvider: vi.fn(),
          setLanguageConfiguration: vi.fn(),
          registerCompletionItemProvider: vi.fn(),
        },
        editor: {
          defineTheme: vi.fn(),
        },
        Position: class {},
        languages: {
          CompletionItemKind: { Variable: 1 },
        },
      };

      component.onEditorInit(mockMonacoEditor, mockMonaco as any);

      const providerCall = mockMonaco.languages.registerCompletionItemProvider.mock.calls[0];
      const provider = providerCall[1];
      const mockModel = {} as any;
      const mockPosition = {} as any;

      const suggestions = await provider.provideCompletionItems(mockModel, mockPosition);

      const dbUrlSuggestion = suggestions.suggestions.find(
        (s: any) => s.label === 'DATABASE_URL'
      );
      expect(dbUrlSuggestion).toBeDefined();
    });

    it('should include API_KEY in completion suggestions', async () => {
      const mockMonaco = {
        languages: {
          register: vi.fn(),
          setMonarchTokensProvider: vi.fn(),
          setLanguageConfiguration: vi.fn(),
          registerCompletionItemProvider: vi.fn(),
        },
        editor: {
          defineTheme: vi.fn(),
        },
        Position: class {},
        languages: {
          CompletionItemKind: { Variable: 1 },
        },
      };

      component.onEditorInit(mockMonacoEditor, mockMonaco as any);

      const providerCall = mockMonaco.languages.registerCompletionItemProvider.mock.calls[0];
      const provider = providerCall[1];
      const mockModel = {} as any;
      const mockPosition = {} as any;

      const suggestions = await provider.provideCompletionItems(mockModel, mockPosition);

      const apiKeySuggestion = suggestions.suggestions.find(
        (s: any) => s.label === 'API_KEY'
      );
      expect(apiKeySuggestion).toBeDefined();
    });
  });

  describe('Duplicate Key Validation', () => {
    it('should detect duplicate keys in content', () => {
      component['editor'] = mockMonacoEditor;

      const contentWithDuplicates = 'API_KEY=value1\nDATABASE_URL=url\nAPI_KEY=value2';
      mockMonacoEditor.getValue.mockReturnValue(contentWithDuplicates);

      const duplicates = component.validateDuplicateKeys();

      expect(duplicates.length).toBeGreaterThan(0);
      expect(duplicates.some(d => d.key === 'API_KEY')).toBe(true);
    });

    it('should not report duplicates when keys are unique', () => {
      component['editor'] = mockMonacoEditor;

      const contentWithoutDuplicates = 'API_KEY=value1\nDATABASE_URL=url\nNODE_ENV=development';
      mockMonacoEditor.getValue.mockReturnValue(contentWithoutDuplicates);

      const duplicates = component.validateDuplicateKeys();

      expect(duplicates.length).toBe(0);
    });

    it('should ignore comments when checking for duplicates', () => {
      component['editor'] = mockMonacoEditor;

      const contentWithComments = '# API_KEY comment\nAPI_KEY=value1\nDATABASE_URL=url';
      mockMonacoEditor.getValue.mockReturnValue(contentWithComments);

      const duplicates = component.validateDuplicateKeys();

      expect(duplicates.length).toBe(0);
    });

    it('should ignore empty lines when checking for duplicates', () => {
      component['editor'] = mockMonacoEditor;

      const contentWithEmptyLines = 'API_KEY=value1\n\n\nDATABASE_URL=url';
      mockMonacoEditor.getValue.mockReturnValue(contentWithEmptyLines);

      const duplicates = component.validateDuplicateKeys();

      expect(duplicates.length).toBe(0);
    });

    it('should return line numbers for duplicate keys', () => {
      component['editor'] = mockMonacoEditor;

      const contentWithDuplicates = 'API_KEY=value1\nDATABASE_URL=url\nAPI_KEY=value2';
      mockMonacoEditor.getValue.mockReturnValue(contentWithDuplicates);

      const duplicates = component.validateDuplicateKeys();

      const apiKeyDuplicate = duplicates.find(d => d.key === 'API_KEY');
      expect(apiKeyDuplicate?.lines).toBeDefined();
      expect(apiKeyDuplicate?.lines.length).toBe(2);
    });

    it('should mark duplicate lines with decorations', () => {
      component['editor'] = mockMonacoEditor;

      const contentWithDuplicates = 'API_KEY=value1\nDATABASE_URL=url\nAPI_KEY=value2';
      mockMonacoEditor.getValue.mockReturnValue(contentWithDuplicates);

      component.validateDuplicateKeys();
      component['markDuplicateLines']([{ key: 'API_KEY', lines: [1, 3] }]);

      expect(mockMonacoEditor.deltaDecorations).toHaveBeenCalled();
    });
  });

  describe('Theme Support', () => {
    it('should switch to dark theme when theme signal is updated', () => {
      component['editor'] = mockMonacoEditor;

      component.theme.set('vs-dark');

      expect(component.theme()).toBe('vs-dark');
    });

    it('should switch to light theme when theme signal is updated', () => {
      component['editor'] = mockMonacoEditor;
      component.theme.set('vs-dark');

      component.theme.set('vs');

      expect(component.theme()).toBe('vs');
    });

    it('should update editor theme when theme signal changes', () => {
      component['editor'] = mockMonacoEditor;
      component['monaco'] = {
        editor: {
          setTheme: vi.fn(),
        },
      } as any;

      component.setTheme('vs-dark');

      expect(component.theme()).toBe('vs-dark');
    });
  });

  describe('Content Management', () => {
    it('should update content signal when editor content changes', () => {
      const mockMonaco = {
        languages: {
          register: vi.fn(),
          setMonarchTokensProvider: vi.fn(),
          setLanguageConfiguration: vi.fn(),
          registerCompletionItemProvider: vi.fn(),
        },
        editor: {
          defineTheme: vi.fn(),
        },
      };

      let contentChangeCallback: any;
      mockMonacoEditor.onDidChangeModelContent.mockImplementation((callback: any) => {
        contentChangeCallback = callback;
        return { dispose: vi.fn() };
      });

      component.onEditorInit(mockMonacoEditor, mockMonaco as any);

      const newContent = 'API_KEY=newvalue';
      mockMonacoEditor.getValue.mockReturnValue(newContent);
      contentChangeCallback();

      expect(component.content()).toBe(newContent);
    });

    it('should set editor value when content signal is updated externally', () => {
      component['editor'] = mockMonacoEditor;

      const newContent = 'DATABASE_URL=postgresql://localhost';
      component.setContent(newContent);

      expect(mockMonacoEditor.setValue).toHaveBeenCalledWith(newContent);
    });

    it('should get current editor content', () => {
      component['editor'] = mockMonacoEditor;
      const expectedContent = 'NODE_ENV=production';
      mockMonacoEditor.getValue.mockReturnValue(expectedContent);

      const content = component.getContent();

      expect(content).toBe(expectedContent);
    });
  });

  describe('File Import/Export', () => {
    it('should import content from .env file', async () => {
      component['editor'] = mockMonacoEditor;

      const fileContent = 'API_KEY=test\nDATABASE_URL=postgres://localhost';
      const mockFile = new File([fileContent], 'test.env', { type: 'text/plain' });

      await component.importFromFile(mockFile);

      expect(component.content()).toBe(fileContent);
    });

    it('should export content to .env file', () => {
      component['editor'] = mockMonacoEditor;
      const content = 'API_KEY=test\nDATABASE_URL=postgres://localhost';
      mockMonacoEditor.getValue.mockReturnValue(content);

      const createObjectURLSpy = vi.spyOn(URL, 'createObjectURL').mockReturnValue('blob:test');
      const revokeObjectURLSpy = vi.spyOn(URL, 'revokeObjectURL').mockImplementation(() => {});

      // Mock document.createElement
      const mockAnchor = {
        href: '',
        download: '',
        click: vi.fn(),
        remove: vi.fn(),
      };
      vi.spyOn(document, 'createElement').mockReturnValue(mockAnchor as any);
      vi.spyOn(document.body, 'appendChild').mockImplementation(() => mockAnchor as any);

      component.exportToFile('test.env');

      expect(mockAnchor.download).toBe('test.env');
      expect(mockAnchor.click).toHaveBeenCalled();

      createObjectURLSpy.mockRestore();
      revokeObjectURLSpy.mockRestore();
    });

    it('should use default filename when exporting without filename', () => {
      component['editor'] = mockMonacoEditor;
      const content = 'API_KEY=test';
      mockMonacoEditor.getValue.mockReturnValue(content);

      const createObjectURLSpy = vi.spyOn(URL, 'createObjectURL').mockReturnValue('blob:test');
      const revokeObjectURLSpy = vi.spyOn(URL, 'revokeObjectURL').mockImplementation(() => {});

      const mockAnchor = {
        href: '',
        download: '',
        click: vi.fn(),
        remove: vi.fn(),
      };
      vi.spyOn(document, 'createElement').mockReturnValue(mockAnchor as any);
      vi.spyOn(document.body, 'appendChild').mockImplementation(() => mockAnchor as any);

      component.exportToFile();

      expect(mockAnchor.download).toBe('.env');

      createObjectURLSpy.mockRestore();
      revokeObjectURLSpy.mockRestore();
    });
  });

  describe('Editor Options and Configuration', () => {
    it('should enable line numbers in editor options', () => {
      const options = component.editorOptions();
      expect(options.lineNumbers).toBe('on');
    });

    it('should enable automatic layout in editor options', () => {
      const options = component.editorOptions();
      expect(options.automaticLayout).toBe(true);
    });

    it('should configure minimap in editor options', () => {
      const options = component.editorOptions();
      expect(options.minimap).toBeDefined();
      expect(options.minimap?.enabled).toBe(true);
    });

    it('should disable scroll beyond last line', () => {
      const options = component.editorOptions();
      expect(options.scrollBeyondLastLine).toBe(false);
    });

    it('should set readonly mode when readonly signal is true', () => {
      component.readonly.set(true);
      component['editor'] = mockMonacoEditor;

      component.setReadonly(true);

      expect(mockMonacoEditor.updateOptions).toHaveBeenCalledWith({ readOnly: true });
    });

    it('should disable readonly mode when readonly signal is false', () => {
      component.readonly.set(false);
      component['editor'] = mockMonacoEditor;

      component.setReadonly(false);

      expect(mockMonacoEditor.updateOptions).toHaveBeenCalledWith({ readOnly: false });
    });
  });

  describe('EnvSync Integration', () => {
    it('should parse .env content into key-value pairs', () => {
      const content = 'API_KEY=test123\nDATABASE_URL=postgres://localhost\nNODE_ENV=development';

      const variables = component.parseEnvContent(content);

      expect(variables.length).toBe(3);
      expect(variables[0]).toEqual({ key: 'API_KEY', value: 'test123' });
      expect(variables[1]).toEqual({ key: 'DATABASE_URL', value: 'postgres://localhost' });
      expect(variables[2]).toEqual({ key: 'NODE_ENV', value: 'development' });
    });

    it('should skip comments when parsing .env content', () => {
      const content = '# This is a comment\nAPI_KEY=test123\n# Another comment\nDATABASE_URL=url';

      const variables = component.parseEnvContent(content);

      expect(variables.length).toBe(2);
      expect(variables.some(v => v.key.startsWith('#'))).toBe(false);
    });

    it('should skip empty lines when parsing .env content', () => {
      const content = 'API_KEY=test123\n\n\nDATABASE_URL=url';

      const variables = component.parseEnvContent(content);

      expect(variables.length).toBe(2);
    });

    it('should handle quoted values when parsing .env content', () => {
      const content = 'API_KEY="test value with spaces"\nDATABASE_URL=\'single quoted\'';

      const variables = component.parseEnvContent(content);

      expect(variables[0].value).toBe('"test value with spaces"');
      expect(variables[1].value).toBe("'single quoted'");
    });

    it('should convert key-value pairs to .env format', () => {
      const variables = [
        { key: 'API_KEY', value: 'test123' },
        { key: 'DATABASE_URL', value: 'postgres://localhost' },
        { key: 'NODE_ENV', value: 'development' },
      ];

      const content = component.formatEnvContent(variables);

      expect(content).toBe('API_KEY=test123\nDATABASE_URL=postgres://localhost\nNODE_ENV=development');
    });

    it('should handle empty variables array when formatting', () => {
      const variables: Array<{ key: string; value: string }> = [];

      const content = component.formatEnvContent(variables);

      expect(content).toBe('');
    });
  });

  describe('Component Cleanup', () => {
    it('should dispose editor on component destroy', () => {
      component['editor'] = mockMonacoEditor;

      fixture.destroy();

      expect(mockMonacoEditor.dispose).toHaveBeenCalled();
    });

    it('should dispose content change subscription on component destroy', () => {
      const mockDispose = vi.fn();
      const mockMonaco = {
        languages: {
          register: vi.fn(),
          setMonarchTokensProvider: vi.fn(),
          setLanguageConfiguration: vi.fn(),
          registerCompletionItemProvider: vi.fn(),
        },
        editor: {
          defineTheme: vi.fn(),
        },
      };

      mockMonacoEditor.onDidChangeModelContent.mockReturnValue({ dispose: mockDispose });
      component.onEditorInit(mockMonacoEditor, mockMonaco as any);

      fixture.destroy();

      expect(mockDispose).toHaveBeenCalled();
    });
  });

  describe('Editor Actions and Commands', () => {
    it('should focus editor when focus method is called', () => {
      component['editor'] = mockMonacoEditor;

      component.focusEditor();

      expect(mockMonacoEditor.focus).toHaveBeenCalled();
    });

    it('should layout editor on window resize', () => {
      component['editor'] = mockMonacoEditor;

      component.layoutEditor();

      expect(mockMonacoEditor.layout).toHaveBeenCalled();
    });

    it('should format document when formatDocument is called', () => {
      component['editor'] = mockMonacoEditor;
      const mockFormatAction = { run: vi.fn() };
      mockMonacoEditor.getAction.mockReturnValue(mockFormatAction);

      component.formatDocument();

      expect(mockMonacoEditor.getAction).toHaveBeenCalledWith('editor.action.formatDocument');
      expect(mockFormatAction.run).toHaveBeenCalled();
    });
  });
});
