/**
 * background-mv2.js – Firefox MV2 (all logic inlined, no ES module imports)
 */

// ─── Inlined Constants ────────────────────────────────────────────────────────
const SCORING = {
  BASE_SCORE: 100,
  PENALTIES: {
    COPY_PASTE: 16,
    TAB_SWITCH: 4,
    TIME_OUTSIDE_MINUTE: 10,
    SUSPICIOUS_SPEED: 20,
    IMPOSSIBLE_SPEED: 40,
  },
  BANDS: [
    { min: 96, max: 100, label: 'Elite Integrity',  color: '#00FFFF' },
    { min: 90, max: 95,  label: 'Excellent',         color: '#22D3EE' },
    { min: 80, max: 89,  label: 'Strong',             color: '#38BDF8' },
    { min: 70, max: 79,  label: 'Improving',          color: '#FBBF24' },
    { min: 60, max: 69,  label: 'Moderate',           color: '#F59E0B' },
    { min: 50, max: 59,  label: 'Below Average',      color: '#F97316' },
    { min: 40, max: 49,  label: 'Low',                color: '#EF4444' },
    { min: 20, max: 39,  label: 'Very Low',           color: '#DC2626' },
    { min: 0,  max: 19,  label: 'Critical',           color: '#991B1B' },
  ],
};

const BEHAVIOR_THRESHOLDS = {
  problem: {
    easy:   [ {max:3,label:'Impossible',sp:'IMPOSSIBLE_SPEED'},{max:5,label:'Suspicious',sp:'SUSPICIOUS_SPEED'},{max:10,label:'Fair – Quick',sp:null},{max:15,label:'Fair – Normal',sp:null},{max:30,label:'Fair – Slow',sp:null},{max:Infinity,label:'Slow / Struggling',sp:null} ],
    medium: [ {max:4,label:'Impossible',sp:'IMPOSSIBLE_SPEED'},{max:8,label:'Suspicious',sp:'SUSPICIOUS_SPEED'},{max:20,label:'Fair – Fast',sp:null},{max:30,label:'Fair – Normal',sp:null},{max:45,label:'Fair – Slow',sp:null},{max:Infinity,label:'Slow / Struggling',sp:null} ],
    hard:   [ {max:10,label:'Impossible',sp:'IMPOSSIBLE_SPEED'},{max:15,label:'Suspicious',sp:'SUSPICIOUS_SPEED'},{max:30,label:'Fair – Fast',sp:null},{max:45,label:'Fair – Standard',sp:null},{max:60,label:'Fair – Slow',sp:null},{max:Infinity,label:'Slow / Struggling',sp:null} ],
  },
  contest: {
    easy:   [ {max:10,label:'Suspicious',sp:'SUSPICIOUS_SPEED'},{max:30,label:'Fair',sp:null},{max:Infinity,label:'Slow / Struggling',sp:null} ],
    medium: [ {max:4,label:'Impossible',sp:'IMPOSSIBLE_SPEED'},{max:8,label:'Suspicious',sp:'SUSPICIOUS_SPEED'},{max:20,label:'Fair – Fast',sp:null},{max:30,label:'Fair – Normal',sp:null},{max:45,label:'Fair – Slow',sp:null},{max:Infinity,label:'Slow / Struggling',sp:null} ],
    hard:   [ {max:10,label:'Impossible',sp:'IMPOSSIBLE_SPEED'},{max:15,label:'Suspicious',sp:'SUSPICIOUS_SPEED'},{max:30,label:'Fair – Fast',sp:null},{max:45,label:'Fair – Standard',sp:null},{max:60,label:'Fair – Slow',sp:null},{max:Infinity,label:'Slow / Struggling',sp:null} ],
  },
};

