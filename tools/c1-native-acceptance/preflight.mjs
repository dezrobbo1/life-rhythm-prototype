import { pathToFileURL } from "node:url";
import { manifest, check, guardIdentity, identityFromEnv } from "./policy.mjs";
export async function preflight(get, identity, trusted) {
  guardIdentity(identity, trusted);
  const root = "/repos/" + manifest.repository;
  const repo = await get(root);
  check(
    repo.id === Number(manifest.repositoryId) &&
      repo.owner.id === Number(manifest.ownerId) &&
      repo.default_branch === "main",
  );
  const main = await get(root + "/branches/main");
  check(main.commit.sha === trusted);
  const pr = await get(root + "/pulls/180");
  check(
    pr.state === "open" &&
      pr.draft === true &&
      !pr.merged &&
      pr.base.ref === "main" &&
      pr.base.repo.full_name === manifest.repository &&
      pr.head.repo.full_name === manifest.repository &&
      pr.head.sha === manifest.source,
  );
  const reviews = await get(root + "/pulls/180/reviews?per_page=100");
  check(reviews.length < 100);
  const latest = new Map();
  for (const r of reviews)
    if (["APPROVED", "CHANGES_REQUESTED", "DISMISSED"].includes(r.state))
      latest.set(r.user.login, r);
  check(
    [...latest.values()].some(
      (r) =>
        r.state === "APPROVED" &&
        r.commit_id === manifest.source &&
        r.user.login !== pr.user.login,
    ),
  );
  check(![...latest.values()].some((r) => r.state === "CHANGES_REQUESTED"));
  const checks = await get(
    root + "/commits/" + manifest.source + "/check-runs?per_page=100",
  );
  check(
    checks.total_count < 100 &&
      checks.check_runs.length === checks.total_count &&
      checks.total_count > 0,
  );
  check(
    checks.check_runs.every(
      (c) =>
        c.head_sha === manifest.source &&
        c.status === "completed" &&
        c.conclusion === "success",
    ),
  );
  const statuses = await get(root + "/commits/" + manifest.source + "/status");
  check(
    statuses.sha === manifest.source &&
      statuses.state === "success" &&
      statuses.total_count > 0 &&
      statuses.total_count < 100,
  );
  check(statuses.statuses.every((s) => s.state === "success"));
  return "preflight";
}
export async function githubGet(path) {
  check(
    path.startsWith("/repos/" + manifest.repository + "/") ||
      path === "/repos/" + manifest.repository,
  );
  const response = await fetch("https://api.github.com" + path, {
    redirect: "error",
    signal: AbortSignal.timeout(10000),
    headers: {
      Authorization: "Bearer " + process.env.GITHUB_TOKEN,
      Accept: "application/vnd.github+json",
      "X-GitHub-Api-Version": "2022-11-28",
    },
  });
  check(response.ok && !response.redirected);
  const raw = await response.text();
  check(raw.length < 1024 * 1024);
  return JSON.parse(raw);
}
if (
  process.argv[1] &&
  import.meta.url === pathToFileURL(process.argv[1]).href
) {
  try {
    await preflight(githubGet, identityFromEnv(), process.env.C1_TRUSTED_SHA);
    console.log("C1_PREFLIGHT_OK");
  } catch {
    console.log("C1_PREFLIGHT_BLOCK");
    process.exitCode = 1;
  }
}
