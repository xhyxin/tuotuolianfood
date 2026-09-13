/* 「检查更新」按钮逻辑：
 *  1. exe/apk 客户端：由壳注入 window.NativeBridge.checkUpdate()，直接调用；
 *  2. 本地服务版（打开查询器.bat 启动）：fetch 同源 /api/update，
 *     服务端负责 测网络 -> 访问蓝奏云比对 -> 下载改名合并 -> 返回结果；
 *  3. 直接双击 index.html（file://）：浏览器不允许跨域和写文件，
 *     提示改用「打开查询器.bat」打开。
 *  更新成功后有新角色时自动刷新页面加载新数据。
 */
(function () {
  "use strict";
  window.Updater = {
    checkUpdate: function () {
      if (window.NativeBridge && typeof window.NativeBridge.checkUpdate === "function") {
        try {
          return Promise.resolve(window.NativeBridge.checkUpdate());
        } catch (e) {
          return Promise.reject(e);
        }
      }
      if (location.protocol === "file:") {
        return Promise.resolve({
          supported: false,
          message: "当前是直接双击打开的网页，浏览器不允许联网更新。" +
            "请关闭后使用文件夹里的「打开查询器.bat」打开，即可在线检查更新。"
        });
      }
      return fetch("/api/update", { method: "POST" })
        .then(function (r) { return r.json(); })
        .then(function (j) {
          return { supported: true, updated: j.updated || [], message: j.message || j.error || "" };
        });
    }
  };
})();
