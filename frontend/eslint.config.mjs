import next from '@next/eslint-plugin-next';
import jsxA11y from 'eslint-plugin-jsx-a11y';
import react from 'eslint-plugin-react';
import reactHooks from 'eslint-plugin-react-hooks';
import tseslint from 'typescript-eslint';
import rootConfig from '../eslint.config.mjs';

export default tseslint.config(...rootConfig, {
  plugins: {
    react,
    'react-hooks': reactHooks,
    '@next/next': next,
    'jsx-a11y': jsxA11y,
  },
  languageOptions: {
    parserOptions: {
      project: ['./tsconfig.json'],
      tsconfigRootDir: import.meta.dirname,
    },
  },
  rules: {
    ...reactHooks.configs.recommended.rules,
    ...next.configs.recommended.rules,
    ...next.configs['core-web-vitals'].rules,
    'react/react-in-jsx-scope': 'off',
    'react/prop-types': 'off',
    '@typescript-eslint/no-explicit-any': 'off',
  },
});
