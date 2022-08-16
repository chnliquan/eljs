# eljs

nodejs cli &amp; utility monorepo

# 开发

## 1. 克隆仓库

```bash
$ git clone git@github.com:chnliquan/eljs.git
```

## 2. 安装依赖

```bash
$ pnpm i
```

> 项目使用 pnpm 做包管理，由于 KDev 流水线支持 pnpm 的最低 Node 版本是 16.13.1，建议项目使用的 Node 版本 >= 16.13.1 < 17

## 3. 创建子包（可选）

```bash
$ cd packages
$ mkdir <sub-package-name>
$ pnpm boot
```

# 脚本

## 1. boot

初始化子包的项目结构

```bash
// 1. 在 packages 下创建一个文件夹
$ cd packages && mkdir core

// 2. 在项目根目录下执行
$ pnpm boot
$ pnpm boot core shared
$ pnpm boot -f
```

## 2. dev

开发指定的子包

```bash
// 开发 core 子包
$ pnpm dev core

// 并行开发 core 和 shared 子包
$ pnpm dev core shared
```

## 3. build

打包指定的子包

```bash
// 打包 core 子包
$ pnpm build core

// 打包 core 子包以及对应的类型定义
$ pnpm build core -t

// 同时打包 core 和 shared 子包
$ pnpm build core shared -t
```

## 4. lint

全局运行 `eslint` 进行代码检查

```bash
$ pnpm lint
```

## 5. format

全局运行 `prettier` 进行格式化

```bash
$ pnpm format
```

## 6. test

针对所有子包以 `watch` 模式运行单元测试

```bash
$ pnpm test
```

## 7. test:once

针对所有子包运行一次单元测试

```bash
$ pnpm test:once
```

## 8. coverage

针对所有子包执行单元测试覆盖率

```bash
$ pnpm coverage
```
## 9. add-owner

给其他人添加 npm 包权限

```bash
// 一次添加一个
$ pnpm add-owner zhangsan

// 一次添加多个
$ pnpm add-owner zhangsan lisi
```

## 10. release

发布所有子包

```bash
$ pnpm release

// 跳过单元测试和打包直接发布
$ pnpm release --skipTests --skipBuild
```

# 分支管理

采用 [git-flow](https://nvie.com/posts/a-successful-git-branching-model/) 的方式维护分支，各个子包的开发从 `master` 拉取相应的特性分支 `feature/xxx` 做本地开发，这里的 xxx 尽量和模块内容保持一致，比如 `feature/core` 表示内核模块，`feature/shared` 表示共享模块

![git-flow-chart](https://static.yximgs.com/udata/pkg/ks-ad-fe/chrome-plugin-upload/2022-04-01/1648793291308.92a2b518ac6526d9.png)

# 版本管理

版本格式遵守 [语义化版本](https://semver.org/lang/zh-CN/)，对于 monorepo 的项目所有的子包 **统一版本号**，即使只改了一个包，也要把所有包都发一遍。对于不需要发布的子包，在 `package.json` 里注明 `"private": true` 即可

## 1. [语义化提交 Commit](https://www.conventionalcommits.org/en/v1.0.0/#summary)

```bash
// good
$ git commit -m 'feat(<sub-package-name>): add some feature'
$ git commit -m 'fix(<sub-package-name>): fix some bug'
$ git commit -m 'docs: update readme'

// bad, no type
$ git commit -m 'add some feature'
$ git commit -m 'fix some bug'

// bad, no scope
$ git commit -m 'feat: add some feature'
$ git commit -m 'fix: fix some bug'
```

## 2. 合并 master 代码

```bash
$ git pull origin master
```

## 3. 打包有修改的子包（可选）

```bash
$ pnpm build core -t
```

## 4. 执行发包命令

```bash
$ pnpm release
```

# LICENSE

[MIT](https://github.com/chnliquan/eljs/blob/master/LICENSE)
