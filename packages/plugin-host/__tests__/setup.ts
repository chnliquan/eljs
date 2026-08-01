import { afterEach, vi, type MockedFunction } from 'vitest'
import type {
  Plugin,
  PluginExecutionMetrics,
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
  metrics?: PluginExecutionMetrics
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
  const metrics: PluginExecutionMetrics = options.metrics || {
    hookDurationsMs: {},
    hookErrorCounts: {},
    initializationDurationMs: 0,
  }

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
    getDiagnostics: vi.fn(() => ({
      id,
      key,
      path: `/mock/path/${id}`,
      type: options.type || 'plugin',
      metrics: {
        initializationDurationMs: metrics.initializationDurationMs,
        initializationFailed: metrics.initializationFailed,
        hookDurationsMs: Object.fromEntries(
          Object.entries(metrics.hookDurationsMs).map(([hookKey, samples]) => [
            hookKey,
            [...samples],
          ]),
        ),
        hookErrorCounts: { ...metrics.hookErrorCounts },
      },
    })),
    getMetadata: vi.fn(() => ({
      id,
      key,
      path: `/mock/path/${id}`,
      type: options.type || 'plugin',
    })),
    loadInitializer: vi.fn(async () => options.initializer || vi.fn()),
    recordHookExecution: vi.fn(
      (
        hookKey: string,
        duration: number,
        failed: boolean,
        sampleLimit: number,
      ) => {
        const samples = (metrics.hookDurationsMs[hookKey] ||= [])
        samples.push(duration)
        if (samples.length > sampleLimit) {
          samples.splice(0, samples.length - sampleLimit)
        }
        if (failed) {
          metrics.hookErrorCounts[hookKey] =
            (metrics.hookErrorCounts[hookKey] || 0) + 1
        }
      },
    ),
    recordInitialization: vi.fn((duration: number, failed: boolean) => {
      metrics.initializationDurationMs = duration
      metrics.initializationFailed = failed || undefined
    }),
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
