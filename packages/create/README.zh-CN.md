# @eljs/create

[English](./README.md)

使用最新版官方 Eljs 模板创建项目。

[![NPM Version](https://img.shields.io/npm/v/@eljs/create.svg)](https://www.npmjs.com/package/@eljs/create)
[![License](https://img.shields.io/npm/l/@eljs/create.svg)](https://github.com/chnliquan/eljs/blob/master/LICENSE)

这是官方项目初始化入口：先选择模板，再委托
[`@eljs/generator`](../generator/README.zh-CN.md) 完成生成。
如果要使用任意本地、npm 或 Git 模板，请直接调用生成器。

## 运行要求

- Node.js 22.14 或更高版本
- 提供 ESM、CommonJS 入口和 TypeScript 声明
- 下载官方模板时需要访问 npm registry

## 快速开始

```bash
# 交互选择官方模板
npm create @eljs my-project

# 显式选择 npm 包模板
npm create @eljs my-package -- --template template-npm-package

# 通过 npx 执行等价命令
npx @eljs/create my-project
```

## 安装

经常使用 CLI 时：

```bash
pnpm add --global @eljs/create
create my-project
```

通过编程 API 使用时：

```bash
pnpm add @eljs/create
```

## 可用模板

| 模板                   | 生成内容                                       | npm 来源                                 |
| ---------------------- | ---------------------------------------------- | ---------------------------------------- |
| `template-npm-package` | 单个可发布包，可选择 Node 或浏览器目标         | `@eljs/create-plugin-npm-package@latest` |
| `template-project`     | 包含 Web 应用、文档、库和 CLI 的全栈 workspace | `@eljs/create-plugin-project@latest`     |

两个模板都使用共享的 `@eljs/create-preset-base-package` 预设。
它是模板依赖，不作为可选择的项目模板。

模板与初始化器独立发布。每次运行都解析所选包的 `latest` 版本；
模板更新不需要重新发布初始化器。

## CLI

```bash
create [options] <project-name>
```

| 选项                        | 说明                               | 默认值          |
| --------------------------- | ---------------------------------- | --------------- |
| `-t, --template <template>` | 上表中的官方模板标识之一           | 交互选择        |
| `--cwd <cwd>`               | 工作目录                           | `process.cwd()` |
| `-f, --force`               | 替换已存在的目标目录               | `false`         |
| `-m, --merge`               | 将生成文件合并到已存在的目标目录   | `false`         |
| `--allow-template-scripts`  | 允许下载模板的依赖执行生命周期脚本 | `false`         |
| `-v, --version`             | 输出初始化器版本                   | —               |
| `-h, --help`                | 输出命令帮助                       | —               |

`force` 和 `merge` 互斥。生成过程使用生成器的目录事务：
失败时恢复原目录，遵循协议的进程不能同时写入同一个物理目标。
详见[事务恢复](https://github.com/chnliquan/eljs/blob/master/docs/generator-recovery.md)。

```bash
create my-package --template template-npm-package
create my-project --template template-project --cwd ./projects
create existing-project --merge
```

## 编程 API

```ts
import { ProjectCreator } from '@eljs/create'

const creator = new ProjectCreator({
  template: 'template-npm-package',
  cwd: '/workspace/projects',
})

await creator.run('orders-service')
```

`ProjectCreatorOptions` 接受可选的 `OfficialTemplateName`，
以及生成器的创建选项，但不接受生成器中任意来源形式的 `template`。
省略模板时会启动交互选择。无效模板标识会产生 `CREATE_INVALID_OPTIONS`。

`force`、`merge`、`install`、`gitInit`、`defaultQuestions` 和 `signal`
等选项会透传给生成器。取消信号会中断模板选择，并继续传递给生成流程：

```ts
const controller = new AbortController()
const creator = new ProjectCreator({
  template: 'template-npm-package',
  signal: controller.signal,
})

process.once('SIGINT', () => controller.abort())
await creator.run('my-package')
```

`constructorOptions` 是只读快照。`cwd` 保存配置的工作目录，默认为 `process.cwd()`。

## 模板执行

官方模板来源使用 HTTPS npm registry 地址，并由初始化器信任，
因此跳过远程代码执行确认。模板代码仍以当前进程权限运行。

初始化器跟随 `latest`，不会独立固定 integrity 摘要。下载时使用 registry 提供的
integrity 或 shasum。除非启用 `--allow-template-scripts`，
否则禁用模板依赖的生命周期脚本。详见生成器的
[模板信任设置](https://github.com/chnliquan/eljs/tree/master/packages/generator#template-execution-and-integrity)。

## 开发

在仓库根目录运行：

```bash
pnpm --filter @eljs/create... build
pnpm --filter @eljs/create typecheck
pnpm --filter @eljs/create test
pnpm --filter @eljs/create test:watch
DEBUG=create:* pnpm exec create my-project
```

在可访问 npm registry 的环境中验证已发布模板：

```bash
ELJS_TEST_OFFICIAL_TEMPLATES=1 pnpm exec vitest run packages/create/__tests__/official-templates.integration.spec.ts
```
