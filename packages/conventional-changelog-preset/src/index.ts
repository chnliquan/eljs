import { createParserOpts } from './parser.js'
import type { EljsChangelogPreset } from './types.js'
import { whatBump } from './what-bump.js'
import { createWriterOpts } from './writer.js'

export type {
  EljsChangelogPreset,
  PresetCommit,
  WhatBumpResult,
} from './types.js'

/**
 * 创建用于 Conventional Changelog 与版本推断的预设
 *
 * @returns 独立的解析器、Markdown 写入器与版本推断配置
 * @remarks 保留异步工厂契约，供 `@eljs/release` 与预设加载器使用
 */
export default async function createPreset(): Promise<EljsChangelogPreset> {
  return {
    parser: createParserOpts(),
    writer: await createWriterOpts(),
    whatBump,
  }
}
