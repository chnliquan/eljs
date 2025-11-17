// Jest setup file - replaces the deprecated globals configuration
// https://jestjs.io/docs/configuration
const packageJson = require('./package.json')

global.__DEV__ = true
global.__TEST__ = true
global.__VERSION__ = packageJson.version
global.__GLOBAL__ = false
global.__ESM__ = true
global.__NODE_JS__ = true

jest.setTimeout(10000)

// 全局模拟 process.exit 以防止测试过程中意外退出
const originalExit = process.exit
process.exit = jest.fn(code => {
  if (process.env.ALLOW_PROCESS_EXIT === 'true') {
    return originalExit.call(process, code)
  }
  // 在测试中不实际退出，只记录调用
  return undefined
})
