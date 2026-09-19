/* 坨坨脸 · 角色食物图鉴 —— 纯本地静态应用（file:// 可直接打开）
 *
 * 交互：默认对应模式（点角色筛食物、点食物筛角色）；
 * 任一面板顶部搜索即进入搜索：本侧显示名字/别名匹配项，对侧显示关联项（带态度角标）。
 * 多语言：文案统一走 I18N.t()（见 js/i18n.js），语言切换后通过 I18N.onChange 全量重渲染。
 */
(function () {
  "use strict";
  var D = window.APP_DATA;
  var T = window.I18N.t;
  var $ = function (id) { return document.getElementById(id); };

  // ---------- 索引 ----------
  var charById = {}, foodById = {};
  D.characters.forEach(function (c) { charById[c.id] = c; });
  D.foods.forEach(function (f) { foodById[f.id] = f; });
  var ATT_ORDER = { love: 0, like: 1, hate: 2 };

  function norm(s) {
    return (s || "").toLowerCase().replace(/[\s（）()·・]/g, "");
  }
  // 词条化：名字 / id / 别名 各自成词条，避免子串误匹配（如 RohneMayor 含 mayo）
  D.characters.forEach(function (c) {
    c._tokens = [c.name, c.id].concat(c.aliases || []).map(norm).filter(Boolean);
  });
  D.foods.forEach(function (f) {
    f._tokens = [f.name].concat(f.aliases || []).map(norm).filter(Boolean);
  });

  function matchTokens(tokens, q) {
    // 纯英文/数字查询：词条「开头」匹配（防止 mayor 含 mayo 这种误伤）；
    // 含中文的查询：词条包含即命中
    var latin = /^[a-z0-9]+$/.test(q);
    return tokens.some(function (t) {
      var at = t.indexOf(q);
      return at >= 0 && (latin ? at === 0 || /[a-z0-9]/.test(t[at - 1]) === false : true);
    });
  }

  // ---------- 名称翻译（译名表见 js/names.js） ----------
  var LATIN_RE = /^[A-Za-z0-9][A-Za-z0-9 ()./'+!-]*$/;
  function namesTable(lang) {
    return (window.I18N_NAMES && window.I18N_NAMES[lang]) || null;
  }
  function charName(c) {
    var lang = window.I18N.getLang();
    var tb = namesTable(lang);
    if (tb && tb.chars && tb.chars[c.id]) return tb.chars[c.id];
    // 英语模式：角色名自动取别名里第一个纯英文名（data.js 的 aliases）
    if (lang === "en" && c.aliases && c.aliases.length) {
      for (var i = 0; i < c.aliases.length; i++) {
        var a = c.aliases[i] || "";
        if (LATIN_RE.test(a)) return a.trim();
      }
    }
    return c.name;
  }
  function foodName(f) {
    var lang = window.I18N.getLang();
    var tb = namesTable(lang);
    if (tb && tb.foods && tb.foods[f.id]) return tb.foods[f.id];
    return f.name;
  }

  var charAtt = {}, foodRels = {};
  D.characters.forEach(function (c) {
    var m = {};
    ["love", "like", "hate"].forEach(function (att) {
      (c.fav[att] || []).forEach(function (fid) {
        // 同一角色同一食物可能被录进两个态度数组（历史脏数据）：
        // 只保留最强的态度（超喜欢 > 喜欢 > 讨厌），避免重复卡片/角标覆盖
        if (!m[fid] || ATT_ORDER[att] < ATT_ORDER[m[fid]]) m[fid] = att;
      });
    });
    charAtt[c.id] = m;
  });
  // 反向索引从去重后的 charAtt 构建：一个食物 → 相关角色（每角色一条、态度取最强）
  D.characters.forEach(function (c) {
    var m = charAtt[c.id];
    Object.keys(m).forEach(function (fid) {
      (foodRels[fid] = foodRels[fid] || []).push({ charId: c.id, att: m[fid] });
    });
  });

  // ---------- 状态 ----------
  var state = {
    sel: null,     // {type:'char'|'food', id:...}  对应模式的选中项
    cq: "",        // 角色搜索词
    fq: "",        // 食物搜索词
    persona: null  // 性格筛选id（null=全部）
  };

  // ---------- 渲染 ----------
  function badge(att, pos) {
    if (!att) return "";
    // badge-like / badge-love / badge-hate：样式里给不同态度的角标配对应色柔光
    return '<img class="badge b-' + pos + " badge-" + att + '" src="' + D.attitude[att] + '" title="' +
      T("att." + att) + '">';
  }

  function esc(s) {
    return String(s == null ? "" : s).replace(/[&<>"']/g, function (m) {
      return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[m];
    });
  }

  function charCard(c, opts) {
    opts = opts || {};
    var cls = "card";
    if (opts.selected) cls += " selected";
    if (opts.dimmed) cls += " dimmed";
    // 主名 = 当前语言译名；译名不是中文名时，小字行显示原名便于对照
    var nm = charName(c);
    var sub;
    if (nm !== c.name) {
      sub = esc(c.name);
    } else {
      sub = (c.aliases && c.aliases.length) ? esc(c.aliases.slice(0, 2).join(" / ")) : "";
    }
    var alias = sub ? '<div class="alias">' + sub + "</div>" : "";
    return '<div class="' + cls + '" data-type="char" data-id="' + esc(c.id) + '" title="' +
      esc(nm + (c.aliases.length ? "（" + c.aliases.join("、") + "）" : "")) + '">' +
      '<div class="pic"><img loading="lazy" src="' + (c.img || "") + '" onerror="this.style.opacity=.15"></div>' +
      '<div class="nm">' + esc(nm) + "</div>" + alias +
      badge(opts.badge, "char") +
      "</div>";
  }

  function foodCard(f, opts) {
    opts = opts || {};
    var cls = "card";
    if (opts.selected) cls += " selected";
    if (opts.dimmed) cls += " dimmed";
    var nm = foodName(f);
    var sub = nm !== f.name ? esc(f.name) : "";
    var alias = sub ? '<div class="alias">' + sub + "</div>" : "";
    return '<div class="' + cls + '" data-type="food" data-id="' + esc(f.id) + '" title="' +
      esc(nm + (f.upgrade_of && foodById[f.upgrade_of] ? "（升级自：" + foodName(foodById[f.upgrade_of]) + "）" : "")) + '">' +
      '<div class="pic"><img loading="lazy" src="' + f.img + '" onerror="this.style.opacity=.15"></div>' +
      '<div class="nm">' + esc(nm) + "</div>" + alias +
      badge(opts.badge, "food") +
      "</div>";
  }

  function stronger(a, b) {
    if (!a) return b;
    if (!b) return a;
    return ATT_ORDER[a] <= ATT_ORDER[b] ? a : b;
  }

  // 性格显示名：优先用 i18n 词典，词典没有再用 data.js 里的中文名
  function personaName(p) {
    var key = "persona." + p.id;
    return window.I18N.has(key) ? T(key) : p.name;
  }

  function render() {
    var charOpts = {}, foodOpts = {};
    var hint = "";
    var leftList, rightList;
    var cq = norm(state.cq), fq = norm(state.fq);

    if (cq || fq) {
      // ---- 搜索 ----
      var mc = cq ? D.characters.filter(function (c) { return matchTokens(c._tokens, cq); }) : [];
      var mf = fq ? D.foods.filter(function (f) { return matchTokens(f._tokens, fq); }) : [];
      mc.forEach(function (c) { charOpts[c.id] = { selected: true }; });
      mf.forEach(function (f) { foodOpts[f.id] = { selected: true }; });
      // 角色搜索 -> 右侧补相关食物；食物搜索 -> 左侧补相关角色
      mc.forEach(function (c) {
        var m = charAtt[c.id] || {};
        Object.keys(m).forEach(function (fid) {
          var o = (foodOpts[fid] = foodOpts[fid] || {});
          o.badge = stronger(o.badge, m[fid]);
        });
      });
      mf.forEach(function (f) {
        (foodRels[f.id] || []).forEach(function (r) {
          var o = (charOpts[r.charId] = charOpts[r.charId] || {});
          o.badge = stronger(o.badge, r.att);
        });
      });
      leftList = D.characters.filter(function (c) { return charOpts[c.id]; });
      rightList = D.foods.filter(function (f) { return foodOpts[f.id]; });
      var parts = [];
      if (cq) parts.push(T("hint.search.chars", { q: esc(state.cq), n: mc.length }));
      if (fq) parts.push(T("hint.search.foods", { q: esc(state.fq), n: mf.length }));
      hint = T("hint.search", { parts: parts.join("，") });
    } else if (state.sel && state.sel.type === "char") {
      var c = charById[state.sel.id];
      var m = charAtt[c.id] || {};
      leftList = D.characters;
      charOpts[c.id] = { selected: true };
      D.characters.forEach(function (o) { if (o.id !== c.id) charOpts[o.id] = charOpts[o.id] || { dimmed: true }; });
      rightList = D.foods.filter(function (f) { return m[f.id]; })
        .sort(function (a, b) { return ATT_ORDER[m[a.id]] - ATT_ORDER[m[b.id]]; });
      rightList.forEach(function (f) { foodOpts[f.id] = { badge: m[f.id] }; });
      hint = Object.keys(m).length
        ? T("hint.char.sel", { name: esc(charName(c)) })
        : T("hint.char.nodata", { name: esc(charName(c)) });
    } else if (state.sel && state.sel.type === "food") {
      var f = foodById[state.sel.id];
      var rels = (foodRels[f.id] || []).slice()
        .sort(function (a, b) { return ATT_ORDER[a.att] - ATT_ORDER[b.att]; });
      leftList = rels.map(function (r) { return charById[r.charId]; }).filter(Boolean);
      rels.forEach(function (r) { charOpts[r.charId] = { badge: r.att }; });
      foodOpts[f.id] = { selected: true };
      D.foods.forEach(function (o) { if (o.id !== f.id) foodOpts[o.id] = foodOpts[o.id] || { dimmed: true }; });
      rightList = D.foods;
      // 态度数量一目了然（有些食物在数据里本来就只有少数角色有关系）
      var stats = { love: 0, like: 0, hate: 0 };
      rels.forEach(function (r) { stats[r.att]++; });
      hint = T("hint.food.sel", { name: esc(foodName(f)) }) +
        (f.upgrade_of && foodById[f.upgrade_of]
          ? T("hint.food.upgrade", { name: esc(foodName(foodById[f.upgrade_of])) })
          : "") + T("hint.food.stats", stats);
    } else {
      leftList = D.characters;
      rightList = D.foods;
      hint = T("hint.default");
    }

    if (state.persona) {
      var pname = "";
      (D.personalities || []).forEach(function (p) { if (p.id === state.persona) pname = personaName(p); });
      var leftBefore = leftList.length;
      leftList = leftList.filter(function (c) { return c.personality === state.persona; });
      if (pname) hint = T("hint.persona", { name: esc(pname) }) + hint;
      // 性格筛选把部分相关角色藏掉了 → 明确提醒，避免被当成"数据不全"
      var hiddenN = leftBefore - leftList.length;
      if (hiddenN > 0) hint += T("hint.persona.hidden", { n: hiddenN });
    }

    var charHtml = [], foodHtml = [];
    leftList.forEach(function (c) { charHtml.push(charCard(c, charOpts[c.id] || {})); });
    rightList.forEach(function (f) { foodHtml.push(foodCard(f, foodOpts[f.id] || {})); });
    $("charGrid").innerHTML = charHtml.join("");
    $("foodGrid").innerHTML = foodHtml.join("");
    $("charCount").textContent = T("count.unit", { n: leftList.length });
    $("foodCount").textContent = T("count.unit", { n: rightList.length });
    $("charEmpty").classList.toggle("hidden", leftList.length > 0);
    $("foodEmpty").classList.toggle("hidden", rightList.length > 0);
    $("hintText").innerHTML = hint;
  }

  // ---------- 事件 ----------
  $("charGrid").addEventListener("click", function (e) {
    var el = e.target.closest(".card");
    if (!el || state.cq || state.fq) return;
    var id = el.getAttribute("data-id");
    state.sel = (state.sel && state.sel.type === "char" && state.sel.id === id) ? null : { type: "char", id: id };
    render();
  });
  $("foodGrid").addEventListener("click", function (e) {
    var el = e.target.closest(".card");
    if (!el || state.cq || state.fq) return;
    var id = el.getAttribute("data-id");
    state.sel = (state.sel && state.sel.type === "food" && state.sel.id === id) ? null : { type: "food", id: id };
    render();
  });

  function bindSearch(inputId, key) {
    var timer = null;
    $(inputId).addEventListener("input", function (e) {
      clearTimeout(timer);
      timer = setTimeout(function () {
        state[key] = e.target.value.trim();
        if (state[key]) state.sel = null;
        render();
      }, 120);
    });
  }
  bindSearch("charSearch", "cq");
  bindSearch("foodSearch", "fq");

  // ---------- 性格筛选 ----------
  function renderPersonaBar() {
    var bar = $("personaBar");
    if (!D.personalities || !D.personalities.length) { bar.classList.add("hidden"); return; }
    var html = ['<span class="p-label">' + T("persona.label") + "</span>"];
    D.personalities.forEach(function (p) {
      var n = D.characters.filter(function (c) { return c.personality === p.id; }).length;
      html.push('<button class="persona-chip' + (state.persona === p.id ? " active" : "") +
        '" data-id="' + esc(p.id) + '" title="' + T("hint.persona", { name: personaName(p) }).replace(/<[^>]*>/g, "") + '">' +
        '<img src="' + p.icon + '" alt="">' + esc(personaName(p)) + ' <span class="n">' + n + "</span></button>");
    });
    bar.innerHTML = html.join("");
  }
  $("personaBar").addEventListener("click", function (e) {
    var chip = e.target.closest(".persona-chip");
    if (!chip) return;
    var id = chip.getAttribute("data-id");
    state.persona = (state.persona === id) ? null : id;
    // 已选角色若不在新筛选里，取消选中，避免右侧食物列表悬空
    if (state.sel && state.sel.type === "char") {
      var sc = charById[state.sel.id];
      if (state.persona && sc && sc.personality !== state.persona) state.sel = null;
    }
    renderPersonaBar();
    render();
  });
  renderPersonaBar();

  // ---------- 版本号 ----------
  function updateVersionLine(ver) {
    $("versionInfo").textContent = T("version.line", {
      v: ver, date: D.updatedAt,
      chars: D.characters.length, foods: D.foods.length
    });
  }
  updateVersionLine(D.version);
  // 版本号显示：网页版以服务器根目录的 版本号校对.txt 为准（在 GitHub 上改 txt，F5 即生效）；
  // exe / APK 没有这个文件，显示 data.js 里的版本（检查更新后会自动对齐 txt）。
  if (location.protocol === "http:" || location.protocol === "https:") {
    fetch("版本号校对.txt", { cache: "no-store" })
      .then(function (r) { return r.ok ? r.text() : null; })
      .then(function (t) {
        t = (t || "").trim().replace(/^[vV]/, "");
        if (t && /^\d+(\.\d+){0,3}$/.test(t)) updateVersionLine(t);
      })
      .catch(function () {});
  }

  // ---------- 弹窗（客户端下载 / 关于作者 / 语言切换） ----------
  function bindModal(btnId, modalId, closeId) {
    var modal = $(modalId);
    var close = function () { modal.classList.add("hidden"); };
    $(btnId).addEventListener("click", function () {
      modal.classList.remove("hidden");
    });
    $(closeId).addEventListener("click", close);
    modal.addEventListener("click", function (e) {
      if (e.target.classList.contains("dl-mask") || e.target === modal) {
        close();
      } else if (e.target.closest && e.target.closest("a.dl-btn")) {
        setTimeout(close, 400); // 新标签页已打开，顺手收起弹窗
      }
    });
    document.addEventListener("keydown", function (e) {
      if (e.key === "Escape") close();
    });
    return close;
  }

  // 关于作者：三端都显示（内容在 index.html 的 #aboutModal 里）
  bindModal("btnAbout", "aboutModal", "btnAboutClose");
  $("btnCopyMail").addEventListener("click", function () {
    var mail = $("aboutMail").textContent.trim();
    var ok = function () { toast(T("toast.mail.copied", { mail: mail })); };
    var fallback = function () { // 老 WebView / 非安全上下文没有 clipboard API
      var ta = document.createElement("textarea");
      ta.value = mail;
      ta.style.cssText = "position:fixed;opacity:0";
      document.body.appendChild(ta);
      ta.select();
      try { document.execCommand("copy"); ok(); }
      catch (err) { toast(T("toast.mail.fail", { mail: mail })); }
      document.body.removeChild(ta);
    };
    if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(mail).then(ok, fallback);
    } else {
      fallback();
    }
  });

  // 语言切换：三端都显示；选择后 I18N.setLang 广播，onLangChange 统一重渲染
  var closeLangModal = bindModal("btnLang", "langModal", "btnLangClose");
  function renderLangList() {
    var cur = window.I18N.getLang();
    var html = window.I18N.langs.map(function (l) {
      return '<button class="lang-opt' + (l.id === cur ? " active" : "") +
        '" data-id="' + esc(l.id) + '"><span>' + esc(l.name) + "</span>" +
        (l.id === cur ? '<span class="ck">✓</span>' : "") + "</button>";
    });
    $("langList").innerHTML = html.join("");
    $("langModalSub").textContent = "";
  }
  $("btnLang").addEventListener("click", renderLangList);
  $("langList").addEventListener("click", function (e) {
    var opt = e.target.closest(".lang-opt");
    if (!opt) return;
    window.I18N.setLang(opt.getAttribute("data-id"));
    closeLangModal();
  });

  // 语言变化：重画所有动态文案（静态文案由 I18N.applyStatic 处理）
  window.I18N.onChange(function () {
    renderPersonaBar();
    render();
    updateVersionLine(D.version);
    if (!$("btnUpdate").disabled) $("btnUpdate").textContent = T("btn.update");
  });

  // ---------- 更新 ----------
  $("btnUpdate").addEventListener("click", function () {
    var btn = $("btnUpdate");
    btn.disabled = true;
    btn.textContent = T("btn.update.checking");
    var done = function (msg) {
      btn.disabled = false;
      btn.textContent = T("btn.update");
      toast(msg);
    };
    var p = null;
    try {
      p = window.Updater && window.Updater.checkUpdate();
    } catch (err) { p = null; }
    Promise.resolve(p && typeof p.then === "function" ? p : null)
      .then(function (res) {
        res = res || {};
        if (res.supported === false) { done(res.message || T("toast.update.notsupport")); return; }
        if (res.updated && res.updated.length) {
          btn.disabled = false;
          btn.textContent = T("btn.update");
          toast(T("toast.update.done", { v: res.updated.join("、") }));
          setTimeout(function () { location.reload(); }, 1800);
          return;
        }
        // exe 本地服务返回的 message 是中文文案，翻译不了的按原文显示
        done(res.message || T("toast.update.latest"));
      })
      .catch(function (err) {
        var msg = err && err.message || String(err);
        if (location.protocol === "file:") {
          msg = T("toast.update.filehint");
        } else {
          msg = T("toast.update.fail", { msg: msg });
        }
        done(msg);
      });
  });

  var toastTimer = null;
  function toast(msg) {
    var t = $("toast");
    t.textContent = msg;
    t.classList.remove("hidden");
    clearTimeout(toastTimer);
    toastTimer = setTimeout(function () { t.classList.add("hidden"); }, 5200);
  }

  // ---------- init ----------
  // 托管到外网时没有本地更新服务（/api/update 只在 exe 里），
  // 网页版数据随站点更新，隐藏「检查更新」按钮；file:// 和本机 127.0.0.1 不受影响。
  // APK 壳（appassets.androidplatform.net）注入了 NativeBridge，同样保留按钮。
  var host = location.hostname;
  var isLocal = location.protocol === "file:" ||
    host === "127.0.0.1" || host === "localhost" || host === "::1" || host === "[::1]" ||
    host === "appassets.androidplatform.net";
  if (!isLocal) $("btnUpdate").style.display = "none";

  // 客户端下载：和「检查更新」相反，只在网页托管版显示
  // （exe / APK 本身就是客户端，file:// 双击打开也不显示）。
  // 下载地址配置在 index.html 的 #dlModal 里（GitHub 直链 + 蓝奏云分享页）。
  if (!isLocal) {
    $("btnDownload").style.display = "inline-block";
    bindModal("btnDownload", "dlModal", "btnDlClose");
  }
  render();
})();
