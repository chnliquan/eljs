# @eljs/create-template

eljs create-template

## 快速开始

### 1. 安装

```bash
$ npm i @eljs/create-template -S
// or
$ yarn add @eljs/create-template
// or
$ pnpm add @eljs/create-template
```

### 2. 使用

```ts
import create-template from '@eljs/create-template'
```

## API


## 开发

```bash
$ pnpm dev --filter @eljs/create-template
// or
$ pnpm -F '@eljs/create-template' dev
```

## 发布

### 1. [语义化提交 Commit](https://www.conventionalcommits.org/en/v1.0.0/#summary) 

```bash
$ git commit -m 'feat(create-template): add some feature'
$ git commit -m 'fix(create-template): fix some bug'
```

### 2. 编译（可选）

```bash
$ pnpm build --filter @eljs/create-template
// or
$ pnpm -F '@eljs/create-template' build
```

### 3. 执行发包命令

```bash
$ pnpm release

Options:
  --skipTests skip package test
  --skipBuild skip package build
```
