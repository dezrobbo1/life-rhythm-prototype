import { mkdir, writeFile } from "node:fs/promises";
import {
  guardIdentity,
  identityFromEnv,
  requireAttribution,
  report,
} from "./policy.mjs";
// This entrypoint is intentionally inert until a separately reviewed attribution
// adapter can authenticate deployment/project/team/source/origin at start and end.
// Do not replace this gate with an operator JSON variable or response buildId.
try {
  guardIdentity(identityFromEnv(), process.env.C1_TRUSTED_SHA);
  requireAttribution();
} catch {
  await mkdir("artifacts", { recursive: true });
  await writeFile(
    "artifacts/results.json",
    JSON.stringify(report(), null, 2) + "\n",
    { mode: 0o600 },
  );
  console.log("C1_BLOCK_HOSTED_NOT_RUN");
  process.exitCode = 1;
}
