module.exports = {
  extends: [
    'eslint:recommended',
    'plugin:@typescript-eslint/eslint-recommended',
    'plugin:@typescript-eslint/recommended',
    'plugin:react/recommended'
  ],
  parser: '@typescript-eslint/parser',
  parserOptions: {
    project: 'tsconfig.test.json',
    tsconfigRootDir: __dirname,
    sourceType: 'module'
  },
  plugins: ['@typescript-eslint'],
  rules: {
    '@typescript-eslint/explicit-function-return-type': 'off',
    '@typescript-eslint/no-empty-interface': 'off',
    '@typescript-eslint/naming-convention': [
      'error',
      {
        selector: 'interface',
        format: ['PascalCase']
      }
    ],
    '@typescript-eslint/no-empty-function': ['warn'],
    '@typescript-eslint/no-unused-vars': ['warn', { args: 'none' }],
    '@typescript-eslint/no-explicit-any': 'off',
    '@typescript-eslint/no-namespace': 'off',
    '@typescript-eslint/no-inferrable-types': ['warn', { ignoreParameters: true, ignoreProperties: true }],
    '@typescript-eslint/no-this-alias': [
      'error',
      {
        allowedNames: ['self'] // Allow `const self = this`
      }
    ],
    '@typescript-eslint/no-use-before-define': 'off',
    '@typescript-eslint/quotes': [
      'off',
      { avoidEscape: true, allowTemplateLiterals: true }
    ],
    'curly': 'off',
    'eqeqeq': 'error',
    'prefer-arrow-callback': 'error',
    'no-empty-pattern': 'off',
    'no-empty': ['warn', { allowEmptyCatch: true }] 
  },
  settings: {
    react: {
      version: 'detect'
    }
  }
};