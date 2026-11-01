import { release } from '@eljs/release'
import { isGitBehindRemote, isGitClean } from '@eljs/utils/git'
import { logger } from '@eljs/utils/logger'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { $, argv } from 'zx'

// 导入只加载可测试入口，直接执行时才触发发布生命周期
if (
  process.argv[1] &&
  path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)
) {
  main().catch(error => {
    const message = error instanceof Error ? error.message : String(error)
    logger.error(`Release failed: ${message}`)
    process.exitCode = 1
  })
}

/**
 * 校验工作区并将发布生命周期委托给 `@eljs/release`
 *
 * @remarks
 * 本脚本固定发布所在仓库，cwd 只允许指向同一仓库根目录
 * 验证命令、Git 检查及发布器均使用该目录，不依赖调用进程所在目录
 * 全部验证完成后检查 Git 状态，跳过构建时仍验证发布包
 * dry-run、dryRun 和 skip 旗标接受布尔值及 CLI 的 true/false 字符串
 * 未提供 dry-run 时沿用发布配置，不补入默认 false
 * 显式 dry-run 优先于 dryRun，发布器不重复检查 Git 清洁状态或包所有者
 * @throws 当 cwd 指向其他目录、旗标无效、验证失败、Git 状态不符合要求或发布失败时抛出
 * @internal
 */
export async function main(): Promise<void> {
  const options = { ...argv }
  const cwd = path.resolve(fileURLToPath(new URL('..', import.meta.url)))
  if (
    options.cwd !== undefined &&
    (typeof options.cwd !== 'string' ||
      !options.cwd ||
      path.resolve(options.cwd) !== cwd)
  ) {
    throw new Error('Root release script only supports this repository as cwd.')
  }
  for (const name of [
    'dry-run',
    'dryRun',
    'skipTests',
    'skipBuild',
    'skipRequireClean',
  ]) {
    const raw = options[name]
    // zx 保留等号形式的字符串，精确转换已知旗标且不改变未提供选项的语义
    const value = raw === 'true' ? true : raw === 'false' ? false : raw
    if (value !== undefined && typeof value !== 'boolean') {
      throw new Error(`--${name} must be a boolean flag.`)
    }
    if (value !== undefined) options[name] = value
  }
  const { skipTests, skipBuild, skipRequireClean } = options
  const dryRun = options['dry-run'] ?? options.dryRun
  // 单独设置命令目录，不通过修改进程 cwd 影响其他模块或发布检查
  const verify = $({ cwd, verbose: true })

  logger.step('Release', 'Running static verification ...')
  await verify`pnpm run verify:static`

  if (!skipTests) {
    logger.step('Release', 'Running tests with coverage ...')
    await verify`pnpm run verify:test --bail=1`
  } else {
    logger.info('Tests skipped.')
  }

  if (!skipBuild) {
    logger.step('Release', 'Building and verifying packages ...')
    await verify`pnpm run clean`
    await verify`pnpm run verify:package`
  } else {
    logger.info('Package build skipped.')
    // 跳过重建仍需验证现有 tarball 的运行时、类型和发布文件
    await verify`pnpm run package:check`
  }

  // 构建和打包脚本也可能改写受跟踪文件，全部验证完成后才允许进入发布生命周期
  if (!skipRequireClean) {
    if (!(await isGitClean({ cwd }))) {
      throw new Error('Git working tree is not clean.')
    }
    if (await isGitBehindRemote({ cwd })) {
      throw new Error('Git working tree is behind remote.')
    }
  }

  // https://github.com/chnliquan/eljs/tree/master/packages/release#configuration
  await release(options._[0], {
    ...options,
    cwd,
    ...(dryRun === undefined ? {} : { dryRun }),
    git: {
      ...options.git,
      requireClean: false,
    },
    npm: {
      ...options.npm,
      requireOwner: false,
    },
  })
}
