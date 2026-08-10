import * as fs from 'node:fs'
import * as os from 'node:os'
import * as path from 'node:path'

export function createTempDir(prefix: string): string {
  return fs.mkdtempSync(path.join(os.tmpdir(), prefix))
}

export function createTempFile(
  directory: string,
  filename: string,
  content: string,
): string {
  const filePath = path.join(directory, filename)
  fs.writeFileSync(filePath, content)
  return filePath
}

export function cleanupDir(directory: string): void {
  fs.rmSync(directory, { recursive: true, force: true })
}

export function createBlockedDirectoryPath(
  directory: string,
  filename = 'not-a-directory',
): string {
  const blocker = createTempFile(directory, filename, 'not a directory')
  return path.join(blocker, 'child')
}

export async function waitForCondition(
  condition: () => boolean,
  timeoutMilliseconds = 1000,
  intervalMilliseconds = 5,
): Promise<void> {
  const deadline = Date.now() + timeoutMilliseconds

  while (!condition()) {
    if (Date.now() >= deadline) {
      throw new Error('Timed out waiting for test condition')
    }

    await new Promise(resolve => setTimeout(resolve, intervalMilliseconds))
  }
}
