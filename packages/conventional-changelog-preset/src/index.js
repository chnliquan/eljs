import { createParserOpts } from './parser.js'
import { whatBump } from './what-bump.js'
import { createWriterOpts } from './writer.js'

// https://github.com/conventional-changelog/conventional-changelog/blob/master/packages/conventional-changelog-angular/src/index.js
/**
 * @returns {Promise<{
 *   parser: import('conventional-commits-parser').ParserStreamOptions
 *   writer: import('conventional-changelog-writer').Options
 *   whatBump: typeof whatBump
 * }>}
 */
export default async function createPreset() {
  return {
    parser: createParserOpts(),
    writer: await createWriterOpts(),
    whatBump,
  }
}
