import { spawnSync } from 'node:child_process'
import console from 'node:console'
import path from 'node:path'
import process from 'node:process'
import { pathToFileURL } from 'node:url'

const packageRoot = path.resolve(import.meta.dirname, '..')
const sampleCount = 5
const targets = [
  ['root', 'dist/index.js'],
  ['cp', 'dist/cp/index.js'],
  ['file', 'dist/file/index.js'],
  ['string', 'dist/string/index.js'],
]
const childScript = `
  const startedAt = performance.now()
  await import(process.argv[1])
  process.stdout.write(String(performance.now() - startedAt))
`

const results = targets.map(([name, relativePath]) => {
  const targetUrl = pathToFileURL(path.join(packageRoot, relativePath)).href
  const samples = Array.from({ length: sampleCount }, () => {
    const result = spawnSync(
      process.execPath,
      ['--input-type=module', '--eval', childScript, targetUrl],
      { encoding: 'utf8' },
    )

    if (result.status !== 0) {
      throw new Error(
        `Import benchmark failed for ${name}: ${result.stderr.trim()}`,
      )
    }

    return Number(result.stdout)
  }).sort((left, right) => left - right)

  return {
    entry: name,
    medianMs: Number(samples[Math.floor(samples.length / 2)].toFixed(2)),
    minimumMs: Number(samples[0].toFixed(2)),
  }
})

console.table(results)
