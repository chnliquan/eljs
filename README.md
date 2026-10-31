# Eljs — Composable Node.js Tooling

[简体中文](./README.zh-CN.md)

A TypeScript toolkit for building extensible Node.js CLIs, project generators,
and release workflows.

Each `@eljs/*` package provides one part of the toolchain and can be used
independently.

## Choosing a Package

- Create a project from an official template with `@eljs/create`
- Build a generator or use your own local, npm, or Git template with `@eljs/generator`
- Build a plugin-powered CLI or workflow with `@eljs/plugin-host`
- Version and publish npm packages or workspaces with `@eljs/release`
- Use configuration loading, caching, and Node.js utilities independently

## Package Architecture

| Layer         | Package                                                                           | Responsibility                                                             |
| ------------- | --------------------------------------------------------------------------------- | -------------------------------------------------------------------------- |
| Foundations   | [`@eljs/utils`](./packages/utils)                                                 | Files, processes, downloads, Git, npm, paths, logging, and shared types    |
| Foundations   | [`@eljs/cache`](./packages/cache)                                                 | In-memory caching, disk persistence, TTL validation, and file invalidation |
| Foundations   | [`@eljs/config-loader`](./packages/config-loader)                                 | Configuration discovery, loading, merging, and runtime validation          |
| Extensibility | [`@eljs/plugin-host`](./packages/plugin-host)                                     | Typed plugin lifecycle, presets, ordered hooks, and context extensions     |
| Workflows     | [`@eljs/generator`](./packages/generator)                                         | Extensible project generation from local, npm, and Git templates           |
| Workflows     | [`@eljs/release`](./packages/release)                                             | Programmable npm release and ordered workspace publishing                  |
| Entry points  | [`@eljs/create`](./packages/create)                                               | Project initialization from the latest official Eljs templates             |
| Integration   | [`@eljs/conventional-changelog-preset`](./packages/conventional-changelog-preset) | Default Conventional Changelog preset used by `@eljs/release`              |

## Quick Start

```bash
# Start from a curated official template
npm create @eljs my-project

# Generate a project from your own local template
npx @eljs/generator ./my-template my-project

# Run a programmable npm release workflow
npx @eljs/release
```

Global installations expose the commands `create`, `generator`, and
`release`.

## Requirements

- Published packages require Node.js 22.14 or newer
- Repository development requires Node.js 22.18 or newer; Node.js 24 LTS is recommended
- pnpm 11.20.0 is pinned through Corepack for repository development

## Documentation

The root and every package provide an English `README.md` and a Simplified
Chinese `README.zh-CN.md`, with matching installation guides, API examples,
runtime constraints, and package-specific development commands.

See the [contribution guide](./CONTRIBUTING.md) for workspace setup, package
creation, versioning, releases, and the complete validation checklist.

## Contributing

Issues and pull requests are welcome. Keep package boundaries intact, add tests
for behavior changes, and run `pnpm verify` before submitting a pull request.

## License

[MIT](./LICENSE)
