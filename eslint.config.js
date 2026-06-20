import js from '@eslint/js'
import pluginVue from 'eslint-plugin-vue'
import configPrettier from 'eslint-config-prettier'
import globals from 'globals'

export default [
  {
    ignores: ['dist/**', 'node_modules/**'],
  },
  js.configs.recommended,
  ...pluginVue.configs['flat/recommended'],
  {
    files: ['**/*.{js,vue}'],
    languageOptions: {
      ecmaVersion: 'latest',
      sourceType: 'module',
      globals: {
        ...globals.browser,
      },
    },
    rules: {
      // The game uses leading-underscore vars (_w/_h) as a deliberate convention.
      'no-unused-vars': ['error', { argsIgnorePattern: '^_', varsIgnorePattern: '^_' }],
      // Canvas game has many single-file components with long render functions;
      // this is a small project, not a component library.
      'vue/multi-word-component-names': 'off',
    },
  },
  {
    // Test files run under Vitest (node + vitest globals).
    files: ['**/*.{test,spec}.js'],
    languageOptions: {
      globals: {
        ...globals.node,
      },
    },
  },
  // Keep Prettier and ESLint from fighting over formatting.
  configPrettier,
]
