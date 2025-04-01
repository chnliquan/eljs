# eljs

Nodejs toolkit monorepo.

## Development

### 1. Clone

```bash
$ git clone git@github.com:chnliquan/eljs.git
```

### 2. Install

```bash
$ pnpm i
```

### 3. Compile

```bash
$ pnpm run build
```

## Scripts

| Name             | Description                                                                                      |
| ---------------- | ------------------------------------------------------------------------------------------------ |
| add-owner        | Add owner to all sub-packages, `pnpm run add-owner zhangsan`、`pnpm add-owner run zhangsan lisi` |
| boot             | Initialize sub-package project, `$ pnpm run boot packages/shared`、`$ pnpm run boot core`        |
| build            | Compile all sub-packages                                                                         |
| clean            | Run `clean` script of all sub-packages                                                           |
| coverage         | Run unit test coverage                                                                           |
| dev              | Compile all sub-packages in `watch` mode                                                         |
| format           | Format source code                                                                               |
| gm               | Standardized git commit                                                                          |
| lint             | Lint source code                                                                                 |
| prerelease:alpha | Prerelease all sub-packages using `alpha` version, `.alpha.x`                                    |
| prerelease:beta  | Prerelease all sub-packages using `beta` version, `.beta.x`                                      |
| prerelease:next  | Prerelease all sub-packages using `rc` version, `.rc.x`                                          |
| release          | Release all sub-packages                                                                         |
| release:major    | Release all sub-packages using `major` version                                                   |
| release:minor    | Release all sub-packages using `minor` version                                                   |
| release:patch    | Release all sub-packages using `patch` version                                                   |
| test             | Run unit tests                                                                                   |
| test:w           | Run unit tests in `watch` mode                                                                   |

## Version

### 1. [Conventional Commit](https://www.conventionalcommits.org/en/v1.0.0/#summary) 

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

### 2. Merge master

```bash
$ git pull origin master
```

### 3. Compile（optional）

```bash
$ pnpm run build --filter <sub-package-name>
// or
$ pnpm -F <sub-package-name> run build
```

### 4. Release

```bash
$ pnpm run release

Options:
  --skipTests         Skip unit tests.
  --skipBuild         Skip package build.
  --skipRequireClean  Skip git working tree check.
```

## Branch

- [git-flow](https://nvie.com/posts/a-successful-git-branching-model/)

<div style="text-align: center;">
  <img src="https://static.yximgs.com/udata/pkg/ks-ad-fe/chrome-plugin-upload/2022-04-01/1648793291308.92a2b518ac6526d9.png" width="500" />
</div>

## LICENSE

[MIT](https://github.com/chnliquan/eljs/blob/master/LICENSE)
