import { createServer, type RequestListener } from 'node:http'
import { inspect } from 'node:util'
import { gzipSync } from 'node:zlib'
import { afterEach, describe, expect, it, vi } from 'vitest'

import { getNpmPackage } from '../../src/npm/package-metadata'
import { getNpmRequestConfig } from '../../src/npm/request-config'

vi.mock('../../src/npm/request-config', () => ({
  getNpmRequestConfig: vi.fn(),
}))

const versionMetadata = {
  name: 'local-package',
  version: '1.0.0',
  dist: { tarball: 'https://registry.example/local-package.tgz' },
}
const packageMetadata = {
  name: 'local-package',
  versions: { '1.0.0': versionMetadata },
  'dist-tags': { latest: '1.0.0', next: '2.0.0-beta.1' },
}
const servers: Array<{ close: () => Promise<void> }> = []

afterEach(async () => {
  vi.mocked(getNpmRequestConfig).mockReset()
  await Promise.all(servers.splice(0).map(server => server.close()))
})

async function serveLocally(listener: RequestListener) {
  const server = createServer(listener)
  await new Promise<void>(resolve => server.listen(0, '127.0.0.1', resolve))
  const address = server.address()
  if (!address || typeof address === 'string') {
    throw new Error('Expected a local TCP address')
  }
  const local = {
    url: `http://127.0.0.1:${address.port}`,
    close: () =>
      new Promise<void>((resolve, reject) => {
        server.close(error => (error ? reject(error) : resolve()))
        server.closeAllConnections()
      }),
  }
  servers.push(local)
  return local
}

async function serveMetadata(data: unknown) {
  vi.mocked(getNpmRequestConfig).mockResolvedValue({})
  return serveLocally((_request, response) => {
    response.setHeader('content-type', 'application/json')
    response.end(JSON.stringify(data))
  })
}

