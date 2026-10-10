import { test } from "node:test";
import assert from "node:assert/strict";
import { generateKeyPair, exportJWK, SignJWT } from "jose";
import { manifest, requestPolicy, scopedHeaders, authBody, report, rows, Budget } from "./policy.mjs";
const c = await import("./coverage.mjs").catch(() => ({}));
const issuer = manifest.provider + "/auth/v1", account = manifest.accounts[0];
const headers = { apikey: "sb_publishable_synthetic", Authorization: "Bearer synthetic" };
for (const method of ["POST", "PATCH", "DELETE"]) test(method + " negative write is exact-table, exact-identity and expected-denial only", async () => {
  assert.equal(typeof c.writeCases, "function");
  const cases = c.writeCases(account).filter(x => x.method === method);
  assert.equal(cases.length, 2);
  for (const x of cases) {
    requestPolicy(x.url, x.method); authBody(x.url, x.body, { method: x.method });
    const u = new URL(x.url);
    assert.equal(u.origin, manifest.provider); assert.equal(u.searchParams.get("subject"), "eq." + account.uuid);
    const safe = scopedHeaders(x.url, "synthetic-admission", headers);
    assert.equal(safe["x-vercel-protection-bypass"], undefined);
    assert.equal(safe["Content-Profile"], "life_rhythm");
  }
  const calls = [];
  const tx = async (url, init) => { if(!init.method)return{response:{status:200},body:[{synthetic:true}]}; calls.push({url, method:init.method}); return {response:{status:403}, body:{code:"42501"}}; };
  await c.runDeniedWrites(tx, account, "synthetic", "sb_publishable_synthetic");
  assert.equal(calls.length, 6);
  await assert.rejects(c.runDeniedWrites(async()=>({response:{status:201},body:[]}),account,"synthetic","sb_publishable_synthetic"));
});
test("write URL/body cannot broaden origin, table, owner or mutation payload", () => {
  assert.equal(typeof c.writeCases, "function");
  const x = c.writeCases(account)[0];
  for(const url of [x.url.replace(manifest.provider,"https://other.invalid"),x.url.replace("trial_access","other"),x.url.replace(account.uuid,"aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa"), x.url+"&limit=1"])
    assert.throws(()=>requestPolicy(url,x.method));
  for(const body of [JSON.stringify({...JSON.parse(x.body),subject:manifest.accounts[1].uuid}),JSON.stringify({...JSON.parse(x.body),admin:true}),JSON.stringify([JSON.parse(x.body)])])
    assert.throws(()=>authBody(x.url,body,{method:x.method}));
});
test("write denial rejects uniqueness errors, authentication errors and any success", async () => {
  assert.equal(typeof c.runDeniedWrites,"function");
  for(const result of [{response:{status:409},body:{code:"23505"}},{response:{status:401},body:{code:"42501"}},{response:{status:403},body:{code:"different"}},{response:{status:204},body:null}])
    await assert.rejects(c.runDeniedWrites(async()=>result,account,"synthetic","sb_publishable_synthetic"));
});
async function signedFixture() {
  const {privateKey,publicKey} = await generateKeyPair("ES256");
  const jwk={...await exportJWK(publicKey),kid:"ephemeral-offline-test",alg:"ES256"};
  const now=Math.floor(Date.now()/1000);
  const token=await new SignJWT({role:"authenticated",session_id:"33333333-3333-4333-8333-333333333333",is_anonymous:false,aal:"aal1"})
    .setProtectedHeader({alg:"ES256",typ:"JWT",kid:jwk.kid}).setIssuer(issuer).setAudience("authenticated").setSubject(account.uuid).setIssuedAt(now).setExpirationTime(now+300).sign(privateKey);
  return {token,jwks:{keys:[jwk]},account,publishableKey:"sb_publishable_synthetic"};
}
test("exact application source distinguishes genuine signed expiry from signature forgery", async () => {
  assert.equal(typeof c.runSourceFixtures,"function");
  const input=await signedFixture();
  const result=await c.runSourceFixtures(input);
  assert.deepEqual(result,["expired-valid-token","provider-503"]);
  const parts=input.token.split("."); parts[2]=(parts[2][0]==="A"?"B":"A")+parts[2].slice(1);
  await assert.rejects(c.runSourceFixtures({...input,token:parts.join(".")}));
});
test("source fixture provider503 is activated only after genuine session verification", async () => {
  assert.equal(typeof c.runSourceFixtures,"function");
  const input=await signedFixture();
  assert.deepEqual(await c.runSourceFixtures(input),["expired-valid-token","provider-503"]);
  await assert.rejects(c.runSourceFixtures({...input,token:"invalid"}));
});
function fixtureAdapters(failAt) {
  const calls=[];
  const held=new Map(manifest.accounts.map(a=>[a.label,{session:{access_token:"synthetic-"+a.label}}]));
  const wait=async stage=>{calls.push(stage);return{receipt:stage==="fixture-restored"?789:456,baselineDigest:"a".repeat(64)}};
  const tx=async()=>({response:{status:200},body:[]});
  const probe=async stage=>{if(stage===failAt)throw Error("UNIQUE_SECRET_DO_NOT_LOG");calls.push("probe-"+stage);};
  return {calls,held,wait,tx,probe};
}
for(const stage of ["fixture-protocol","fixture-schema","fixture-disabled","fixture-uninvited"]) test(stage+" is exercised through staged operator mutation and finally restoration",async()=>{
  assert.equal(typeof c.runAccountFixtures,"function");
  const a=fixtureAdapters();const r=await c.runAccountFixtures(a);
  assert(a.calls.includes("probe-"+stage));assert.equal(a.calls.at(-1),"fixture-restored");assert.equal(r.fixtureRestoredReceipt,789);
});
test("fixture restoration runs on failure and a failed restore blocks",async()=>{
  assert.equal(typeof c.runAccountFixtures,"function");
  const a=fixtureAdapters("fixture-disabled");await assert.rejects(c.runAccountFixtures(a));assert.equal(a.calls.at(-1),"fixture-restored");
  const b=fixtureAdapters();b.wait=async stage=>{if(stage==="fixture-restored")throw Error("restore-failed");return{receipt:456,baselineDigest:"a".repeat(64)}};
  await assert.rejects(c.runAccountFixtures(b));
});
test("implemented capabilities leave no fixturesNotRun while absent rows cannot finalize",()=>{
  for(const row of ["expired-valid-token","provider-503","stored-incompatible-head","disabled","uninvited","issued-session-disabled","write-insert","write-update","write-delete","fixture-restoration","invalid-token","forged-token"])
    assert(rows.includes(row));
  assert.deepEqual(report().fixturesNotRun,[]);assert.equal(report().gate,"BLOCK");assert.equal(report().notRun.length,rows.length);
});
test("fixture evidence has only digest/receipt attribution, never privileged credentials",()=>{
  assert.equal(typeof c.fixtureEvidence,"function");
  const secret="UNIQUE_ADMIN_SECRET";
  const output=c.fixtureEvidence({baselineDigest:"a".repeat(64),baselineReceipt:456,fixtureRestoredReceipt:789,adminSecret:secret});
  assert(!JSON.stringify(output).includes(secret));assert.deepEqual(Object.keys(output),["baselineDigest","baselineReceipt","fixtureRestoredReceipt"]);
  assert.throws(()=>c.fixtureEvidence({...output,fixtureRestoredReceipt:undefined}));
});
test("negative writes snapshot each synthetic table before and after and reject drift",async()=>{
  assert.equal(typeof c.snapshotMetadata,"function");
  const calls=[];let reads=0;
  const tx=async(url,init)=>{calls.push(init?.method??"GET");if(init?.method)return{response:{status:403},body:{code:"42501"}};reads++;return{response:{status:200},body:new URL(url).pathname.endsWith("trial_access")?[{enabled:true}]:[{revision:reads>2?"changed":"original"}]};};
  await assert.rejects(c.runDeniedWrites(tx,account,"synthetic","sb_publishable_synthetic"));
  assert.deepEqual(calls,["GET","GET","POST","PATCH","DELETE","POST","PATCH","DELETE","GET","GET"]);
});
test("hosted negative origin probe stays on exact Preview and cannot alter provider origin",async()=>{
  const {makeTransport}=await import("./native.mjs");let calls=0;
  const tx=makeTransport("synthetic-oidc",new Budget(),async(url,init)=>{calls++;assert.equal(new URL(url).origin,manifest.origin);assert.equal(init.headers.Origin,"https://c1-origin-negative.invalid");return Response.json({kind:"error"},{status:403});});
  await tx(manifest.origin+"/api/account/boundary?protocolVersion=1&schemaVersion=1",{originProbe:true});
  assert.equal(calls,1);
  await assert.rejects(tx(manifest.provider+"/auth/v1/user",{originProbe:true}));assert.equal(calls,1);
});
test("provider administration and transport secrets never enter isolated source fixture environment/output",async()=>{
  const input=await signedFixture(),secret="UNIQUE_PARENT_ADMIN_AND_BYPASS_SECRET";
  process.env.C1_AUTOMATION_BYPASS_SECRET=secret;process.env.SUPABASE_SERVICE_ROLE_KEY=secret;
  try {const r=await c.runSourceFixtures({...input,adminSecret:secret});assert(!JSON.stringify(r).includes(secret));assert.deepEqual(r,["expired-valid-token","provider-503"]);}
  finally {delete process.env.C1_AUTOMATION_BYPASS_SECRET;delete process.env.SUPABASE_SERVICE_ROLE_KEY;}
});
