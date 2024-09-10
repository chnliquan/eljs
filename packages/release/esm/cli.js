function _typeof(o) { "@babel/helpers - typeof"; return _typeof = "function" == typeof Symbol && "symbol" == typeof Symbol.iterator ? function (o) { return typeof o; } : function (o) { return o && "function" == typeof Symbol && o.constructor === Symbol && o !== Symbol.prototype ? "symbol" : typeof o; }, _typeof(o); }
function ownKeys(e, r) { var t = Object.keys(e); if (Object.getOwnPropertySymbols) { var o = Object.getOwnPropertySymbols(e); r && (o = o.filter(function (r) { return Object.getOwnPropertyDescriptor(e, r).enumerable; })), t.push.apply(t, o); } return t; }
function _objectSpread(e) { for (var r = 1; r < arguments.length; r++) { var t = null != arguments[r] ? arguments[r] : {}; r % 2 ? ownKeys(Object(t), !0).forEach(function (r) { _defineProperty(e, r, t[r]); }) : Object.getOwnPropertyDescriptors ? Object.defineProperties(e, Object.getOwnPropertyDescriptors(t)) : ownKeys(Object(t)).forEach(function (r) { Object.defineProperty(e, r, Object.getOwnPropertyDescriptor(t, r)); }); } return e; }
function _defineProperty(obj, key, value) { key = _toPropertyKey(key); if (key in obj) { Object.defineProperty(obj, key, { value: value, enumerable: true, configurable: true, writable: true }); } else { obj[key] = value; } return obj; }
function _toPropertyKey(t) { var i = _toPrimitive(t, "string"); return "symbol" == _typeof(i) ? i : String(i); }
function _toPrimitive(t, r) { if ("object" != _typeof(t) || !t) return t; var e = t[Symbol.toPrimitive]; if (void 0 !== e) { var i = e.call(t, r || "default"); if ("object" != _typeof(i)) return i; throw new TypeError("@@toPrimitive must return a primitive value."); } return ("string" === r ? String : Number)(t); }
import { chalk, logger, minimist, readJSONSync } from '@eljs/utils';
import { InvalidArgumentError, program } from 'commander';
import path from 'path';
import semver from 'semver';
import { VERSION_TAGS } from "./constants";
import { release } from "./core/release";
cli().catch(function (err) {
  console.error("release failed, ".concat(err.message));
  console.error(err);
});
function cli() {
  var pkgJSON = readJSONSync(path.join(__dirname, '../package.json'));
  program.version(pkgJSON.version, '-v, --version', 'Output the current version.').option('--dry', 'Instead of executing, display details about the affected packages that would be publish.').option('--verbose', 'Whether display verbose message.').option('--latest', 'Whether generate latest changelog.').option('--publish-only', 'Whether publish only.').option('--sync-cnpm', 'Whether sync to cnpm when publish done.').option('--no-confirm', 'No confirm the bump version.').option('--no-ownership-check', 'No check the npm ownership.').option('--no-registry-check', 'No check the package registry.').option('--no-git-check', 'No check the git status.').option('--no-git-push', 'No push commit to remote.').option('--no-github-release', 'No release to github.').option('--branch <branch>', 'Specify the branch that is allowed to publish.').option('--tag <tag>', 'Specify the publish tag.').option('--repo-type <repo-type>', 'Specify the publish type, github or gitlab.').option('--changelog-preset <changelog-preset>', 'Customize conventional changelog preset.').argument('[version]', 'Target bump version.', checkVersion);
  program.commands.forEach(function (c) {
    return c.on('--help', function () {
      return console.log();
    });
  });
  enhanceErrorMessages('missingArgument', function (argName) {
    return "Missing required argument ".concat(chalk.yellow("<".concat(argName, ">")), ".");
  });
  enhanceErrorMessages('unknownOption', function (optionName) {
    return "Unknown option ".concat(chalk.yellow(optionName), ".");
  });
  enhanceErrorMessages('optionMissingArgument', function (option, flag) {
    return "Missing required argument for option ".concat(chalk.yellow(option.flags)) + (flag ? ", got ".concat(chalk.yellow(flag)) : "");
  });
  program.parse(process.argv);
  if (minimist(process.argv.slice(3))._.length > 1) {
    logger.info('You provided more than one argument. The first one will be used as the bump version, the rest are ignored.');
  }
  var opts = program.opts();
  var version = program.args[0];
  if (opts.repoType && !['github', 'gitlab'].includes(opts.repoType)) {
    logger.printErrorAndExit("Expected the --repo-type as github or gitlab, but got ".concat(opts.repoType, "."));
  }
  if (opts.tag && !['alpha', 'beta', 'next'].includes(opts.tag)) {
    logger.printErrorAndExit("Expected the --tag as alpha beta or next, but got ".concat(opts.tag, "."));
  }
  return release(_objectSpread(_objectSpread({}, opts), {}, {
    version: version
  })).then(function () {
    return process.exit(0);
  });
}
function enhanceErrorMessages(methodName, log) {
  ;
  program.Command.prototype[methodName] = function () {
    if (methodName === 'unknownOption' && this._allowUnknownOption) {
      return;
    }
    this.outputHelp();
    console.log();
    console.log("  " + chalk.red(log.apply(void 0, arguments)));
    console.log();
    process.exit(1);
  };
}
function checkVersion(value) {
  if (VERSION_TAGS.includes(value)) {
    return value;
  }
  var isValid = Boolean(semver.valid(value));
  if (!isValid) {
    throw new InvalidArgumentError('should be a valid semantic version.');
  }

  // if startsWith 'v', need to remove it
  if (value.indexOf('v') === 0) {
    return value.substring(1);
  }
  return value;
}