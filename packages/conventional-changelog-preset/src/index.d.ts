import type { Options as WriterOptions } from 'conventional-changelog-writer'
import type { ParserStreamOptions } from 'conventional-commits-parser'

export interface PresetCommit {
  notes: readonly unknown[]
  type?: string
}

export interface WhatBumpResult {
  level: 0 | 1 | 2
  reason: string
}

export interface EljsChangelogPreset {
  parser: ParserStreamOptions
  writer: WriterOptions
  whatBump(commits: PresetCommit[]): WhatBumpResult
}

export default function createPreset(): Promise<EljsChangelogPreset>
