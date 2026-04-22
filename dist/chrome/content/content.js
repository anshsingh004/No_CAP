/**
 * content.js
 * Injected ONLY on: leetcode.com/problems/* and leetcode.com/contest/*
 * Tracks: paste, tab visibility (hide only), keystrokes.
 * Detects: problem difficulty and page type, sends to background.
 */

(function () {
  'use strict';

  const MSG = {
    TRACKING_EVENT: 'NOCAP_TRACKING_EVENT',
    SESSION_START:  'NOCAP_SESSION_START',
    SESSION_END:    'NOCAP_SESSION_END',
    GET_STATE:      'NOCAP_GET_STATE',
    PAGE_INFO:      'NOCAP_PAGE_INFO',
  };

  const INTERVENTION_MESSAGES = {
    paste:     ["You're bypassing the struggle. That's where growth happens.", "Copy-paste is a shortcut. Shortcuts don't build mastery."],
    tabSwitch: ["Stay with the problem. Your brain is close.", "Focus is the rarest skill in coding. Protect it."],
    longExit:  ["You've been away a while. Get back in the zone.", "Long breaks break momentum. Refocus now."],
  };

  // ─── State ──────────────────────────────────────────────────────────────────
  let sessionActive = false;
  let lastScore = 100;
  let keystrokeBuffer = { count: 0, lines: 0, timer: null };
  let difficultyDetected = null;
  let pageInfoSent = false;

  // ─── Messaging ──────────────────────────────────────────────────────────────
  function send(type, extra = {}) {
    return new Promise(resolve => {
      browser.runtime.sendMessage({ type, ...extra }, res => {
        if (browser.runtime.lastError) resolve(null);
        else resolve(res);
      });
    });
  }

  function pickRandom(arr) { return arr[Math.floor(Math.random() * arr.length)]; }

  // ─── Page Info Detection ─────────────────────────────────────────────────────
  function detectPageType() {
    const url = window.location.href;
    if (url.includes('leetcode.com/contest/')) return 'contest';
    return 'problem';
  }

  function detectDifficulty() {
    // Strategy 1: Scan for text nodes
    const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
    let node;
    while ((node = walker.nextNode())) {
      const t = node.textContent.trim();
      if (['Easy', 'Medium', 'Hard'].includes(t)) return t.toLowerCase();
    }

    // Strategy 2: Look in scripts
    const scripts = document.querySelectorAll('script');
    for (const s of scripts) {
      const m = s.textContent.match(/"difficulty"\s*:\s*"(Easy|Medium|Hard)"/i);
      if (m) return m[1].toLowerCase();
    }
    return null;
  }

  function tryDetectAndSendPageInfo() {
    const pageType  = detectPageType();
    const difficulty = detectDifficulty();
    if (difficulty) {
      difficultyDetected = difficulty;
      pageInfoSent = true;
      send(MSG.PAGE_INFO, { data: { pageType, difficulty } });
      return true;
    }
    return false;
  }

  // Retry detection with backoff
  function scheduleDetection(attempts = 0) {
    if (pageInfoSent || attempts > 6) return;
    const delay = [500, 1500, 3000, 5000, 8000, 12000][attempts] || 12000;
    setTimeout(() => {
      if (!tryDetectAndSendPageInfo()) scheduleDetection(attempts + 1);
    }, delay);
  }

  // ─── Toast UI ────────────────────────────────────────────────────────────────
  function injectStyles() {
    if (document.getElementById('nocap-styles')) return;
    const style = document.createElement('style');
    style.id = 'nocap-styles';
    style.textContent = `
      #nocap-toast-container {
        position:fixed; bottom:24px; right:24px; z-index:2147483647;
        display:flex; flex-direction:column-reverse; gap:10px; pointer-events:none;
        font-family:'Inter','Segoe UI',system-ui,sans-serif;
      }
      .nocap-toast {
        background:linear-gradient(135deg,#061b2e 0%,#0a2a3d 100%);
        border:1px solid rgba(0,255,255,0.15); border-radius:12px;
        padding:12px 16px; max-width:320px; min-width:240px;
        pointer-events:all; box-shadow:0 8px 32px rgba(0,0,0,0.7),0 0 0 1px rgba(0,255,255,0.05);
        transform:translateX(120%); opacity:0;
        transition:transform 0.4s cubic-bezier(0.175,0.885,0.32,1.275),opacity 0.3s ease;
        cursor:pointer; border-left:3px solid #00FFFF;
      }
      .nocap-toast.visible { transform:translateX(0); opacity:1; }
      .nocap-toast.hiding  { transform:translateX(120%); opacity:0; }
      .nocap-toast.paste   { border-left-color:#EF4444; }
      .nocap-toast.tab     { border-left-color:#FBBF24; }
      .nocap-toast.long    { border-left-color:#A78BFA; }
      .nocap-toast-header  { display:flex; align-items:center; gap:8px; margin-bottom:5px; }
      .nocap-toast-icon    { font-size:16px; }
      .nocap-toast-label   { font-size:9px; font-weight:700; letter-spacing:1.5px; text-transform:uppercase; color:rgba(255,255,255,0.4); }
      .nocap-toast-score   { margin-left:auto; font-size:10px; font-weight:700; padding:1px 7px; border-radius:20px; background:rgba(0,255,255,0.1); color:#00FFFF; }
      .nocap-toast-msg     { font-size:12px; font-weight:500; line-height:1.5; color:rgba(255,255,255,0.85); }
      .nocap-toast-penalty { margin-top:6px; font-size:10px; font-weight:700; color:#EF4444; }

      #nocap-overlay {
        position:fixed; top:14px; right:14px; z-index:2147483646;
        background:linear-gradient(135deg,rgba(6,27,46,0.97) 0%,rgba(10,42,61,0.97) 100%);
        border:1px solid rgba(0,255,255,0.2); border-radius:14px;
        padding:10px 14px; font-family:'Inter','Segoe UI',system-ui,sans-serif;
        backdrop-filter:blur(16px); box-shadow:0 4px 24px rgba(0,0,0,0.6),0 0 20px rgba(0,255,255,0.05);
        display:flex; align-items:center; gap:10px;
        transform:translateY(-80px); opacity:0;
        transition:all 0.4s cubic-bezier(0.175,0.885,0.32,1.275); pointer-events:none;
      }
      #nocap-overlay.visible { transform:translateY(0); opacity:1; }
      .nocap-ov-logo   { font-size:15px; }
      .nocap-ov-wrap   { display:flex; flex-direction:column; gap:1px; }
      .nocap-ov-label  { font-size:8px; font-weight:700; letter-spacing:1.5px; text-transform:uppercase; color:rgba(0,255,255,0.4); }
      .nocap-ov-score  { font-size:20px; font-weight:900; color:#fff; line-height:1; transition:color 0.5s; }
      .nocap-ov-band   { font-size:8px; font-weight:700; transition:color 0.5s; }
      .nocap-ov-bar-bg { height:3px; background:rgba(255,255,255,0.08); border-radius:3px; overflow:hidden; width:70px; }
      .nocap-ov-bar    { height:100%; border-radius:3px; transition:width 0.5s,background 0.5s,box-shadow 0.5s; }
      .nocap-ov-streak { font-size:10px; font-weight:700; color:#FBBF24; display:flex; align-items:center; gap:2px; white-space:nowrap; }
    `;
    document.head.appendChild(style);
  }

  function getContainer() {
    let el = document.getElementById('nocap-toast-container');
    if (!el) { el = document.createElement('div'); el.id='nocap-toast-container'; document.body.appendChild(el); }
    return el;
  }

  function showToast({ type, message, penalty, score, band }) {
    const iconMap  = { paste:'📋', tab:'👁️', long:'⏳' };
    const labelMap = { paste:'Paste Detected', tab:'Tab Switch', long:'Long Absence' };
    const toast = document.createElement('div');
    toast.className = `nocap-toast ${type}`;
    toast.innerHTML = `
      <div class="nocap-toast-header">
        <span class="nocap-toast-icon">${iconMap[type]||'⚠️'}</span>
        <span class="nocap-toast-label">${labelMap[type]||'Alert'}</span>
        ${score!==undefined?`<span class="nocap-toast-score">${score}</span>`:''}
      </div>
      <div class="nocap-toast-msg">${message}</div>
      ${penalty?`<div class="nocap-toast-penalty">−${penalty} pts</div>`:''}
    `;
    toast.addEventListener('click', () => dismiss(toast));
    getContainer().appendChild(toast);
    requestAnimationFrame(()=>requestAnimationFrame(()=>toast.classList.add('visible')));
    setTimeout(() => dismiss(toast), 5000);
  }

  function dismiss(toast) {
    if (toast.classList.contains('hiding')) return;
    toast.classList.remove('visible'); toast.classList.add('hiding');
    setTimeout(() => toast.remove(), 400);
  }

  // ─── Score Overlay ───────────────────────────────────────────────────────────
  function createOverlay() {
    if (document.getElementById('nocap-overlay')) return;
    const el = document.createElement('div');
    el.id = 'nocap-overlay';
    el.innerHTML = `
      <div class="nocap-ov-logo">🔒</div>
      <div class="nocap-ov-wrap">
        <div class="nocap-ov-label">Integrity</div>
        <div class="nocap-ov-score" id="ncov-score">100</div>
        <div class="nocap-ov-band"  id="ncov-band">Elite</div>
        <div class="nocap-ov-bar-bg"><div class="nocap-ov-bar" id="ncov-bar" style="width:100%;background:#00FFFF"></div></div>
      </div>
      <div class="nocap-ov-streak" id="ncov-streak">🔥 —</div>
    `;
    document.body.appendChild(el);
    requestAnimationFrame(()=>requestAnimationFrame(()=>el.classList.add('visible')));
  }

  function updateOverlay(score, band, streak) {
    const sc = document.getElementById('ncov-score');
    const bd = document.getElementById('ncov-band');
    const br = document.getElementById('ncov-bar');
    const st = document.getElementById('ncov-streak');
    if (!sc) return;
    sc.textContent = score; sc.style.color = band?.color||'#fff';
    bd.textContent = band?.label||''; bd.style.color = band?.color||'rgba(0,255,255,0.5)';
    br.style.width = `${score}%`; br.style.background = band?.color||'#00FFFF';
    br.style.boxShadow = `0 0 6px ${band?.color||'#00FFFF'}`;
    if (st) st.textContent = streak > 0 ? `🔥 ${streak}` : '—';
  }

  // ─── Paste Tracking ──────────────────────────────────────────────────────────
  document.addEventListener('paste', async () => {
    if (!sessionActive) return;
    const res = await send(MSG.TRACKING_EVENT, { event: 'paste' });
    if (res?.score !== undefined) {
      const dropped = lastScore - res.score;
      lastScore = res.score;
      showToast({ type:'paste', message:pickRandom(INTERVENTION_MESSAGES.paste), penalty:dropped, score:res.score, band:res.band });
      updateOverlay(res.score, res.band, null);
    }
  }, true);

  // ─── Tab Visibility Tracking ─────────────────────────────────────────────────
  let exitTime = null;

  document.addEventListener('visibilitychange', async () => {
    if (!sessionActive) return;

    if (document.hidden) {
      // User LEFT the LeetCode tab
      exitTime = Date.now();
      const res = await send(MSG.TRACKING_EVENT, { event: 'tabHide' });
      if (res?.score !== undefined) {
        const dropped = lastScore - res.score;
        lastScore = res.score;
        showToast({ type:'tab', message:pickRandom(INTERVENTION_MESSAGES.tabSwitch), penalty:dropped, score:res.score, band:res.band });
        updateOverlay(res.score, res.band, null);
      }
    } else {
      // User RETURNED to LeetCode tab
      const res = await send(MSG.TRACKING_EVENT, { event: 'tabReturn' });
      if (res?.score !== undefined) {
        const dropped = lastScore - res.score;
        if (exitTime && (Date.now() - exitTime) > 10000) {
          // Long absence notification
          showToast({ type:'long', message:pickRandom(INTERVENTION_MESSAGES.longExit), penalty:dropped>0?dropped:null, score:res.score, band:res.band });
        }
        lastScore = res.score;
        updateOverlay(res.score, res.band, null);
      }
      exitTime = null;
    }
  });

  // ─── Keystroke Tracking ──────────────────────────────────────────────────────
  document.addEventListener('keydown', (e) => {
    if (!sessionActive) return;
    keystrokeBuffer.count++;
    if (e.key === 'Enter') keystrokeBuffer.lines++;
    clearTimeout(keystrokeBuffer.timer);
    keystrokeBuffer.timer = setTimeout(flushKeystrokes, 3000);
  }, true);

  async function flushKeystrokes() {
    if (keystrokeBuffer.count === 0) return;
    const p = { count: keystrokeBuffer.count, lines: keystrokeBuffer.lines };
    keystrokeBuffer.count = 0; keystrokeBuffer.lines = 0;
    await send(MSG.TRACKING_EVENT, { event: 'keystrokes', data: p });
  }

  // ─── Message Listener ────────────────────────────────────────────────────────
  browser.runtime.onMessage.addListener(message => {
    if (message.type === 'NOCAP_SESSION_TOGGLE') {
      sessionActive = message.active;
      if (message.active) {
        createOverlay();
        if (!pageInfoSent) scheduleDetection();
      } else {
        const ov = document.getElementById('nocap-overlay');
        if (ov) { ov.classList.remove('visible'); setTimeout(() => ov.remove(), 400); }
      }
    }
    if (message.type === 'NOCAP_SCORE_UPDATE') {
      updateOverlay(message.score, message.band, message.streak);
      lastScore = message.score;
    }
  });

  // ─── Boot ────────────────────────────────────────────────────────────────────
  injectStyles();

  send(MSG.GET_STATE).then(state => {
    if (state?.session?.active) {
      sessionActive = true;
      lastScore = state.session.score;
      createOverlay();
      updateOverlay(state.session.score, state.band, state.streaks?.current);
    }
    // Always try to detect and send page info
    if (!tryDetectAndSendPageInfo()) scheduleDetection();
  });

})();
