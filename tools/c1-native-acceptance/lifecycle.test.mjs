import { test } from "node:test";
import assert from "node:assert/strict";
import { EventEmitter } from "node:events";
import { spawn } from "node:child_process";
import { cancellation, jobWindow, abortable } from "./lifecycle.mjs";
import { Budget, manifest } from "./policy.mjs";
test("job preparation consumes absolute budget and leaves cleanup reserve", () => {
  const start = Date.now() - 17 * 60000,
    deadline = start + 19 * 60000;
  assert.throws(() =>
    jobWindow({
      C1_JOB_STARTED_AT: String(start),
      C1_JOB_DEADLINE_MS: String(deadline),
    }),
  );
  const b = new Budget(start, deadline);
  assert.throws(() => b.take());
  b.take({ cleanup: true });
  assert.throws(() => jobWindow({}));
  assert.throws(() =>
    jobWindow({
      C1_JOB_STARTED_AT: String(Date.now()),
      C1_JOB_DEADLINE_MS: String(Date.now() + 20 * 60000),
    }),
  );
});
test("SIGINT/SIGTERM abort pending work; handlers are removed after cleanup", async () => {
  const emitter = new EventEmitter(),
    c = cancellation(emitter);
  const p = abortable(() => new Promise(() => {}), c.signal);
  emitter.emit("SIGTERM");
  await assert.rejects(p);
  c.dispose();
  assert.equal(emitter.listenerCount("SIGTERM"), 0);
  assert.equal(emitter.listenerCount("SIGINT"), 0);
});
test("real SIGTERM after synthetic session drains local cleanup and returns only BLOCK", async () => {
  const sha = "a".repeat(40);
  const source = `
 import {executeAcceptance} from './orchestrator.mjs';import {cancellation} from './lifecycle.mjs';
 const env=${JSON.stringify({ GITHUB_REPOSITORY: manifest.repository, GITHUB_REPOSITORY_ID: manifest.repositoryId, GITHUB_REPOSITORY_OWNER_ID: manifest.ownerId, GITHUB_EVENT_NAME: "workflow_dispatch", GITHUB_REF: "refs/heads/main", GITHUB_WORKFLOW_REF: manifest.workflowRef, GITHUB_WORKFLOW_SHA: sha, C1_HARNESS_SHA: sha, RUNNER_ENVIRONMENT: "github-hosted", C1_ENABLED: "true", C1_TRUSTED_SHA: sha, C1_ACCOUNT_A_PASSWORD: "synthetic-A", C1_ACCOUNT_B_PASSWORD: "synthetic-B" })};
 env.C1_JOB_STARTED_AT=String(Date.now());env.C1_JOB_DEADLINE_MS=String(Date.now()+19*60000);
 env.C1_PROTECTION_MODE='trusted-source';
 const c=cancellation();let revoked=0;
 const adapters={preflight:async()=>{},attribution:async()=>{},oidc:async()=>'synthetic-oidc',publicConfig:async()=>({publishableKey:'sb_publishable_synthetic'}),key:async()=>({}),denial:async()=>{},transport:()=>()=>{},login:async(t,a,p,k,pk,track)=>{const s={access_token:'synthetic'};track(s);return s;},metadata:()=>{process.send('session-held');return new Promise(()=>{});},logout:async()=>{revoked++;}};
 const result=await executeAcceptance(env,{enabled:true},adapters,c.signal);c.dispose();process.send({revoked,result});process.disconnect();`;
  const child = spawn(process.execPath, ["--input-type=module", "-e", source], {
    cwd: new URL(".", import.meta.url),
    stdio: ["ignore", "pipe", "pipe", "ipc"],
  });
  let output = "";
  child.stdout.on("data", (b) => (output += b));
  child.stderr.on("data", (b) => (output += b));
  const result = await new Promise((resolve, reject) => {
    const timer = setTimeout(() => {
      child.kill("SIGKILL");
      reject(Error("timeout"));
    }, 5000);
    child.on("message", (m) => {
      if (m === "session-held") child.kill("SIGTERM");
      else {
        clearTimeout(timer);
        resolve(m);
      }
    });
    child.on("error", reject);
  });
  assert.equal(result.revoked, 1);
  assert.equal(result.result.gate, "BLOCK");
  assert.equal(result.result.hosted, "ATTEMPTED_BLOCKED");
  assert.deepEqual(result.result.passed, []);
  assert.equal(output, "");
});
