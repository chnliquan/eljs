# @eljs/utils

Collection of nodejs utility

## Installation

```bash
$ pnpm add @eljs/utils
// or
$ yarn add @eljs/utils
// or
$ npm i @eljs/utils -S
```

## Usage

```ts
import { run, logger } from '@eljs/utils'

// run shell command
await run('pnpm', ['install'])
// logger
logger.info('info')
```
