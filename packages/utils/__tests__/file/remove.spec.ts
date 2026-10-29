import {
  afterEach,
  beforeEach,
  describe,
  expect,
  expectTypeOf,
  it,
} from 'vitest'

import { existsSync } from 'node:fs'
import * as fsp from 'node:fs/promises'
import * as os from 'node:os'
import * as path from 'node:path'

import type { RimrafAsyncOptions, RimrafSyncOptions } from 'rimraf'

import { remove, removeSync } from '../../src/file/remove'

describe('文件删除工具', () => {
  let tempDir: string

  beforeEach(async () => {
    tempDir = await fsp.mkdtemp(path.join(os.tmpdir(), 'remove-test-'))
  })

  afterEach(async () => {
    await fsp.rm(tempDir, { recursive: true, force: true })
  })

  async function createTree() {
    const root = path.join(tempDir, 'tree')
    await fsp.mkdir(path.join(root, 'nested'), { recursive: true })
    await fsp.writeFile(path.join(root, 'nested', 'delete.txt'), 'delete')
    await fsp.writeFile(path.join(root, 'keep.txt'), 'keep')
    return root
  }

  it('默认递归删除并在路径不存在时仍返回 true', async () => {
    const root = await createTree()
    const result = remove(root)
    expectTypeOf(result).toEqualTypeOf<Promise<boolean>>()
    expect(await result).toBe(true)
    expect(existsSync(root)).toBe(false)
    expect(await remove(root)).toBe(true)

    const syncRoot = await createTree()
    const syncResult = removeSync(syncRoot)
    expectTypeOf(syncResult).toEqualTypeOf<boolean>()
    expect(syncResult).toBe(true)
    expect(existsSync(syncRoot)).toBe(false)
    expect(removeSync(syncRoot)).toBe(true)
  })

  it('异步过滤器保留指定文件并返回 false', async () => {
    const root = await createTree()
    const visited = new Set<string>()
    const options = Object.freeze<RimrafAsyncOptions>({
      filter: async (file, entry) => {
        visited.add(file)
        await Promise.resolve()
        return entry.isDirectory() || path.basename(file) !== 'keep.txt'
      },
    })

    expect(await remove(root, options)).toBe(false)
    expect(await fsp.readFile(path.join(root, 'keep.txt'), 'utf8')).toBe('keep')
    expect(existsSync(path.join(root, 'nested'))).toBe(false)
    expect(visited.has(path.join(root, 'keep.txt'))).toBe(true)
    expect(visited.has(path.join(root, 'nested', 'delete.txt'))).toBe(true)
    expect(await remove(root, { filter: () => true })).toBe(true)
    expect(existsSync(root)).toBe(false)
  })

  it('同步过滤器保留指定文件并返回 false', async () => {
    const root = await createTree()
    const options = Object.freeze<RimrafSyncOptions>({
      filter: (file, entry) =>
        entry.isDirectory() || path.basename(file) !== 'keep.txt',
    })

    expect(removeSync(root, options)).toBe(false)
    expect(await fsp.readFile(path.join(root, 'keep.txt'), 'utf8')).toBe('keep')
    expect(existsSync(path.join(root, 'nested'))).toBe(false)
    expect(removeSync(root, { filter: () => true })).toBe(true)
    expect(existsSync(root)).toBe(false)
  })

  it('异步与同步均转发取消信号并原样抛出取消原因', async () => {
    const root = await createTree()
    const controller = new AbortController()
    const reason = new Error('停止删除')
    controller.abort(reason)
    const options = Object.freeze({ signal: controller.signal })

    await expect(remove(root, options)).rejects.toBe(reason)
    let caught: unknown
    try {
      removeSync(root, options)
    } catch (error) {
      caught = error
    }
    expect(caught).toBe(reason)
    expect(await fsp.readFile(path.join(root, 'keep.txt'), 'utf8')).toBe('keep')
    expect(existsSync(path.join(root, 'nested', 'delete.txt'))).toBe(true)
    expect(options.signal).toBe(controller.signal)
  })

  it('glob 选项仅删除匹配文件', async () => {
    await fsp.writeFile(path.join(tempDir, 'async.tmp'), 'async')
    await fsp.writeFile(path.join(tempDir, 'sync.tmp'), 'sync')
    await fsp.writeFile(path.join(tempDir, 'keep.txt'), 'keep')
    const asyncOptions: RimrafAsyncOptions = { glob: true }
    const syncOptions: RimrafSyncOptions = { glob: true }

    expect(await remove(path.join(tempDir, 'async.*'), asyncOptions)).toBe(true)
    expect(removeSync(path.join(tempDir, 'sync.*'), syncOptions)).toBe(true)
    expect(existsSync(path.join(tempDir, 'async.tmp'))).toBe(false)
    expect(existsSync(path.join(tempDir, 'sync.tmp'))).toBe(false)
    expect(existsSync(path.join(tempDir, 'keep.txt'))).toBe(true)
  })

  it('原样传播过滤器错误并保留文件', async () => {
    const file = path.join(tempDir, 'keep.txt')
    await fsp.writeFile(file, 'keep')
    const reason = new Error('过滤失败')
    await expect(
      remove(file, {
        filter: async () => {
          throw reason
        },
      }),
    ).rejects.toBe(reason)
    let caught: unknown
    try {
      removeSync(file, {
        filter: () => {
          throw reason
        },
      })
    } catch (error) {
      caught = error
    }
    expect(caught).toBe(reason)
    expect(await fsp.readFile(file, 'utf8')).toBe('keep')
  })

  it('公开参数类型与已安装 rimraf 的同步和异步选项一致', () => {
    expectTypeOf(remove).parameters.toEqualTypeOf<
      [path: string, options?: RimrafAsyncOptions]
    >()
    expectTypeOf(removeSync).parameters.toEqualTypeOf<
      [path: string, options?: RimrafSyncOptions]
    >()
    expectTypeOf<
      ReturnType<NonNullable<RimrafAsyncOptions['filter']>>
    >().toEqualTypeOf<boolean | Promise<boolean>>()
    expectTypeOf<
      NonNullable<RimrafSyncOptions['filter']>
    >().returns.toEqualTypeOf<boolean>()
  })
})
