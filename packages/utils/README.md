# @eljs/utils

A comprehensive collection of Node.js utilities for modern development workflows

[![NPM Version](https://img.shields.io/npm/v/@eljs/utils.svg)](https://www.npmjs.com/package/@eljs/utils)
[![NPM Downloads](https://img.shields.io/npm/dm/@eljs/utils.svg)](https://www.npmjs.com/package/@eljs/utils)
[![License](https://img.shields.io/npm/l/@eljs/utils.svg)](https://github.com/chnliquan/eljs/blob/master/LICENSE)

## ✨ Features

- 🔄 **Cross-Platform** - Consistent behavior across different operating systems with platform-aware path handling
- 🔗 **Dual API Design** - Both async and sync versions for maximum flexibility in different scenarios
- 🎯 **Comprehensive Toolkit** - All-in-one collection covering file ops, git, npm, logging, and more
- 🔒 **Type Safety** - Full TypeScript support with proper generics and runtime type guards

## 📦 Installation

```bash
# Using pnpm (recommended)
pnpm add @eljs/utils

# Using yarn
yarn add @eljs/utils

# Using npm
npm install @eljs/utils -S
```

## 🚀 Quick Start

### Basic Import

```typescript
import utils from '@eljs/utils'

// Or import specific modules
import { readFile, logger, run } from '@eljs/utils'
```

### Common Use Cases

```typescript
// File operations
const config = await utils.readJson('./config.json')
await utils.writeFile('./output.txt', 'Hello World')

// Git operations
const branch = await utils.getGitBranch()
const isClean = await utils.isGitClean()

// Process execution
const result = await utils.run('npm install')

// Logging
utils.logger.info('Starting build process')
utils.logger.success('Build completed')
```

## 📖 API Reference

### 🗂️ File System Operations

#### File Reading

```typescript
// Read text files
const content = await readFile('./config.txt')
const contentSync = readFileSync('./config.txt')

// Read JSON files with type safety
interface Config {
  port: number
  host: string
}

const config = await readJson<Config>('./config.json')
const configSync = readJsonSync<Config>('./config.json')
```

#### File Writing

```typescript
// Write text files
await writeFile('./output.txt', 'Hello World')
writeFileSync('./output.txt', 'Hello World')

// Safe writing (creates directories if needed)
await safeWriteFile('./deep/path/file.txt', 'content')

// Write JSON files
await writeJsonFile('./data.json', { key: 'value' })
await safe'./path/data.json', { key: 'value' })
```

#### File Operations

```typescript
// Copy files and directories
await copyFile('./source.txt', './destination.txt')
await copyDirectory('./src', './dist', {}, { overwrite: true })

// Template copying with data interpolation
await copyTpl('./template.ejs', './output.html', {
  title: 'My App',
  version: '1.0.0'
})

// Move and remove operations
await move('./old-path', './new-path')
await remove('./unwanted-file')

// Directory operations
await mkdir('./new-directory')
const tmpDir = await tmpdir() // Creates temporary directory
```

#### Path Checking

```typescript
// Check path types
const isFileResult = await isFile('./path')
const isDirResult = await isDirectory('./path')
const isLinkResult = await isSymlink('./path')
const existsResult = await isPathExists('./path')
```

#### Dynamic Module Loading

```typescript
// Load different file types
const jsModule = await loadJs<MyModule>('./module.js')
const tsModule = await loadTs<MyModule>('./module.ts')
const yamlData = await loadYaml<ConfigType>('./config.yaml')
```

### 📝 Logger

#### Basic Logging

```typescript
import { logger } from '@eljs/utils'

// Different log levels
logger.log('General message')
logger.info('Information message')
logger.warn('Warning message')
logger.error('Error message')
logger.fatal('Fatal error message')

// Special purpose logging
logger.event('User logged in')
logger.wait('Processing...')
logger.ready('Server is ready')

// Step-based logging
const step = logger.step('Build')
step('Compiling TypeScript...')
step('Bundling assets...')

// Or one-liner
logger.step('Deploy', 'Uploading to server...')
```

#### Advanced Logger Usage

```typescript
// Clear console output
logger.clear('Starting fresh...')

// Error handling with exit
logger.printErrorAndExit('Critical error occurred')

// Example: Build process logging
class BuildService {
  async build() {
    const buildStep = logger.step('Build Process')
    
    try {
      buildStep('Installing dependencies...')
      await utils.run('npm install')
      
      buildStep('Compiling TypeScript...')
      await utils.run('tsc')
      
      buildStep('Running tests...')
      await utils.run('npm test')
      
      logger.ready('Build completed successfully!')
    } catch (error) {
      logger.error(`Build failed: ${error.message}`)
      throw error
    }
  }
}
```

### ⚡ Process Management

#### Command Execution

```typescript
// Simple command execution
const result = await run('git status')
const npmList = await run('npm', ['list', '--depth=0'])

// With options
const output = await runCommand('ls -la', {
  cwd: './my-directory',
  env: { NODE_ENV: 'production' }
})

// Parse command strings
const args = parseCommand('npm run build --production')
// Returns: ['npm', 'run', 'build', '--production']
```

#### Process Utilities

```typescript
// Find executable commands
const gitPath = await getExecutableCommand('git')
const nodePath = await getExecutableCommand('node', ['/usr/bin', '/usr/local/bin'])

// Get process information
const pid = await getPid('node server.js')

// Execute with sudo
await sudo(['npm', 'install', '-g', 'typescript'])
```

#### Real-World Example

```typescript
class DeploymentService {
  async deploy() {
    logger.info('Starting deployment...')
    
    // Check if git is clean
    if (!(await utils.isGitClean())) {
      throw new Error('Git working tree is not clean')
    }
    
    // Build the project
    await utils.run('npm run build')
    
    // Deploy to server
    await utils.run('rsync -av dist/ user@server:/var/www/')
    
    logger.ready('Deployment completed!')
  }
}
```

### 🌿 Git Integration

#### Repository Information

```typescript
// Get repository details
const repo = await getGitRepository('./my-project')
const url = await getGitUrl('./my-project')
const branch = await getGitBranch()
const commit = await getGitCommitSha()
const tag = await getGitLatestTag()

// Check repository status
const isClean = await isGitClean()
const isBehind = await isGitBehindRemote()
const isAhead = await isGitAheadRemote()
```

#### Git Operations

```typescript
// Commit and push
await gitCommit('feat: add new feature')
await gitCommit('fix: bug fix', ['--amend'])
await gitPush()
await gitTag('v1.0.0')

// Download repositories
const tempPath = await downloadGitRepository(
  'https://github.com/user/repo.git',
  { branch: 'main', depth: 1 }
)
```

#### Git Analysis

```typescript
// Parse git URLs
const repoInfo = gitUrlAnalysis('https://github.com/user/repo.git')
// Returns: { host: 'github.com', owner: 'user', name: 'repo' }

// Get git user information
const user = await getGitUser()
// Returns: { name: 'John Doe', email: 'john@example.com' }
```

#### Example: Release Automation

```typescript
class ReleaseService {
  async release(version: string) {
    // Validate git status
    if (!(await utils.isGitClean())) {
      throw new Error('Working tree is not clean')
    }
    
    // Update version and build
    await utils.run(`npm version ${version}`)
    await utils.run('npm run build')
    
    // Commit and tag
    await utils.gitCommit(`chore: release v${version}`)
    await utils.gitTag(`v${version}`)
    
    // Push to remote
    await utils.gitPush(['--follow-tags'])
    
    logger.ready(`Release v${version} completed!`)
  }
}
```

### 📦 Package Management

#### NPM Operations

```typescript
// Get registry and user information
const registry = await getNpmRegistry()
const user = await getNpmUser()
const prefix = await getNpmPrefix()

// Package information
const packageInfo = await getNpmPackage('@eljs/utils')
const specificVersion = await getNpmPackage('@eljs/utils', { version: '1.0.0' })

// Download packages
const tarballPath = await downloadNpmTarball(
  'https://registry.npmjs.org/@eljs/utils/-/utils-1.0.0.tgz',
  './downloads'
)
```

#### Package Manager Detection

```typescript
// Auto-detect package manager
const packageManager = await getPackageManager()
// Returns: 'npm' | 'yarn' | 'pnpm' | 'bun'

// Install dependencies with detected package manager
await installDeps()
await installDeps('pnpm', { production: true })
```

#### Package Name Analysis

```typescript
// Parse package names
const parsed = pkgNameAnalysis('@scope/package-name')
// Returns: { scope: 'scope', name: 'package-name', fullName: '@scope/package-name' }
```

#### Example: Dependency Management

```typescript
class DependencyService {
  async updateDependencies() {
    const packageManager = await utils.getPackageManager()
    
    logger.info(`Using ${packageManager} to update dependencies...`)
    
    switch (packageManager) {
      case 'pnpm':
        await utils.run('pnpm update')
        break
      case 'yarn':
        await utils.run('yarn upgrade')
        break
      default:
        await utils.run('npm update')
    }
    
    logger.ready('Dependencies updated successfully!')
  }
}
```

### 🔗 Object Utilities

#### Deep Merging

```typescript
// Merge objects deeply
const config = deepMerge(
  { server: { port: 3000 } },
  { server: { host: 'localhost' }, database: { url: 'mongodb://...' } }
)
// Result: { server: { port: 3000, host: 'localhost' }, database: { url: 'mongodb://...' } }

// Multiple object merging
const result = deepMerge(obj1, obj2, obj3, obj4, obj5, obj6)
```

#### Usage Example

```typescript
interface Config {
  server: { host: string; port: number; ssl?: boolean }
  database: { url: string; poolSize?: number }
}

const defaultConfig: Config = {
  server: { host: 'localhost', port: 3000 },
  database: { url: 'mongodb://localhost', poolSize: 10 }
}

const userConfig = await utils.readJson<Partial<Config>>('./config.json')
const finalConfig = utils.deepMerge(defaultConfig, userConfig)
```

### 📍 Path Resolution

#### Workspace Detection

```typescript
// Find workspace root
const workspaceRoot = await getWorkspaceRoot(process.cwd())
const workspaces = await getWorkspaces('./monorepo-root')

// Package manager specific detection
const pnpmRoot = await getPnpmWorkspaceRoot('./project')
const yarnRoot = await getYarnWorkspaceRoot('./project')
const lernaRoot = await getLernaWorkspaceRoot('./project')
```

#### Path Utilities

```typescript
// Convert Windows paths
const normalizedPath = winPath('C:\\Users\\Documents\\file.txt')
// Returns: 'C:/Users/Documents/file.txt'

// Find existing paths
const configPath = await tryPaths([
  './config.json',
  './config.js',
  './config.yaml'
])

// Extract call directory
const callerDir = extractCallDir() // Gets directory where function is called
```

### ⏳ Promise Helpers

#### Deferred Promises

```typescript
// Create deferred promise
const deferred = new Deferred<string>()

// Use in async operations
setTimeout(() => {
  deferred.resolve('Operation completed')
}, 1000)

const result = await deferred.promise
```

#### Retry Logic

```typescript
// Retry failed operations
const data = await retry(async () => {
  const response = await fetch('/api/data')
  if (!response.ok) throw new Error('Request failed')
  return response.json()
}, 3, 1000) // 3 retries with 1000ms delay

// Retry until non-null value
const config = await retryWithValue(async () => {
  return await loadConfig() // Returns null on failure
}, 5, 500)
```

#### Timing Utilities

```typescript
// Sleep/delay
await sleep(2000) // Wait 2 seconds

// Timeout wrapper
const result = await timeout(
  slowOperation(),
  5000,
  'Operation timed out after 5 seconds'
)
```

### 🔤 String Manipulation

#### Case Conversion

```typescript
// Different case formats
const camel = camelCase('hello-world-example')     // 'helloWorldExample'
const pascal = pascalCase('hello-world-example')   // 'HelloWorldExample'
const kebab = kebabCase('helloWorldExample')       // 'hello-world-example'

// Text processing
const cleanText = stripBlankLines(`
  Line 1
  
  
  Line 2
  
  Line 3
`) // Removes empty lines
```

### 🔍 Type Guards

#### Runtime Type Checking

```typescript
// Type validation
const isPromiseResult = isPromise(someValue)
const isGeneratorResult = isGenerator(someFunction)
const isAsyncResult = isAsyncFunction(someFunction)
const isESModuleResult = isESModule(someModule)
```

#### Practical Usage

```typescript
async function handleValue(value: unknown) {
  if (utils.isPromise(value)) {
    return await value
  }
  
  if (utils.isAsyncFunction(value)) {
    return await value()
  }
  
  return value
}
```
