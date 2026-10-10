import { readFile, rm } from "node:fs/promises";
import { createHash } from "node:crypto";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import { check } from "./policy.mjs";
import sourceBlobs from "./source-fixture-blobs.json" with { type: "json" };
export async function verifySourceFiles() {
  for (const [path, sha] of Object.entries(sourceBlobs)) {
    const b=await readFile(new URL("../../c1-app-under-test/"+path,import.meta.url));
    check(createHash("sha1").update("blob "+b.length+"\0").update(b).digest("hex")===sha);
  }
}
if(process.argv[1]===fileURLToPath(import.meta.url)) {
  try {
    await verifySourceFiles();
    await rm(new URL("../../c1-app-under-test/app/.c1-compiled",import.meta.url),{recursive:true,force:true});
    const result=spawnSync(process.execPath,[fileURLToPath(new URL("../../c1-app-under-test/app/node_modules/typescript/bin/tsc",import.meta.url)),"-p",fileURLToPath(new URL("./fixture-tsconfig.json",import.meta.url))],{encoding:"utf8",timeout:60000});
    check(result.status===0);
    console.log("C1_EXACT_SOURCE_FIXTURE_PREPARED");
  } catch { console.log("C1_SOURCE_FIXTURE_BLOCK");process.exitCode=1; }
}
