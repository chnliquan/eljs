# Contributing to Eljs

## Prerequisites

- Node.js 24 LTS is recommended; Node.js 22.14 or newer is required.
- pnpm 11.17.0 is managed through Corepack.

The repository includes `.nvmrc` and `.node-version` for version managers.

## Local setup

```bash
corepack enable
corepack prepare pnpm@11.17.0 --activate
pnpm install
pnpm build
```

If dependency installation unexpectedly uses a private registry, inspect the
effective setting before changing it:

```bash
pnpm config get registry
```

## Repository layout

The main package dependency flow is:

```text
utils ─┬─> config
       ├─> cache
       └─> pluggable ─┬─> create ─> create-template
                      └─> release
```

`conventional-changelog-preset` is an independent native ESM package consumed
by the release tooling. The TypeScript packages publish a CommonJS runtime
entry that works with both Node.js `require()` and `import()`, plus TypeScript
declarations.

## Validation

Run the same checks as CI before opening a pull request:

```bash
pnpm lint
pnpm typecheck
pnpm test
pnpm build
pnpm pack:check
```

During development, scope commands to a package:

```bash
pnpm --filter @eljs/create typecheck
pnpm test -- packages/create/__tests__/core/create.spec.ts
pnpm --filter @eljs/create... build
```

## Debugging CLI packages

CLI diagnostics use the `debug` namespace:

```bash
DEBUG=create:* pnpm exec create <template> <project-name>
DEBUG=create-template:* pnpm exec create-template <project-name>
DEBUG=release:* pnpm release
```

Do not include tokens, registry credentials, or private template URLs in issue
reports or debug logs.

## Changes and commits

- Keep package boundaries intact and avoid importing another package's source
  files directly.
- Add regression tests for behavior changes.
- Use Conventional Commits, preferably with the package name as scope, for
  example `fix(create): validate target path`.
- Do not edit generated `lib/` or `esm/` output; rebuild it from source.
