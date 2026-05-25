import tseslint from 'typescript-eslint';
import rootConfig from '../eslint.config.mjs';

export default tseslint.config(...rootConfig, {
  languageOptions: {
    parserOptions: {
      project: ['./tsconfig.json'],
      tsconfigRootDir: import.meta.dirname,
    },
  },
  rules: {
    '@typescript-eslint/no-explicit-any': 'off',
    'no-useless-constructor': 'off',
  },
});
