# Eljs — Composable Node.js Tooling

A TypeScript toolkit for building extensible Node.js CLIs, project generators,
and release workflows.

Eljs is the umbrella identity for the `@eljs/*` packages. The repository name
stays short, while each package name describes a concrete role and can be used
independently.

## Package Architecture

| Layer         | Package                                                                           | Responsibility                                                           |
| ------------- | --------------------------------------------------------------------------------- | ------------------------------------------------------------------------ |
| Foundations   | [`@eljs/utils`](./packages/utils)                                                 | Files, processes, downloads, Git, npm, paths, logging, and shared types  |
| Foundations   | [`@eljs/cache`](./packages/cache)                                                 | Persistent memory-and-disk cache with TTL validation and bounded cleanup |
| Foundations   | [`@eljs/config`](./packages/config)                                               | Layered configuration loading, merging, and runtime validation           |
| Extensibility | [`@eljs/plugin-host`](./packages/plugin-host)                                     | Typed plugin lifecycle, presets, ordered hooks, and context extensions   |
| Workflows     | [`@eljs/create`](./packages/create)                                               | Extensible project generation from local, npm, and Git templates         |
| Workflows     | [`@eljs/release`](./packages/release)                                             | Programmable npm release and ordered workspace publishing                |
| Entry points  | [`@eljs/create-template`](./packages/create-template)                             | Project initialization from version-pinned official templates            |
| Integration   | [`@eljs/conventional-changelog-preset`](./packages/conventional-changelog-preset) | Default Conventional Changelog preset used by `@eljs/release`            |

## Quick Start

```bash
# Generate a project from any supported template source
npx @eljs/create my-template my-project

# Start from a curated official template
npx @eljs/create-template my-project

# Run a programmable npm release workflow
npx @eljs/release
```

Global installations also expose the namespaced commands `eljs-create`,
`eljs-create-template`, and `eljs-release`. Existing short commands remain
available as compatibility aliases.

## Requirements

- Node.js 24 LTS is recommended; Node.js 22.14 or newer is required
- pnpm 11.17.0 is pinned through Corepack for repository development

## Documentation

Each package directory contains its installation guide, API examples, runtime
constraints, and package-specific development commands. See
[`CONTRIBUTING.md`](./CONTRIBUTING.md) for workspace setup, package creation,
versioning, releases, and the complete validation checklist.

## Contributing

Issues and pull requests are welcome. Keep package boundaries intact, add tests
for behavior changes, and run `pnpm verify` before submitting a pull request.

## License

[MIT](./LICENSE)
