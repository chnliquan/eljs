# Eljs Monorepo

A comprehensive collection of modern Node.js development tools for building robust applications and automation workflows.

## 🏗 Project Overview

```
eljs/
├── packages/
│   ├── config/                          # Configuration management utilities
│   ├── conventional-changelog-preset/  # Custom changelog preset for releases
│   ├── create/                         # Powerful project creation tool
│   ├── create-template/                # Template creation utilities
│   ├── plugin-host/                    # Plugin host and extension architecture
│   ├── release/                        # Automated release management
│   └── utils/                          # Comprehensive Node.js utilities
├── scripts/                            # Build and release automation
├── package.json                        # Root workspace configuration
├── turbo.json                          # Turborepo build pipeline
└── pnpm-workspace.yaml                 # pnpm workspace settings
```

## 📋 Available Packages

### 🚀 @eljs/create

Powerful and flexible project creation tool from templates with comprehensive automation support.

```bash
npx @eljs/create my-template my-project
```

**Features**: Dual CLI/API usage, multiple template sources, smart template resolution, interactive mode, plugin system

### 🧩 @eljs/create-template

Create projects from curated official templates with an interactive CLI or
programmatic API.

```bash
npx @eljs/create-template my-project
```

**Features**: Exact-version official templates, safe remote defaults,
cancellation, overwrite and transactional merge support

### 🛠 @eljs/utils

A comprehensive collection of Node.js utilities for modern development workflows.

```bash
pnpm add @eljs/utils
```

**Features**: Cross-platform support, dual async/sync APIs, file operations, git integration, process management, logging

### 📦 @eljs/release

Automated release management with semantic versioning and changelog generation.

```bash
npx @eljs/release
```

**Features**: Semantic versioning, automated changelog generation, multi-package support, git integration

### ⚙️ @eljs/config

Layered Node.js configuration loading with optional runtime validation.

```bash
npm install @eljs/config
```

**Features**: Optional validation hooks, environment suffix layering, structured errors, TypeScript support

### 🔌 @eljs/plugin-host

Extensible plugin system for building modular and customizable applications.

```bash
npm install @eljs/plugin-host
```

**Features**: Hook-based architecture, plugin lifecycle management, dependency injection, type safety

## 🔧 Development Guide

### Requirements

- Node.js 24 LTS is recommended; Node.js 22.14 or newer is required.
- pnpm 11.17.0 is pinned through Corepack.

### 1. Clone Repository

```bash
git clone https://github.com/chnliquan/eljs.git
```

### 2. Install Dependencies

```bash
corepack enable
corepack prepare pnpm@11.17.0 --activate
pnpm install
```

### 3. Build All Packages

```bash
pnpm run build
```

### 4. Development Mode

```bash
# Build all packages in watch mode
pnpm run dev

# Build specific package in watch mode
pnpm --filter <package-name> run dev
```

### 5. Run Tests

```bash
# Run tests for all packages
pnpm run test

# Run tests for specific package
pnpm exec vitest run packages/<package-name>

# Run tests in watch mode
pnpm run test:watch
```

## 🛠 Scripts Reference

### Monorepo Commands

| Command                | Description                                   | Usage                                         |
| ---------------------- | --------------------------------------------- | --------------------------------------------- |
| **Development**        |                                               |                                               |
| `dev`                  | Build all packages in watch mode              | `pnpm dev`                                    |
| `build`                | Build all packages                            | `pnpm build`                                  |
| `test`                 | Run tests for all packages                    | `pnpm test`                                   |
| `test:watch`           | Run tests in watch mode                       | `pnpm test:watch`                             |
| `pack:check`           | Verify files included in npm package tarballs | `pnpm pack:check`                             |
| **Code Quality**       |                                               |                                               |
| `lint`                 | Lint all packages source code                 | `pnpm lint`                                   |
| `typecheck`            | Type-check all TypeScript packages            | `pnpm typecheck`                              |
| `format`               | Format all packages with prettier             | `pnpm format`                                 |
| `coverage`             | Generate test coverage report                 | `pnpm coverage`                               |
| `verify`               | Run the complete local/CI verification suite  | `pnpm verify`                                 |
| **Release Management** |                                               |                                               |
| `release`              | Release all packages with unified versioning  | `pnpm release`                                |
| `release:patch`        | Patch version release for all packages        | `pnpm release:patch` (1.0.0 → 1.0.1)          |
| `release:minor`        | Minor version release for all packages        | `pnpm release:minor` (1.0.0 → 1.1.0)          |
| `release:major`        | Major version release for all packages        | `pnpm release:major` (1.0.0 → 2.0.0)          |
| `release:alpha`        | Alpha prerelease for all packages             | `pnpm release:alpha` (1.0.0 → 1.0.1-alpha.1)  |
| `release:beta`         | Beta prerelease for all packages              | `pnpm release:beta` (1.0.0 → 1.0.1-beta.1)    |
| `release:next`         | Next prerelease for all packages              | `pnpm release:next` (1.0.0 → 1.0.1-next.1)    |
| **Utilities**          |                                               |                                               |
| `package:create`       | Create or complete a package scaffold         | `pnpm package:create packages/<package-name>` |
| `add-owner`            | Add npm ownership for all packages            | `pnpm add-owner <username1> <username2>`      |
| `clean`                | Clean build artifacts from all packages       | `pnpm clean`                                  |

