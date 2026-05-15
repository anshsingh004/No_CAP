/**
 * background-mv2.js – Firefox MV2 (all logic inlined, no ES module imports)
 * Speed/difficulty-based penalties removed.
 */

// ─── Inlined Constants ────────────────────────────────────────────────────────
const SCORING = {
  BASE_SCORE: 100,
  PENALTIES: {
    COPY_PASTE: 16,
    TAB_SWITCH: 4,
    // TIME_OUTSIDE_MINUTE removed — no speed penalty
  },
  BANDS: [
    { min: 96, max: 100, label: 'Elite Integrity',  color: '#0EA5E9' },
    { min: 90, max: 95,  label: 'Excellent',         color: '#22D3EE' },
    { min: 80, max: 89,  label: 'Strong',             color: '#38BDF8' },
    { min: 70, max: 79,  label: 'Improving',          color: '#F59E0B' },
    { min: 60, max: 69,  label: 'Moderate',           color: '#FB923C' },
    { min: 50, max: 59,  label: 'Below Average',      color: '#F97316' },
    { min: 40, max: 49,  label: 'Low',                color: '#EF4444' },
    { min: 20, max: 39,  label: 'Very Low',           color: '#DC2626' },
    { min: 0,  max: 19,  label: 'Critical',           color: '#991B1B' },
  ],
};

const STREAK_RULES = [
  { min: 90, max: 100, currentDelta: +1,   updateBest: true,  msg: 'Outstanding discipline. Keep it going.' },
  { min: 80, max: 89,  currentDelta:  0,   updateBest: true,  msg: 'Strong session. You\'re building real habits.' },
  { min: 70, max: 79,  currentDelta: -1,   updateBest: false, msg: 'Good effort. Push harder next time.' },
  { min: 0,  max: 69,  currentDelta: -99,  updateBest: false, msg: 'Discipline broke down. Reset and refocus.' },
];

const MSG = {
  SESSION_START: 'NOCAP_SESSION_START', SESSION_END: 'NOCAP_SESSION_END',
  GET_STATE: 'NOCAP_GET_STATE',
  TRACKING_EVENT: 'NOCAP_TRACKING_EVENT',
};

const STORAGE_KEYS = { SESSION:'nocap_session', STREAKS:'nocap_streaks', SETTINGS:'nocap_settings', HISTORY:'nocap_history' };

// ─── State ────────────────────────────────────────────────────────────────────
let session  = createEmptySession();
let streaks  = { current:0, best:0, lastScore:null, lastMsg:'', lastStrength:'' };
let settings = { enabled:true, interventionsEnabled:true, showOverlay:true };

function createEmptySession() {
  return {
    id: Date.now().toString(36), startTime:null, endTime:null, active:false,
    score:100, penalties:0,
    events:{ pastes:0, tabSwitches:0, keystrokes:0, linesTyped:0 },
    timeOutside:0, timeActive:0,
    lastExitTime:null, behaviorClass:'N/A',
    difficulty:'Unknown',
  };
}

// ─── Helpers ──────────────────────────────────────────────────────────────────
function applyPenalty(type) {
  const penalty = SCORING.PENALTIES[type] ?? 0;
  session.score = Math.max(0, session.score - penalty);
  session.penalties += penalty;
  return penalty;
}

function getScoreBand(score) {
  return SCORING.BANDS.find(b => score >= b.min && score <= b.max) || SCORING.BANDS[SCORING.BANDS.length-1];
}

function updateStreak(finalScore) {
  const rule = STREAK_RULES.find(r => finalScore >= r.min && finalScore <= r.max);
  if (!rule) return;
  if (rule.currentDelta === -99) { streaks.current = 0; }
  else { streaks.current = Math.max(0, (streaks.current||0) + rule.currentDelta); }
  if (rule.updateBest) { streaks.best = Math.max(streaks.best||0, streaks.current); }
  streaks.lastScore=finalScore; streaks.lastMsg=rule.msg;
  streaks.lastStrength = rule.currentDelta > 0 ? 'up' : rule.currentDelta===0 ? 'hold' : 'down';
}

