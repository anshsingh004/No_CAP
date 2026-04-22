/**
 * background.js – MV3 Service Worker
 * Scoring, streak, session, and message routing.
 */

import {
  SCORING, BEHAVIOR_THRESHOLDS, STREAK_RULES,
  MESSAGES, STORAGE_KEYS, DEFAULT_SETTINGS,
} from '../lib/constants.js';

// ─── State ────────────────────────────────────────────────────────────────────
let session  = createEmptySession();
let streaks  = { current: 0, best: 0, lastScore: null, lastMsg: '', lastStrength: '' };
let settings = { ...DEFAULT_SETTINGS };
let initialized = false;

// ─── Session Factory ──────────────────────────────────────────────────────────
function createEmptySession() {
  return {
    id: Date.now().toString(36),
    startTime: null, endTime: null, active: false,
    score: 100, penalties: 0,
    events: { pastes: 0, tabSwitches: 0, keystrokes: 0, linesTyped: 0 },
    timeOutside: 0,           // seconds (cumulative)
    timeActive: 0,
    minutePenaltiesApplied: 0,// how many 60s outside-penalties have fired
    lastExitTime: null,
    difficulty: 'medium',     // set by content script
    pageType: 'problem',      // 'problem' | 'contest'
    behaviorClass: 'Unknown',
    speedPenaltyApplied: 0,
  };
}

// ─── Init ─────────────────────────────────────────────────────────────────────
async function initialize() {
  if (initialized) return;
  initialized = true;
  const data = await browser.storage.local.get([
    STORAGE_KEYS.STREAKS, STORAGE_KEYS.SETTINGS, STORAGE_KEYS.SESSION,
  ]);
  if (data[STORAGE_KEYS.STREAKS])          streaks  = data[STORAGE_KEYS.STREAKS];
  if (data[STORAGE_KEYS.SETTINGS])         settings = { ...DEFAULT_SETTINGS, ...data[STORAGE_KEYS.SETTINGS] };
  if (data[STORAGE_KEYS.SESSION]?.active)  session  = data[STORAGE_KEYS.SESSION];
}

// ─── Scoring ──────────────────────────────────────────────────────────────────
function applyPenalty(type) {
  const penalty = SCORING.PENALTIES[type] ?? 0;
  session.score = Math.max(0, session.score - penalty);
  session.penalties += penalty;
  return penalty;
}

function getScoreBand(score) {
  return SCORING.BANDS.find(b => score >= b.min && score <= b.max) || SCORING.BANDS[SCORING.BANDS.length - 1];
}

// ─── Behavior Classification ──────────────────────────────────────────────────
function classifyBehavior(durationMin, pageType, difficulty) {
  const tiers = (BEHAVIOR_THRESHOLDS[pageType] || BEHAVIOR_THRESHOLDS.problem)[difficulty]
    || BEHAVIOR_THRESHOLDS.problem.medium;
  for (const tier of tiers) {
    if (durationMin < tier.max) return tier;
  }
  return tiers[tiers.length - 1];
}

// ─── Streak ───────────────────────────────────────────────────────────────────
function updateStreak(finalScore) {
  const rule = STREAK_RULES.find(r => finalScore >= r.min && finalScore <= r.max);
  if (!rule) return;

  if (rule.currentDelta === -99) {
    streaks.current = 0;
  } else {
    streaks.current = Math.max(0, (streaks.current || 0) + rule.currentDelta);
  }
  if (rule.updateBest) {
    streaks.best = Math.max(streaks.best || 0, streaks.current);
  }
  streaks.lastScore    = finalScore;
  streaks.lastMsg      = rule.msg;
  streaks.lastStrength = rule.currentDelta > 0 ? 'up' : rule.currentDelta === 0 ? 'hold' : 'down';
}

// ─── Penalty Breakdown ────────────────────────────────────────────────────────
function buildPenaltyBreakdown(sess) {
  const P = SCORING.PENALTIES;
  const rows = [];

  if (sess.events.tabSwitches > 0) {
    rows.push({ label: 'Tab Switches', count: sess.events.tabSwitches, perEvent: P.TAB_SWITCH, total: sess.events.tabSwitches * P.TAB_SWITCH });
  }
  if (sess.events.pastes > 0) {
    rows.push({ label: 'Copy-Paste', count: sess.events.pastes, perEvent: P.COPY_PASTE, total: sess.events.pastes * P.COPY_PASTE });
  }
  if (sess.minutePenaltiesApplied > 0) {
    rows.push({ label: 'Minutes Outside', count: sess.minutePenaltiesApplied, perEvent: P.TIME_OUTSIDE_MINUTE, total: sess.minutePenaltiesApplied * P.TIME_OUTSIDE_MINUTE });
  }
  if (sess.speedPenaltyApplied > 0) {
    rows.push({ label: 'Speed Penalty', count: 1, perEvent: sess.speedPenaltyApplied, total: sess.speedPenaltyApplied });
  }
  return rows;
}

