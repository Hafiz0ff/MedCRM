# Contributing

## Local Checks

Before opening a pull request, run:

```bash
npm run verify
```

For targeted checks:

```bash
npm run lint
npm run format:check
npm run typecheck
npm --workspace backend run test:gateway
npm --workspace frontend run test
```

## Commit Messages

This repository uses Conventional Commits. Valid scopes are enforced by commitlint and include:

- `auth`
- `emr`
- `finance`
- `reception`
- `scheduling`
- `gateway`
- `frontend`
- `prisma`
- `infra`
- `deps`

Example:

```text
fix(scheduling): restore clinic catalog routes
```

## Prisma Changes

Any pull request that changes Prisma schema files must include the matching migration and a short rollback note in the PR description.

Run these checks before pushing Prisma changes:

```bash
npm run prisma:format
npm run prisma:validate
```

## Security

Do not commit secrets. Pre-commit hooks run lint-staged and use gitleaks when the local binary is installed. CI also runs gitleaks and `npm audit --audit-level=high`.
