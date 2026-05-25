module.exports = {
  extends: ['@commitlint/config-conventional'],
  rules: {
    'type-enum': [2, 'always', ['feat', 'fix', 'refactor', 'perf', 'docs', 'test', 'chore', 'ci']],
    'scope-enum': [
      2,
      'always',
      [
        'auth',
        'emr',
        'finance',
        'reception',
        'scheduling',
        'gateway',
        'frontend',
        'prisma',
        'infra',
        'deps',
      ],
    ],
  },
};
