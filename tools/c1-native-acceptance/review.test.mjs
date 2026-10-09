import { test } from "node:test";
import assert from "node:assert/strict";
import { manifest, Budget, requestPolicy, scopedHeaders } from "./policy.mjs";
import { metadataCases, runMetadata, browserRow } from "./native.mjs";
import { readPublicConfig } from "./admission.mjs";
import { generateKeyPair, SignJWT } from "jose";
const generation = "22222222-2222-4222-8222-222222222222";
test("stale generation is valid and unequal even when fixture generation is the old sentinel", () => {
  const cases = metadataCases(manifest.accounts[1], generation);
  const ok = cases.find(
    (c) => c.status === 200 && c.path.includes("expectedGeneration"),
  );
  const conflict = cases.find(
    (c) => c.status === 409 && c.path.includes("expectedRevision=42"),
  );
  assert.notEqual(conflict.path, ok.path);
});
test("hostile credential URLs, paths and extra auth query keys fail before fetch", () => {
  for (const [u, m] of [
    [manifest.origin + "/?password=SYNTHETIC_PASSWORD", "GET"],
    [manifest.origin + "/unexpected", "GET"],
    [manifest.origin + "/assets/SYNTHETIC_PASSWORD.js", "GET"],
    [manifest.provider + "/auth/v1/user?password=SYNTHETIC_PASSWORD", "GET"],
    [
      manifest.provider + "/auth/v1/token?grant_type=password&token=secret",
      "POST",
    ],
    [
      manifest.provider + "/rest/v1/trial_access?select=*&password=secret",
      "GET",
    ],
  ])
    assert.throws(() => requestPolicy(u, m));
});
test("caller cookie, arbitrary header and misplaced authorization never forward", () => {
  const h = scopedHeaders(manifest.origin + "/", "oidc", {
    Cookie: "secret",
    "X-Secret": "secret",
    Authorization: "Bearer secret",
    Accept: "text/html",
  });
  assert(
    !Object.keys(h).some((k) =>
      ["cookie", "x-secret", "authorization"].includes(k.toLowerCase()),
    ),
  );
});
const configJs = (flag = "`true`", mode = "`required`") =>
  "function config(env={VITE_SUPABASE_URL:`" +
  manifest.provider +
  "`,VITE_SUPABASE_PUBLISHABLE_KEY:`sb_publishable_synthetic`,VITE_LIFE_RHYTHM_AUTH_ENABLED:" +
  flag +
  ",VITE_LIFE_RHYTHM_MODE:" +
  mode +
  "}){return [env.VITE_SUPABASE_URL,env.VITE_SUPABASE_PUBLISHABLE_KEY,env.VITE_LIFE_RHYTHM_AUTH_ENABLED,env.VITE_LIFE_RHYTHM_MODE]}";
const textReader = (source) => async (u) =>
  new URL(u).pathname === "/"
    ? '<script type="module" src="/assets/index-reviewed.js"></script>'
    : source;
