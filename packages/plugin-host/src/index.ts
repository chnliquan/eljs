export type { StandardSchemaV1 } from '@standard-schema/spec'
export { PluginHost, type PluginContext } from './core/plugin-host'
export {
  HookKind,
  PluginHostState,
  type LooseHookRunOptions,
  type PluginDeclaration,
  type PluginHostOptions,
  type PluginOrigin,
  type ResolvedPlugin,
  type UserConfig,
} from './core/types'
export {
  PluginHostError,
  PluginHostErrorCode,
  type PluginHostErrorOptions,
} from './errors'
export {
  definePlugin,
  definePreset,
  type InferInitializerOptionsInput,
  type InferInitializerOptionsOutput,
  type InitializerWithOptionsSchema,
  type PluginDefinition,
  type PresetDefinition,
} from './plugin/define'
export { Hook, type HookOptions } from './plugin/hook'
export {
  defineAddHook,
  defineEventHook,
  defineGetHook,
  defineHooks,
  defineModifyHook,
  type HookArgs,
  type HookDefinition,
  type HookRegistration,
  type HookRegistrationApi,
  type HookRegistrationOptions,
  type HookRunArguments,
  type HookRunOptions,
  type HookRunResult,
  type HookSchema,
  type HookValue,
  type LooseHookSchema,
} from './plugin/hook-schema'
export { Plugin } from './plugin/plugin'
export { PluginApi } from './plugin/plugin-api'
export {
  PluginKind,
  type PluginDiagnostics,
  type PluginExecutionMetrics,
  type PluginHookEnablement,
  type PluginInitializationResult,
  type PluginInitializer,
  type PluginMetadata,
  type PluginOptions,
  type PluginType,
} from './plugin/types'
