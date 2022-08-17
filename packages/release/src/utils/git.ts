import { exec } from './cp'

export async function getStatus(): Promise<string> {
  const status = await exec('git status --porcelain')
  return status
}

export async function getBranchName(): Promise<string> {
  const branch = await exec('git rev-parse --abbrev-ref HEAD')
  return branch.replace(/\n|\r|\t/, '')
}
