//https://github.com/vercel/next.js/blob/canary/packages/next/src/server/require-hook.ts
import path from 'path';
// eslint-disable-next-line @typescript-eslint/no-var-requires
var mod = require('module');
var resolveFilename = mod._resolveFilename;
var hookPropertyMap = new Map([['@eljs/create', path.dirname(require.resolve("../package.json"))]]);
mod._resolveFilename = function (request, parent, isMain, options) {
  var hookResolved = hookPropertyMap.get(request);
  if (hookResolved) {
    request = hookResolved;
  }
  return resolveFilename.call(mod, request, parent, isMain, options);
};
export { hookPropertyMap };