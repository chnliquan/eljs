import type { PluginContext } from '@eljs/plugin-host'

import { releaseHookSchema, type ReleasePluginCapabilities } from '../hooks'

/**
 * release preset 入口接收的上下文
 */
export type ReleasePresetContext = PluginContext<
  typeof releaseHookSchema,
  ReleasePluginCapabilities
>

/**
 * release 插件入口接收的完整上下文
 */
export type ReleasePluginContext = Omit<
  ReleasePresetContext,
  'registerPresets' | 'registerPlugins'
>
