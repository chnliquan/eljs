#!/usr/bin/env node
'use strict'

const { cli } = require('../lib/cli')

cli()
  .then(() => process.exit(0))
  .catch(() => {
    process.exit(1)
  })
