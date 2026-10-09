import { cancellation, jobWindow } from "./lifecycle.mjs";
import { mkdir, writeFile, readFile } from "node:fs/promises";
import { guardIdentity, identityFromEnv, report, check } from "./policy.mjs";
import {
  verifySupervision,
  postVerification,
  digest,
  phaseResult,
  supervisionConfig,
} from "./supervision.mjs";
import { githubGet, preflight } from "./preflight.mjs";
import { executeAcceptance } from "./orchestrator.mjs";
const lifecycle = cancellation();
let result = report(),
  success = false;
try {
  const config = JSON.parse(
    await readFile(
      new URL("./attribution-config.json", import.meta.url),
      "utf8",
    ),
  );
  if (process.argv.includes("--post")) {
    supervisionConfig(config);
    await preflight(githubGet, identityFromEnv(), process.env.C1_TRUSTED_SHA);
    result = await postVerification(process.env, config);
    check(!lifecycle.signal.aborted);
    success = true;
  } else if (process.argv.includes("--admission")) {
    jobWindow(process.env);
    check(!lifecycle.signal.aborted);
    guardIdentity(identityFromEnv(), process.env.C1_TRUSTED_SHA);
    await verifySupervision(process.env, config, "pre");
    check(!lifecycle.signal.aborted);
    success = true;
  } else {
    result = await executeAcceptance(process.env, config, {}, lifecycle.signal);
    success = result.hosted === "TEST_PHASE_COMPLETE_PENDING_POST";
    if (success) {
      // Fixed reviewed native job selects its own GitHub job ID, no caller input.
      const jobs = await githubGet(
        "/repos/" +
          process.env.GITHUB_REPOSITORY +
          "/actions/runs/" +
          process.env.GITHUB_RUN_ID +
          "/attempts/1/jobs?per_page=100",
      );
      const native = jobs.jobs.filter(
        (j) =>
          j.name === "C1 native test phase" &&
          j.run_id === Number(process.env.GITHUB_RUN_ID) &&
          j.run_attempt === 1 &&
          j.head_sha === process.env.C1_TRUSTED_SHA,
      );
      check(
        jobs.total_count < 100 &&
          native.length === 1 &&
          Number.isSafeInteger(native[0].id),
      );
      const phase = JSON.stringify(phaseResult(result));
      check(Buffer.byteLength(phase) < 16384 && process.env.GITHUB_OUTPUT);
      await mkdir("artifacts", { recursive: true });
      await writeFile("artifacts/phase.json", phase, { mode: 0o600 });
      await writeFile(
        process.env.GITHUB_OUTPUT,
        "phase_result_b64=" +
          Buffer.from(phase).toString("base64") +
          "\nphase_digest=" +
          digest(phase) +
          "\nnative_job_id=" +
          native[0].id +
          "\n",
        { flag: "a" },
      );
    }
  }
} catch {
  success = false;
  result = report();
}
if (!process.argv.includes("--admission") || !success) {
  await mkdir("artifacts", { recursive: true });
  const json = JSON.stringify(result, null, 2) + "\n";
  check(Buffer.byteLength(json) + 16384 < 10 * 1024 * 1024);
  await writeFile("artifacts/results.json", json, { mode: 0o600 });
}
console.log(
  success
    ? process.argv.includes("--admission")
      ? "C1_ADMISSION_OK"
      : process.argv.includes("--post")
        ? "C1_SUPERVISED_COMPLETE_GATE_BLOCK"
        : "C1_TEST_PHASE_PENDING_POST_GATE_BLOCK"
    : result.hosted === "NOT_RUN"
      ? "C1_BLOCK_HOSTED_NOT_RUN"
      : "C1_NATIVE_ATTEMPT_BLOCKED",
);
process.exitCode = success ? 0 : 1;

lifecycle.dispose();
