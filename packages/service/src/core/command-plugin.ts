import {
  chalk,
  generateFile,
  installDeps,
  logger,
  prompts,
  updatePackageJson,
} from '@eljs/utils'
import _ from 'lodash'
import { EOL } from 'os'

import { GeneratorType } from '../enum'
import type { Generator } from '../types'
import { PluginApi } from './plugin-api'
import type { ServicePluginApi } from './service'

export default (api: PluginApi & ServicePluginApi) => {
  api.registerCommand({
    name: 'help',
    description: 'show commands help',
    details: `
${api.binName} help generate
`,
    configResolveMode: 'loose',
    fn() {
      const [subCommand] = api.args._

      if (subCommand) {
        if (subCommand in api.service.commands) {
          showHelp(api.service.commands[subCommand])
        } else {
          logger.error(`Invalid sub command ${subCommand}.`)
        }
      } else {
        showHelps(api.service.commands)
      }
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      function showHelp(command: any) {
        console.log(`
    Usage: ${api.binName} ${command.name} [options]
    ${command.description ? `${chalk.gray(command.description)}.${EOL}` : ''}
    ${command.options ? `Options:${EOL}${padLeft(command.options)}${EOL}` : ''}
    ${command.details ? `Details:${EOL}${padLeft(command.details)}` : ''}
    `)
      }

      function showHelps(commands: typeof api.service.commands) {
        console.log(`
    Usage: ${api.binName} <command> [options]
    
    Commands:
    
    ${getDeps(commands)}
    `)
        console.log(
          `Run \`${chalk.bold(
            `${api.binName} help <command>`,
          )}\` for more information of specific commands.`,
        )
        console.log()
      }
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      function getDeps(commands: any) {
        return Object.keys(commands)
          .map(key => {
            return `    ${chalk.green(_.padEnd(key, 10))}${
              commands[key].description || ''
            }`
          })
          .join('${EOL}')
      }

      function padLeft(str: string) {
        return str
          .trim()
          .split(EOL)
          .map((line: string) => `    ${line}`)
          .join(EOL)
      }
    },
  })

  api.registerCommand({
    name: 'generate',
    alias: 'g',
    details: `
${api.binName} generate
`,
    description: 'generate code snippets quickly',
    configResolveMode: 'loose',
    async fn({ args }) {
      const [type] = args._
      const runGenerator = async (generator: Generator) => {
        await generator?.fn({
          args,
          generateFile,
          installDeps,
          updatePackageJson,
        })
      }

      if (type) {
        const generator = api.service.generators[type]

        if (!generator) {
          throw new Error(`Generator ${type} not found.`)
        }

        if (generator.type === GeneratorType.Enable) {
          const enable = await generator.checkEnable?.({
            args,
          })

          if (!enable) {
            if (typeof generator.disabledDescription === 'function') {
              logger.warn(generator.disabledDescription())
            } else {
              logger.warn(generator.disabledDescription)
            }
            return
          }
        }

        await runGenerator(generator)
      } else {
        const getEnableGenerators = async (
          generators: typeof api.service.generators,
        ) => {
          const questions = [] as { title: string; value: string }[]
          for (const key of Object.keys(generators)) {
            const generator = generators[key]

            if (generator.type === GeneratorType.Generate) {
              questions.push({
                title: `${generator.name} -- ${generator.description}` || '',
                value: generator.key,
              })
            } else {
              const enable = await generator?.checkEnable?.({
                args,
              })

              if (enable) {
                questions.push({
                  title: `${generator.name} -- ${generator.description}` || '',
                  value: generator.key,
                })
              }
            }
          }

          return questions
        }

        const questions = await getEnableGenerators(api.service.generators)
        const { generatorType } = await prompts({
          type: 'select',
          name: 'generatorType',
          message: 'Pick generator type',
          choices: questions,
        })

        await runGenerator(api.service.generators[generatorType])
      }
    },
  })
}
