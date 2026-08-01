import { describe, expect, it } from 'vitest'
import type { PluginDeclaration, PluginHostOptions } from '../src'
import { HookKind, PluginHostState } from '../src'

describe('类型定义', () => {
  describe('插件宿主选项', () => {
    it('应该接受有效的插件宿主选项', () => {
      const options: PluginHostOptions = {
        cwd: '/test/cwd',
        presets: ['preset1'],
        plugins: ['plugin1', ['plugin2', { option: 'value' }]],
        defaultConfigFiles: ['config.js', 'config.ts'],
        defaultConfigExts: ['dev', 'prod'],
      }

      expect(options.cwd).toBe('/test/cwd')
      expect(options.presets).toEqual(['preset1'])
      expect(options.plugins).toEqual([
        'plugin1',
        ['plugin2', { option: 'value' }],
      ])
      expect(options.defaultConfigFiles).toEqual(['config.js', 'config.ts'])
      expect(options.defaultConfigExts).toEqual(['dev', 'prod'])
    })

    it('应该处理最小选项', () => {
      const options: PluginHostOptions = {
        cwd: '/test/cwd',
      }

      expect(options.cwd).toBe('/test/cwd')
      expect(options.presets).toBeUndefined()
      expect(options.plugins).toBeUndefined()
    })
  })

  describe('PluginDeclaration', () => {
    it('should accept string plugin declaration', () => {
      const declaration: PluginDeclaration = 'plugin-name'
      expect(declaration).toBe('plugin-name')
    })

    it('should accept tuple with options', () => {
      const declaration: PluginDeclaration<{ option: string }> = [
        'plugin-name',
        { option: 'value' },
      ]
      expect(declaration).toEqual(['plugin-name', { option: 'value' }])
    })

    it('should reject an array of multiple plugin names', () => {
      // @ts-expect-error PluginDeclaration 只接受插件名或 [插件名, 参数]
      const declaration: PluginDeclaration = ['plugin-name', 'another-plugin']

      expect(declaration).toEqual(['plugin-name', 'another-plugin'])
    })
  })

  describe('HookKind', () => {
    it('should define all hook types', () => {
      expect(HookKind.Add).toBe('add')
      expect(HookKind.Modify).toBe('modify')
      expect(HookKind.Get).toBe('get')
      expect(HookKind.Event).toBe('event')
    })

    it('should be usable in switch statements', () => {
      const getHookDescription = (kind: HookKind): string => {
        switch (kind) {
          case HookKind.Add:
            return 'Accumulate values into array'
          case HookKind.Modify:
            return 'Transform initial value'
          case HookKind.Get:
            return 'Return first non-nullish result'
          case HookKind.Event:
            return 'Execute side effects'
          default:
            return 'Unknown type'
        }
      }

      expect(getHookDescription(HookKind.Add)).toBe(
        'Accumulate values into array',
      )
      expect(getHookDescription(HookKind.Modify)).toBe(
        'Transform initial value',
      )
      expect(getHookDescription(HookKind.Get)).toBe(
        'Return first non-nullish result',
      )
      expect(getHookDescription(HookKind.Event)).toBe('Execute side effects')
    })
  })

  describe('PluginHostState', () => {
    it('should define all states', () => {
      expect(PluginHostState.Uninitialized).toBe('uninitialized')
      expect(PluginHostState.LoadingConfig).toBe('loadingConfig')
      expect(PluginHostState.LoadingPresets).toBe('loadingPresets')
      expect(PluginHostState.LoadingPlugins).toBe('loadingPlugins')
      expect(PluginHostState.Ready).toBe('ready')
      expect(PluginHostState.Failed).toBe('failed')
    })

    it('should represent state progression', () => {
      const states = [
        PluginHostState.Uninitialized,
        PluginHostState.LoadingConfig,
        PluginHostState.LoadingPresets,
        PluginHostState.LoadingPlugins,
        PluginHostState.Ready,
        PluginHostState.Failed,
      ]

      expect(states).toEqual([
        'uninitialized',
        'loadingConfig',
        'loadingPresets',
        'loadingPlugins',
        'ready',
        'failed',
      ])
    })
  })
})