function buildPenaltyBreakdown(sess) {
  const P = SCORING.PENALTIES; const rows = [];
  if (sess.events.tabSwitches>0) rows.push({label:'Tab Switches',count:sess.events.tabSwitches,perEvent:P.TAB_SWITCH,total:sess.events.tabSwitches*P.TAB_SWITCH});
  if (sess.events.pastes>0) rows.push({label:'Copy-Paste',count:sess.events.pastes,perEvent:P.COPY_PASTE,total:sess.events.pastes*P.COPY_PASTE});
  return rows;
}

function persistSession() { return browser.storage.local.set({[STORAGE_KEYS.SESSION]:session}); }

async function startSession() {
  session = createEmptySession(); session.active=true; session.startTime=Date.now();
  await persistSession();
}

async function endSession() {
  if (!session.active) return null;
  session.active=false; session.endTime=Date.now();
  session.timeActive=Math.round((session.endTime-session.startTime)/1000);
  const finalScore = Math.max(0,Math.min(100,session.score));
  session.score=finalScore; updateStreak(finalScore);
  const penaltyBreakdown = buildPenaltyBreakdown(session);
  const histData = await browser.storage.local.get(STORAGE_KEYS.HISTORY);
  const history = histData[STORAGE_KEYS.HISTORY]||[];
  history.unshift({ id:session.id, date:new Date(session.startTime).toISOString(), score:finalScore, band:getScoreBand(finalScore).label, events:{...session.events}, timeOutside:session.timeOutside, behaviorClass:session.behaviorClass, difficulty:session.difficulty||'Unknown', duration:session.timeActive, penaltyBreakdown, streakSnapshot:{...streaks} });
  if (history.length>50) history.pop();
  await browser.storage.local.set({[STORAGE_KEYS.STREAKS]:streaks,[STORAGE_KEYS.HISTORY]:history,[STORAGE_KEYS.SESSION]:session});
  return {session, streaks, penaltyBreakdown};
}

async function handlePaste() {
  if (!session.active||!settings.enabled) return;
  session.events.pastes++; applyPenalty('COPY_PASTE'); await persistSession();
}
async function handleTabHide() {
  if (!session.active||!settings.enabled) return;
  session.events.tabSwitches++; applyPenalty('TAB_SWITCH');
  session.lastExitTime=Date.now(); await persistSession();
}
async function handleTabReturn() {
  if (!session.active||!settings.enabled||!session.lastExitTime) return;
  const elapsed=(Date.now()-session.lastExitTime)/1000;
  session.timeOutside+=elapsed; session.lastExitTime=null;
  // No minute-based outside penalty — removed by design
  await persistSession();
}
async function handleKeystrokes(data) {
  if (!session.active||!settings.enabled) return;
  session.events.keystrokes+=data.count||0; session.events.linesTyped+=data.lines||0; await persistSession();
}

(async()=>{
  const data=await browser.storage.local.get([STORAGE_KEYS.STREAKS,STORAGE_KEYS.SETTINGS,STORAGE_KEYS.SESSION]);
  if(data[STORAGE_KEYS.STREAKS]) streaks=data[STORAGE_KEYS.STREAKS];
  if(data[STORAGE_KEYS.SETTINGS]) settings={...settings,...data[STORAGE_KEYS.SETTINGS]};
  if(data[STORAGE_KEYS.SESSION]?.active) session=data[STORAGE_KEYS.SESSION];
})();

browser.runtime.onMessage.addListener((message,sender,sendResponse)=>{
  const handle=async()=>{
    switch(message.type){
      case MSG.SESSION_START: await startSession(); return {ok:true,session};
      case MSG.SESSION_END:   const r=await endSession(); return {ok:true,...r};
      case MSG.GET_STATE:     return {ok:true,session,streaks,settings,band:getScoreBand(session.score)};
      case MSG.TRACKING_EVENT:
        switch(message.event){
          case 'paste':      await handlePaste(); break;
          case 'tabHide':    await handleTabHide(); break;
          case 'tabReturn':  await handleTabReturn(); break;
          case 'keystrokes': await handleKeystrokes(message.data||{}); break;
          case 'difficulty':
            session.difficulty = message.data || 'Unknown';
            await persistSession();
            break;
        }
        return {ok:true,score:session.score,band:getScoreBand(session.score)};
      default: return {ok:false,error:'Unknown type'};
    }
  };
  handle().then(sendResponse).catch(err=>sendResponse({ok:false,error:err.message}));
  return true;
});
