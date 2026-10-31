# Contributing to Eljs

[English](./CONTRIBUTING.md) | [简体中文](./CONTRIBUTING.zh-CN.md)

## Prerequisites

- Node.js 24 LTS is recommended; Node.js 22.18 or newer is required for development.
- pnpm 11.20.0 is managed through Corepack.

The repository includes `.nvmrc` and `.node-version` for version managers.

## Local setup

```bash
corepack enable
corepack prepare pnpm@11.20.0 --activate
pnpm install
pnpm build
```

If dependency installation unexpectedly uses a private registry, inspect the
effective setting before changing it:

```bash
pnpm config get registry
```

## Workspace commands

| Command              | Purpose                                                    |
| -------------------- | ---------------------------------------------------------- |
| `pnpm dev`           | Build all packages in watch mode                           |
| `pnpm build`         | Build all publishable packages                             |
| `pnpm test`          | Run the complete test suite                                |
| `pnpm typecheck`     | Type-check every TypeScript package                        |
| `pnpm lint`          | Run ESLint, including TSDoc syntax checks                  |
| `pnpm package:check` | Verify installed tarballs, exports, types, CLIs, and files |

Use pnpm filters while iterating on one package:

```bash
pnpm --filter @eljs/generator typecheck
pnpm exec vitest run packages/generator/__tests__/core/create.spec.ts
pnpm --filter @eljs/generator... build
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
New scaffolds include both README languages and their publish-file entries.
Package directory names must start with a lowercase letter. If an existing
package has only one README language, synchronize its translation before
running the scaffolder.

An explicit `--description` updates an existing public package's description
without rebuilding its other metadata. With `--force`, scaffold metadata is
refreshed and the explicit description still takes precedence over the old value.

## Repository layout

The main package dependency flow is:

```text
utils ─> config-loader ─> plugin-host ─┬─> generator ─> create
                                     └─> release

cache
conventional-changelog-preset ─> release
```

`cache` is an independent foundation package. `conventional-changelog-preset`
is an independent TypeScript package consumed by the release tooling. All
packages publish separate CommonJS and native ESM runtime entries,
selected through package exports, plus TypeScript declarations.

The repository toolchain requires Node.js 22.18 or newer, while published
packages support Node.js 22.14. CI builds with Node.js 24 and runs tarball
consumer checks with Node.js 22.14 using `ELJS_SMOKE_NODE`. This variable selects
the consumer executable only; installation and declaration checks continue to
use the toolchain Node.

## Naming conventions

- Use `Eljs` for the display brand, `eljs` for the repository, and `@eljs/*`
  for published package identities.
- Name a package after one concrete role that a consumer can recognize, such
  as `plugin-host` or `config-loader`; avoid implementation details and broad synonyms
  such as `core`, `common`, or another generic `utils` package.
- Describe a package with its target, primary capability, and distinguishing
  contract. Avoid unsupported superlatives such as "powerful," "smart," or
  "comprehensive."
- Package names and exported APIs should describe their current responsibility.
  Publish name changes and incompatible API changes in a breaking release.
- Add new cross-cutting helpers to `@eljs/utils` only when they are reusable
  mechanisms rather than product workflow or policy. Split a domain when it
  gains independent consumers, security boundaries, or a release cadence.

## Documentation languages

Keep `README.md` in English and `README.zh-CN.md` in Simplified Chinese at the
repository root and in every public package. Add links to the other language
immediately after the title. Keep sections, API contracts, examples, and
runtime constraints aligned; translate code comments without changing
executable statements or example data. Include `README.zh-CN.md` in each
package's published files.

Keep the repository contribution guide in `CONTRIBUTING.md` and
`CONTRIBUTING.zh-CN.md` aligned as well, with language links after the title.
Update both versions whenever contribution rules or development workflows change.

Update both versions whenever a README changes. Use `pnpm docs:check` for
READMEs and the contribution guide to check language links, heading levels, table row counts, executable examples,
and local link targets. This structural check does not validate translated
prose or replace review against the implementation. Use `pnpm package:check`
to verify that both language entry points are present in the published tarballs.

## Validation

Run the same checks as CI before opening a pull request:

```bash
pnpm verify
```

This runs formatting, linting, type checking, coverage, builds, and isolated
checks against the files that would be published to npm.

Run `pnpm verify:templates` separately to check published official template
contents and real project generation. It requires network access and published
template packages. The manual **Official Templates** GitHub Actions workflow
runs the same check. Template availability is independent of repository
verification and package publishing; this check is not a release prerequisite.

## Debugging CLI packages

CLI diagnostics use the `debug` namespace:

```bash
DEBUG=generator:* pnpm exec generator <template> <project-name>
DEBUG=create:* pnpm exec create <project-name>
DEBUG=release:* pnpm exec release
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
pnpm release -- patch
```

The release workflow validates the workspace, updates package versions and the
lockfile together, generates the changelog, and publishes packages in runtime
dependency order.
