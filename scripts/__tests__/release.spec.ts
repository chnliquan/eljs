import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import { main } from '../release'

const repoRoot = path.resolve(fileURLToPath(new URL('../..', import.meta.url)))

const mocks = vi.hoisted(() => ({
  argv: { _: [] } as Record<string, unknown> & { _: string[] },
  events: [] as string[],
  command: vi.fn<(parts: TemplateStringsArray) => Promise<void>>(),
  commandOptions: vi.fn(),
  release:
    vi.fn<
      (version?: string, options?: Record<string, unknown>) => Promise<void>
    >(),
  isGitClean: vi.fn<() => Promise<boolean>>(),
  isGitBehindRemote: vi.fn<() => Promise<boolean>>(),
  logger: { step: vi.fn(), info: vi.fn(), error: vi.fn() },
}))

// 发布与命令执行均在模块边界替换，任何测试都不会进入真实发布流程
vi.mock('@eljs/release', () => ({ release: mocks.release }))
vi.mock('@eljs/utils/git', () => ({
  isGitClean: mocks.isGitClean,
  isGitBehindRemote: mocks.isGitBehindRemote,
}))
vi.mock('@eljs/utils/logger', () => ({ logger: mocks.logger }))
vi.mock('zx', () => ({ $: mocks.commandOptions, argv: mocks.argv }))

beforeEach(() => {
  vi.resetAllMocks()
  for (const key of Object.keys(mocks.argv)) delete mocks.argv[key]
  mocks.argv._ = []
  mocks.events.length = 0
  mocks.commandOptions.mockReturnValue(mocks.command)
  mocks.command.mockImplementation(async parts => {
    mocks.events.push(parts.join(''))
  })
  mocks.isGitClean.mockImplementation(async () => {
    mocks.events.push('git:clean')
    return true
  })
  mocks.isGitBehindRemote.mockImplementation(async () => {
    mocks.events.push('git:behind')
    return false
  })
  mocks.release.mockImplementation(async () => {
    mocks.events.push('release')
  })
})

