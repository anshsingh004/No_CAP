# 🔒 No Cap — Ethical Coding Assistant

> *Track your coding integrity. Build real discipline. No shortcuts.*

A cross-browser browser extension that promotes disciplined, ethical coding behavior through real-time behavioral tracking, a granular integrity scoring model, streak-based reinforcement, and motivational interventions.

---

## ✨ Features

| Feature | Description |
|---|---|
| 🧠 **Behavior Tracking** | Paste events, tab switches, keystroke counts, time outside tab |
| ⚖️ **Integrity Scoring** | 0–100 scale with 9 granular bands (Elite → Critical) |
| 🔥 **Streak System** | Consecutive session streaks with reward/reset logic |
| 💬 **Interventions** | Context-aware motivational toasts (paste, tab switch, long exit) |
| 📊 **Session Summary** | Full post-session analytics with behavior classification |
| 🏆 **Contest Mode** | Soft-lock mode with live score & timer display |
| 🌐 **Cross-Browser** | Chrome, Edge (MV3) + Firefox (MV2) |
| 🔒 **100% Client-Side** | No telemetry, no external requests, fully opt-in |

---

## 🏗️ Architecture

```
NoCap/
├── manifest.json              # Chrome/Edge (MV3)
├── manifest-firefox.json      # Firefox (MV2)
├── lib/
│   ├── browser-polyfill.js    # chrome.* → browser.* abstraction
│   └── constants.js           # All scoring, streak, intervention config
├── background/
│   ├── background.js          # MV3 Service Worker (Chrome/Edge)
│   └── background-mv2.js      # MV2 Background Script (Firefox)
├── content/
│   ├── content.js             # Paste/tab/keystroke tracker + toast UI
│   └── content.css            # Scoped styles
├── popup/
│   ├── popup.html             # 3-tab popup: Session | History | Settings
│   ├── popup.css              # Premium dark glassmorphism design
│   └── popup.js               # Popup controller + state management
├── icons/                     # Generated extension icons (16/32/48/128px)
└── scripts/
    ├── generate-icons.js      # SVG icon generator
    ├── convert-icons.js       # SVG → PNG converter (requires sharp)
    └── build.js               # Cross-browser build assembler
```

---

## ⚖️ Scoring Model

**Base Score: 100**

| Event | Penalty |
|---|---|
| Copy-Paste | −15 |
| Tab Switch | −4 |
| Long Tab Exit (>10s) | −12 |
| Suspicious Speed | −20 |
| Impossible Speed | −40 |

### Score Bands

| Range | Label | Color |
|---|---|---|
| 96–100 | Elite Integrity | 🟢 Bright Green |
| 90–95 | Excellent | 🟢 Green |
| 80–89 | Strong | 🟡 Light Green |
| 70–79 | Improving | 🟡 Yellow-Green |
| 60–69 | Moderate | 🟡 Yellow |
| 50–59 | Below Average | 🟠 Orange |
| 40–49 | Low | 🔴 Deep Orange |
| 20–39 | Very Low | 🔴 Red |
| 0–19 | Critical | 🔴 Dark Red |

---

## 🔥 Streak System

| Score | Streak Impact | Feedback |
|---|---|---|
| 96–100 | +1 (strong) | "Elite discipline. This is top-tier focus." |
| 90–95 | +1 | "Excellent consistency. Keep pushing." |
| 80–89 | Maintained | "You're close to elite. One more push." |
| 70–79 | Maintained (soft) | "Good effort. You can do better." |
| 50–69 | **Reset** | "Potential is there—but discipline broke." |
| <50 | **Hard reset** | "This session lacked integrity. Reset mentally." |

---

## 🚀 Installation

### Chrome / Edge (MV3)

1. Open `chrome://extensions` (or `edge://extensions`)
2. Enable **Developer Mode** (top right)
3. Click **Load unpacked**
4. Select the `NoCap/` root directory (or `dist/chrome/` after build)

### Firefox (MV2)

1. Open `about:debugging`
2. Click **This Firefox** → **Load Temporary Add-on**
3. Select `manifest-firefox.json` (or `dist/firefox/manifest.json` after build)

---

## 🛠️ Development

### Prerequisites
```bash
node >= 18
npm >= 8
```

### Setup
```bash
cd NoCap
npm install
```

### Generate Icons
```bash
npm run icons
```

### Build for Distribution

```bash
# Chrome/Edge
npm run build:chrome   # → dist/chrome/

# Firefox
npm run build:firefox  # → dist/firefox/
```

---

## 🧪 Test Scenarios

| Scenario | Expected Score | Notes |
|---|---|---|
| Perfect user (no paste, no tab switches) | 95–100 | Elite/Excellent band |
| Borderline (2 pastes, 5 switches) | 72–80 | Improving/Strong |
| Heavy cheating (10 pastes, many switches) | 20–45 | Very Low/Low |
| Impossible speed (high LPM, low keystrokes) | −40 penalty | Impossible classification |
| Fast but legitimate (high keystrokes) | No speed penalty | Fair classification |

---

## 🔒 Privacy

- **Zero external requests.** All data stays in `chrome.storage.local`.
- **No keystroke content logging.** Only counts are stored.
- **Fully opt-in.** Can be disabled via Settings.
- **Data clearable** anytime from Settings → Reset All Data.

---

## 📦 Cross-Browser Compatibility

| Browser | Manifest | Background | Status |
|---|---|---|---|
| Chrome 88+ | MV3 | Service Worker | ✅ Full support |
| Edge 88+ | MV3 | Service Worker | ✅ Full support |
| Firefox 91+ | MV2 | Background Page | ✅ Full support |

The `browser-polyfill.js` wraps all `chrome.*` APIs into Promise-based `browser.*` calls, ensuring identical behavior across browsers.

---

## 🎨 Design System

- **Palette:** Deep dark (`#0a0a14`) with purple accent (`#7C3AED`) and integrity green (`#00FF7F`)
- **Typography:** Inter (800–900 weight for scores, 400–600 for UI)
- **Effects:** Glassmorphism, animated SVG score ring, glow effects, micro-animations
- **Popup size:** 360px fixed width

---

*No Cap v1.0.0 — Built for developers who hold themselves to a higher standard.*
