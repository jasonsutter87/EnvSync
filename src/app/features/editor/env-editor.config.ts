/**
 * Monaco Editor Configuration for EnvSync
 *
 * This file contains configuration for integrating Monaco Editor
 * into the Angular application. It should be imported in the
 * application configuration or main module.
 */

import type { NgxMonacoEditorConfig } from 'ngx-monaco-editor-v2';

/**
 * Default Monaco Editor configuration
 */
export const monacoConfig: NgxMonacoEditorConfig = {
  baseUrl: 'assets/monaco-editor',
  defaultOptions: {
    scrollBeyondLastLine: false,
    automaticLayout: true,
  },
  onMonacoLoad: () => {
    // Monaco editor loaded successfully
    console.log('Monaco Editor loaded');
  },
};

/**
 * Custom CSS styles for duplicate key decorations
 * Add this to your global styles or component styles
 */
export const DUPLICATE_KEY_STYLES = `
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
`;

/**
 * Instructions for setting up Monaco Editor assets
 *
 * 1. Install dependencies:
 *    npm install monaco-editor ngx-monaco-editor-v2
 *
 * 2. Copy Monaco Editor assets to your Angular project:
 *    Add to angular.json under "assets":
 *    {
 *      "glob": "**\/*",
 *      "input": "node_modules/monaco-editor/min/vs",
 *      "output": "assets/monaco-editor/vs"
 *    }
 *
 * 3. Import MonacoEditorModule in your app config:
 *    import { MonacoEditorModule } from 'ngx-monaco-editor-v2';
 *    import { monacoConfig } from './features/editor/env-editor.config';
 *
 *    export const appConfig: ApplicationConfig = {
 *      providers: [
 *        provideMonacoEditor(monacoConfig),
 *        // ... other providers
 *      ]
 *    };
 *
 * 4. Add duplicate key styles to your global styles.css:
 *    Import the DUPLICATE_KEY_STYLES from this file
 */