const STREAK_RULES = [
  { min: 90, max: 100, currentDelta: +1,   updateBest: true,  msg: 'Outstanding discipline. Keep it going.' },
  { min: 80, max: 89,  currentDelta:  0,   updateBest: true,  msg: 'Strong session. You\'re building real habits.' },
  { min: 70, max: 79,  currentDelta: -1,   updateBest: false, msg: 'Good effort. Push harder next time.' },
  { min: 0,  max: 69,  currentDelta: -99,  updateBest: false, msg: 'Discipline broke down. Reset and refocus.' },
];

const MSG = {
  SESSION_START: 'NOCAP_SESSION_START', SESSION_END: 'NOCAP_SESSION_END',
  GET_STATE: 'NOCAP_GET_STATE', PAGE_INFO: 'NOCAP_PAGE_INFO',
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
    timeOutside:0, timeActive:0, minutePenaltiesApplied:0,
    lastExitTime:null, difficulty:'medium', pageType:'problem',
    behaviorClass:'Unknown', speedPenaltyApplied:0,
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

function classifyBehavior(durationMin, pageType, difficulty) {
  const tiers = (BEHAVIOR_THRESHOLDS[pageType]||BEHAVIOR_THRESHOLDS.problem)[difficulty]||BEHAVIOR_THRESHOLDS.problem.medium;
  for (const tier of tiers) { if (durationMin < tier.max) return tier; }
  return tiers[tiers.length-1];
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
  if (sess.minutePenaltiesApplied>0) rows.push({label:'Minutes Outside',count:sess.minutePenaltiesApplied,perEvent:P.TIME_OUTSIDE_MINUTE,total:sess.minutePenaltiesApplied*P.TIME_OUTSIDE_MINUTE});
  if (sess.speedPenaltyApplied>0) rows.push({label:'Speed Penalty',count:1,perEvent:sess.speedPenaltyApplied,total:sess.speedPenaltyApplied});
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
  const durationMin = session.timeActive/60;
  const tier = classifyBehavior(durationMin, session.pageType, session.difficulty);
  session.behaviorClass = tier.label;
  if (tier.sp||tier.speedPenalty) { const p=applyPenalty(tier.sp||tier.speedPenalty); session.speedPenaltyApplied=p; }
  const finalScore = Math.max(0,Math.min(100,session.score));
  session.score=finalScore; updateStreak(finalScore);
  const penaltyBreakdown = buildPenaltyBreakdown(session);
  const histData = await browser.storage.local.get(STORAGE_KEYS.HISTORY);
  const history = histData[STORAGE_KEYS.HISTORY]||[];
  history.unshift({ id:session.id, date:new Date(session.startTime).toISOString(), score:finalScore, band:getScoreBand(finalScore).label, events:{...session.events}, timeOutside:session.timeOutside, minutePenaltiesApplied:session.minutePenaltiesApplied, behaviorClass:session.behaviorClass, difficulty:session.difficulty, pageType:session.pageType, duration:session.timeActive, penaltyBreakdown, streakSnapshot:{...streaks} });
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
  const totalMin=Math.floor(session.timeOutside/60);
  while(session.minutePenaltiesApplied<totalMin){ applyPenalty('TIME_OUTSIDE_MINUTE'); session.minutePenaltiesApplied++; }
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
      case MSG.PAGE_INFO:     if(message.data?.difficulty) session.difficulty=message.data.difficulty; if(message.data?.pageType) session.pageType=message.data.pageType; return {ok:true};
      case MSG.TRACKING_EVENT:
        switch(message.event){
          case 'paste':      await handlePaste(); break;
          case 'tabHide':    await handleTabHide(); break;
          case 'tabReturn':  await handleTabReturn(); break;
          case 'keystrokes': await handleKeystrokes(message.data||{}); break;
        }
        return {ok:true,score:session.score,band:getScoreBand(session.score)};
      default: return {ok:false,error:'Unknown type'};
    }
  };
  handle().then(sendResponse).catch(err=>sendResponse({ok:false,error:err.message}));
  return true;
});
