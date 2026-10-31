# 参与 Eljs 贡献

[English](./CONTRIBUTING.md) | [简体中文](./CONTRIBUTING.zh-CN.md)

## 环境要求

- 推荐使用 Node.js 24 LTS；开发环境要求 Node.js 22.18 或更高版本。
- 通过 Corepack 管理 pnpm 11.20.0。

仓库提供 `.nvmrc` 和 `.node-version`，供版本管理工具使用。

## 本地设置

```bash
corepack enable
corepack prepare pnpm@11.20.0 --activate
pnpm install
pnpm build
```

如果依赖安装意外使用了私有 registry，请在修改前先检查实际生效的配置：

```bash
pnpm config get registry
```

## Workspace 命令

| 命令                 | 用途                                             |
| -------------------- | ------------------------------------------------ |
| `pnpm dev`           | 以 watch 模式构建所有包                          |
| `pnpm build`         | 构建所有可发布包                                 |
| `pnpm test`          | 运行完整测试套件                                 |
| `pnpm typecheck`     | 对所有 TypeScript 包进行类型检查                 |
| `pnpm lint`          | 运行 ESLint，包含 TSDoc 语法检查                 |
| `pnpm package:check` | 验证安装后的 tarball、导出、类型、CLI 和文件内容 |

迭代单个包时可以使用 pnpm filter：

```bash
pnpm --filter @eljs/generator typecheck
pnpm exec vitest run packages/generator/__tests__/core/create.spec.ts
pnpm --filter @eljs/generator... build
```

## 创建包

新包需要提供具体、面向使用者的描述：

```bash
pnpm package:create packages/<package-name> \
  --description "One concrete role and its distinguishing contract"
```

不传路径运行 `pnpm package:create` 时，只会补齐既有 workspace 包中缺失的脚手架文件，
不会替换描述或其他包专属元数据。
新脚手架包含双语 README 及其发布文件配置。
包目录名必须以小写字母开头。如果既有包只有一种语言的 README，
请先同步翻译，再运行脚手架。

显式指定 `--description` 会更新既有公开包的描述，不会重建其其他元数据。
使用 `--force` 时会刷新脚手架元数据，显式描述仍优先于旧值。

## 仓库布局

主要的包依赖关系如下：

```text
utils ─> config-loader ─> plugin-host ─┬─> generator ─> create
                                     └─> release

cache
conventional-changelog-preset ─> release
```

`cache` 是独立的基础能力包。`conventional-changelog-preset` 是由发布工具使用的
独立 TypeScript 包。所有包都分别发布 CommonJS 和原生 ESM 运行时入口，
通过 package exports 选择，并提供 TypeScript 类型声明。

仓库工具链要求 Node.js 22.18 或更高版本，发布后的包支持 Node.js 22.14。
CI 使用 Node.js 24 构建，并通过 `ELJS_SMOKE_NODE` 在 Node.js 22.14 上运行 tarball
消费者检查。该变量只选择消费者使用的可执行文件，安装和声明检查仍使用工具链的 Node.js。

## 命名约定

- 展示品牌使用 `Eljs`，仓库名称使用 `eljs`，发布包标识使用 `@eljs/*`。
- 包名应表达使用者能够识别的单一具体职责，例如 `plugin-host` 或 `config-loader`；
  避免实现细节和宽泛的同义词，例如 `core`、`common` 或另一个通用 `utils` 包。
- 包描述应说明服务对象、主要能力和区别于其他包的契约。
  避免使用缺乏依据的宣传词，例如“强大”“智能”或“全面”。
- 包名和导出的 API 应表达当前职责。名称变更和不兼容的 API 变更应随破坏性版本发布。
- 只有可复用机制才应作为跨领域辅助能力加入 `@eljs/utils`，产品工作流或策略不应放入其中。
  当某个领域拥有独立使用者、安全边界或发布节奏时，应将其拆分。

## 文档语言

仓库根目录及所有公开包使用英文 `README.md` 和简体中文 `README.zh-CN.md`。
在标题后立即添加另一种语言的链接。保持章节、API 契约、示例和运行时约束一致；
翻译代码注释时，不改变可执行语句或示例数据。各包的发布文件应包含 `README.zh-CN.md`。

仓库贡献指南 `CONTRIBUTING.md` 和 `CONTRIBUTING.zh-CN.md` 也应保持一致，
并在标题后添加语言链接。贡献规则或开发流程发生变化时，应同步更新两种语言。

修改 README 时应同步更新两种语言。使用 `pnpm docs:check` 检查 README 和贡献指南的
语言链接、标题层级、表格行数、可执行示例和本地链接目标。该结构检查不会验证翻译正文，
也不能代替对照实现的审查。使用 `pnpm package:check` 验证两种语言的入口文件
都包含在发布的 tarball 中。

## 验证

提交 Pull Request 前，运行与 CI 相同的检查：

```bash
pnpm verify
```

该命令运行格式检查、lint、类型检查、覆盖率检查、构建，以及针对实际 npm 发布文件的隔离验证。

单独运行 `pnpm verify:templates`，可检查已发布官方模板的内容及真实项目生成流程。
该检查要求网络连接和已发布的模板包。手动触发的 **Official Templates**
GitHub Actions 工作流运行同一检查。模板可用性独立于仓库验证和包发布，
该检查不是发布的前置条件。

## 调试 CLI 包

CLI 诊断使用 `debug` 命名空间：

```bash
DEBUG=generator:* pnpm exec generator <template> <project-name>
DEBUG=create:* pnpm exec create <project-name>
DEBUG=release:* pnpm exec release
```

Issue 报告或调试日志中不得包含 token、registry 凭据或私有模板 URL。

## 变更与提交

- 保持包的边界，避免直接导入其他包的源文件。
- 行为变更应补充回归测试。
- 新增或修改公开 API 时，使用标准 TSDoc 为导出声明和公开扩展点添加文档。
  描述契约和不明显的约束，不要重复标识符的含义；TypeScript 类型应写在签名中，
  不应写在注释中。TSDoc 摘要或标签描述末尾不得使用中文或英文句号。
- 运行 `pnpm lint` 检查无效的 TSDoc 语法。仓库 `AGENTS.md` 定义了 AI 辅助修改的
  文档规范，包专属文件可以补充这些规范。
- 使用 Conventional Commits，建议以包名作为 scope，例如 `fix(create): validate target path`。
- 不要编辑生成的 `dist/` 产物，应从源码重新构建。

## 版本与发布

workspace 使用统一版本：所有公开包具有相同版本，并一起发布。
即使只有一个包发生变化，移除公开 API 或不兼容的契约变更也需要进入新的主版本系列。

使用仓库根目录的发布命令，不要在各包目录中单独发布：

```bash
pnpm release
pnpm release:alpha
pnpm release:beta
pnpm release -- patch
```

发布流程会验证 workspace，同步更新包版本和锁文件，生成 changelog，
并按运行时依赖顺序发布各包。
