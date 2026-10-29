# @eljs/utils

[English](./README.md)

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
| `@eljs/utils/cli`       | 交互提示、暂停、CLI 进程外壳与更新提示        |
| `@eljs/utils/cp`        | 命令执行、可执行文件解析、PID 查询与 sudo     |
| `@eljs/utils/env`       | 全局安装检测与环境能力                        |
| `@eljs/utils/error`     | `UtilsError` 与稳定错误码                     |
| `@eljs/utils/file`      | 读写、复制、移动、删除与模板渲染              |
| `@eljs/utils/generator` | 模板生成器生命周期                            |
| `@eljs/utils/git`       | Git 元信息、状态和常用操作                    |
| `@eljs/utils/guards`    | 运行时类型守卫                                |
| `@eljs/utils/http`      | 有界缓冲下载与流式落盘、解压                  |
| `@eljs/utils/loader`    | JavaScript、TypeScript、JSON 与 YAML 文件加载 |
| `@eljs/utils/logger`    | CLI 日志与 debug 适配                         |
| `@eljs/utils/module`    | Node 模块查找与同步加载                       |
| `@eljs/utils/npm`       | npm 元数据、包管理器检测、安装和 tarball 下载 |
| `@eljs/utils/object`    | 对象合并                                      |
| `@eljs/utils/path`      | 跨平台路径和工作区解析                        |
| `@eljs/utils/promise`   | deferred、重试和计时器                        |
| `@eljs/utils/string`    | 常用字符串格式转换                            |
| `@eljs/utils/types`     | 公共 TypeScript 类型                          |

包只公开上述领域入口，不承诺 `file/loader` 等内部文件路径的兼容性。

## 使用边界

`@eljs/utils` 只承载可被多个 Node.js 工具复用的机制性能力，不承载具体产品流程或业务策略。

- 文件、进程、下载、Git、npm 和路径等通用原语可以放在本包
- 项目生成、发布编排、插件生命周期和配置策略应保留在对应领域包
- 不为统一导入路径而简单转导出第三方依赖
- 当某个领域拥有独立的消费者、安全边界或发布节奏时，应迁移为独立包

## 常用示例

### 文件与配置

```ts
import { copyDirectory, readJson, writeJsonAtomic } from '@eljs/utils/file'
import { loadYaml } from '@eljs/utils/loader'

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

`writeFile()` 和 `writeFileSync()` 的第三个参数支持编码字符串或 Node.js 写入选项对象，默认使用 UTF-8 编码。使用 `flag: 'wx'` 仅创建新文件；目标已存在时抛出保留 `EEXIST` 错误码的错误，原文件内容不变：

```ts
import { writeFileSync } from '@eljs/utils/file'

writeFileSync('./generated/config.ts', 'export default {}\n', {
  encoding: 'utf8',
  flag: 'wx',
})
```

`writeFileAtomic()` 和 `writeFileAtomicSync()` 同样支持编码字符串或选项对象，可指定 `encoding`、`mode` 和 `flush`。异步版本还支持 `signal`，在写入及开始重命名前检查取消；重命名开始后不能通过取消回滚。两者通过重命名替换目标文件，不接受 `flag`：`wx` 不能防止重命名覆盖目标，`a` 也不能实现对目标的追加。

```ts
import { writeFileAtomic } from '@eljs/utils/file'

await writeFileAtomic('./config.ts', 'export default {}\n', {
  encoding: 'utf8',
  mode: 0o600,
  flush: true,
})
```

`mode` 决定替换后目标文件的权限；`flush` 刷新临时文件，不包含对父目录元数据的刷新。

同步写入会在写文件前拒绝 `signal`。封装同步方法时使用 `WriteFileSyncOptions` 和 `CopyFileSyncOptions`；需要取消能力时使用异步方法。JSON 写入方法会在修改目标前拒绝 `toJSON()` 返回 `undefined` 的值。

`readFile()` 和 `readFileSync()` 也支持编码字符串或选项对象。默认及选项中省略编码时返回 UTF-8 字符串，显式传入 `null` 或 `{ encoding: null }` 时返回 Buffer；异步读取还支持 `signal`：

```ts
import { readFile, remove } from '@eljs/utils/file'

const bytes = await readFile('./image.png', { encoding: null })
const text = await readFile('./config.ts', {
  signal: AbortSignal.timeout(5000),
})
await remove('./generated', {
  filter: file => !file.endsWith('.keep'),
})
```

`remove()` 和 `removeSync()` 分别透传 rimraf 的异步、同步选项，支持过滤、重试和取消。同步过滤器必须返回 boolean，不能返回 Promise。

`copyTemplate()`、`copyTemplateSync()` 以及目录复制中的模板分支支持 `writeOptions`，用于控制渲染后文件的编码、写入标志和新文件权限。普通文件复制使用的 `mode` 则是 `COPYFILE_EXCL` 等复制标志位，不是文件权限：

```ts
import { copyTemplate } from '@eljs/utils/file'

