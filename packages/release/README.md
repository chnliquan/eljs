# @eljs/release

eljs release

## 快速开始

### 1. 安装

```bash
$ npm i @eljs/release -D
// or
$ yarn add @eljs/release -D
// or
$ pnpm add @eljs/release -D
```

### 2. 使用

```diff
"scripts": {
++  "release: "release"
}
```

### 3. 命令行参数

```bash
Usage: release [options] [version]

Arguments:
  version                                Target release version.

Options:
  -v, --version                          Output the current version.
  --verbose                              Whether display verbose message.
  --dry                                  Instead of executing, display details about the affected packages that would be publish.
  --latest                               Whether generate latest changelog.
  --ownership-checks                     Check the npm ownership.
  --sync-cnpm                            Whether sync to cnpm when publish done.
  --no-confirm                           No confirm the bump version.
  --no-git-checks                        No check the git status and remote.
  --no-registry-checks                   No check the package registry.
  --no-github-release                    No release to github when publish down.
  --tag <tag>                            Npm publish tag.
  --repo-type <repo-type>                Publish type, github or gitlab.
  --repo-url <repo-url>                  Github repo url to release.
  --changelog-preset <changelog-preset>  Customize conventional changelog preset.
  -h, --help                             display help for command
```

## API

## 开发

```bash
$ pnpm dev --filter @eljs/release
// or
$ pnpm -F '@eljs/release' dev
```

## 发布

### 1. [语义化提交 Commit](https://www.conventionalcommits.org/en/v1.0.0/#summary)

```bash
$ git commit -m 'feat(release): add some feature'
$ git commit -m 'fix(release): fix some bug'
```

### 2. 编译（可选）

```bash
$ pnpm build --filter @eljs/release
// or
$ pnpm -F '@eljs/release' build
```

### 3. 执行发包命令

```bash
$ pnpm release

Options:
  --skipTests skip package test
  --skipBuild skip package build
```
