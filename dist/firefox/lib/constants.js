/**
 * constants.js – NoCap centralized config
 */

export const SCORING = {
  BASE_SCORE: 100,
  PENALTIES: {
    COPY_PASTE: 16,           // -16 per paste
    TAB_SWITCH: 4,            // -4 per switch away
    TIME_OUTSIDE_MINUTE: 10,  // -10 per cumulative 60s outside
    SUSPICIOUS_SPEED: 20,
    IMPOSSIBLE_SPEED: 40,
  },

  BANDS: [
    { min: 96, max: 100, label: 'Elite Integrity',  color: '#00FFFF', glow: 'rgba(0,255,255,0.35)'  },
    { min: 90, max: 95,  label: 'Excellent',         color: '#22D3EE', glow: 'rgba(34,211,238,0.35)'  },
    { min: 80, max: 89,  label: 'Strong',             color: '#38BDF8', glow: 'rgba(56,189,248,0.3)'   },
    { min: 70, max: 79,  label: 'Improving',          color: '#FBBF24', glow: 'rgba(251,191,36,0.3)'   },
    { min: 60, max: 69,  label: 'Moderate',           color: '#F59E0B', glow: 'rgba(245,158,11,0.3)'   },
    { min: 50, max: 59,  label: 'Below Average',      color: '#F97316', glow: 'rgba(249,115,22,0.3)'   },
    { min: 40, max: 49,  label: 'Low',                color: '#EF4444', glow: 'rgba(239,68,68,0.3)'    },
    { min: 20, max: 39,  label: 'Very Low',           color: '#DC2626', glow: 'rgba(220,38,38,0.3)'    },
    { min: 0,  max: 19,  label: 'Critical',           color: '#991B1B', glow: 'rgba(153,27,27,0.3)'    },
  ],
};

// Behavior thresholds (in minutes) by page type → difficulty
// Each tier: if durationMin < max → that label applies
export const BEHAVIOR_THRESHOLDS = {
  problem: {
    easy: [
      { max: 3,        label: 'Impossible',       speedPenalty: 'IMPOSSIBLE_SPEED' },
      { max: 5,        label: 'Suspicious',        speedPenalty: 'SUSPICIOUS_SPEED' },
      { max: 10,       label: 'Fair – Quick',      speedPenalty: null },
      { max: 15,       label: 'Fair – Normal',     speedPenalty: null },
      { max: 30,       label: 'Fair – Slow',       speedPenalty: null },
      { max: Infinity, label: 'Slow / Struggling', speedPenalty: null },
    ],
    medium: [
      { max: 4,        label: 'Impossible',        speedPenalty: 'IMPOSSIBLE_SPEED' },
      { max: 8,        label: 'Suspicious',         speedPenalty: 'SUSPICIOUS_SPEED' },
      { max: 20,       label: 'Fair – Fast',        speedPenalty: null },
      { max: 30,       label: 'Fair – Normal',      speedPenalty: null },
      { max: 45,       label: 'Fair – Slow',        speedPenalty: null },
      { max: Infinity, label: 'Slow / Struggling',  speedPenalty: null },
    ],
    hard: [
      { max: 10,       label: 'Impossible',        speedPenalty: 'IMPOSSIBLE_SPEED' },
      { max: 15,       label: 'Suspicious',         speedPenalty: 'SUSPICIOUS_SPEED' },
      { max: 30,       label: 'Fair – Fast',        speedPenalty: null },
      { max: 45,       label: 'Fair – Standard',    speedPenalty: null },
      { max: 60,       label: 'Fair – Slow',        speedPenalty: null },
      { max: Infinity, label: 'Slow / Struggling',  speedPenalty: null },
    ],
  },
  contest: {
    easy: [
      { max: 10,       label: 'Suspicious',         speedPenalty: 'SUSPICIOUS_SPEED' },
      { max: 30,       label: 'Fair',               speedPenalty: null },
      { max: Infinity, label: 'Slow / Struggling',  speedPenalty: null },
    ],
    medium: [
      { max: 4,        label: 'Impossible',         speedPenalty: 'IMPOSSIBLE_SPEED' },
      { max: 8,        label: 'Suspicious',          speedPenalty: 'SUSPICIOUS_SPEED' },
      { max: 20,       label: 'Fair – Fast',         speedPenalty: null },
      { max: 30,       label: 'Fair – Normal',       speedPenalty: null },
      { max: 45,       label: 'Fair – Slow',         speedPenalty: null },
      { max: Infinity, label: 'Slow / Struggling',   speedPenalty: null },
    ],
    hard: [
      { max: 10,       label: 'Impossible',          speedPenalty: 'IMPOSSIBLE_SPEED' },
      { max: 15,       label: 'Suspicious',           speedPenalty: 'SUSPICIOUS_SPEED' },
      { max: 30,       label: 'Fair – Fast',          speedPenalty: null },
      { max: 45,       label: 'Fair – Standard',      speedPenalty: null },
      { max: 60,       label: 'Fair – Slow',          speedPenalty: null },
      { max: Infinity, label: 'Slow / Struggling',    speedPenalty: null },
    ],
  },
};

// Streak: best streak only updates when score >= 80
export const STREAK_RULES = [
  { min: 90, max: 100, currentDelta: +1, updateBest: true,  msg: 'Outstanding discipline. Keep it going.' },
  { min: 80, max: 89,  currentDelta:  0, updateBest: true,  msg: 'Strong session. You\'re building real habits.' },
  { min: 70, max: 79,  currentDelta: -1, updateBest: false, msg: 'Good effort. Push harder next time.' },
  { min: 0,  max: 69,  currentDelta: -99,updateBest: false, msg: 'Discipline broke down. Reset and refocus.' },
];

export const INTERVENTION_MESSAGES = {
  paste:      ["You're bypassing the struggle. That's where growth happens.", "Copy-paste is a shortcut. Shortcuts don't build mastery."],
  tabSwitch:  ["Stay with the problem. Your brain is close.", "Switching tabs breaks your flow. Come back."],
  longExit:   ["You've been away a while. Get back in the zone.", "Long breaks break momentum. Refocus now."],
  scoreDrop:  ["This isn't your level. You're capable of more.", "Every shortcut today is debt you pay tomorrow."],
  highStreak: ["You're building real discipline. This is rare.", "Most people quit here. You didn't."],
};

export const MESSAGES = {
  TYPE: {
    TRACKING_EVENT: 'NOCAP_TRACKING_EVENT',
    SESSION_START:  'NOCAP_SESSION_START',
    SESSION_END:    'NOCAP_SESSION_END',
    GET_STATE:      'NOCAP_GET_STATE',
    PAGE_INFO:      'NOCAP_PAGE_INFO',
  },
};

export const STORAGE_KEYS = {
  SESSION:  'nocap_session',
  STREAKS:  'nocap_streaks',
  SETTINGS: 'nocap_settings',
  HISTORY:  'nocap_history',
};

export const DEFAULT_SETTINGS = {
  enabled: true,
  interventionsEnabled: true,
  showOverlay: true,
};
