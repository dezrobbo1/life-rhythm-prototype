// Native adapters are never reached by run.mjs while attribution is blocked.
// Imported by offline regression tests; no top-level network/browser activity.
import { jwtVerify } from "jose";
import {
  manifest,
  check,
  scopedHeaders,
  requestPolicy,
  positiveRows,
  boundary,
  withTimeout,
  cleanup,
} from "./policy.mjs";
export function makeTransport(oidc, budget, fetcher = fetch) {
  return async (
    url,
    { method = "GET", headers = {}, body, cleanup: closing = false } = {},
  ) => {
    requestPolicy(url, method);
    budget.take({
      signin: new URL(url).searchParams.get("grant_type") === "password",
      cleanup: closing,
    });
    const response = await fetcher(url, {
      method,
      headers: scopedHeaders(url, oidc, headers),
      body,
      redirect: "error",
      cache: "no-store",
      signal: AbortSignal.timeout(10000),
    });
    check(
      !response.redirected &&
        (response.status < 300 || response.status >= 400) &&
        response.status !== 429,
    );
    // HTTP API failures expected by the native matrix are allowed below; transport
    // rejects redirection, not normal denied/error API statuses.
    const raw = await response.text();
    check(raw.length <= 65536);
    let parsed;
    try {
      parsed = response.status === 204 && raw === "" ? null : JSON.parse(raw);
    } catch {
      check(false);
    }
    return { response, body: parsed };
  };
}
export async function verifySession(token, account, key) {
  const { payload } = await jwtVerify(token, key, {
    issuer: manifest.provider + "/auth/v1",
    audience: "authenticated",
    algorithms: ["ES256", "RS256"],
    clockTolerance: 0,
  });
  check(
    payload.sub === account.uuid &&
      payload.role === "authenticated" &&
      typeof payload.session_id === "string" &&
      /^[a-f0-9]{8}-[a-f0-9]{4}-[1-8][a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$/.test(
        payload.session_id,
      ),
  );
  check(
    Number.isInteger(payload.exp) &&
      payload.exp > Date.now() / 1000 &&
      payload.exp < Date.now() / 1000 + 7200,
  );
  return payload.session_id;
}
export function metadataCases(account, generation) {
  const base = "/api/account/boundary";
  const q = "?protocolVersion=1&schemaVersion=1";
  return [
    [q, 200],
    ["", 400],
    [q + "&owner=" + account.uuid, 400],
    [q + "&protocolVersion=1", 400],
    ["?protocolVersion=0&schemaVersion=1", 400],
    ["?protocolVersion=2&schemaVersion=1", 426],
    ["?protocolVersion=1&schemaVersion=2", 426],
    [q + "&expectedRevision=" + account.revision, 400],
    [
      q +
        "&expectedRevision=9223372036854775808&expectedGeneration=" +
        generation,
      400,
    ],
    [
      q +
        "&expectedRevision=" +
        account.revision +
        "&expectedGeneration=" +
        generation,
      200,
    ],
    [q + "&expectedRevision=0&expectedGeneration=" + generation, 409],
    [
      q +
        "&expectedRevision=" +
        account.revision +
        "&expectedGeneration=22222222-2222-4222-8222-222222222222",
      409,
    ],
  ].map(([query, status]) => ({ method: "GET", path: base + query, status }));
}
export async function runMetadata(tx, account, token, publishableKey) {
  const other = manifest.accounts.find((a) => a.label !== account.label);
  const select =
    "enabled,subject,account_heads(protocol_version,canonical_schema_version,revision::text,generation)";
  const provider =
    manifest.provider +
    "/rest/v1/trial_access?select=" +
    encodeURIComponent(select) +
    "&issuer=eq." +
    encodeURIComponent(manifest.provider + "/auth/v1") +
    "&enabled=eq.true&subject=eq.";
  check(/^sb_publishable_[A-Za-z0-9_-]+$/.test(publishableKey));
  const headers = {
    apikey: publishableKey,
    Authorization: "Bearer " + token,
    "Accept-Profile": "life_rhythm",
  };
  const own = await tx(provider + account.uuid, { headers });
  check(own.response.status === 200);
  const head = positiveRows(own.body, account);
  const cross = await tx(provider + other.uuid, { headers });
  check(
    cross.response.status === 200 &&
      Array.isArray(cross.body) &&
      cross.body.length === 0,
  );
  for (const c of metadataCases(account, head.generation)) {
    const { response, body } = await tx(manifest.origin + c.path, {
      headers: { Authorization: "Bearer " + token, Origin: manifest.origin },
    });
    boundary(response, body, c.status, account, head.generation);
  }
  const missing = await tx(
    manifest.origin + "/api/account/boundary?protocolVersion=1&schemaVersion=1",
    { headers: { Origin: manifest.origin } },
  );
  boundary(missing.response, missing.body, 401, account);
  const owner = await tx(provider + account.uuid, { headers });
  check(owner.response.status === 200);
  check(
    JSON.stringify(positiveRows(owner.body, account)) === JSON.stringify(head),
  );
  return head;
}
export async function login(tx, account, password, key, publishableKey) {
  check(
    typeof password === "string" &&
      password.length > 0 &&
      password.length <= 1024,
  );
  const result = await tx(
    manifest.provider + "/auth/v1/token?grant_type=password",
    {
      method: "POST",
      headers: { apikey: publishableKey, "content-type": "application/json" },
      body: JSON.stringify({ email: account.email, password }),
    },
  );
  check(
    result.response.status === 200 &&
      result.body.user?.id === account.uuid &&
      typeof result.body.refresh_token === "string",
  );
  await verifySession(result.body.access_token, account, key);
  return result.body;
}
export async function refresh(tx, account, session, key, publishableKey) {
  const result = await tx(
    manifest.provider + "/auth/v1/token?grant_type=refresh_token",
    {
      method: "POST",
      headers: { apikey: publishableKey, "content-type": "application/json" },
      body: JSON.stringify({ refresh_token: session.refresh_token }),
    },
  );
  check(
    result.response.status === 200 &&
      result.body.user?.id === account.uuid &&
      typeof result.body.refresh_token === "string",
  );
  check(
    (await verifySession(result.body.access_token, account, key)) ===
      (await verifySession(session.access_token, account, key)),
  );
  return result.body;
}
export async function logout(tx, session, publishableKey) {
  const result = await tx(manifest.provider + "/auth/v1/logout?scope=local", {
    method: "POST",
    cleanup: true,
    headers: {
      apikey: publishableKey,
      Authorization: "Bearer " + session.access_token,
    },
  });
  check(result.response.status === 204);
}
export async function browserRow(
  browser,
  width,
  account,
  password,
  oidc,
  budget,
  key,
  publishableKey,
) {
  const context = await browser.newContext({
    viewport: { width, height: 844 },
    serviceWorkers: "block",
    acceptDownloads: false,
  });
  let failure = false,
    session = null,
    signins = 0;
  const pending = [];
  try {
    await context.routeWebSocket("**/*", (socket) => {
      failure = true;
      socket.close();
    });
    await context.route("**/*", async (route) => {
      try {
        const request = route.request();
        const u = new URL(request.url());
        requestPolicy(u.href, request.method(), !!request.redirectedFrom());
        const signin =
          request.method() === "POST" &&
          u.origin === manifest.provider &&
          u.pathname === "/auth/v1/token" &&
          u.searchParams.get("grant_type") === "password";
        budget.take({ signin, cleanup: u.pathname === "/auth/v1/logout" });
        if (signin) {
          check(++signins === 1);
          const body = request.postDataJSON();
          check(body.email === account.email);
        }
        const response = await route.fetch({
          headers: scopedHeaders(u.href, oidc, request.headers()),
          maxRedirects: 0,
          maxRetries: 0,
          timeout: 10000,
        });
        check(response.status() < 300 || response.status() >= 400);
        check(response.status() !== 429);
        if (u.origin === manifest.provider && u.pathname === "/auth/v1/logout")
          check(response.status() === 204);
        if (u.origin === manifest.provider && u.pathname === "/auth/v1/token") {
          const data = await response.json();
          check(response.status() === 200 && data.user?.id === account.uuid);
          await verifySession(data.access_token, account, key);
          session = data;
        }
        if (
          u.origin === manifest.origin &&
          u.pathname === "/api/account/boundary"
        ) {
          const body = await response.json();
          boundary(
            {
              status: response.status(),
              headers: new Headers(response.headers()),
            },
            body,
            200,
            account,
          );
        }
        await route.fulfill({ response });
      } catch {
        failure = true;
        await route.abort().catch(() => {});
      }
    });
    const page = await context.newPage();
    page.setDefaultTimeout(10000);
    page.on("pageerror", () => {
      failure = true;
    });
    page.on("download", () => {
      failure = true;
    });
    await page.goto(manifest.origin + "/", {
      waitUntil: "networkidle",
      timeout: 20000,
    });
    check(!failure);
    await page.getByRole("heading", { name: "Sign in", exact: true }).waitFor();
    await page.keyboard.press("Tab");
    check(
      await page
        .getByLabel("Email", { exact: true })
        .evaluate((el) => el === document.activeElement),
    );
    await page.getByLabel("Email", { exact: true }).fill(account.email);
    await page.keyboard.press("Tab");
    check(
      await page
        .getByLabel("Password", { exact: true })
        .evaluate((el) => el === document.activeElement),
    );
    await page.getByLabel("Password", { exact: true }).fill(password);
    await page.keyboard.press("Tab");
    check(
      await page
        .getByRole("button", { name: "Sign in", exact: true })
        .evaluate((el) => el === document.activeElement),
    );
    await page.keyboard.press("Enter");
    await page
      .getByText(/Device-only data/)
      .first()
      .waitFor();
    check(!failure && session && signins === 1);
    check(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth,
      ),
    );
    check(
      await page.evaluate(
        () =>
          !Object.keys(localStorage).some((k) => k.startsWith("sb-")) &&
          !Object.keys(sessionStorage).some((k) => k.startsWith("sb-")),
      ),
    );
    const loggedOut = page.waitForResponse(
      (r) => r.url() === manifest.provider + "/auth/v1/logout?scope=local",
    );
    await page.getByRole("button", { name: "Sign out", exact: true }).focus();
    await page.keyboard.press("Enter");
    check((await loggedOut).status() === 204);
    await page.getByRole("heading", { name: "Sign in", exact: true }).waitFor();
    check(!failure);
    session = null;
    // No screenshot of authenticated DOM, inputs, provider content or storage.
    return "ui-" + width;
  } finally {
    if (session)
      pending.push(() =>
        logout(makeTransport(oidc, budget), session, publishableKey),
      );
    pending.push(() => context.close());
    await cleanup(pending);
  }
}
// Suite orchestration will be wired only with an independently authenticated
// attribution adapter at both boundaries. Callers cannot provide boolean proof.
export async function runNative() {
  const { requireAttribution } = await import("./policy.mjs");
  requireAttribution();
}
