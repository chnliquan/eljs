import { mkdir, writeFile } from 'node:fs/promises'
import { Writable } from 'node:stream'
import { x as extractTar } from 'tar'
import {
  afterAll,
  beforeEach,
  describe,
  expect,
  it,
  vi,
  type MockedFunction,
} from 'vitest'

import download from '../../src/http/download'

vi.mock('node:fs/promises')
vi.mock('tar')

const mockFetch = vi.fn()
const mockMkdir = mkdir as MockedFunction<typeof mkdir>
const mockWriteFile = writeFile as MockedFunction<typeof writeFile>
const mockExtractTar = extractTar as MockedFunction<typeof extractTar>

describe('download', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.stubGlobal('fetch', mockFetch)
    mockFetch.mockResolvedValue(createResponse('downloaded'))
  })

  afterAll(() => {
    vi.unstubAllGlobals()
  })

  it('returns the downloaded body when no destination is provided', async () => {
    const result = await download('https://example.com/archive.tgz')

    expect(result).toEqual(Buffer.from('downloaded'))
    expect(mockMkdir).not.toHaveBeenCalled()
    expect(mockWriteFile).not.toHaveBeenCalled()
  })

  it('can be consumed as both a readable stream and a promise', async () => {
    const result = download('https://example.com/archive.tgz')
    const chunks: Buffer[] = []
    result.on('data', chunk => chunks.push(Buffer.from(chunk)))

    await expect(result).resolves.toEqual(Buffer.from('downloaded'))
    expect(Buffer.concat(chunks)).toEqual(Buffer.from('downloaded'))
  })

  it('rejects non-HTTP protocols before making a request', async () => {
    await expect(download('file:///tmp/archive.tgz')).rejects.toThrow(
      'Unsupported download protocol: file:',
    )
    expect(mockFetch).not.toHaveBeenCalled()
  })

  it('reports unsuccessful HTTP responses', async () => {
    mockFetch.mockResolvedValue(createResponse('', 404, 'Not Found'))

    await expect(download('https://example.com/missing.tgz')).rejects.toThrow(
      'Request failed with status 404 Not Found',
    )
  })

  it('writes a download using a sanitized filename', async () => {
    await download('https://example.com/archive.tgz', '/destination', {
      filename: '../unsafe.tgz',
    })

    expect(mockMkdir).toHaveBeenCalledWith('/destination', { recursive: true })
    expect(mockWriteFile).toHaveBeenCalledWith(
      '/destination/unsafe.tgz',
      Buffer.from('downloaded'),
    )
  })

  it('securely extracts tar archives with the requested strip depth', async () => {
    const extractor = new Writable({
      write(_chunk, _encoding, callback) {
        callback()
      },
    })
    mockExtractTar.mockReturnValue(
      extractor as unknown as ReturnType<typeof extractTar>,
    )

    await download('https://example.com/archive.tgz', '/destination', {
      extract: true,
      strip: 1,
    })

    expect(mockExtractTar).toHaveBeenCalledWith({
      cwd: '/destination',
      preservePaths: false,
      strict: true,
      strip: 1,
    })
    expect(mockWriteFile).not.toHaveBeenCalled()
  })

  it('combines caller cancellation with the request timeout', async () => {
    const controller = new AbortController()

    await download('https://example.com/archive.tgz', {
      headers: { accept: 'application/tgz' },
      signal: controller.signal,
      timeout: 5_000,
    })

    expect(mockFetch).toHaveBeenCalledWith(
      expect.any(URL),
      expect.objectContaining({
        headers: { accept: 'application/tgz' },
        redirect: 'follow',
        signal: expect.any(AbortSignal),
      }),
    )
  })
})

function createResponse(
  body: string,
  status = 200,
  statusText = 'OK',
): Response {
  const bytes = Uint8Array.from(Buffer.from(body))

  return {
    arrayBuffer: async () => bytes.buffer,
    ok: status >= 200 && status < 300,
    status,
    statusText,
    url: 'https://example.com/archive.tgz',
  } as Response
}
