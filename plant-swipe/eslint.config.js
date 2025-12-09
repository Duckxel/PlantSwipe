import js from '@eslint/js'
import globals from 'globals'
import reactHooks from 'eslint-plugin-react-hooks'
import reactRefresh from 'eslint-plugin-react-refresh'
import tseslint from 'typescript-eslint'
import { globalIgnores } from 'eslint/config'

export default tseslint.config([
  globalIgnores(['dist']),
  {
    files: ['**/*.{ts,tsx}'],
    extends: [
      js.configs.recommended,
      tseslint.configs.recommended,
      reactHooks.configs['recommended-latest'],
      reactRefresh.configs.vite,
    ],
    languageOptions: {
      ecmaVersion: 2020,
      globals: globals.browser,
    },
    rules: {
      // Allow unused variables that start with underscore
      '@typescript-eslint/no-unused-vars': ['error', { 
        argsIgnorePattern: '^_',
        varsIgnorePattern: '^_',
        caughtErrorsIgnorePattern: '^_'
      }],
      // Downgrade explicit any to warning (valid TS but not best practice)
      '@typescript-eslint/no-explicit-any': 'warn',
      // Allow empty catch blocks (often intentional for optional error handling)
      'no-empty': ['error', { allowEmptyCatch: true }],
      // Downgrade ts-comment rules to warn
      '@typescript-eslint/ban-ts-comment': 'warn',
      // Disable react-refresh for barrel files and files with mixed exports
      'react-refresh/only-export-components': 'off',
      // Allow empty interfaces (often used for extension points)
      '@typescript-eslint/no-empty-object-type': 'off',
    },
  },
])
