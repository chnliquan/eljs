# @eljs/utils

面向 Node.js 工具链、脚手架和自动化任务的 TypeScript 基础能力包。提供文件系统、子进程、HTTP 下载、Git、包管理器、模板生成、路径、日志与通用类型等能力。

[![NPM Version](https://img.shields.io/npm/v/@eljs/utils.svg)](https://www.npmjs.com/package/@eljs/utils)
[![License](https://img.shields.io/npm/l/@eljs/utils.svg)](https://github.com/chnliquan/eljs/blob/master/LICENSE)

## 运行要求

- Node.js `>=22.14.0`
- 支持 Windows、macOS 和 Linux
- 同时发布 ESM、CommonJS 与 TypeScript 声明文件

`sudo()` 依赖系统的 `sudo` 可执行文件，因此不支持 Windows；Windows 调用会得到 `ERR_UNSUPPORTED_PLATFORM`。其他跨平台能力由 CI 在 Windows、macOS 和 Linux 上验证。

## 安装

```bash
pnpm add @eljs/utils
```

也可以使用 npm 或 Yarn 安装。

## 推荐导入方式

新代码优先从领域子路径导入，只加载当前功能需要的模块：

```ts
import { readJson, writeJsonAtomic } from '@eljs/utils/file'
import { run } from '@eljs/utils/cp'
import { downloadTo } from '@eljs/utils/http'
import type { PackageJson } from '@eljs/utils/types'
```

根入口继续提供兼容导出：

```ts
import { logger, readJson, run } from '@eljs/utils'
```

第三方库应直接从其所属包导入，不建议通过 `@eljs/utils` 间接使用。

## 领域入口

| 子路径                  | 主要能力                                      |
| ----------------------- | --------------------------------------------- |
| `@eljs/utils/cli`       | 确认、暂停与交互提示                          |
| `@eljs/utils/cp`        | 命令执行、可执行文件解析、PID 查询与 sudo     |
| `@eljs/utils/env`       | 全局安装检测与环境能力                        |
| `@eljs/utils/error`     | `UtilsError` 与稳定错误码                     |
| `@eljs/utils/file`      | 读写、复制、移动、删除、模板渲染与配置加载    |
| `@eljs/utils/generator` | 模板生成器生命周期                            |
| `@eljs/utils/git`       | Git 元信息、状态和常用操作                    |
| `@eljs/utils/guards`    | 运行时类型守卫                                |
| `@eljs/utils/http`      | 有界缓冲下载与流式落盘、解压                  |
| `@eljs/utils/logger`    | CLI 日志与 debug 适配                         |
| `@eljs/utils/module`    | Node 模块查找与同步加载                       |
| `@eljs/utils/npm`       | npm 元数据、包管理器检测、安装和 tarball 下载 |
| `@eljs/utils/object`    | 对象合并                                      |
| `@eljs/utils/path`      | 跨平台路径和工作区解析                        |
| `@eljs/utils/promise`   | deferred、重试和计时器                        |
| `@eljs/utils/string`    | 常用字符串格式转换                            |
| `@eljs/utils/types`     | 公共 TypeScript 类型                          |

包只公开上述领域入口，不承诺 `file/loader` 等内部文件路径的兼容性。

## 常用示例

### 文件与配置

```ts
import {
  copyDirectory,
  loadYaml,
  readJson,
  writeJsonAtomic,
} from '@eljs/utils/file'

interface Config {
  output: string
}

const packageJson = await readJson('./package.json')
const config = await loadYaml<Config>('./project.yaml')

await copyDirectory('./template', config.output, {
  packageName: packageJson.name,
})
await writeJsonAtomic('./generated/meta.json', { generated: true })
```

`loadTs()`、`loadTsSync()` 与 `resolveTsConfig()` 会按需加载 TypeScript；普通文件工具不会主动加载 TypeScript 编译器。

### 子进程

```ts
import { findExecutable, run } from '@eljs/utils/cp'

const git = await findExecutable('git')

if (!git) {
  throw new Error('Git is required')
}

const result = await run(git, ['status', '--short'], {
  cwd: process.cwd(),
  signal: AbortSignal.timeout(30_000),
})

console.log(result.stdout)
```

命令和参数应分开传递。`runCommandLine()` 只处理空白分隔与反斜杠转义，不是完整的 shell 解析器；不支持 shell 管道、重定向或变量展开。

## API 命名迁移

为使函数名直接表达行为，原兼容名称已经移除。升级旧代码时使用下列替代关系：

| 当前名称                    | 已移除名称              |
| --------------------------- | ----------------------- |
| `createTempDir`             | `tmpdir`                |
| `createTempDirSync`         | `tmpdirSync`            |
| `statPath` / `statPathSync` | `fstat` / `fstatSync`   |
| `pathExists`                | `isPathExists`          |
| `writeFileAtomic`           | `safeWriteFile`         |
| `writeJsonAtomic`           | `safeWriteJson`         |
| `copyTemplate`              | `copyTpl`               |
| `findExecutable`            | `getExecutableCommand`  |
| `findProcessId`             | `getPid`                |
| `parseCommandLine`          | `parseCommand`          |
| `runCommandLine`            | `runCommand`            |
| `cloneGitRepository`        | `downloadGitRepository` |
| `parseGitRemoteUrl`         | `gitUrlAnalysis`        |
| `parsePackageSpecifier`     | `pkgNameAnalysis`       |
| `findExistingPath`          | `tryPaths`              |
| `getCallerDirectory`        | `extractCallDir`        |
| `toPosixPath`               | `winPath`               |

`createTempDirSync()` 是同步 API；若旧代码曾对 `tmpdirSync()` 使用 `await`，迁移时同时删除 `await`。

### 有界下载与流式解压

```ts
import { download, downloadTo } from '@eljs/utils/http'

// 小响应：返回 Buffer，默认最多 100 MiB
const manifest = await download('https://example.com/manifest.json', {
  maxBytes: 1024 * 1024,
})

// 大文件：直接流入 tar 解压管道，不把完整响应保存在内存中
await downloadTo('https://example.com/package.tgz', './package', {
  extract: true,
  strip: 1,
  maxBytes: 500 * 1024 * 1024,
  maxEntries: 20_000,
  integrity: 'sha512-<base64-digest>',
  signal: AbortSignal.timeout(30_000),
})

console.log(manifest.byteLength)
```

`maxBytes: 0` 和 `maxEntries: 0` 表示不限制，只有在上层已经限制资源规模时才建议使用。`integrity` 使用 SRI 格式；不匹配时返回 `ERR_DOWNLOAD_INTEGRITY`。

### 结构化错误

```ts
import { run } from '@eljs/utils/cp'
import { UtilsError } from '@eljs/utils/error'

try {
  await run('node', ['--version'], { verbose: true })
} catch (error) {
  if (error instanceof UtilsError) {
    console.error(error.code, error.operation, error.details)
  }
  throw error
}
```

下载和 sudo 已提供稳定错误码；底层第三方异常在尚未归一化时仍可能原样抛出。

## 本地开发

在仓库根目录执行：

```bash
pnpm install --frozen-lockfile
pnpm --filter @eljs/utils typecheck
pnpm exec vitest run packages/utils
pnpm --filter @eljs/utils build
```

构建产物位于 `packages/utils/dist`，包含 ESM、CommonJS 和声明文件。提交前还应执行：

```bash
pnpm exec eslint packages/utils/src packages/utils/__tests__ --max-warnings=0
pnpm exec prettier --check packages/utils
```

## 设计约定

- 新的公共 API 必须提供中文 TSDoc 和回归测试
- 异步 API 完成时代表底层 I/O 或子进程生命周期已经结束
- Windows 路径不得假设 `/` 或 `:` 为平台分隔符
- 下载、进程与外部输入边界优先返回带稳定错误码的 `UtilsError`
- 观测能力保持厂商中立，由具体运行环境注入适配器
- 新能力通过领域入口公开，避免新增内部文件级导出

## License

[MIT](../../LICENSE)
