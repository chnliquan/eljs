import type {
  CommitKnownProps,
  FinalTemplateContext,
  TransformedCommit,
} from '@conventional-changelog/template'
import type { Options as WriterOptions } from 'conventional-changelog-writer'
import type { ParserStreamOptions } from 'conventional-commits-parser'

/**
 * 版本推断所需的提交信息
 *
 * @remarks 非空的 `notes` 表示破坏性变更，优先于 `feat` 的次版本提升
 */
export interface PresetCommit {
  notes: readonly unknown[]
  type?: string
}

/**
 * 版本提升建议与变更数量说明
 *
 * @remarks `level` 的 0、1、2 分别表示主版本、次版本和补丁版本
 */
export interface WhatBumpResult {
  level: 0 | 1 | 2
  reason: string
}

/**
 * 可传入 Conventional Changelog 的完整预设
 *
 * @remarks 写入器按提交类型分组，版本推断使用未经展示转换的原始提交
 */
export interface EljsChangelogPreset {
  parser: ParserStreamOptions
  writer: WriterOptions
  whatBump(commits: PresetCommit[]): WhatBumpResult
}

/**
 * 解析器与写入器之间共享的提交结构，额外字段用于作用域展示与短哈希链接
 *
 * @internal
 */
export interface EljsCommit extends CommitKnownProps {
  scope?: string | null
  subject?: string | null
  shortHash?: string | null
}

/**
 * 上游写入器完成分组并注入渲染函数后的模板上下文
 *
 * @internal
 */
export type EljsContext = FinalTemplateContext<EljsCommit>

/**
 * 上游写入器转换后传给提交模板的数据，可能保留原始提交
 *
 * @internal
 */
export type EljsTransformedCommit = TransformedCommit<EljsCommit>
