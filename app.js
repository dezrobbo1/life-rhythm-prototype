(() => {
  const KEY = 'lifeRhythm_v136';
  const OLD_KEY = 'lifeRhythm_v135';
  const $ = id => document.getElementById(id);
  const todayISO = () => new Date().toISOString().slice(0, 10);
  const uid = () => Math.random().toString(36).slice(2, 9);
  const pad = n => String(n).padStart(2, '0');
  const fmtMins = m => {
    m = Math.max(0, Math.round(Number(m) || 0));
    return m >= 60 ? `${Math.floor(m / 60)}h${m % 60 ? ` ${m % 60}m` : ''}` : `${m}m`;
  };
  const currentBlock = () => {
    const h = new Date().getHours();
    if (h < 11) return 'Morning';
    if (h < 14) return 'Midday';
    if (h < 17) return 'Afternoon';
    if (h < 20) return 'Evening';
    return 'Shutdown';
  };
  const blockRank = b => ({ Morning: 1, Midday: 2, Afternoon: 3, Evening: 4, Shutdown: 5, Anytime: 6, 'Fixed time': 7 }[b] || 6);
  const escapeHtml = s => String(s ?? '').replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));

  const defaults = {
    date: todayISO(),
    screen: 'today',
    state: 'normal',
    done: {},
    parked: [],
    moved: [],
    shrunk: [],
    tasks: [],
    activeTimer: null,
    pendingBoost: null,
    boostFeedback: null,
    timeSessions: [],
    startBoostLog: [],
    settings: {
      wake: '06:30', bed: '21:30', workStart: '08:00', workEnd: '16:30',
      avoidFoodRewards: true, avoidShoppingRewards: true, avoidScrollingRewards: true,
      avoidUrgencyCountdowns: false, avoidAccountabilityPrompts: false, avoidStreakPressure: true
    }
  };

  let app = load();
  let tick = null;

  function starterTasks() {
    return [
      task('Eat breakfast', 'Food', 'Morning', 'should', 'flexible', 5, 15, 25, 'fallback', 'Eat something easy now', 'low_energy'),
      task('Plan dinner', 'Food', 'Afternoon', 'should', 'flexible', 3, 10, 20, 'fallback', 'Choose dinner or backup meal', 'unclear_first_step'),
      task('Mobility session', 'Movement', 'Shutdown', 'helpful', 'flexible', 3, 10, 20, 'move', '', 'low_energy'),
      task('Exercise session', 'Movement', 'Evening', 'helpful', 'flexible', 10, 45, 60, 'move', '', 'low_energy'),
      task('Kitchen reset', 'House', 'Evening', 'helpful', 'flexible', 5, 15, 30, 'ask', '', 'too_big'),
      task('Work shutdown', 'Work', 'Shutdown', 'should', 'flexible', 3, 10, 15, 'keep', '', 'unclear_first_step'),
      task('Leave for appointment', 'Family', 'Fixed time', 'must', 'must', 0, 30, 30, 'keep', '', 'time_too_short')
    ];
  }

  function task(title, area, window, priority, type, min, normal, full, late, fallback, barrier) {
    return { id: uid(), title, area, window, priority, completionType: type, min, normal, full, late, fallback, barrier, created: todayISO() };
  }

  function load() {
    let raw = localStorage.getItem(KEY) || localStorage.getItem(OLD_KEY);
    if (!raw) return migrate({ ...defaults, tasks: starterTasks() });
    try { return migrate(JSON.parse(raw)); } catch { return migrate({ ...defaults, tasks: starterTasks() }); }
  }

  function migrate(s) {
    const base = structuredClone(defaults);
    const out = { ...base, ...s, settings: { ...base.settings, ...(s.settings || {}) } };
    out.done ||= {}; out.parked ||= []; out.moved ||= []; out.shrunk ||= [];
    out.timeSessions = Array.isArray(out.timeSessions) ? out.timeSessions : [];
    out.startBoostLog = Array.isArray(out.startBoostLog) ? out.startBoostLog : [];
    if (!Array.isArray(out.tasks) || !out.tasks.length) out.tasks = starterTasks();
    out.tasks = out.tasks.map(t => ({ id: uid(), title: t.name || t.title || 'Untitled task', area: t.area || 'Admin', window: t.window || 'Anytime', priority: t.priority || 'helpful', completionType: t.completionType || t.mode || 'flexible', min: Number(t.min ?? t.minMins ?? 5), normal: Number(t.normal ?? t.norm ?? t.normalMins ?? t.estimate ?? 15), full: Number(t.full ?? t.fullMins ?? 30), late: t.late || t.lateHandling || 'ask', fallback: t.fallback || '', barrier: t.barrier || 'none', created: t.created || todayISO(), ...t }));
    if (out.date !== todayISO()) { out.date = todayISO(); out.done[out.date] ||= []; out.parked = []; out.moved = []; out.shrunk = []; }
    return out;
  }

  function save() { localStorage.setItem(KEY, JSON.stringify(app)); }
  function toast(msg) { const el = $('toast'); el.textContent = msg; el.classList.add('show'); setTimeout(() => el.classList.remove('show'), 2400); }

  function dueTasks() {
    return app.tasks.filter(t => !(app.done[app.date] || []).includes(t.id) && !app.parked.includes(t.id) && !app.moved.includes(t.id))
      .sort((a, b) => score(b) - score(a));
  }

  function score(t) {
    let s = { must: 100, should: 70, helpful: 38, optional: 12 }[t.priority] || 38;
    if (t.window === currentBlock()) s += 25;
    if (isPast(t) && t.late !== 'keep') s -= 25;
    if (app.state === 'low' && t.priority !== 'must') s -= 10;
    if (app.shrunk.includes(t.id)) s += 4;
    return s;
  }

  function isPast(t) { return !['Anytime', 'Fixed time'].includes(t.window) && blockRank(t.window) < blockRank(currentBlock()); }
  function isDone(id) { return (app.done[app.date] || []).includes(id); }
  function displayTitle(t) { return isPast(t) && t.late === 'fallback' && t.fallback ? t.fallback : t.title; }
  function planned(t, mode = 'normal') { if (mode === 'minimum') return Number(t.min || 1); if (mode === 'full') return Number(t.full || t.normal || 1); return Number(t.normal || t.min || 1); }

  function render() {
    save();
    $('app').innerHTML = layout();
    wire();
    updateClock();
    renderActiveTimer();
    if (app.boostFeedback) showBoostFeedback();
    if (tick) clearInterval(tick);
    tick = setInterval(() => { updateClock(); renderActiveTimer(); }, 1000);
  }

  function layout() {
    return `
      <div class="wrap">
        <div class="top">
          <div class="brand">
            <div class="logoTitle"><div class="logo">LR</div><div><div class="h1">Life Rhythm</div><div class="sub">Prototype 1.3.6 · Start Boost</div></div></div>
            <div class="clock"><div id="clockNow"></div><div id="clockBlock"></div></div>
          </div>
        </div>
        ${screen('today', todayScreen())}
        ${screen('plan', planScreen())}
        ${screen('reset', resetScreen())}
        ${screen('tasks', tasksScreen())}
        ${screen('setup', setupScreen())}
        <div class="version">Local-first test build · no medical, therapy, diet, exercise or financial advice</div>
      </div>
      ${nav()}
      ${taskModal()}
      ${boostModal()}
      ${boostFeedbackModal()}
      <div id="toast" class="toast"></div>`;
  }

  function screen(name, inner) { return `<section id="screen-${name}" class="screen ${app.screen === name ? 'active' : ''}">${inner}</section>`; }
  function nav() {
    const tabs = [['today', 'Today'], ['plan', 'Plan'], ['reset', 'Reset'], ['tasks', 'Tasks'], ['setup', 'Setup']];
    return `<nav class="nav"><div class="navInner">${tabs.map(([id, label]) => `<button class="navBtn ${app.screen === id ? 'active' : ''}" data-nav="${id}">${label}</button>`).join('')}</div></nav>`;
  }

  function todayScreen() {
    const tasks = dueTasks(); const next = tasks[0];
    return `
      <div id="timerSlot"></div>
      <div class="card"><div class="split"><div><h2>How today feels</h2><div class="sub">This changes how strongly the app shrinks and protects tasks.</div></div><span class="pill blue">${currentBlock()}</span></div>${statePicker()}</div>
      <div class="card white"><div class="split"><div><h2>Next useful action</h2><div class="sub">Start small. Minimum counts.</div></div><button class="btn small warn" data-too-much>Too much today</button></div>${next ? taskCard(next, true) : `<div class="empty">No active task. Add one or restore starter tasks.</div>`}</div>
      <div class="card"><h2>Today’s top 3</h2>${tasks.slice(0, 3).map(t => taskCard(t)).join('') || `<div class="empty">Nothing active.</div>`}</div>
      <div class="card"><h2>Time reality</h2>${timeReality(tasks)}</div>
      <div class="card"><h2>Quick review</h2>${quickReview()}</div>`;
  }

  function statePicker() {
    const states = [['normal', 'Normal', 'Use planned rhythm'], ['low', 'Low energy', 'Shrink non-essential'], ['busy', 'Interrupted', 'Protect anchors'], ['reset', 'Reset day', 'One useful action']];
    return `<div class="stateGrid">${states.map(([id, name, hint]) => `<button class="stateBtn ${app.state === id ? 'active' : ''}" data-state="${id}"><strong>${name}</strong><span>${hint}</span></button>`).join('')}</div>`;
  }

  function taskCard(t, featured = false) {
    const done = isDone(t.id);
    const must = t.completionType === 'must' || t.priority === 'must';
    const avg = averageActual(t.id);
    const usedBoost = lastBoostFor(t.id);
    const late = isPast(t) ? lateText(t) : '';
    const actions = must ? `
      <button class="btn primary" data-start-timer="${t.id}">Start</button><button class="btn good" data-complete="${t.id}" data-mode="done">Done</button>` : `
      <button class="btn good" data-complete="${t.id}" data-mode="minimum">Minimum</button><button class="btn good" data-complete="${t.id}" data-mode="normal">Normal</button><button class="btn good" data-complete="${t.id}" data-mode="full">Full</button>`;
    return `<div class="task ${done ? 'done' : ''} ${app.shrunk.includes(t.id) ? 'shrunk' : ''}">
      <div class="taskTop"><div><div class="taskTitle">${escapeHtml(displayTitle(t))}</div><div class="meta">${pill(t.area)}${pill(t.window, 'blue')}${pill(priorityLabel(t.priority), t.priority === 'must' ? 'danger' : t.priority === 'should' ? 'warn' : '')}${pill(fmtMins(planned(t)))}${avg ? pill(`avg ${fmtMins(avg)}`, 'good') : ''}</div></div></div>
      <div class="sub" style="margin-top:8px">${why(t)}${late ? ` ${late}` : ''}</div>
      <div class="row" style="margin-top:10px"><button class="btn primary" data-start-timer="${t.id}">Start timer</button><button class="btn warn" data-boost="${t.id}">Make easier to start</button><button class="btn" data-not-now="${t.id}">Not now</button></div>
      <div class="taskActions ${must ? 'two' : ''}">${actions}</div>
      ${usedBoost ? `<div class="sub" style="margin-top:8px">Last Start Boost: ${escapeHtml(usedBoost.label)} · ${escapeHtml(resultLabel(usedBoost.result || 'pending'))}</div>` : ''}
      <details class="details"><summary>More</summary><div class="more"><button class="btn small" data-shrink="${t.id}">Time too short</button><button class="btn small" data-edit="${t.id}">Edit</button><button class="btn small danger" data-delete="${t.id}">Delete</button></div></details>
    </div>`;
  }

  function pill(text, cls = '') { return `<span class="pill ${cls}">${escapeHtml(text)}</span>`; }
  function priorityLabel(p) { return ({ must: 'Must', should: 'Should', helpful: 'Helpful', optional: 'Optional' }[p] || p); }
  function why(t) { if (t.priority === 'must') return 'Protected because it is marked must happen.'; if (t.window === currentBlock()) return `Fits the current ${currentBlock().toLowerCase()} block.`; if (app.shrunk.includes(t.id)) return 'Shrunk for today. Minimum counts.'; return 'Available as a useful next action.'; }
  function lateText(t) { if (t.late === 'fallback' && t.fallback) return 'Using fallback because the original window has passed.'; if (t.late === 'keep') return 'Kept active because it still matters.'; return 'Window has passed; review rather than forcing catch-up.'; }

  function timeReality(tasks) {
    const total = tasks.reduce((a, t) => a + planned(t), 0);
    const must = tasks.filter(t => t.priority === 'must').length;
    return `<div class="grid3"><div class="insight"><strong>${fmtMins(total)}</strong><div class="sub">planned active time</div></div><div class="insight"><strong>${must}</strong><div class="sub">protected tasks</div></div><div class="insight"><strong>${tasks.length}</strong><div class="sub">active tasks</div></div></div><div class="sub">Plan from realistic time, not hoped-for time. Shrink before moving; move before dropping.</div>`;
  }

  function quickReview() {
    const done = (app.done[app.date] || []).length;
    return `<div class="grid"><div class="insight"><strong>${done}</strong><div class="sub">done today</div></div><div class="insight"><strong>${app.parked.length}</strong><div class="sub">parked without penalty</div></div></div>`;
  }

  function planScreen() {
    return `<div class="card"><div class="split"><div><h2>Plan</h2><div class="sub">Add a task or use a starter pack.</div></div><button class="btn primary" data-open-task>Add task</button></div></div><div class="card"><h2>Starter packs</h2><div class="grid">${['Work basics', 'Food rhythm', 'House reset', 'Low-energy day'].map(x => `<button class="btn" data-pack="${x}">${x}</button>`).join('')}</div></div><div class="card"><h2>Tomorrow review</h2>${dueTasks().slice(0, 4).map(t => `<div class="insight"><strong>${escapeHtml(displayTitle(t))}</strong><div class="sub">${escapeHtml(t.area)} · ${escapeHtml(t.window)}</div></div>`).join('') || `<div class="empty">No carry-forward tasks.</div>`}</div>`;
  }

  function resetScreen() {
    return `<div class="card"><h2>Reset Today</h2><p class="sub">No catch-up pile. Keep what matters, shrink what can shrink, move what can wait.</p><div class="row"><button class="btn primary" data-reset-one>Restart with one action</button><button class="btn warn" data-too-much>Too much today</button><button class="btn" data-move-extras>Move extras</button></div></div><div class="card"><h2>Start Boost</h2><p class="sub">Pick one small support to make a task easier to begin. This is behavioural support, not a brain-chemistry claim.</p>${dueTasks().slice(0, 5).map(t => `<button class="btn block" style="margin:6px 0" data-boost="${t.id}">${escapeHtml(displayTitle(t))}</button>`).join('') || `<div class="empty">No active tasks.</div>`}</div>`;
  }

  function tasksScreen() {
    return `<div class="card"><div class="split"><div><h2>Tasks</h2><div class="sub">Edit, time and review tasks.</div></div><button class="btn primary" data-open-task>Add</button></div>${app.tasks.map(t => taskCard(t)).join('')}</div><div class="card"><h2>Timing Insights</h2>${timingInsights()}</div><div class="card"><h2>Data</h2><div class="row"><button class="btn" data-export>Export JSON</button><label class="btn">Import JSON<input type="file" id="importFile" accept="application/json" hidden></label><button class="btn danger" data-clear>Clear local data</button></div></div>`;
  }

  function setupScreen() {
    const s = app.settings;
    const check = id => s[id] ? 'checked' : '';
    return `<div class="card"><h2>Setup</h2><div class="grid"><div><label>Wake target</label><input id="setWake" type="time" value="${s.wake}"></div><div><label>Bed target</label><input id="setBed" type="time" value="${s.bed}"></div><div><label>Work start</label><input id="setWorkStart" type="time" value="${s.workStart}"></div><div><label>Work finish</label><input id="setWorkEnd" type="time" value="${s.workEnd}"></div></div><div class="divider"></div><h3>Safety exclusions</h3>${toggle('avoidFoodRewards','Do not suggest food rewards',check)}${toggle('avoidShoppingRewards','Do not suggest shopping rewards',check)}${toggle('avoidScrollingRewards','Do not suggest scrolling rewards',check)}${toggle('avoidUrgencyCountdowns','Avoid urgency countdowns',check)}${toggle('avoidAccountabilityPrompts','Avoid accountability prompts',check)}${toggle('avoidStreakPressure','Avoid streak-style pressure',check)}<button class="btn primary block" data-save-setup style="margin-top:10px">Save setup</button></div><div class="safeBox"><strong>Boundary</strong><div class="sub">Life Rhythm is a self-management prototype. It does not diagnose, treat, provide therapy, prescribe medication, prescribe exercise, replace medical care, or measure brain chemicals.</div></div>`;
  }
  function toggle(id, labelText, check) { return `<label class="row" style="font-size:13px"><input type="checkbox" id="${id}" ${check(id)}> ${labelText}</label>`; }

  function taskModal() {
    return `<div class="modalBack" id="taskModal"><div class="modal"><div class="split"><h2 id="taskModalTitle">Add task</h2><button class="btn small" data-close-modal>Close</button></div><input id="taskId" type="hidden"><label>Task name</label><input id="taskTitle"><div class="grid"><div><label>Area</label><select id="taskArea"><option>Food</option><option>Movement</option><option>Work</option><option>House</option><option>Family</option><option>Admin</option><option>Sleep</option><option>Anti-scroll</option></select></div><div><label>Window</label><select id="taskWindow"><option>Morning</option><option>Midday</option><option>Afternoon</option><option>Evening</option><option>Shutdown</option><option>Anytime</option><option>Fixed time</option></select></div><div><label>Priority</label><select id="taskPriority"><option value="must">Must</option><option value="should">Should</option><option value="helpful" selected>Helpful</option><option value="optional">Optional</option></select></div><div><label>Type</label><select id="taskType"><option value="flexible">Flexible</option><option value="must">Must finish</option><option value="checkpoint">Checkpoint</option></select></div><div><label>Minimum mins</label><input id="taskMin" type="number" min="1" value="5"></div><div><label>Normal mins</label><input id="taskNormal" type="number" min="1" value="15"></div><div><label>Full mins</label><input id="taskFull" type="number" min="1" value="30"></div><div><label>Start barrier</label><select id="taskBarrier">${barriers().map(b => `<option value="${b.id}">${b.label}</option>`).join('')}</select></div></div><label>Fallback wording</label><input id="taskFallback" placeholder="e.g. Eat something easy now"><button class="btn primary block" data-save-task style="margin-top:12px">Save task</button></div></div>`;
  }

  function boostModal() { return `<div class="modalBack" id="boostModal"><div class="modal"><div class="split"><div><h2>Start Boost</h2><div class="sub" id="boostTaskName">Pick one support to begin.</div></div><button class="btn small" data-close-modal>Close</button></div><div id="boostContent"></div></div></div>`; }
  function boostFeedbackModal() { return `<div class="modalBack" id="boostFeedback"><div class="modal"><h2>Did that help you start?</h2><p class="sub">This teaches Life Rhythm what actually works for you.</p><div class="grid"><button class="btn good" data-boost-result="yes">Yes</button><button class="btn" data-boost-result="bit">A bit</button><button class="btn warn" data-boost-result="no">No</button><button class="btn danger" data-boost-result="harder">Made it harder</button></div><button class="btn block" data-close-feedback style="margin-top:10px">Skip</button></div></div>`; }

  function barriers() { return [
    ['too_big','Too big'], ['unclear_first_step','Unclear first step'], ['too_boring','Too boring'], ['low_energy','Low energy'], ['time_too_short','Time too short'], ['emotionally_hard','Emotionally hard'], ['need_information','Need information'], ['phone_call','Phone call / awkward contact'], ['pulled_to_phone','Pulled to phone'], ['none','Not sure']
  ].map(([id,label])=>({id,label})); }

  function openBoost(id, chosenBarrier = null) {
    const t = app.tasks.find(x => x.id === id); if (!t) return;
    $('boostModal').classList.add('show'); $('boostTaskName').textContent = displayTitle(t);
    const barrier = chosenBarrier || t.barrier || 'none';
    $('boostContent').innerHTML = `<h3>What is blocking the start?</h3><div class="grid">${barriers().map(b => `<button class="btn ${barrier===b.id?'primary':''}" data-boost-barrier="${b.id}" data-boost-task="${id}">${b.label}</button>`).join('')}</div><div class="divider"></div><h3>Pick one support</h3><div class="grid">${boostOptions(t, barrier).map(o => `<button class="btn warn" data-boost-option="${o.id}" data-boost-task="${id}" data-boost-barrier-value="${barrier}">${o.label}<div class="sub">${o.hint}</div></button>`).join('')}</div>`;
  }

  function boostOptions(t, barrier) {
    const base = [
      opt('two_min','Start for 2 minutes','Minimum entry only'), opt('first_step','Do the first physical step','No need to finish'), opt('shrink','Make it smaller','Minimum counts'), opt('change_room','Change location','Use environment shift'), opt('quiet','Quiet mode','Reduce input')
    ];
    const area = String(t.area || '').toLowerCase();
    if (['house','movement'].includes(area)) base.unshift(opt('music','Add music','Good for physical tasks'));
    if (area === 'house') base.push(opt('podcast','Add podcast','Only if it does not distract'));
    if (area === 'work' || area === 'admin') base.unshift(opt('open_file','Open the file/page','Start with access'), opt('write_line','Write one rough line','Draft only'));
    if (area === 'food') base.unshift(opt('easy_food','Choose easiest food option','Reduce decision load'));
    if (barrier === 'phone_call') base.unshift(opt('draft_only','Draft only, do not send','Reduce contact pressure'));
    if (barrier === 'pulled_to_phone' && !app.settings.avoidScrollingRewards) base.push(opt('phone_away','Put phone away for 10 minutes','Remove cue pull'));
    if (!app.settings.avoidAccountabilityPrompts) base.push(opt('body_double','Ask for body double','Shared presence, optional'));
    return base.filter(o => !(app.settings.avoidFoodRewards && o.id === 'food_reward') && !(app.settings.avoidShoppingRewards && o.id === 'shopping_reward') && !(app.settings.avoidScrollingRewards && o.id === 'scroll_reward'));
  }
  function opt(id,label,hint){return {id,label,hint};}

  function chooseBoost(taskId, optionId, barrier) {
    const t = app.tasks.find(x => x.id === taskId); if (!t) return;
    const option = boostOptions(t, barrier).find(o => o.id === optionId) || { id: optionId, label: optionId, hint: '' };
    app.pendingBoost = { taskId, barrier, option: option.id, label: option.label, date: app.date, startedAt: Date.now() };
    app.startBoostLog.push({ id: uid(), taskId, taskTitle: displayTitle(t), area: t.area, barrier, option: option.id, label: option.label, date: app.date, result: 'pending' });
    $('boostModal').classList.remove('show'); save(); render(); toast(`Start Boost selected: ${option.label}`);
  }

  function startTimer(id) {
    const t = app.tasks.find(x => x.id === id); if (!t) return;
    if (app.activeTimer && app.activeTimer.taskId !== id) { toast('Finish or cancel the current timer first.'); return; }
    app.activeTimer = { id: uid(), taskId: id, startedAt: Date.now(), elapsed: 0, paused: false, boost: app.pendingBoost && app.pendingBoost.taskId === id ? app.pendingBoost : null };
    save(); render(); toast(`Timer started: ${displayTitle(t)}`);
  }
  function pauseTimer(){ if(!app.activeTimer) return; const now=Date.now(); if(app.activeTimer.paused){app.activeTimer.startedAt=now; app.activeTimer.paused=false;} else {app.activeTimer.elapsed += now - app.activeTimer.startedAt; app.activeTimer.paused=true;} save(); renderActiveTimer(); }
  function cancelTimer(){ app.activeTimer=null; app.pendingBoost=null; save(); render(); toast('Timer cancelled.'); }
  function elapsedMs(){ if(!app.activeTimer) return 0; return app.activeTimer.elapsed + (app.activeTimer.paused ? 0 : Date.now() - app.activeTimer.startedAt); }
  function finishTimer(mode='normal') {
    const a = app.activeTimer; if(!a) return; const t=app.tasks.find(x=>x.id===a.taskId); if(!t) return;
    const actual = Math.max(1, Math.round(elapsedMs()/60000)); const plan = planned(t, mode);
    app.timeSessions.push({ id:uid(), taskId:t.id, taskTitle:displayTitle(t), date:app.date, actual, planned:plan, mode, boost:a.boost });
    app.done[app.date] ||= []; if(!app.done[app.date].includes(t.id)) app.done[app.date].push(t.id);
    if(a.boost){ app.boostFeedback = { taskId:t.id, boostId:a.boost.option, label:a.boost.label }; }
    app.activeTimer=null; app.pendingBoost=null; save(); render(); toast(`Actual ${fmtMins(actual)} vs planned ${fmtMins(plan)}.`);
  }

  function renderActiveTimer() {
    const slot = $('timerSlot'); if(!slot) return;
    if(!app.activeTimer){ slot.innerHTML=''; return; }
    const t=app.tasks.find(x=>x.id===app.activeTimer.taskId); const ms=elapsedMs(); const mins=Math.floor(ms/60000); const secs=Math.floor((ms%60000)/1000);
    slot.innerHTML = `<div class="card timer"><div class="split"><div><h2>Timing: ${escapeHtml(t?displayTitle(t):'Task')}</h2><div class="elapsed">${pad(mins)}:${pad(secs)}</div><div class="sub">Actual time is calibration, not a score.</div>${app.activeTimer.boost?`<div class="pill warn">Start Boost: ${escapeHtml(app.activeTimer.boost.label)}</div>`:''}</div><div class="row"><button class="btn small" data-pause>${app.activeTimer.paused?'Resume':'Pause'}</button><button class="btn small danger" data-cancel>Cancel</button></div></div><div class="row" style="margin-top:10px"><button class="btn good" data-finish="minimum">Finish minimum</button><button class="btn good" data-finish="normal">Finish normal</button><button class="btn good" data-finish="full">Finish full</button></div></div>`;
  }

  function complete(id, mode) { const t=app.tasks.find(x=>x.id===id); if(!t)return; app.done[app.date] ||= []; if(!app.done[app.date].includes(id)) app.done[app.date].push(id); if(app.pendingBoost && app.pendingBoost.taskId===id){ app.boostFeedback={taskId:id, boostId:app.pendingBoost.option, label:app.pendingBoost.label}; app.pendingBoost=null;} save(); render(); toast(`${displayTitle(t)} logged.`); }
  function recordBoostResult(result) { const fb=app.boostFeedback; if(!fb) return; for(let i=app.startBoostLog.length-1;i>=0;i--){const x=app.startBoostLog[i]; if(x.taskId===fb.taskId && x.option===fb.boostId && x.result==='pending'){x.result=result; break;}} app.boostFeedback=null; save(); render(); toast('Start Boost feedback saved.'); }
  function showBoostFeedback(){ const m=$('boostFeedback'); if(m) m.classList.add('show'); }

  function timingInsights() {
    if(!app.timeSessions.length && !app.startBoostLog.length) return `<div class="empty">No timing or Start Boost history yet.</div>`;
    const byTask = {};
    app.timeSessions.forEach(s => { byTask[s.taskId] ||= []; byTask[s.taskId].push(s); });
    const timeHtml = Object.entries(byTask).map(([id, arr]) => { const avg=Math.round(arr.reduce((a,b)=>a+b.actual,0)/arr.length); const plan=Math.round(arr.reduce((a,b)=>a+b.planned,0)/arr.length); return `<div class="insight"><strong>${escapeHtml(arr[arr.length-1].taskTitle)}</strong><div class="sub">Average actual ${fmtMins(avg)} · planned ${fmtMins(plan)} · ${arr.length} timed</div></div>`; }).join('');
    const boostStats = {};
    app.startBoostLog.forEach(b => { const k = `${b.area} · ${b.label}`; boostStats[k] ||= {yes:0,bit:0,no:0,harder:0,pending:0,total:0}; boostStats[k][b.result || 'pending']++; boostStats[k].total++; });
    const boostHtml = Object.entries(boostStats).map(([k,v]) => `<div class="insight"><strong>${escapeHtml(k)}</strong><div class="sub">Helped: ${v.yes + v.bit}/${v.total} · harder: ${v.harder} · pending: ${v.pending}</div></div>`).join('');
    return `${timeHtml}<h3>Start Boost history</h3>${boostHtml || `<div class="empty">No Start Boost entries yet.</div>`}`;
  }
  function averageActual(id){ const arr=app.timeSessions.filter(x=>x.taskId===id); if(!arr.length)return 0; return Math.round(arr.reduce((a,b)=>a+b.actual,0)/arr.length); }
  function lastBoostFor(id){ for(let i=app.startBoostLog.length-1;i>=0;i--){ if(app.startBoostLog[i].taskId===id) return app.startBoostLog[i]; } return null; }
  function resultLabel(r){ return ({yes:'helped',bit:'helped a bit',no:'did not help',harder:'made harder',pending:'awaiting feedback'}[r]||r); }

  function openTask(id='') {
    const t = app.tasks.find(x=>x.id===id);
    $('taskId').value = t?.id || ''; $('taskTitle').value = t?.title || ''; $('taskArea').value = t?.area || 'Admin'; $('taskWindow').value = t?.window || 'Anytime'; $('taskPriority').value = t?.priority || 'helpful'; $('taskType').value = t?.completionType || 'flexible'; $('taskMin').value = t?.min || 5; $('taskNormal').value = t?.normal || 15; $('taskFull').value = t?.full || 30; $('taskBarrier').value = t?.barrier || 'none'; $('taskFallback').value = t?.fallback || '';
    $('taskModalTitle').textContent = t ? 'Edit task' : 'Add task'; $('taskModal').classList.add('show');
  }
  function saveTask() {
    const id = $('taskId').value || uid(); const existing = app.tasks.find(x=>x.id===id);
    const t = { id, title:$('taskTitle').value.trim()||'Untitled task', area:$('taskArea').value, window:$('taskWindow').value, priority:$('taskPriority').value, completionType:$('taskType').value, min:Number($('taskMin').value)||1, normal:Number($('taskNormal').value)||1, full:Number($('taskFull').value)||1, barrier:$('taskBarrier').value, fallback:$('taskFallback').value.trim(), late:$('taskFallback').value.trim()?'fallback':'ask', created: existing?.created || todayISO() };
    if(existing) Object.assign(existing, t); else app.tasks.unshift(t);
    $('taskModal').classList.remove('show'); save(); render(); toast('Task saved.');
  }

  function notNow(id){ if(!app.parked.includes(id)) app.parked.push(id); save(); render(); toast('Parked for later.'); }
  function shrink(id){ const t=app.tasks.find(x=>x.id===id); if(!t)return; if(!app.shrunk.includes(id)) app.shrunk.push(id); t.full=t.normal; t.normal=t.min; t.min=Math.max(1,Math.round(t.min/2)); save(); render(); toast('Task shrunk. Minimum counts.'); }
  function deleteTask(id){ app.tasks=app.tasks.filter(t=>t.id!==id); save(); render(); toast('Task deleted.'); }
  function tooMuch(){ dueTasks().forEach((t,i)=>{ if(i>0 && t.priority!=='must' && !app.parked.includes(t.id)) app.parked.push(t.id); if(t.completionType==='flexible' && !app.shrunk.includes(t.id)) app.shrunk.push(t.id); }); save(); render(); toast('Reduced to the next useful action.'); }
  function moveExtras(){ dueTasks().slice(3).forEach(t=>{ if(t.priority!=='must' && !app.moved.includes(t.id)) app.moved.push(t.id); }); save(); render(); toast('Extra tasks moved.'); }
  function resetOne(){ const first=dueTasks()[0]; app.parked = dueTasks().filter(t=>!first || t.id!==first.id).filter(t=>t.priority!=='must').map(t=>t.id); if(first && !app.shrunk.includes(first.id)) app.shrunk.push(first.id); save(); render(); toast('Restarted with one action.'); }
  function addPack(name){ const packs={ 'Work basics':[task('Top work task','Work','Morning','should','flexible',5,25,60,'ask','','unclear_first_step'),task('Work shutdown','Work','Shutdown','should','flexible',3,10,15,'keep','','unclear_first_step')], 'Food rhythm':[task('Eat breakfast','Food','Morning','should','flexible',5,15,25,'fallback','Eat something easy now','low_energy'),task('Choose dinner','Food','Afternoon','should','flexible',3,10,20,'fallback','Choose dinner or backup meal','unclear_first_step')], 'House reset':[task('Kitchen reset','House','Evening','helpful','flexible',5,15,30,'ask','','too_big'),task('Laundry checkpoint','House','Afternoon','helpful','checkpoint',3,10,20,'ask','','too_big')], 'Low-energy day':[task('Eat something easy','Food','Anytime','should','flexible',3,10,15,'keep','','low_energy'),task('One tiny reset','House','Anytime','helpful','flexible',2,5,10,'ask','','low_energy')]}; (packs[name]||[]).forEach(t=>app.tasks.unshift(t)); save(); render(); toast(`${name} added.`); }
  function saveSetup(){ const s=app.settings; s.wake=$('setWake').value; s.bed=$('setBed').value; s.workStart=$('setWorkStart').value; s.workEnd=$('setWorkEnd').value; ['avoidFoodRewards','avoidShoppingRewards','avoidScrollingRewards','avoidUrgencyCountdowns','avoidAccountabilityPrompts','avoidStreakPressure'].forEach(id=>s[id]=$(id).checked); save(); render(); toast('Setup saved.'); }
  function exportJson(){ const blob=new Blob([JSON.stringify(app,null,2)],{type:'application/json'}); const a=document.createElement('a'); a.href=URL.createObjectURL(blob); a.download=`life-rhythm-${todayISO()}.json`; a.click(); setTimeout(()=>URL.revokeObjectURL(a.href),500); }
  function importJson(file){ const r=new FileReader(); r.onload=()=>{ try{ app=migrate(JSON.parse(r.result)); save(); render(); toast('Import complete.'); }catch{ toast('Import failed.'); } }; r.readAsText(file); }

  function updateClock(){ if($('clockNow')) $('clockNow').textContent = new Date().toLocaleTimeString([], {hour:'numeric', minute:'2-digit'}); if($('clockBlock')) $('clockBlock').textContent = currentBlock(); }

  function wire(){
    document.querySelectorAll('[data-nav]').forEach(b=>b.onclick=()=>{app.screen=b.dataset.nav; save(); render();});
    document.querySelectorAll('[data-state]').forEach(b=>b.onclick=()=>{app.state=b.dataset.state; save(); render();});
    document.querySelectorAll('[data-open-task]').forEach(b=>b.onclick=()=>openTask());
    document.querySelectorAll('[data-edit]').forEach(b=>b.onclick=()=>openTask(b.dataset.edit));
    document.querySelectorAll('[data-close-modal]').forEach(b=>b.onclick=()=>b.closest('.modalBack').classList.remove('show'));
    document.querySelectorAll('[data-save-task]').forEach(b=>b.onclick=saveTask);
    document.querySelectorAll('[data-start-timer]').forEach(b=>b.onclick=()=>startTimer(b.dataset.startTimer));
    document.querySelectorAll('[data-pause]').forEach(b=>b.onclick=pauseTimer);
    document.querySelectorAll('[data-cancel]').forEach(b=>b.onclick=cancelTimer);
    document.querySelectorAll('[data-finish]').forEach(b=>b.onclick=()=>finishTimer(b.dataset.finish));
    document.querySelectorAll('[data-complete]').forEach(b=>b.onclick=()=>complete(b.dataset.complete,b.dataset.mode));
    document.querySelectorAll('[data-boost]').forEach(b=>b.onclick=()=>openBoost(b.dataset.boost));
    document.querySelectorAll('[data-boost-barrier]').forEach(b=>b.onclick=()=>openBoost(b.dataset.boostTask,b.dataset.boostBarrier));
    document.querySelectorAll('[data-boost-option]').forEach(b=>b.onclick=()=>chooseBoost(b.dataset.boostTask,b.dataset.boostOption,b.dataset.boostBarrierValue));
    document.querySelectorAll('[data-boost-result]').forEach(b=>b.onclick=()=>recordBoostResult(b.dataset.boostResult));
    document.querySelectorAll('[data-close-feedback]').forEach(b=>b.onclick=()=>{app.boostFeedback=null; save(); render();});
    document.querySelectorAll('[data-not-now]').forEach(b=>b.onclick=()=>notNow(b.dataset.notNow));
    document.querySelectorAll('[data-shrink]').forEach(b=>b.onclick=()=>shrink(b.dataset.shrink));
    document.querySelectorAll('[data-delete]').forEach(b=>b.onclick=()=>{ if(confirm('Delete this task?')) deleteTask(b.dataset.delete); });
    document.querySelectorAll('[data-too-much]').forEach(b=>b.onclick=tooMuch);
    document.querySelectorAll('[data-move-extras]').forEach(b=>b.onclick=moveExtras);
    document.querySelectorAll('[data-reset-one]').forEach(b=>b.onclick=resetOne);
    document.querySelectorAll('[data-pack]').forEach(b=>b.onclick=()=>addPack(b.dataset.pack));
    document.querySelectorAll('[data-save-setup]').forEach(b=>b.onclick=saveSetup);
    document.querySelectorAll('[data-export]').forEach(b=>b.onclick=exportJson);
    document.querySelectorAll('[data-clear]').forEach(b=>b.onclick=()=>{ if(confirm('Clear local Life Rhythm data?')){ localStorage.removeItem(KEY); app=migrate({...defaults,tasks:starterTasks()}); render(); }});
    const imp=$('importFile'); if(imp) imp.onchange=e=>{ if(e.target.files[0]) importJson(e.target.files[0]); };
    document.querySelectorAll('.modalBack').forEach(m=>m.onclick=e=>{ if(e.target===m) m.classList.remove('show'); });
  }

  render();
})();
