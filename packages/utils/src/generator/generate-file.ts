import { Generator, type GeneratorOptions } from './generator'

export async function generateFile(options: GeneratorOptions) {
  const generator = new Generator(options)
  await generator.run()
}
