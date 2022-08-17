import load from 'download'
import os from 'os'

export function download(
  url: string,
  dest: string,
): Promise<Buffer> & NodeJS.WritableStream & NodeJS.ReadableStream {
  return load(url, dest, { extract: true })
}

export function getLocalIp(): string {
  const ifs = os.networkInterfaces()

  for (const type in ifs) {
    const found = ifs?.[type]?.find(
      item => item.family === 'IPv4' && !item.internal,
    )

    if (found) {
      return found.address
    }
  }

  return '127.0.0.1'
}
