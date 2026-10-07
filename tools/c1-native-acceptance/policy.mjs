export const manifest = Object.freeze({
  repository: "dezrobbo1/life-rhythm-prototype",
  repositoryId: "1268056225",
  ownerId: "228294552",
  pr: 180,
  source: "5e08c55918eaf64be02d210b17fbcd11c7ec34bf",
  workflowRef:
    "dezrobbo1/life-rhythm-prototype/.github/workflows/c1-native-acceptance.yml@refs/heads/main",
  origin:
    "https://life-rhythm-prototype-git-feat-gate8a7c-dbab5a-daler-project-lr.vercel.app",
  deployment: "dpl_Ees6UuR6vfNtmuNgk9Qe1zCLqmYi",
  project: "prj_Os5Ucic7cDQwut3mO3I39V3lc52s",
  team: "team_EeRBGaTcRamnOpGbT1RswHVc",
  provider: "https://lfwadowwdvcnibjkeerg.supabase.co",
  accounts: Object.freeze([
    Object.freeze({
      label: "A",
      email: "test1@test.com",
      uuid: "bd86bbff-391f-4327-bf8a-e0ad4297f3d3",
      revision: "9007199254740993",
    }),
    Object.freeze({
      label: "B",
      email: "test2@test.com",
      uuid: "485b0435-c542-466c-a105-bd425aced833",
      revision: "42",
    }),
  ]),
});
export function check(ok) {
  if (!ok) throw new Error("C1_GUARD_BLOCK");
}
export function guardIdentity(i, trusted) {
  check(/^[a-f0-9]{40}$/.test(trusted));
  const expected = {
    repository: manifest.repository,
    repositoryId: manifest.repositoryId,
    ownerId: manifest.ownerId,
    event: "workflow_dispatch",
    ref: "refs/heads/main",
    workflowRef: manifest.workflowRef,
    workflowSha: trusted,
    harnessSha: trusted,
    runner: "github-hosted",
    enabled: "true",
  };
  for (const [k, v] of Object.entries(expected)) check(i[k] === v);
}
export function guardClaims(c, sha) {
  const wanted = {
    iss: "https://token.actions.githubusercontent.com",
    aud: "https://github.com/dezrobbo1",
    repository: manifest.repository,
    repository_id: manifest.repositoryId,
    repository_owner_id: manifest.ownerId,
    ref: "refs/heads/main",
    environment: "c1-native-preview",
    event_name: "workflow_dispatch",
    workflow_ref: manifest.workflowRef,
    workflow_sha: sha,
    runner_environment: "github-hosted",
  };
  for (const [k, v] of Object.entries(wanted)) check(c[k] === v);
  check(
    Number.isInteger(c.exp) &&
      c.exp > Date.now() / 1000 &&
      c.exp < Date.now() / 1000 + 900,
  );
}
export function scopedHeaders(input, oidc, existing = {}) {
  const u = new URL(input);
  check(!u.username && !u.password && !u.hash);
  check([manifest.origin, manifest.provider].includes(u.origin));
  const safe = Object.fromEntries(
    Object.entries(existing).filter(
      ([name]) => !name.toLowerCase().startsWith("x-vercel-"),
    ),
  );
  return u.origin === manifest.origin
    ? { ...safe, "x-vercel-trusted-oidc-idp-token": oidc }
    : safe;
}
export function requestPolicy(input, method = "GET", redirected = false) {
  const u = new URL(input);
  scopedHeaders(input, "");
  check(!redirected);
  if (u.origin === manifest.origin)
    check(method === "GET" || method === "HEAD");
  else if (method === "OPTIONS")
    check(
      ["/rest/v1/trial_access", "/auth/v1/token", "/auth/v1/logout"].includes(
        u.pathname,
      ),
    );
  else if (method === "GET")
    check(
      u.pathname === "/rest/v1/trial_access" ||
        u.pathname === "/auth/v1/user" ||
        u.pathname === "/auth/v1/.well-known/jwks.json",
    );
  else
    check(
      method === "POST" &&
        ((u.pathname === "/auth/v1/token" &&
          ["password", "refresh_token"].includes(
            u.searchParams.get("grant_type"),
          )) ||
          (u.pathname === "/auth/v1/logout" && u.search === "?scope=local")),
    );
}
export class Budget {
  constructor(start = Date.now()) {
    this.start = start;
    this.requests = 0;
    this.signins = 0;
  }
  take({ signin = false, cleanup = false } = {}) {
    check(Date.now() - this.start < 20 * 60 * 1000);
    check(this.requests < (cleanup ? 200 : 190));
    if (signin) {
      check(this.signins < 8);
      this.signins++;
    }
    this.requests++;
  }
}
const uuid =
  /^[a-f0-9]{8}-[a-f0-9]{4}-[1-8][a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$/;
export function revision(v) {
  check(typeof v === "string" && /^(0|[1-9][0-9]{0,18})$/.test(v));
  check(BigInt(v) <= 9223372036854775807n);
  return v;
}
function keys(value, allowed) {
  check(value && typeof value === "object" && !Array.isArray(value));
  check(Object.keys(value).sort().join() === allowed.slice().sort().join());
}
export function positiveRows(rows, account) {
  check(Array.isArray(rows) && rows.length === 1);
  const r = rows[0];
  keys(r, ["enabled", "subject", "account_heads"]);
  check(r.enabled === true && r.subject === account.uuid);
  const h = r.account_heads;
  keys(h, [
    "protocol_version",
    "canonical_schema_version",
    "revision",
    "generation",
  ]);
  check(
    h.protocol_version === 1 &&
      h.canonical_schema_version === 1 &&
      revision(h.revision) === account.revision &&
      uuid.test(h.generation),
  );
  return h;
}
export function boundary(response, body, expected, account, generation) {
  check(
    response.status === expected &&
      response.headers.get("content-type")?.split(";")[0] ===
        "application/json",
  );
  check(
    response.headers
      .get("cache-control")
      ?.split(",")
      .map((x) => x.trim())
      .includes("no-store"),
  );
  if (expected === 200) {
    keys(body, ["kind", "protocolVersion", "schemaVersion", "buildId", "head"]);
    check(
      body.kind === "ready" &&
        body.protocolVersion === 1 &&
        body.schemaVersion === 1 &&
        body.buildId === manifest.source,
    );
    keys(body.head, ["revision", "generation"]);
    check(
      revision(body.head.revision) === account.revision &&
        uuid.test(body.head.generation),
    );
    if (generation) check(body.head.generation === generation);
  } else {
    const category = {
      400: "invalid-request",
      401: "unauthorized",
      403: "forbidden",
      409: "conflict",
      426: "upgrade-required",
      503: "unavailable",
    }[expected];
    check(category);
    keys(
      body,
      expected === 409
        ? ["kind", "category", "requestId", "head"]
        : ["kind", "category", "requestId"],
    );
    check(
      body.kind === (expected === 409 ? "conflict" : "error") &&
        body.category === category &&
        uuid.test(body.requestId),
    );
    if (expected === 409) {
      keys(body.head, ["revision", "generation"]);
      check(
        revision(body.head.revision) === account.revision &&
          body.head.generation === generation,
      );
    }
  }
}
export const rows = [
  "identity",
  "provider-own-A",
  "provider-own-B",
  "provider-cross-A",
  "provider-cross-B",
  "api",
  "refresh",
  "ui-390",
  "ui-1280",
  "cleanup",
  "attribution",
  "preflight",
];
export function report(passed = [], gate = "BLOCK") {
  check(
    gate === "BLOCK" &&
      Array.isArray(passed) &&
      passed.every((x) => rows.includes(x)) &&
      new Set(passed).size === passed.length,
  );
  return {
    format: 1,
    gate,
    hosted: "NOT_RUN",
    source: manifest.source,
    deployment: manifest.deployment,
    passed: [],
    offlineGuards: passed,
    notRun: [...rows],
    fixturesNotRun: [
      "expired-valid-token",
      "provider-503",
      "stored-incompatible-head",
      "disabled-uninvited",
    ],
    historicalIdentityEvidence: "UNCHANGED",
  };
}
export async function withTimeout(fn, ms = 10000) {
  let timer;
  try {
    return await Promise.race([
      fn(),
      new Promise((_, reject) => {
        timer = setTimeout(() => reject(new Error("C1_TIMEOUT_BLOCK")), ms);
      }),
    ]);
  } finally {
    clearTimeout(timer);
  }
}
export async function cleanup(actions) {
  let failed = false;
  for (const action of actions)
    try {
      await withTimeout(action, 5000);
    } catch {
      failed = true;
    }
  check(!failed);
}
export function requireAttribution() {
  // A reviewed manifest, mutable alias, READY label, response buildId, or caller-provided
  // JSON cannot independently authenticate Vercel's project/deployment/source binding.
  // No approved machine-readable authenticated channel is available to this job yet.
  throw new Error("C1_DEPLOYMENT_ATTRIBUTION_BLOCK");
}
export function identityFromEnv(env = process.env) {
  return {
    repository: env.GITHUB_REPOSITORY,
    repositoryId: env.GITHUB_REPOSITORY_ID,
    ownerId: env.GITHUB_REPOSITORY_OWNER_ID,
    event: env.GITHUB_EVENT_NAME,
    ref: env.GITHUB_REF,
    workflowRef: env.GITHUB_WORKFLOW_REF,
    workflowSha: env.GITHUB_WORKFLOW_SHA,
    harnessSha: env.C1_HARNESS_SHA,
    runner: env.RUNNER_ENVIRONMENT,
    enabled: env.C1_ENABLED,
  };
}
