import { createLocalJWKSet } from "jose";
import { chromium } from "playwright";
import {
  manifest,
  check,
  guardIdentity,
  identityFromEnv,
  Budget,
  cleanup,
  rows,
  report,
  withTimeout,
} from "./policy.mjs";
import { preflight, githubGet } from "./preflight.mjs";
import {
  verifyAttribution,
  issueOidc,
  readPublicConfig,
  publicTextReader,
} from "./admission.mjs";
import {
  makeTransport,
  login,
  refresh,
  logout,
  runMetadata,
  readPositiveHead,
  browserRow,
} from "./native.mjs";
const defaults = {
  preflight: (env) =>
    preflight(githubGet, identityFromEnv(env), env.C1_TRUSTED_SHA),
  attribution: verifyAttribution,
  oidc: issueOidc,
  publicConfig: (oidc, budget) =>
    readPublicConfig(publicTextReader(oidc, budget)),
  key: async (tx) => {
    const { response, body } = await tx(
      manifest.provider + "/auth/v1/.well-known/jwks.json",
    );
    check(
      response.status === 200 &&
        Array.isArray(body.keys) &&
        body.keys.length > 0 &&
        body.keys.length <= 20,
    );
    return createLocalJWKSet(body);
  },
  transport: makeTransport,
  login,
  refresh,
  logout,
  metadata: runMetadata,
  readHead: readPositiveHead,
  browser: () =>
    chromium.launch({
      headless: true,
      args: ["--disable-breakpad", "--disable-crash-reporter"],
    }),
  browserRow,
};
function evidence(passed, started, complete, browserVersion, env, budget) {
  check(passed.every((x) => rows.includes(x)));
  check(/^[a-f0-9]{40}$/.test(env.C1_TRUSTED_SHA));
  check(
    browserVersion === null ||
      (browserVersion.length <= 32 &&
        /^\d+\.\d+\.\d+\.\d+$/.test(browserVersion)),
  );
  if (complete) check(rows.every((row) => passed.includes(row)));
  return {
    ...report(),
    hosted: started
      ? complete
        ? "SCOPED_ROWS_COMPLETE"
        : "ATTEMPTED_BLOCKED"
      : "NOT_RUN",
    passed: complete ? [...new Set(passed)] : [],
    observedRows: [...new Set(passed)],
    notRun: complete ? [] : [...rows],
    harness: env.C1_TRUSTED_SHA,
    date: new Date().toISOString(),
    timezone: "UTC",
    browserVersion,
    viewports: [
      { width: 390, height: 844 },
      { width: 1280, height: 844 },
    ],
    accounts: manifest.accounts.map(({ label, uuid }) => ({ label, uuid })),
    requests: budget.requests,
    passwordSignins: budget.signins,
  };
}
export async function executeAcceptance(env, config, adapters = {}) {
  const d = { ...defaults, ...adapters },
    abort = new AbortController(),
    work = (fn) => withTimeout(fn, adapters.timeoutMs ?? 60000),
    budget = new Budget(),
    passed = [],
    sessions = new Map(),
    heads = new Map();
  let browser = null,
    browserVersion = null,
    started = false,
    complete = false,
    publishableKey = null;
  try {
    guardIdentity(identityFromEnv(env), env.C1_TRUSTED_SHA);
    check(config?.enabled === true);
    await work(() => d.preflight(env));
    passed.push("preflight");
    await work(() => d.attribution(config, "start"));
    passed.push("attribution");
    let oidc = await work(() => d.oidc(env, env.C1_TRUSTED_SHA));
    started = true;
    const publicConfig = await work(() => d.publicConfig(oidc, budget));
    publishableKey = publicConfig.publishableKey;
    check(
      /^sb_publishable_[A-Za-z0-9_-]{1,256}$/.test(publicConfig.publishableKey),
    );
    let tx = d.transport(oidc, budget, undefined, abort.signal);
    const key = await work(() => d.key(tx));
    // No password property is read before identity/source, signed deployment binding,
    // OIDC verification and attributable public client configuration all pass.
    const passwords = manifest.accounts.map(
      (a) => env["C1_ACCOUNT_" + a.label + "_PASSWORD"],
    );
    check(
      passwords.every(
        (p) => typeof p === "string" && p.length > 0 && p.length <= 1024,
      ),
    );
    for (const [index, account] of manifest.accounts.entries()) {
      oidc = await work(() => d.oidc(env, env.C1_TRUSTED_SHA));
      tx = d.transport(oidc, budget, undefined, abort.signal);
      started = true;
      const closingTx = d.transport(oidc, budget);
      const track = (session) =>
        sessions.set(account.label, { session, tx, closingTx });
      await work(() => d.preflight(env));
      await work(() => d.attribution(config, "start"));
      let session = await work(() =>
        d.login(
          tx,
          account,
          passwords[index],
          key,
          publicConfig.publishableKey,
          track,
        ),
      );
      if (!passed.includes("identity")) passed.push("identity");
      const head = await work(() =>
        d.metadata(
          tx,
          account,
          session.access_token,
          publicConfig.publishableKey,
        ),
      );
      passed.push(
        "provider-own-" + account.label,
        "provider-cross-" + account.label,
      );
      session = await work(() =>
        d.refresh(
          tx,
          account,
          session,
          key,
          publicConfig.publishableKey,
          track,
        ),
      );
      const refreshedHead = await work(() =>
        d.metadata(
          tx,
          account,
          session.access_token,
          publicConfig.publishableKey,
        ),
      );
      check(JSON.stringify(head) === JSON.stringify(refreshedHead));
      heads.set(account.label, refreshedHead);
    }
    passed.push("api", "refresh");
    browser = await work(() => d.browser());
    browserVersion = browser.version();
    // Replacement A and B at narrow width; one targeted desktop row, not duplicate
    // replay of unaffected historical desktop coverage.
    for (const [width, index] of [
      [390, 0],
      [390, 1],
      [1280, 0],
    ]) {
      oidc = await work(() => d.oidc(env, env.C1_TRUSTED_SHA));
      await work(() => d.preflight(env));
      await work(() => d.attribution(config, "start"));
      const row = await work(() =>
        d.browserRow(
          browser,
          width,
          manifest.accounts[index],
          passwords[index],
          oidc,
          budget,
          key,
          publicConfig.publishableKey,
          heads.get(manifest.accounts[index].label),
        ),
      );
      if (!passed.includes(row)) passed.push(row);
    }
    for (const account of manifest.accounts) {
      const held = sessions.get(account.label);
      const head = await work(() =>
        d.readHead(held.tx, account, held.session.access_token, publishableKey),
      );
      check(JSON.stringify(head) === JSON.stringify(heads.get(account.label)));
    }
    const activeBrowser = browser;
    browser = null;
    const finishing = [() => activeBrowser.close()];
    for (const held of sessions.values())
      finishing.push(() =>
        d.logout(held.closingTx, held.session, publishableKey),
      );
    sessions.clear();
    await cleanup(finishing);
    passed.push("cleanup");
    await work(() => d.attribution(config, "end"));
    await work(() => d.preflight(env));
    complete = true;
  } catch {
    abort.abort();
    complete = false;
  } finally {
    const actions = [];
    if (browser) actions.push(() => browser.close());
    for (const { session, closingTx } of sessions.values())
      actions.push(() => d.logout(closingTx, session, publishableKey));
    try {
      await cleanup(actions);
    } catch {
      complete = false;
    }
    sessions.clear();
  }
  // No raw errors, JWTs, passwords, API bodies or arbitrary adapter strings reach
  // evidence. Partial observations are never promoted to acceptance PASS.
  try {
    return evidence(passed, started, complete, browserVersion, env, budget);
  } catch {
    return report();
  }
}
