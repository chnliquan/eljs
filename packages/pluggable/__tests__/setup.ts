import type { PluggableOptions, Plugin } from '../src'
import type { PluginTypeEnum } from '../src/plugin/types'

interface MockPluginOptions {
  key?: string
  type?: PluginTypeEnum
  enable?: () => boolean
  apply?: jest.MockedFunction<() => void>
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
    time: { hooks: {}, register: 0 },
    enable: options.enable || (() => true),
    apply: jest.fn(() => options.apply || jest.fn()),
    merge: jest.fn(),
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
  jest.clearAllMocks()
})
