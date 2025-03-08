# @eljs/pluggable

eljs pluggable

## 快速开始

### 1. 安装

```bash
$ pnpm add @eljs/pluggable
// or
$ yarn add @eljs/pluggable
// or
$ npm i @eljs/pluggable -S
```

### 2. 使用

```ts
import pluggable from '@eljs/pluggable'
```

## API


## 开发

```bash
$ pnpm run dev --filter @eljs/pluggable
// or
$ pnpm -F '@eljs/pluggable' run dev
```

## 发布

### 1. [语义化提交 Commit](https://www.conventionalcommits.org/en/v1.0.0/#summary) 

```bash
$ git commit -m 'feat(pluggable): add some feature'
$ git commit -m 'fix(pluggable): fix some bug'
```

### 2. 编译（可选）

```bash
$ pnpm run build --filter @eljs/pluggable
// or
$ pnpm -F '@eljs/pluggable' run build
```

### 3. 执行发包命令

```bash
$ pnpm run release

Options:
  --skipTests          跳过单元测试
  --skipBuild          跳过打包
  --skipGitCheck       跳过 git 检查
  --skipRegistryCheck  跳过 npm 仓库检查
  --skipOwnershipCheck 跳过发布权限检查
  --skipSyncCnpm       跳过同步 cnpm
```
