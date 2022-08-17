# @eljs/release

eljs release

## 快速开始

1. 安装

```bash
$ npm i @eljs/release -S
// or
$ yarn add @eljs/release
// or
$ pnpm add @eljs/release
```

2. 使用

```ts
import release from '@eljs/release'
```

## API


## 开发

```bash
// dev
$ pnpm -F '@eljs/release' dev
// build
$ pnpm -F '@eljs/release' build
```

> 在根路径下执行

## 发布

1. [语义化提交 Commit](https://www.conventionalcommits.org/en/v1.0.0/#summary) 

```bash
$ git commit -m 'feat(release): add some feature'
$ git commit -m 'fix(release): fix some bug'
```

2. 执行发包命令

```bash
$ pnpm release

Options:
  --skipTests skip package test
  --skipBuild skip package build
```

> 在根路径下执行
