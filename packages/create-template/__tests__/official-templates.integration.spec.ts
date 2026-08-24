import { pathExists, readJson, remove } from '@eljs/utils/file'
import {
  downloadNpmTarball,
  getNpmPackage,
  getNpmRequestConfig,
  parsePackageSpecifier,
} from '@eljs/utils/npm'
import type { PackageJson } from '@eljs/utils/types'
import { mkdtemp } from 'node:fs/promises'
import { createRequire } from 'node:module'
import { tmpdir } from 'node:os'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'

import { CreateTemplate } from '../src/create'
import {
  officialTemplates,
  type OfficialTemplateName,
} from '../src/official-templates'

interface InjectablePrompts {
  inject(answers: readonly unknown[]): void
}

const localRequire = createRequire(import.meta.url)
const utilsRoot = fileURLToPath(new URL('../../utils', import.meta.url))
const promptsPath = localRequire.resolve('prompts', { paths: [utilsRoot] })
const injectablePrompts = localRequire(promptsPath) as InjectablePrompts

describe.runIf(process.env.ELJS_TEST_OFFICIAL_TEMPLATES === '1')(
  'create-template 官方模板发布契约',
  () => {
    it.each(Object.values(officialTemplates))(
      '$value 包含当前创建器需要的入口文件',
      async template => {
        const { name, version } = parsePackageSpecifier(template.value)
        expect(version).toBeTypeOf('string')
        if (!version) {
          throw new Error(`${template.value} must use an exact version`)
        }

        const metadata = await getNpmPackage(name, {
          registry: template.registry,
          version,
        })
        expect(metadata).not.toBeNull()
        if (!metadata) {
          throw new Error(`${template.value} is not published`)
        }
        expect(metadata.dist.integrity).toBe(template.integrity)

        const requestConfig = await getNpmRequestConfig(metadata.dist.tarball)
        let templateRoot = ''

        try {
          templateRoot = await downloadNpmTarball(metadata.dist.tarball, {
            ...requestConfig,
            integrity: template.integrity,
          })
          const packageJson = await readJson<PackageJson>(
            path.join(templateRoot, 'package.json'),
          )
          const hasConfig = await Promise.all([
            pathExists(path.join(templateRoot, 'create.config.ts')),
            pathExists(path.join(templateRoot, 'create.config.js')),
            pathExists(path.join(templateRoot, 'generators/index.ts')),
            pathExists(path.join(templateRoot, 'generators/index.js')),
          ])

          expect(packageJson).toMatchObject({ name, version })
          expect(hasConfig).toContain(true)
        } finally {
          if (templateRoot) {
            await remove(templateRoot)
          }
        }
      },
      120_000,
    )

    it.each(Object.keys(officialTemplates) as OfficialTemplateName[])(
      '%s 可以完成真实项目生成',
      async template => {
        const cwd = await mkdtemp(
          path.join(tmpdir(), 'eljs-official-template-'),
        )
        const projectName = 'contract-project'
        const previousNpmCache = process.env.NPM_CONFIG_CACHE
        process.env.NPM_CONFIG_CACHE = path.join(cwd, '.npm-cache')

        try {
          injectablePrompts.inject(['monorepo'])
          await new CreateTemplate({
            cwd,
            defaultQuestions: false,
            gitInit: false,
            install: false,
            template,
          }).run(projectName)

          await expect(
            pathExists(path.join(cwd, projectName, 'package.json')),
          ).resolves.toBe(true)
        } finally {
          if (previousNpmCache === undefined) {
            delete process.env.NPM_CONFIG_CACHE
          } else {
            process.env.NPM_CONFIG_CACHE = previousNpmCache
          }
          await remove(cwd)
        }
      },
      120_000,
    )
  },
)
