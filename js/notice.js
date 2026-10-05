// ★ 公告功能（2026-10-05）——自包含，不依赖 main.js / updater.js
//
// 数据源：GitHub 仓库（xhyxin/tuotuolianfood）根目录的 公告.txt
//   第一行 = 公告日期（如 2026-10-05），其余 = 公告内容
//
// 拉取策略：
//   · 托管网页（http/https）：先取站点根目录的 公告.txt（部署内容 = 仓库内容，同源最快）
//   · exe / APK / file://：直接走 GitHub 镜像链（gh-proxy → raw → jsDelivr）
//   · 每个源 8 秒超时；全部失败 → 静默跳过（无网 / 超时都不打扰用户）
//
// 弹窗条件（启动 2.5 秒后后台检查）：
//   有新版本（远端 版本号校对.txt > data.js 版本）或 公告日期与本机「不再提示」记录不同
//   弹窗内容 = 先说明新版本（如有），再显示公告正文
//   按钮 = 知道了（仅关闭）/ 不再提示（记住 日期+版本，直到下一个版本或新公告才再弹）
// 右上角「公告」按钮 = 随时查看（优先上次拉取的缓存，离线也能看）
(function () {
  'use strict';

  var REPO = 'xhyxin/tuotuolianfood';
  var BRANCH = 'main';
  var NOTICE_FILE = encodeURIComponent('公告.txt');
  var MIRRORS = [
    'https://gh-proxy.com/https://raw.githubusercontent.com/' + REPO + '/' + BRANCH + '/',
    'https://raw.githubusercontent.com/' + REPO + '/' + BRANCH + '/',
    'https://cdn.jsdelivr.net/gh/' + REPO + '@' + BRANCH + '/',
  ];

  function hosted() {
    return location.protocol === 'http:' || location.protocol === 'https:';
  }

  /* 候选地址：托管网页优先同源（部署内容=仓库内容），其余走镜像链 */
  function candidates(file) {
    var list = [];
    if (hosted()) list.push(file);
    MIRRORS.forEach(function (m) { list.push(m + file); });
    return list;
  }

  function fetchText(url, timeoutMs) {
    return new Promise(function (resolve, reject) {
      var ctrl = null;
      try { ctrl = new AbortController(); } catch (e) { ctrl = null; }
      var timer = setTimeout(function () {
        if (ctrl) try { ctrl.abort(); } catch (e2) { /* 忽略 */ }
        reject(new Error('timeout'));
      }, timeoutMs || 8000);
      fetch(url + (url.indexOf('?') >= 0 ? '&' : '?') + 't=' + Date.now(), {
        cache: 'no-store',
        signal: ctrl ? ctrl.signal : undefined,
      }).then(function (r) {
        clearTimeout(timer);
        if (!r.ok) throw new Error('HTTP ' + r.status);
        return r.text();
      }).then(function (t) { clearTimeout(timer); resolve(String(t)); })
        .catch(function (e) { clearTimeout(timer); reject(e); });
    });
  }

  /* 依次尝试候选地址，第一个成功的返回 */
  function fetchAny(file, timeoutMs) {
    var list = candidates(file);
    return new Promise(function (resolve, reject) {
      var i = 0;
      var tryNext = function () {
        if (i >= list.length) { reject(new Error('all sources failed')); return; }
        fetchText(list[i], timeoutMs).then(resolve).catch(function () { i += 1; tryNext(); });
      };
      tryNext();
    });
  }

  function fetchNotice() {
    return fetchAny(NOTICE_FILE, 8000).then(function (text) {
      var lines = String(text).replace(/^\uFEFF/, '').split(/\r?\n/);
      var date = (lines.shift() || '').trim();
      var content = lines.join('\n').trim();
      if (!date) throw new Error('empty');
      return { date: date, content: content };
    });
  }
  function fetchVersion() {
    return fetchAny(encodeURIComponent('版本号校对.txt'), 8000)
      .then(function (t) { return /^[0-9]+(\.[0-9]+)*$/.test(t.trim()) ? t.trim() : ''; })
      .catch(function () { return ''; });
  }

  /* ---------------- 本机记录 ---------------- */
  function seen() {
    try { return JSON.parse(localStorage.getItem('noticeSeen') || '{}') || {}; }
    catch (e) { return {}; }
  }
  function markSeen(date, ver) {
    try { localStorage.setItem('noticeSeen', JSON.stringify({ date: date, ver: ver })); } catch (e) { /* 忽略 */ }
  }
  function cacheNotice(obj) {
    try { localStorage.setItem('noticeCache', JSON.stringify(obj)); } catch (e) { /* 忽略 */ }
  }
  function cachedNotice() {
    try { return JSON.parse(localStorage.getItem('noticeCache') || 'null'); } catch (e) { return null; }
  }
  function appVersion() {
    try { return (window.APP_DATA && window.APP_DATA.version) || ''; } catch (e) { return ''; }
  }

  /* ---------------- 弹窗 ---------------- */
  var el = null;
  function t(key, vars) {
    try { return window.I18N.t(key, vars); } catch (e) { return key; }
  }

  function buildModal() {
    if (el) return el;
    var overlay = document.createElement('div');
    overlay.id = 'notice-overlay';
    overlay.innerHTML =
      '<div id="notice-card" role="dialog">' +
      '  <div class="notice-head"><span class="notice-title">📢 ' + t('notice.title') + '</span>' +
      '    <span class="notice-date"></span></div>' +
      '  <div class="notice-newver" style="display:none"></div>' +
      '  <div class="notice-body"></div>' +
      '  <div class="notice-btns">' +
      '    <button class="notice-btn" id="notice-dontshow"></button>' +
      '    <button class="notice-btn primary" id="notice-ok"></button>' +
      '  </div>' +
      '</div>';
    document.body.appendChild(overlay);
    el = overlay;
    return el;
  }

  function showPopup(info, manual) {
    var m = buildModal();
    m.querySelector('.notice-title').textContent = '📢 ' + t('notice.title');
    m.querySelector('.notice-date').textContent = info.date || '';
    var nv = m.querySelector('.notice-newver');
    if (info.versionNew) {
      nv.style.display = 'block';
      nv.textContent = t('notice.newVer', { remote: info.remoteVer, local: appVersion() });
    } else {
      nv.style.display = 'none';
    }
    m.querySelector('.notice-body').textContent = info.content || t('notice.none');
    m.querySelector('#notice-ok').textContent = t('notice.ok');
    var dont = m.querySelector('#notice-dontshow');
    dont.textContent = t('notice.dontShow');
    dont.style.display = manual ? 'none' : 'inline-block'; // 手动查看时不出现「不再提示」

    dont.onclick = function () {
      markSeen(info.date, info.remoteVer);
      close();
    };
    m.querySelector('#notice-ok').onclick = close;
    function close() { el.classList.remove('show'); }

    m.classList.add('show');
  }
  function close() {
    if (el) el.classList.remove('show');
  }

  /* ---------------- 检查 ---------------- */
  function checkNow(manual) {
    fetchNotice().then(function (notice) {
      cacheNotice(notice);
      fetchVersion().then(function (remoteVer) {
        finish(notice, remoteVer, manual);
      }).catch(function () { finish(notice, '', manual); });
    }).catch(function () {
      if (manual) toast(t('notice.none'));
      /* 自动检查失败：静默 */
    });
  }
  function finish(notice, remoteVer, manual) {
    var stored = seen();
    var versionNew = !!remoteVer && isNewer(remoteVer, appVersion()) &&
      !(stored.ver && !isNewer(remoteVer, stored.ver)); // 不再提示过的版本不再弹
    var noticeNew = notice.date !== stored.date;
    if (!manual && !versionNew && !noticeNew) return; // 都不新 → 静默
    showPopup({
      date: notice.date,
      content: notice.content,
      remoteVer: remoteVer,
      versionNew: !!versionNew,
    }, !!manual);
  }

  function isNewer(a, b) {
    a = String(a == null ? '' : a).trim().split('.');
    b = String(b == null ? '' : b).trim().split('.');
    for (var i = 0; i < Math.max(a.length, b.length); i++) {
      var x = parseInt(a[i], 10) || 0;
      var y = parseInt(b[i], 10) || 0;
      if (x > y) return true;
      if (x < y) return false;
    }
    return false;
  }

  function toast(text, ms) {
    var el2 = document.getElementById('hintText');
    if (!el2) return;
    var old = el2.innerHTML;
    el2.innerHTML = text;
    setTimeout(function () { el2.innerHTML = old; }, ms || 3600);
  }

  /* ---------------- 启动 ---------------- */
  function init() {
    var btn = document.getElementById('btnUpdate');
    if (btn && !document.getElementById('btn-notice')) {
      var n = document.createElement('button');
      n.className = 'tool';
      n.id = 'btn-notice';
      n.title = t('notice.title');
      n.setAttribute('data-i18n', 'btn.notice');
      n.textContent = t('btn.notice');
      n.addEventListener('click', function () { checkNow(true); });
      btn.parentNode.insertBefore(n, btn);
    }
    // 启动 2.5 秒后后台检查（不抢加载资源、不卡界面）；失败 15 秒后静默重试一次
    setTimeout(function () {
      checkNow(false);
      setTimeout(function () { checkNow(false); }, 15000);
    }, 2500);
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
  else init();

  /* 供调试/手动触发（checkAuto = 走启动时的自动弹窗逻辑，含 不再提示 按钮） */
  window.FoodNotice = {
    check: function () { checkNow(true); },
    checkAuto: function () { checkNow(false); },
  };
})();
