function _typeof(o) { "@babel/helpers - typeof"; return _typeof = "function" == typeof Symbol && "symbol" == typeof Symbol.iterator ? function (o) { return typeof o; } : function (o) { return o && "function" == typeof Symbol && o.constructor === Symbol && o !== Symbol.prototype ? "symbol" : typeof o; }, _typeof(o); }
function _defineProperties(target, props) { for (var i = 0; i < props.length; i++) { var descriptor = props[i]; descriptor.enumerable = descriptor.enumerable || false; descriptor.configurable = true; if ("value" in descriptor) descriptor.writable = true; Object.defineProperty(target, _toPropertyKey(descriptor.key), descriptor); } }
function _createClass(Constructor, protoProps, staticProps) { if (protoProps) _defineProperties(Constructor.prototype, protoProps); if (staticProps) _defineProperties(Constructor, staticProps); Object.defineProperty(Constructor, "prototype", { writable: false }); return Constructor; }
function _classCallCheck(instance, Constructor) { if (!(instance instanceof Constructor)) { throw new TypeError("Cannot call a class as a function"); } }
function _defineProperty(obj, key, value) { key = _toPropertyKey(key); if (key in obj) { Object.defineProperty(obj, key, { value: value, enumerable: true, configurable: true, writable: true }); } else { obj[key] = value; } return obj; }
function _toPropertyKey(t) { var i = _toPrimitive(t, "string"); return "symbol" == _typeof(i) ? i : String(i); }
function _toPrimitive(t, r) { if ("object" != _typeof(t) || !t) return t; var e = t[Symbol.toPrimitive]; if (void 0 !== e) { var i = e.call(t, r || "default"); if ("object" != _typeof(i)) return i; throw new TypeError("@@toPrimitive must return a primitive value."); } return ("string" === r ? String : Number)(t); }
import assert from 'assert';
export var Hook = /*#__PURE__*/_createClass(function Hook(opts) {
  _classCallCheck(this, Hook);
  /**
   * Hook 对应的插件实例
   */
  _defineProperty(this, "plugin", void 0);
  /**
   * Hook 的唯一标识
   */
  _defineProperty(this, "key", void 0);
  /**
   * 指定在某个 Hook 之前执行
   */
  _defineProperty(this, "before", void 0);
  /**
   * Hook 执行阶段，数字越小执行越早
   */
  _defineProperty(this, "stage", void 0);
  /**
   * Hook 执行函数
   */
  _defineProperty(this, "fn", void 0);
  assert(opts.key && opts.fn, "Invalid hook ".concat(opts, ", key and fn must supplied."));
  this.plugin = opts.plugin;
  this.key = opts.key;
  this.before = opts.before;
  this.stage = opts.stage || 0;
  this.fn = opts.fn;
});