// ─── Session Management ───────────────────────────────────────────────────────
async function startSession() {
  session = createEmptySession();
  session.active    = true;
  session.startTime = Date.now();
  await persistSession();
}

async function endSession() {
  if (!session.active) return null;
  session.active    = false;
  session.endTime   = Date.now();
  session.timeActive = Math.round((session.endTime - session.startTime) / 1000);

  const durationMin = session.timeActive / 60;
  const tier = classifyBehavior(durationMin, session.pageType, session.difficulty);
  session.behaviorClass = tier.label;

  if (tier.speedPenalty) {
    const pen = applyPenalty(tier.speedPenalty);
    session.speedPenaltyApplied = pen;
  }

  const finalScore = Math.max(0, Math.min(100, session.score));
  session.score = finalScore;

  updateStreak(finalScore);

  const penaltyBreakdown = buildPenaltyBreakdown(session);

  const histData = await browser.storage.local.get(STORAGE_KEYS.HISTORY);
  const history  = histData[STORAGE_KEYS.HISTORY] || [];
  history.unshift({
    id: session.id,
    date: new Date(session.startTime).toISOString(),
    score: finalScore,
    band: getScoreBand(finalScore).label,
    events: { ...session.events },
    timeOutside: session.timeOutside,
    minutePenaltiesApplied: session.minutePenaltiesApplied,
    behaviorClass: session.behaviorClass,
    difficulty: session.difficulty,
    pageType: session.pageType,
    duration: session.timeActive,
    penaltyBreakdown,
    streakSnapshot: { ...streaks },
  });
  if (history.length > 50) history.pop();

  await browser.storage.local.set({
    [STORAGE_KEYS.STREAKS]: streaks,
    [STORAGE_KEYS.HISTORY]: history,
    [STORAGE_KEYS.SESSION]: session,
  });

  return { session, streaks, penaltyBreakdown };
}

async function persistSession() {
  await browser.storage.local.set({ [STORAGE_KEYS.SESSION]: session });
}

// ─── Event Handlers ───────────────────────────────────────────────────────────
async function handlePaste() {
  if (!session.active || !settings.enabled) return;
  session.events.pastes++;
  applyPenalty('COPY_PASTE');
  await persistSession();
}

async function handleTabHide() {
  // Called only when user leaves the LeetCode tab
  if (!session.active || !settings.enabled) return;
  session.events.tabSwitches++;
  applyPenalty('TAB_SWITCH');
  session.lastExitTime = Date.now();
  await persistSession();
}

async function handleTabReturn() {
  // Called when user returns to the LeetCode tab
  if (!session.active || !settings.enabled || !session.lastExitTime) return;
  const elapsed = (Date.now() - session.lastExitTime) / 1000;
  session.timeOutside += elapsed;
  session.lastExitTime = null;

  // Apply cumulative minute penalties
  const totalMinutes = Math.floor(session.timeOutside / 60);
  while (session.minutePenaltiesApplied < totalMinutes) {
    applyPenalty('TIME_OUTSIDE_MINUTE');
    session.minutePenaltiesApplied++;
  }
  await persistSession();
}

async function handleKeystrokes(data) {
  if (!session.active || !settings.enabled) return;
  session.events.keystrokes += data.count || 0;
  session.events.linesTyped += data.lines || 0;
  await persistSession();
}

function handlePageInfo(data) {
  if (data.difficulty) session.difficulty = data.difficulty;
  if (data.pageType)   session.pageType   = data.pageType;
}

// ─── Message Router ───────────────────────────────────────────────────────────
browser.runtime.onMessage.addListener((message, sender, sendResponse) => {
  const handle = async () => {
    await initialize();
    switch (message.type) {
      case MESSAGES.TYPE.SESSION_START:
        await startSession();
        return { ok: true, session };

      case MESSAGES.TYPE.SESSION_END:
        const result = await endSession();
        return { ok: true, ...result };

      case MESSAGES.TYPE.GET_STATE:
        return { ok: true, session, streaks, settings, band: getScoreBand(session.score) };

      case MESSAGES.TYPE.PAGE_INFO:
        handlePageInfo(message.data || {});
        return { ok: true };

      case MESSAGES.TYPE.TRACKING_EVENT:
        switch (message.event) {
          case 'paste':     await handlePaste(); break;
          case 'tabHide':   await handleTabHide(); break;
          case 'tabReturn': await handleTabReturn(); break;
          case 'keystrokes': await handleKeystrokes(message.data || {}); break;
        }
        return { ok: true, score: session.score, band: getScoreBand(session.score) };

      default:
        return { ok: false, error: 'Unknown message type' };
    }
  };
  handle().then(sendResponse).catch(err => sendResponse({ ok: false, error: err.message }));
  return true;
});

initialize();
