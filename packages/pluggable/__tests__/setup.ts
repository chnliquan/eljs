import { afterEach, vi, type MockedFunction } from 'vitest'
import type { PluggableOptions, Plugin } from '../src'
import type { PluginTypeEnum } from '../src/plugin/types'

interface MockPluginOptions {
  key?: string
  type?: PluginTypeEnum
  enable?: () => boolean
  apply?: MockedFunction<() => void>
  [key: string]: unknown
}

export const createTempDir = (): string => {
  return `/tmp/test-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`
}

export const createMockPlugin = (
  id: string,
  options: MockPluginOptions = {},
): Plugin => {
  const mockPlugin = {
    id,
    key: options.key || id,
    path: `/mock/path/${id}`,
    type: options.type || 'plugin',
    time: { hooks: {}, hookErrors: {}, register: 0 },
    enable: options.enable ?? (() => true),
    apply: vi.fn(() => options.apply || vi.fn()),
    merge: vi.fn(),
    ...options,
  } as unknown as Plugin
  return mockPlugin
}

export const createMockConfig = (
  overrides: Partial<PluggableOptions> = {},
): PluggableOptions => ({
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
