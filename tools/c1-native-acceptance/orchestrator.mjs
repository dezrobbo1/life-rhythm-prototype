import { AdmissionTrace, admissionFailureFrom } from "./admission-evidence.mjs";
import { completeBypassCleanup } from "./retained-cleanup.mjs";
import { jobWindow, abortable } from "./lifecycle.mjs";
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
  protectionMode,
  protectionCredential,
  proveApplicationDenial,
  proveDeploymentProtection,
  releaseProtectionCredential,
  bypassCleanupEvidence,
} from "./policy.mjs";
import { preflight, githubGet } from "./preflight.mjs";
import { completeCoverage, coverageRows, fixtureEvidence } from "./coverage.mjs";
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
  attribution: (config, phase, env) => verifyAttribution(env, config, "pre"),
  oidc: issueOidc,
  publicConfig: (oidc, budget, trace) =>
    readPublicConfig(publicTextReader(oidc, budget, fetch, trace)),
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
  denial: proveApplicationDenial,
  protection: (budget, signal) => proveDeploymentProtection(budget, fetch, signal),
  coverage: completeCoverage,
  bypassCleanup: completeBypassCleanup,
};
function evidence(
  passed,
  started,
  complete,
  browserVersion,
  env,
  budget,
  preReceipt,
  fixtures,
  admissionFailure,
  bypassCleanup,
) {
  check(passed.every((x) => rows.includes(x)));
  check(/^[a-f0-9]{40}$/.test(env.C1_TRUSTED_SHA));
  check(
    browserVersion === null ||
      (browserVersion.length <= 32 &&
        /^\d+\.\d+\.\d+\.\d+$/.test(browserVersion)),
  );
  if (complete) check(rows.every((row) => passed.includes(row)));
  return {
    ...report([], "BLOCK", admissionFailure),
    hosted: started
      ? complete
        ? "TEST_PHASE_COMPLETE_PENDING_POST"
        : "ATTEMPTED_BLOCKED"
      : "NOT_RUN",
    passed: complete ? [...new Set(passed)] : [],
    observedRows: [...new Set(passed)],
    notRun: complete ? [] : [...rows],
    harness: env.C1_TRUSTED_SHA,
    protectionMode: protectionMode(env.C1_PROTECTION_MODE),
    date: new Date().toISOString(),
    timezone: "UTC",
    browserVersion,
    viewports: [
      { width: 390, height: 844 },
      { width: 1280, height: 844 },
    ],
    accounts: manifest.accounts.map(({ label, uuid }) => ({ label, uuid })),
    runId: env.GITHUB_RUN_ID,
    attempt: env.GITHUB_RUN_ATTEMPT,
    origin: manifest.origin,
    preReceipt,
    ...(complete ? { fixtures:fixtureEvidence(fixtures) } : {}),
    completedAt: complete ? new Date().toISOString() : null,
    postVerification: "PENDING",
    requests: budget.requests,
    passwordSignins: budget.signins,
    bypassCleanup,
  };
}
export async function executeAcceptance(
  env,
  config,
  adapters = {},
  cancellationSignal,
) {
  let window;
  try {
    window = jobWindow(env);
  } catch {
    return report();
  }
  const d = { ...defaults, ...adapters },
    abort = new AbortController(),
    work = (fn) =>
      withTimeout(
        () => abortable(fn, abort.signal),
        Math.min(
          adapters.timeoutMs ?? 60000,
          Math.max(1, window.deadline - 120000 - Date.now()),
        ),
      ),
    budget = new Budget(window.start, window.deadline),
    passed = [],
    sessions = new Map(),
    heads = new Map(),
    authTasks = new Set();
  const authWork = (fn) => {
    const task = Promise.resolve().then(fn);
    authTasks.add(task);
    task.finally(() => authTasks.delete(task)).catch(() => {});
    return work(() => task);
  };
  const stop = () => abort.abort();
  cancellationSignal?.addEventListener("abort", stop, { once: true });
  if (cancellationSignal?.aborted) stop();
  const deadlineTimer = setTimeout(
    stop,
    Math.max(1, window.deadline - 120000 - Date.now()),
  );
  let browser = null,
    browserVersion = null,
    browserTask = null,
    started = false,
    complete = false,
    publishableKey = null,
    preReceipt = null,
    fixtures = null,
    admissionFailure = null,
    retainedCredential = null,
    bypassCleanup = null;
  const admissionTrace = new AdmissionTrace();
  try {
    guardIdentity(identityFromEnv(env), env.C1_TRUSTED_SHA);
    const mode = protectionMode(env.C1_PROTECTION_MODE);
    check(config?.enabled === true);
    await work(() => d.preflight(env));
    passed.push("preflight");
    const admission = await work(() => d.attribution(config, "start", env));
    preReceipt = admission?.preReceipt ?? null;
    passed.push("attribution");
    // Verify signed GitHub claims in BOTH modes. Bypass is transport admission,
    // never a substitute for workflow identity or Supabase account sessions.
    const issueAdmission = async () => {
      const verifiedOidc = await work(() => d.oidc(env, env.C1_TRUSTED_SHA));
      if(mode === "trusted-source") return protectionCredential(mode,verifiedOidc);
      if(!retainedCredential) {
        retainedCredential=protectionCredential(mode,env.C1_AUTOMATION_BYPASS_SECRET);
        delete env.C1_AUTOMATION_BYPASS_SECRET;
      }
      return retainedCredential;
    };
    let oidc = await issueAdmission();
    if (mode === "automation-bypass") await work(() => d.protection(budget, abort.signal));
    started = true;
    const publicConfig = await work(() => d.publicConfig(oidc, budget, admissionTrace));
    publishableKey = publicConfig.publishableKey;
    check(
      /^sb_publishable_[A-Za-z0-9_-]{1,256}$/.test(publicConfig.publishableKey),
    );
    let tx = d.transport(oidc, budget, undefined, abort.signal);
    const key = await work(() => d.key(tx));
    // Before reading either A/B password, prove Vercel admission grants no app identity.
    await work(() => d.denial(tx));
    // No password property is read before identity/source, trusted supervised deployment binding,
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
      oidc = await issueAdmission();
      tx = d.transport(oidc, budget, undefined, abort.signal);
      started = true;
      const closingTx = d.transport(oidc, budget);
      const track = (session) =>
        sessions.set(account.label, { session, tx, closingTx });
      await work(() => d.preflight(env));
      await work(() => d.attribution(config, "start", env));
      let session = await authWork(() =>
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
      session = await authWork(() =>
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
      oidc = await issueAdmission();
      await work(() => d.preflight(env));
      await work(() => d.attribution(config, "start", env));
      const browserKey = "browser-" + width + "-" + index;
      const closingTx = d.transport(oidc, budget);
      browserTask = d.browserRow(
        browser,
        width,
        manifest.accounts[index],
        passwords[index],
        oidc,
        budget,
        key,
        publicConfig.publishableKey,
        heads.get(manifest.accounts[index].label),
        publicConfig.assets,
        abort.signal,
        (session) => sessions.set(browserKey, { session, closingTx }),
        () => sessions.delete(browserKey),
      );
      browserTask.catch(() => {});
      const row = await work(() => browserTask);
      browserTask = null;
      if (!passed.includes(row)) passed.push(row);
    }
    const coverage=await d.coverage({tx,closingTx:d.transport(oidc,budget),sessions,publishableKey,env,config,signal:abort.signal,work});
    check(coverageRows.length===coverage.rows.length && coverageRows.every(row=>coverage.rows.includes(row)) && new Set(coverage.rows).size===coverageRows.length);
    fixtures=fixtureEvidence(coverage.fixtures);passed.push(...coverageRows);
    for (const account of manifest.accounts) {
      const held = sessions.get(account.label);
      const head = await work(() =>
        d.readHead(held.tx, account, held.session.access_token, publishableKey),
      );
      check(JSON.stringify(head) === JSON.stringify(heads.get(account.label)));
    }
    const activeBrowser = browser;
    const finishing = [
      async () => {
        await activeBrowser.close();
        browser = null;
      },
    ];
    for (const [name, held] of sessions)
      finishing.push(async () => {
        await d.logout(held.closingTx, held.session, publishableKey);
        sessions.delete(name);
      });
    await cleanup(finishing);
    passed.push("cleanup");
    await work(() => d.attribution(config, "end", env));
    await work(() => d.preflight(env));
    check(!abort.signal.aborted);
    complete = true;
  } catch (error) {
    admissionFailure = admissionFailureFrom(error) ?? admissionTrace.failure(error);
    abort.abort();
    complete = false;
  } finally {
    if (authTasks.size) {
      try {
        await withTimeout(() => Promise.allSettled([...authTasks]), 10000);
      } catch {
        complete = false;
      }
    }
    if (browserTask) {
      try {
        await withTimeout(() => browserTask, 10000);
      } catch {
        complete = false;
      }
    }
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
    clearTimeout(deadlineTimer);
    cancellationSignal?.removeEventListener("abort", stop);
    if(retainedCredential) {
      try {
        bypassCleanup=bypassCleanupEvidence(await d.bypassCleanup({credential:retainedCredential,
          budget,deadline:window.deadline,env,config}));
      } catch { complete=false; }
      finally { releaseProtectionCredential(retainedCredential); retainedCredential=null; }
    }
    if(cancellationSignal?.aborted) complete=false;
  }
  // No raw errors, JWTs, passwords, API bodies or arbitrary adapter strings reach
  // evidence. Partial observations are never promoted to acceptance PASS.
  try {
    return evidence(
      passed,
      started,
      complete,
      browserVersion,
      env,
      budget,
      preReceipt,
      fixtures,
      admissionFailure,
      bypassCleanup,
    );
  } catch {
    return report([], "BLOCK", admissionFailure);
  }
}
