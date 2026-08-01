import { createHash } from 'node:crypto'
import { createReadStream, createWriteStream } from 'node:fs'
import { mkdir, mkdtemp, rename, rm, writeFile } from 'node:fs/promises'
import { Readable, Writable } from 'node:stream'
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

import download, { downloadTo } from '../../src/http/download'

const { mockProxyClose } = vi.hoisted(() => ({
  mockProxyClose: vi.fn().mockResolvedValue(undefined),
}))

vi.mock('node:fs/promises')
vi.mock('node:fs')
vi.mock('tar')
vi.mock('urllib', () => ({
  ProxyAgent: class ProxyAgent {
    public close = mockProxyClose
  },
}))

const mockFetch = vi.fn()
const mockMkdir = mkdir as MockedFunction<typeof mkdir>
const mockMkdtemp = mkdtemp as MockedFunction<typeof mkdtemp>
const mockRename = rename as MockedFunction<typeof rename>
const mockRm = rm as MockedFunction<typeof rm>
const mockWriteFile = writeFile as MockedFunction<typeof writeFile>
const mockCreateReadStream = createReadStream as MockedFunction<
  typeof createReadStream
>
const mockCreateWriteStream = createWriteStream as MockedFunction<
  typeof createWriteStream
>
const mockExtractTar = extractTar as MockedFunction<typeof extractTar>