describe('npm metadata local registry', () => {
  it.each(['registry', 'proxy'] as const)(
    'does not retain credentials from a malformed %s URL',
    async source => {
      const malformed = 'http://fake-user:FAKE_REVIEW_PASSWORD@['
      const origin = await serveMetadata(packageMetadata)
      if (source === 'proxy') {
        vi.mocked(getNpmRequestConfig).mockResolvedValue({ proxy: malformed })
      }
      const error = await getNpmPackage('local-package', {
        registry: source === 'registry' ? malformed : origin.url,
      }).catch((error: unknown) => error)
      expect(error).toMatchObject({
        code: 'ERR_NPM_REGISTRY_REQUEST',
        operation: 'npm.getPackage',
        details: { reason: 'PROTOCOL' },
        cause: undefined,
      })
      expect(inspect(error, { depth: null, showHidden: true })).not.toContain(
        'FAKE_REVIEW_PASSWORD',
      )
      if (source === 'registry') {
        expect(getNpmRequestConfig).not.toHaveBeenCalled()
      }
    },
  )

  it.each(['headers', 'body'] as const)(
    'preserves cancellation reasons without mutation while waiting for %s',
    async phase => {
      const reasons = [
        'caller stopped',
        Object.freeze(new Error('frozen caller stopped')),
        new Error('caller stopped'),
      ]
      for (const reason of reasons) {
        const original =
          typeof reason === 'string'
            ? undefined
            : Object.getOwnPropertyDescriptors(reason)
        const controller = new AbortController()
        let closed = false
        const origin = await serveLocally((_request, response) => {
          if (phase === 'body') {
            response.write('{')
          }
          const timer = setTimeout(() => controller.abort(reason), 30)
          response.on('close', () => {
            closed = true
            clearTimeout(timer)
          })
        })
        vi.mocked(getNpmRequestConfig).mockResolvedValue({})
        const error = await getNpmPackage('local-package', {
          registry: origin.url,
          timeout: 0,
          signal: controller.signal,
        }).catch((error: unknown) => error)
        expect(error).toMatchObject({
          code: 'ERR_NPM_REGISTRY_REQUEST',
          operation: 'npm.getPackage',
        })
        expect((error as Error).cause).toBe(reason)
        expect(controller.signal.reason).toBe(reason)
        if (typeof reason !== 'string') {
          expect(Object.getOwnPropertyDescriptors(reason)).toEqual(original)
        }
        await vi.waitFor(() => expect(closed).toBe(true))
      }
    },
  )

  it.each([
    { ...packageMetadata, name: 'different' },
    {
      ...packageMetadata,
      versions: { '1.0.0': { ...versionMetadata, name: 'different' } },
    },
    {
      ...packageMetadata,
      versions: { '9.9.9': versionMetadata },
    },
  ])('rejects inconsistent package identities: %j', async data => {
    const origin = await serveMetadata(data)
    await expect(
      getNpmPackage('local-package', { registry: origin.url }),
    ).rejects.toMatchObject({
      code: 'ERR_NPM_REGISTRY_RESPONSE',
      details: { reason: 'RESPONSE' },
    })
  })

  it.each([
    ['1.0.0', { ...versionMetadata, name: 'different', version: '9.9.9' }],
    ['1.0.0', { ...versionMetadata, name: 'different' }],
    ['1.0.0', { ...versionMetadata, version: '9.9.9' }],
    ['1.0.0-beta.1', versionMetadata],
    ['1.0.0+build.1', { ...versionMetadata, version: '1.0.0+build.2' }],
    ['latest', { ...versionMetadata, name: 'different' }],
    ['latest', { ...versionMetadata, version: 'latest' }],
    ['latest', { ...versionMetadata, version: '01.0.0' }],
    ['latest', { ...versionMetadata, version: '1.0.0-beta.01' }],
    ['latest', { ...versionMetadata, version: '1.0.0\n' }],
  ])(
    'rejects inconsistent version identity for %s: %j',
    async (version, data) => {
      const origin = await serveMetadata(data)
      await expect(
        getNpmPackage('local-package', { registry: origin.url, version }),
      ).rejects.toMatchObject({
        code: 'ERR_NPM_REGISTRY_RESPONSE',
        details: { reason: 'RESPONSE' },
      })
    },
  )

  it.each(['latest', 'next', '1.0.0-beta.1+build.2', 'v1.0.0-beta.1+build.2'])(
    'accepts an exact version matching the query or resolving tag %s',
    async version => {
      const data = { ...versionMetadata, version: '1.0.0-beta.1+build.2' }
      const origin = await serveMetadata(data)
      await expect(
        getNpmPackage('local-package', { registry: origin.url, version }),
      ).resolves.toEqual(data)
    },
  )

  it('preserves credentials on a relative redirect, strips all credentials across origins and never restores them', async () => {
    const received: Array<Record<string, unknown>> = []
    let intermediateClosed = false
    const target = await serveLocally((request, response) => {
      received.push(request.headers)
      response.writeHead(307, { location: `${origin.url}/final` })
      response.end()
    })
    const origin = await serveLocally((request, response) => {
      received.push(request.headers)
      if (request.url === '/local-package') {
        response.writeHead(301, { location: '/relative' })
        response.end()
      } else if (request.url === '/relative') {
        response.writeHead(302, { location: `${target.url}/remote` })
        response.write('endless redirect')
        const timer = setInterval(() => response.write('more'), 10)
        response.on('close', () => {
          intermediateClosed = true
          clearInterval(timer)
        })
      } else {
        response.end(JSON.stringify(packageMetadata))
      }
    })
    vi.mocked(getNpmRequestConfig).mockResolvedValue({
      headers: {
        Authorization: 'Bearer secret',
        Cookie: 'secret',
        'X-Api-Key': 'secret',
        'Accept-Language': 'zh-CN',
      },
    })
    await expect(
      getNpmPackage('local-package', {
        registry: origin.url,
        timeout: 1500,
      }),
    ).resolves.toEqual(packageMetadata)
    expect(received).toHaveLength(4)
    for (const headers of received.slice(0, 2)) {
      expect(headers.authorization).toBe('Bearer secret')
      expect(headers.cookie).toBe('secret')
    }
    for (const headers of received.slice(2)) {
      expect(headers).not.toHaveProperty('authorization')
      expect(headers).not.toHaveProperty('cookie')
      expect(headers).not.toHaveProperty('x-api-key')
      expect(headers['accept-language']).toBe('zh-CN')
    }
    expect(getNpmRequestConfig).toHaveBeenCalledOnce()
    await vi.waitFor(() => expect(intermediateClosed).toBe(true))
  })

  it.each([
    'file:///etc/passwd',
    'ftp://127.0.0.1/file',
    'http://user:secret@127.0.0.1/file',
    'http://[',
  ])(
    'rejects unsafe redirect %s without contacting its destination',
    async location => {
      const origin = await serveLocally((_request, response) => {
        response.writeHead(302, { location })
        response.end()
      })
      vi.mocked(getNpmRequestConfig).mockResolvedValue({})
      await expect(
        getNpmPackage('local-package', { registry: origin.url }),
      ).rejects.toMatchObject({
        code: 'ERR_NPM_REGISTRY_REQUEST',
        details: { reason: 'REDIRECT' },
      })
    },
  )

  it('bounds redirect loops and rejects a redirect without Location', async () => {
    let requests = 0
    const origin = await serveLocally((_request, response) => {
      requests++
      response.writeHead(308, { location: '/local-package' })
      response.end()
    })
    vi.mocked(getNpmRequestConfig).mockResolvedValue({})
    await expect(
      getNpmPackage('local-package', { registry: origin.url }),
    ).rejects.toMatchObject({
      code: 'ERR_NPM_REGISTRY_REQUEST',
      details: { reason: 'REDIRECT' },
    })
    expect(requests).toBe(21)
    const missing = await serveLocally((_request, response) => {
      response.writeHead(303)
      response.end()
    })
    await expect(
      getNpmPackage('local-package', { registry: missing.url }),
    ).rejects.toMatchObject({
      code: 'ERR_NPM_REGISTRY_REQUEST',
      details: { reason: 'REDIRECT' },
    })
  })

  it('uses one deadline across a delayed redirect and a continuously dripping final body', async () => {
    let finalClosed = false
    const origin = await serveLocally((request, response) => {
      if (request.url === '/local-package') {
        const timer = setTimeout(() => {
          response.writeHead(302, { location: '/final' })
          response.end()
        }, 100)
        response.on('close', () => clearTimeout(timer))
      } else {
        response.write('{')
        const timer = setInterval(() => response.write(' '), 10)
        response.on('close', () => {
          finalClosed = true
          clearInterval(timer)
        })
      }
    })
    vi.mocked(getNpmRequestConfig).mockResolvedValue({})
    const caller = new AbortController()
    const started = Date.now()
    await expect(
      getNpmPackage('local-package', {
        registry: origin.url,
        timeout: 250,
        signal: caller.signal,
      }),
    ).rejects.toMatchObject({ code: 'ERR_NPM_REGISTRY_REQUEST' })
    expect(Date.now() - started).toBeLessThan(1000)
    expect(caller.signal.aborted).toBe(false)
    await vi.waitFor(() => expect(finalClosed).toBe(true))
  })

  it('honors caller cancellation during body reading even when the deadline is disabled', async () => {
    const controller = new AbortController()
    let closed = false
    const origin = await serveLocally((_request, response) => {
      response.write('{')
      const timer = setTimeout(
        () => controller.abort(new Error('caller stopped')),
        30,
      )
      response.on('close', () => {
        closed = true
        clearTimeout(timer)
      })
    })
    vi.mocked(getNpmRequestConfig).mockResolvedValue({})
    await expect(
      getNpmPackage('local-package', {
        registry: origin.url,
        timeout: 0,
        signal: controller.signal,
      }),
    ).rejects.toMatchObject({ code: 'ERR_NPM_REGISTRY_REQUEST' })
    await vi.waitFor(() => expect(closed).toBe(true))
  })

  it('does not contact the registry for a pre-aborted signal', async () => {
    const origin = await serveLocally(() => {
      throw new Error('Registry must not be contacted')
    })
    await expect(
      getNpmPackage('local-package', {
        registry: origin.url,
        signal: AbortSignal.abort(),
      }),
    ).rejects.toMatchObject({ code: 'ERR_NPM_REGISTRY_REQUEST' })
    expect(getNpmRequestConfig).not.toHaveBeenCalled()
  })

  it('applies the deadline while waiting for npm request configuration', async () => {
    const origin = await serveLocally(() => {
      throw new Error('Registry must not be contacted')
    })
    vi.mocked(getNpmRequestConfig).mockImplementation(
      () => new Promise(() => undefined),
    )
    await expect(
      getNpmPackage('local-package', {
        registry: origin.url,
        timeout: 30,
      }),
    ).rejects.toMatchObject({
      code: 'ERR_NPM_REGISTRY_REQUEST',
      cause: { name: 'TimeoutError' },
    })
  })

  it('stops an endless chunked response when its actual bytes exceed the limit', async () => {
    let closed = false
    const origin = await serveLocally((_request, response) => {
      response.write(' '.repeat(64))
      const timer = setInterval(() => response.write(' '.repeat(64)), 10)
      response.on('close', () => {
        closed = true
        clearInterval(timer)
      })
    })
    vi.mocked(getNpmRequestConfig).mockResolvedValue({})
    await expect(
      getNpmPackage('local-package', {
        registry: origin.url,
        maxBytes: 100,
      }),
    ).rejects.toMatchObject({
      code: 'ERR_NPM_REGISTRY_RESPONSE',
      details: { reason: 'MAX_BYTES' },
    })
    await vi.waitFor(() => expect(closed).toBe(true))
  })

  it('limits decompressed bytes rather than the compressed Content-Length', async () => {
    const compressed = gzipSync(
      JSON.stringify({
        ...packageMetadata,
        readme: 'x'.repeat(4096),
      }),
    )
    const origin = await serveLocally((_request, response) => {
      response.writeHead(200, {
        'content-encoding': 'gzip',
        'content-length': compressed.length,
      })
      response.end(compressed)
    })
    vi.mocked(getNpmRequestConfig).mockResolvedValue({})
    expect(compressed.length).toBeLessThan(1024)
    await expect(
      getNpmPackage('local-package', {
        registry: origin.url,
        maxBytes: 1024,
      }),
    ).rejects.toMatchObject({
      code: 'ERR_NPM_REGISTRY_RESPONSE',
      details: { reason: 'MAX_BYTES' },
    })
  })

  it('accepts a response exactly at the configured byte limit', async () => {
    const origin = await serveMetadata(packageMetadata)
    await expect(
      getNpmPackage('local-package', {
        registry: origin.url,
        maxBytes: Buffer.byteLength(JSON.stringify(packageMetadata)),
      }),
    ).resolves.toEqual(packageMetadata)
  })

  it('enforces the default 32 MiB limit without an explicit maxBytes', async () => {
    const chunk = Buffer.alloc(1024 * 1024, ' ')
    const origin = await serveLocally((_request, response) => {
      response.write('{"name":"local-package","versions":{},"dist-tags":{}')
      const timer = setInterval(() => response.write(chunk), 1)
      response.on('close', () => clearInterval(timer))
    })
    vi.mocked(getNpmRequestConfig).mockResolvedValue({})
    await expect(
      getNpmPackage('local-package', { registry: origin.url }),
    ).rejects.toMatchObject({
      code: 'ERR_NPM_REGISTRY_RESPONSE',
      details: { reason: 'MAX_BYTES' },
    })
  })

  it.each([404, 401, 503])(
    'cancels an endless HTTP %i body promptly',
    async status => {
      let closed = false
      const origin = await serveLocally((_request, response) => {
        response.writeHead(status)
        response.write('never ends')
        response.on('close', () => {
          closed = true
        })
      })
      vi.mocked(getNpmRequestConfig).mockResolvedValue({})
      const request = getNpmPackage('local-package', {
        registry: origin.url,
        timeout: 1500,
      })
      if (status === 404) {
        await expect(request).resolves.toBeNull()
      } else {
        await expect(request).rejects.toMatchObject({
          code: 'ERR_NPM_REGISTRY_HTTP_STATUS',
        })
      }
      await vi.waitFor(() => expect(closed).toBe(true))
    },
  )

  it.each([
    packageMetadata,
    { name: 'local-package', versions: {}, 'dist-tags': {} },
    { ...packageMetadata, readme: 'registry extension', time: {} },
  ])(
    'accepts reasonable package-level metadata without top-level dist/version: %j',
    async data => {
      const origin = await serveMetadata(data)
      await expect(
        getNpmPackage('local-package', { registry: origin.url }),
      ).resolves.toEqual(data)
    },
  )

  it.each([
    {},
    null,
    [],
    'error',
    { ...packageMetadata, versions: [] },
    { ...packageMetadata, 'dist-tags': null },
    { ...packageMetadata, 'dist-tags': { latest: 1 } },
    { ...packageMetadata, versions: { '1.0.0': {} } },
    { ...packageMetadata, dist: {} },
  ])('rejects malformed package-level metadata: %j', async data => {
    const origin = await serveMetadata(data)
    await expect(
      getNpmPackage('local-package', { registry: origin.url }),
    ).rejects.toMatchObject({ code: 'ERR_NPM_REGISTRY_RESPONSE' })
  })

  it.each([
    versionMetadata,
    {
      ...versionMetadata,
      dist: {
        ...versionMetadata.dist,
        integrity: `sha512-${Buffer.alloc(64).toString('base64').replace(/=+$/u, '')}?option unknown-${Buffer.alloc(16).toString('base64')}`,
      },
    },
    {
      ...versionMetadata,
      dist: {
        ...versionMetadata.dist,
        shasum: 'a'.repeat(40),
        integrity: `sha512-${Buffer.alloc(64).toString('base64')} sha256-${Buffer.alloc(32).toString('base64')}`,
        size: 0,
        unpackedSize: 1024,
        signatures: [],
      },
    },
  ])(
    'accepts version metadata with missing or valid optional digests: %j',
    async data => {
      const origin = await serveMetadata(data)
      await expect(
        getNpmPackage('local-package', {
          registry: origin.url,
          version: 'latest',
        }),
      ).resolves.toEqual(data)
    },
  )

  it.each([
    {},
    { ...versionMetadata, name: '' },
    { ...versionMetadata, version: 1 },
    { ...versionMetadata, dist: undefined },
    ...[
      { tarball: '' },
      { tarball: 'file:///tmp/package.tgz' },
      { shasum: 'abc123' },
      { shasum: 1 },
      { integrity: {} },
      { integrity: 'sha512-%%%' },
      { integrity: 'sha512-YWJj' },
      { integrity: 'unknown-a' },
      { integrity: '' },
      { size: -1 },
      { size: '1024' },
      { unpackedSize: 1.5 },
    ].map(dist => ({
      ...versionMetadata,
      dist: { ...versionMetadata.dist, ...dist },
    })),
  ])('rejects malformed version metadata: %j', async data => {
    const origin = await serveMetadata(data)
    await expect(
      getNpmPackage('local-package', {
        registry: origin.url,
        version: 'latest',
      }),
    ).rejects.toMatchObject({ code: 'ERR_NPM_REGISTRY_RESPONSE' })
  })

  it('reports invalid JSON as a response error', async () => {
    const origin = await serveLocally((_request, response) => response.end('{'))
    vi.mocked(getNpmRequestConfig).mockResolvedValue({})
    await expect(
      getNpmPackage('local-package', { registry: origin.url }),
    ).rejects.toMatchObject({ code: 'ERR_NPM_REGISTRY_RESPONSE' })
  })
})
