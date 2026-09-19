/* 坨坨脸 · 角色食物图鉴 —— 多语言支持（简体中文 / 한국어 / 日本語 / English）
 *
 * 用法：
 *   I18N.t(key, vars)        取当前语言文案，vars = {name: "兰"} 替换 {name} 占位符
 *   I18N.getLang()           当前语言 id（zh-CN / ko-KR / ja-JP / en）
 *   I18N.setLang(id)         切换语言（写入 localStorage 并广播）
 *   I18N.onChange(fn)        语言变化时回调（app.js 在这里重渲染动态文案）
 *   I18N.has(key)            当前语言（或默认语言）是否存在该词条
 *   I18N.langs               语言清单 [{id, name}]（name 永远用该语言自称）
 * 静态 HTML 文案：元素加 data-i18n="key"（textContent）/ data-i18n-html="key"
 * （含 <br> 的多行文案）/ data-i18n-placeholder / data-i18n-title。
 * 词典本体在下方 I18N-DICT 标记之间，是合法 JSON——
 * 开发端\美化工作区\export_i18n_txt.py 会读取它生成四语对照 txt。
 * 字体：zh/en 用 BoBoHei，ko 用 BoBoKo（NEXON Lv1 Gothic 子集），
 *       ja 用 BoBoJa（RocknRoll One 子集），由 CSS 按 body[data-lang] 切换。
 */
