import { test } from "node:test";
import assert from "node:assert/strict";
import { readFile, mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { spawnSync } from "node:child_process";
test("workflow is manually dispatched, default-main guarded, isolated and contains no secret bindings", async () => {
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
    /pull_request_target:|pull_request:|push:|schedule:|secrets\./,
  );
  assert.match(workflow, /github\.ref == 'refs\/heads\/main'/);
  assert.match(
    workflow,
    /github\.workflow_sha == vars\.C1_TRUSTED_HARNESS_SHA/,
  );
  assert.equal([...workflow.matchAll(/persist-credentials: false/g)].length, 2);
  for (const match of workflow.matchAll(/^\s+- uses: ([^\s]+)/gm))
    assert.match(match[1], /@[a-f0-9]{40}$/);
  assert.equal([...workflow.matchAll(/id-token: write/g)].length, 1);
  assert.match(workflow, /cancel-in-progress: false/);
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
