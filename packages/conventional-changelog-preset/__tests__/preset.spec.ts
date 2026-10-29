import { writeChangelogString } from 'conventional-changelog-writer'
import { CommitParser } from 'conventional-commits-parser'
import { describe, expect, it } from 'vitest'

import createPreset, {
  type EljsChangelogPreset,
  type PresetCommit,
  type WhatBumpResult,
} from '../src/index.js'
import type { EljsCommit } from '../src/types.js'

describe('Conventional Changelog preset', () => {
  it.each([
    'feat!: remove legacy API',
    'fix(core)!: remove legacy API',
    'feat: remove legacy API\n\nBREAKING-CHANGE: removed legacy API',
  ])('recognizes breaking changes in %s', async message => {
    const preset = await createPreset()
    const commit = new CommitParser(preset.parser).parse(message)
    expect(commit.notes).not.toHaveLength(0)
    expect(preset.whatBump([commit]).level).toBe(0)
    const changelog = await writeChangelogString<EljsCommit>(
      [commit],
      { version: '2.0.0' },
      preset.writer,
    )
    expect(changelog).toContain('💥 BREAKING CHANGES')
    expect(changelog).toContain('legacy API')
  })

  it('preserves Issue links when rendering user mentions', async () => {
    const preset = await createPreset()
    const commit = new CommitParser(preset.parser).parse(
      'fix(core): resolve #28 for @alice\n\nCloses #28',
    )
    const changelog = await writeChangelogString<EljsCommit>(
      [commit],
      {
        version: '1.0.1',
        host: 'https://github.com',
        owner: 'example',
        repository: 'tool',
        issue: 'issues',
      },
      preset.writer,
    )
    expect(changelog).toContain(
      '[#28](https://github.com/example/tool/issues/28)',
    )
    expect(changelog).toContain('[@alice](https://github.com/alice)')
    expect(changelog.match(/issues\/28/g)).toHaveLength(1)
  })

  it.each<{
    commits: PresetCommit[]
    level: WhatBumpResult['level']
  }>([
    { commits: [], level: 2 },
    { commits: [{ type: 'fix', notes: [] }], level: 2 },
    { commits: [{ type: 'feat', notes: [] }], level: 1 },
    {
      commits: [
        { type: 'feat', notes: [] },
        { type: 'fix', notes: ['removed API'] },
      ],
      level: 0,
    },
    {
      commits: [
        { type: 'fix', notes: ['removed API'] },
        { type: 'feat', notes: [] },
      ],
      level: 0,
    },
  ])('suggests level $level for $commits', async ({ commits, level }) => {
    const preset: EljsChangelogPreset = await createPreset()
    expect(preset.whatBump(commits).level).toBe(level)
  })

  it('parses and renders real commits without mutating parser output', async () => {
    const preset = await createPreset()
    const parser = new CommitParser(preset.parser)
    const commits: EljsCommit[] = [
      parser.parse('feat(core): add presets\n\nCloses #28'),
      parser.parse('fix(*): handle empty config'),
      parser.parse('docs: explain setup'),
      parser.parse('refactor(api): remove legacy mode'),
      parser.parse(
        'build: drop legacy runtime\n\nBREAKING CHANGE: use Node 22',
      ),
    ].map((commit, index) => ({
      ...commit,
      hash: `${index + 1}`.repeat(40),
    }))
    const original = structuredClone(commits)
    const changelog = await writeChangelogString<EljsCommit>(
      commits,
      {
        version: '2.0.0',
        date: '2026-10-29',
        host: 'https://github.com',
        owner: 'example',
        repository: 'tool',
        commit: 'commit',
        issue: 'issues',
        previousTag: 'v1.0.0',
        currentTag: 'v2.0.0',
        linkCompare: true,
      },
      preset.writer,
    )

    expect(changelog).toContain(
      '[2.0.0](https://github.com/example/tool/compare/v1.0.0...v2.0.0)',
    )
    expect(changelog).toContain('✨ Features')
    expect(changelog).toContain('🐛 Bug Fixes')
    expect(changelog).toContain('♻ Code Refactoring')
    expect(changelog).toContain('📦 Build System')
    expect(changelog).toContain('💥 BREAKING CHANGES')
    expect(changelog).toContain('use Node 22')
    expect(changelog).toContain('**core:** add presets')
    expect(changelog).toContain(
      '[1111111](https://github.com/example/tool/commit/',
    )
    expect(changelog).toContain(
      '[#28](https://github.com/example/tool/issues/28)',
    )
    expect(changelog).not.toContain('explain setup')
    expect(changelog).not.toContain('**\\*:**')
    expect(commits).toEqual(original)
    expect(
      preset.whatBump(
        commits.map(commit => ({
          notes: commit.notes,
          type: commit.type ?? undefined,
        })),
      ),
    ).toEqual({
      level: 0,
      reason: 'There is 1 BREAKING CHANGE and 1 features',
    })
  })

  it('removes a commit and its revert from the same release', async () => {
    const preset = await createPreset()
    const parser = new CommitParser(preset.parser)
    const hash = 'a'.repeat(40)
    const commits: EljsCommit[] = [
      {
        ...parser.parse(
          `revert: feat(core): add presets\n\nThis reverts commit ${hash}.`,
        ),
        hash: 'b'.repeat(40),
      },
      { ...parser.parse('feat(core): add presets'), hash },
    ]

    const changelog = await writeChangelogString<EljsCommit>(
      commits,
      { version: '1.0.1', date: '2026-10-29' },
      preset.writer,
    )
    expect(changelog).not.toContain('add presets')
  })
})
