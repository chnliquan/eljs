import { definePlugin } from '../../define'
import type { AppData } from '../../types'

export default definePlugin(context => {
  context.onStart(
    () => {
      const packageManager = context.prompts.packageManager as
        AppData['packageManager'] | undefined

      if (packageManager) {
        context.appData.packageManager = packageManager
      }
    },
    {
      stage: Number.NEGATIVE_INFINITY,
    },
  )
})
