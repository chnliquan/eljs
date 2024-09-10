/**
 * 睡眠 ms 毫秒
 * @param ms 毫秒
 */
export function sleep(ms) {
  return new Promise(function (r) {
    return setTimeout(r, ms);
  });
}

/**
 * 超时拒绝
 * @param promise promise
 * @param ms 超时时间
 */
export function timeout(promise, ms) {
  return new Promise(function (resolve, reject) {
    var finished = false;
    promise.then(function (data) {
      finished = true;
      resolve(data);
    }).catch(function (err) {
      finished = true;
      reject(err);
    });
    setTimeout(function () {
      return maybeTimeout();
    }, ms);
    function maybeTimeout() {
      if (finished) {
        return;
      }
      reject(new Error('Timeout'));
    }
  });
}