test("Vite backtick config is supported without execution", async () => {
  assert.equal(
    (await readPublicConfig(textReader(configJs()))).publishableKey,
    "sb_publishable_synthetic",
  );
});
test("comment decoys do not override effective disabled/local config", async () => {
  await assert.rejects(
    readPublicConfig(
      textReader(
        '/* VITE_LIFE_RHYTHM_AUTH_ENABLED:"true",VITE_LIFE_RHYTHM_MODE:"required" */' +
          configJs('"false"', '"local-fixture"'),
      ),
    ),
  );
});
async function fixture({
  withBoundary = true,
  logoutStatus = 204,
  wrongPassword = false,
  hostileUrl = null,
  extraBody = false,
  captcha = false,
} = {}) {
  const a = manifest.accounts[0],
    head = { revision: a.revision, generation };
  const keys = await generateKeyPair("ES256");
  const token = await new SignJWT({
    role: "authenticated",
    session_id: "11111111-1111-4111-8111-111111111111",
  })
    .setProtectedHeader({ alg: "ES256" })
    .setIssuer(manifest.provider + "/auth/v1")
    .setAudience("authenticated")
    .setSubject(a.uuid)
    .setExpirationTime("5m")
    .sign(keys.privateKey);
  const session = {
    access_token: token,
    refresh_token: "synthetic-refresh",
    user: { id: a.uuid },
  };
  let routeHandler,
    enters = 0,
    closed = false,
    forwarded = 0;
  const request = async (
    url,
    method,
    body,
    reply,
    status = 200,
    headers = {},
  ) =>
    routeHandler({
      request: () => ({
        url: () => url,
        method: () => method,
        redirectedFrom: () => null,
        headers: () => headers,
        postDataJSON: () => body,
        postData: () => (body ? JSON.stringify(body) : null),
      }),
      fetch: async () => {
        forwarded++;
        return {
          status: () => status,
          json: async () => reply,
          headers: () => ({
            "content-type": "application/json",
            "cache-control": "no-store",
          }),
        };
      },
      fulfill: async () => {},
      abort: async () => {},
    });
  const locator = {
    waitFor: async () => {},
    evaluate: async () => true,
    fill: async () => {},
    focus: async () => {},
    first() {
      return this;
    },
  };
  const page = {
    setDefaultTimeout() {},
    on() {},
    goto: async () => {},
    getByRole: () => locator,
    getByLabel: () => locator,
    getByText: () => locator,
    evaluate: async () => true,
    waitForResponse: async () => ({ status: () => logoutStatus }),
    keyboard: {
      press: async (key) => {
        if (key !== "Enter") return;
        enters++;
        if (enters === 1) {
          if (hostileUrl) await request(hostileUrl, "GET", null, {});
          await request(
            manifest.provider + "/auth/v1/token?grant_type=password",
            "POST",
            {
              email: a.email,
              password: wrongPassword ? "WRONG_SECRET" : "synthetic-password",
              ...(extraBody ? { secret: "SYNTHETIC_SECRET" } : {}),
              ...(captcha
                ? {
                    gotrue_meta_security: {
                      captcha_token: "SYNTHETIC_CAPTCHA",
                    },
                  }
                : {}),
            },
            session,
            200,
            {
              apikey: "sb_publishable_synthetic",
              "content-type": "application/json",
            },
          );
          if (withBoundary)
            await request(
              manifest.origin +
                "/api/account/boundary?protocolVersion=1&schemaVersion=1",
              "GET",
              null,
              {
                kind: "ready",
                protocolVersion: 1,
                schemaVersion: 1,
                buildId: manifest.source,
                head,
              },
              200,
              { Authorization: "Bearer " + token, Origin: manifest.origin },
            );
        } else
          await request(
            manifest.provider + "/auth/v1/logout?scope=local",
            "POST",
            null,
            null,
            logoutStatus,
            {
              apikey: "sb_publishable_synthetic",
              Authorization: "Bearer " + token,
            },
          );
      },
    },
  };
  const browser = {
    newContext: async () => ({
      routeWebSocket: async () => {},
      route: async (p, h) => {
        routeHandler = h;
      },
      newPage: async () => page,
      close: async () => {
        closed = true;
      },
    }),
  };
  return {
    run: () =>
      browserRow(
        browser,
        390,
        a,
        "synthetic-password",
        "oidc",
        new Budget(),
        keys.publicKey,
        "sb_publishable_synthetic",
        head,
      ),
    closed: () => closed,
    forwarded: () => forwarded,
  };
}
test("a signed login and visible ordinary UI without any boundary request cannot pass", async () => {
  const f = await fixture({ withBoundary: false });
  const original = globalThis.fetch;
  globalThis.fetch = async () => new Response(null, { status: 204 });
  try {
    await assert.rejects(f.run());
    assert(f.closed());
  } finally {
    globalThis.fetch = original;
  }
});
test("browser auth body with correct email but wrong password is stopped before credential submission", async () => {
  const f = await fixture({ wrongPassword: true });
  const original = globalThis.fetch;
  globalThis.fetch = async () => new Response(null, { status: 204 });
  try {
    await assert.rejects(f.run());
    assert.equal(f.forwarded(), 0);
  } finally {
    globalThis.fetch = original;
  }
});
test("failed UI logout is followed by bounded local revocation and never becomes PASS", async () => {
  const f = await fixture({ logoutStatus: 500 });
  let cleanupCalls = 0;
  const original = globalThis.fetch;
  globalThis.fetch = async (u) => {
    assert.equal(u, manifest.provider + "/auth/v1/logout?scope=local");
    cleanupCalls++;
    return new Response(null, { status: 204 });
  };
  try {
    await assert.rejects(f.run());
    assert.equal(cleanupCalls, 1);
    assert(f.closed());
  } finally {
    globalThis.fetch = original;
  }
});
test("provider isolation checks direct own and cross heads; leaking cross heads fails closed", async () => {
  const a = manifest.accounts[0],
    seen = new Set();
  const tx = async (u) => {
    const url = new URL(u);
    seen.add(url.pathname + ":" + url.searchParams.get("subject"));
    return {
      response: new Response("{}"),
      body: [
        {
          subject: a.uuid,
          protocol_version: 1,
          canonical_schema_version: 1,
          revision: a.revision,
          generation,
        },
      ],
    };
  };
  await assert.rejects(
    runMetadata(tx, a, "synthetic", "sb_publishable_synthetic"),
  );
  assert(seen.has("/rest/v1/account_heads:eq." + a.uuid));
  assert(seen.has("/rest/v1/account_heads:eq." + manifest.accounts[1].uuid));
});
test("actual PR180 production Vite default config with synthetic public values parses without execution", async () => {
  const { readFile } = await import("node:fs/promises");
  const source = await readFile(
    new URL("./fixtures/pr180-production-config.js", import.meta.url),
    "utf8",
  );
  assert.equal(
    (await readPublicConfig(textReader(source))).publishableKey,
    "sb_publishable_synthetic",
  );
  for (const changed of [
    source.replace("AUTH_ENABLED:`true`", "AUTH_ENABLED:`false`"),
    source.replace("MODE:`required`", "MODE:`local-fixture`"),
  ])
    await assert.rejects(readPublicConfig(textReader(changed)));
});

