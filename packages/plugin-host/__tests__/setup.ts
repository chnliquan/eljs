import { afterEach, vi, type MockedFunction } from 'vitest'
import type {
  Plugin,
  PluginHookEnablement,
  PluginHostOptions,
  PluginInitializer,
  PluginType,
} from '../src'
import type { PluginKind } from '../src/plugin/types'

export interface MockPluginOptions {
  key?: string
  type?: PluginKind
  enable?: PluginHookEnablement
  initializer?: MockedFunction<PluginInitializer> | PluginInitializer
  [key: string]: unknown
}

export const createTempDir = (): string => {
  return `/tmp/test-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`
}

export const createMockPlugin = (
  id: string,
  options: MockPluginOptions = {},
): Plugin => {
  let key = options.key || id
  let enable = options.enable ?? true

  const mockPlugin = {
    constructorOptions: {
      cwd: '/mock',
      path: `/mock/path/${id}`,
      type: (options.type || 'plugin') as PluginType,
    },
    id,
    get key() {
      return key
    },
    path: `/mock/path/${id}`,
    type: options.type || 'plugin',
    get enable() {
      return enable
    },
    configure: vi.fn(
      (configuration: { key?: string; enable?: PluginHookEnablement }) => {
        key = configuration.key || key
        enable =
          configuration.enable === undefined ? enable : configuration.enable
      },
    ),
    getMetadata: vi.fn(() => ({
      id,
      key,
      path: `/mock/path/${id}`,
      type: options.type || 'plugin',
    })),
    loadInitializer: vi.fn(async () => options.initializer || vi.fn()),
  } as unknown as Plugin
  return mockPlugin
}

export const createMockConfig = (
  overrides: Partial<PluginHostOptions> = {},
): PluginHostOptions => ({
  cwd: createTempDir(),
  presets: [],
  plugins: [],
  defaultConfigFiles: ['config.js'],
  ...overrides,
})

// Cleanup after tests
afterEach(() => {
  vi.clearAllMocks()
})
