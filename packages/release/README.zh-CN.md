# @eljs/release

[English](./README.md)

可编程的 npm 发布工作流，支持版本管理、更新日志、GitHub 和按顺序发布工作区包。

[![NPM 版本](https://img.shields.io/npm/v/@eljs/release.svg)](https://www.npmjs.com/package/@eljs/release)
[![NPM 下载量](https://img.shields.io/npm/dm/@eljs/release.svg)](https://www.npmjs.com/package/@eljs/release)
[![许可证](https://img.shields.io/npm/l/@eljs/release.svg)](https://github.com/chnliquan/eljs/blob/master/LICENSE)

## ✨ 特性

- 🚀 **双重用法** - 同时支持 CLI 和编程式 API
- 📦 **版本管理** - 根据提交提供语义化版本建议，并校验显式指定的版本
- 📝 **更新日志生成** - 使用约定式提交自动生成更新日志
- 🔐 **NPM 发布** - 发布前检查 registry 和包所有权
- 🧪 **安全预览** - 使用 `--dry-run` 校验并预览发布
- 🧩 **Monorepo 支持** - 按运行时依赖顺序发布工作区包
- ⚙️ **配置** - 支持发布配置文件、预设和插件
- 🎯 **TypeScript API** - 提供带类型的发布选项和插件上下文
- 🔧 **插件系统** - 通过可扩展的插件架构定制工作流

## 📦 安装

已发布的包需要 Node.js 22.14 或更新版本。

```bash
# 使用 pnpm（推荐）
pnpm add @eljs/release -D

# 使用 yarn
yarn add @eljs/release -D

# 使用 npm
npm install @eljs/release -D
```

全局安装或通过 `npx @eljs/release` 调用时，使用 `release` 命令。

## 🚀 快速开始

### CLI 用法（推荐）

添加到你的 `package.json`：

```diff
{
  "scripts": {
+   "release": "release"
  },
  "devDependencies": {
+   "@eljs/release": "latest"
  }
}
```

基本用法：

```bash
# 通过交互式版本选择进行发布
npm run release

# 发布指定版本
npm run release 1.2.3
npm run release patch
npm run release minor
npm run release major

# 直接使用 npx
npx @eljs/release patch
```

### 编程式 API 用法

```typescript
import { release, defineConfig } from '@eljs/release'

// 简单发布
await release('patch')

// 使用自定义选项发布
await release('1.2.3', {
  git: {
    changelog: false,
    push: false,
  },
  npm: {
    prerelease: true,
    prereleaseId: 'beta',
  },
})
```

## 📖 CLI 参考

### 命令

```bash
release [options] [version]
```

### 参数

| 参数      | 描述                                                        |
| --------- | ----------------------------------------------------------- |
| `version` | 指定要升级到的版本（patch/minor/major 或 1.2.3 等具体版本） |

### 选项

| 选项                                           | 描述                                          | 默认值          |
| ---------------------------------------------- | --------------------------------------------- | --------------- |
| `-v, --version`                                | 输出当前版本                                  | -               |
| `--cwd <cwd>`                                  | 指定工作目录                                  | `process.cwd()` |
| `--dry-run`                                    | 预览，不发布也不修改项目文件                  | `false`         |
| `--git.independent` / `--no-git.independent`   | 为每个工作区包生成一个 git 标签               | `false`         |
| `--git.requireClean` / `--no-git.requireClean` | 检查 git 工作区是否干净                       | `true`          |
| `--git.commit` / `--no-git.commit`             | 提交版本和更新日志的变更                      | `true`          |
| `--git.push` / `--no-git.push`                 | 将提交和标签推送到远程                        | `true`          |
| `--git.requireBranch <branch>`                 | 要求在指定分支上发布                          | -               |
| `--retry`                                      | 根据 HEAD 上的发布标签重试该发布版本          | `false`         |
| `--npm.prerelease` / `--no-npm.prerelease`     | 指定发布类型为预发布                          | `false`         |
| `--npm.canary` / `--no-npm.canary`             | 指定发布类型为 canary                         | `false`         |
| `--npm.registry <registry>`                    | 查询、所有权检查和发布统一使用同一个 registry | 包/npm 配置     |
| `--npm.requireOwner` / `--no-npm.requireOwner` | 要求拥有所有包的 npm 所有权                   | `true`          |
| `--npm.confirm` / `--no-npm.confirm`           | 发布前确认版本升级                            | `true`          |
| `--npm.prereleaseId <id>`                      | 指定 alpha/beta/rc/next 等预发布标识          | -               |
| `--github.release` / `--no-github.release`     | 创建 GitHub Release                           | `true`          |
| `--github.mode <mode>`                         | 通过 `browser` 或 `api` 创建 GitHub Release   | `browser`       |
| `-h, --help`                                   | 显示命令帮助                                  | -               |

`--dry-run` 预览内置工作流，不发布也不修改项目文件。
自定义插件钩子仍会执行，必须在执行自身副作用前检查 `context.config.dryRun`。

要禁用更新日志生成，在 `release.config.ts` 中设置 `git.changelog: false`，
或将其传递给编程式 API：

```ts
import { defineConfig } from '@eljs/release'

export default defineConfig({
  git: { changelog: false },
})
```

#### 优先级

命令行中显式传入的选项始终覆盖 `release.config.ts` 文件中的配置，
文件配置则覆盖内置默认值：`CLI > release.config.ts > defaults`。
布尔选项接受肯定和否定两种形式；同一选项传入多次时，最后一次生效。

### CLI 示例

```bash
# 标准补丁版本发布
release patch

# 校验整个计划，不修改文件也不发布
release patch --dry-run

# 在自定义工作目录中发布主版本
release major --cwd ./packages/core

# 使用 beta 标签进行预发布
release --npm.prerelease --npm.prereleaseId beta

# 不进行 git 操作的发布
release minor --no-git.commit --no-git.push

# 在指定分支上使用自定义设置发布
release patch --git.requireBranch main --no-npm.confirm

# 即使 release.config.ts 将 git.push 设为 false，也启用推送
release patch --git.push

# 即使 release.config.ts 启用了独立标签，也将其禁用
release minor --no-git.independent
```

## 📖 API 参考

包根入口导出 `release`、`defineConfig`、`definePlugin`、
`definePreset`、`defaultConfig`、`releaseHookSchema`、`ReleaseRunnerStage`、
`AppError` 和 `ReleasePublishError`，以及配置、插件上下文、
应用数据和错误详情类型。运行器及命令、版本、Git、清单辅助函数属于内部实现

### `release(version?, options?)`

供编程式调用的主发布函数。

```typescript
async function release(version?: string, options?: Config): Promise<void>
```

**参数：**

- `version`（可选）：要升级到的版本（patch/minor/major 或具体版本）
- `options`（可选）：配置选项

**示例：**

```typescript
import { release } from '@eljs/release'

// 交互式发布
await release()

// 指定版本
await release('2.0.0')

// 使用自定义配置
await release('patch', {
  git: {
    requireClean: false,
    changelog: {
      filename: 'HISTORY.md',
      preset: 'angular',
    },
  },
  npm: {
    canary: true,
  },
})
```

## ⚙️ 配置

在项目根目录创建 **release.config.ts** 文件来保存持久配置：

```typescript
import { defineConfig } from '@eljs/release'

export default defineConfig({
  /**
   * 工作目录
   * @default process.cwd()
   */
  cwd: process.cwd(),
  /**
   * 校验并预览，不写入包清单/更新日志/锁文件，
   * 不创建提交/标签、不发布包、不推送，也不打开 GitHub
   * @default false
   */
  dryRun: false,
  /**
   * Git 配置
   */
  git: {
    /**
     * 是否要求 git 工作区干净
     * @default true
     */
    requireClean: true,
    /**
     * 要求在指定分支上发布
     */
    requireBranch: 'main',
    /**
     * 更新日志配置
     * @default { filename: 'CHANGELOG.md', preset: '@eljs/conventional-changelog-preset' }
     */
    changelog: {
      filename: 'CHANGELOG.md',
      placeholder: '**Note:** No changes, only version bump.',
      preset: '@eljs/conventional-changelog-preset',
    },
    /**
     * 是否生成独立的 git 标签
     * @default false
     */
    independent: false,
    /**
     * 是否提交变更
     * @default true
     */
    commit: true,
    /**
     * 提交消息模板
     * @default "chore: bump version v${version}"
     */
    commitMessage: 'chore: bump version v${version}',
    /**
     * Git 提交参数
     */
    commitArgs: ['--no-verify'],
    /**
     * 是否推送到远程
     * @default true
     */
    push: true,
    /**
     * Git 推送参数
     * @default ['--follow-tags']
     */
    pushArgs: ['--follow-tags', '--atomic'],
  },
  /**
   * NPM 配置
   */
  npm: {
    /**
     * 元数据查询、所有权检查和发布统一使用的 registry
     * @default 包的 publishConfig.registry 或 npm 配置
     */
    registry: 'https://registry.npmjs.org',
    /**
     * 是否要求校验 npm 所有权
     * @default true
     */
    requireOwner: true,
    /**
     * registry 请求的最大并发数
     * @default 8
     */
    networkConcurrency: 8,
    /**
     * 是否使用预发布类型
     */
    prerelease: false,
    /**
     * 预发布标识
     */
    prereleaseId: 'beta',
    /**
     * 是否使用 canary 版本
     * @default false
     */
    canary: false,
    /**
     * 是否确认升级后的版本
     * @default true
     */
    confirm: true,
    /**
     * NPM 发布参数
     */
    publishArgs: ['--access', 'public'],
  },
  /**
   * GitHub 配置
   */
  github: {
    /**
     * 是否在发布和推送完成后创建 GitHub Release
     * @default true
     */
    release: true,
    /**
     * 打开预填内容的浏览器页面，或通过 REST API 创建发布
     * @default 'browser'
     */
    mode: 'browser',
    /**
     * 包含 API token 的环境变量
     * @default 'GITHUB_TOKEN'
     */
    tokenEnv: 'GITHUB_TOKEN',
  },
  /**
   * 自定义预设
   */
  presets: [],
  /**
   * 自定义插件
   */
  plugins: [],
})
```

API 模式默认将 token 发送到 `github.com`。使用 GitHub Enterprise 时，
将 `github.enterpriseHost` 设置为与远程地址完全一致的小写主机名
（例如 `git.corp.example.com`）；协议、端口和路径均会被拒绝。

## 🔌 插件系统

通过插件入口模块扩展发布功能。插件专属选项作为声明元组的第二项传入：

插件钩子在 `--dry-run` 期间仍会运行，以便校验和预览其工作。
内置插件自动避免副作用；自定义插件必须在写入文件、发布数据、发送通知或改变外部状态前，
检查 `context.config.dryRun`。

```typescript
// release.config.ts
import { defineConfig } from '@eljs/release'

export default defineConfig({
  plugins: [
    [
      './plugins/custom-validation.ts',
      {
        checkTests: true,
        checkLinting: true,
      },
    ],
    './plugins/slack-notification.ts',
  ],
})
```

```typescript
// plugins/custom-validation.ts
import { definePlugin } from '@eljs/release'

interface ValidationOptions {
  checkTests: boolean
  checkLinting: boolean
}

export default definePlugin<ValidationOptions>(
  (
    context,
    options = {
      checkTests: true,
      checkLinting: true,
    },
  ) => {
    context.onBeforeRelease(async () => {
      await runCustomValidation(options)
    })
  },
)
```

```typescript
// plugins/slack-notification.ts
import { definePlugin } from '@eljs/release'

export default definePlugin(context => {
  context.onAfterRelease(async result => {
    if (context.config.dryRun) {
      return
    }

    await sendSlackNotification(`Released ${result.version}`)
  })

  context.onError(async ({ error, stage }) => {
    if (context.config.dryRun) {
      return
    }

    await reportReleaseFailure({ error, stage })
  })
})
```

## 📝 使用示例

### 基本 Monorepo 设置

```typescript
// 工作区根目录中的 release.config.ts
import { defineConfig } from '@eljs/release'

export default defineConfig({
  git: {
    independent: true, // 使用包专属标签；各包版本仍保持一致
    commitMessage: 'release: v${version}',
    changelog: {
      filename: 'CHANGELOG.md',
    },
  },
  npm: {
    publishArgs: ['--access', 'public', '--tag', 'latest'],
  },
})
```

### 自定义预发布工作流

```typescript
import { release } from '@eljs/release'

async function betaRelease() {
  await release(undefined, {
    npm: {
      prerelease: true,
      prereleaseId: 'beta',
      confirm: false,
      publishArgs: ['--tag', 'beta'],
    },
    git: {
      commitMessage: 'chore: beta release v${version}',
      push: false, // 不推送 beta 发布
    },
    github: {
      release: false, // 不为 beta 创建 GitHub 发布
    },
  })
}

betaRelease()
```

### CI/CD 集成

```yaml
# .github/workflows/release.yml
name: Release
on:
  workflow_dispatch:
    inputs:
      version:
        description: 'Version to release'
        required: true
        type: choice
        options: ['patch', 'minor', 'major']

jobs:
  release:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v6
        with:
          token: ${{ secrets.GITHUB_TOKEN }}
          fetch-depth: 0

      - name: Setup Node.js
        uses: actions/setup-node@v6
        with:
          node-version: 22.14.0
          registry-url: 'https://registry.npmjs.org'

      - name: Install dependencies
        run: npm ci

      - name: Release
        run: >-
          npx @eljs/release "$ELJS_RELEASE_VERSION"
          --no-npm.confirm --github.mode api
        env:
          GITHUB_TOKEN: ${{ github.token }}
          NODE_AUTH_TOKEN: ${{ secrets.NPM_TOKEN }}
          ELJS_RELEASE_VERSION: ${{ github.event.inputs.version }}
```

API 模式以幂等方式创建发布：复用具有相同标签的已有发布。
token 需要仓库的 Contents 写权限。本地使用时仍默认采用浏览器模式；
如果无法打开浏览器，命令会打印预填内容的 URL，且已完成的发布仍视为成功。

## 🛟 失败恢复

在所有包发布完成前，发布提交和标签始终保留在本地。如果工作区发布中途停止，
从未改动的发布提交重新运行精确的目标版本，例如 `release 1.2.3`，
或运行 `release --retry`，自动从 HEAD 上的发布标签识别失败的版本。
不要重新运行 `release patch` 等相对版本升级命令，因为它可能计算出更新的版本。
即使第一个包在任何包发布成功之前就失败，该恢复方式同样适用。
registry 中已存在的包会与本地标签进行核验并跳过；
随后发布剩余包，最后推送提交和标签。

独立标签模式的重试只考虑当前可发布工作区包的标签。
允许缺少某些包的标签，但匹配到的标签必须指向同一个版本。
统一标签模式的重试也会拒绝存在冲突的 `v<version>` 标签，而不会选择最高版本。

编程式调用方可以检查 `ReleasePublishError.details` 中的
`failedPackage`、`publishedPackages` 和 `unpublishedPackages`。
重试前不要修改、删除或移动本地发布标签。

自动恢复依赖默认的 `git.commit: true` 工作流。
禁用 Git 提交和标签时，需在开始下一次发布前手动处理任何部分发布的包集合，使其状态一致。

在进入内置 Git 提交或发布命令前，失败或取消会恢复内置的包清单、锁文件和更新日志变更，
包括原始字节、权限和存在状态。支持的锁文件包括 `package-lock.json`、
`pnpm-lock.yaml`、`yarn.lock`、`bun.lock` 和旧版 `bun.lockb`。
新创建的空更新日志目录会被移除；无关的自定义钩子文件保持不变。
一旦提交或发布调用开始，回滚即被禁用，因为即使命令报告失败，也可能已经产生副作用。

## 📦 包管理器兼容性

以根目录的 `packageManager` 声明为准，工作区锁文件作为后备依据。
支持 npm、pnpm、Yarn Classic、Yarn Berry 和 Bun。
通过声明或 `.yarnrc.yml` 区分 Yarn Berry，因此它使用
`yarn npm publish` 和 `yarn install --mode=update-lockfile`；
Yarn Classic 使用 `yarn publish`。同时检测 Bun 1.2+ 的 `bun.lock` 和旧版 `bun.lockb`。
使用 Yarn Berry 时，包清单中的任何 `publishConfig.registry` 都必须与显式配置的
`npm.registry` 一致，因为 Yarn 优先使用包清单中的值。
版本预检时固定的 registry 会在提交前和逐包发布前再次核对，包括钩子改写后的清单声明。
Berry 清单声明必须与固定地址一致（忽略尾部斜杠）。
其他管理器使用固定的 CLI registry 覆盖清单声明，因此允许被覆盖的不同地址。
如果此前没有固定 registry，则拒绝后来新增清单地址；请在发布前配置 `npm.registry`。

所有 `onBeforeRelease` 钩子执行完成后，在 Git 提交前检查磁盘上的包清单，
并在发布每个包前再次检查。pnpm 的 `publishConfig.directory` 会作为实际发布目录进行检查。
构建发布产物时，应在 `onBeforeRelease` 中准备该目录的包清单；
检查不会运行 `pack` 或生命周期脚本。它保证命令启动前的包清单状态，
但不会锁定最终的 tarball，也不会阻止外部进程写入文件系统。
`dryRun` 使用内存中的计划，不要求存在已构建的产物。

实际发布清单的 `dependencies`、`optionalDependencies`、`devDependencies` 和
`peerDependencies` 都会检查内部依赖范围。workspace 显式范围必须有效并包含目标版本；
workspace 别名、相对引用及 `*`、`^`、`~` 占位符保留原有语义。
普通内部 semver 范围同样必须有效并包含本次统一版本：版本更新通常会将这些范围替换为
目标版本，因此构建产物中残留的旧范围会被拒绝。`*` 允许预发布版本，
其他范围遵循标准 semver 预发布匹配规则。
`npm:`、`file:`、`link:`、Git 和 tarball URL 等外部来源协议保持原样，
不要求其外部目标采用本次统一版本。
private 工作区包不属于本次发布制品：普通 dev/peer 内部范围只要求有效，
workspace 显式范围仍需匹配其实际清单版本；运行时依赖 private 包仍被拒绝。

`publishArgs` 不能覆盖 registry、发布目录、工作区选择或版本。
registry 覆盖方式包括作用域配置、`--userconfig` 等配置文件选择参数，以及 pnpm 的 `--config.*` 选项。
请通过 `npm.registry` 配置 registry。其他未知选项的值必须使用 `--option=value` 形式。
发布目标限制也适用于规范化后的选项名，包括 `---workspace` 等多连字符形式。
已知会改变目标的别名和缩写（如 `--w`、`--ws`、`--C` 和 `--prefi`）也会被拒绝，
工作区根目录包含选项、pnpm 的 `-F` 和 `--workspace-packages` 同样被拒绝。
npm 的小写 `-f` 仍可使用。
额外的 `--dry-run` 参数会被拒绝，包括 false 值、否定形式、`---DRY_RUN` 等规范化形式，
以及 `--dry`、`--dr`、`-d` 等缩写。唯一预览入口是顶层 `dryRun`（或 CLI `--dry-run`），
避免将包管理器预览误记为成功发布。
帮助、用法和版本显示选项同样会被拒绝，包含 `---HELP`、`--no-usage`、`--ver` 和 `-v`
等规范化形式、否定形式和缩写。npm 发布固定使用 `--dry-run=false --usage=false`；
pnpm 使用 `--dry-run=false`，并覆盖继承的 `npm_config_usage`，兼容转交 npm 发布的版本。
这些设置优先于项目 `.npmrc` 和环境中的预览、用法配置。
Yarn Classic、Yarn Berry 和 Bun 保持原有命令，不传入 npm 专用配置参数。

发布命令不会回显参数，也不会将子进程输出流式写入日志，
因为 OTP 值和 registry URL 可能包含凭据。
发布错误保留结构化进度，以及包含退出码、已识别错误码和取消状态的安全 `cause`；
原始命令错误、输出和原始 cause 链会被丢弃。所有权检查与 `isVersionExist` 查询失败时
使用相同的安全诊断信息。版本不存在或 404 仍返回 `false`；
其他查询失败抛出新的安全错误，不携带原始敏感 cause。
版本查询显式请求 JSON 格式的 `name` 和 `version` 字段，并关闭 npm 用法输出。
只有两个字段都与查询目标精确匹配的对象才能确认版本存在；
帮助文本、无效 JSON 和身份不匹配均抛出安全错误，不能令重试跳过包。
空输出保留原有的 `false` 结果。

更新日志生成会接收运行器的取消信号。导出的 `getChangelog({ cwd, signal })` 辅助函数也支持取消：
已中止的信号不会启动任何 Git 进程；取消时会等待活动 Git 进程关闭，
再以信号的原始原因拒绝。

## 🧑‍💻 开发

从仓库根目录执行：

```bash
pnpm install
pnpm --filter @eljs/release lint
pnpm --filter @eljs/release typecheck
pnpm --filter @eljs/release test
pnpm --filter @eljs/release build
```

仓库开发需要 Node.js 22.18 或更新版本，以及 pnpm 11.20.0。
持久配置可以放在目标根目录的 `release.config.ts` 或 `release.config.js` 中。