describe('根发布脚本', () => {
  it('导入入口不会执行命令、Git 检查或发布', async () => {
    vi.resetModules()
    await import('../release')
    expect(mocks.events).toEqual([])
    expect(mocks.command).not.toHaveBeenCalled()
    expect(mocks.commandOptions).not.toHaveBeenCalled()
    expect(mocks.release).not.toHaveBeenCalled()
    expect(mocks.isGitClean).not.toHaveBeenCalled()
    expect(mocks.isGitBehindRemote).not.toHaveBeenCalled()
  })

  it('全部验证完成后检查 Git，再进入发布生命周期', async () => {
    await main()
    expect(mocks.events).toEqual([
      'pnpm run verify:static',
      'pnpm run verify:test --bail=1',
      'pnpm run clean',
      'pnpm run verify:package',
      'git:clean',
      'git:behind',
      'release',
    ])
    expect(mocks.release).toHaveBeenCalledWith(undefined, {
      _: [],
      cwd: repoRoot,
      git: { requireClean: false },
      npm: { requireOwner: false },
    })
  })

  it('从其他目录调用时，验证、Git 和发布仍固定本仓库', async () => {
    vi.spyOn(process, 'cwd').mockReturnValue(path.join(repoRoot, 'packages'))
    try {
      await main()
      expect(mocks.commandOptions).toHaveBeenCalledWith({
        cwd: repoRoot,
        verbose: true,
      })
      expect(mocks.isGitClean).toHaveBeenCalledWith({ cwd: repoRoot })
      expect(mocks.isGitBehindRemote).toHaveBeenCalledWith({ cwd: repoRoot })
      expect(mocks.release).toHaveBeenCalledWith(
        undefined,
        expect.objectContaining({ cwd: repoRoot }),
      )
    } finally {
      vi.restoreAllMocks()
    }
  })

  it.each([repoRoot, `${repoRoot}/scripts/..`, '.'])(
    '允许指向仓库根目录的等价 cwd：%s',
    async cwd => {
      mocks.argv.cwd = cwd
      await main()
      expect(mocks.release).toHaveBeenCalledWith(
        undefined,
        expect.objectContaining({ cwd: repoRoot }),
      )
    },
  )

  it.each([
    path.join(repoRoot, 'packages'),
    path.resolve(repoRoot, '..'),
    '',
    true,
    null,
    [repoRoot, repoRoot],
  ])('拒绝其他目录或无效 cwd：%j，且不执行验证或发布', async cwd => {
    mocks.argv.cwd = cwd
    await expect(main()).rejects.toThrow(
      'Root release script only supports this repository as cwd.',
    )
    expect(mocks.events).toEqual([])
    expect(mocks.commandOptions).not.toHaveBeenCalled()
    expect(mocks.isGitClean).not.toHaveBeenCalled()
    expect(mocks.isGitBehindRemote).not.toHaveBeenCalled()
    expect(mocks.release).not.toHaveBeenCalled()
  })

  it.each(['skipTests', 'skipBuild', 'skipRequireClean'])(
    '显式 false 不跳过 %s',
    async flag => {
      mocks.argv[flag] = false
      await main()
      expect(mocks.events).toEqual([
        'pnpm run verify:static',
        'pnpm run verify:test --bail=1',
        'pnpm run clean',
        'pnpm run verify:package',
        'git:clean',
        'git:behind',
        'release',
      ])
    },
  )

  it('跳过构建时仍验证现有发布包', async () => {
    mocks.argv.skipBuild = true
    await main()
    expect(mocks.events).toEqual([
      'pnpm run verify:static',
      'pnpm run verify:test --bail=1',
      'pnpm run package:check',
      'git:clean',
      'git:behind',
      'release',
    ])
  })

  it('跳过测试和 Git 检查时仍运行静态验证及完整构建验证', async () => {
    mocks.argv.skipTests = true
    mocks.argv.skipRequireClean = true
    await main()
    expect(mocks.events).toEqual([
      'pnpm run verify:static',
      'pnpm run clean',
      'pnpm run verify:package',
      'release',
    ])
    expect(mocks.isGitClean).not.toHaveBeenCalled()
    expect(mocks.isGitBehindRemote).not.toHaveBeenCalled()
  })

  it('省略 dry-run 和 dryRun 时不覆盖发布配置中的 dryRun', async () => {
    await main()
    expect(mocks.release.mock.calls[0]?.[1]).not.toHaveProperty('dryRun')
  })

  it.each([
    { flag: 'dry-run', value: true },
    { flag: 'dry-run', value: false },
    { flag: 'dryRun', value: true },
    { flag: 'dryRun', value: false },
  ])('显式 $flag=$value 映射到 dryRun', async ({ flag, value }) => {
    mocks.argv[flag] = value
    await main()
    expect(mocks.release).toHaveBeenCalledWith(
      undefined,
      expect.objectContaining({ dryRun: value }),
    )
  })

  it('dry-run 的显式 false 优先于 dryRun 的 true，并保留其他配置', async () => {
    Object.assign(mocks.argv, {
      _: ['patch'],
      'dry-run': false,
      dryRun: true,
      git: { requireClean: true, push: false },
      npm: { requireOwner: true, prereleaseId: 'beta' },
    })
    await main()
    expect(mocks.release).toHaveBeenCalledWith(
      'patch',
      expect.objectContaining({
        dryRun: false,
        git: { requireClean: false, push: false },
        npm: { requireOwner: false, prereleaseId: 'beta' },
      }),
    )
  })

  describe.each([
    'dry-run',
    'dryRun',
    'skipTests',
    'skipBuild',
    'skipRequireClean',
  ])('严格布尔旗标 %s', flag => {
    it.each(['FALSE', '', 1, null, ['true', 'false']])(
      '拒绝非布尔值 %j 且不开始验证或发布',
      async value => {
        mocks.argv[flag] = value
        await expect(main()).rejects.toThrow(
          `--${flag} must be a boolean flag.`,
        )
        expect(mocks.events).toEqual([])
        expect(mocks.release).not.toHaveBeenCalled()
      },
    )
  })

  it.each([
    { flag: 'dry-run', option: '--dry-run=false', value: false },
    { flag: 'dryRun', option: '--dryRun=true', value: true },
    { flag: 'skipTests', option: '--skipTests=false', value: false },
    { flag: 'skipBuild', option: '--skipBuild=true', value: true },
    {
      flag: 'skipRequireClean',
      option: '--no-skipRequireClean',
      value: false,
    },
    { flag: 'dry-run', option: '--dry-run', value: true },
  ])(
    '真实 zx 参数 $option 保留显式布尔语义',
    async ({ flag, option, value }) => {
      const { parseArgv } = await vi.importActual<typeof import('zx')>('zx')
      const parsed = parseArgv(['patch', option, '--npm.prereleaseId=false'])
      Object.assign(mocks.argv, parsed)
      await main()
      const options = mocks.release.mock.calls[0]?.[1]
      expect(options).toMatchObject({
        [flag]: value,
        npm: { prereleaseId: 'false' },
      })
      if (flag === 'dry-run' || flag === 'dryRun') {
        expect(options?.dryRun).toBe(value)
      } else {
        expect(options).not.toHaveProperty('dryRun')
      }
      // 规范化局限于发布选项副本，不改写共享 argv 或其他参数
      expect(mocks.argv).toEqual(parsed)
      if (flag === 'skipTests' && !value) {
        expect(mocks.events).toContain('pnpm run verify:test --bail=1')
      }
    },
  )

  it.each([
    { clean: false, behind: false, error: 'not clean' },
    { clean: true, behind: true, error: 'behind remote' },
  ])('验证后的 Git 状态失败阻止发布：$error', async state => {
    mocks.isGitClean.mockImplementation(async () => {
      mocks.events.push('git:clean')
      return state.clean
    })
    mocks.isGitBehindRemote.mockResolvedValue(state.behind)
    await expect(main()).rejects.toThrow(state.error)
    expect(mocks.events).toEqual([
      'pnpm run verify:static',
      'pnpm run verify:test --bail=1',
      'pnpm run clean',
      'pnpm run verify:package',
      'git:clean',
    ])
    expect(mocks.isGitBehindRemote).toHaveBeenCalledTimes(state.clean ? 1 : 0)
    expect(mocks.release).not.toHaveBeenCalled()
  })

  it.each(['pnpm run verify:package', 'pnpm run package:check'])(
    '%s 产生工作区变更时阻止发布',
    async changedBy => {
      mocks.argv.skipBuild = changedBy === 'pnpm run package:check'
      let clean = true
      mocks.command.mockImplementation(async parts => {
        const command = parts.join('')
        mocks.events.push(command)
        if (command === changedBy) clean = false
      })
      mocks.isGitClean.mockImplementation(async () => {
        mocks.events.push('git:clean')
        return clean
      })
      await expect(main()).rejects.toThrow('not clean')
      expect(mocks.events.at(-1)).toBe('git:clean')
      expect(mocks.release).not.toHaveBeenCalled()
    },
  )

  it.each([
    'pnpm run verify:static',
    'pnpm run verify:test --bail=1',
    'pnpm run clean',
    'pnpm run verify:package',
    'pnpm run package:check',
  ])('命令失败阻止发布：%s', async failed => {
    mocks.argv.skipBuild = failed === 'pnpm run package:check'
    mocks.command.mockImplementation(async parts => {
      const command = parts.join('')
      mocks.events.push(command)
      if (command === failed) throw new Error('Verification failed')
    })
    await expect(main()).rejects.toThrow('Verification failed')
    expect(mocks.events.at(-1)).toBe(failed)
    expect(mocks.release).not.toHaveBeenCalled()
    expect(mocks.isGitClean).not.toHaveBeenCalled()
    expect(mocks.isGitBehindRemote).not.toHaveBeenCalled()
  })

  it('传播发布器错误', async () => {
    mocks.release.mockRejectedValue(new Error('Mock release failed'))
    await expect(main()).rejects.toThrow('Mock release failed')
  })
})
