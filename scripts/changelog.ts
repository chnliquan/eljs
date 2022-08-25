import { generateChangelog } from '../packages/release'
;(async () => {
  generateChangelog({
    pkgName: '111',
    changelogPreset: '@eljs/changelog-preset',
  })
})()
