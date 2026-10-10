import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { manifest, requestPolicy, guardIdentity } from "./policy.mjs";

test("C1 target pins the corrected immutable Preview and owner executor without enabling acceptance", () => {
  const origin = "https://life-rhythm-prototype-r04nvovwn-daler-project-lr.vercel.app";
  assert.equal(manifest.source, "07469f9f13aa3887a6ec7847b7b642a839651e63");
  assert.equal(manifest.deployment, "dpl_FWvCxvDYgnpUZFeDR6NcgrtWz7kn");
  assert.equal(manifest.origin, origin);
  assert.deepEqual(JSON.parse(readFileSync(new URL("./attribution-config.json", import.meta.url))), {
    enabled: true,
    immutableOriginApproved: true,
    immutableOrigin: origin,
    mode: "external-connector-automation",
    trustedObserverIds: ["228294552"],
    receiptIssue: 179,
  });
  requestPolicy(origin + "/", "GET");
  assert.throws(() => requestPolicy("https://life-rhythm-prototype-7it1u92y9-daler-project-lr.vercel.app/", "GET"));
  assert.throws(() => requestPolicy("https://life-rhythm-prototype.vercel.app/", "GET"));
  assert.throws(() => requestPolicy("https://life-rhythm-prototype-git-feat-gate8a7c-dbab5a-daler-project-lr.vercel.app/", "GET"));
  assert.throws(() => guardIdentity({ enabled: "false" }, "a".repeat(40)));
});