await copyTemplate(
  './config.ts.tpl',
  './config.ts',
  {},
  {
    writeOptions: { flag: 'wx', mode: 0o600 },
  },
)
```

`loadTs()`、`loadTsSync()` 与 `resolveTsConfig()` 会按需加载 TypeScript。加载器通过短生命周期 CommonJS Hook 同步转译入口及相对 `.ts` 依赖，不写入生成文件，也不解析 `paths` 路径别名；普通文件工具不会主动加载 TypeScript 编译器。

生成器复制方法按字段浅合并渲染选项：实例字段作为默认值，单次调用字段优先；嵌套选项对象整体替换。自定义模板分隔符也作用于目标文件名。

`move()` 和 `moveSync()` 优先使用原生重命名，不提前删除目标，相同或互相包含的路径会被拒绝。非空目录保留覆盖能力：暂存旧目标，替换失败则恢复；恢复失败时，错误会报告保留的备份位置。这个兼容流程不具备原子性或崩溃恢复保证。跨设备移动直接传播 `EXDEV`，不删除旧目标。禁止覆盖的检查包含悬空符号链接，不过它不提供针对并发写入的原子预留。

路径校验仅解析父目录中的符号链接；末级符号链接作为目录项移动或替换，不跟随其指向的目标。

同步和异步 JavaScript 加载均相对于 cwd 解析路径。TypeScript 加载会在执行前拒绝语法错误，不进行完整类型检查。为特殊抛出值补充上下文时，会通过 `cause` 保留原始原因。

### 路径、类型守卫与重试

`getWorkspaceRoot()` 按距离选择最近的工作区标记，不因包管理器不同而跳过更近的项目。`getWorkspacePackageRoots()` 接收配置所在目录，保留递归 glob 和排除语义，只返回包含 `package.json` 的目录，并排除 `node_modules`。未配置工作区模式时仍按单包项目返回传入目录。`getCallerDirectory()` 对 ESM 和 CommonJS 调用方均返回文件系统路径。

`isPromise()` 检测 thenable，类型收窄为 `PromiseLike<T>`；需要 `catch()` 或 `finally()` 时，先使用 `Promise.resolve(value)` 转换。`isAsyncFunction()` 不包含异步生成器；`isString()` 和 `isBoolean()` 只接受原始值，不接受包装对象。

`retry()` 和 `retryWithValue()` 保留最大尝试次数的原有含义：第二个参数为 `3` 时，包含首次执行在内最多调用三次。次数必须为正安全整数；延时必须为 0 至 2147483647 毫秒之间的有限数值，并且仅在两次尝试之间等待。`retryWithValue()` 仅重试空值，异常会立即传播。`timeout()` 在任务结束时清理计时器，超时不会取消原任务。

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

`run()` 和 `runCommandLine()` 根据选项推导结果类型：默认 `stdout` 是字符串，`encoding: 'buffer'` 时为 Uint8Array，`lines: true` 时为字符串数组，忽略标准输出时为 `undefined`。Git 和 npm 文本查询的解析入口要求字符串输出。

命令和参数应分开传递。`runCommandLine()` 只处理空白分隔与反斜杠转义，不是完整的 shell 解析器；不支持 shell 管道、重定向或变量展开。

### 交互与下载

`select()` 根据有明确类型的选项推导返回值；宽泛的选项类型返回 `unknown`。`confirm()` 传入自定义取消回调时，返回值可能为 `undefined`，保留原有回调行为。`loopPrompt()` 仅在摘要中遮蔽密码和不可见输入，不修改返回值。`pause()` 在收到输入行前关闭输入时会拒绝。

缓冲式 `download()` 在读取过程中执行字节数限制，并保留 `download(url, undefined, options)` 的第三个参数。两种下载方法都通过临时文件重命名发布普通文件，并保留已有普通文件的读、写、执行权限；归档直接解压到目标目录，失败时可能保留已解压条目。`downloadNpmTarball()` 始终解压且固定 `strip: 1`；专用的 `DownloadNpmTarballOptions` 不再公开这些固定参数，同时兼容已有 `DownloadOptions` 变量。

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
- 日志 API 保持轻量，不在工具包中内置监控后端或传输层
- 新能力通过领域入口公开，避免新增内部文件级导出

## License

[MIT](../../LICENSE)
