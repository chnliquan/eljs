import type conventionalChangelogCore from 'conventional-changelog-core'

export interface PresetCommit {
  notes: readonly unknown[]
  type?: string
}

export interface WhatBumpResult {
  level: 0 | 1 | 2
  reason: string
}

export interface EljsChangelogPreset {
  parser: conventionalChangelogCore.ParserOptions
  writer: conventionalChangelogCore.WriterOptions
  whatBump(commits: PresetCommit[]): WhatBumpResult
}

export default function createPreset(): Promise<EljsChangelogPreset>
