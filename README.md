# No Cap — LeetCode Integrity Tracker

> Track what actually matters when you grind: are you solving it, or just shipping it?

A cross-browser extension that monitors your coding behaviour on LeetCode — paste events, tab switches, time outside — and computes a real-time **integrity score** (0–100). No cloud, no telemetry, fully client-side.

---

## Features

| | |
|---|---|
| **Behavioural Tracking** | Paste detection, tab-switch monitoring, keystroke counts, time-outside accumulation |
| **Integrity Scoring** | 0–100 with 9 granular bands from *Elite Integrity* → *Critical* |
| **Streak System** | Consecutive-session streaks with score-gated increment, hold, and hard-reset logic |
| **Live Overlay** | Fixed score badge injected directly into LeetCode pages during active sessions |
| **Motivational Interventions** | Context-aware toasts on paste, tab switch, and long absence |
| **Session Summary** | Post-session penalty breakdown table, difficulty badge, streak delta |
| **History Log** | Up to 50 sessions stored locally with score bands and penalty breakdowns |
| **Cross-Browser** | Chrome/Edge (MV3 Service Worker) + Firefox (MV2 Background Page) |
| **100% Client-Side** | All data in `chrome.storage.local`. Zero external requests. |

---

## Architecture

```
NoCap/
├── manifest.json              # Chrome/Edge — Manifest V3
├── manifest-firefox.json      # Firefox — Manifest V2
│
├── lib/
│   ├── browser-polyfill.js    # Wraps chrome.* callbacks → Promise-based browser.* API
│   └── constants.js           # Single source of truth: scoring, bands, streak rules, storage keys
│
├── background/
│   ├── background.js          # MV3 Service Worker — owns session state, scoring, message router
│   └── background-mv2.js      # MV2 equivalent with all constants inlined (no ES module support)
│
├── content/
│   ├── content.js             # Injected on leetcode.com/problems/* and /contest/*
│   │                          # Tracks: paste, visibilitychange, keystrokes, difficulty DOM scan
│   │                          # Renders: toast notifications, live score overlay
│   └── content.css            # Scoped box-sizing resets (prevents host-page style bleed)
│
├── popup/
│   ├── popup.html             # 3-tab UI: Session | History | Settings
│   ├── popup.css              # Sky-blue/white design system — CSS custom properties
│   └── popup.js               # Popup controller: boot, state machine, polling, render functions
│
├── icons/                     # Extension icons at 16/32/48/128px
└── scripts/
    ├── generate-icons.js      # Generates SVG lock icons at all required sizes
    ├── convert-icons.js       # Converts SVG → PNG via sharp
    └── build.js               # Assembles dist/chrome/ or dist/firefox/ from source
```

### Message Flow

```
content.js  ──(NOCAP_TRACKING_EVENT)──►  background.js
                                              │ applyPenalty()
                                              │ persistSession()
                                              └──► { ok, score, band }
content.js  ◄────────────────────────────────────────────
    │ showToast() / updateOverlay()
    │
    └──(NOCAP_DIFFICULTY_UPDATE broadcast)──► popup.js
                                              updateDifficultyBadge()

popup.js  ──(NOCAP_GET_STATE every 2s)──►  background.js
                                              └──► { session, streaks, settings, band }
popup.js  ◄── renderActive()
```

---

## Scoring Model

**Base score: 100**

| Event | Penalty |
|---|---|
| Copy-Paste | −16 pts |
| Tab Switch | −4 pts |

Time-outside and solve-speed carry **no penalty** by design — the model tracks *behaviour*, not pace.

### Score Bands

| Range | Label |
|---|---|
| 96 – 100 | Elite Integrity |
| 90 – 95 | Excellent |
| 80 – 89 | Strong |
| 70 – 79 | Improving |
| 60 – 69 | Moderate |
| 50 – 59 | Below Average |
| 40 – 49 | Low |
| 20 – 39 | Very Low |
| 0 – 19 | Critical |

---

## Streak System

| Final Score | Streak Delta | Best Updated |
|---|---|---|
| 90 – 100 | +1 | ✅ |
| 80 – 89 | 0 (hold) | ✅ |
| 70 – 79 | −1 | ❌ |
| 0 – 69 | **Reset to 0** | ❌ |

Best streak only grows on sessions where score ≥ 80.

---

## Cross-Browser Implementation

| Browser | Manifest | Background | Notes |
|---|---|---|---|
| Chrome 88+ | MV3 | Service Worker | ES module background; `import` supported |
| Edge 88+ | MV3 | Service Worker | Identical to Chrome |
| Firefox 91+ | MV2 | Background Page | Constants inlined; no `import` in MV2 |

`browser-polyfill.js` converts all `chrome.*` callback-style APIs to Promise-based `browser.*` calls, keeping background, content, and popup code identical across targets. On Firefox, `browser` is native and the polyfill is a no-op.

---

## Installation

### Chrome / Edge

1. Go to `chrome://extensions` (or `edge://extensions`)
2. Enable **Developer Mode**
3. Click **Load unpacked** → select the `NoCap/` root directory

### Firefox

1. Go to `about:debugging` → **This Firefox**
2. Click **Load Temporary Add-on**
3. Select `manifest-firefox.json`

### Load from dist/ (after build)

```bash
npm run build:chrome   # → dist/chrome/
npm run build:firefox  # → dist/firefox/
```
Load `dist/chrome/` or point Firefox at `dist/firefox/manifest.json`.

---

## Development

**Requirements:** Node ≥ 18, npm ≥ 8

```bash
npm install

# Regenerate icons
npm run icons

# Build for distribution
npm run build:chrome
npm run build:firefox
```

No bundler required. The build script is a plain `fs.copyFileSync` assembler — the browser extension API system handles module loading directly.

---

## Privacy

- All data stored exclusively in `browser.storage.local` on the user's machine.
- Keystrokes are **counted only** — content is never captured or stored.
- No network requests of any kind.
- All data clearable from **Settings → Reset All Data**.

---

## License

MIT
