# CreateTemplate 测试说明

测试按公开契约和信任边界组织，避免依赖私有方法或重复断言实现细节

## 测试分层

| 文件             | 主要职责                                            |
| ---------------- | --------------------------------------------------- |
| `cli.spec.ts`    | 真实 Commander 参数解析、退出码、信号与更新提示降级 |
| `config.spec.ts` | 内置模板版本、HTTPS registry、冻结和场景一致性      |
| `create.spec.ts` | 模板选择、参数透传、取消与错误语义                  |
| `index.spec.ts`  | 公共入口和值/类型组合能力                           |
| `utils.spec.ts`  | 交互取消领域错误                                    |

CLI 测试使用真实 Commander，只 Mock 文件读取、更新提示和项目创建器等边界依赖；
项目创建器通过边界 Mock 隔离真实文件系统和远程模板下载

## 本地运行

```bash
pnpm --filter @eljs/create-template test
pnpm --filter @eljs/create-template test:watch
pnpm --filter @eljs/create-template typecheck
```

仓库覆盖率配置为创建编排设置了独立门槛，CLI 发布产物还会由
`pnpm pack:check` 验证 ESM、CommonJS、类型声明和 `--help` 行为