describe('download', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockMkdtemp.mockResolvedValue('/tmp/eljs-download-test')
    mockRename.mockResolvedValue(undefined)
    mockRm.mockResolvedValue(undefined)
    mockProxyClose.mockResolvedValue(undefined)
    vi.stubGlobal('fetch', mockFetch)
    mockFetch.mockImplementation(() =>
      Promise.resolve(createResponse('downloaded')),
    )
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

  it('wraps transport failures with a stable request error', async () => {
    const cause = new Error('network offline')
    mockFetch.mockRejectedValue(cause)

    await expect(
      download('https://example.com/archive.tgz'),
    ).rejects.toMatchObject({
      cause,
      code: 'ERR_DOWNLOAD_REQUEST',
      details: { hostname: 'example.com', protocol: 'https:' },
    })
  })

  it('preserves the original reason when an active request is aborted', async () => {
    const controller = new AbortController()
    const reason = new Error('cancelled by caller')
    controller.abort(reason)
    mockFetch.mockRejectedValue(reason)

    await expect(
      download('https://example.com/archive.tgz', {
        signal: controller.signal,
      }),
    ).rejects.toBe(reason)
  })

  it('preserves request and proxy cleanup failures together', async () => {
    const requestError = new Error('request failed')
    const cleanupError = new Error('proxy close failed')
    mockFetch.mockRejectedValue(requestError)
    mockProxyClose.mockRejectedValueOnce(cleanupError)

    await expect(
      download('https://example.com/archive.tgz', {
        proxy: 'http://proxy.example.com:8080',
      }),
    ).rejects.toMatchObject({ errors: [requestError, cleanupError] })
  })

  it('rejects responses that exceed the configured buffer limit', async () => {
    await expect(
      download('https://example.com/archive.tgz', { maxBytes: 4 }),
    ).rejects.toMatchObject({
      code: 'ERR_DOWNLOAD_TOO_LARGE',
      operation: 'http.download',
    })
  })

  it('rejects an oversized declared content length before reading the body', async () => {
    mockFetch.mockResolvedValue(
      new Response('downloaded', {
        headers: { 'content-length': '99' },
      }),
    )

    await expect(
      download('https://example.com/archive.tgz', { maxBytes: 10 }),
    ).rejects.toMatchObject({ code: 'ERR_DOWNLOAD_TOO_LARGE' })
  })

  it('verifies downloaded content against npm-style integrity metadata', async () => {
    const integrity = `sha512-${createHash('sha512')
      .update('downloaded')
      .digest('base64')}`

    await expect(
      download('https://example.com/archive.tgz', { integrity }),
    ).resolves.toEqual(Buffer.from('downloaded'))
    mockFetch.mockResolvedValue(createResponse('downloaded'))
    await expect(
      download('https://example.com/archive.tgz', {
        integrity: 'sha512-aW52YWxpZA==',
      }),
    ).rejects.toThrow('failed integrity verification')
  })

  it('rejects integrity values without a supported digest', async () => {
    await expect(
      download('https://example.com/archive.tgz', {
        integrity: 'unsupported-invalid',
      }),
    ).rejects.toMatchObject({ code: 'ERR_DOWNLOAD_INTEGRITY' })
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

  it('limits the number of extracted archive entries', async () => {
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
      maxEntries: 1,
    })

    const tarOptions = mockExtractTar.mock.calls.at(-1)?.[0]
    expect(tarOptions?.filter?.('first', {} as never)).toBe(true)
    expect(() => tarOptions?.filter?.('second', {} as never)).toThrow(
      'more than 1 entries',
    )
  })

  it('limits the total unpacked archive size', async () => {
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
      maxUnpackedBytes: 10,
    })

    const tarOptions = mockExtractTar.mock.calls.at(-1)?.[0]
    expect(tarOptions?.filter?.('first', { size: 6 } as never)).toBe(true)
    expect(() => tarOptions?.filter?.('second', { size: 5 } as never)).toThrow(
      'expands beyond the 10 byte limit',
    )
  })

  it('rejects invalid archive limits before extraction', async () => {
    await expect(
      download('https://example.com/archive.tgz', '/destination', {
        extract: true,
        maxEntries: -1,
      }),
    ).rejects.toThrow('maxEntries must be a non-negative safe integer')

    await expect(
      download('https://example.com/archive.tgz', '/destination', {
        extract: true,
        maxUnpackedBytes: -1,
      }),
    ).rejects.toThrow('maxUnpackedBytes must be a non-negative safe integer')
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

  it('passes an explicit proxy dispatcher to fetch', async () => {
    await download('https://example.com/archive.tgz', {
      proxy: 'http://proxy.example.com:8080',
    })

    expect(mockFetch).toHaveBeenCalledWith(
      expect.any(URL),
      expect.objectContaining({ dispatcher: expect.any(Object) }),
    )
    const dispatcher = mockFetch.mock.calls.at(-1)?.[1]?.dispatcher as {
      close: MockedFunction<() => Promise<void>>
    }
    expect(dispatcher.close).toHaveBeenCalledOnce()
  })

  it('reports proxy cleanup failure after a successful response', async () => {
    const cleanupError = new Error('proxy close failed')
    mockProxyClose.mockRejectedValueOnce(cleanupError)

    await expect(
      download('https://example.com/archive.tgz', {
        proxy: 'http://proxy.example.com:8080',
      }),
    ).rejects.toBe(cleanupError)
  })

  it('preserves response processing and proxy cleanup failures together', async () => {
    const cleanupError = new Error('proxy close failed')
    mockProxyClose.mockRejectedValueOnce(cleanupError)

    await expect(
      download('https://example.com/archive.tgz', {
        integrity: 'sha512-aW52YWxpZA==',
        proxy: 'http://proxy.example.com:8080',
      }),
    ).rejects.toMatchObject({
      errors: [
        expect.objectContaining({ code: 'ERR_DOWNLOAD_INTEGRITY' }),
        cleanupError,
      ],
    })
  })

  it('streams through a verified staging archive before extraction', async () => {
    const response = createResponse('streamed-download')
    const arrayBuffer = vi.spyOn(response, 'arrayBuffer')
    const archiveChunks: Buffer[] = []
    const extractedChunks: Buffer[] = []
    mockCreateWriteStream.mockReturnValue(
      new Writable({
        write(chunk, _encoding, callback) {
          archiveChunks.push(Buffer.from(chunk))
          callback()
        },
      }) as ReturnType<typeof createWriteStream>,
    )
    mockCreateReadStream.mockImplementation(
      () => Readable.from(archiveChunks) as ReturnType<typeof createReadStream>,
    )
    const extractor = new Writable({
      write(chunk, _encoding, callback) {
        extractedChunks.push(Buffer.from(chunk))
        callback()
      },
    })
    mockFetch.mockResolvedValue(response)
    mockExtractTar.mockReturnValue(
      extractor as unknown as ReturnType<typeof extractTar>,
    )

    await downloadTo('https://example.com/archive.tgz', '/destination', {
      extract: true,
      maxBytes: 1024,
    })

    expect(arrayBuffer).not.toHaveBeenCalled()
    expect(Buffer.concat(extractedChunks)).toEqual(
      Buffer.from('streamed-download'),
    )
    expect(mockRm).toHaveBeenCalledWith('/tmp/eljs-download-test', {
      force: true,
      recursive: true,
    })
  })

  it('atomically publishes a streamed file after verification succeeds', async () => {
    mockCreateWriteStream.mockReturnValue(
      new Writable({
        write(_chunk, _encoding, callback) {
          callback()
        },
      }) as ReturnType<typeof createWriteStream>,
    )

    await downloadTo('https://example.com/archive.tgz', '/destination', {
      filename: 'archive.tgz',
    })

    expect(mockCreateWriteStream).toHaveBeenCalledWith(
      expect.stringMatching(/^\/destination\/\.archive\.tgz\..+\.tmp$/),
    )
    const temporaryPath = mockCreateWriteStream.mock.calls.at(-1)?.[0]
    expect(mockRename).toHaveBeenCalledWith(
      temporaryPath,
      '/destination/archive.tgz',
    )
    expect(mockRm).toHaveBeenCalledWith(temporaryPath, {
      force: true,
      recursive: false,
    })
  })

  it('does not publish a streamed file when integrity verification fails', async () => {
    mockCreateWriteStream.mockReturnValue(
      new Writable({
        write(_chunk, _encoding, callback) {
          callback()
        },
      }) as ReturnType<typeof createWriteStream>,
    )

    await expect(
      downloadTo('https://example.com/archive.tgz', '/destination', {
        filename: 'archive.tgz',
        integrity: 'sha512-aW52YWxpZA==',
      }),
    ).rejects.toThrow('failed integrity verification')

    expect(mockRename).not.toHaveBeenCalled()
    expect(mockRm).toHaveBeenCalledWith(
      expect.stringMatching(/^\/destination\/\.archive\.tgz\..+\.tmp$/),
      { force: true, recursive: false },
    )
  })

  it('preserves streamed task and temporary cleanup failures together', async () => {
    const cleanupError = new Error('temporary cleanup failed')
    mockCreateWriteStream.mockReturnValue(
      new Writable({
        write(_chunk, _encoding, callback) {
          callback()
        },
      }) as ReturnType<typeof createWriteStream>,
    )
    mockRm.mockRejectedValueOnce(cleanupError)

    await expect(
      downloadTo('https://example.com/archive.tgz', '/destination', {
        filename: 'archive.tgz',
        integrity: 'sha512-aW52YWxpZA==',
      }),
    ).rejects.toMatchObject({
      errors: [
        expect.objectContaining({ code: 'ERR_DOWNLOAD_INTEGRITY' }),
        cleanupError,
      ],
    })
  })

  it('rejects a response URL without a usable output filename', async () => {
    await expect(
      download('https://example.com/', '/destination'),
    ).rejects.toThrow('Unable to determine a safe filename')
  })

  it('emits structured lifecycle events without exposing the URL path', async () => {
    const observer = vi.fn()

    await download('https://example.com/private/token.tgz?secret=value', {
      runtime: { observer },
    })

    expect(observer).toHaveBeenNthCalledWith(
      1,
      expect.objectContaining({
        attributes: { hostname: 'example.com', protocol: 'https:' },
        operation: 'http.download',
        phase: 'start',
      }),
    )
    expect(observer).toHaveBeenLastCalledWith(
      expect.objectContaining({
        operation: 'http.download',
        phase: 'success',
      }),
    )
  })
})

function createResponse(
  body: string,
  status = 200,
  statusText = 'OK',
): Response {
  return new Response(body, {
    status,
    statusText,
  })
}
