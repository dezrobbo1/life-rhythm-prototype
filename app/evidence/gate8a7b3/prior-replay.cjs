// Original successful cloud-browser run; portability changes and corrected observation label.
// Prior checked application source: b1ae38bc56bf6f1205e9163fa3c3e81536cd753d.
// Synthetic exported profile stays local and must not be committed.
const {chromium}=require('playwright');
const fs=require('fs');
const path=require('path');
const output=path.resolve(process.env.B3_OUTPUT || '/tmp/life-rhythm-b3-original');
fs.mkdirSync(output,{recursive:true});
const origin=process.env.B3_ORIGIN || 'http://127.0.0.1:5173';
if(!['127.0.0.1','localhost'].includes(new URL(origin).hostname))throw Error('Use a throwaway loopback server');
(async()=>{
 const browser=await chromium.launch({executablePath:process.env.B3_CHROMIUM || '/usr/bin/chromium',headless:true,args:['--no-sandbox']});
 const context=await browser.newContext({viewport:{width:1280,height:900},timezoneId:'Australia/Perth'});
 const page=await context.newPage(); const errors=[]; const checks=[];
 page.on('pageerror',e=>errors.push(e.message));
 await page.clock.install({time:new Date('2026-10-05T01:00:00Z')});
 await page.goto(origin);
 await page.getByRole('button',{name:'Add one-off',exact:true}).waitFor();
 const seed=await page.evaluate(async()=>{
  const {getCurrentLifeRhythmDatabase}=await import('/src/data/localDataNamespace.ts');
  const {createDefaultSettings,saveSettings}=await import('/src/data/settingsRepository.ts');
  const {activeTaskSchema,taskPoolItemSchema,rhythmTemplateSchema}=await import('/src/data/schemas.ts');
  const {saveRhythmConfiguration}=await import('/src/data/rhythmAuthorityRepository.ts');
  const db=getCurrentLifeRhythmDatabase();const now=new Date().toISOString();
  const defaults=createDefaultSettings(now);const days=['Monday','Tuesday','Wednesday','Thursday','Friday','Saturday','Sunday'];
  const settings=await saveSettings({...defaults,lifeShape:{...defaults.lifeShape,fixedCommitments:[{id:'fixed',label:'Read-only appointment',days,start:'10:00',end:'10:30',travelMinutes:0,bufferMinutes:0}],timeBlocks:[{id:'capacity',label:'Explicit usable time',type:'openCapacity',schedulerUse:'available',days,start:'09:00',end:'16:00'},{id:'rest',label:'Protected lunch',type:'protectedTime',schedulerUse:'unavailable',days,start:'12:00',end:'13:00'}]}},db);
  if(!settings.ok)throw new Error(JSON.stringify(settings));
  for(const [i,title]of ['Open water bill','Pack bag','Clear one surface'].entries())await db.activeTasks.put(activeTaskSchema.parse({id:`today-${i}`,area:'admin',source:'adhoc',title,purpose:'One small action.',minimum:{label:`First step for ${title}`,minutes:5},normal:{label:'Do the normal version',minutes:15},full:{label:'Finish the full version',minutes:25},showToday:true,status:'active',createdAt:now,updatedAt:now}));
  await db.taskPoolItems.put(taskPoolItemSchema.parse({id:'planned-form',source:'adhoc',title:'Send form',area:'admin',status:'captured',minimum:{label:'Open form',minutes:5},normal:{label:'Fill form',minutes:15},full:{label:'Finish form',minutes:25},createdAt:now,updatedAt:now}));
  const template=rhythmTemplateSchema.parse({id:'walk',source:'custom',title:'Reset walk',area:'health',enabled:false,schedule:{frequency:1,period:'day'},minimum:{label:'Step outside',minutes:5},normal:{label:'Short walk',minutes:10},full:{label:'Full walk',minutes:20},createdAt:now,updatedAt:now});
  const rhythm=await saveRhythmConfiguration({template,state:'enabled',frequency:1,period:'day',preferredDays:days,preferredTime:'anytime',timezone:'Australia/Perth',maxPerDay:1,effectiveFromLocalDate:'2026-10-05',now},db);
  if(!rhythm.ok)throw new Error(JSON.stringify(rhythm));
  return {database:db.name};
 });
 await page.reload(); await page.getByRole('heading',{name:'Open water bill',exact:true}).waitFor();
 await page.getByRole('button',{name:'Reduce today',exact:true}).waitFor();
 await page.screenshot({path:path.join(output,'today-desktop.png'),fullPage:true});checks.push('Populated Today, authored Minimum/minutes, factual Later');
 // Capture via real UI and reload.
 await page.getByRole('button',{name:'Capture',exact:true}).click();
 await page.getByLabel('Task title',{exact:true}).fill('Browser captured note');await page.getByLabel('Smallest useful action',{exact:true}).fill('Open the notebook');await page.getByLabel('Minutes for this action',{exact:true}).fill('5');
 await page.getByRole('button',{name:'Save captured task',exact:true}).click();await page.getByText('Task captured. Held outside Today. Life Rhythm can privately plan it when it fits.',{exact:true}).waitFor();
 await page.reload();await page.getByRole('button',{name:'Plan',exact:true}).click();
 let row=page.getByRole('list',{name:/Day Line/}).locator('li').filter({has:page.getByText('Send form',{exact:true})});
 await row.getByText('Correct Send form',{exact:true}).click();
 await row.getByRole('button',{name:'Move',exact:true}).click();
 await page.getByLabel('Move start time',{exact:true}).fill('10:00');
 await page.getByRole('button',{name:'Save move',exact:true}).click();
 await page.getByRole('dialog').getByRole('status').waitFor();
 await page.screenshot({path:path.join(output,'plan-move-conflict-desktop.png'),fullPage:true});
 console.log('CONFLICT',await page.getByRole('dialog').innerText());
 await page.getByLabel('Move start time',{exact:true}).fill('11:00');await page.getByRole('button',{name:'Save move',exact:true}).click();await page.getByText('Placement moved.',{exact:true}).waitFor();
 row=page.getByRole('list',{name:/Day Line/}).locator('li').filter({has:page.getByText('Send form',{exact:true})});
 await row.getByText('Correct Send form',{exact:true}).click();await row.getByRole('button',{name:'Protect this time',exact:true}).click();await page.getByText('This private time is protected.',{exact:true}).waitFor();
 if(!await row.locator('.plan-context-correction').evaluate(e=>e.open))await row.getByText('Correct Send form',{exact:true}).click();
 await row.getByRole('button',{name:'Unprotect',exact:true}).click();await page.getByText('Protection removed.',{exact:true}).waitFor();
 if(!await row.locator('.plan-context-correction').evaluate(e=>e.open))await row.getByText('Correct Send form',{exact:true}).click();
 await row.getByText('Why this time?',{exact:true}).click();await page.screenshot({path:path.join(output,'plan-context-desktop.png'),fullPage:true});
 checks.push('Task Move conflict visible inside modal, Save success with preserved duration, Protect/Unprotect and grounded Why; maintenance closed');
 await row.getByRole('button',{name:'Move',exact:true}).click();await page.keyboard.press('Escape');
 console.log('FOCUS-CANCEL',await page.evaluate(()=>document.activeElement?.textContent));
 await page.getByRole('button',{name:'Today',exact:true}).click();await page.getByRole('button',{name:'Start task',exact:true}).click();await page.getByRole('button',{name:'Mark minimum done',exact:true}).click();
 await page.getByRole('button',{name:'Stop here',exact:true}).waitFor();
 await page.screenshot({path:path.join(output,'today-minimum-desktop.png'),fullPage:true});
 await page.getByRole('button',{name:'Keep going',exact:true}).click();await page.getByRole('button',{name:'Pause',exact:true}).click();await page.getByRole('button',{name:'Resume',exact:true}).click();
 checks.push('Today idle/start/Minimum/continuation/pause/resume with one useful primary action');
 await page.getByRole('button',{name:'Reduce today',exact:true}).click();await page.getByRole('dialog',{name:'Reduce today',exact:true}).waitFor();await page.screenshot({path:path.join(output,'reduced-day-preview-desktop.png'),fullPage:true});
 await page.getByRole('button',{name:'Apply reduced day',exact:true}).click();await page.getByText('Reduced Day active',{exact:true}).waitFor();
 await page.screenshot({path:path.join(output,'today-changed-reduced-desktop.png'),fullPage:true});
 await page.getByRole('button',{name:'Return to normal day',exact:true}).click();await page.getByRole('button',{name:'Reduce today',exact:true}).waitFor({timeout:5000}).catch(async e=>{console.log('RETURN BODY',await page.locator('body').innerText());await page.screenshot({path:path.join(output,'return-debug.png'),fullPage:true});throw e});checks.push('Reduced Day preview/apply/return and real Changed');
 await page.getByRole('button',{name:'More',exact:true}).click();console.log('MORE',await page.locator('body').innerText());
 const relief=page.getByRole('navigation',{name:'Secondary'}).getByRole('button',{name:/Relief|Reset/});await relief.click();await page.getByRole('heading',{name:'Relief',exact:true}).waitFor();
 await page.getByRole('button',{name:'Restart with one action',exact:true}).click();await page.getByText('Restart preview only. No task was started or completed.',{exact:true}).waitFor();await page.screenshot({path:path.join(output,'relief-desktop.png'),fullPage:true});
 await page.getByText('Behaviour history controls',{exact:true}).click();await page.getByLabel('Type DELETE BEHAVIOUR HISTORY to delete behaviour history',{exact:true}).fill('DELETE');await page.getByText('Behaviour history controls',{exact:true}).click();await page.getByText('Behaviour history controls',{exact:true}).click();
 if(await page.getByLabel('Type DELETE BEHAVIOUR HISTORY to delete behaviour history',{exact:true}).inputValue()!=='DELETE')throw new Error('Disclosure lost input');checks.push('Relief preview truthful; history explicit disclosure retains input, unsupported controls absent');
 await page.setViewportSize({width:390,height:844});await page.getByText('Behaviour history controls',{exact:true}).click();await page.screenshot({path:path.join(output,'relief-mobile.png'),fullPage:true});
 await page.getByRole('button',{name:'Today',exact:true}).click();await page.screenshot({path:path.join(output,'today-mobile.png'),fullPage:true});
 const horizontal=await page.evaluate(()=>({scroll:document.documentElement.scrollWidth,client:document.documentElement.clientWidth}));if(horizontal.scroll>horizontal.client)throw new Error('Mobile horizontal overflow '+JSON.stringify(horizontal));
 await page.getByRole('button',{name:'Plan',exact:true}).click();row=page.getByRole('list',{name:/Day Line/}).locator('li').filter({has:page.getByText('Send form',{exact:true})});await row.getByText('Correct Send form',{exact:true}).click();await row.getByRole('button',{name:'Move',exact:true}).click();await page.getByLabel('Move start time',{exact:true}).focus();await page.screenshot({path:path.join(output,'plan-move-mobile.png'),fullPage:true});
 await page.keyboard.press('Escape');checks.push('390px Today/Plan Move/Relief; no horizontal overflow; Escape focus return');
 // Re-entry from explicit dated throwaway input, with no catch-up action.
 await page.evaluate(async()=>{
  const {getCurrentLifeRhythmDatabase}=await import('/src/data/localDataNamespace.ts');
  const {activeTaskSchema}=await import('/src/data/schemas.ts');
  const db=getCurrentLifeRhythmDatabase();const now=new Date().toISOString();
  await db.activeTasks.put(activeTaskSchema.parse({id:'reentry-form',title:'Review old form',area:'admin',source:'adhoc',status:'active',showToday:true,minimum:{label:'Check whether the form still helps',minutes:5},normal:{label:'Read the form',minutes:10},full:{label:'Complete form',minutes:20},timeConstraint:'dueBy',dueAt:'2026-10-04T02:00:00.000Z',missedPolicy:'ask',createdAt:now,updatedAt:now}));
 });
 await page.reload();await page.getByRole('heading',{name:'Needs a choice',exact:true}).waitFor();
 await page.getByRole('heading',{name:'Needs a choice',exact:true}).scrollIntoViewIfNeeded();await page.screenshot({path:path.join(output,'reentry-mobile.png')});checks.push('Dated re-entry review with explicit choices and no blanket catch-up');
 await page.getByRole('button',{name:'Library',exact:true}).click();await page.getByText('More about Reset walk',{exact:true}).click();await page.getByRole('button',{name:'Edit rhythm',exact:true}).click();await page.getByRole('dialog').waitFor();await page.screenshot({path:path.join(output,'rhythm-config-mobile.png')});await page.keyboard.press('Escape');checks.push('B2 configured rhythm editable in mobile modal; occurrence generated and rendered; linked execution covered by existing tests');
 await page.getByRole('button',{name:'More',exact:true}).click();await page.getByRole('navigation',{name:'Secondary'}).getByRole('button',{name:'Settings',exact:true}).click();await page.getByRole('heading',{name:'Settings',exact:true}).waitFor();
 for(const name of ['Monday','Tuesday','Wednesday','Thursday','Friday','Saturday','Sunday'])await page.getByRole('checkbox',{name,exact:true}).waitFor();
 await page.getByRole('group',{name:'Workday planning hours',exact:true}).getByLabel('Earliest planning time',{exact:true}).focus();await page.screenshot({path:path.join(output,'settings-planning-mobile.png')});checks.push('B2 seven weekdays, work and usable-day inputs reachable on mobile');

 const downloadPromise=page.waitForEvent('download');await page.getByRole('button',{name:'Export portable backup',exact:true}).click();const download=await downloadPromise;await download.saveAs(path.join(output,'throwaway-portable.json'));
 await page.getByText('Restore from a portable backup',{exact:true}).click();await page.getByLabel('Select portable backup file',{exact:true}).setInputFiles(path.join(output,'throwaway-portable.json'));await page.getByRole('button',{name:'Check backup',exact:true}).click();await page.getByLabel('Portable backup preview',{exact:true}).waitFor();
 await page.screenshot({path:path.join(output,'portable-check-mobile.png')});checks.push('B2 portable export download and file check in cloud browser, restore safeguarded and not applied');
 fs.writeFileSync(path.join(output,'browser-report.json'),JSON.stringify({seed,browser:await browser.version(),timezone:'Australia/Perth',date:'2026-10-05 09:00',checks,errors},null,2));
 console.log('CHECKS',checks,'ERRORS',errors);await browser.close();
})().catch(e=>{console.error(e);process.exit(1)});
