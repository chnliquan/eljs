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