test("hostile page requests and extra Auth/CAPTCHA fields abort before any forwarding", async () => {
  for (const options of [
    { hostileUrl: manifest.origin + "/?password=SYNTHETIC_PASSWORD" },
    {
      hostileUrl:
        manifest.provider + "/auth/v1/user?password=SYNTHETIC_PASSWORD",
    },
    { extraBody: true },
    { captcha: true },
  ]) {
    const f = await fixture(options);
    await assert.rejects(f.run());
    assert.equal(f.forwarded(), 0);
    assert(f.closed());
  }
});
test("token endpoints never forward caller Authorization, cookies or arbitrary header values", () => {
  const h = scopedHeaders(
    manifest.provider + "/auth/v1/token?grant_type=password",
    "oidc",
    {
      apikey: "sb_publishable_synthetic",
      Authorization: "SYNTHETIC_SECRET",
      Cookie: "SYNTHETIC_SECRET",
      "X-Whatever": "SYNTHETIC_SECRET",
    },
  );
  assert(!JSON.stringify(h).includes("SYNTHETIC_SECRET"));
  assert.equal(h.apikey, "sb_publishable_synthetic");
});
test("dynamic/spread/duplicate config and unused decoy object cannot substitute effective config", async () => {
  for (const source of [
    configJs("someVariable"),
    configJs().replace(
      "VITE_LIFE_RHYTHM_MODE:",
      "...dynamic,VITE_LIFE_RHYTHM_MODE:",
    ),
    configJs().replace(
      "VITE_LIFE_RHYTHM_MODE:",
      "VITE_LIFE_RHYTHM_MODE:`local-fixture`,VITE_LIFE_RHYTHM_MODE:",
    ),
    "const decoy={VITE_LIFE_RHYTHM_AUTH_ENABLED:`true`,VITE_LIFE_RHYTHM_MODE:`required`,VITE_SUPABASE_PUBLISHABLE_KEY:`sb_publishable_synthetic`,VITE_SUPABASE_URL:`" +
      manifest.provider +
      "`};" +
      configJs("`false`", "`local-fixture`"),
  ])
    await assert.rejects(readPublicConfig(textReader(source)));
});
test("validated signed session plus authenticated boundary permits synthetic UI row and confirms cleanup", async () => {
  const f = await fixture();
  assert.equal(await f.run(), "ui-390");
  assert(f.closed());
  assert.equal(f.forwarded(), 3);
});
test("failed UI and fallback logout cannot report completion while context still closes", async () => {
  const f = await fixture({ logoutStatus: 500 });
  let attempts = 0;
  const saved = globalThis.fetch;
  globalThis.fetch = async () => {
    attempts++;
    return Response.json({ kind: "synthetic-failure" }, { status: 503 });
  };
  try {
    await assert.rejects(f.run());
    assert.equal(attempts, 1);
    assert(f.closed());
  } finally {
    globalThis.fetch = saved;
  }
});
