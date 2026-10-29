import cp from 'node:child_process'
import { EventEmitter } from 'node:events'
import { PassThrough, Writable } from 'node:stream'
import { read } from 'read'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { clearCachedSudoPassword, sudo } from '../../src/cp/sudo'

vi.mock('../../src/cp/command', () => ({
  findExecutable: vi.fn().mockResolvedValue('/usr/bin/sudo'),
}))
vi.mock('read', () => ({ read: vi.fn() }))

const streams: Array<PassThrough | Writable> = []

describe('sudo stdin lifecycle', () => {
  beforeEach(() => {
    clearCachedSudoPassword()
    vi.spyOn(process, 'platform', 'get').mockReturnValue('darwin')
  })

  afterEach(() => {
    streams.splice(0).forEach(stream => stream.destroy())
    clearCachedSudoPassword()
  })

  it.each([false, true])(
    'rejects asynchronous EPIPE safely when kill throws: %s',
    async killThrows => {
      const cause = Object.assign(new Error('write EPIPE'), { code: 'EPIPE' })
      const stdin = new Writable({
        write(_chunk, _encoding, callback) {
          process.nextTick(callback, cause)
        },
      })
      const child = mockChild(stdin)
      child.kill.mockImplementation(() => {
        if (killThrows) {
          throw new Error('process already exited')
        }
        child.emit('close', 0, null)
        return true
      })
      const log = vi.spyOn(console, 'log').mockImplementation(() => {})
      const result = sudo(['true'], { password: 'private-password' })
      const rejected = expect(result).rejects.toMatchObject({
        cause,
        code: 'ERR_PROCESS_SPAWN',
        operation: 'cp.sudo',
      })
      await new Promise(setImmediate)
      child.stderr.write('#node-sudo-passwd#')

      await rejected
      expect(stdin.destroyed).toBe(true)
      expect(child.kill).toHaveBeenCalledOnce()
      expect(log).not.toHaveBeenCalled()
      expect(() => stdin.emit('error', cause)).not.toThrow()
      expect(child.kill).toHaveBeenCalledOnce()
    },
  )

  it('handles a synchronous password write failure through the same cleanup', async () => {
    const stdin = new PassThrough()
    const cause = new Error('write failed')
    vi.spyOn(stdin, 'write').mockImplementation(() => {
      throw cause
    })
    const child = mockChild(stdin)
    const result = sudo(['true'], { password: 'private-password' })
    const rejected = expect(result).rejects.toMatchObject({ cause })
    await new Promise(setImmediate)
    child.stderr.write('#node-sudo-passwd#')

    await rejected
    expect(child.kill).toHaveBeenCalledOnce()
    expect(stdin.destroyed).toBe(true)
  })

  it.each(['resolve', 'reject'] as const)(
    'ignores a password prompt that finishes after exit: %s',
    async outcome => {
      let finishPrompt: () => void = () => {}
      vi.mocked(read).mockImplementation(
        () =>
          new Promise((resolve, reject) => {
            finishPrompt = () =>
              outcome === 'resolve'
                ? resolve('late-password')
                : reject(new Error('prompt failed'))
          }),
      )
      const stdin = new PassThrough()
      const write = vi.spyOn(stdin, 'write')
      const child = mockChild(stdin)
      const result = sudo(['true'], { cachePassword: true })
      await new Promise(setImmediate)
      child.stderr.write('#node-sudo-passwd#')
      child.emit('close', 0, null)
      await result
      finishPrompt()
      await new Promise(setImmediate)

      expect(write).not.toHaveBeenCalled()
      expect(child.kill).not.toHaveBeenCalled()
    },
  )
})

function mockChild(stdin: Writable) {
  const child = Object.assign(new EventEmitter(), {
    kill: vi.fn(() => true),
    stderr: new PassThrough(),
    stdin,
    stdout: new PassThrough(),
  })
  streams.push(stdin, child.stderr, child.stdout)
  vi.spyOn(cp, 'spawn').mockReturnValue(child as unknown as cp.ChildProcess)
  return child
}
