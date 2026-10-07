import { parse } from "acorn";
import { randomBytes } from "node:crypto";
import { createLocalJWKSet, importJWK, jwtVerify } from "jose";
import {
  manifest,
  check,
  guardClaims,
  scopedHeaders,
  requestPolicy,
} from "./policy.mjs";
export async function boundedText(response, limit) {
  check(response.body);
  const reader = response.body.getReader();
  let size = 0;
  const chunks = [];
  try {
    for (;;) {
      const { value, done } = await reader.read();
      if (done) break;
      size += value.byteLength;
      check(size <= limit);
      chunks.push(value);
    }
    return new TextDecoder("utf-8", { fatal: true }).decode(
      Buffer.concat(chunks),
    );
  } catch (error) {
    await reader.cancel().catch(() => {});
    throw error;
  } finally {
    reader.releaseLock();
  }
}
async function jsonRequest(url, init, fetcher, limit = 65536) {
  const response = await fetcher(url, {
    ...init,
    redirect: "error",
    signal: AbortSignal.timeout(10000),
    cache: "no-store",
  });
  check(
    response.status === 200 &&
      !response.redirected &&
      response.headers.get("content-type")?.split(";")[0] ===
        "application/json",
  );
  return JSON.parse(await boundedText(response, limit));
}
export function publicTextReader(oidc, budget, fetcher = fetch) {
  return async (url, assets = new Set()) => {
    check(new URL(url).origin === manifest.origin);
    requestPolicy(url, "GET", false, assets);
    budget.take();
    const r = await fetcher(url, {
      headers: scopedHeaders(url, oidc),
      redirect: "error",
      signal: AbortSignal.timeout(10000),
      cache: "no-store",
    });
    check(r.status === 200 && !r.redirected);
    const html = new URL(url).pathname === "/";
    check(
      (html
        ? ["text/html"]
        : ["application/javascript", "text/javascript"]
      ).includes(r.headers.get("content-type")?.split(";")[0]),
    );
    return boundedText(r, html ? 256 * 1024 : 5 * 1024 * 1024);
  };
}
export async function readPublicConfig(getText) {
  const html = await getText(manifest.origin + "/");
  check(typeof html === "string" && html.length <= 256 * 1024);
  const modules = [];
  for (const tag of html.matchAll(/<script\b[^>]*>/gi)) {
    if (!/\btype\s*=\s*["']module["']/i.test(tag[0])) continue;
    const src = tag[0].match(/\bsrc\s*=\s*["']([^"']+)["']/i);
    check(src);
    const u = new URL(src[1], manifest.origin);
    check(
      u.origin === manifest.origin &&
        !u.username &&
        !u.password &&
        !u.search &&
        !u.hash &&
        /^\/assets\/[A-Za-z0-9_-]+\.js$/.test(u.pathname),
    );
    modules.push(u.href);
  }
  check(modules.length === 1);
  const assets = new Set(modules.map((u) => new URL(u).pathname));
  // Only literal same-origin static URLs discovered before credentials are allowed.
  for (const tag of html.matchAll(/<(?:link|script)\b[^>]*>/gi)) {
    const match = tag[0].match(/\b(?:href|src)\s*=\s*["']([^"']+)["']/i);
    if (!match) continue;
    const u = new URL(match[1], manifest.origin);
    check(
      u.origin === manifest.origin &&
        !u.search &&
        !u.hash &&
        /^\/assets\/[A-Za-z0-9_-]+\.(js|css)$/.test(u.pathname),
    );
    assets.add(u.pathname);
  }
  const text = await getText(modules[0], assets);
  check(typeof text === "string" && text.length <= 5 * 1024 * 1024);
  const ast = parse(text, { ecmaVersion: "latest", sourceType: "module" });
  const candidates = [],
    effectiveObjects = new Set();
  const required = [
    "VITE_SUPABASE_URL",
    "VITE_SUPABASE_PUBLISHABLE_KEY",
    "VITE_LIFE_RHYTHM_AUTH_ENABLED",
    "VITE_LIFE_RHYTHM_MODE",
  ];
  function effective(node) {
    if (!node || typeof node !== "object") return;
    if (
      [
        "FunctionDeclaration",
        "FunctionExpression",
        "ArrowFunctionExpression",
      ].includes(node.type)
    ) {
      for (const param of node.params)
        if (
          param.type === "AssignmentPattern" &&
          param.left.type === "Identifier" &&
          param.right.type === "ObjectExpression"
        ) {
          const names = param.right.properties.map(
            (p) => p.key?.name ?? p.key?.value,
          );
          if (required.every((k) => names.includes(k))) {
            const reads = new Set();
            function findRead(n) {
              if (!n || typeof n !== "object") return;
              if (
                n.type === "MemberExpression" &&
                n.object.type === "Identifier" &&
                n.object.name === param.left.name &&
                !n.computed
              )
                reads.add(n.property.name);
              for (const v of Object.values(n))
                if (Array.isArray(v)) v.forEach(findRead);
                else if (v && typeof v === "object") findRead(v);
            }
            findRead(node.body);
            check(required.every((k) => reads.has(k)));
            effectiveObjects.add(param.right);
          }
        }
    }
    for (const v of Object.values(node))
      if (Array.isArray(v)) v.forEach(effective);
      else if (v && typeof v === "object") effective(v);
  }
  effective(ast);
  function literal(node) {
    if (node.type === "Literal" && typeof node.value === "string")
      return node.value;
    if (node.type === "TemplateLiteral" && node.expressions.length === 0)
      return node.quasis[0].value.cooked;
    check(false);
  }
  function walk(node) {
    if (!node || typeof node !== "object") return;
    if (node.type === "ObjectExpression") {
      const properties = node.properties;
      const names = properties.map((p) =>
        p.type === "Property" && !p.computed
          ? (p.key.name ?? p.key.value)
          : null,
      );
      if (effectiveObjects.has(node)) {
        check(
          names.every((n) => typeof n === "string") &&
            new Set(names).size === names.length,
        );
        const selected = {};
        for (const p of properties) {
          const name = p.key.name ?? p.key.value;
          if (
            [
              "VITE_SUPABASE_URL",
              "VITE_SUPABASE_PUBLISHABLE_KEY",
              "VITE_LIFE_RHYTHM_AUTH_ENABLED",
              "VITE_LIFE_RHYTHM_MODE",
            ].includes(name)
          )
            selected[name] = literal(p.value);
        }
        candidates.push(selected);
      }
    }
    // A second executable public-key constant is ambiguous, even if unused.
    if (
      node.type === "Literal" &&
      typeof node.value === "string" &&
      /^sb_publishable_/.test(node.value)
    )
      check(/^sb_publishable_[A-Za-z0-9_-]{1,256}$/.test(node.value));
    if (node.type === "ImportDeclaration" || node.type === "ImportExpression") {
      const path = literal(node.source);
      const u = new URL(path, modules[0]);
      check(
        u.origin === manifest.origin &&
          !u.search &&
          !u.hash &&
          /^\/assets\/[A-Za-z0-9_-]+\.js$/.test(u.pathname),
      );
      assets.add(u.pathname);
    }
    for (const value of Object.values(node))
      if (Array.isArray(value)) value.forEach(walk);
      else if (value && typeof value === "object") walk(value);
  }
  walk(ast);
  check(candidates.length > 0);
  const selected = candidates[0];
  check(
    candidates.every((c) => JSON.stringify(c) === JSON.stringify(selected)),
  );
  check(
    selected.VITE_SUPABASE_URL === manifest.provider &&
      selected.VITE_LIFE_RHYTHM_AUTH_ENABLED === "true" &&
      selected.VITE_LIFE_RHYTHM_MODE === "required" &&
      /^sb_publishable_[A-Za-z0-9_-]{1,256}$/.test(
        selected.VITE_SUPABASE_PUBLISHABLE_KEY,
      ),
  );
  // Reject executable decoy keys/URLs outside the config; comments do not count.
  const publicKeys = new Set();
  function constants(node) {
    if (!node || typeof node !== "object") return;
    if (
      node.type === "Literal" &&
      typeof node.value === "string" &&
      /^sb_(publishable|secret)_.+/.test(node.value)
    )
      publicKeys.add(node.value);
    if (
      node.type === "TemplateLiteral" &&
      node.expressions.length === 0 &&
      /^sb_(publishable|secret)_.+/.test(node.quasis[0].value.cooked)
    )
      publicKeys.add(node.quasis[0].value.cooked);
    for (const v of Object.values(node))
      if (Array.isArray(v)) v.forEach(constants);
      else if (v && typeof v === "object") constants(v);
  }
  constants(ast);
  check(
    publicKeys.size === 1 &&
      publicKeys.has(selected.VITE_SUPABASE_PUBLISHABLE_KEY),
  );
  return {
    publishableKey: selected.VITE_SUPABASE_PUBLISHABLE_KEY,
    provider: manifest.provider,
    assets,
  };
}
// Credential entry requires a separately approved immutable deployment URL.
// The current branch alias is deliberately blocked, even if a signer is enabled.
export function credentialOrigin(config, immutableOrigin) {
  check(
    config?.immutableOriginApproved === true &&
      typeof config.immutableOrigin === "string",
  );
  check(
    immutableOrigin === config.immutableOrigin &&
      immutableOrigin === manifest.origin,
  );
  const u = new URL(immutableOrigin);
  check(
    u.protocol === "https:" &&
      u.origin === immutableOrigin &&
      !u.username &&
      !u.password &&
      !u.port &&
      u.hostname.endsWith(".vercel.app") &&
      !u.hostname.includes("-git-") &&
      u.hostname !== "life-rhythm-prototype.vercel.app",
  );
}
export async function issueOidc(env, sha, fetcher = fetch) {
  const u = new URL(env.ACTIONS_ID_TOKEN_REQUEST_URL);
  check(
    u.protocol === "https:" &&
      !u.username &&
      !u.password &&
      !u.hash &&
      !u.port &&
      u.hostname.endsWith(".actions.githubusercontent.com"),
  );
  check(
    typeof env.ACTIONS_ID_TOKEN_REQUEST_TOKEN === "string" &&
      env.ACTIONS_ID_TOKEN_REQUEST_TOKEN.length > 0,
  );
  u.searchParams.set("audience", "https://github.com/dezrobbo1");
  const issued = await jsonRequest(
    u.href,
    {
      headers: {
        Authorization: "Bearer " + env.ACTIONS_ID_TOKEN_REQUEST_TOKEN,
        Accept: "application/json",
      },
    },
    fetcher,
    16384,
  );
  check(
    Object.keys(issued).every((name) => ["value", "count"].includes(name)) &&
      (issued.count === undefined || issued.count === 1) &&
      typeof issued.value === "string" &&
      issued.value.length <= 8192,
  );
  const issuer = "https://token.actions.githubusercontent.com";
  const discovery = await jsonRequest(
    issuer + "/.well-known/openid-configuration",
    { headers: { Accept: "application/json" } },
    fetcher,
  );
  check(discovery.jwks_uri === issuer + "/.well-known/jwks");
  const jwks = await jsonRequest(
    discovery.jwks_uri,
    { headers: { Accept: "application/json" } },
    fetcher,
  );
  check(
    Array.isArray(jwks.keys) && jwks.keys.length > 0 && jwks.keys.length <= 20,
  );
  const { payload } = await jwtVerify(issued.value, createLocalJWKSet(jwks), {
    issuer,
    audience: "https://github.com/dezrobbo1",
    algorithms: ["RS256"],
    clockTolerance: 0,
  });
  guardClaims(payload, sha);
  check(
    payload.run_id === env.GITHUB_RUN_ID &&
      payload.run_attempt === env.GITHUB_RUN_ATTEMPT &&
      env.GITHUB_RUN_ATTEMPT === "1",
  );
  check(
    Number.isInteger(payload.iat) &&
      payload.iat <= Date.now() / 1000 + 2 &&
      payload.iat > Date.now() / 1000 - 60,
  );
  return issued.value;
}
function attributionConfig(config) {
  check(config?.enabled === true);
  const u = new URL(config.endpoint);
  check(
    u.protocol === "https:" &&
      !u.username &&
      !u.password &&
      !u.search &&
      !u.hash &&
      !u.port,
  );
  check(
    config.publicJwk?.kty === "OKP" &&
      config.publicJwk.crv === "Ed25519" &&
      typeof config.publicJwk.x === "string" &&
      !config.publicJwk.d,
  );
}
export async function verifyAssertion(assertion, config, phase, nonce) {
  attributionConfig(config);
  check(
    ["start", "end"].includes(phase) &&
      /^[A-Za-z0-9_-]{64}$/.test(nonce) &&
      typeof assertion === "string" &&
      assertion.length <= 16384,
  );
  const { payload } = await jwtVerify(
    assertion,
    await importJWK(config.publicJwk, "EdDSA"),
    {
      issuer: config.endpoint,
      audience: manifest.repository,
      algorithms: ["EdDSA"],
      clockTolerance: 0,
    },
  );
  const expected = {
    format: 1,
    phase,
    nonce,
    repository: manifest.repository,
    source: manifest.source,
    deployment: manifest.deployment,
    project: manifest.project,
    team: manifest.team,
    origin: manifest.origin,
    immutableOrigin: manifest.origin,
    environment: "preview",
    state: "READY",
  };
  const allowed = [
    ...Object.keys(expected),
    "observedAt",
    "iss",
    "aud",
    "iat",
    "exp",
  ];
  check(Object.keys(payload).sort().join() === allowed.sort().join());
  for (const [k, v] of Object.entries(expected)) check(payload[k] === v);
  const now = Math.floor(Date.now() / 1000);
  check(
    Number.isInteger(payload.observedAt) &&
      payload.observedAt <= now + 2 &&
      payload.observedAt >= now - 30,
  );
  check(
    Number.isInteger(payload.iat) &&
      payload.iat <= now + 2 &&
      payload.iat >= now - 30 &&
      Number.isInteger(payload.exp) &&
      payload.exp > now &&
      payload.exp <= now + 60,
  );
  return { phase, verified: true, immutableOrigin: payload.immutableOrigin };
}
export async function verifyAttribution(config, phase, fetcher = fetch) {
  attributionConfig(config);
  credentialOrigin(config, config.immutableOrigin);
  const nonce = randomBytes(48).toString("base64url");
  const u = new URL(config.endpoint);
  u.searchParams.set("phase", phase);
  u.searchParams.set("nonce", nonce);
  // No passwords, GitHub/OIDC tokens, Supabase key/session, cookies or caller
  // credential goes to the proposed public signing verifier endpoint.
  const body = await jsonRequest(
    u.href,
    { headers: { Accept: "application/json" } },
    fetcher,
    32768,
  );
  check(Object.keys(body).length === 1);
  const observed = await verifyAssertion(body.assertion, config, phase, nonce);
  credentialOrigin(config, observed.immutableOrigin);
  return observed;
}
