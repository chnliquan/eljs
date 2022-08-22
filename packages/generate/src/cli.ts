import { GenerateService } from './service'

main().catch(err => {
  console.error(err)
})

async function main() {
  const service = new GenerateService({
    cwd: process.cwd(),
  })

  await service.run({
    target: '',
  })
}
