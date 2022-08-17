# @eljs/utils

eljs utils

## 快速开始

### 1. 安装

```bash
$ npm i @eljs/utils -S
// or
$ yarn add @eljs/utils
// or
$ pnpm add @eljs/utils
```

### 2. 使用

```ts
import utils from '@eljs/utils'
```

## API


## 开发

```bash
$ pnpm dev --filter @eljs/utils
// or
$ pnpm -F '@eljs/utils' dev
```

## 发布

### 1. [语义化提交 Commit](https://www.conventionalcommits.org/en/v1.0.0/#summary) 

```bash
$ git commit -m 'feat(utils): add some feature'
$ git commit -m 'fix(utils): fix some bug'
```

### 2. 编译（可选）

```bash
$ pnpm build --filter @eljs/utils
// or
$ pnpm -F '@eljs/utils' build
```

### 3. 执行发包命令

```bash
$ pnpm release

Options:
  --skipTests skip package test
  --skipBuild skip package build
```
