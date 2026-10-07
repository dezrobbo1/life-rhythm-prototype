import { mkdir, writeFile, readFile } from "node:fs/promises";
import { guardIdentity, identityFromEnv, report, check } from "./policy.mjs";
import { verifyAttribution } from "./admission.mjs";
import { executeAcceptance } from "./orchestrator.mjs";
let result = report(),
  success = false;
try {
  const config = JSON.parse(
    await readFile(
      new URL("./attribution-config.json", import.meta.url),
      "utf8",
    ),
  );
  if (process.argv.includes("--admission")) {
    guardIdentity(identityFromEnv(), process.env.C1_TRUSTED_SHA);
    await verifyAttribution(config, "start");
    success = true;
  } else {
    result = await executeAcceptance(process.env, config);
    success = result.hosted === "SCOPED_ROWS_COMPLETE";
  }
} catch {
  result = report();
}
if (!process.argv.includes("--admission") || !success) {
  await mkdir("artifacts", { recursive: true });
  const json = JSON.stringify(result, null, 2) + "\n";
  check(Buffer.byteLength(json) < 10 * 1024 * 1024);
  await writeFile("artifacts/results.json", json, { mode: 0o600 });
}
console.log(
  success
    ? process.argv.includes("--admission")
      ? "C1_ADMISSION_OK"
      : "C1_SCOPED_COMPLETE_GATE_BLOCK"
    : result.hosted === "NOT_RUN"
      ? "C1_BLOCK_HOSTED_NOT_RUN"
      : "C1_NATIVE_ATTEMPT_BLOCKED",
);
process.exitCode = success ? 0 : 1;
