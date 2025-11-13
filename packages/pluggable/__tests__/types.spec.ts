import type { PluggableOptions, PluginDeclaration } from '../src'
import { ApplyPluginTypeEnum, PluggableStateEnum } from '../src'

describe('类型定义', () => {
  describe('可插拔选项', () => {
    it('应该接受有效的可插拔选项', () => {
      const options: PluggableOptions = {
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
      const options: PluggableOptions = {
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

    it('should accept string array plugin declaration', () => {
      const declaration: PluginDeclaration = ['plugin-name', 'another-plugin']
      expect(declaration).toEqual(['plugin-name', 'another-plugin'])
    })

    it('should accept tuple with options', () => {
      const declaration: PluginDeclaration<{ option: string }> = [
        'plugin-name',
        { option: 'value' },
      ]
      expect(declaration).toEqual(['plugin-name', { option: 'value' }])
    })
  })

  describe('ApplyPluginTypeEnum', () => {
    it('should define all hook types', () => {
      expect(ApplyPluginTypeEnum.Add).toBe('add')
      expect(ApplyPluginTypeEnum.Modify).toBe('modify')
      expect(ApplyPluginTypeEnum.Get).toBe('get')
      expect(ApplyPluginTypeEnum.Event).toBe('event')
    })

    it('should be usable in switch statements', () => {
      const getHookDescription = (type: ApplyPluginTypeEnum): string => {
        switch (type) {
          case ApplyPluginTypeEnum.Add:
            return 'Accumulate values into array'
          case ApplyPluginTypeEnum.Modify:
            return 'Transform initial value'
          case ApplyPluginTypeEnum.Get:
            return 'Return first non-null result'
          case ApplyPluginTypeEnum.Event:
            return 'Execute side effects'
          default:
            return 'Unknown type'
        }
      }

      expect(getHookDescription(ApplyPluginTypeEnum.Add)).toBe(
        'Accumulate values into array',
      )
      expect(getHookDescription(ApplyPluginTypeEnum.Modify)).toBe(
        'Transform initial value',
      )
      expect(getHookDescription(ApplyPluginTypeEnum.Get)).toBe(
        'Return first non-null result',
      )
      expect(getHookDescription(ApplyPluginTypeEnum.Event)).toBe(
        'Execute side effects',
      )
    })
  })

  describe('PluggableStateEnum', () => {
    it('should define all states', () => {
      expect(PluggableStateEnum.Uninitialized).toBe('uninitialized')
      expect(PluggableStateEnum.Init).toBe('init')
      expect(PluggableStateEnum.InitPresets).toBe('initPresets')
      expect(PluggableStateEnum.InitPlugins).toBe('initPlugins')
      expect(PluggableStateEnum.Loaded).toBe('loaded')
    })

    it('should represent state progression', () => {
      const states = [
        PluggableStateEnum.Uninitialized,
        PluggableStateEnum.Init,
        PluggableStateEnum.InitPresets,
        PluggableStateEnum.InitPlugins,
        PluggableStateEnum.Loaded,
      ]

      expect(states).toEqual([
        'uninitialized',
        'init',
        'initPresets',
        'initPlugins',
        'loaded',
      ])
    })
  })
})
