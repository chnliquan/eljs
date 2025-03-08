# @eljs/config

eljs config

## 快速开始

### 1. 安装

```bash
$ pnpm add @eljs/config
// or
$ yarn add @eljs/config
// or
$ npm i @eljs/config -S
```

### 2. 使用

```ts
import config from '@eljs/config'
```

## API


## 开发

```bash
$ pnpm run dev --filter @eljs/config
// or
$ pnpm -F '@eljs/config' run dev
```

## 发布

### 1. [语义化提交 Commit](https://www.conventionalcommits.org/en/v1.0.0/#summary) 

```bash
$ git commit -m 'feat(config): add some feature'
$ git commit -m 'fix(config): fix some bug'
```

### 2. 编译（可选）

```bash
$ pnpm run build --filter @eljs/config
// or
$ pnpm -F '@eljs/config' run build
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
