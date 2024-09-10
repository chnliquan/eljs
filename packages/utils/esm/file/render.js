function _typeof(o) { "@babel/helpers - typeof"; return _typeof = "function" == typeof Symbol && "symbol" == typeof Symbol.iterator ? function (o) { return typeof o; } : function (o) { return o && "function" == typeof Symbol && o.constructor === Symbol && o !== Symbol.prototype ? "symbol" : typeof o; }, _typeof(o); }
function ownKeys(e, r) { var t = Object.keys(e); if (Object.getOwnPropertySymbols) { var o = Object.getOwnPropertySymbols(e); r && (o = o.filter(function (r) { return Object.getOwnPropertyDescriptor(e, r).enumerable; })), t.push.apply(t, o); } return t; }
function _objectSpread(e) { for (var r = 1; r < arguments.length; r++) { var t = null != arguments[r] ? arguments[r] : {}; r % 2 ? ownKeys(Object(t), !0).forEach(function (r) { _defineProperty(e, r, t[r]); }) : Object.getOwnPropertyDescriptors ? Object.defineProperties(e, Object.getOwnPropertyDescriptors(t)) : ownKeys(Object(t)).forEach(function (r) { Object.defineProperty(e, r, Object.getOwnPropertyDescriptor(t, r)); }); } return e; }
function _defineProperty(obj, key, value) { key = _toPropertyKey(key); if (key in obj) { Object.defineProperty(obj, key, { value: value, enumerable: true, configurable: true, writable: true }); } else { obj[key] = value; } return obj; }
function _toPropertyKey(t) { var i = _toPrimitive(t, "string"); return "symbol" == _typeof(i) ? i : String(i); }
function _toPrimitive(t, r) { if ("object" != _typeof(t) || !t) return t; var e = t[Symbol.toPrimitive]; if (void 0 !== e) { var i = e.call(t, r || "default"); if ("object" != _typeof(i)) return i; throw new TypeError("@@toPrimitive must return a primitive value."); } return ("string" === r ? String : Number)(t); }
import ejs from 'ejs';
import Mustache from 'mustache';

/**
 * 模版渲染选项
 */

/**
 * mustache 模版渲染选项
 */

/**
 * ejs 模版渲染选项
 */

/**
 * 渲染模版字符串
 * @param template 模版内容
 * @param data 模版填充数据
 * @param opts 模版渲染选项
 */
export function renderTemplate(template, data) {
  var opts = arguments.length > 2 && arguments[2] !== undefined ? arguments[2] : {};
  var _ref = opts,
    _ref$type = _ref.type,
    type = _ref$type === void 0 ? 'mustache' : _ref$type,
    options = _ref.options;
  var _ref2 = opts,
    partials = _ref2.partials,
    tagsOrOptions = _ref2.tagsOrOptions;
  if (type === 'ejs') {
    return ejs.render(template, data, _objectSpread(_objectSpread({}, options), {}, {
      async: false
    }));
  } else {
    return Mustache.render(template, data, partials, tagsOrOptions);
  }
}