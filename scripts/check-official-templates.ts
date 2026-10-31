import { spawnSync } from 'node:child_process'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const root = fileURLToPath(new URL('..', import.meta.url))

// 独立命令与手动工作流显式启用联网合同，默认跳过的集成测试不能代表模板已可用
const result = spawnSync(
  process.execPath,
  [
    path.join(root, 'node_modules/vitest/vitest.mjs'),
    'run',
    'packages/create/__tests__/official-templates.integration.spec.ts',
    '--coverage.enabled=false',
  ],
  {
    cwd: root,
    env: { ...process.env, ELJS_TEST_OFFICIAL_TEMPLATES: '1' },
    stdio: 'inherit',
  },
)

if (result.error) console.error(result.error)
process.exitCode = result.status ?? 1
