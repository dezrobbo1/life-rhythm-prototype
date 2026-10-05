// Gate 8A7B3 uncovered acceptance rows. Synthetic data; fresh contexts only.
const { chromium } = require('playwright');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const { execFileSync, spawn } = require('node:child_process');
const root = path.resolve(__dirname, '../../..');
const manifest = JSON.parse(fs.readFileSync(path.join(__dirname, 'manifest.json')));
const output = path.resolve(process.env.B3_OUTPUT || '/tmp/life-rhythm-b3-replay');
const port = Number(process.env.B3_PORT || 5187);
const origin = `http://127.0.0.1:${port}`;
const rows = [], screenshots = [], errors = [];
function sha(bytes) { return crypto.createHash('sha256').update(bytes).digest('hex'); }
function fingerprint() {
  const names = execFileSync('git', ['ls-files', '-z', 'app/src', 'app/public', 'app/package.json', 'app/package-lock.json', 'app/index.html', 'app/vite.config.ts', 'app/tsconfig.json', 'app/tsconfig.app.json', 'app/tsconfig.node.json'], { cwd: root }).toString().split('\0').filter(Boolean).sort();
  return sha(Buffer.concat(names.flatMap(name => [Buffer.from(name + '\0'), fs.readFileSync(path.join(root, name)), Buffer.from('\0')])));
}
function builtFiles() {
  const base = path.join(root, 'app/dist');
  if (!fs.existsSync(base)) return null;
  const walk = dir => fs.readdirSync(dir, { withFileTypes: true }).flatMap(e => e.isDirectory() ? walk(path.join(dir, e.name)) : [path.join(dir, e.name)]);
  return walk(base).sort().map(file => ({ file: path.relative(base, file), sha256: sha(fs.readFileSync(file)) }));
}
async function shot(page, file) {
  await page.screenshot({ path: path.join(output, file), fullPage: true });
  screenshots.push({ file, sha256: sha(fs.readFileSync(path.join(output, file))) });
}
async function fits(page) {
  const sizes = await page.evaluate(() => ({ scroll: document.documentElement.scrollWidth, viewport: document.documentElement.clientWidth }));
  assert.ok(sizes.scroll <= sizes.viewport, JSON.stringify(sizes));
}
async function focused(locator) { assert.equal(await locator.evaluate(e => document.activeElement === e), true); }
async function trap(page) {
  const dialog = page.getByRole('dialog');
  const controls = dialog.locator('button:enabled, input:enabled, select:enabled, textarea:enabled, a[href]').filter({ visible: true });
  const count = await controls.count(); assert.ok(count > 2);
  await controls.last().focus(); await page.keyboard.press('Tab'); await focused(controls.first());
  await page.keyboard.press('Shift+Tab'); await focused(controls.last());
  for (let n = 0; n < count + 2; n++) {
    await page.keyboard.press('Tab');
    assert.equal(await dialog.evaluate(e => e.contains(document.activeElement)), true);
  }
  const ring = await page.evaluate(() => { const s = getComputedStyle(document.activeElement); return { outline: s.outlineStyle, width: s.outlineWidth, shadow: s.boxShadow }; });
  assert.ok((ring.outline !== 'none' && ring.width !== '0px') || ring.shadow !== 'none', 'Keyboard focus indicator missing');
  return { controls: count, focusIndicator: ring };
}
async function dbRead(page, tables) {
  return page.evaluate(async names => {
    const { getCurrentLifeRhythmDatabase } = await import('/src/data/localDataNamespace.ts');
    const db = getCurrentLifeRhythmDatabase();
    return Object.fromEntries(await Promise.all(names.map(async name => [name, await db.table(name).toArray()])));
  }, tables);
}
async function seed(page, count = 3, rhythm = true) {
  return page.evaluate(async ({ count, rhythm }) => {
    const { getCurrentLifeRhythmDatabase } = await import('/src/data/localDataNamespace.ts');
    const { createDefaultSettings, saveSettings } = await import('/src/data/settingsRepository.ts');
    const { activeTaskSchema, taskPoolItemSchema, rhythmTemplateSchema } = await import('/src/data/schemas.ts');
    const { saveRhythmConfiguration } = await import('/src/data/rhythmAuthorityRepository.ts');
    const db = getCurrentLifeRhythmDatabase(), now = new Date().toISOString();
    const days = ['Monday','Tuesday','Wednesday','Thursday','Friday','Saturday','Sunday'];
    const defaults = createDefaultSettings(now);
    const result = await saveSettings({ ...defaults, lifeShape: { ...defaults.lifeShape,
      fixedCommitments: [{ id:'fixed', label:'Read-only appointment', days, start:'10:00', end:'10:30', travelMinutes:0, bufferMinutes:0 }],
      timeBlocks: [{ id:'capacity', label:'Explicit usable time', type:'openCapacity', schedulerUse:'available', days, start:'09:00', end:'16:00' }, { id:'rest', label:'Protected lunch', type:'protectedTime', schedulerUse:'unavailable', days, start:'12:00', end:'13:00' }]
    }}, db);
    if (!result.ok) throw Error(JSON.stringify(result));
    for (const [i, title] of ['Open water bill','Pack bag','Clear one surface'].slice(0,count).entries()) {
      await db.activeTasks.put(activeTaskSchema.parse({ id:`today-${i}`, area:'admin', source:'adhoc', title, purpose:'One small action.', minimum:{label:`First step for ${title}`,minutes:5}, normal:{label:'Do the normal version',minutes:15}, full:{label:'Finish the full version',minutes:25}, showToday:true, status:'active', createdAt:now, updatedAt:now }));
    }
    if (rhythm) {
      await db.taskPoolItems.put(taskPoolItemSchema.parse({ id:'planned-form', source:'adhoc', title:'Send form', area:'admin', status:'captured', minimum:{label:'Open form',minutes:5}, normal:{label:'Fill form',minutes:15}, full:{label:'Finish form',minutes:25}, createdAt:now, updatedAt:now }));
      const template = rhythmTemplateSchema.parse({ id:'walk', source:'custom', title:'Reset walk', area:'health', enabled:false, schedule:{frequency:1,period:'day'}, minimum:{label:'Step outside',minutes:5}, normal:{label:'Short walk',minutes:10}, full:{label:'Full walk',minutes:20}, createdAt:now, updatedAt:now });
      const saved = await saveRhythmConfiguration({ template, state:'enabled', frequency:1, period:'day', preferredDays:days, preferredTime:'anytime', timezone:'Australia/Perth', maxPerDay:1, effectiveFromLocalDate:'2026-10-05', now }, db);
      if (!saved.ok) throw Error(JSON.stringify(saved));
    }
  }, {count,rhythm});
}
async function scenario(browser, name, width, count, rhythm, run) {
  if (process.env.B3_ROWS && !process.env.B3_ROWS.split(',').includes(name)) return;
  const context = await browser.newContext({ viewport:{width,height:844}, timezoneId:'Australia/Perth' });
  const page = await context.newPage(); page.on('pageerror', e => errors.push({ row:name, message:e.message }));
  await page.clock.install({ time:new Date(manifest.clock.anchorUtc) });
  await page.goto(origin); await page.getByRole('button',{name:'Add one-off',exact:true}).waitFor();
  await seed(page,count,rhythm); await page.reload(); await page.getByRole('button',{name:'Reduce today',exact:true}).waitFor();
  try {
    const details = await run(page);
    await fits(page); rows.push({ row:name, result:'PASS', viewport:{width,height:844}, details });
    console.log('PASS',name);
  } catch (e) { rows.push({row:name,result:'FAIL',message:e.message}); throw e; }
  finally { await context.close(); }
}
async function relief(page) {
  await page.getByRole('button',{name:'More',exact:true}).click();
  await page.getByRole('navigation',{name:'Secondary'}).getByRole('button',{name:/Relief|Reset/}).click();
  await page.getByRole('heading',{name:'Relief',exact:true}).waitFor();
}
async function editRow(page) {
  await page.getByRole('heading',{name:'Open water bill',exact:true}).waitFor();
  const card = page.locator('article.task-card').filter({has:page.getByRole('heading',{name:'Open water bill',exact:true})});
  await card.getByRole('button',{name:'Details',exact:true}).focus(); await page.keyboard.press('Enter');
  const opener = card.getByRole('button',{name:'Edit task',exact:true});
  const before = await dbRead(page,['activeTasks']);
  await opener.focus(); await page.keyboard.press('Space');
  await page.getByRole('dialog',{name:'Edit one-off',exact:true}).waitFor();
  const keyboard = await trap(page);
  const title = 'Review the water bill and the unusually long supporting reference before deciding the next useful action '.repeat(2).trim();
  const minimum = 'Open the first page, locate the account reference, and leave a short note for the next small step '.repeat(2).trim();
  await page.getByLabel('Task title',{exact:true}).fill(title);
  await page.getByLabel('Minimum version',{exact:true}).fill(minimum);
  await page.getByLabel('Minimum minutes',{exact:true}).fill('7');
  await page.getByLabel('Minimum version',{exact:true}).focus(); await focused(page.getByLabel('Minimum version',{exact:true}));
  await fits(page); await shot(page,`task-edit-focused-${page.viewportSize().width}.png`);
  await page.getByRole('button',{name:'Save changes',exact:true}).focus();
  const saveBox = await page.getByRole('button',{name:'Save changes',exact:true}).boundingBox();
  assert.ok(saveBox.y >= 0 && saveBox.y + saveBox.height <= page.viewportSize().height);
  await page.getByRole('button',{name:'Cancel',exact:true}).focus();
  const cancelBox = await page.getByRole('button',{name:'Cancel',exact:true}).boundingBox();
  assert.ok(cancelBox.y >= 0 && cancelBox.y + cancelBox.height <= page.viewportSize().height);
  await shot(page,`task-edit-controls-${page.viewportSize().width}.png`);
  await page.getByRole('button',{name:'Cancel',exact:true}).click();
  await page.getByRole('dialog').waitFor({state:'hidden'}); await focused(opener);
  assert.deepEqual(await dbRead(page,['activeTasks']),before,'Cancel wrote task data');
  await opener.click(); await page.getByLabel('Task title',{exact:true}).fill(title);
  await page.getByLabel('Minimum version',{exact:true}).fill(minimum); await page.getByLabel('Minimum minutes',{exact:true}).fill('7');
  await page.getByRole('button',{name:'Save changes',exact:true}).focus(); await page.keyboard.press('Enter');
  await page.getByRole('dialog').waitFor({state:'hidden'});
  const saved = (await dbRead(page,['activeTasks'])).activeTasks.find(t => t.id === 'today-0');
  assert.equal(saved.title,title); assert.equal(saved.minimum.label,minimum); assert.equal(saved.minimum.minutes,7); assert.equal(saved.status,before.activeTasks[0].status);
  await focused(page.getByRole('button',{name:'Edit task',exact:true}).first());
  await page.reload(); await page.getByRole('heading',{name:title,exact:true}).waitFor();
  const reloaded = (await dbRead(page,['activeTasks'])).activeTasks.find(t => t.id === 'today-0');
  assert.deepEqual(reloaded,saved); await shot(page,`task-edit-saved-${page.viewportSize().width}.png`);
  return { keyboard, titleLength:title.length, minimumLength:minimum.length, cancelNoWrite:true, saveReload:true, authoredMinutes:7, statusPreserved:true, focusReturned:true };
}
async function rhythmRow(page) {
  await page.getByRole('button',{name:'Plan',exact:true}).click();
  const row = () => page.getByRole('list',{name:/Day Line/}).locator('li').filter({has:page.getByText('Reset walk',{exact:true})});
  await row().getByText('Correct Reset walk',{exact:true}).click();
  const correctionTables=['schedulerPlanState','rhythmTemplates','rhythmPlans','rhythmRecurrenceRevisions','rhythmInstances','activeTasks','calendarSources'];
  const initial = await dbRead(page,correctionTables);
  await row().getByRole('button',{name:'Move',exact:true}).click();
  await trap(page); await page.getByLabel('Move start time',{exact:true}).fill('10:00');
  await page.getByRole('button',{name:'Save move',exact:true}).click(); await page.getByRole('dialog').getByRole('status').waitFor();
  assert.deepEqual(await dbRead(page,correctionTables),initial,'Rejected rhythm Move wrote');
  await fits(page); await shot(page,'rhythm-move-conflict-mobile.png');
  await page.getByRole('button',{name:'Cancel',exact:true}).click(); await focused(row().getByRole('button',{name:'Move',exact:true}));
  assert.deepEqual(await dbRead(page,correctionTables),initial,'Cancel wrote');
  await row().getByRole('button',{name:'Move',exact:true}).click();
  const copy = await page.getByRole('dialog').innerText(); assert.match(copy,/duration|minute/i);
  await page.getByLabel('Move start time',{exact:true}).fill('14:00'); await page.clock.runFor(1000);
  await page.getByRole('button',{name:'Save move',exact:true}).click(); await page.getByText('Placement moved.',{exact:true}).waitFor();
  await focused(row().getByText('Correct Reset walk',{exact:true}));
  const moved = await dbRead(page,correctionTables);
  for(const name of ['rhythmTemplates','rhythmPlans','rhythmRecurrenceRevisions','activeTasks','calendarSources']) assert.deepEqual(moved[name],initial[name],name+' identity changed');
  const placement = moved.schedulerPlanState[0].plan.placements.find(p=>p.targetKind==='rhythm' && p.rhythmTemplateId==='walk');
  assert.equal(placement.start,'14:00');
  const original = initial.schedulerPlanState[0].plan.placements.find(p=>p.rhythmInstanceId === placement.rhythmInstanceId);
  const minutes = p => Number(p.end.slice(0,2))*60+Number(p.end.slice(3))-Number(p.start.slice(0,2))*60-Number(p.start.slice(3));
  assert.equal(minutes(placement),minutes(original));
  const toggle = async name => {
    if (!await row().locator('details.plan-context-correction').evaluate(e=>e.open)) await row().getByText('Correct Reset walk',{exact:true}).click();
    await row().getByRole('button',{name,exact:true}).click();
  };
  await page.clock.runFor(1000); await toggle('Protect this time'); await page.getByText('This private time is protected.',{exact:true}).waitFor();
  await page.clock.runFor(1000); await toggle('Unprotect'); await page.getByText('Protection removed.',{exact:true}).waitFor();
  if (!await row().locator('details.plan-context-correction').evaluate(e=>e.open)) await row().getByText('Correct Reset walk',{exact:true}).click();
  await row().getByText('Why this time?',{exact:true}).click(); await shot(page,'rhythm-correction-why-mobile.png');
  await page.reload(); await page.getByRole('button',{name:'Plan',exact:true}).click(); await row().waitFor();
  assert.equal((await dbRead(page,['schedulerPlanState'])).schedulerPlanState[0].plan.placements.find(p=>p.rhythmInstanceId===placement.rhythmInstanceId).start,'14:00');
  return {conflictNoWrite:true,cancelNoWrite:true,moveSaveReload:true,durationPreserved:true,linkedIdentityPreserved:true,protectUnprotect:true,groundedWhy:true,focusReturn:true};
}
async function reducedRow(page) {
  await page.getByRole('button',{name:'Plan',exact:true}).click();
  await page.getByRole('list',{name:/Day Line/}).getByText('Open water bill',{exact:true}).waitFor();
  await page.getByRole('button',{name:'Today',exact:true}).click();
  await page.getByRole('button',{name:'Reduce today',exact:true}).waitFor();
  await page.waitForFunction(async () => {
    const { getCurrentLifeRhythmDatabase } = await import('/src/data/localDataNamespace.ts');
    const current = await getCurrentLifeRhythmDatabase().schedulerPlanState.get('current');
    return current && !current.rhythmInputRepairPendingAt && !current.taskInputRepairPendingAt;
  });
  const before = await dbRead(page,['schedulerPlanState']);
  await page.getByRole('button',{name:'Reduce today',exact:true}).click(); await page.getByRole('dialog',{name:'Reduce today',exact:true}).waitFor();
  await trap(page); assert.deepEqual(await dbRead(page,['schedulerPlanState']),before,'Preview wrote plan');
  await shot(page,'reduced-preview-mobile.png'); await page.keyboard.press('Escape'); await focused(page.getByRole('button',{name:'Reduce today',exact:true}));
  await page.getByRole('button',{name:'Reduce today',exact:true}).click(); await page.clock.runFor(1000);
  await page.getByRole('button',{name:'Apply reduced day',exact:true}).click(); await page.getByText('Reduced Day active',{exact:true}).waitFor();
  await page.getByRole('heading',{name:'Changed',exact:true}).waitFor(); await shot(page,'changed-reduced-mobile.png');
  const applied = await dbRead(page,['schedulerPlanState']); assert.notDeepEqual(applied,before);
  const undo=page.getByRole('button',{name:'Undo last change',exact:true}); await undo.waitFor(); assert.equal(await undo.count(),1);
  await page.clock.runFor(1000); await undo.click(); await page.getByRole('button',{name:'Reduce today',exact:true}).waitFor();
  const restored = await dbRead(page,['schedulerPlanState']);
  assert.deepEqual(restored.schedulerPlanState[0].plan.placements,before.schedulerPlanState[0].plan.placements,'Undo placements');
  assert.deepEqual(restored.schedulerPlanState[0].dayModeContext,before.schedulerPlanState[0].dayModeContext,'Undo mode');
  await page.reload(); await page.getByRole('button',{name:'Reduce today',exact:true}).waitFor();
  await page.getByRole('button',{name:'Reduce today',exact:true}).click(); await page.clock.runFor(1000); await page.getByRole('button',{name:'Apply reduced day',exact:true}).click();
  await page.getByRole('button',{name:'Return to normal day',exact:true}).waitFor(); await page.clock.runFor(1000); await page.getByRole('button',{name:'Return to normal day',exact:true}).click();
  await page.getByRole('button',{name:'Reduce today',exact:true}).waitFor(); await page.reload(); await page.getByRole('button',{name:'Reduce today',exact:true}).waitFor();
  return {previewNoWrite:true,keyboardTrapEscapeReturn:true,changedFromSavedRepair:true,oneEligibleUndo:true,undoRestoresPlanAndMode:true,undoReload:true,returnNormalReload:true};
}
async function reliefRow(page,count,action) {
  await relief(page); await page.getByText(`${count} visible Today tasks are available for reset.`,{exact:true}).waitFor();
  const before = await dbRead(page,['activeTasks','taskHistory','completionLog']);
  await page.getByRole('button',{name:'Restart with one action',exact:true}).click();
  await page.getByText(count ? 'Restart preview only. No task was started or completed.' : 'No Today task is waiting. Add one small action when ready.',{exact:true}).waitFor();
  assert.deepEqual(await dbRead(page,['activeTasks','taskHistory','completionLog']),before,'Restart preview wrote');
  await shot(page,`relief-${count}-${action==='Narrow Today'?'narrow':'park'}-mobile.png`);
  await page.clock.runFor(1000); await page.getByRole('button',{name:action,exact:true}).click();
  if (count) await page.getByText('1 visible Today task is available for reset.',{exact:true}).waitFor();
  else await page.getByText('No Today task is waiting. Add one small action when ready.',{exact:true}).waitFor();
  const after=(await dbRead(page,['activeTasks'])).activeTasks; assert.equal(after.length,count);
  for(const task of after) assert.equal(task.status,task.id==='today-0'?'active':action==='Narrow Today'?'notToday':'parked');
  await page.reload(); await relief(page);
  await page.getByText(count ? '1 visible Today task is available for reset.' : '0 visible Today tasks are available for reset.',{exact:true}).waitFor();
  if (count) {
    const one = await dbRead(page,['activeTasks','taskHistory','completionLog']);
    await page.getByRole('button',{name:'Restart with one action',exact:true}).click();
    await page.getByText('Restart preview only. No task was started or completed.',{exact:true}).waitFor();
    assert.deepEqual(await dbRead(page,['activeTasks','taskHistory','completionLog']),one,'One-task preview wrote');
    await page.getByRole('button',{name:action,exact:true}).click();
    await page.getByText('Today already has one next action. Nothing else changed. No catch-up pile.',{exact:true}).waitFor();
    assert.deepEqual(await dbRead(page,['activeTasks','taskHistory','completionLog']),one,'One-task relief wrote');
    await shot(page,`relief-one-after-${action==='Narrow Today'?'narrow':'park'}-mobile.png`);
  }
  assert.equal(await page.getByRole('button',{name:/restore hidden|review tomorrow|start protected reset/i}).count(),0);
  return {initialTaskCount:count,previewNoWrite:true,action,taskStatuses:after.map(t=>({id:t.id,status:t.status})),noneDeleted:true,reload:true,unsupportedAbsent:true};
}
(async()=>{
  fs.mkdirSync(output,{recursive:true});
  assert.equal(fingerprint(),manifest.runtimeSourceSha256,'Source mismatch: evidence is bound to reviewed application files');
  const server = spawn(process.execPath,[path.join(root,'app/node_modules/vite/bin/vite.js'),'--host','127.0.0.1','--port',String(port),'--strictPort'],{cwd:path.join(root,'app'),stdio:['ignore','pipe','pipe']});
  let serverLog=''; server.stdout.on('data',d=>serverLog+=d); server.stderr.on('data',d=>serverLog+=d);
  let browser;
  try {
    for(let n=0;n<50;n++) { if(server.exitCode!==null) throw Error('Vite exited: '+serverLog); try {if((await fetch(origin)).ok) break;} catch {} await new Promise(r=>setTimeout(r,100)); }
    browser = await chromium.launch({executablePath:process.env.B3_CHROMIUM || '/usr/bin/chromium',headless:true,args:['--no-sandbox']});
    await scenario(browser,'mobile-long-task-edit-keyboard',390,3,false,editRow);
    await scenario(browser,'desktop-task-edit-keyboard',1280,3,false,editRow);
    await scenario(browser,'contextual-rhythm-correction',390,3,true,rhythmRow);
    await scenario(browser,'reduced-day-changed-eligible-undo',390,3,false,reducedRow);
    await scenario(browser,'relief-zero',390,0,false,p=>reliefRow(p,0,'Narrow Today'));
    await scenario(browser,'relief-multiple-narrow',390,3,false,p=>reliefRow(p,3,'Narrow Today'));
    await scenario(browser,'relief-multiple-park',390,3,false,p=>reliefRow(p,3,'Park extras safely'));
    assert.deepEqual(errors,[],'Runtime page errors');
  } finally {
    const result={reviewedSourceCommit:manifest.reviewedSourceCommit,runtimeSourceSha256:fingerprint(),applicationSourceTree:execFileSync('git',['rev-parse','HEAD:app/src'],{cwd:root}).toString().trim(),checkoutCommit:execFileSync('git',['rev-parse','HEAD'],{cwd:root}).toString().trim(),server:'fresh loopback Vite serving fingerprinted checkout (not hosted preview)',browser:browser?await browser.version():null,playwright:require('playwright/package.json').version,timezone:'Australia/Perth',clock:manifest.clock,builtFiles:builtFiles(),rows,errors,screenshots};
    fs.writeFileSync(path.join(output,'row-results.json'),JSON.stringify(result,null,2)+'\n');
    if(browser) await browser.close(); server.kill();
  }
})().catch(e=>{ console.error(e); process.exitCode=1; });
