import { Create } from '@/core'
import minimist from 'minimist'

cli()

async function cli() {
  const cwd = process.cwd()
  const args = minimist(process.argv.slice(2))
  const { _, ...otherArgs } = args

  const create = new Create({
    ...otherArgs,
    template: '.',
    force: true,
    cwd,
    args,
  })

  await create.run(_[0] || 'temp')
}
