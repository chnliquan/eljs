import { execSync } from 'child_process'
import fs from 'fs'
import path from 'path'

let _hasPnpm: boolean

export function hasPnpm(): boolean {
  if (_hasPnpm != null) {
    return _hasPnpm
  }

  try {
    execSync('pnpm --version', { stdio: 'ignore' })
    return (_hasPnpm = true)
  } catch (e) {
    return (_hasPnpm = false)
  }
}

function checkPnpm(result: boolean) {
  if (result && !hasPnpm()) {
    throw new Error(`The project seems to require npmp but it's not installed.`)
  }
  return result
}

export function hasProjectPnpm(cwd: string): boolean {
  const lockFile = path.join(cwd, 'pnpm-lock.yaml')
  const result = fs.existsSync(lockFile)

  return checkPnpm(result)
}

let _hasYarn: boolean

export function hasYarn(): boolean {
  if (_hasYarn != null) {
    return _hasYarn
  }

  try {
    execSync('yarn --version', { stdio: 'ignore' })
    return (_hasYarn = true)
  } catch (e) {
    return (_hasYarn = false)
  }
}

function checkYarn(result: boolean) {
  if (result && !hasYarn()) {
    throw new Error(`The project seems to require yarn but it's not installed.`)
  }
  return result
}

export function hasProjectYarn(cwd: string): boolean {
  const lockFile = path.join(cwd, 'yarn.lock')
  const result = fs.existsSync(lockFile)
  return checkYarn(result)
}

let _hasGit: boolean

export function hasGit(): boolean {
  if (_hasGit != null) {
    return _hasGit
  }

  try {
    execSync('git --version', { stdio: 'ignore' })
    return (_hasGit = true)
  } catch (e) {
    return (_hasGit = false)
  }
}

export function hasProjectGit(cwd: string): boolean {
  let result

  try {
    execSync('git status', { stdio: 'ignore', cwd })
    result = true
  } catch (e) {
    result = false
  }

  return result
}

export function hasProjectNpm(cwd: string): boolean {
  const lockFile = path.join(cwd, 'package-lock.json')
  const result = fs.existsSync(lockFile)
  return result
}
