# Eljs — 可组合的 Node.js 工具链

[English](./README.md)

一套用于构建可扩展 Node.js CLI、项目生成器和发布流程的 TypeScript 工具集。

每个 `@eljs/*` 包负责工具链中的一项能力，也可以独立使用。

## 如何选择包

- 使用 `@eljs/create` 从官方模板创建项目
- 使用 `@eljs/generator` 开发生成器，或运行自定义的本地、npm 和 Git 模板
- 使用 `@eljs/plugin-host` 构建插件驱动的 CLI 或工作流
- 使用 `@eljs/release` 管理 npm 包或 workspace 的版本与发布
- 独立使用配置加载、缓存和 Node.js 通用工具能力

## 包架构

| 层次     | 包                                                                                                | 职责                                                   |
| -------- | ------------------------------------------------------------------------------------------------- | ------------------------------------------------------ |
| 基础能力 | [`@eljs/utils`](./packages/utils/README.zh-CN.md)                                                 | 文件、进程、下载、Git、npm、路径、日志和共享类型       |
| 基础能力 | [`@eljs/cache`](./packages/cache/README.zh-CN.md)                                                 | 内存缓存、磁盘持久化、TTL 校验和文件失效检测           |
| 基础能力 | [`@eljs/config-loader`](./packages/config-loader/README.zh-CN.md)                                 | 配置发现、加载、合并和运行时校验                       |
| 扩展机制 | [`@eljs/plugin-host`](./packages/plugin-host/README.zh-CN.md)                                     | 类型化插件生命周期、预设、有序 Hook 和上下文扩展       |
| 工作流   | [`@eljs/generator`](./packages/generator/README.zh-CN.md)                                         | 从本地、npm 和 Git 模板生成项目，支持扩展              |
| 工作流   | [`@eljs/release`](./packages/release/README.zh-CN.md)                                             | 可编程 npm 发布流程和有序 workspace 发布               |
| 使用入口 | [`@eljs/create`](./packages/create/README.zh-CN.md)                                               | 从最新版官方 Eljs 模板初始化项目                       |
| 生态集成 | [`@eljs/conventional-changelog-preset`](./packages/conventional-changelog-preset/README.zh-CN.md) | `@eljs/release` 默认使用的 Conventional Changelog 预设 |

## 快速开始

```bash
# 从精选官方模板创建项目
npm create @eljs my-project

# 从自定义本地模板生成项目
npx @eljs/generator ./my-template my-project

# 执行可编程 npm 发布流程
npx @eljs/release
```

全局安装后提供 `create`、`generator` 和 `release` 命令。

## 环境要求

- 已发布的包要求 Node.js 22.14 或更高版本
- 仓库开发要求 Node.js 22.18 或更高版本，推荐使用 Node.js 24 LTS
- 仓库开发通过 Corepack 固定使用 pnpm 11.20.0

## 文档

根目录和各包都提供英文 `README.md` 与简体中文 `README.zh-CN.md`，
包含对应一致的安装说明、API 示例、运行约束和包专属开发命令。

workspace 设置、新包创建、版本管理、发布流程和完整验证清单见
[贡献指南](./CONTRIBUTING.zh-CN.md)。

## 参与贡献

欢迎提交 Issue 和 Pull Request。请保持包的职责边界，为行为变更补充测试，
并在提交 Pull Request 前运行 `pnpm verify`。

## 许可证

[MIT](./LICENSE)
