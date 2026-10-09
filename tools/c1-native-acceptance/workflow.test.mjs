import { test } from "node:test";
import assert from "node:assert/strict";
import { readFile, mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { spawnSync } from "node:child_process";
test("workflow is manually dispatched, default-main guarded, isolated with passwords only after admission", async () => {
  const workflow = (
    await readFile(
      new URL(
        "../../.github/workflows/c1-native-acceptance.yml",
        import.meta.url,
      ),
      "utf8",
    )
  )
    .split("\n")
    .filter((line) => !line.trim().startsWith("#"))
    .join("\n");
  assert.match(workflow, /workflow_dispatch:/);
  assert.doesNotMatch(
    workflow,
    /pull_request_target:|pull_request:|push:|schedule:/,
  );
  assert.match(workflow, /github\.ref == 'refs\/heads\/main'/);
  assert.match(
    workflow,
    /github\.workflow_sha == vars\.C1_TRUSTED_HARNESS_SHA/,
  );
  assert.equal([...workflow.matchAll(/persist-credentials: false/g)].length, 3);
  for (const match of workflow.matchAll(/^\s+- uses: ([^\s]+)/gm))
    assert.match(match[1], /@[a-f0-9]{40}$/);
  assert.equal([...workflow.matchAll(/id-token: write/g)].length, 1);
  assert.match(workflow, /cancel-in-progress: false/);
  assert(workflow.indexOf("npm ci") < workflow.indexOf("secrets.C1_ACCOUNT"));
  assert(
    workflow.indexOf("run.mjs --admission") <
      workflow.indexOf("secrets.C1_ACCOUNT"),
  );
  assert.equal([...workflow.matchAll(/secrets\./g)].length, 2);
  assert.doesNotMatch(workflow, /issues: write|pull-requests: write|contents: write|actions: write/);
  assert.match(workflow, /name: C1 external pre admission/);
  assert.match(workflow, /run\.mjs --pre/);
  assert.equal([...workflow.matchAll(/C1_PRE_JOB_ID: \$\{\{ needs.preflight.outputs.pre_job_id \}\}/g)].length, 2);
  const post = workflow.slice(workflow.indexOf("  post-verification:"));
  assert.match(post, /environment: c1-native-post-verification/);
  assert.doesNotMatch(post, /id-token: write|secrets\.|ACTION.*TOKEN/);
  assert.match(post, /needs.native.outputs.phase_digest/);
  const native = workflow.slice(workflow.indexOf("  native:"));
  assert(
    native.indexOf("C1_JOB_STARTED_AT=") < native.indexOf("actions/checkout@"),
  );
  assert.match(native, /started \+ 19 \* 60 \* 1000/);
  assert.doesNotMatch(
    workflow,
    /app\/|test:data-api|vercel curl|env pull|continue-on-error/,
  );
});
test("inert entrypoint logs and artifact never emit injected credentials or raw exception", async () => {
  const dir = await mkdtemp(join(tmpdir(), "c1-leak-"));
  try {
    const secret = "UNIQUE_SYNTHETIC_SECRET_123";
    const result = spawnSync(
      process.execPath,
      [new URL("./run.mjs", import.meta.url).pathname],
      {
        cwd: dir,
        encoding: "utf8",
        env: {
          ...process.env,
          C1_ACCOUNT_A_PASSWORD: secret,
          C1_ACCOUNT_B_PASSWORD: secret,
          GITHUB_TOKEN: secret,
          C1_ENABLED: secret,
        },
      },
    );
    assert.equal(result.status, 1);
    assert.equal(result.stdout, "C1_BLOCK_HOSTED_NOT_RUN\n");
    assert.equal(result.stderr, "");
    const output = await readFile(join(dir, "artifacts/results.json"), "utf8");
    assert(!output.includes(secret));
    assert(Buffer.byteLength(output) < 10 * 1024 * 1024);
    assert.equal(JSON.parse(output).hosted, "NOT_RUN");
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
});
test("disabled repository dispatch blocks all real CLI paths without any network or password disclosure even with armed supervision", async () => {
  const dir = await mkdtemp(join(tmpdir(), "c1-default-block-"));
  try {
    const { manifest } = await import("./policy.mjs");
    const sha = "a".repeat(40),
      secret = "UNIQUE_SYNTHETIC_GATE_SECRET";
    const { writeFile } = await import("node:fs/promises");
    const hook = join(dir, "hook.mjs"),
      flag = join(dir, "network-called");
    await writeFile(
      hook,
      'import {writeFileSync} from "node:fs";globalThis.fetch=()=>{writeFileSync(' +
        JSON.stringify(flag) +
        ',"called");throw Error("unexpected network");};',
    );
    const env = {
      ...process.env,
      NODE_OPTIONS: "--import " + hook,
      C1_JOB_STARTED_AT: String(Date.now()),
      C1_JOB_DEADLINE_MS: String(Date.now() + 19 * 60 * 1000),
      GITHUB_REPOSITORY: manifest.repository,
      GITHUB_REPOSITORY_ID: manifest.repositoryId,
      GITHUB_REPOSITORY_OWNER_ID: manifest.ownerId,
      GITHUB_EVENT_NAME: "workflow_dispatch",
      GITHUB_REF: "refs/heads/main",
      GITHUB_WORKFLOW_REF: manifest.workflowRef,
      GITHUB_WORKFLOW_SHA: sha,
      C1_HARNESS_SHA: sha,
      RUNNER_ENVIRONMENT: "github-hosted",
      C1_ENABLED: "false",
      C1_TRUSTED_SHA: sha,
      C1_ACCOUNT_A_PASSWORD: secret,
      C1_ACCOUNT_B_PASSWORD: secret,
      GITHUB_TOKEN: secret,
    };
    for (const args of [[], ["--pre"], ["--admission"], ["--post"]]) {
      const result = spawnSync(
        process.execPath,
        [new URL("./run.mjs", import.meta.url).pathname, ...args],
        { cwd: dir, encoding: "utf8", env },
      );
      assert.equal(result.status, 1);
      assert.equal(result.stderr, "");
      assert.equal(result.stdout, "C1_BLOCK_HOSTED_NOT_RUN\n");
      assert(
        !(await readFile(join(dir, "artifacts/results.json"), "utf8")).includes(
          secret,
        ),
      );
    }
    await assert.rejects(readFile(flag));
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
});
