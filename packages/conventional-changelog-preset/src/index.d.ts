import {
  ParserOptions,
  WhatBumpFunction,
  WriterOptions,
} from 'conventional-changelog-core'

export default function createPreset(): Promise<{
  parser: ParserOptions
  writer: Promise<WriterOptions>
  whatBump: WhatBumpFunction
}>

declare function createParserOpts(): ParserOptions

declare function createWriterOpts(): Promise<WriterOptions>

declare function whatBump(
  commits: any[],
): Promise<{ level: number; reason: string }>
