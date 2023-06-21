import deepmerge from 'deepmerge'
import execa from 'execa'
import fs from 'fs'
import path from 'path'
import { readJSONSync, safeWriteJSONSync } from './file'
import { PkgJSON } from './types'

export function updatePkgJSON(partial: PkgJSON, cwd = process.cwd()): void {
  const pkgJSONPath = path.resolve(cwd, 'package.json')
  const pkgJSON = readJSONSync(pkgJSONPath)
  const pkg = deepmerge(pkgJSON, partial)

  safeWriteJSONSync(pkgJSONPath, pkg)
}

export interface InstallDepsOpts {
  dependencies?: string[]
  devDependencies?: string[]
  cwd?: string
}

export function installDeps({
  dependencies,
  devDependencies,
  cwd = process.cwd(),
}: InstallDepsOpts) {
  const useYarn =
    fs.existsSync(path.join(cwd, 'yarn.lock')) ||
    fs.existsSync(path.join(process.cwd(), 'yarn.lock'))
  const usePnpm =
    fs.existsSync(path.join(cwd, 'pnpm-workspace.yaml')) ||
    fs.existsSync(path.join(process.cwd(), 'pnpm-workspace.yaml'))
  const runNpm = useYarn ? 'yarn' : usePnpm ? 'pnpm' : 'npm'
  const install = useYarn || usePnpm ? 'add' : 'install'
  const devTag = '-D'

  const installDependencies = (
    deps: string[],
    npmStr: string,
    insStr: string,
    devStr?: string,
  ) => {
    console.log(`${npmStr} install dependencies packages: ${deps.join(' ')}.`)
    execa.sync(
      [npmStr, insStr, devStr].concat(deps).filter(Boolean).join(' '),
      {
        encoding: 'utf8',
        cwd,
        env: {
          ...process.env,
        },
        stderr: 'pipe',
        stdout: 'pipe',
      },
    )
    console.log(`install dependencies packages success.`)
  }

  if (dependencies) {
    installDependencies(dependencies, runNpm, install)
  }

  if (devDependencies) {
    installDependencies(devDependencies, runNpm, install, devTag)
  }
}
