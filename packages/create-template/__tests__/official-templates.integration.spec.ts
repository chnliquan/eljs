import { pathExists, readJson, remove } from '@eljs/utils/file'
import {
  downloadNpmTarball,
  getNpmPackage,
  getNpmRequestConfig,
  parsePackageSpecifier,
} from '@eljs/utils/npm'
import type { PackageJson } from '@eljs/utils/types'
import path from 'node:path'
import { describe, expect, it } from 'vitest'

import { defaultConfig } from '../src/config'

const officialTemplates = Object.values(defaultConfig.templates).flatMap(
  templates => Object.values(templates),
)

describe.runIf(process.env.ELJS_TEST_OFFICIAL_TEMPLATES === '1')(
  'create-template 官方模板发布契约',
  () => {
    it.each(officialTemplates)(
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
  },
)
