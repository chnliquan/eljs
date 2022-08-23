# @eljs/generate

eljs generate

## 快速开始

### 1. 安装

```bash
$ npm i @eljs/generate -S
// or
$ yarn add @eljs/generate
// or
$ pnpm add @eljs/generate
```

### 2. 使用

```ts
import generate from '@eljs/generate'
```

## API


## 开发

```bash
$ pnpm dev --filter @eljs/generate
// or
$ pnpm -F '@eljs/generate' dev
```

## 发布

### 1. [语义化提交 Commit](https://www.conventionalcommits.org/en/v1.0.0/#summary) 

```bash
$ git commit -m 'feat(generate): add some feature'
$ git commit -m 'fix(generate): fix some bug'
```

### 2. 编译（可选）

```bash
$ pnpm build --filter @eljs/generate
// or
$ pnpm -F '@eljs/generate' build
```

### 3. 执行发包命令

```bash
$ pnpm release

Options:
  --skipTests skip package test
  --skipBuild skip package build
```
