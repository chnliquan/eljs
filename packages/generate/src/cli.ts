import { minimist } from '@eljs/utils'
import { Create } from './create'

async function cli() {
  const cwd = process.cwd()
  const { _, ...otherArgs } = minimist(process.argv.slice(2))
  const [projectName = 'template'] = _

  const create = new Create({
    template: '.',
    force: true,
    cwd,
    ...otherArgs,
  })

  await create.run(projectName)
}

cli().catch((err: Error) => {
  console.error(`Create failed, ${err.message}`)
  console.error(err)
})
