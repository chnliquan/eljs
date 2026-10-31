# @eljs/generator

[English](./README.md)

基于本地、npm 和 Git 模板的可扩展项目生成工具，提供 CLI 和编程 API。

[![NPM Version](https://img.shields.io/npm/v/@eljs/generator.svg)](https://www.npmjs.com/package/@eljs/generator)
[![License](https://img.shields.io/npm/l/@eljs/generator.svg)](https://github.com/chnliquan/eljs/blob/master/LICENSE)

使用此包运行自己的模板，或通过插件构建项目生成器。如需选择官方模板，请使用 [`@eljs/create`](../create)。
如需本地交互提问和文件写入基础能力，请使用 `@eljs/utils/generator`。

## 运行环境要求

- Node.js 22.14 或更新版本
- 提供 ESM 和 CommonJS 入口及 TypeScript 类型声明
- 使用远程模板时需要访问包注册表或 Git

## 安装

```bash
# 用于编程调用和模板开发
pnpm add @eljs/generator

# 可选的全局 CLI 安装
pnpm add --global @eljs/generator
```

## 快速开始

```bash
# 从本地模板生成项目
npx @eljs/generator ./my-template my-project

# 从 npm 模板或 Git 仓库生成项目
npx @eljs/generator @company/project-template my-project
npx @eljs/generator https://github.com/user/template.git#main my-project
```

模板可以配置生成流程，并注册自定义问题、文件写入钩子和生成后的任务。

### 完整的本地模板

创建以下目录：

```text
my-template/
├── create.config.ts
├── plugins/
│   └── files.ts
└── templates/
    └── index.ts.tpl
```

`my-template/create.config.ts`：

```ts
import { defineConfig } from '@eljs/generator'

export default defineConfig({
  defaultQuestions: false,
  gitInit: false,
  install: false,
  plugins: ['./plugins/files.ts'],
})
```

`my-template/plugins/files.ts`：

```ts
import { definePlugin } from '@eljs/generator'
import { join } from 'node:path'

export default definePlugin(context => {
  context.onGenerateFiles(async () => {
    await context.copyTpl(
      join(context.paths.cwd, 'templates/index.ts.tpl'),
      context.resolve('src/index.ts'),
      { projectName: context.appData.projectName },
    )
  })
})
```

`my-template/templates/index.ts.tpl`：

```ts
export const projectName = '{{ projectName }}'
```

运行 `npx @eljs/generator ./my-template my-project`。插件会写入
`my-project/src/index.ts`；模板禁用了默认提问、Git 初始化和依赖安装。
模板文件默认使用 Mustache；如需使用 EJS，请在复制选项中显式设置
`renderOptions: { type: 'ejs' }`。

### 编程用法

```ts
import { ProjectGenerator } from '@eljs/generator'

const generator = new ProjectGenerator({
  template: './my-template',
  cwd: process.cwd(),
})

await generator.run('my-project')
```

`ProjectGeneratorOptions` 必须提供 `template`；其他选项控制生成行为和目录处理。
`constructorOptions` 是只读快照，`cwd` 暴露工作目录，`template` 暴露当前模板声明。

## CLI

```bash
generator [options] <template> <project-name>
```

| 选项                         | 说明                               | 默认值          |
| ---------------------------- | ---------------------------------- | --------------- |
| `--cwd <cwd>`                | 工作目录                           | `process.cwd()` |
| `-f, --force`                | 替换已有目标目录                   | `false`         |
| `-m, --merge`                | 将生成的输出合并到已有目标目录     | `false`         |
| `--install` / `--no-install` | 生成后安装项目依赖                 | `true`          |
| `-y, --yes`                  | 确认执行选中的远程模板             | `false`         |
| `--allow-template-scripts`   | 允许执行远程模板依赖的生命周期脚本 | `false`         |
| `-v, --version`              | 输出生成器版本                     | —               |
| `-h, --help`                 | 输出命令帮助                       | —               |

显式指定的 CLI 选项优先于模板配置，模板配置优先于内置默认值。
省略 `--install` 时，模板中的设置仍然生效。

## 模板配置

解析源和目标后，从模板根目录加载 `create.config.ts` 或 `create.config.js`。
源选择和目录处理由 `ProjectGeneratorOptions` 控制；模板配置控制生成行为：

```ts
import { defineConfig } from '@eljs/generator'

export default defineConfig({
  defaultQuestions: true,
  gitInit: true,
  install: true,
  presets: ['@company/generator-preset'],
  plugins: ['./plugins/files.ts'],
})
```

`ResolvedConfig` 仅将具有内置默认值的字段设为必填。
模板来源、`merge`、插件声明及远程模板中的可选字段仍保持可选。

插件和预设使用 `@eljs/plugin-host` 的生命周期。初始化阶段用于注册钩子；
在 `context.config`、`context.paths`、`context.appData` 或 `context.prompts`
的值解析完成前，不得访问它们。请在相应的钩子回调中读取运行时值。

```ts
import { definePlugin } from '@eljs/generator'
import { join } from 'node:path'

export default definePlugin(context => {
  context.addQuestions(() => [
    { type: 'text', name: 'authorName', message: 'Author name' },
  ])

  context.extendPackage(pkg => ({
    ...pkg,
    author: context.prompts.authorName,
  }))

  context.onGenerateFiles(async () => {
    await context.copyDirectory(
      join(context.paths.cwd, 'templates'),
      context.paths.target,
      {
        ...context.prompts,
        ...context.appData,
      },
    )
  })
})
```

`extendPackage` 在初始化阶段将变更加入队列，并在提问结果和项目元数据可用后应用回调。
生成文件的任务完成后，才会运行生成后钩子。

## 生成器能力

| 方法                                              | 用途                                 |
| ------------------------------------------------- | ------------------------------------ |
| `context.resolve(...paths)`                       | 解析项目目标目录下的路径             |
| `context.copyFile(from, to, options?)`            | 复制文件                             |
| `context.copyTpl(from, to, data, options?)`       | 渲染并复制单个模板文件               |
| `context.copyDirectory(from, to, data, options?)` | 复制并渲染目录                       |
| `context.render(path, data?, options?)`           | 渲染相对于调用插件的文件或目录       |
| `context.extendPackage(extension)`                | 将对象或回调结果合并到生成的包清单中 |
| `context.install(args?, options?)`                | 在生成的项目中安装依赖               |

请在钩子回调中等待异步复制和安装操作，以便运行器在推进生命周期之前完成这些任务。
文件写入能力会强制遵守项目输出边界。请从 `context.paths.cwd` 解析相对于模板的源路径；
`context.resolve()` 从目标目录解析输出路径。

## 远程源

```ts
import { ProjectGenerator } from '@eljs/generator'

const generator = new ProjectGenerator({
  template: {
    type: 'npm',
    value: '@company/project-template@1.0.0',
    registry: 'https://registry.npmjs.org',
  },
})

await generator.run('my-project')
```

`RemoteTemplate` 支持以下字段：

| 字段         | 契约                                       |
| ------------ | ------------------------------------------ |
| `type`       | `npm` 或 `git`                             |
| `value`      | npm 包标识或 Git 仓库地址                  |
| `registry?`  | npm 模板的包注册表 URL                     |
| `integrity?` | 预期 npm tarball 的 SRI 摘要；Git 忽略此项 |
| `trusted?`   | 对调用方信任的源跳过远程执行确认           |

### 模板执行与完整性

模板是可执行代码，使用当前进程的权限运行。
未知远程模板在下载和执行前需要确认。`yes: true` 或 `trusted: true`
会跳过该确认；这两项设置都不会隔离模板执行。

远程模板依赖的生命周期脚本默认禁用。`allowTemplateScripts: true` 会启用它们。
此设置独立于 `install`，后者控制生成项目的依赖安装。

npm 下载会继承项目和用户 `.npmrc` 中的认证及代理设置。
凭据按目标主机和路径匹配，不会转发给无关的 tarball 主机。
下载大小限制为 100 MiB，解压条目数限制为 20,000。

显式指定 `integrity` 摘要时，会校验独立提供的预期字节内容；
否则使用包注册表提供的 integrity 或 shasum。
跟随 `latest` 的封装工具可以省略单独的摘要。
固定模板精确版本的封装工具可以同时固定摘要，并在每次模板发布时更新。

## 目录事务与取消

`force` 和 `merge` 互斥。生成前会备份已有输出，生成失败时恢复。
生成成功后保留新输出并删除备份。目标锁可防止遵循该锁协议的进程并发写入同一个物理目录。
运行中断会留下恢复元数据，供下次调用使用。
如果锁尚未返回调用方就发生获取 mutex 释放失败，会先将该事务交接为 `recovery-pending`，
再交接已停止操作的 mutex。操作原始错误优先于释放错误。
撤销文件系统故障后可在同进程重试恢复，备份路径与恢复方向始终保留。
不会强制删除不可读取或所有权已变化的记录；若交接本身无法持久化，
保留原记录，等待所有者退出后安全恢复或人工检查。

有关状态顺序、恢复错误和文件系统限制，请参阅
[事务与恢复详情](https://github.com/chnliquan/eljs/blob/master/docs/generator-recovery.md)。

```ts
const controller = new AbortController()
const generator = new ProjectGenerator({
  template: './my-template',
  signal: controller.signal,
})

process.once('SIGINT', () => controller.abort())
await generator.run('my-project')
```

在下载、插件和生成的边界处检查取消状态。
创建错误使用 `AppError` 和稳定的 `CREATE_*` 错误码，
从包根入口和 `@eljs/generator/errors` 导出。

## 开发

在仓库根目录运行：

```bash
pnpm --filter @eljs/generator... build
pnpm --filter @eljs/generator typecheck
pnpm exec vitest run packages/generator/__tests__
DEBUG=generator:* pnpm exec generator ./my-template my-project
```
