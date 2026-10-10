import { spawn } from "node:child_process";
import { fileURLToPath } from "node:url";
import { manifest,check,boundary,fixtureEvidence,providerSelect } from "./policy.mjs";
export { fixtureEvidence } from "./policy.mjs";
import { verifySourceFiles } from "./prepare-source-fixture.mjs";
import { waitForObservation } from "./supervision.mjs";
export const coverageRows=["invalid-token","forged-token","expired-valid-token","provider-503","stored-incompatible-head","disabled","uninvited","issued-session-disabled","write-insert","write-update","write-delete","fixture-restoration","origin-denial"];
export function writeCases(account) {
  check(manifest.accounts.some(a=>a.uuid===account.uuid));
  return ["trial_access","account_heads"].flatMap(table=>["POST","PATCH","DELETE"].map(method=>{
    const payload=table==="trial_access"?{enabled:false}:{revision:"0",generation:"33333333-3333-4333-8333-333333333333"};
    if(method==="POST")Object.assign(payload,{issuer:manifest.provider+"/auth/v1",subject:account.uuid,...(table==="account_heads"?{protocol_version:1,canonical_schema_version:1}:{})});
    return{url:manifest.provider+"/rest/v1/"+table+"?issuer="+encodeURIComponent("eq."+manifest.provider+"/auth/v1")+"&subject=eq."+account.uuid,method,...(method!=="DELETE"?{body:JSON.stringify(payload)}:{})};
  }));
}
export async function snapshotMetadata(tx,account,token,publishableKey) {
  const result=[];
  for(const table of ["trial_access","account_heads"]) {
    const url=manifest.provider+"/rest/v1/"+table+"?select="+encodeURIComponent(providerSelect[table])+"&issuer="+encodeURIComponent("eq."+manifest.provider+"/auth/v1")+(table==="trial_access"?"&enabled=eq.true":"")+"&subject=eq."+account.uuid;
    const x=await tx(url,{headers:{apikey:publishableKey,Authorization:"Bearer "+token}});
    check(x.response.status===200 && Array.isArray(x.body) && x.body.length===1);result.push(x.body);
  }
  return JSON.stringify(result);
}
export async function runDeniedWrites(tx,account,token,publishableKey) {
  check(/^sb_publishable_[A-Za-z0-9_-]+$/.test(publishableKey));
  const before=await snapshotMetadata(tx,account,token,publishableKey);
  for(const c of writeCases(account)) {
    const r=await tx(c.url,{method:c.method,body:c.body,headers:{apikey:publishableKey,Authorization:"Bearer "+token}});
    check(r.response.status===403 && r.body?.code==="42501");
  }
  check(await snapshotMetadata(tx,account,token,publishableKey)===before);
  return ["write-insert","write-update","write-delete"];
}
export async function runSourceFixtures(input,signal) {
  await verifySourceFiles();check(!signal?.aborted);
  const text=JSON.stringify({token:input.token,jwks:input.jwks,account:input.account,publishableKey:input.publishableKey});
  check(Buffer.byteLength(text)<=32768);
  return new Promise((resolve,reject)=>{
    const child=spawn(process.execPath,[fileURLToPath(new URL("./source-fixture-child.mjs",import.meta.url))],{env:{},stdio:["pipe","pipe","pipe"]});
    let output="",errors="";
    const block=()=>{child.kill("SIGKILL");reject(Error("C1_GUARD_BLOCK"));};
    const timer=setTimeout(block,10000);signal?.addEventListener("abort",block,{once:true});
    child.stdout.on("data",b=>{output+=b; if(Buffer.byteLength(output)>4096)block();});
    child.stderr.on("data",b=>{errors+=b;if(Buffer.byteLength(errors)>4096)block();});
    child.on("error",block);
    child.on("close",code=>{clearTimeout(timer);signal?.removeEventListener("abort",block);try{check(code===0 && errors==="" && output==='{"ok":true,"rows":["expired-valid-token","provider-503"]}');resolve(["expired-valid-token","provider-503"]);}catch{reject(Error("C1_GUARD_BLOCK"));}});
    child.stdin.on("error",()=>{});child.stdin.end(text);
  });
}
export async function runAccountFixtures({wait,probe,baselineProbe=async()=>{}}) {
  let baseline;
  try {
    baseline=await wait("fixture-baseline");
    await baselineProbe();
    for(const stage of ["fixture-protocol","fixture-schema","fixture-disabled","fixture-uninvited"]) {
      await wait(stage,baseline.baselineDigest);await probe(stage);
    }
  } finally {
    const restored=await wait("fixture-restored",baseline?.baselineDigest);
    if(baseline) baseline={...baseline,fixtureRestoredReceipt:restored.receipt};
  }
  return fixtureEvidence({...baseline,baselineReceipt:baseline.receipt});
}
export async function completeCoverage({tx,closingTx,sessions,publishableKey,env,config,signal,work}) {
  const account=manifest.accounts[0],token=sessions.get("A").session.access_token;
  const endpoint=manifest.origin+"/api/account/boundary?protocolVersion=1&schemaVersion=1";
  const foreign=await work(()=>tx(endpoint,{originProbe:true,headers:{Authorization:"Bearer "+token}}));boundary(foreign.response,foreign.body,403);
  const parts=token.split(".");check(parts.length===3);const forged=parts[0]+"."+parts[1]+"."+(parts[2][0]==="A"?"B":"A")+parts[2].slice(1);
  for(const value of ["invalid",forged]) {const r=await work(()=>tx(endpoint,{headers:{Authorization:"Bearer "+value}}));boundary(r.response,r.body,401);}
  const {body:jwks}=await work(()=>tx(manifest.provider+"/auth/v1/.well-known/jwks.json"));
  await work(()=>runSourceFixtures({token,jwks,account,publishableKey},signal));
  const wait=async(stage,baselineDigest)=>{
    // Fixed safe stage names are the sole live coordination signal; never emit inputs.
    console.log("C1_FIXTURE_WAIT_"+stage.toUpperCase().replaceAll("-","_"));
    const requestedAt=Date.now();const r=await waitForObservation(env,config,stage,undefined,manifest,{baselineDigest,requestedAt});
    return{receipt:r.receipt,baselineDigest:r.baselineDigest};
  };
  const probe=async(stage)=>{
    const who=manifest.accounts[stage==="fixture-uninvited"?1:0],held=sessions.get(who.label).session.access_token;
    const r=await work(()=>tx(endpoint,{headers:{Authorization:"Bearer "+held}}));boundary(r.response,r.body,stage==="fixture-protocol"||stage==="fixture-schema"?426:403);
    if(stage==="fixture-disabled"||stage==="fixture-uninvited") for(const table of ["trial_access","account_heads"]) {
      const u=manifest.provider+"/rest/v1/"+table+"?select="+encodeURIComponent(providerSelect[table])+"&issuer="+encodeURIComponent("eq."+manifest.provider+"/auth/v1")+(table==="trial_access"?"&enabled=eq.true":"")+"&subject=eq."+who.uuid;
      const x=await work(()=>tx(u,{headers:{apikey:publishableKey,Authorization:"Bearer "+held}}));check(x.response.status===200 && Array.isArray(x.body)&&x.body.length===0);
    }
  };
  const fixtures=await runAccountFixtures({wait,probe,baselineProbe:async()=>{
    for(const a of manifest.accounts) await work(()=>runDeniedWrites(tx,a,sessions.get(a.label).session.access_token,publishableKey));
  }});
  return{rows:[...coverageRows],fixtures};
}
