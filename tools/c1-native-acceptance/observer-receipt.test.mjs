import { test } from "node:test";
import assert from "node:assert/strict";
import { manifest } from "./policy.mjs";

const harness = "a".repeat(40);
const target = { ...manifest, origin: "https://life-rhythm-prototype-immutable123-daler-project-lr.vercel.app" };
const env = { GITHUB_RUN_ID: "123", GITHUB_RUN_ATTEMPT: "1", C1_TRUSTED_SHA: harness };
const context = { accountEmail: "dezrobbo1@gmail.com", teamId: manifest.team,
  requestedDeployment: target.deployment };
const deployment = { id: target.deployment, url: new URL(target.origin).hostname,
  project: { id: manifest.project }, readyState: "READY", target: null, source: "git",
  meta: { githubCommitSha: target.source }, environmentVariables: "SYNTHETIC_SECRET" };
test("connector receipt projects only verified exact Preview metadata and actual trust model", async () => {
  const { connectorReceipt } = await import("./observer-receipt.mjs");
  const receipt = connectorReceipt(deployment, context, env, "pre", target);
  assert.equal(receipt.format, 3);
  assert.equal(receipt.observerTrust, "OWNER_AUTHORIZED_EXTERNAL_CONNECTOR");
  assert.equal(receipt.source, target.source);
  assert(!JSON.stringify(receipt).includes("SYNTHETIC_SECRET"));
  for (const patch of [{ id: "wrong" }, { url: "hostile.example" }, { readyState: "ERROR" },
    { target: "production" }, { source: "cli" }, { project: { id: "wrong" } },
    { meta: { githubCommitSha: "b".repeat(40) } }])
    assert.throws(() => connectorReceipt({ ...deployment, ...patch }, context, env, "pre", target));
  for (const patch of [{ accountEmail: "dezrobbo1@icloud.com" }, { teamId: "wrong" },
    { requestedDeployment: "wrong" }])
    assert.throws(() => connectorReceipt(deployment, { ...context, ...patch }, env, "pre", target));
});
test("post connector receipt cannot omit or change successful native job provenance", async () => {
  const { connectorReceipt } = await import("./observer-receipt.mjs");
  assert.throws(() => connectorReceipt(deployment, context, env, "post", target));
});
