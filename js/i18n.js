// Two-language support: English / Traditional Chinese. Loaded before
// shell.js on every page.
//
// How it works: the HTML is written in English and stays the fallback.
// Any element tagged `data-i18n="some.key"` gets its content swapped to
// ZH[key] when Chinese is selected, and restored to its original English
// when switching back — so there's no English copy of the resume to keep
// in sync here; edit index.html as usual and add the matching ZH entry.
//
//   <h2 data-i18n="resume.summary">Summary</h2>
//   <img data-i18n="camera.alt" data-i18n-attr="alt" alt="Captured frame">
//
// `data-i18n-attr` swaps a single attribute (alt, aria-label, content)
// instead of the element's inner HTML.
//
// Text that a script builds at runtime (scores, status lines) has no HTML
// to fall back on, so those strings live in both EN and ZH below and are
// set through I18N.bind(el, key, params); bound elements are re-rendered
// on every language change, and `{name}` placeholders are filled from
// `params`.
//
// The chosen language is remembered in localStorage across pages.
(() => {
  const STORAGE_KEY = 'ej-lang';

  const ZH = {
    // shared frame (rendered by shell.js)
    'nav.resume': '履歷',
    'nav.snake': '貪食蛇',
    'nav.camera': '相機',
    'nav.astar': 'A*',
    'nav.bezier': '貝茲曲線',
    'nav.green': '綠電系統',
    'footer.rev': '版本 2026-08 · 靜態頁面建置',
    'footer.print': '下載 PDF',
    'lang.switch': 'EN',
    'lang.switchLabel': 'Switch to English',

    // index.html
    'resume.title': 'EJ — 軟體工程師',
    'resume.description': 'EJ 的履歷 — 軟體工程師',
    'resume.eyebrow': '型號 EJ&nbsp;·&nbsp;軟體工程師',
    'resume.role': '軟體工程師 — 全端與應用系統',
    'resume.status': '開放工作機會',
    'resume.email': '電子郵件',
    'resume.location': '所在地',
    'resume.locationValue': '城市，國家',
    'resume.github': 'GITHUB',
    'resume.linkedin': 'LINKEDIN',
    'resume.summary': '簡介',
    'resume.lead': '軟體工程師，具備全端開發經驗，涵蓋 <strong>React</strong> 前端、<strong>Python</strong> 與 <strong>C#</strong> 後端，以及 <strong>MySQL</strong> 資料層。目前為能源產業打造平台，包括一套三層式架構的太陽能售電系統。習慣在小型、快速迭代的團隊中，獨立負責從資料庫結構到使用者介面的完整功能。',
    'resume.skills': '技能',
    'resume.frontend': '前端',
    'resume.backend': '後端',
    'resume.data': '資料',
    'resume.architecture': '架構',
    'resume.threeTier': '三層式應用架構設計',
    'resume.experience': '工作經歷',
    'resume.expDate': '2024 — 至今',
    'resume.expRole': '軟體工程師',
    'resume.expOrg': '公司名稱 — 儲能機櫃製造商',
    'resume.expBullet1': '在小型跨職能團隊中，開發並維護電池儲能機櫃產品的軟體。',
    'resume.expBullet2': '加入一條具體成果的描述 — 一個指標、一套上線的系統，或一項流程改善。',
    'resume.expBullet3': '加入第二條描述負責範圍：你端到端負責了什麼。',
    'resume.projects': '專案',
    'resume.fluxDesc': '以三層式架構打造的太陽能售電平台 — React 前端、FastAPI 服務層、MySQL 資料持久層。',
    'resume.projectPlaceholderName': '新增另一個專案',
    'resume.projectPlaceholderDesc': '用一到兩句話說明它的功能，以及你扮演的角色。',
    'resume.education': '學歷',
    'resume.degree': '學位，主修領域',
    'resume.school': '大學名稱 — 年份',

    // projects/snake.html + snake.js
    'snake.title': '貪食蛇 — EJ',
    'snake.description': '內建於 EJ 履歷網站的貪食蛇遊戲',
    'snake.heading': '自我測試 — 貪食蛇',
    'snake.score': '分數',
    'snake.highScore': '最高分',
    'snake.ready': '準備就緒',
    'snake.readyMsg': '按開始、方向鍵或 WASD',
    'snake.start': '開始',
    'snake.up': '上',
    'snake.left': '左',
    'snake.down': '下',
    'snake.right': '右',
    'snake.hint': '方向鍵 / WASD 控制方向 · 空白鍵開始 · 手機上可滑動',
    'snake.failed': '自我測試失敗',
    'snake.failedMsg': '分數：{score} — 按開始重試',

    // projects/camera.html + camera.js
    'camera.title': '相機 — EJ',
    'camera.description': '內建於 EJ 履歷網站的即時相機預覽',
    'camera.heading': '光學感測器',
    'camera.status': '狀態',
    'camera.enable': '啟用相機',
    'camera.capture': '擷取畫面',
    'camera.stop': '停止相機',
    'camera.download': '下載',
    'camera.lastCapture': '最近擷取',
    'camera.alt': '擷取的畫面',
    'camera.hint': '只有在你按下「啟用」時才會請求相機權限，影像串流僅保留在本機，離開此頁面時會立即停止。',
    'camera.idle': '閒置',
    'camera.off': '相機關閉',
    'camera.offMsg': '允許相機存取以開始即時擷取。所有資料都不會離開你的瀏覽器。',
    'camera.notAvailable': '無法使用',
    'camera.notAvailableMsg': '此瀏覽器或連線不支援在這裡存取相機 — 需要 HTTPS（或 localhost）。',
    'camera.unavailable': '無法使用',
    'camera.requesting': '請求中…',
    'camera.live': '運作中',
    'camera.blocked': '相機被封鎖',
    'camera.blockedStatus': '已封鎖',
    'camera.errGeneric': '啟動相機時發生錯誤。',
    'camera.errDenied': '相機存取被拒絕。請在瀏覽器的網站設定中允許後再試一次。',
    'camera.errNotFound': '此裝置上找不到相機。',
    'camera.errInUse': '相機正被其他應用程式使用中。',

    // projects/astar.html + astar.js
    'astar.title': 'A* 尋路 — EJ',
    'astar.description': '內建於 EJ 履歷網站的 A* 尋路視覺化工具',
    'astar.heading': '尋路 — A*',
    'astar.modeGroup': '格子模式',
    'astar.start': '起點',
    'astar.startHint': '點擊格子以設為起點。',
    'astar.end': '終點',
    'astar.endHint': '點擊格子以設為終點。',
    'astar.wall': '牆壁',
    'astar.wallHint': '點擊格子，或按住拖曳，將格子標記為牆壁。',
    'astar.erase': '清除牆壁',
    'astar.eraseHint': '點擊牆壁，或按住拖曳，以清除牆壁。',
    'astar.interval': '動畫間隔（毫秒）',
    'astar.run': '執行',
    'astar.stop': '停止',
    'astar.clear': '清空棋盤',
    'astar.board1': '棋盤 1 — 基準 A*：當候選格子完全相同時，先被發現的優先。',
    'astar.board2': '棋盤 2 — 相同的起點/終點/牆壁，但平手時優先選擇離目標較近的候選格子。',
    'astar.hint': '先在上方選擇模式，再點擊格子（牆壁可按住拖曳）。使用「清空棋盤」重設所有內容。',
    'astar.needStartEnd': '請先設定起點與終點。',
    'astar.searching': '搜尋中…',
    'astar.stopped': '已停止 — 已展開 {n} 個格子。',
    'astar.noPath': '找不到路徑 — 已展開 {n} 個格子。',
    'astar.pathFound': '找到路徑 — {steps} 步（已展開 {n} 個格子）。',

    // projects/bezier.html + bezier.js
    'bezier.title': '貝茲曲線 — EJ',
    'bezier.description': '內建於 EJ 履歷網站的互動式貝茲曲線 / De Casteljau 建構視覺化工具',
    'bezier.heading': '貝茲曲線建構',
    'bezier.addPoint': '新增控制點',
    'bezier.removePoint': '移除控制點',
    'bezier.hull': '控制多邊形',
    'bezier.curve': '曲線',
    'bezier.construct': 'De Casteljau 步驟',
    'bezier.pointAtT': 't 處的點',
    'bezier.hint': '拖曳控制點可移動，雙擊可移除，或用 +/− 按鈕調整數量（最少 2 個）。',
    'bezier.point': '{n} 個控制點',
    'bezier.points': '{n} 個控制點',

    // projects/green-energy.html + green-energy.js
    'green.title': '綠電系統 — EJ',
    'green.description': '內建於 EJ 履歷網站的互動式日負載曲線編輯器，以時間電價時段為背景',
    'green.heading': '綠電系統 — 負載曲線',
    'green.intro': '一天的負載曲線（96 × 15 分鐘的點），畫在台電高壓三段式時間電價的時段之上。曲線是負載的<em>形狀</em>；哪些小時算尖峰、半尖峰或離峰取決於日別，所以切換日別只會重新切分背景，曲線本身不動。',
    'green.dayType': '日別',
    'green.day.summerWeekday': '夏月一般日',
    'green.day.nonSummerWeekday': '非夏月一般日',
    'green.day.summerSaturday': '夏月週六',
    'green.day.nonSummerSaturday': '非夏月週六',
    'green.day.offPeakDay': '離峰日',
    'green.tou.peak': '尖峰',
    'green.tou.halfPeak': '半尖峰',
    'green.tou.saturdayHalfPeak': '週六半尖峰',
    'green.tou.offPeak': '離峰',
    'green.load': '負載 (kW)',
    'green.contract': '經常契約容量',
    'green.reset': '重設曲線',
    'green.status': '全日 {kwh} kWh · 最高需量 {max} kW{over}',
    'green.overContract': '（超過契約容量）',
    'green.stat.bucket': '時段',
    'green.stat.hours': '小時數',
    'green.stat.kwh': '度數 (kWh)',
    'green.stat.max': '最高需量 (kW)',
    'green.hint': '上下拖曳圓點可調整該 15 分鐘的需量（以 1 kW 為單位），滑鼠移上去可看數值。切換日別可看同一條曲線落在哪些時段。',
  };

  // English only for strings that scripts build at runtime — everything
  // else falls back to the HTML.
  const EN = {
    'lang.switch': '中文',
    'lang.switchLabel': '切換至中文',

    'snake.failed': 'SELF-TEST FAILED',
    'snake.failedMsg': 'Score: {score} — press start to retry',

    'camera.idle': 'Idle',
    'camera.off': 'CAMERA OFF',
    'camera.offMsg': 'Grant camera access to begin live capture. Nothing leaves your browser.',
    'camera.notAvailable': 'NOT AVAILABLE',
    'camera.notAvailableMsg': 'This browser or connection doesn’t support camera access here — it needs HTTPS (or localhost).',
    'camera.unavailable': 'Unavailable',
    'camera.requesting': 'Requesting…',
    'camera.live': 'Live',
    'camera.blocked': 'CAMERA BLOCKED',
    'camera.blockedStatus': 'Blocked',
    'camera.errGeneric': 'Something went wrong starting the camera.',
    'camera.errDenied': 'Camera access was denied. Allow it in your browser’s site settings, then try again.',
    'camera.errNotFound': 'No camera was found on this device.',
    'camera.errInUse': 'The camera is already in use by another app.',

    'astar.needStartEnd': 'Set a start and an end cell first.',
    'astar.searching': 'Searching…',
    'astar.stopped': 'Stopped — {n} cells expanded.',
    'astar.noPath': 'No path found — {n} cells expanded.',
    'astar.pathFound': 'Path found — {steps} steps ({n} cells expanded).',

    'bezier.point': '{n} point',
    'bezier.points': '{n} points',

    'green.tou.peak': 'Peak',
    'green.tou.halfPeak': 'Half-peak',
    'green.tou.saturdayHalfPeak': 'Saturday half-peak',
    'green.tou.offPeak': 'Off-peak',
    'green.status': 'Daily total {kwh} kWh · max demand {max} kW{over}',
    'green.overContract': ' (over contract)',
  };

  let lang = 'en';
  try {
    if (localStorage.getItem(STORAGE_KEY) === 'zh') lang = 'zh';
  } catch (_) { /* storage blocked — stay in English */ }

  // Original English content of each data-i18n element, captured the
  // first time apply() sees it so switching back is an exact restore.
  const originals = new WeakMap();
  // Elements filled through bind(): el -> { key, params }.
  const bound = new Map();

  function t(key, params) {
    let s = (lang === 'zh' && ZH[key] !== undefined) ? ZH[key] : EN[key];
    if (s === undefined) s = key;
    if (params) {
      for (const [name, value] of Object.entries(params)) {
        s = s.split('{' + name + '}').join(String(value));
      }
    }
    return s;
  }

  function bind(el, key, params) {
    if (!el) return;
    // A bound element is owned by its script from now on, not by its
    // original data-i18n markup.
    if (el.dataset.i18n !== undefined) delete el.dataset.i18n;
    if (key === null || key === undefined || key === '') {
      bound.delete(el);
      el.textContent = '';
      return;
    }
    bound.set(el, { key, params });
    el.textContent = t(key, params);
  }

  function apply() {
    document.documentElement.lang = lang === 'zh' ? 'zh-Hant' : 'en';

    document.querySelectorAll('[data-i18n]').forEach((el) => {
      const key = el.dataset.i18n;
      const attr = el.dataset.i18nAttr;
      if (attr) {
        if (!originals.has(el)) originals.set(el, el.getAttribute(attr));
        const zh = ZH[key];
        el.setAttribute(attr, (lang === 'zh' && zh !== undefined) ? zh : originals.get(el));
      } else {
        if (!originals.has(el)) originals.set(el, el.innerHTML);
        const zh = ZH[key];
        el.innerHTML = (lang === 'zh' && zh !== undefined) ? zh : originals.get(el);
      }
    });

    bound.forEach(({ key, params }, el) => {
      el.textContent = t(key, params);
    });
  }

  function set(next) {
    lang = next === 'zh' ? 'zh' : 'en';
    try { localStorage.setItem(STORAGE_KEY, lang); } catch (_) { /* ignore */ }
    apply();
    window.dispatchEvent(new CustomEvent('langchange', { detail: lang }));
  }

  function toggle() {
    set(lang === 'zh' ? 'en' : 'zh');
  }

  window.I18N = {
    get lang() { return lang; },
    t,
    bind,
    apply,
    set,
    toggle,
  };

  apply();
})();
