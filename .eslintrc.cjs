module.exports = {
  root: true,
  parser: '@typescript-eslint/parser',
  plugins: ['@typescript-eslint', 'unicorn', 'sonarjs', 'vitest', 'promise'],
  extends: [
    'eslint:recommended',
    'plugin:@typescript-eslint/recommended',
    'plugin:@typescript-eslint/recommended-requiring-type-checking',
    'plugin:@typescript-eslint/strict',
    'prettier',
    'plugin:unicorn/all',
    'plugin:sonarjs/recommended',
    'plugin:vitest/recommended',
    'plugin:promise/recommended',
  ],
  rules: {
    'unicorn/prevent-abbreviations': 'off',
    'unicorn/no-keyword-prefix': 'off',
    'unicorn/catch-error-name': ['error', { name: 'err' }],
    'unicorn/prefer-ternary': ['error', 'only-single-line'],
    '@typescript-eslint/no-unused-vars': [
      'error',
      { ignoreRestSiblings: true, argsIgnorePattern: '^_' },
    ],
    'unicorn/no-new-array': 'off',
    'unicorn/no-array-callback-reference': 'off',
    'unicorn/import-index': ['error', { ignoreImports: true }],
    'unicorn/filename-case': ['error', { case: 'camelCase' }],
    'sonarjs/no-duplicate-string': ['error', { threshold: 5 }],
  },
  parserOptions: {
    project: ['./tsconfig.json', './tests/tsconfig.json'],
  },
};
