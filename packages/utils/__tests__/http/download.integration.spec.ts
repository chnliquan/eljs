import {
  chmod,
  mkdir,
  mkdtemp,
  readdir,
  readFile,
  rename,
  rm,
  stat,
  writeFile,
} from 'node:fs/promises'
import { tmpdir } from 'node:os'
import path from 'node:path'
import { c as createTar } from 'tar'
import { afterAll, afterEach, describe, expect, it, vi } from 'vitest'

import download, { downloadTo } from '../../src/http/download'

vi.mock('node:fs/promises', async importOriginal => {
  const fs = await importOriginal<typeof import('node:fs/promises')>()
  return {
    ...fs,
    mkdtemp: vi.fn(fs.mkdtemp),
    rename: vi.fn(fs.rename),
    chmod: vi.fn(fs.chmod),
  }
})

const temporaryPaths: string[] = []

describe('download integration', () => {
  afterEach(async () => {
    await Promise.all(
      temporaryPaths
        .splice(0)
        .map(temporaryPath =>
          rm(temporaryPath, { force: true, recursive: true }),
        ),
    )
  })

  afterAll(() => {
    vi.unstubAllGlobals()
  })

  it('stops reading and cancels a chunked body as soon as the buffer limit is exceeded', async () => {
    const cancel = vi.fn()
    const pull = vi.fn(controller => {
      controller.enqueue(Buffer.from('1234'))
    })
    const response = new Response(
      new ReadableStream({ cancel, pull }, { highWaterMark: 0 }),
    )
    const arrayBuffer = vi.spyOn(response, 'arrayBuffer')
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(response))

    await expect(
      download('https://example.com/file', { maxBytes: 6 }),
    ).rejects.toMatchObject({
      code: 'ERR_DOWNLOAD_TOO_LARGE',
      details: { receivedBytes: 8 },
    })
    expect(pull).toHaveBeenCalledTimes(2)
    expect(cancel).toHaveBeenCalledWith(
      expect.objectContaining({ code: 'ERR_DOWNLOAD_TOO_LARGE' }),
    )
    expect(response.body?.locked).toBe(false)
    expect(arrayBuffer).not.toHaveBeenCalled()
  })

  it('cancels an oversized declared response without pulling its body', async () => {
    const cancel = vi.fn()
    const pull = vi.fn()
    vi.stubGlobal(
      'fetch',
      vi
        .fn()
        .mockResolvedValue(
          new Response(
            new ReadableStream({ cancel, pull }, { highWaterMark: 0 }),
            { headers: { 'content-length': '100' } },
          ),
        ),
    )

    await expect(
      download('https://example.com/file', { maxBytes: 6 }),
    ).rejects.toMatchObject({ code: 'ERR_DOWNLOAD_TOO_LARGE' })
    expect(pull).not.toHaveBeenCalled()
    expect(cancel).toHaveBeenCalledOnce()
  })

  it('normalizes cancellation during buffered body consumption', async () => {
    const cause = new DOMException('cancelled while reading', 'AbortError')
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue(
        new Response(
          new ReadableStream({
            pull(controller) {
              controller.error(cause)
            },
          }),
        ),
      ),
    )

    await expect(download('https://example.com/file')).rejects.toMatchObject({
      cause,
      code: 'ERR_OPERATION_ABORTED',
      operation: 'http.download',
    })
  })

  it('returns a Buffer and the same readable content from a multi-chunk response', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue(
        new Response(
          new ReadableStream({
            start(controller) {
              controller.enqueue(Buffer.from('123'))
              controller.enqueue(Buffer.from('456'))
              controller.close()
            },
          }),
        ),
      ),
    )
    const result = download('https://example.com/file', { maxBytes: 6 })
    const chunks: Buffer[] = []
    result.on('data', chunk => chunks.push(Buffer.from(chunk)))

    await expect(result).resolves.toEqual(Buffer.from('123456'))
    expect(Buffer.concat(chunks)).toEqual(Buffer.from('123456'))
  })

  it('publishes buffered content and preserves the existing file if publication fails', async () => {
    const destination = await createTemporaryDirectory()
    const outputPath = path.join(destination, 'file')
    await writeFile(outputPath, 'original')
    vi.stubGlobal(
      'fetch',
      vi
        .fn()
        .mockImplementation(() => Promise.resolve(new Response('replacement'))),
    )

    vi.mocked(rename).mockRejectedValueOnce(new Error('publication failed'))
    await expect(
      download('https://example.com/file', destination),
    ).rejects.toThrow('publication failed')
    expect(await readFile(outputPath, 'utf8')).toBe('original')
    expect(await readdir(destination)).toEqual(['file'])

    await expect(
      download('https://example.com/file', destination),
    ).resolves.toEqual(Buffer.from('replacement'))
    expect(await readFile(outputPath, 'utf8')).toBe('replacement')
    expect(await readdir(destination)).toEqual(['file'])
  })

  describe.each([
    ['buffered', download],
    ['streamed', downloadTo],
  ] as const)('%s file permissions', (_mode, downloadFile) => {
    it.skipIf(process.platform === 'win32').each([0o600, 0o755])(
      'preserves mode %s when replacing a regular file under a restrictive umask',
      async mode => {
        const destination = await createTemporaryDirectory()
        const outputPath = path.join(destination, 'file')
        await writeFile(outputPath, 'original')
        await chmod(outputPath, mode)
        vi.stubGlobal(
          'fetch',
          vi.fn().mockResolvedValue(new Response('replacement')),
        )

        const previousMask = process.umask(0o077)
        try {
          await downloadFile('https://example.com/file', destination)
        } finally {
          process.umask(previousMask)
        }
        expect((await stat(outputPath)).mode & 0o777).toBe(mode)
        expect(await readFile(outputPath, 'utf8')).toBe('replacement')
        expect(await readdir(destination)).toEqual(['file'])
      },
    )

    it('keeps the original file if restoring permissions fails', async () => {
      const destination = await createTemporaryDirectory()
      const outputPath = path.join(destination, 'file')
      await writeFile(outputPath, 'original')
      const cause = new Error('chmod denied')
      vi.mocked(chmod).mockRejectedValueOnce(cause)
      vi.stubGlobal(
        'fetch',
        vi.fn().mockResolvedValue(new Response('replacement')),
      )

      await expect(
        downloadFile('https://example.com/file', destination),
      ).rejects.toBe(cause)
      expect(await readFile(outputPath, 'utf8')).toBe('original')
      expect(await readdir(destination)).toEqual(['file'])
    })
  })

  describe.each([
    ['buffered', download],
    ['streamed', downloadTo],
  ] as const)('%s tar limits', (_mode, downloadArchive) => {
    it.each([
      [{ maxEntries: 1 }, 'ERR_ARCHIVE_TOO_MANY_ENTRIES'],
      [{ maxUnpackedBytes: 10 }, 'ERR_ARCHIVE_TOO_LARGE'],
    ] as const)(
      'rejects a real tar overflow for %j and cleans up staging',
      async (limit, code) => {
        const fixtureRoot = await createTemporaryDirectory()
        const archivePath = path.join(fixtureRoot, 'archive.tgz')
        const destination = path.join(fixtureRoot, 'output')
        await writeFile(path.join(fixtureRoot, 'first'), '123456')
        await writeFile(path.join(fixtureRoot, 'second'), '123456')
        await createTar({ cwd: fixtureRoot, file: archivePath, gzip: true }, [
          'first',
          'second',
        ])
        vi.stubGlobal(
          'fetch',
          vi.fn().mockResolvedValue(new Response(await readFile(archivePath))),
        )
        const staging = vi.mocked(mkdtemp).mockClear()

        await expect(
          downloadArchive('https://example.com/archive.tgz', destination, {
            extract: true,
            ...limit,
          }),
        ).rejects.toMatchObject({ code })
        await expect(
          readFile(path.join(destination, 'second')),
        ).rejects.toMatchObject({
          code: 'ENOENT',
        })

        if (_mode === 'streamed') {
          expect(staging).toHaveBeenCalledOnce()
          const stagingPath = await staging.mock.results[0]?.value
          await expect(readdir(stagingPath)).rejects.toMatchObject({
            code: 'ENOENT',
          })
        } else {
          expect(staging).not.toHaveBeenCalled()
        }
      },
    )
  })

  it('downloads and extracts a gzipped tar archive', async () => {
    const fixtureRoot = await createTemporaryDirectory()
    const archiveRoot = path.join(fixtureRoot, 'archive')
    const packageRoot = path.join(archiveRoot, 'package')
    const archivePath = path.join(fixtureRoot, 'package.tgz')
    const destination = await createTemporaryDirectory()

    await mkdir(packageRoot, { recursive: true })
    await writeFile(path.join(packageRoot, 'fixture.txt'), 'verified')
    await createTar(
      {
        cwd: archiveRoot,
        file: archivePath,
        gzip: true,
      },
      ['package'],
    )

    const archive = await readFile(archivePath)
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue(
        new Response(archive, {
          headers: { 'content-type': 'application/gzip' },
          status: 200,
        }),
      ),
    )

    await downloadTo('https://example.com/package.tgz', destination, {
      extract: true,
      strip: 1,
    })

    await expect(
      readFile(path.join(destination, 'fixture.txt'), 'utf8'),
    ).resolves.toBe('verified')
  })
})

async function createTemporaryDirectory(): Promise<string> {
  const temporaryPath = await mkdtemp(path.join(tmpdir(), 'eljs-download-'))
  temporaryPaths.push(temporaryPath)
  return temporaryPath
}
