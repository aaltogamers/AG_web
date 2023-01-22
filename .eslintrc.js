module.exports = {
  parserOptions: {
    project: './tsconfig.eslint.json',
  },
  extends: [
    'airbnb',
    'airbnb-typescript',
    'plugin:@typescript-eslint/recommended',
    'plugin:prettier/recommended',
    'plugin:react/jsx-runtime',
  ],
  env: {
    node: true,
    browser: true,
  },
  rules: {
    'react/prop-types': 'off',
    'react/function-component-definition': [
      'error',
      {
        namedComponents: 'arrow-function',
        unnamedComponents: 'arrow-function',
      },
    ],
    'import/prefer-default-export': 'off',
    'react/require-default-props': 'off',
    'prettier/prettier': ['error', { endOfLine: 'auto' }],
  },
}
