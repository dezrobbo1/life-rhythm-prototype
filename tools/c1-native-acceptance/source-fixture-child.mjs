import { createLocalJWKSet, jwtVerify } from "jose";
import { manifest, check } from "./policy.mjs";
// A separate native Node process with an EMPTY environment. No passwords, bypass,
// GitHub token or provider-admin capability enter this source-runtime fixture.
console.log = console.error = console.warn = console.debug = () => { throw Error("C1_FIXTURE_LOG_BLOCK"); };
let input="";
try {
  check(Object.keys(process.env).length===0);
  for await (const chunk of process.stdin) { input+=chunk;check(Buffer.byteLength(input)<=32768); }
  const {token,jwks,account,publishableKey}=JSON.parse(input);input="";
  check(manifest.accounts.some(a=>a.uuid===account.uuid && a.revision===account.revision));
  check(/^sb_publishable_[A-Za-z0-9_-]+$/.test(publishableKey));
  const {payload}=await jwtVerify(token,createLocalJWKSet(jwks),{issuer:manifest.provider+"/auth/v1",audience:"authenticated",algorithms:["ES256","RS256"],clockTolerance:0});
  check(payload.sub===account.uuid && Number.isInteger(payload.exp));
  const {handleBoundary}=await import("../../c1-app-under-test/app/.c1-compiled/server/account/boundary.js");
  const config={issuer:manifest.provider+"/auth/v1",origins:[manifest.origin],jwks,supabaseUrl:manifest.provider,publishableKey,buildId:manifest.source};
  let calls=0,mode="ready";
  globalThis.fetch=()=>{throw Error("C1_FIXTURE_NETWORK_BLOCK");};
  const provider=async(input,init)=>{
    calls++; const u=new URL(typeof input==="string"?input:input.url);
    check(u.origin===manifest.provider && u.pathname==="/rest/v1/trial_access");
    const h=new Headers(init.headers);check(h.get("authorization")==="Bearer "+token && h.get("apikey")===publishableKey);
    check(!h.has("x-vercel-protection-bypass") && !h.has("cookie"));
    return Response.json(mode==="failure"?{code:"fixture-provider-unavailable"}:[{enabled:true,account_heads:{protocol_version:1,canonical_schema_version:1,revision:account.revision,generation:"11111111-1111-4111-8111-111111111111",updated_at:"2026-10-01T00:00:00.000Z"}}],{status:mode==="failure"?503:200});
  };
  const request=()=>new Request(manifest.origin+"/api/account/boundary?protocolVersion=1&schemaVersion=1",{headers:{Origin:manifest.origin,Authorization:"Bearer "+token}});
  const assertResponse=async(response,status,category)=>{
    check(response.status===status && response.headers.get("cache-control")==="private, no-store" && response.headers.get("content-type").includes("application/json"));
    const body=await response.json();check(status===200?body.kind==="ready":body.kind==="error" && body.category===category);
  };
  await assertResponse(await handleBoundary(request(),{config:()=>config,fetch:provider}),200);check(calls===1);
  const RealDate=Date;
  try {
    globalThis.Date=class extends RealDate { constructor(...args){super(...(args.length?args:[(payload.exp+1)*1000]));} static now(){return(payload.exp+1)*1000;} };
    calls=0;
    await assertResponse(await handleBoundary(request(),{config:()=>config,fetch:provider}),401,"unauthorized");check(calls===0);
  } finally { globalThis.Date=RealDate; }
  mode="failure";calls=0;
  await assertResponse(await handleBoundary(request(),{config:()=>config,fetch:provider}),503,"unavailable");check(calls===1);
  process.stdout.write('{"ok":true,"rows":["expired-valid-token","provider-503"]}');
} catch { process.stdout.write('{"ok":false}');process.exitCode=1; }
