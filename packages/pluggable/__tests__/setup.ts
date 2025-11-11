/* eslint-disable @typescript-eslint/no-explicit-any */

// Simple setup file without complex mocks
export const createTempDir = (): string => {
  return `/tmp/test-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`
}

export const createMockPlugin = (id: string, options: any = {}) => {
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
  }
  return mockPlugin
}

export const createMockConfig = (overrides: any = {}) => ({
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