## 📦 Package Management

### Working with Specific Packages

```bash
# Install dependency to specific package
pnpm --filter <package-name> add <dependency>

# Run script in specific package
pnpm --filter <package-name> run <script>

# Build specific package and its dependencies
pnpm --filter <package-name>... run build

# Build packages that depend on specific package
pnpm --filter ...<package-name> run build
```

### Adding New Packages

```bash
# Create a package scaffold from the repository root
pnpm package:create packages/<new-package-name>

# Complete missing scaffold files in existing workspace packages
pnpm package:create
```

## 📋 Version Management

This monorepo uses **unified versioning** - all packages share the same version number and are released together, even if only one package has changes.

### 1. Commit Convention

Follow [Conventional Commits](https://www.conventionalcommits.org/en/v1.0.0/#summary) with package scope:

```bash
# ✅ Correct examples
git commit -m 'feat(create): add template validation'
git commit -m 'fix(utils): resolve path resolution issue'
git commit -m 'docs: update readme'
git commit -m 'chore: update dependencies'

# ❌ Incorrect examples (missing type)
git commit -m 'add some feature'
git commit -m 'fix some bug'

# ❌ Incorrect examples (missing scope for package changes)
git commit -m 'feat: add some feature'
git commit -m 'fix: fix some bug'
```

### 2. Release Process

```bash
# 1. Ensure code is up to date
git pull origin master

# 2. Build packages (optional)
pnpm run build --filter <package-name>
# or build specific package and dependencies
pnpm --filter <package-name>... run build

# 3. Release all packages
pnpm run release

# Available options:
#   --skipTests         Skip unit tests
#   --skipBuild         Skip package build
#   --skipRequireClean  Skip git working tree check
```

### 3. Package Publishing

- Packages marked with `"private": true` in their `package.json` will be skipped during publishing
- All public packages will be published with the same version number
- Version follows [Semantic Versioning](https://semver.org/) specification

## 🌿 Branch Management

This project follows [Git Flow](https://nvie.com/posts/a-successful-git-branching-model/) branching strategy:

<p align="center">
  <img src="https://static.yximgs.com/udata/pkg/ks-ad-fe/chrome-plugin-upload/2022-04-01/1648793291308.92a2b518ac6526d9.png" width="600" alt="Git Flow Branching Model" />
</p>

**Branch Naming Convention:**

- **master**: Main branch, maintains stable releasable state
- **develop**: Development branch, integration branch for features
- **feature/\<package-name\>-\<feature\>**: Feature branches, branched from develop, merged back to develop when complete (e.g., `feature/create-validation`, `feature/utils-logging`)
- **release/\<version\>**: Release branches, branched from develop, used for release preparation
- **hotfix/\<issue\>**: Hotfix branches, branched from master, used for emergency fixes

## 🤝 Contributing

See [CONTRIBUTING.md](./CONTRIBUTING.md) for local setup, package boundaries,
debugging, and the complete validation checklist.

1. Fork the repository
2. Create your feature branch: `git checkout -b feature/<package-name>-<feature-name>`
3. Make your changes following the coding standards
4. Add tests for your changes
5. Run tests: `pnpm run test`
6. Commit your changes: `git commit -m 'feat(<package-name>): add some feature'`
7. Push to the branch: `git push origin feature/<package-name>-<feature-name>`
8. Submit a pull request

## 📄 License

[MIT](https://github.com/chnliquan/eljs/blob/master/LICENSE)

---

For questions or suggestions, please submit an [Issue](https://github.com/chnliquan/eljs/issues) or [Pull Request](https://github.com/chnliquan/eljs/pulls).
