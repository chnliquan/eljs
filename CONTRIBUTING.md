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

## Workspace commands

| Command           | Purpose                                                    |
| ----------------- | ---------------------------------------------------------- |
| `pnpm dev`        | Build all packages in watch mode                           |
| `pnpm build`      | Build all publishable packages                             |
| `pnpm test`       | Run the complete test suite                                |
| `pnpm typecheck`  | Type-check every TypeScript package                        |
| `pnpm lint`       | Run ESLint, including TSDoc syntax checks                  |
| `pnpm pack:check` | Verify installed tarballs, exports, types, CLIs, and files |
| `pnpm verify`     | Run the complete local and CI verification suite           |

Use pnpm filters while iterating on one package:

```bash
pnpm --filter @eljs/create typecheck
pnpm exec vitest run packages/create/__tests__/core/create.spec.ts
pnpm --filter @eljs/create... build
```

## Creating packages

New packages require a concrete consumer-facing description:

```bash
pnpm package:create packages/<package-name> \
  --description "One concrete role and its distinguishing contract"
```

Running `pnpm package:create` without a path only completes missing scaffold
files in existing workspace packages. It does not replace their descriptions
or other package-specific metadata.

## Repository layout

The main package dependency flow is:

```text
utils ─> config ─> plugin-host ─┬─> create ─> create-template
                              └─> release

cache
conventional-changelog-preset ─> release
```

`cache` is an independent foundation package. `conventional-changelog-preset`
is an independent native ESM package consumed by the release tooling. The
TypeScript packages publish separate CommonJS and native ESM runtime entries,
selected through package exports, plus TypeScript declarations.

## Naming conventions

- Use `Eljs` for the display brand, `eljs` for the repository, and `@eljs/*`
  for published package identities.
- Name a package after one concrete role that a consumer can recognize, such
  as `plugin-host` or `config`; avoid implementation details and broad synonyms
  such as `core`, `common`, or another generic `utils` package.
- Describe a package with its target, primary capability, and distinguishing
  contract. Avoid unsupported superlatives such as "powerful," "smart," or
  "comprehensive."
- Keep an existing published name when clearer positioning is sufficient. If
  an API redesign requires a new package name, ship it in a major release
  instead of presenting it as a drop-in rename.
- Add new cross-cutting helpers to `@eljs/utils` only when they are reusable
  mechanisms rather than product workflow or policy. Split a domain when it
  gains independent consumers, security boundaries, or a release cadence.

## Validation

Run the same checks as CI before opening a pull request:

```bash
pnpm verify
```

This runs formatting, linting, type checking, coverage, builds, and isolated
checks against the files that would be published to npm.

## Debugging CLI packages

CLI diagnostics use the `debug` namespace:

```bash
DEBUG=create:* pnpm exec eljs-create <template> <project-name>
DEBUG=create-template:* pnpm exec eljs-create-template <project-name>
DEBUG=release:* pnpm exec eljs-release
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

## Versioning and releases

The workspace uses unified versioning: all public packages carry the same
version and are released together. Public API removals or incompatible contract
changes require a new major line even when only one package changes.

Use the root release commands rather than publishing individual package
directories:

```bash
pnpm release
pnpm release:alpha
pnpm release:beta
pnpm release:next
```

The release workflow validates the workspace, updates package versions and the
lockfile together, generates the changelog, and publishes packages in runtime
dependency order.
