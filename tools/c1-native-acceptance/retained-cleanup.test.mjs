import { test } from "node:test";
import assert from "node:assert/strict";
import * as supervision from "./supervision.mjs";
import { connectorReceipt } from "./observer-receipt.mjs";
import { manifest, Budget, protectionCredential, scopedHeaders, releaseProtectionCredential } from "./policy.mjs";

async function complete(options={}) {
  const {completeBypassCleanup}=await import("./retained-cleanup.mjs");
  return completeBypassCleanup({credential:protectionCredential("automation-bypass",secret),
    budget:new Budget(),deadline:Date.now()+110000,env,config,...options});
}

const secret = "SYNTHETIC_BYPASS_VALUE_123456789";
const env = { GITHUB_RUN_ID:"123", GITHUB_RUN_ATTEMPT:"1",
  C1_TRUSTED_SHA:"a".repeat(40), C1_PRE_RECEIPT_ID:"456" };
const config = { enabled:true, immutableOriginApproved:true, immutableOrigin:manifest.origin,
  mode:"external-connector-automation", trustedObserverIds:[manifest.ownerId], receiptIssue:179 };
const deployment = { id:manifest.deployment, url:new URL(manifest.origin).hostname,
  project:{id:manifest.project}, readyState:"READY", target:null, source:"git",
  meta:{githubCommitSha:manifest.source} };
const context = { accountEmail:"dezrobbo1@gmail.com", teamId:manifest.team,
  requestedDeployment:manifest.deployment, exactKeyRevoked:true, environmentSecretRemoved:true,
  bypassInventoryEmpty:true, deploymentsUnchanged:true };
