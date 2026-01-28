/**
 * Browser-compatible util polyfill for @meshtastic/core
 */

export const formatWithOptions = (options, format, ...args) => {
  // Simple format implementation for browser
  if (typeof format !== 'string') return String(format);
  let result = format;
  for (const arg of args) {
    result = result.replace(/%[sdjifoO%]/, String(arg));
  }
  return result;
};

export const types = {
  isDate: (val) => val instanceof Date,
  isRegExp: (val) => val instanceof RegExp,
  isNativeError: (val) => val instanceof Error,
  isSet: (val) => val instanceof Set,
  isMap: (val) => val instanceof Map,
  isTypedArray: (val) => ArrayBuffer.isView(val) && !(val instanceof DataView),
  isArrayBuffer: (val) => val instanceof ArrayBuffer,
  isSharedArrayBuffer: (val) => typeof SharedArrayBuffer !== 'undefined' && val instanceof SharedArrayBuffer,
  isDataView: (val) => val instanceof DataView,
  isPromise: (val) => val instanceof Promise,
  isWeakSet: (val) => val instanceof WeakSet,
  isWeakMap: (val) => val instanceof WeakMap,
};

export const format = (fmt, ...args) => formatWithOptions({}, fmt, ...args);

export const inspect = (obj, options) => {
  try {
    return JSON.stringify(obj, null, 2);
  } catch {
    return String(obj);
  }
};

export const promisify = (fn) => (...args) => new Promise((resolve, reject) => {
  fn(...args, (err, result) => err ? reject(err) : resolve(result));
});

export const debuglog = () => () => {};
export const deprecate = (fn) => fn;

export default {
  formatWithOptions,
  types,
  format,
  inspect,
  promisify,
  debuglog,
  deprecate,
};
