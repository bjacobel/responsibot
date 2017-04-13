module.exports = {
  parserOptions: {
    ecmaVersion: 8,
    sourceType: 'module',
    ecmaFeatures: {
      modules: true,
    },
  },
  environments: {
    es6: true,
    jest: true,
  },
  extends: [
    'eslint-config-airbnb-base',
  ],
};