function record(requestedAt=Date.now()-1000) {
  return connectorReceipt(deployment, {...context,revokedAt:new Date(requestedAt+100).toISOString()},
    env,"bypass-revoked",manifest,{requestedAt});
}
test("external revocation receipt is distinct from native completion and requires real management attestations",()=>{
  const requestedAt=Date.now()-1000, r=record(requestedAt);
  supervision.verifyRecord(r,env,manifest,"bypass-revoked",Date.now(),{requestedAt},config.mode);
  for(const patch of [{exactKeyRevoked:false},{environmentSecretRemoved:false},{bypassInventoryEmpty:false},
    {deploymentsUnchanged:false},{revokedAt:new Date(requestedAt-100).toISOString()}])
    assert.throws(()=>connectorReceipt(deployment,{...context,revokedAt:r.revokedAt,...patch},env,
      "bypass-revoked",manifest,{requestedAt}));
  for(const patch of [{preReceipt:999},{runId:"999"},{harness:"b".repeat(40)},
    {revocationMethod:"RUNNER_SELF_CLAIM"},{observedAt:new Date(requestedAt-3000).toISOString()},
    {password:secret}])
    assert.throws(()=>supervision.verifyRecord({...r,...patch},env,manifest,"bypass-revoked",
      Date.now(),{requestedAt},config.mode));
  assert(!JSON.stringify(r).includes(secret));
});
test("old key still admits, ordinary access admits, transport failure and foreign redirect all BLOCK without retries",async()=>{
  for(const defect of ["old-admits","ordinary-admits","transport","redirect","response-redirected"]) {
    let requests=0;
    await assert.rejects(complete({adapters:{signal:()=>{},observation:async()=>({receipt:789}),
      fetch:async(url,init)=>{
        requests++;
        if(defect==="transport" && requests===1)throw Error(secret);
        if(defect==="redirect")return new Response(null,{status:302,headers:{location:"https://other.invalid/"}});
        const r=new Response(secret,{status:(defect==="old-admits"&&requests===1)||
          (defect==="ordinary-admits"&&requests===2)?200:403});
        if(defect==="response-redirected")Object.defineProperty(r,"redirected",{value:true});
        return r;
      }}}));
    assert.equal(requests,2);
  }
});
test("exact-host SSO redirect is inspected without following it; headers and body stay out of evidence",async()=>{
  const r=await complete({adapters:{signal:()=>{},observation:async()=>({receipt:789}),
    fetch:async()=>new Response(secret,{status:302,headers:{location:"https://vercel.com/sso-api?url="+
      encodeURIComponent(manifest.origin+"/")+"&nonce=synthetic"}})}});
  assert.equal(r.oldKeyStatus,302);assert.equal(r.ordinaryStatus,302);
  assert(!JSON.stringify(r).includes(secret));
});
test("absent or invalid external evidence, exhausted request reserve and missed deadline cannot emit cleanup evidence",async(t)=>{
  let fetches=0;
  const fetch=async()=>{fetches++;return new Response(null,{status:403});};
  await assert.rejects(complete({adapters:{signal:()=>{},fetch,observation:async()=>{throw Error(secret);}}}));
  assert.equal(fetches,0);
  const budget=new Budget();budget.requests=200;
  await assert.rejects(complete({budget,adapters:{signal:()=>{},fetch,observation:async()=>({receipt:789})}}));
  assert.equal(fetches,0);
  await assert.rejects(complete({deadline:Date.now()+20000,adapters:{signal:()=>{},fetch}}));
  assert.equal(fetches,0);
  const realNow=Date.now(),clock=t.mock.method(Date,"now",()=>realNow);
  await assert.rejects(complete({adapters:{signal:()=>{},fetch,observation:async()=>{
    clock.mock.mockImplementation(()=>realNow+111000);return{receipt:789};}}}));
  assert.equal(fetches,0);
});
test("hung external observation is terminated by the absolute cleanup timer",async(t)=>{
  const {completeBypassCleanup}=await import("./retained-cleanup.mjs");
  t.mock.timers.enable({apis:["setTimeout"]});
  let fetches=0;
  const pending=assert.rejects(completeBypassCleanup({credential:protectionCredential("automation-bypass",secret),
    budget:new Budget(),deadline:Date.now()+110000,env,config,adapters:{signal:()=>{},
      observation:()=>new Promise(()=>{}),fetch:async()=>{fetches++;return new Response(null,{status:403});}}}));
  t.mock.timers.tick(110000);
  await pending;assert.equal(fetches,0);
});
test("released key carrier cannot later supply a header",()=>{
  const c=protectionCredential("automation-bypass",secret);
  releaseProtectionCredential(c);
  assert.throws(()=>scopedHeaders(manifest.origin+"/",c));
});
test("native retains old key until external revocation, makes two bounded exact-host probes and emits sanitized evidence",async()=>{
  const m=await import("./retained-cleanup.mjs");
  const budget=new Budget(), seen=[];
  const result=await m.completeBypassCleanup({credential:protectionCredential("automation-bypass",secret),
    budget,deadline:Date.now()+110000,env,config,adapters:{
      signal:()=>seen.push("signal"),
      observation:async(e,c,p,g,t,pending)=>{seen.push("external");return{receipt:789};},
      fetch:async(url,init)=>{seen.push(init.headers["x-vercel-protection-bypass"]?"old":"ordinary");
        assert.equal(url,manifest.origin+"/");assert.equal(init.redirect,"manual");
        assert.equal(init.cache,"no-store");assert(init.signal);
        assert.deepEqual(init.headers,seen.at(-1)==="old"?{"x-vercel-protection-bypass":secret}:{});
        return new Response(null,{status:403});}
    }});
  assert.deepEqual(seen,["signal","external","old","ordinary"]);
  assert.equal(budget.requests,2);assert.equal(result.revocationReceipt,789);
  assert.equal(result.oldKeyStatus,403);assert.equal(result.ordinaryStatus,403);
  assert(!JSON.stringify(result).includes(secret));
});
function postFixture() {
  const now=Date.now(),iso=offset=>new Date(now+offset).toISOString();
  const phase={format:2,gate:"BLOCK",hosted:"TEST_PHASE_COMPLETE_PENDING_POST",runId:"123",attempt:"1",
    harness:env.C1_TRUSTED_SHA,protectionMode:"automation-bypass",source:manifest.source,
    deployment:manifest.deployment,origin:manifest.origin,preReceipt:456,completedAt:iso(-1500),
    passed:[],requests:100,passwordSignins:5,
    fixtures:{baselineDigest:"d".repeat(64),baselineReceipt:458,fixtureRestoredReceipt:459},
    bypassCleanup:{revocationReceipt:789,requestedAt:iso(-3000),verifiedAt:iso(-2000),oldKeyStatus:403,ordinaryStatus:403}};
  const job={id:654,run_id:123,run_attempt:1,head_sha:env.C1_TRUSTED_SHA,name:"C1 native test phase",
    status:"completed",conclusion:"success",started_at:iso(-10000),completed_at:iso(-1000)};
  const base=connectorReceipt(deployment,context,env,"pre");
  const receipt=(phase,id,offset,extra)=>({id,user:{id:Number(manifest.ownerId),type:"User"},
    body:JSON.stringify({...base,phase,observedAt:iso(offset),...extra}),
    created_at:iso(offset+1),updated_at:iso(offset+1),
    issue_url:"https://api.github.com/repos/"+manifest.repository+"/issues/179",
    html_url:"https://github.com/"+manifest.repository+"/issues/179#issuecomment-"+id});
  const restored=receipt("fixture-restored",459,-4000,{baselineDigest:phase.fixtures.baselineDigest,
    preReceipt:456,fixtureObservationMethod:"SUPABASE_EXISTING_CONNECTION_METADATA"});
  const revoked=receipt("bypass-revoked",789,-2500,{preReceipt:456,revokedAt:iso(-2600),
    revocationMethod:"VERCEL_EXISTING_CONNECTION_EXACT_KEY_REVOCATION",
    environmentSecretRemoved:true,bypassInventoryEmpty:true,deploymentsUnchanged:true});
  const run={id:123,run_attempt:1,head_sha:env.C1_TRUSTED_SHA,head_branch:"main",event:"workflow_dispatch",
    path:".github/workflows/c1-native-acceptance.yml",repository:{id:Number(manifest.repositoryId),full_name:manifest.repository}};
  return {phase,job,base,restored,revoked,run,iso};
}
async function finalize(f) {
  const {rows}=await import("./policy.mjs"); f.phase.passed=[...rows];
  const text=JSON.stringify(f.phase),phaseDigest=supervision.digest(text);
  const post={...f.restored,id:790,body:JSON.stringify({...f.base,phase:"post",phaseDigest,
    preReceipt:456,completedAt:f.job.completed_at,fixtureBaselineDigest:f.phase.fixtures.baselineDigest,
    fixtureRestoredReceipt:459,bypassRevocationReceipt:789,bypassCleanupVerified:true}),
    created_at:f.base.observedAt,updated_at:f.base.observedAt,
    html_url:"https://github.com/"+manifest.repository+"/issues/179#issuecomment-790"};
  const e={...env,C1_PROTECTION_MODE:"automation-bypass",GITHUB_REPOSITORY:manifest.repository,
    GITHUB_REPOSITORY_ID:manifest.repositoryId,GITHUB_REPOSITORY_OWNER_ID:manifest.ownerId,
    GITHUB_EVENT_NAME:"workflow_dispatch",GITHUB_REF:"refs/heads/main",GITHUB_WORKFLOW_REF:manifest.workflowRef,
    GITHUB_WORKFLOW_SHA:env.C1_TRUSTED_SHA,C1_HARNESS_SHA:env.C1_TRUSTED_SHA,RUNNER_ENVIRONMENT:"github-hosted",
    C1_ENABLED:"true",C1_PHASE_RESULT_B64:Buffer.from(text).toString("base64"),C1_PHASE_DIGEST:phaseDigest,C1_NATIVE_JOB_ID:"654"};
  const receipts=[f.restored,f.revoked,post].filter(Boolean);
  const get=async path=>path.includes("/actions/jobs/")?f.job:path.includes("/issues/179/comments")?receipts:
    path.includes("/issues/comments/")?receipts.find(r=>path.endsWith("/"+r.id)):f.run;
  return supervision.postVerification(e,config,get);
}
test("independent post rereads completed job, fixture restoration, external revocation and bound native probe evidence",async()=>{
  assert.equal((await finalize(postFixture())).gate,"PASS");
  for(const mutate of [
    f=>f.job.conclusion="failure",f=>f.job.status="in_progress",f=>f.phase.bypassCleanup=null,
    f=>f.phase.bypassCleanup.revocationReceipt=999,f=>f.phase.bypassCleanup.oldKeyStatus=200,
    f=>f.phase.bypassCleanup.ordinaryStatus=200,f=>f.phase.bypassCleanup.password=secret,
    f=>f.revoked=null,f=>f.revoked.user.id=999,f=>f.revoked.updated_at=f.iso(0),
    f=>f.revoked.body=JSON.stringify({...JSON.parse(f.revoked.body),environmentSecretRemoved:false}),
    f=>f.revoked.body=JSON.stringify({...JSON.parse(f.revoked.body),runId:"999"}),
    f=>f.revoked.body=JSON.stringify({...JSON.parse(f.revoked.body),observedAt:f.iso(-1800)}),
  ]) {const f=postFixture();mutate(f);await assert.rejects(finalize(f));}
});
test("post receipt builder requires fresh external cleanup attestation in addition to a successful native job",async()=>{
  const {rows}=await import("./policy.mjs"),f=postFixture();f.phase.passed=[...rows];
  const pending={...f.phase,phaseDigest:"d".repeat(64)};
  const e={...env,C1_PROTECTION_MODE:"automation-bypass",C1_PHASE_DIGEST:pending.phaseDigest,C1_NATIVE_JOB_ID:"654"};
  const c={...context,fixtureProject:"lfwadowwdvcnibjkeerg",fixtureVerified:true,baselineDigest:pending.fixtures.baselineDigest};
  const r=connectorReceipt(deployment,c,e,"post",manifest,pending,f.job);
  assert.equal(r.bypassRevocationReceipt,789);
  for(const key of ["exactKeyRevoked","environmentSecretRemoved","bypassInventoryEmpty","deploymentsUnchanged"])
    assert.throws(()=>connectorReceipt(deployment,{...c,[key]:false},e,"post",manifest,pending,f.job));
});
test("receipt-read latency cannot extend the 90-second observation wait",async(t)=>{
  const {completeBypassCleanup}=await import("./retained-cleanup.mjs");
  t.mock.timers.enable({apis:["setTimeout"]});
  let blocked=false,fetches=0;
  const pending=completeBypassCleanup({credential:protectionCredential("automation-bypass",secret),
    budget:new Budget(),deadline:Date.now()+110000,env,config,adapters:{signal:()=>{},
      observation:()=>new Promise(()=>{}),fetch:async()=>{fetches++;return new Response(null,{status:403});}}})
    .then(()=>assert.fail("missing receipt admitted"),()=>{blocked=true;});
  t.mock.timers.tick(90000);
  for(let n=0;n<12;n++)await Promise.resolve();
  try {assert.equal(blocked,true);assert.equal(fetches,0);}
  finally {t.mock.timers.tick(20000);await pending;}
});
test("late cancellation during final artifact writing makes the real CLI job fail closed",async()=>{
  const {mkdtemp,writeFile,readFile,rm}=await import("node:fs/promises");
  const {tmpdir}=await import("node:os"),{join}=await import("node:path"),{spawnSync}=await import("node:child_process");
  const {rows}=await import("./policy.mjs");
  const dir=await mkdtemp(join(tmpdir(),"c1-late-cancel-"));
  const runUrl=new URL("./run.mjs",import.meta.url).href,orchestratorUrl=new URL("./orchestrator.mjs",import.meta.url).href,
    preflightUrl=new URL("./preflight.mjs",import.meta.url).href;
  const result={...postFixture().phase,passed:[...rows]},jobs={total_count:1,jobs:[{id:654,name:"C1 native test phase",
    run_id:123,run_attempt:1,head_sha:env.C1_TRUSTED_SHA}]};
  try {
    const fsUrl=new URL("file://"+join(dir,"cancel-fs.mjs")).href;
    await writeFile(join(dir,"cancel-fs.mjs"),'export * from "node:fs/promises";import {writeFile as real} from "node:fs/promises";export async function writeFile(p,b,o){await real(p,b,o);if(p==="artifacts/results.json")process.emit("SIGTERM");}');
    const hook=`import {registerHooks} from "node:module";
      globalThis.fetch=()=>{throw Error("offline network forbidden");};
      registerHooks({resolve(s,c,next){if(s==="node:fs/promises"&&c.parentURL===${JSON.stringify(runUrl)})return{url:${JSON.stringify(fsUrl)},shortCircuit:true};return next(s,c);},
      load(u,c,next){if(u===${JSON.stringify(orchestratorUrl)})return{format:"module",shortCircuit:true,source:${JSON.stringify("export async function executeAcceptance(){return "+JSON.stringify(result)+";}")}};
      if(u===${JSON.stringify(preflightUrl)})return{format:"module",shortCircuit:true,source:${JSON.stringify("export async function githubGet(){return "+JSON.stringify(jobs)+";}export async function preflight(){}")}};return next(u,c);}});`;
    await writeFile(join(dir,"hook.mjs"),hook);
    const child=spawnSync(process.execPath,["--import",join(dir,"hook.mjs"),new URL("./run.mjs",import.meta.url).pathname],{
      cwd:dir,encoding:"utf8",timeout:5000,env:{...env,C1_PROTECTION_MODE:"automation-bypass",GITHUB_OUTPUT:join(dir,"outputs")}});
    assert.equal(child.stderr,"");assert.equal(child.status,1);
    assert.equal(child.stdout,"C1_NATIVE_ATTEMPT_BLOCKED\n");
    assert.equal(JSON.parse(await readFile(join(dir,"artifacts/results.json"),"utf8")).gate,"BLOCK");
  } finally {await rm(dir,{recursive:true,force:true});}
});
