import { Generator, type GeneratorOptions } from './generator'

/**
 * 生成文件
 * @param options 可选配置项
 */
export async function generateFile(options: GeneratorOptions) {
  const generator = new Generator(options)
  await generator.run()
}
