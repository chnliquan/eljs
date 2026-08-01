import { mkdir, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import path from 'node:path'
import { c as createTar } from 'tar'
import { afterAll, afterEach, describe, expect, it, vi } from 'vitest'

import { downloadTo } from '../../src/http/download'

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
