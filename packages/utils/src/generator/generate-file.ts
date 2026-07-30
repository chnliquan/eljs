import { Generator, type GeneratorOptions } from './generator'

/**
 * 生成文件
 * @param options 选项
 */
export async function generateFile(options: GeneratorOptions) {
  const generator = new Generator(options)
  await generator.run()
}
