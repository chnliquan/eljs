import { mkdir, mkdtemp, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import path from 'node:path'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'

import { getNpmRequestConfig } from '../../src/npm/request-config'

describe('npm 请求配置', () => {
  let temporaryRoot: string
  let previousEnvironment: NodeJS.ProcessEnv

  beforeEach(async () => {
    previousEnvironment = { ...process.env }
    temporaryRoot = await mkdtemp(path.join(tmpdir(), 'eljs-npm-config-'))
    process.env.NPM_CONFIG_USERCONFIG = path.join(
      temporaryRoot,
      'missing-user-npmrc',
    )
    delete process.env.HTTP_PROXY
    delete process.env.HTTPS_PROXY
    delete process.env.NO_PROXY
    delete process.env.http_proxy
    delete process.env.https_proxy
    delete process.env.no_proxy
  })

  afterEach(async () => {
    process.env = previousEnvironment
    await rm(temporaryRoot, { force: true, recursive: true })
  })

  it('应该解析环境变量形式的 registry token 且不泄露给其他主机', async () => {
    const projectPath = path.join(temporaryRoot, 'project', 'packages', 'demo')
    process.env.PRIVATE_NPM_TOKEN = 'private-token'
    await mkdir(projectPath, { recursive: true })
    await writeFile(
      path.join(temporaryRoot, 'project', '.npmrc'),
      '//registry.example.com/private/:_authToken=${PRIVATE_NPM_TOKEN}\n',
    )

    await expect(
      getNpmRequestConfig(
        'https://registry.example.com/private/package',
        projectPath,
      ),
    ).resolves.toEqual({
      headers: { authorization: 'Bearer private-token' },
    })
    await expect(
      getNpmRequestConfig('https://cdn.example.com/package.tgz', projectPath),
    ).resolves.toEqual({})
  })

  it('应该支持 npmrc 的用户名和 base64 密码认证形式', async () => {
    await writeFile(
      path.join(temporaryRoot, '.npmrc'),
      [
        '//registry.example.com/:username=reader',
        `//registry.example.com/:_password=${Buffer.from('secret').toString('base64')}`,
      ].join('\n'),
    )

    const result = await getNpmRequestConfig(
      'https://registry.example.com/package',
      temporaryRoot,
    )

    expect(result.headers).toEqual({
      authorization: `Basic ${Buffer.from('reader:secret').toString('base64')}`,
    })
  })

  it('应该继承代理配置并遵守 no-proxy', async () => {
    await writeFile(
      path.join(temporaryRoot, '.npmrc'),
      [
        'https-proxy=https://proxy.example.com:8443',
        'no-proxy=.internal.example.com',
      ].join('\n'),
    )

    await expect(
      getNpmRequestConfig(
        'https://registry.example.com/package',
        temporaryRoot,
      ),
    ).resolves.toEqual({ proxy: 'https://proxy.example.com:8443' })
    await expect(
      getNpmRequestConfig(
        'https://registry.internal.example.com/package',
        temporaryRoot,
      ),
    ).resolves.toEqual({})
  })
})