(function () {
  "use strict";

  var LANGS = [
    { id: "zh-CN", name: "简体中文" },
    { id: "ko-KR", name: "한국어" },
    { id: "ja-JP", name: "日本語" },
    { id: "en", name: "English" }
  ];
  var FALLBACK = "zh-CN";
  var STORE_KEY = "tuotuo.lang";

  /* I18N-DICT-START（JSON 开始，导出脚本据此解析，勿改本行） */
  window.I18N_DATA = {
    "zh-CN": {
      "app.title": "坨坨脸 · 角色食物图鉴",
      "panel.chars": "角色",
      "panel.foods": "食物",
      "count.unit": "{n} 个",
      "search.chars.ph": "搜索角色 / 别名…",
      "search.foods.ph": "搜索食物 / 别名…",
      "empty.chars": "没有匹配的角色",
      "empty.foods": "没有匹配的食物",
      "persona.label": "性格",
      "att.love": "超喜欢",
      "att.like": "喜欢",
      "att.hate": "讨厌",
      "persona.pure": "纯粹",
      "persona.resonance": "共鸣",
      "persona.calm": "冷静",
      "persona.frenzy": "狂热",
      "persona.lively": "活泼",
      "persona.gloomy": "忧郁",
      "hint.default": "点击角色查看 TA 喜欢/讨厌的食物；点击食物查看哪些角色喜欢/讨厌它；也可直接在上方搜索。",
      "hint.char.sel": "已选角色：<b>{name}</b>，右侧仅显示 TA 相关的食物（右上角为态度）。点击食物可反查。",
      "hint.char.nodata": "已选角色：<b>{name}</b>（暂无喜好数据，可在「数据/关系.txt」中补充后重新构建）",
      "hint.food.sel": "已选食物：<b>{name}</b>，左侧仅显示与它相关的角色（左上角为态度）。",
      "hint.food.upgrade": "（升级自：{name}）",
      "hint.food.stats": "（超喜欢 {love} · 喜欢 {like} · 讨厌 {hate}）",
      "hint.persona.hidden": "<br>⚠ 性格筛选隐藏了 {n} 个角色，再点一次该性格标签即可取消。",
      "hint.search": "搜索：{parts}（含别名；关联项带态度角标）。清空搜索框恢复对应模式。",
      "hint.search.chars": "角色「{q}」{n} 个",
      "hint.search.foods": "食物「{q}」{n} 个",
      "hint.persona": "已按性格「<b>{name}</b>」筛选角色。",
      "version.line": "v{v} · 数据更新于 {date} · 角色 {chars} · 食物 {foods}",
      "btn.update": "检查更新",
      "btn.update.checking": "检查中…",
      "btn.download": "客户端下载",
      "btn.about.lg": "关于作者",
      "btn.about.sm": "关于",
      "btn.lang.title": "语言 / Language",
      "lang.modal.title": "🌐 切换语言",
      "lang.short": "中文",
      "dl.title": "📦 下载客户端",
      "dl.sub": "独立客户端不用开网页，离线也能查，还会自动提醒更新～",
      "dl.tag.pc": "💻 电脑端",
      "dl.tag.apk": "📱 安卓端",
      "dl.btn.gh": "GitHub 下载",
      "dl.btn.lz": "蓝奏云 下载",
      "dl.note": "GitHub 直链国内可能较慢，卡住就换蓝奏云（无需密码）。<br>电脑端：解压后双击 exe；安卓端：解压出 apk 安装（允许未知来源）。",
      "about.title": "🍮 关于作者",
      "about.sub": "坨坨脸食物图鉴 · 个人同人作品<br>数据整理自韩服 wiki，仅供交流学习，游戏版权归 Epid Games 所有。",
      "about.github": "GitHub 仓库",
      "about.web": "网页版",
      "about.mail": "邮箱",
      "about.open": "打开",
      "about.copy": "复制",
      "about.note": "发现数据错误、想补充角色，欢迎到 GitHub 提 issue 或发邮件告诉我～",
      "toast.mail.copied": "邮箱已复制：{mail}",
      "toast.mail.fail": "复制失败，手动记一下：{mail}",
      "toast.update.done": "更新完成：已更新到 {v}，页面正在刷新加载新数据…",
      "toast.update.latest": "已是最新版本。",
      "toast.update.notsupport": "当前打开方式不支持在线更新。",
      "toast.update.fail": "更新失败：{msg}",
      "toast.update.filehint": "当前是直接双击打开的网页，浏览器不允许联网更新。请关闭后使用文件夹里的「打开查询器.bat」打开，即可在线检查更新。"
    },
    "en": {
      "app.title": "Trickcal · Character Food Guide",
      "panel.chars": "Characters",
      "panel.foods": "Foods",
      "count.unit": "{n}",
      "search.chars.ph": "Search characters / aliases…",
      "search.foods.ph": "Search foods / aliases…",
      "empty.chars": "No matching characters",
      "empty.foods": "No matching foods",
      "persona.label": "Personality",
      "att.love": "Love",
      "att.like": "Like",
      "att.hate": "Hate",
      "persona.pure": "Pure",
      "persona.resonance": "Resonance",
      "persona.calm": "Calm",
      "persona.frenzy": "Frenzy",
      "persona.lively": "Lively",
      "persona.gloomy": "Gloomy",
      "hint.default": "Click a character to see foods they love or hate; click a food to see who loves or hates it. You can also search above.",
      "hint.char.sel": "Selected: <b>{name}</b>. The right side shows only related foods (badge = attitude). Click a food to look it back.",
      "hint.char.nodata": "Selected: <b>{name}</b> (no preference data yet — add it in 数据/关系.txt and rebuild)",
      "hint.food.sel": "Selected: <b>{name}</b>. The left side shows only related characters (badge = attitude).",
      "hint.food.upgrade": " (upgraded from: {name})",
      "hint.food.stats": " (Love {love} · Like {like} · Hate {hate})",
      "hint.persona.hidden": "<br>⚠ The personality filter is hiding {n} characters — tap the personality chip again to clear it.",
      "hint.search": "Search: {parts} (aliases included; related items wear badges). Clear the search box to go back.",
      "hint.search.chars": "chars \"{q}\" ×{n}",
      "hint.search.foods": "foods \"{q}\" ×{n}",
      "hint.persona": "Filtered by personality \"<b>{name}</b>\".",
      "version.line": "v{v} · Data updated {date} · {chars} chars · {foods} foods",
      "btn.update": "Check Updates",
      "btn.update.checking": "Checking…",
      "btn.download": "Download App",
      "btn.about.lg": "About",
      "btn.about.sm": "About",
      "btn.lang.title": "Language",
      "lang.modal.title": "🌐 Language",
      "lang.short": "EN",
      "dl.title": "📦 Download App",
      "dl.sub": "The standalone app works without a browser, goes offline, and tells you when there's an update~",
      "dl.tag.pc": "💻 PC",
      "dl.tag.apk": "📱 Android",
      "dl.btn.gh": "GitHub",
      "dl.btn.lz": "Lanzou Cloud",
      "dl.note": "GitHub can be slow in some regions — if it gets stuck, use Lanzou Cloud (no password).<br>PC: unzip and run the exe. Android: unzip the apk and install it (allow unknown sources).",
      "about.title": "🍮 About the Author",
      "about.sub": "Trickcal Character Food Guide · A fan-made tool<br>Data collected from the KR wiki, for study and fun only. Game © Epid Games.",
      "about.github": "GitHub Repo",
      "about.web": "Web Version",
      "about.mail": "Email",
      "about.open": "Open",
      "about.copy": "Copy",
      "about.note": "Found wrong data or missing characters? Open an issue on GitHub or email me~",
      "toast.mail.copied": "Email copied: {mail}",
      "toast.mail.fail": "Copy failed — please note it down: {mail}",
      "toast.update.done": "Updated to {v}! Reloading with new data…",
      "toast.update.latest": "You're already on the latest version.",
      "toast.update.notsupport": "Online update isn't available in this mode.",
      "toast.update.fail": "Update failed: {msg}",
      "toast.update.filehint": "You opened the page by double-clicking the file, so the browser blocks online updates. Please close it and start via 打开查询器.bat in the folder."
    },
    "ko-KR": {
      "app.title": "트릭컬 · 캐릭터 음식 도감",
      "panel.chars": "캐릭터",
      "panel.foods": "음식",
      "count.unit": "{n}개",
      "search.chars.ph": "캐릭터 · 별명 검색…",
      "search.foods.ph": "음식 · 별명 검색…",
      "empty.chars": "일치하는 캐릭터가 없어요",
      "empty.foods": "일치하는 음식이 없어요",
      "persona.label": "성격",
      "att.love": "최애",
      "att.like": "좋아",
      "att.hate": "싫어",
      "persona.pure": "순수",
      "persona.resonance": "공명",
      "persona.calm": "냉정",
      "persona.frenzy": "광열",
      "persona.lively": "활발",
      "persona.gloomy": "우울",
      "hint.default": "캐릭터를 누르면 좋아하는/싫어하는 음식이, 음식을 누르면 그 음식을 좋아하거나 싫어하는 캐릭터가 표시돼요. 위에서 검색할 수도 있어요!",
      "hint.char.sel": "<b>{name}</b> 선택 중! 오른쪽에는 관련 음식만 표시돼요(오른쪽 위 배지가 태도). 음식을 눌러 반대로 확인할 수도 있어요.",
      "hint.char.nodata": "<b>{name}</b> 선택 중(아직 취향 데이터가 없어요. 「데이터/관계.txt」에 추가하고 다시 만들어 주세요)",
      "hint.food.sel": "<b>{name}</b> 선택 중! 왼쪽에는 관련 캐릭터만 표시돼요(왼쪽 위 배지가 태도).",
      "hint.food.upgrade": " ({name}의 상위 버전)",
      "hint.food.stats": " (최애 {love} · 좋아 {like} · 싫어 {hate})",
      "hint.persona.hidden": "<br>⚠ 성격 필터가 캐릭터 {n}명을 가리고 있어요. 성격 태그를 다시 누르면 해제돼요.",
      "hint.search": "검색: {parts} (별명 포함, 관련 항목에 배지 표시). 검색창을 비우면 원래 화면으로 돌아가요.",
      "hint.search.chars": "캐릭터 '{q}' {n}개",
      "hint.search.foods": "음식 '{q}' {n}개",
      "hint.persona": "성격 '<b>{name}</b>'(으)로 캐릭터를 필터링했어요.",
      "version.line": "v{v} · 데이터 업데이트 {date} · 캐릭터 {chars} · 음식 {foods}",
      "btn.update": "업데이트 확인",
      "btn.update.checking": "확인 중…",
      "btn.download": "앱 다운로드",
      "btn.about.lg": "제작자",
      "btn.about.sm": "제작자",
      "btn.lang.title": "언어",
      "lang.modal.title": "🌐 언어 선택",
      "lang.short": "한국어",
      "dl.title": "📦 앱 다운로드",
      "dl.sub": "앱은 브라우저 없이 실행되고, 오프라인에서도 쓸 수 있고, 업데이트도 알려줘요~",
      "dl.tag.pc": "💻 PC",
      "dl.tag.apk": "📱 안드로이드",
      "dl.btn.gh": "GitHub",
      "dl.btn.lz": "란조우 클라우드",
      "dl.note": "GitHub 직링크는 느릴 수 있어요. 멈추면 란조우 클라우드를 이용해 주세요(비밀번호 없음).<br>PC: 압축을 풀고 exe 실행. 안드로이드: apk를 풀어서 설치(출처 미상 앱 허용).",
      "about.title": "🍮 제작자 소개",
      "about.sub": "트릭컬 캐릭터 음식 도감 · 개인 2차 창작<br>데이터는 한국 위키에서 정리했어요. 교류·공부용일 뿐이며 게임 저작권은 Epid Games에 있어요.",
      "about.github": "GitHub 저장소",
      "about.web": "웹 버전",
      "about.mail": "이메일",
      "about.open": "열기",
      "about.copy": "복사",
      "about.note": "데이터 오류나 추가할 캐릭터가 있다면 GitHub 이슈나 메일로 알려주세요~",
      "toast.mail.copied": "이메일 복사 완료: {mail}",
      "toast.mail.fail": "복사 실패! 직접 메모해 주세요: {mail}",
      "toast.update.done": "업데이트 완료: {v}(으)로 업데이트했어요. 새 데이터를 불러오는 중…",
      "toast.update.latest": "이미 최신 버전이에요.",
      "toast.update.notsupport": "이 실행 방식에서는 온라인 업데이트를 지원하지 않아요.",
      "toast.update.fail": "업데이트 실패: {msg}",
      "toast.update.filehint": "파일을 더블클릭으로 열면 브라우저가 온라인 업데이트를 막아요. 닫고 폴더 안의 「打开查询器.bat」로 실행해 주세요."
    },
    "ja-JP": {
      "app.title": "トリカル · キャラ食べ物図鑑",
      "panel.chars": "キャラ",
      "panel.foods": "食べ物",
      "count.unit": "{n}",
      "search.chars.ph": "キャラ・別名を検索…",
      "search.foods.ph": "食べ物・別名を検索…",
      "empty.chars": "該当するキャラがいないよ",
      "empty.foods": "該当する食べ物がないよ",
      "persona.label": "性格",
      "att.love": "大好き",
      "att.like": "好き",
      "att.hate": "嫌い",
      "persona.pure": "純粋",
      "persona.resonance": "共鳴",
      "persona.calm": "冷静",
      "persona.frenzy": "狂熱",
      "persona.lively": "活発",
      "persona.gloomy": "憂鬱",
      "hint.default": "キャラをタップすると好きな/嫌いな食べ物が、食べ物をタップするとそれを好き/嫌いなキャラが表示されるよ。上の検索も使えるよ！",
      "hint.char.sel": "<b>{name}</b> を選択中！右側は関係する食べ物だけ表示（右上のバッジが態度）。食べ物をタップして逆引きもできるよ。",
      "hint.char.nodata": "<b>{name}</b> を選択中（まだ好みデータがないよ。「データ/関係.txt」に追記して再構築してね）",
      "hint.food.sel": "<b>{name}</b> を選択中！左側は関係するキャラだけ表示（左上のバッジが態度）。",
      "hint.food.upgrade": "（{name} の上位版）",
      "hint.food.stats": "（大好き {love} · 好き {like} · 嫌い {hate}）",
      "hint.persona.hidden": "<br>⚠ 性格フィルターでキャラ {n} 人が隠れてるよ。性格タグをもう一度押すと解除だよ。",
      "hint.search": "検索：{parts}（別名も含む、関連項目にバッジ付き）。検索欄を空にすると元に戻るよ。",
      "hint.search.chars": "キャラ「{q}」{n}体",
      "hint.search.foods": "食べ物「{q}」{n}種",
      "hint.persona": "性格「<b>{name}</b>」でキャラを絞り込み中。",
      "version.line": "v{v} · データ更新 {date} · キャラ {chars} · 食べ物 {foods}",
      "btn.update": "更新チェック",
      "btn.update.checking": "確認中…",
      "btn.download": "アプリDL",
      "btn.about.lg": "製作者",
      "btn.about.sm": "製作者",
      "btn.lang.title": "言語",
      "lang.modal.title": "🌐 言語切り替え",
      "lang.short": "日本語",
      "dl.title": "📦 アプリをDL",
      "dl.sub": "アプリならブラウザーなしで動くよ。オフラインでも使えて、更新もお知らせしてくれるよ〜",
      "dl.tag.pc": "💻 PC",
      "dl.tag.apk": "📱 Android",
      "dl.btn.gh": "GitHub",
      "dl.btn.lz": "ランゾウクラウド",
      "dl.note": "GitHubの直リンクは遅いことがあるよ。固まったらランゾウクラウドで（パスワードなし）。<br>PC：解凍してexeを実行。Android：apkを解凍してインストール（提供元不明を許可）。",
      "about.title": "🍮 製作者について",
      "about.sub": "トリカルキャラ食べ物図鑑 · 個人のファンメイド<br>データは韓国wikiから整理。交流・勉強用のもので、ゲームの著作権は Epid Games 様です。",
      "about.github": "GitHubリポジトリ",
      "about.web": "Web版",
      "about.mail": "メール",
      "about.open": "開く",
      "about.copy": "コピー",
      "about.note": "データの間違いや追加したいキャラがあったら、GitHubのissueかメールで教えてね〜",
      "toast.mail.copied": "メールをコピーしたよ：{mail}",
      "toast.mail.fail": "コピー失敗…手でメモしてね：{mail}",
      "toast.update.done": "更新完了：{v} に更新したよ。新しいデータで再読込中…",
      "toast.update.latest": "もう最新版だよ。",
      "toast.update.notsupport": "この開き方ではオンライン更新できないよ。",
      "toast.update.fail": "更新失敗：{msg}",
      "toast.update.filehint": "ダブルクリックで開くとブラウザーがオンライン更新をブロックするよ。閉じてからフォルダ内の「打开查询器.bat」で起動してね。"
    }
  };
  /* I18N-DICT-END（JSON 结束） */

  function dictOf(lang) { return window.I18N_DATA[lang] || null; }

  function getLang() {
    try {
      var saved = localStorage.getItem(STORE_KEY);
      if (saved && dictOf(saved)) return saved;
    } catch (e) { /* 隐私模式等 localStorage 不可用 */ }
    var nav = (navigator.language || FALLBACK).toLowerCase();
    if (nav.indexOf("ko") === 0) return "ko-KR";
    if (nav.indexOf("ja") === 0) return "ja-JP";
    if (nav.indexOf("en") === 0) return "en";
    return FALLBACK;
  }

  var listeners = [];

  function applyStatic() {
    var lang = getLang();
    document.documentElement.lang = lang;
    if (document.body) document.body.setAttribute("data-lang", lang);
    document.title = t("app.title");
    var els = document.querySelectorAll("[data-i18n],[data-i18n-html],[data-i18n-placeholder],[data-i18n-title]");
    for (var i = 0; i < els.length; i++) {
      var el = els[i];
      if (el.hasAttribute("data-i18n")) el.textContent = t(el.getAttribute("data-i18n"));
      if (el.hasAttribute("data-i18n-html")) el.innerHTML = t(el.getAttribute("data-i18n-html"));
      if (el.hasAttribute("data-i18n-placeholder")) el.setAttribute("placeholder", t(el.getAttribute("data-i18n-placeholder")));
      if (el.hasAttribute("data-i18n-title")) el.setAttribute("title", t(el.getAttribute("data-i18n-title")));
    }
    var ln = document.getElementById("langName");
    if (ln) ln.textContent = t("lang.short");
  }

  function apply() {
    applyStatic();
    for (var i = 0; i < listeners.length; i++) { try { listeners[i](); } catch (e) {} }
  }

  function setLang(id) {
    if (!dictOf(id)) return;
    try { localStorage.setItem(STORE_KEY, id); } catch (e) {}
    apply();
  }

  function t(key, vars) {
    var lang = getLang();
    var d = dictOf(lang) || {};
    var s = (key in d) ? d[key] : (dictOf(FALLBACK)[key] !== undefined ? dictOf(FALLBACK)[key] : key);
    if (vars) {
      Object.keys(vars).forEach(function (k) {
        s = s.replace(new RegExp("\\{" + k + "\\}", "g"), String(vars[k]));
      });
    }
    return s;
  }

  function has(key) {
    var lang = getLang();
    return (key in (dictOf(lang) || {})) || (key in dictOf(FALLBACK));
  }

  window.I18N = {
    t: t,
    has: has,
    langs: LANGS,
    fallback: FALLBACK,
    getLang: getLang,
    setLang: setLang,
    onChange: function (fn) { listeners.push(fn); },
    applyStatic: applyStatic
  };

  // 初次加载：套用静态文案（app.js 加载后还会再渲染动态部分）
  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", applyStatic);
  } else {
    applyStatic();
  }
})();
