# eljs

Nodejs utility monorepo

## 开发

### 1. 克隆仓库

```bash
$ git clone git@github.com:chnliquan/eljs.git
```

### 2. 安装依赖

```bash
$ pnpm i
```

### 3. 创建子包（可选）

```bash
$ cd packages
$ mkdir <sub-package-name>
$ pnpm boot
```

## 脚本

| 脚本             | 说明                                                                                     |
| ---------------- | ---------------------------------------------------------------------------------------- |
| add-owner        | 给其他人添加 npm 包权限，用法：`pnpm add-owner zhangsan`、`pnpm add-owner zhangsan lisi` |
| boot             | 初始化子包的项目结构，用法：`pnpm boot`、`$ pnpm boot core shared`                       |
| build            | 编译所有子包                                                                             |
| clean            | 执行所有子包的 `clean` 方法                                                              |
| coverage         | 执行单元测试覆盖率                                                                       |
| dev              | 开发所有的子包                                                                           |
| format           | 全局运行 `prettier` 进行格式化                                                           |
| lint             | 全局运行 `eslint` 进行代码检查                                                           |
| prerelease:alpha | 发布所有子包到 `alpha` 版本，`.alpha.x`                                                  |
| prerelease:beta  | 发布所有子包到 `beta` 版本，`.beta.x`                                                    |
| prerelease:next  | 发布所有子包到 `next` 版本，`.rc.x`                                                      |
| release          | 发布所有子包到指定版本，不传参数会出现交互窗口                                           |
| release:dry      | 打印将要发布的所有子包                                                                   |
| release:only     | 发布所有子包到指定版本，跳过单元测试和构建流程                                           |
| release:patch    | 发布所有子包到 `patch` 版本                                                              |
| release:minor    | 发布所有子包到 `minor` 版本                                                              |
| release:major    | 发布所有子包到 `major` 版本                                                              |
| test             | 测试所有子包                                                                             |
| test:w           | 以 `watch` 模式单测所有子包                                                              |

## 分支管理

采用 [git-flow](https://nvie.com/posts/a-successful-git-branching-model/) 的方式维护分支，各个子包的开发从 `master` 拉取相应的特性分支 `feature/xxx` 做本地开发，这里的 xxx 尽量和模块内容保持一致，比如 `feature/core` 表示内核模块，`feature/shared` 表示共享模块

![git-flow-chart](https://static.yximgs.com/udata/pkg/ks-ad-fe/chrome-plugin-upload/2022-04-01/1648793291308.92a2b518ac6526d9.png)

## 版本管理

版本格式遵守 [语义化版本](https://semver.org/lang/zh-CN/)，对于 monorepo 的项目所有的子包 **统一版本号**，即使只改了一个包，也要把所有包都发一遍。对于不需要发布的子包，在 `package.json` 里注明 `"private": true` 即可

### 1. [语义化提交 Commit](https://www.conventionalcommits.org/en/v1.0.0/#summary)

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

### 2. 合并 master 代码

```bash
$ git pull origin master
```

### 3. 编译有修改的子包（可选）

```bash
$ pnpm build --filter <sub-package-name>
// or
$ pnpm -F '<sub-package-name>' build
```

### 4. 执行发包命令

```bash
$ pnpm release

// 跳过单元测试和编辑
$ pnpm release --skipTests --skipBuild
```

## LICENSE

[MIT](https://github.com/chnliquan/eljs/blob/master/LICENSE)
