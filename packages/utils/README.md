# @eljs/utils

Collection of nodejs utility.

## Installation

```bash
$ pnpm add @eljs/utils
// or
$ yarn add @eljs/utils
// or
$ npm i @eljs/utils -S
```

## Usage

```ts
import utils from '@eljs/utils'
```

## API

### File

#### `readFile(file: string, encoding?: BufferEncoding): Promise<string>`

Read a single file content asynchronously.

#### `readFileSync(file: string, encoding?: BufferEncoding): string`

Read a single file content synchronously.

#### `readJson<T extends object>(file: string): Promise<T>`

Read a single json file asynchronously.

#### `readJsonSync<T extends object>(file: string): T`

Read a single json file synchronously.

#### `writeFile(file: string, content: string, encoding?: BufferEncoding): Promise<void>`

Write content to a single file asynchronously.

#### `writeFileSync(file: string, content: string, encoding?: BufferEncoding): void`

Write content to a single file synchronously.

#### `safeWriteFile(file: string, content: string, encoding?: BufferEncoding): Promise<void>`

Safe write content to a single file asynchronously.

#### `safeWriteFileSync(file: string, content: string, encoding?: BufferEncoding): void`

Safe write content to a single file synchronously.

#### `writeJsonFile(file: string, content: string): Promise<void>`

Write json to a single file asynchronously.

#### `writeJsonFileSync(file: string, content: string): void`

Write json to a single file synchronously.

#### `safeWriteJson(file: string, content: string): Promise<void>`

Safe write json to a single file asynchronously.

#### `safeWriteJsonSync(file: string, content: string): void`

Safe write json to a single file synchronously.

### `copyFile(from: string, to: string, options?: CopyFileOptions): Promise<void>`

Copy a file asynchronously.

### `copyFileSync(from: string, to: string, options?: CopyFileOptions): void`

Copy a file synchronously.

### `copyTpl(from: string, to: string, data: Record<string, any>, options?: CopyFileOptions): Promise<void>`

Copy a template asynchronously.

### `copyTplSync(from: string, to: string, data: Record<string, any>, options?: CopyFileOptions): void`

Copy a template synchronously.

### `copyDirectory(from: string, to: string, data: Record<string, any>, options: CopyFileOptions): Promise<void>`

Copy a directory asynchronously.

### `copyDirectorySync(from: string, to: string, data: Record<string, any>, options: CopyFileOptions): void`

Copy a directory synchronously.

### `move(from: string, to: string, overwrite?: boolean): Promise<void>`

Move a directory or file asynchronously.

### `moveSync(from: string, to: string, overwrite?: boolean): void`

Move a directory or file synchronously.

### `remove(path: string): Promise<boolean>`

Remove directory or file asynchronously.

### `removeSync(path: string): boolean`

Remove directory or file synchronously.

### `mkdir(path: string, mode?: number | string): Promise<string | void | undefined>`

Create a directory asynchronously.

### `mkdirSync(path: string, mode?: number | string): string | void | undefined`

Create a directory synchronously.

### `tmpdir(random?: boolean): Promise<string>`

### `tmpdir(dirname: string, random?: boolean): Promise<string>`

Create a temporary directory asynchronously.

### `tmpdirSync(random?: boolean): string`

### `tmpdirSync(dirname: string, random?: boolean): string`

Create a temporary directory synchronously.

### `isFile(file: string): Promise<Boolean>`

Whether the path is file asynchronously.

### `isFileSync(file: string): Boolean`

Whether the path is file synchronously.

### `isDirectory(path: string): Promise<Boolean>`

Whether the path is directory asynchronously.

### `isDirectorySync(path: string): Boolean`

Whether the path is directory synchronously.

### `isSymlink(link: string): Promise<Boolean>`

Whether the file is symlink asynchronously.

### `isSymlinkSync(link: string): Boolean`

Whether the file is symlink synchronously.

### `isPathExists(file: string): Promise<Boolean>`

Whether the path is exist asynchronously.

### `isPathExistsSync(file: string): Boolean`

Whether the path is exist synchronously.

### `loadJs<T>(path: string): Promise<T>`

Load js file asynchronously.

### `loadJsSync<T>(path: string): T`

Load js file synchronously.

### `loadTs<T>(path: string): Promise<T>`

Load ts file asynchronously.

### `loadTsSync<T>(path: string): T`

Load ts file synchronously.

### `loadYaml<T>(path: string): Promise<T>`

Load yaml file asynchronously.

