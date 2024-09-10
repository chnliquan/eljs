function _typeof(o) { "@babel/helpers - typeof"; return _typeof = "function" == typeof Symbol && "symbol" == typeof Symbol.iterator ? function (o) { return typeof o; } : function (o) { return o && "function" == typeof Symbol && o.constructor === Symbol && o !== Symbol.prototype ? "symbol" : typeof o; }, _typeof(o); }
function _defineProperties(target, props) { for (var i = 0; i < props.length; i++) { var descriptor = props[i]; descriptor.enumerable = descriptor.enumerable || false; descriptor.configurable = true; if ("value" in descriptor) descriptor.writable = true; Object.defineProperty(target, _toPropertyKey(descriptor.key), descriptor); } }
function _createClass(Constructor, protoProps, staticProps) { if (protoProps) _defineProperties(Constructor.prototype, protoProps); if (staticProps) _defineProperties(Constructor, staticProps); Object.defineProperty(Constructor, "prototype", { writable: false }); return Constructor; }
function _classCallCheck(instance, Constructor) { if (!(instance instanceof Constructor)) { throw new TypeError("Cannot call a class as a function"); } }
function _defineProperty(obj, key, value) { key = _toPropertyKey(key); if (key in obj) { Object.defineProperty(obj, key, { value: value, enumerable: true, configurable: true, writable: true }); } else { obj[key] = value; } return obj; }
function _toPropertyKey(t) { var i = _toPrimitive(t, "string"); return "symbol" == _typeof(i) ? i : String(i); }
function _toPrimitive(t, r) { if ("object" != _typeof(t) || !t) return t; var e = t[Symbol.toPrimitive]; if (void 0 !== e) { var i = e.call(t, r || "default"); if ("object" != _typeof(i)) return i; throw new TypeError("@@toPrimitive must return a primitive value."); } return ("string" === r ? String : Number)(t); }
export var Command = /*#__PURE__*/_createClass(function Command(opts) {
  _classCallCheck(this, Command);
  /**
   * 命令名称
   */
  _defineProperty(this, "name", void 0);
  /**
   * 插件
   */
  _defineProperty(this, "plugin", void 0);
  /**
   * 命令描述
   */
  _defineProperty(this, "description", void 0);
  /**
   * 命令行参数
   */
  _defineProperty(this, "options", void 0);
  /**
   * 命令行详细描述
   */
  _defineProperty(this, "details", void 0);
  /**
   * 配置解析模式
   */
  _defineProperty(this, "configResolveMode", void 0);
  /**
   * 命令执行函数
   */
  _defineProperty(this, "fn", void 0);
  this.name = opts.name;
  this.plugin = opts.plugin;
  this.description = opts.description;
  this.options = opts.options;
  this.details = opts.details;
  this.configResolveMode = opts.configResolveMode || 'strict';
  this.fn = opts.fn;
});