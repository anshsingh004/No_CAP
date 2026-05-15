(function () {
  'use strict';

  const MSG = {
    SESSION_START: 'NOCAP_SESSION_START',
    SESSION_END:   'NOCAP_SESSION_END',
    GET_STATE:     'NOCAP_GET_STATE',
  };
  const STORAGE_KEYS = {
    SESSION:  'nocap_session',
    STREAKS:  'nocap_streaks',
    SETTINGS: 'nocap_settings',
    HISTORY:  'nocap_history',
  };

  const QUOTES = [
    `"Type it. Don't paste it. Own it."`,
    `"The shortcut only feels faster."`,
    `"Every line you write yourself is a line you understand."`,
    `"Comfort zones are nice. But nothing grows there."`,
    `"The pain of discipline is far less than the pain of regret."`,
    `"Real skill is built when no one's watching."`,
    `"Hard problems are meant to be hard. That's the point."`,
    `"One more minute of focus beats one tab switch."`,
    `"You don't rise to your goals. You fall to your systems."`,
    `"The struggle today builds the strength you need tomorrow."`,
    `"Focus is the art of saying no to distractions."`,
    `"Every great coder was once a frustrated beginner."`,
  ];

  const BANDS = [
    { min:96, max:100, label:'Elite Integrity', color:'#0EA5E9', glow:'rgba(14,165,233,0.30)', badge:'🏆' },
    { min:90, max:95,  label:'Excellent',        color:'#22D3EE', glow:'rgba(34,211,238,0.30)', badge:'⭐' },
    { min:80, max:89,  label:'Strong',            color:'#38BDF8', glow:'rgba(56,189,248,0.28)', badge:'💪' },
    { min:70, max:79,  label:'Improving',         color:'#F59E0B', glow:'rgba(245,158,11,0.28)', badge:'📈' },
    { min:60, max:69,  label:'Moderate',          color:'#FB923C', glow:'rgba(251,146,60,0.28)', badge:'⚖️' },
    { min:50, max:59,  label:'Below Average',     color:'#F97316', glow:'rgba(249,115,22,0.28)', badge:'⚠️' },
    { min:40, max:49,  label:'Low',               color:'#EF4444', glow:'rgba(239,68,68,0.28)',  badge:'📉' },
    { min:20, max:39,  label:'Very Low',          color:'#DC2626', glow:'rgba(220,38,38,0.28)',  badge:'🚨' },
    { min:0,  max:19,  label:'Critical',          color:'#991B1B', glow:'rgba(153,27,27,0.28)',  badge:'💀' },
  ];

  const PENALTIES    = { COPY_PASTE: 16, TAB_SWITCH: 4 };
  const CIRCUMFERENCE = 2 * Math.PI * 52;

  const DIFF_COLORS = { Easy: '#22C55E', Medium: '#F59E0B', Hard: '#EF4444' };

  let timerInterval    = null;
  let sessionStartTime = null;
  let pollInterval     = null;

  // helpers
  function getBand(score) {
    return BANDS.find(b => score >= b.min && score <= b.max) || BANDS[BANDS.length - 1];
  }
  function formatSecs(s) {
    const m = Math.floor(s / 60), sc = Math.floor(s % 60);
    return `${String(m).padStart(2, '0')}:${String(sc).padStart(2, '0')}`;
  }
  function formatDate(iso) {
    const d = new Date(iso);
    return d.toLocaleDateString(undefined, { month: 'short', day: 'numeric' })
      + ' · ' + d.toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' });
  }
  function send(type, extra = {}) {
    return new Promise(resolve => {
      browser.runtime.sendMessage({ type, ...extra }, res => {
        if (browser.runtime.lastError) resolve(null); else resolve(res);
      });
    });
  }
  function pulse(el) {
    el.classList.remove('pulse');
    void el.offsetWidth;
    el.classList.add('pulse');
    setTimeout(() => el.classList.remove('pulse'), 400);
  }

  // difficulty badge
  function updateDifficultyBadge(diff) {
    const badge = document.getElementById('difficulty-badge');
    if (!badge) return;
    if (!diff || diff === 'Unknown') {
      badge.textContent    = 'Detecting...';
      badge.style.color    = 'var(--sky)';
      badge.style.borderColor = '';
      badge.style.background  = '';
    } else {
      const c = DIFF_COLORS[diff] || 'var(--sky)';
      badge.textContent    = diff;
      badge.style.color    = c;
      badge.style.borderColor = c + '55';
      badge.style.background  = c + '15';
    }
  }

  // tab switching
  document.querySelectorAll('.tab-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      document.querySelectorAll('.tab-btn').forEach(b => {
        b.classList.remove('active'); b.setAttribute('aria-selected', 'false');
      });
      document.querySelectorAll('.tab-content').forEach(c => c.classList.add('hidden'));
      btn.classList.add('active'); btn.setAttribute('aria-selected', 'true');
      const id = btn.dataset.tab;
      const el = document.getElementById(`tab-content-${id}`);
      if (el) el.classList.remove('hidden');
      if (id === 'history') renderHistory();
    });
  });

  document.getElementById('btn-settings')?.addEventListener('click', () => {
    document.querySelector('.tab-btn[data-tab="settings-panel"]')?.click();
  });

  // score ring
  function updateScoreRing(score) {
    const band   = getBand(score);
    const offset = CIRCUMFERENCE * (1 - score / 100);
    const fill   = document.getElementById('ring-fill');
    const sn     = document.getElementById('score-number');
    const sb     = document.getElementById('score-band');
    const s1     = document.getElementById('grad-stop-1');
    const s2     = document.getElementById('grad-stop-2');
    const ring   = document.querySelector('.score-ring');
    if (!fill) return;
    fill.style.strokeDashoffset = offset;
    sn.textContent = score; sn.style.color = band.color;
    sb.textContent = band.label; sb.style.color = band.color;
    s1.setAttribute('stop-color', band.color);
    s2.setAttribute('stop-color', band.glow.replace(/[\d.]+\)$/, '0.6)'));
    ring.style.filter = `drop-shadow(0 0 12px ${band.glow})`;
  }

  // penalty hints
  function updatePenaltyHints(events) {
    const ph_paste  = document.getElementById('ph-paste');
    const ph_switch = document.getElementById('ph-switch');
    if (ph_paste)  ph_paste.textContent  = `−${events.pastes * PENALTIES.COPY_PASTE} pts`;
    if (ph_switch) ph_switch.textContent = `−${events.tabSwitches * PENALTIES.TAB_SWITCH} pts`;
  }

  // polling
  function startPolling() {
    pollInterval = setInterval(async () => {
      const s = await send(MSG.GET_STATE);
      if (s?.session?.active) renderActive(s);
    }, 2000);
  }
  function stopPolling() { clearInterval(pollInterval); pollInterval = null; }

  // timer
  function startTimer(startTime) {
    if (startTime) sessionStartTime = startTime;
    else if (!sessionStartTime) sessionStartTime = Date.now();
    if (timerInterval) clearInterval(timerInterval);
    timerInterval = setInterval(() => {
      const elapsed = Math.floor((Date.now() - sessionStartTime) / 1000);
      const el = document.getElementById('session-timer');
      if (el) el.textContent = formatSecs(elapsed);
    }, 1000);
  }
  function stopTimer() { clearInterval(timerInterval); timerInterval = null; sessionStartTime = null; }

  // state switcher
  function showState(name) {
    ['wrong-tab', 'idle', 'active', 'summary'].forEach(n => {
      const el = document.getElementById(`state-${n}`);
      if (!el) return;
      if (n === name) el.classList.remove('hidden'); else el.classList.add('hidden');
    });
    if (name === 'active') {
      const qEl = document.getElementById('session-quote');
      if (qEl) qEl.textContent = QUOTES[Math.floor(Math.random() * QUOTES.length)];
    }
  }

  // render: idle
  function renderIdle(streaks) {
    const cv = document.getElementById('streak-current-val');
    const bv = document.getElementById('streak-best-val');
    if (cv) cv.textContent = streaks?.current || 0;
    if (bv) bv.textContent = streaks?.best || 0;
  }

  // render: active
  function renderActive(state) {
    const s = state.session;
    updateScoreRing(s.score);
    const pEl  = document.getElementById('stat-pastes-val');
    const wEl  = document.getElementById('stat-switches-val');
    const oEl  = document.getElementById('stat-outside-val');
    const stEl = document.getElementById('live-streak');
    const beEl = document.getElementById('live-best');
    if (pEl) {
      const prev = pEl.textContent;
      pEl.textContent = s.events.pastes;
      if (prev !== String(s.events.pastes)) pulse(document.getElementById('stat-pastes'));
    }
    if (wEl) {
      const prev = wEl.textContent;
      wEl.textContent = s.events.tabSwitches;
      if (prev !== String(s.events.tabSwitches)) pulse(document.getElementById('stat-switches'));
    }
    if (oEl)  oEl.textContent  = `${Math.round(s.timeOutside)}s`;
    if (stEl) stEl.textContent = state.streaks?.current || 0;
    if (beEl) beEl.textContent = state.streaks?.best || 0;
    updatePenaltyHints(s.events);
    updateDifficultyBadge(s.difficulty);

    // set quote if empty (re-open while session active)
    const qEl = document.getElementById('session-quote');
    if (qEl && !qEl.textContent.trim()) {
      qEl.textContent = QUOTES[Math.floor(Math.random() * QUOTES.length)];
    }
  }

  // render: summary
  function renderSummary(session, streaks, penaltyBreakdown) {
    const band = getBand(session.score);
    const ss   = document.getElementById('summary-score');
    const sb   = document.getElementById('summary-band');
    const sbg  = document.getElementById('summary-badge');
    if (ss)  { ss.textContent = session.score; ss.style.color = band.color; }
    if (sb)  { sb.textContent = band.label;    sb.style.color = band.color; }
    if (sbg)   sbg.textContent = band.badge;

    const sdiff = document.getElementById('summary-difficulty');
    if (sdiff) {
      const diff = session.difficulty || 'Unknown';
      sdiff.textContent = diff;
      const c = DIFF_COLORS[diff];
      if (c) {
        sdiff.style.color       = c;
        sdiff.style.borderColor = c + '55';
        sdiff.style.background  = c + '15';
      } else {
        sdiff.style.color = sdiff.style.borderColor = sdiff.style.background = '';
      }
    }

    // penalty breakdown
    const table   = document.getElementById('breakdown-table');
    const totalEl = document.getElementById('breakdown-total-val');
    if (table) {
      table.innerHTML = '';
      const rows = penaltyBreakdown || [];
      let totalDeducted = 0;
      if (rows.length === 0) {
        table.innerHTML = `<div class="breakdown-row"><span class="bd-label" style="color:rgba(15,23,42,0.4)">No penalties — perfect session!</span></div>`;
      } else {
        rows.forEach(r => {
          totalDeducted += r.total;
          const row = document.createElement('div');
          row.className = 'breakdown-row';
          row.innerHTML = `
            <span class="bd-label">${r.label}</span>
            <span class="bd-count">${r.count}×</span>
            <span class="bd-per">−${r.perEvent}</span>
            <span class="bd-total">−${r.total} pts</span>
          `;
          table.appendChild(row);
        });
      }
      if (totalEl) totalEl.textContent = `${totalDeducted} pts`;
    }

    document.getElementById('sum-duration').textContent = formatSecs(session.timeActive || 0);

    const icons = { up: '🔥', hold: '✊', down: '📉' };
    const siEl  = document.getElementById('streak-result-icon');
    const smEl  = document.getElementById('streak-result-main');
    const sgEl  = document.getElementById('streak-result-msg');
    if (siEl) siEl.textContent = icons[streaks?.lastStrength] || '🔥';
    if (smEl) smEl.textContent = `Streak: ${streaks?.current || 0}  ·  Best: ${streaks?.best || 0}`;
    if (sgEl) sgEl.textContent = streaks?.lastMsg || '—';
  }

  // render: history
  async function renderHistory() {
    const data    = await browser.storage.local.get(STORAGE_KEYS.HISTORY);
    const history = data[STORAGE_KEYS.HISTORY] || [];
    const list    = document.getElementById('history-list');
    if (!list) return;
    list.innerHTML = '';

    if (history.length === 0) {
      list.innerHTML = '<div class="history-empty"><div class="empty-icon">📭</div><p>No sessions yet.</p></div>';
      return;
    }

    history.forEach(h => {
      const band  = getBand(h.score);
      const entry = document.createElement('div');
      entry.className = 'history-entry';

      const breakdown = (h.penaltyBreakdown || []).map(r =>
        `<span class="history-breakdown-pill">${r.label}: −${r.total}</span>`
      ).join('');

      entry.innerHTML = `
        <div class="history-entry-top">
          <div class="history-score-badge" style="background:${band.glow};color:${band.color}">${h.score}</div>
          <div class="history-entry-info">
            <div class="history-entry-band" style="color:${band.color}">${band.label}</div>
            <div class="history-entry-meta">${formatDate(h.date)} · ${formatSecs(h.duration || 0)}</div>
          </div>
        </div>
        <div class="history-breakdown">${breakdown || '<span class="history-breakdown-pill" style="color:rgba(14,165,233,0.7);border-color:rgba(14,165,233,0.2);background:rgba(14,165,233,0.06)">No penalties</span>'}</div>
      `;
      list.appendChild(entry);
    });
  }

  // settings
  async function loadSettings() {
    const data = await browser.storage.local.get(STORAGE_KEYS.SETTINGS);
    const s    = data[STORAGE_KEYS.SETTINGS] || {};
    const en   = document.getElementById('setting-enabled');
    const iv   = document.getElementById('setting-interventions');
    const ov   = document.getElementById('setting-overlay');
    if (en) en.checked = s.enabled !== false;
    if (iv) iv.checked = s.interventionsEnabled !== false;
    if (ov) ov.checked = s.showOverlay !== false;
  }
  async function saveSettings() {
    await browser.storage.local.set({ [STORAGE_KEYS.SETTINGS]: {
      enabled:              document.getElementById('setting-enabled')?.checked !== false,
      interventionsEnabled: document.getElementById('setting-interventions')?.checked !== false,
      showOverlay:          document.getElementById('setting-overlay')?.checked !== false,
    }});
  }
  ['setting-enabled', 'setting-interventions', 'setting-overlay'].forEach(id => {
    document.getElementById(id)?.addEventListener('change', saveSettings);
  });

  // active tab check
  async function isOnLeetCode() {
    return new Promise(resolve => {
      browser.tabs.query({ active: true, currentWindow: true }, tabs => {
        if (browser.runtime.lastError || !tabs || tabs.length === 0) { resolve(false); return; }
        const url  = (tabs[0]?.url || tabs[0]?.pendingUrl || '').toLowerCase();
        const isLC = url.includes('leetcode.com') && (
          url.includes('/problems/') || url.includes('/contest/')
        );
        resolve(isLC);
      });
    });
  }

  // notify content scripts
  async function notifyTabs(message) {
    const tabs = await new Promise(r => browser.tabs.query({}, r));
    tabs.forEach(tab => browser.tabs.sendMessage(tab.id, message).catch(() => {}));
  }

  // button handlers
  document.getElementById('btn-start')?.addEventListener('click', async () => {
    const res = await send(MSG.SESSION_START);
    if (res?.ok) {
      showState('active');
      startTimer(res.session.startTime);
      startPolling();
      renderActive({ session: res.session, streaks: { current: 0, best: 0 } });
      notifyTabs({ type: 'NOCAP_SESSION_TOGGLE', active: true });
    }
  });

  document.getElementById('btn-end')?.addEventListener('click', async () => {
    stopTimer(); stopPolling();
    const res = await send(MSG.SESSION_END);
    if (res?.ok) {
      showState('summary');
      renderSummary(res.session, res.streaks, res.penaltyBreakdown);
      renderIdle(res.streaks);
      notifyTabs({ type: 'NOCAP_SESSION_TOGGLE', active: false });
    }
  });

  document.getElementById('btn-new-session')?.addEventListener('click', async () => {
    const data = await browser.storage.local.get(STORAGE_KEYS.STREAKS);
    renderIdle(data[STORAGE_KEYS.STREAKS]);
    showState('idle');
  });

  document.getElementById('btn-clear-history')?.addEventListener('click', async () => {
    await browser.storage.local.remove(STORAGE_KEYS.HISTORY);
    renderHistory();
  });
  document.getElementById('btn-reset-streaks')?.addEventListener('click', async () => {
    if (confirm('Reset streak data?')) {
      await browser.storage.local.set({ [STORAGE_KEYS.STREAKS]: { current: 0, best: 0, lastScore: null } });
      renderIdle({ current: 0, best: 0 });
    }
  });
  document.getElementById('btn-reset-all')?.addEventListener('click', async () => {
    if (confirm('Reset ALL NoCap data? Cannot be undone.')) {
      await browser.storage.local.clear();
      renderIdle({}); renderHistory();
    }
  });

  // difficulty update listener
  browser.runtime.onMessage.addListener(message => {
    if (message.type === 'NOCAP_DIFFICULTY_UPDATE') {
      updateDifficultyBadge(message.difficulty);
    }
  });

  // boot
  async function boot() {
    await loadSettings();

    const onLeetCode = await isOnLeetCode();
    if (!onLeetCode) {
      const state = await send(MSG.GET_STATE);
      if (state?.session?.active) {
        showState('active');
        startTimer(state.session.startTime);
        startPolling();
        renderActive(state);
      } else {
        showState('wrong-tab');
      }
      return;
    }

    const state = await send(MSG.GET_STATE);
    if (!state) { showState('idle'); return; }

    if (state.session?.active) {
      showState('active');
      startTimer(state.session.startTime);
      startPolling();
      renderActive(state);
      updateDifficultyBadge(state.session.difficulty);
    } else {
      showState('idle');
      renderIdle(state.streaks);
    }
  }

  boot();
})();
