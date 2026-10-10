import { test } from "node:test";
import assert from "node:assert/strict";
import { readPublicConfig, publicTextReader } from "./admission.mjs";
import { executeAcceptance } from "./orchestrator.mjs";
import { manifest } from "./policy.mjs";
const sentinel = "SYNTHETIC_SECRET_DO_NOT_RETAIN_9271";
const sha = "a".repeat(40);
const env = () => { const start=Date.now(); return {
  C1_JOB_STARTED_AT:String(start), C1_JOB_DEADLINE_MS:String(start+19*60*1000),
  GITHUB_RUN_ID:"123", GITHUB_RUN_ATTEMPT:"1", GITHUB_REPOSITORY:manifest.repository,
  GITHUB_REPOSITORY_ID:manifest.repositoryId,GITHUB_REPOSITORY_OWNER_ID:manifest.ownerId,
  GITHUB_EVENT_NAME:"workflow_dispatch",GITHUB_REF:"refs/heads/main",GITHUB_WORKFLOW_REF:manifest.workflowRef,
  GITHUB_WORKFLOW_SHA:sha,C1_HARNESS_SHA:sha,RUNNER_ENVIRONMENT:"github-hosted",
  C1_ENABLED:"true",C1_TRUSTED_SHA:sha,C1_PROTECTION_MODE:"trusted-source",
}; };
const html = '<script type="module" src="/assets/index-reviewed.js"></script>';
const js = `function config(env={VITE_SUPABASE_URL:"${manifest.provider}",VITE_SUPABASE_PUBLISHABLE_KEY:"sb_publishable_synthetic",VITE_LIFE_RHYTHM_MODE:"required",VITE_LIFE_RHYTHM_AUTH_ENABLED:"true"}){return [env.VITE_SUPABASE_URL,env.VITE_SUPABASE_PUBLISHABLE_KEY,env.VITE_LIFE_RHYTHM_AUTH_ENABLED,env.VITE_LIFE_RHYTHM_MODE]}`;
const response = (body, type="text/html", status=200) => new Response(body,{status,headers:{"content-type":type,"x-untrusted":sentinel}});
const secretError = () => new TypeError(sentinel,{cause:new Error(sentinel)});
async function blocked(fetcher) {
  const calls=[];let passwords=0;
  const e=env();
  for (const label of ["A","B"]) Object.defineProperty(e,"C1_ACCOUNT_"+label+"_PASSWORD",{get(){passwords++;throw secretError();}});
  const result=await executeAcceptance(e,{enabled:true},{
    preflight:async()=>{},attribution:async()=>({preReceipt:456}),oidc:async()=>"synthetic-oidc",
    publicConfig:(oidc,budget)=>readPublicConfig(publicTextReader(oidc,budget,async(u,o)=>{
      calls.push(u); assert.equal(o.redirect,"error");assert.equal(o.cache,"no-store");
      assert.equal(new URL(u).origin,manifest.origin);assert(!o.headers.Authorization);assert(!o.headers.Cookie);
      return fetcher(u,o);
    })),
    key:()=>{throw secretError();},login:()=>{throw secretError();},
  });
  assert.equal(result.gate,"BLOCK");assert.equal(result.hosted,"ATTEMPTED_BLOCKED");
  assert.deepEqual(result.passed,[]);assert.equal(result.postVerification,"PENDING");
  assert.equal(result.passwordSignins,0);assert.equal(passwords,0);assert.equal(result.requests,calls.length);
  const serialized=JSON.stringify(result);assert(!serialized.includes(sentinel));
  return {result:JSON.parse(serialized),calls};
}
test("root HTTP failure survives orchestration and results JSON serialization",async()=>{
  const {result,calls}=await blocked(()=>response(sentinel,"text/html",403));
  assert.equal(calls.length,1);
  assert.deepEqual(result.admissionFailure,{stage:"root_response",category:"http_response",responseReceived:true,status:403,contentType:"html",validationCode:"HTTP_STATUS"});
  assert.equal(result.harness,sha);assert.equal(result.source,manifest.source);assert.equal(result.deployment,manifest.deployment);assert.equal(result.runId,"123");
});
const cases = [
  {name:"transport rejection",root:()=>{throw secretError();},stage:"root_request",category:"transport_unknown",status:null,type:"unknown",code:null,count:1},
  {name:"redirect:error rejection does not invent 302",root:()=>{throw new TypeError(sentinel,{cause:new Error("unexpected redirect "+sentinel)});},stage:"root_request",category:"transport_unknown",status:null,type:"unknown",code:null,count:1},
  {name:"recognized timeout",root:()=>{throw new DOMException(sentinel,"TimeoutError");},stage:"root_request",category:"transport_timeout",status:null,type:"unknown",code:null,count:1},
  {name:"recognized DNS code",root:()=>{const cause=Object.assign(new Error(sentinel),{code:"ENOTFOUND"});throw new TypeError(sentinel,{cause});},stage:"root_request",category:"transport_dns",status:null,type:"unknown",code:null,count:1},
  {name:"unrecognized cause code",root:()=>{const cause=Object.assign(new Error(sentinel),{code:sentinel});throw new TypeError(sentinel,{cause});},stage:"root_request",category:"transport_unknown",status:null,type:"unknown",code:null,count:1},
  {name:"obtained redirect response",root:()=>response(sentinel,"text/plain",302),stage:"root_response",category:"http_response",status:302,type:"plain_text",code:"HTTP_STATUS",count:1},
  {name:"unexpected root content type",root:()=>response(sentinel,"application/json"),stage:"root_response",category:"http_response",status:200,type:"json",code:"CONTENT_TYPE",count:1},
  {name:"untrusted content type is other",root:()=>response(sentinel,sentinel),stage:"root_response",category:"http_response",status:200,type:"other",code:"CONTENT_TYPE",count:1},
  {name:"missing content type",root:()=>new Response(new Uint8Array([42])),stage:"root_response",category:"http_response",status:200,type:"missing",code:"CONTENT_TYPE",count:1},
  {name:"missing body",root:()=>response(null),stage:"root_body",category:"body_read",status:200,type:"html",code:"BODY_MISSING",count:1},
  {name:"body reader rejection",root:()=>response(new ReadableStream({start(c){c.error(secretError());}})),stage:"root_body",category:"body_read",status:200,type:"html",code:"BODY_READ",count:1},
  {name:"invalid UTF-8",root:()=>response(new Uint8Array([255])),stage:"root_body",category:"body_read",status:200,type:"html",code:"BODY_UTF8",count:1},
  {name:"root size bound",root:()=>response(sentinel+"x".repeat(256*1024)),stage:"root_body",category:"body_read",status:200,type:"html",code:"BODY_LIMIT",count:1},
  {name:"missing module",html:sentinel,stage:"html_discovery",category:"validation",status:200,type:"html",code:"MODULE_COUNT",count:1},
  {name:"multiple modules",html:html+html+sentinel,stage:"html_discovery",category:"validation",status:200,type:"html",code:"MODULE_COUNT",count:1},
  {name:"module lacks src",html:'<script type="module" data-secret="'+sentinel+'"></script>',stage:"html_discovery",category:"validation",status:200,type:"html",code:"MODULE_SOURCE_MISSING",count:1},
  {name:"foreign module URL",html:'<script type="module" src="https://foreign.test/'+sentinel+'.js"></script>',stage:"html_discovery",category:"validation",status:200,type:"html",code:"ASSET_REFERENCE",count:1},
  {name:"rejected static reference",html:html+'<link href="/assets/a.css?'+sentinel+'">',stage:"html_discovery",category:"validation",status:200,type:"html",code:"ASSET_REFERENCE",count:1},
  {name:"bootstrap transport",bootstrap:()=>{throw secretError();},stage:"bootstrap_request",category:"transport_unknown",status:null,type:"unknown",code:null,count:2},
  {name:"bootstrap non-200",bootstrap:()=>response(sentinel,"application/javascript",503),stage:"bootstrap_response",category:"http_response",status:503,type:"javascript",code:"HTTP_STATUS",count:2},
  {name:"bootstrap content type",bootstrap:()=>response(sentinel,"text/plain"),stage:"bootstrap_response",category:"http_response",status:200,type:"plain_text",code:"CONTENT_TYPE",count:2},
  {name:"bootstrap body failure",bootstrap:()=>response(new ReadableStream({start(c){c.error(secretError());}}),"text/javascript"),stage:"bootstrap_body",category:"body_read",status:200,type:"javascript",code:"BODY_READ",count:2},
  {name:"bootstrap UTF-8",bootstrap:()=>response(new Uint8Array([255]),"application/javascript"),stage:"bootstrap_body",category:"body_read",status:200,type:"javascript",code:"BODY_UTF8",count:2},
  {name:"bootstrap size bound",bootstrap:()=>response(sentinel+"x".repeat(5*1024*1024),"application/javascript"),stage:"bootstrap_body",category:"body_read",status:200,type:"javascript",code:"BODY_LIMIT",count:2},
  {name:"JS parser rejection",js:'const '+sentinel+' = "unterminated',stage:"javascript_parse",category:"javascript_parse",status:200,type:"javascript",code:"JS_PARSE",count:2},
  {name:"missing public configuration",js:'const value="'+sentinel+'";',stage:"public_config_selection",category:"validation",status:200,type:"javascript",code:"CONFIG_MISSING",count:2},
  {name:"ambiguous configuration",js:js+js.replace("function config","function second").replace('"required"','"'+sentinel+'"'),stage:"public_config_selection",category:"validation",status:200,type:"javascript",code:"CONFIG_AMBIGUOUS",count:2},
  {name:"invalid config flags",js:js.replace('"true"','"'+sentinel+'"'),stage:"public_config_validation",category:"validation",status:200,type:"javascript",code:"CONFIG_VALUES",count:2},
  {name:"duplicate config properties",js:js.replace('VITE_LIFE_RHYTHM_MODE:"required"','VITE_LIFE_RHYTHM_MODE:"required",VITE_LIFE_RHYTHM_MODE:"'+sentinel+'"'),stage:"public_config_selection",category:"validation",status:200,type:"javascript",code:"CONFIG_PROPERTIES",count:2},
  {name:"dynamic config",js:js.replace('"required"',sentinel),stage:"public_config_selection",category:"validation",status:200,type:"javascript",code:"CONFIG_LITERAL",count:2},
  {name:"foreign JS import",js:'import "https://foreign.test/'+sentinel+'.js";'+js,stage:"javascript_assets",category:"validation",status:200,type:"javascript",code:"ASSET_REFERENCE",count:2},
  {name:"decoy key",js:js+';const decoy="sb_secret_'+sentinel+'";',stage:"public_config_validation",category:"validation",status:200,type:"javascript",code:"CONFIG_KEY_AMBIGUOUS",count:2},
];
for(const c of cases) test("serialized admission evidence: "+c.name,async()=>{
  const {result,calls}=await blocked(u=>new URL(u).pathname === "/" ?
    (c.root ? c.root() : response(c.html??html)) :
    (c.bootstrap ? c.bootstrap() : response(c.js??js,"application/javascript")));
  assert.equal(calls.length,c.count);assert.deepEqual(result.admissionFailure,{
    stage:c.stage,category:c.category,responseReceived:c.status!==null,status:c.status,contentType:c.type,validationCode:c.code,
  });
});
import { AdmissionTrace, admissionFailureFrom, validateAdmissionFailure } from "./admission-evidence.mjs";
import { report, Budget } from "./policy.mjs";
import { mkdtemp, writeFile, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { spawnSync } from "node:child_process";
test("strict projection rejects fields, accessors, arbitrary enums and inconsistent response unknowns",()=>{
  const good={stage:"root_response",category:"http_response",responseReceived:true,status:403,contentType:"html",validationCode:"HTTP_STATUS"};
  assert.deepEqual(validateAdmissionFailure(good),good);
  for(const bad of [{...good,body:sentinel},{...good,stage:sentinel},{...good,category:sentinel},
    {...good,contentType:sentinel},{...good,validationCode:sentinel},{...good,status:sentinel},
    {...good,status:1000},{...good,status:null},{...good,responseReceived:false},{...good,responseReceived:"true"},
    {...good,category:"transport_unknown",validationCode:null},{...good,category:"body_read",validationCode:"BODY_READ"},
    {...good,[Symbol("secret")]:sentinel},Object.defineProperty({...good},"stage",{get(){throw secretError();}})]) {
    assert.equal(validateAdmissionFailure(bad),null);assert(!JSON.stringify(report([],"BLOCK",bad)).includes(sentinel));
  }
  const unknown={stage:"root_request",category:"transport_unknown",responseReceived:false,status:null,contentType:"unknown",validationCode:null};
  assert.deepEqual(validateAdmissionFailure(unknown),unknown);
  assert.equal(validateAdmissionFailure({...unknown,status:302}),null);
  assert.equal(validateAdmissionFailure({...unknown,contentType:"html"}),null);
  assert.equal(admissionFailureFrom({admissionFailure:good,message:sentinel}),null);
});
test("body failure remains first when body cleanup also fails",async()=>{
  const r=response("body");
  const reader={read:async()=>{throw secretError();},cancel:async()=>{throw secretError();},releaseLock:()=>{throw secretError();}};
  Object.defineProperty(r,"body",{value:{getReader:()=>reader}});
  const {result}=await blocked(()=>r);
  assert.equal(result.admissionFailure.validationCode,"BODY_READ");assert.equal(result.admissionFailure.stage,"root_body");
});
test("orchestrator cleanup failure cannot replace the first operational admission failure",async()=>{
  let cleanupCalls=0;
  const d={preflight:async()=>{},attribution:async()=>({preReceipt:456}),oidc:async()=>"synthetic-oidc",
    publicConfig:async()=>({publishableKey:"sb_publishable_synthetic"}),transport:()=>()=>{},key:async()=>({}),denial:async()=>{},
    login:async(t,a,p,k,pk,track)=>{const s={access_token:"synthetic"};track(s);return s;},
    metadata:async(t,a)=>({revision:a.revision}),refresh:async(t,a,s)=>s,readHead:async(t,a)=>({revision:a.revision}),
    browser:async()=>({version:()=>"153.0.8010.12",close:async()=>{cleanupCalls++;throw secretError();}}),browserRow:async(b,w)=>"ui-"+w,
    coverage:async()=>readPublicConfig(publicTextReader("synthetic-oidc",new Budget(),async()=>response(sentinel,"text/html",403))),
    logout:async()=>{cleanupCalls++;throw secretError();},
  };
  const r=await executeAcceptance({...env(),C1_ACCOUNT_A_PASSWORD:"synthetic-A",C1_ACCOUNT_B_PASSWORD:"synthetic-B"},{enabled:true},d);
  assert(cleanupCalls>=3);assert.equal(r.gate,"BLOCK");assert.equal(r.hosted,"ATTEMPTED_BLOCKED");
  assert.equal(r.admissionFailure.stage,"root_response");assert.equal(r.admissionFailure.status,403);assert(!JSON.stringify(r).includes(sentinel));
});
test("evidence fallback preserves the diagnostic while dropping invalid attribution",async()=>{
  const e=env();
  const d={preflight:async()=>{},attribution:async()=>({preReceipt:456}),oidc:async()=>"synthetic-oidc",
    publicConfig:async()=>{try {await readPublicConfig(publicTextReader("synthetic-oidc",new Budget(),async()=>response(sentinel,"text/html",403)));}
      catch(error){e.C1_TRUSTED_SHA=sentinel;throw error;}}
  };
  const r=await executeAcceptance(e,{enabled:true},d);assert.equal(r.gate,"BLOCK");assert.equal(r.hosted,"NOT_RUN");
  assert.equal(r.admissionFailure.status,403);assert(!JSON.stringify(r).includes(sentinel));
});
test("late transport timeout retains only the current stage, without retry or inferred status",async()=>{
  const d={timeoutMs:10,preflight:async()=>{},attribution:async()=>({preReceipt:456}),oidc:async()=>"synthetic-oidc",
    publicConfig:(o,b,trace)=>readPublicConfig(publicTextReader(o,b,()=>new Promise(()=>{}),trace))};
  const r=await executeAcceptance(env(),{enabled:true},d);
  assert.equal(r.gate,"BLOCK");assert.equal(r.requests,1);assert.equal(r.admissionFailure.stage,"root_request");
  assert.equal(r.admissionFailure.status,null);assert.equal(r.admissionFailure.category,"transport_unknown");
});
// Test-only ESM hooks substitute offline adapters; run.mjs and the real
// orchestrator/report serializer execute unchanged. No production test switch.
async function cliCase(c, entrypointThrow=false) {
  const dir=await mkdtemp(join(tmpdir(),"c1-admission-artifact-"));
  const orchestrator=new URL("./orchestrator.mjs",import.meta.url).href;
  const admission=new URL("./admission.mjs",import.meta.url).href;
  const policy=new URL("./policy.mjs",import.meta.url).href;
  try {
    const fixture={rootStatus:403,rootType:"text/html",html:sentinel,js,kind:"http",...c};
    await writeFile(join(dir,"fixture.json"),JSON.stringify(fixture));
    const wrapper=`import {executeAcceptance as real} from ${JSON.stringify(orchestrator+"?offline-real")};
      import {readPublicConfig,publicTextReader} from ${JSON.stringify(admission)};
      import {manifest,Budget} from ${JSON.stringify(policy)};
      import {readFileSync} from "node:fs";
      const f=JSON.parse(readFileSync(${JSON.stringify(join(dir,"fixture.json"))},"utf8"));
      const secret=${JSON.stringify(sentinel)};let calls=0;
      const reader=(o,b)=>readPublicConfig(publicTextReader(o,b,async(u,init)=>{
        calls++;if(new URL(u).origin!==manifest.origin||init.redirect!=="error"||init.headers.Authorization||init.headers.Cookie)throw Error(secret);
        if(f.kind==="transport"||f.kind==="redirect")throw new TypeError(secret,{cause:new Error(secret)});
        const root=new URL(u).pathname==="/";
        const body=f.kind==="body"?new ReadableStream({start(c){c.error(Error(secret));}}):f.kind==="utf8"?new Uint8Array([255]):root?f.html:f.js;
        return new Response(body,{status:root?f.rootStatus:200,headers:{"content-type":root?f.rootType:"application/javascript","x-raw":secret}});
      }));
      export async function executeAcceptance(e,c,a,s){
        const isolated={...e};for(const label of ["A","B"])Object.defineProperty(isolated,"C1_ACCOUNT_"+label+"_PASSWORD",{get(){throw Error(secret);}});
        if(${entrypointThrow})return reader("synthetic-oidc",new Budget());
        return real(isolated,c,{preflight:async()=>{},attribution:async()=>({preReceipt:456}),oidc:async()=>"synthetic-oidc",publicConfig:reader},s);
      }`;
    const hook=`import {registerHooks} from "node:module";
      globalThis.fetch=()=>{throw Error("offline network forbidden");};
      registerHooks({load(url,context,next){if(url===${JSON.stringify(orchestrator)})return {format:"module",shortCircuit:true,source:${JSON.stringify(wrapper)}};return next(url,context);}});`;
    await writeFile(join(dir,"hook.mjs"),hook);
    const result=spawnSync(process.execPath,["--import",join(dir,"hook.mjs"),new URL("./run.mjs",import.meta.url).pathname],{
      cwd:dir,encoding:"utf8",timeout:15000,env:{...process.env,...env(),NODE_OPTIONS:"",GITHUB_OUTPUT:join(dir,"needs-output"),C1_ACCOUNT_A_PASSWORD:sentinel,C1_ACCOUNT_B_PASSWORD:sentinel},
    });
    assert.equal(result.status,1);assert.equal(result.stderr,"");
    assert.equal(result.stdout,entrypointThrow?"C1_BLOCK_HOSTED_NOT_RUN\n":"C1_NATIVE_ATTEMPT_BLOCKED\n");
    const bytes=await readFile(join(dir,"artifacts/results.json"),"utf8");
    assert(![result.stdout,result.stderr,bytes].some(x=>x.includes(sentinel)));
    const r=JSON.parse(bytes);assert.equal(r.gate,"BLOCK");assert.deepEqual(r.passed,[]);assert(r.notRun.includes("identity"));
    await assert.rejects(readFile(join(dir,"artifacts/phase.json")));
    await assert.rejects(readFile(join(dir,"needs-output")));
    return r;
  } finally {await rm(dir,{recursive:true,force:true});}
}
for(const [name,c,stage,code] of [
  ["HTTP",{},"root_response","HTTP_STATUS"],
  ["transport",{kind:"transport"},"root_request",null],
  ["redirect rejection",{kind:"redirect"},"root_request",null],
  ["content type",{rootStatus:200,rootType:sentinel},"root_response","CONTENT_TYPE"],
  ["body",{rootStatus:200,kind:"body"},"root_body","BODY_READ"],
  ["UTF-8",{rootStatus:200,kind:"utf8"},"root_body","BODY_UTF8"],
  ["size",{rootStatus:200,html:sentinel+"x".repeat(256*1024)},"root_body","BODY_LIMIT"],
  ["HTML",{rootStatus:200,html:sentinel},"html_discovery","MODULE_COUNT"],
  ["parser",{rootStatus:200,html,js:'const '+sentinel+'="'},"javascript_parse","JS_PARSE"],
  ["config missing",{rootStatus:200,html,js:'const value="'+sentinel+'";'},"public_config_selection","CONFIG_MISSING"],
  ["config ambiguous",{rootStatus:200,html,js:js+js.replace("function config","function second").replace('"required"','"'+sentinel+'"')},"public_config_selection","CONFIG_AMBIGUOUS"],
  ["config invalid",{rootStatus:200,html,js:js.replace('"true"','"'+sentinel+'"')},"public_config_validation","CONFIG_VALUES"],
]) test("real CLI results artifact and logs retain only safe "+name+" evidence",async()=>{
  const r=await cliCase(c);assert.equal(r.admissionFailure.stage,stage);assert.equal(r.admissionFailure.validationCode,code);
  assert.equal(r.passwordSignins,0);assert.equal(r.harness,sha);assert.equal(r.runId,"123");
});
test("entrypoint catch retains trusted admission evidence instead of resetting it",async()=>{
  const r=await cliCase({},true);assert.equal(r.admissionFailure.status,403);assert.equal(r.source,manifest.source);
});
test("obtained Response status survives a header access failure",async()=>{
  const r=response(sentinel,"text/html",403);
  Object.defineProperty(r,"headers",{value:{get(){throw secretError();}}});
  const {result}=await blocked(()=>r);
  assert.deepEqual(result.admissionFailure,{stage:"root_response",category:"http_response",responseReceived:true,status:403,contentType:"unknown",validationCode:"RESPONSE_INVALID"});
});
test("body cleanup failure after successful decoding is not called invalid UTF-8",async()=>{
  const r=response(html);let read=false;
  Object.defineProperty(r,"body",{value:{getReader:()=>({read:async()=>read?{done:true}:(read=true,{done:false,value:new TextEncoder().encode(html)}),cancel:async()=>{},releaseLock(){throw secretError();}})}});
  const {result}=await blocked(()=>r);
  assert.equal(result.admissionFailure.validationCode,"BODY_READ");assert.equal(result.admissionFailure.status,200);
});
