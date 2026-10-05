// ★ 公告功能（2026-10-05 首版；同日提速改版）——自包含，不依赖 main.js / updater.js
//
// 数据源：GitHub 仓库（xhyxin/tuotuolianfood）根目录的 公告.txt
//   第一行 = 公告日期（如 2026-10-05），其余 = 公告内容
//
// 拉取策略（提速版，两处并发）：
//   · 公告.txt 与 版本号校对.txt 两路【同时】拉（旧版先公告后版本，串行等两轮）
//   · 每一路的所有候选源【同时】发出，谁先回用谁（旧版逐个试，慢源要等满 8 秒超时，
//     点一次公告最坏要五六秒）
//   · 托管网页（http/https）：候选里先加同源（部署内容 = 仓库内容，同源最快）
//   · exe / APK / file://：直接走 GitHub 镜像链（gh-proxy → raw → jsDelivr）
//   · 拉到即写 localStorage（noticeCache / noticeVerCache），之后零等待
//
// 弹窗时机：
//   · 启动：页面就绪后【立刻】后台开拉（旧版延迟 2.5 秒才开始拉）；
//     有新版本（远端 版本号校对.txt > data.js 版本）或 公告日期与本机「不再提示」
//     记录不同 → 弹窗；为不挡首屏，最早也在页面打开 1.2 秒后才弹
//   · 点「公告」按钮：缓存有内容 → 立刻弹窗（毫秒级，离线也能看）；
//     没缓存 → 也立刻弹窗显示「正在获取公告…」占位，后台拉到后原地填充
//   · 自动检查失败 15 秒后静默重试一次（仅自动检查；成功但不新 → 不弹也不重试）
// 弹窗内容 = 先说明新版本（如有），再显示公告正文
// 按钮 = 知道了（仅关闭）/ 不再提示（记住 日期+版本，直到下一个版本或新公告才再弹）
// 右上角「公告」按钮 = 随时查看（手动查看时不出现「不再提示」）
(function () {
  'use strict';

  var REPO = 'xhyxin/tuotuolianfood';
  var BRANCH = 'main';
  var NOTICE_FILE = encodeURIComponent('公告.txt');
  var VER_FILE = encodeURIComponent('版本号校对.txt');
  var MIRRORS = [
    'https://gh-proxy.com/https://raw.githubusercontent.com/' + REPO + '/' + BRANCH + '/',
    'https://raw.githubusercontent.com/' + REPO + '/' + BRANCH + '/',
    'https://cdn.jsdelivr.net/gh/' + REPO + '@' + BRANCH + '/',
  ];
  var FETCH_TIMEOUT = 8000;   // 单源超时（并发竞速下只有所有源都慢才等满）
  var MIN_AUTO_DELAY = 1200;  // 自动弹窗距页面打开的最小间隔（不挡首屏渲染）
  var RETRY_DELAY = 15000;    // 自动检查失败后的静默重试间隔

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
      }, timeoutMs || FETCH_TIMEOUT);
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

  /* 并发竞速：所有候选同时发出，第一个成功的胜出（提速核心） */
  function fetchRace(file, timeoutMs) {
    var list = candidates(file);
    return new Promise(function (resolve, reject) {
      var settled = false, left = list.length;
      if (!left) { reject(new Error('no sources')); return; }
      list.forEach(function (url) {
        fetchText(url, timeoutMs).then(function (txt) {
          if (!settled) { settled = true; resolve(txt); }
        }).catch(function () {
          left -= 1;
          if (!left && !settled) { settled = true; reject(new Error('all sources failed')); }
        });
      });
    });
  }

  function fetchNotice() {
    return fetchRace(NOTICE_FILE, FETCH_TIMEOUT).then(function (text) {
      var lines = String(text).replace(/^\uFEFF/, '').split(/\r?\n/);
      var date = (lines.shift() || '').trim();
      var content = lines.join('\n').trim();
      if (!date) throw new Error('empty');
      return { date: date, content: content };
    });
  }
  function fetchVersion() {
    return fetchRace(VER_FILE, FETCH_TIMEOUT)
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
  function cacheVer(v) {
    try { localStorage.setItem('noticeVerCache', JSON.stringify({ v: v, t: Date.now() })); } catch (e) { /* 忽略 */ }
  }
  function cachedVer() {
    try {
      var o = JSON.parse(localStorage.getItem('noticeVerCache') || 'null');
      return (o && o.v) || '';
    } catch (e) { return ''; }
  }
  function appVersion() {
    try { return (window.APP_DATA && window.APP_DATA.version) || ''; } catch (e) { return ''; }
  }

  /* ---------------- 弹窗 ---------------- */
  var el = null;
  var openedManual = false; // 当前弹窗是否手动打开（决定「不再提示」按钮显隐）
  var memo = { notice: cachedNotice(), remoteVer: cachedVer() };

  function t(key, vars) {
    try { return window.I18N.t(key, vars); } catch (e) { return key; }
  }

  function buildModal() {
    if (el) return el;
    var overlay = document.createElement('div');
    overlay.id = 'notice-overlay';
    overlay.innerHTML =
      '<div id="notice-card" role="dialog">' +
      '  <div class="notice-head"><span class="notice-title"></span>' +
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
    el.querySelector('#notice-ok').onclick = close;
    el.querySelector('#notice-dontshow').onclick = function () {
      if (memo.notice) markSeen(memo.notice.date, memo.remoteVer);
      close();
    };
    return el;
  }

  /* 渲染/原地刷新弹窗内容；st = {date,content,remoteVer,versionNew} 或 {loading:true} */
  function renderPopup(st) {
    var m = buildModal();
    m.querySelector('.notice-title').textContent = '📢 ' + t('notice.title');
    m.querySelector('.notice-date').textContent = st.date || '';
    var nv = m.querySelector('.notice-newver');
    if (st.versionNew) {
      nv.style.display = 'block';
      nv.textContent = t('notice.newVer', { remote: st.remoteVer, local: appVersion() });
    } else {
      nv.style.display = 'none';
    }
    m.querySelector('.notice-body').textContent = st.loading ? t('notice.loading') : (st.content || t('notice.none'));
    m.querySelector('#notice-ok').textContent = t('notice.ok');
    var dont = m.querySelector('#notice-dontshow');
    dont.textContent = t('notice.dontShow');
    dont.style.display = openedManual ? 'none' : 'inline-block'; // 手动查看时不出现「不再提示」
  }

  function showPopup(st, manual) {
    openedManual = !!manual;
    renderPopup(st);
    buildModal().classList.add('show');
  }
  function close() {
    if (el) el.classList.remove('show');
  }
  function isOpen() {
    return !!(el && el.classList.contains('show'));
  }

  /* ---------------- 拉取与状态 ---------------- */
  var inflight = null; // 防重复：进行中的拉取直接复用

  function refreshAll() {
    if (inflight) return inflight;
    inflight = new Promise(function (resolve) {
      var gotNotice = false, done = 0;
      function settle() {
        done += 1;
        if (done >= 2) { inflight = null; resolve(gotNotice); }
      }
      fetchNotice().then(function (n) {
        gotNotice = true;
        memo.notice = n;
        cacheNotice(n);
        settle();
      }).catch(settle);
      fetchVersion().then(function (v) {
        if (v) { memo.remoteVer = v; cacheVer(v); }
        settle();
      });
    });
    return inflight;
  }

  function isVersionNew(remoteVer) {
    var stored = seen();
    return !!remoteVer && isNewer(remoteVer, appVersion()) &&
      !(stored.ver && !isNewer(remoteVer, stored.ver)); // 不再提示过的版本不再弹
  }
  function currentInfo() {
    if (!memo.notice) return null;
    return {
      date: memo.notice.date,
      content: memo.notice.content,
      remoteVer: memo.remoteVer,
      versionNew: isVersionNew(memo.remoteVer),
    };
  }

  /* ---------------- 自动检查（启动） ---------------- */
  var bootedAt = Date.now();
  function autoCheck(retried) {
    refreshAll().then(function (ok) {
      if (!ok) { // 拉取失败：静默重试一次
        if (!retried) setTimeout(function () { autoCheck(true); }, RETRY_DELAY);
        return;
      }
      var info = currentInfo();
      if (!info) return;
      var noticeNew = info.date !== seen().date;
      if (!info.versionNew && !noticeNew) return; // 都不新 → 静默
      var wait = MIN_AUTO_DELAY - (Date.now() - bootedAt);
      setTimeout(function () {
        /* 弹之前再核对一次（期间用户可能已手动看过并点了「不再提示」） */
        var i2 = currentInfo();
        if (!i2 || isOpen()) return;
        var noticeNew2 = i2.date !== seen().date;
        if (!i2.versionNew && !noticeNew2) return;
        showPopup(i2, false);
      }, wait > 0 ? wait : 0);
    });
  }

  /* ---------------- 手动查看（点「公告」按钮：先弹缓存，后台刷新原地更新） ---------------- */
  function manualOpen() {
    var info = currentInfo();
    if (info) showPopup(info, true);            // 缓存在手：立刻弹，毫秒级
    else showPopup({ loading: true }, true);    // 没缓存：也立刻弹，占位等填充
    refreshAll().then(function () {
      if (!isOpen()) return;                    // 用户已关闭就不用刷新了
      var i2 = currentInfo();
      renderPopup(i2 || {});                    // 拉到新数据原地更新；失败且无缓存 → 暂无公告
    });
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

  /* ---------------- 启动 ---------------- */
  function init() {
    bindButton();
    bootedAt = Date.now();
    autoCheck(false); // 页面就绪立刻后台开拉（纯异步，不阻塞首屏渲染）
  }

  /* 公告按钮：优先复用 index.html 里的 #btn-notice；没有（旧版覆盖包）就现场创建。
     两种情况都补上 点击事件 / 标题 / 多语言标记 */
  function bindButton() {
    var n = document.getElementById('btn-notice');
    if (!n) {
      var btn = document.getElementById('btnUpdate');
      if (!btn) return;
      n = document.createElement('button');
      n.id = 'btn-notice';
      n.innerHTML = '📢 <span data-i18n="btn.notice"></span>';
      btn.parentNode.insertBefore(n, btn);
    }
    if (!n.hasAttribute('data-i18n-title')) n.setAttribute('data-i18n-title', 'notice.title');
    n.title = t('notice.title');
    var span = n.querySelector('[data-i18n="btn.notice"]');
    if (!span) {
      span = document.createElement('span');
      span.setAttribute('data-i18n', 'btn.notice');
      n.appendChild(span);
    }
    span.textContent = t('btn.notice');
    n.addEventListener('click', manualOpen);
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
  else init();

  /* 供调试/手动触发（checkAuto = 走启动时的自动弹窗逻辑，含 不再提示 按钮） */
  window.FoodNotice = {
    check: function () { manualOpen(); },
    checkAuto: function () { autoCheck(false); },
  };
})();
