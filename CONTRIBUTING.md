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
       └─> plugin-host ─┬─> create ─> create-template
                      └─> release
```

`conventional-changelog-preset` is an independent native ESM package consumed
by the release tooling. The TypeScript packages publish separate CommonJS and
native ESM runtime entries, selected through package exports, plus TypeScript
declarations.

## Validation

Run the same checks as CI before opening a pull request:

```bash
pnpm verify
```

This runs formatting, linting, type checking, coverage, builds, and isolated
checks against the files that would be published to npm.

During development, scope commands to a package:

```bash
pnpm --filter @eljs/create typecheck
pnpm exec vitest run packages/create/__tests__/core/create.spec.ts
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
- When adding or changing public APIs, document exported declarations and
  public extension points with standard TSDoc. Describe contracts and
  non-obvious constraints instead of restating names; TypeScript types belong
  in signatures rather than comments. Do not end TSDoc summaries or tag
  descriptions with a Chinese or English full stop.
- Run `pnpm lint` to catch invalid TSDoc syntax. The repository `AGENTS.md`
  defines documentation guidance for AI-assisted changes; package-specific
  files may extend it.
- Use Conventional Commits, preferably with the package name as scope, for
  example `fix(create): validate target path`.
- Do not edit generated `dist/` output; rebuild it from source.
