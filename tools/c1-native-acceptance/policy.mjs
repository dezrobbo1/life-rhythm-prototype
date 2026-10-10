export const manifest = Object.freeze({
  repository: "dezrobbo1/life-rhythm-prototype",
  repositoryId: "1268056225",
  ownerId: "228294552",
  pr: 180,
  source: "07469f9f13aa3887a6ec7847b7b642a839651e63",
  workflowRef:
    "dezrobbo1/life-rhythm-prototype/.github/workflows/c1-native-acceptance.yml@refs/heads/main",
  origin:
    "https://life-rhythm-prototype-7it1u92y9-daler-project-lr.vercel.app",
  deployment: "dpl_4GvGzb8vWMvFuPpYjUaJSBv61Vtm",
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
export const providerSelect = Object.freeze({
  trial_access:
    "enabled,subject,account_heads(protocol_version,canonical_schema_version,revision::text,generation)",
  account_heads:
    "subject,protocol_version,canonical_schema_version,revision::text,generation",
});
// Secrets are reachable only by the exact-origin header projector. Logging,
// inspecting or JSON-serializing the carrier exposes only the fixed mode enum.
const protectionSecrets = new WeakMap();
export function protectionMode(mode) {
  check(mode === "trusted-source" || mode === "automation-bypass");
  return mode;
}
export function protectionCredential(mode, value) {
  protectionMode(mode);
  check(typeof value === "string" && value.length > 0 && value.length <= 8192);
  if (mode === "automation-bypass") check(/^[A-Za-z0-9_-]{32}$/.test(value));
  const carrier = Object.freeze({ mode });
  protectionSecrets.set(carrier, value);
  return carrier;
}
export function scopedHeaders(input, oidc, existing = {}) {
  const u = new URL(input);
  check(!u.username && !u.password && !u.hash);
  check([manifest.origin, manifest.provider].includes(u.origin));
  const caller = new Headers(existing),
    safe = {};
  // Project known protocol fields; never forward arbitrary page-controlled headers.
  if (u.origin === manifest.origin) {
    // Legacy string calls remain the trusted-source-only offline adapter API.
    // Real orchestration always supplies a sealed, explicit-mode carrier.
    if (typeof oidc === "string") safe["x-vercel-trusted-oidc-idp-token"] = oidc;
    else {
      check(protectionSecrets.has(oidc));
      safe[oidc.mode === "automation-bypass"
        ? "x-vercel-protection-bypass" : "x-vercel-trusted-oidc-idp-token"] =
        protectionSecrets.get(oidc);
    }
    if (u.pathname === "/api/account/boundary") {
      safe.Origin = manifest.origin;
      if (caller.has("authorization"))
        safe.Authorization = caller.get("authorization");
    }
  } else {
    if (u.pathname !== "/auth/v1/.well-known/jwks.json" && caller.has("apikey"))
      safe.apikey = caller.get("apikey");
    if (
      (u.pathname.startsWith("/rest/v1/") ||
        ["/auth/v1/user", "/auth/v1/logout"].includes(u.pathname)) &&
      caller.has("authorization")
    )
      safe.Authorization = caller.get("authorization");
    if (u.pathname.startsWith("/rest/v1/"))
      safe["Accept-Profile"] = "life_rhythm";
    if (u.pathname === "/auth/v1/token")
      safe["content-type"] = "application/json";
  }
  return safe;
}
export function requestPolicy(
  input,
  method = "GET",
  redirected = false,
  assets = new Set(),
) {
  const u = new URL(input);
  scopedHeaders(input, "");
  check(!redirected);
  if (u.origin === manifest.origin) {
    check(method === "GET" || method === "HEAD");
    if (u.pathname === "/" || assets.has(u.pathname)) {
      check(!u.search);
      return;
    }
    check(u.pathname === "/api/account/boundary");
    const allowed = {
      protocolVersion: /^(0|1|2)$/,
      schemaVersion: /^(1|2)$/,
      expectedRevision: /^(0|42|9007199254740993|9223372036854775808)$/,
      expectedGeneration:
        /^[a-f0-9]{8}-[a-f0-9]{4}-[1-8][a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$/,
      owner: new RegExp(
        "^(" + manifest.accounts.map((a) => a.uuid).join("|") + ")$",
      ),
    };
    for (const [key, value] of u.searchParams) check(allowed[key]?.test(value));
    check([...u.searchParams].length <= 5);
    return;
  }
  if (u.pathname.startsWith("/rest/v1/")) {
    check(method === "GET");
    const table = u.pathname.slice("/rest/v1/".length);
    check(Object.hasOwn(providerSelect, table));
    const wanted = {
      select: providerSelect[table],
      issuer: "eq." + manifest.provider + "/auth/v1",
    };
    if (table === "trial_access") wanted.enabled = "eq.true";
    wanted.subject = u.searchParams.get("subject");
    check(manifest.accounts.some((a) => wanted.subject === "eq." + a.uuid));
    check([...u.searchParams].length === Object.keys(wanted).length);
    for (const [k, v] of Object.entries(wanted))
      check(u.searchParams.get(k) === v);
    return;
  }
  if (
    ["/auth/v1/user", "/auth/v1/.well-known/jwks.json"].includes(u.pathname)
  ) {
    check(method === "GET" && !u.search);
    return;
  }
  check(method === "POST");
  check(
    (u.pathname === "/auth/v1/token" &&
      ["?grant_type=password", "?grant_type=refresh_token"].includes(
        u.search,
      )) ||
      (u.pathname === "/auth/v1/logout" && u.search === "?scope=local"),
  );
}
export function authBody(url, body, expected = {}) {
  const u = new URL(url);
  if (u.origin !== manifest.provider || u.pathname !== "/auth/v1/token") {
    check(body == null || body === "");
    return;
  }
  const data = typeof body === "string" ? JSON.parse(body) : body;
  if (u.search === "?grant_type=password") {
    if (Object.hasOwn(data, "gotrue_meta_security")) {
      keys(data.gotrue_meta_security, []); // Actual locked SDK sends an empty object; CAPTCHA is a stop.
      keys(data, ["email", "password", "gotrue_meta_security"]);
    } else keys(data, ["email", "password"]);
    check(manifest.accounts.some((a) => a.email === data.email));
    check(
      typeof data.password === "string" &&
        data.password.length > 0 &&
        data.password.length <= 1024,
    );
    if (expected.account)
      check(
        data.email === expected.account.email &&
          data.password === expected.password,
      );
  } else {
    keys(data, ["refresh_token"]);
    check(
      typeof data.refresh_token === "string" &&
        data.refresh_token.length > 0 &&
        data.refresh_token.length <= 8192,
    );
    if (expected.session)
      check(data.refresh_token === expected.session.refresh_token);
  }
}
export class Budget {
  constructor(start = Date.now(), deadline = start + 20 * 60 * 1000) {
    check(
      Number.isFinite(start) &&
        Number.isFinite(deadline) &&
        deadline <= start + 20 * 60 * 1000,
    );
    this.deadline = deadline;
    this.start = start;
    this.requests = 0;
    this.signins = 0;
  }
  take({ signin = false, cleanup = false } = {}) {
    check(Date.now() < this.deadline - (cleanup ? 0 : 2 * 60 * 1000));
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
export async function proveApplicationDenial(tx) {
  const { response, body } = await tx(manifest.origin +
    "/api/account/boundary?protocolVersion=1&schemaVersion=1");
  boundary(response, body, 401);
}
export async function proveDeploymentProtection(budget, fetcher = fetch, stopSignal) {
  check(!stopSignal?.aborted);
  budget.take();
  const response = await fetcher(manifest.origin + "/", {
    headers: {}, redirect: "error", cache: "no-store",
    signal: stopSignal ? AbortSignal.any([stopSignal, AbortSignal.timeout(10000)])
      : AbortSignal.timeout(10000),
  });
  try { check(!response.redirected && [401, 403].includes(response.status)); }
  finally { await response.body?.cancel(); }
}
// External management executor only: never inject a Vercel admin credential
// into the acceptance job. Attempt every bounded cleanup action even on failure.
export async function revokeAutomationBypass({ revoke, removeEnvironmentSecret, verifyDenied }) {
  check([revoke, removeEnvironmentSecret, verifyDenied].every(fn => typeof fn === "function"));
  await cleanup([revoke, removeEnvironmentSecret, async () => check(await verifyDenied() === true)]);
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
