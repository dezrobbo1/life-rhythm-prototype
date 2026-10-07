import { test } from "node:test";
import assert from "node:assert/strict";
import { preflight } from "./preflight.mjs";
import { manifest } from "./policy.mjs";
const sha = "a".repeat(40),
  root = "/repos/" + manifest.repository;
const identity = {
  repository: manifest.repository,
  repositoryId: manifest.repositoryId,
  ownerId: manifest.ownerId,
  event: "workflow_dispatch",
  ref: "refs/heads/main",
  workflowRef: manifest.workflowRef,
  workflowSha: sha,
  harnessSha: sha,
  runner: "github-hosted",
  enabled: "true",
};
function fixtures() {
  return {
    [root]: {
      id: 1268056225,
      owner: { id: 228294552 },
      default_branch: "main",
    },
    [root + "/branches/main"]: { commit: { sha } },
    [root + "/pulls/180"]: {
      state: "open",
      draft: true,
      merged: false,
      base: { ref: "main", repo: { full_name: manifest.repository } },
      head: { sha: manifest.source, repo: { full_name: manifest.repository } },
      user: { login: "author" },
    },
    [root + "/pulls/180/reviews?per_page=100"]: [
      {
        state: "APPROVED",
        commit_id: manifest.source,
        user: { login: "reviewer" },
      },
    ],
    [root + "/commits/" + manifest.source + "/check-runs?per_page=100"]: {
      total_count: 1,
      check_runs: [
        {
          head_sha: manifest.source,
          status: "completed",
          conclusion: "success",
        },
      ],
    },
    [root + "/commits/" + manifest.source + "/status"]: {
      sha: manifest.source,
      state: "success",
      total_count: 1,
      statuses: [{ state: "success" }],
    },
  };
}
test("preflight validates current immutable main, PR, independent exact-head review and checks", async () => {
  const f = fixtures();
  assert.equal(await preflight(async (p) => f[p], identity, sha), "preflight");
  for (const path of Object.keys(f)) {
    const bad = fixtures();
    bad[path] = {};
    await assert.rejects(preflight(async (p) => bad[p], identity, sha));
  }
});
test("source drift, fork, author approval, stale review and failures cannot pass", async () => {
  for (const edit of [
    (f) => (f[root + "/pulls/180"].head.sha = sha),
    (f) => (f[root + "/pulls/180"].head.repo.full_name = "evil/fork"),
    (f) =>
      (f[root + "/pulls/180/reviews?per_page=100"][0].user.login = "author"),
    (f) => (f[root + "/pulls/180/reviews?per_page=100"][0].commit_id = sha),
    (f) =>
      (f[
        root + "/commits/" + manifest.source + "/check-runs?per_page=100"
      ].check_runs[0].conclusion = "failure"),
    (f) => (f[root + "/branches/main"].commit.sha = manifest.source),
  ]) {
    const f = fixtures();
    edit(f);
    await assert.rejects(preflight(async (p) => f[p], identity, sha));
  }
});
