import { minimist } from '@eljs/utils'
import { Create } from './core/create'

cli().catch((err: Error) => {
  console.error(`Create failed, ${err.message}`)
  console.error(err)
})

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