### `loadYamlSync<T>(path: string): T`

Load yaml file synchronously.

### `renderTemplate(template: string, data: Record<string, unknown>, options?: RenderTemplateOptions): string`

Render template file.

### Logger

### `logger.log(message: string, tag?: string): void`

### `logger.event(message: string): void`

### `logger.info(message: string): void`

### `logger.warn(message: string): void`

### `logger.error(message: string): void`

### `logger.fatal(message: string): void`

### `logger.wait(message: string): void`

### `logger.ready(message: string): void`

### `logger.printErrorAndExit(message: string): void`

### `logger.step(name: string): (message: string) => void`

### `logger.step(name: string, message: string): void`

Logger in different level。

### `logger.clear(message: string): void`

Clear the stdout.

## ChildProcess

### `parseCommand(command: string): string[]`

Parse string command to arguments.

### `run(command: string, options?: RunCommandOptions): ExecaChildProcess`

### `run(command: string, args: string[], options?: RunCommandOptions): ExecaChildProcess`

### `runCommand(command: string, options?: RunCommandOptions): ExecaChildProcess`

Run shell command.

### `getExecutableCommand(target: string, dirs?: string[]): Promise<string | null>`

Find executable command.

### `normalizeArgs(args?: string | string[]): string[]`

Normalize the command arguments.

### `getPid(command: string): Promise<number | null>`

Get the process id.

### `sudo(options?: SudoOptions): Promise<void>`
### `sudo(args: string[], options?: SudoOptions): Promise<void>`

Execute commands in sudo mode.

## Git

### `downloadGitRepository(url: string, options?: DownloadGitRepositoryOptions): Promise<string>`

Download the git repository.

### `hasGit(): Promise<boolean>`

Whether the git exist globally.

### `hasProjectGit(cwd: string): Promise<boolean>`

Whether the git exist project.

### `isGitClean(options?: RunCommandOptions): Promise<boolean>`

Whether the git working tree is clean.

### `isGitBehindRemote(options?: RunCommandOptions): Promise<boolean>`

Whether the git is behind remote.

### `isGitAheadRemote(options?: RunCommandOptions): Promise<boolean>`

Whether the git is ahead remote.

### `getGitUrl(cwd: string, exact?: boolean): Promise<string>`

Get the git url asynchronously.

### `getGitUrlSync(cwd: string, exact?: boolean): string`

Get the git url synchronously.

### `getGitBranch(options?: RunCommandOptions): Promise<string>`

Get the git branch.

### `getGitUpstreamBranch(options?: RunCommandOptions): Promise<string | null>`

Get the git upstream branch.

### `getGitCommitSha(options?: RunCommandOptions): Promise<string>`

### `getGitCommitSha(short: boolean, options?: RunCommandOptions): Promise<string>`

Get the git commit sha.

### `getGitLatestTag(options?: RunCommandOptions): Promise<string>`

### `getGitLatestTag(match: string, options?: RunCommandOptions): Promise<string>`

### `getGitLatestTag(match: string, args: string[], options?: RunCommandOptions): Promise<string>`

Get the git latest tag.

### `gitUrlAnalysis(url: string): GitRemoteRepository | null`

Analysis the git url to git remote repository.

### `getGitRepository(dir: string, exact?: boolean): Promise<GitRepository | null>`

Get the git repository asynchronously.

### `getGitRepositorySync(dir: string, exact?: boolean): GitRepository | null`

Get the git repository synchronously.

### `getGitUser(): Promise<GitUser>`

Get the git user asynchronously.

### `getGitUserSync(): GitUser`

Get the git user synchronously.

### `getProjectGitDir(dir: string): Promise<string | undefined>`

Get the project git dir asynchronously.

### `getProjectGitDirSync(dir: string): string | undefined`

Get the project git dir synchronously.

### `gitCommit(message: string, options?: RunCommandOptions): Promise<void>`

### `gitCommit(message: string, args: string[], options?: RunCommandOptions): Promise<void>`

Git commit message.

### `gitPush(options?: RunCommandOptions): Promise<void>`

### `gitPush(args: string[], options?: RunCommandOptions): Promise<void>`

Git push to remote.

### `gitTag(tagName: string, options?: RunCommandOptions): Promise<void>`

### `gitTag(tagName: string, args: string[], options?: RunCommandOptions): Promise<void>`

Git tag.

## Npm

### `downloadNpmTarball(url: string, options?: DownloadOptions): Promise<string>`

### `downloadNpmTarball(url: string, dest: string, options?: DownloadOptions): Promise<string>`

