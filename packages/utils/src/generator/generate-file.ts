import { Generator, GeneratorOpts } from './generator'

export async function generateFile(opts: GeneratorOpts) {
  const generator = new Generator(opts)
  await generator.run()
}
