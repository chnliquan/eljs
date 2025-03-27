# @eljs/service

@eljs/service

## 快速开始

### 1. 安装

```bash
$ npm i @eljs/service -S
// or
$ yarn add @eljs/service
// or
$ pnpm add @eljs/service
```

### 2. 使用

```ts
import service from '@eljs/service'
```

## 开发

```bash
$ pnpm dev --filter @eljs/service
// or
$ pnpm -F '@eljs/service' dev
```

## 发布

### 1. [语义化提交 Commit](https://www.conventionalcommits.org/en/v1.0.0/#summary)

```bash
$ git commit -m 'feat(service): add some feature'
$ git commit -m 'fix(service): fix some bug'
```

### 2. 编译（可选）

```bash
$ pnpm build --filter @eljs/service
// or
$ pnpm -F '@eljs/service' build
```

### 3. 执行发包命令

```bash
$ pnpm release

Options:
  --skipTests skip package test
  --skipBuild skip package build
```