Download the npm tarball.

### `installDeps(options?: InstallDepsOptions): Promise<void>`

### `installDeps(packageManager: PackageManager, options?: InstallDepsOptions): Promise<void>`

Install dependencies.

### `getNpmRegistry(options?: RunCommandOptions): Promise<string>`

Get the npm registry.

### `getNpmUser(options?: RunCommandOptions): Promise<string>`

Get the npm user.

### `getNpmPackage(name: string, options?: { cwd?: string registry?: string timeout?: number }): Promise<Omit<NpmPackage, 'version'> | null>`

### `getNpmPackage(name: string, options?: { version: string, cwd?: string registry?: string timeout?: number }): Promise<Omit<NpmPackage, 'version'> | null>`

Get the npm package.

### `getNpmPrefix(): Promise<string>`

Get the npm prefix.

### `pkgNameAnalysis(name: string): ResolvedPkgName`

Analysis the package name.

### `getPackageManager(cwd?: string): Promise<PackageManager>`

Get the package manager.

## Object

### `deepMerge<T1, T2>(a: Partial<T1>, b: Partial<T2>): T1 & T2`

### `deepMerge<T1, T2, T3>(a: Partial<T1>, b: Partial<T2>, b: Partial<T3>): T1 & T2 & T3`

### `deepMerge<T1, T2, T3, T4>(a: Partial<T1>, b: Partial<T2>, c: Partial<T3>, d: Partial<T4>): T1 & T2 & T3 & T4`

### `deepMerge<T1, T2, T3, T4, T5>(a: Partial<T1>, b: Partial<T2>, c: Partial<T3>, d: Partial<T4>, e: Partial<T5>): T1 & T2 & T3 & T4 & T5`

### `deepMerge<T1, T2, T3, T4, T5, T6>(a: Partial<T1>, b: Partial<T2>, c: Partial<T3>, d: Partial<T4>, e: Partial<T5>, f: Partial<T6>): T1 & T2 & T3 & T4 & T5 & T6`

Deep merge objects.

## Path

### `winPath(path: string): string`

Resolve windows path.

### `getWorkspaceRoot(cwd: string): Promise<string>`

Get the workspace root.

### `getWorkspaces(cwd: string, relative = false): Promise<string[]>`

Get the project workspaces.

### `getPnpmWorkspaceRoot(cwd: string): Promise<string>`

Get the workspace root of pnpm.

### `getYarnWorkspaceRoot(cwd: string): Promise<string>`

Get the workspace root of yarn.

### `getLernaWorkspaceRoot(cwd: string): Promise<string>`

Get the workspace root of lerna.

### `getNpmWorkspaceRoot(cwd: string): Promise<string>`

Get the workspace root of npm.

### `getBunWorkspaceRoot(cwd: string): Promise<string>`

Get the workspace root of bun.

### `tryPaths(paths: string[]): Promise<string | undefined>`

Get the existing path asynchronously.

### `tryPathsSync(paths: string[]): Promise<string | undefined>`

Get the existing path synchronously.

### `extractCallDir(stack?: number): string`

Extract the directory where the code is executed.

## Promise

### `new Deferred<T>(): Deferred`

Create a deferred.

#### `deferred.promise: Promise`

Waiting promise.

#### `deferred.resolve: (value: T | PromiseLike<T>) => void`

Resolve the promise.

#### `deferred.reject: (err: unknown) => void`

Reject the promise.

### `retry<T>(fn: () => Promise<T>, retries?: number, delay?: number): Promise<T>`

Retrying a task.

### `retryWithValue<T>(fn: () => MaybePromiseFunction<T>, retries?: number, delay?: number): Promise<T>`

Retrying a task until value is not null.

### `sleep(ms: number): Promise<void>`

Sleep for specified milliseconds.

### `timeout<T>(promise: Promise<T>, ms: number, message?: string): Promise<T> `

Throw error when timeout.

## String

### `camelCase(str: string): string`

Convert to camelCase.

### `pascalCase(str: string): string`

Convert to pascalCase.

### `kebabCase(str: string): string`

Convert to kebabCase.

### `stripBlankLines(str: string): string`

Strip the blank lines.

## Type

### `isPromise(target: unknown): boolean`

Whether the target is promise.

### `isGenerator(target: unknown): boolean`

Whether the target is generator function.

### `isAsyncFunction(target: unknown): boolean`

Whether the target is async function.

### `isESModule(target: unknown): boolean`

Whether the target is es module.
