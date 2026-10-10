import { parse } from "acorn";
import { AdmissionTrace } from "./admission-evidence.mjs";
import { createLocalJWKSet, jwtVerify } from "jose";
import {
  manifest,
  check,
  guardClaims,
  scopedHeaders,
  requestPolicy,
} from "./policy.mjs";
const readerTraces = new WeakMap();
export async function boundedText(response, limit, trace) {
  if (trace) trace.expect(response.body, "BODY_MISSING", "body_read");
  else check(response.body);
  const reader = response.body.getReader();
  let size = 0;
  const chunks = [];
  try {
    for (;;) {
      const { value, done } = await reader.read();
      if (done) break;
      size += value.byteLength;
      if (trace) trace.expect(size <= limit, "BODY_LIMIT", "body_read");
      else check(size <= limit);
      chunks.push(value);
    }
    const bytes = Buffer.concat(chunks);
    try {
      return new TextDecoder("utf-8", { fatal: true }).decode(bytes);
    } catch (error) {
      throw trace ? trace.capture(error, "body_read", "BODY_UTF8") : error;
    }
  } catch (error) {
    const failure = trace ? trace.capture(error) : error;
    await reader.cancel().catch(() => {});
    throw failure;
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
export function publicTextReader(oidc, budget, fetcher = fetch, trace = new AdmissionTrace()) {
  const getText = async (url, assets = new Set()) => {
    check(new URL(url).origin === manifest.origin);
    requestPolicy(url, "GET", false, assets);
    budget.take();
    const html = new URL(url).pathname === "/";
    const prefix = html ? "root" : "bootstrap";
    trace.enter(prefix + "_request", "transport_unknown");
    try {
      const r = await fetcher(url, {
        headers: scopedHeaders(url, oidc),
        redirect: "error",
        signal: AbortSignal.timeout(10000),
        cache: "no-store",
      });
      trace.enter(prefix + "_response", "http_response", "RESPONSE_INVALID");
      trace.response(r);
      trace.expect(r.status === 200, "HTTP_STATUS", "http_response");
      trace.expect(!r.redirected, "HTTP_REDIRECT", "http_response");
      trace.expect((html ? ["text/html"] : ["application/javascript", "text/javascript"])
        .includes(r.headers.get("content-type")?.split(";")[0]), "CONTENT_TYPE", "http_response");
      trace.enter(prefix + "_body", "body_read", "BODY_READ");
      return await boundedText(r, html ? 256 * 1024 : 5 * 1024 * 1024, trace);
    } catch (error) { throw trace.capture(error); }
  };
  readerTraces.set(getText, trace);
  return getText;
}
export async function readPublicConfig(getText, trace = readerTraces.get(getText) ?? new AdmissionTrace()) {
  try { return await publicConfigFromText(getText, trace); }
  catch (error) { throw trace.capture(error); }
  finally { trace.finish(); }
}
async function publicConfigFromText(getText, trace) {
  trace.enter("root_request", "transport_unknown");
  const html = await getText(manifest.origin + "/");
  trace.enter("html_discovery");
  trace.expect(typeof html === "string" && html.length <= 256 * 1024, "TEXT_INVALID");
  const modules = [];
  for (const tag of html.matchAll(/<script\b[^>]*>/gi)) {
    if (!/\btype\s*=\s*["']module["']/i.test(tag[0])) continue;
    const src = tag[0].match(/\bsrc\s*=\s*["']([^"']+)["']/i);
    trace.expect(src, "MODULE_SOURCE_MISSING");
    trace.enter("html_discovery", "validation", "ASSET_REFERENCE");
    const u = new URL(src[1], manifest.origin);
    trace.expect(
      u.origin === manifest.origin &&
        !u.username &&
        !u.password &&
        !u.search &&
        !u.hash &&
        /^\/assets\/[A-Za-z0-9_-]+\.js$/.test(u.pathname),
      "ASSET_REFERENCE",
    );
    modules.push(u.href);
  }
  trace.expect(modules.length === 1, "MODULE_COUNT");
  const assets = new Set(modules.map((u) => new URL(u).pathname));
  // Only literal same-origin static URLs discovered before credentials are allowed.
  for (const tag of html.matchAll(/<(?:link|script)\b[^>]*>/gi)) {
    const match = tag[0].match(/\b(?:href|src)\s*=\s*["']([^"']+)["']/i);
    if (!match) continue;
    trace.enter("html_discovery", "validation", "ASSET_REFERENCE");
    const u = new URL(match[1], manifest.origin);
    trace.expect(
      u.origin === manifest.origin &&
        !u.search &&
        !u.hash &&
        /^\/assets\/[A-Za-z0-9_-]+\.(js|css)$/.test(u.pathname),
      "ASSET_REFERENCE",
    );
    assets.add(u.pathname);
  }
  trace.enter("bootstrap_request", "transport_unknown");
  const text = await getText(modules[0], assets);
  trace.enter("javascript_parse", "javascript_parse", "JS_PARSE");
  trace.expect(typeof text === "string" && text.length <= 5 * 1024 * 1024, "TEXT_INVALID");
  const ast = parse(text, { ecmaVersion: "latest", sourceType: "module" });
  trace.enter("public_config_selection");
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
            trace.expect(required.every((k) => reads.has(k)), "CONFIG_READS");
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
    trace.expect(false, "CONFIG_LITERAL");
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
        trace.expect(
          names.every((n) => typeof n === "string") &&
            new Set(names).size === names.length,
          "CONFIG_PROPERTIES",
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
      trace.expect(/^sb_publishable_[A-Za-z0-9_-]{1,256}$/.test(node.value), "CONFIG_KEY_FORMAT");
    if (node.type === "ImportDeclaration" || node.type === "ImportExpression") {
      trace.enter("javascript_assets", "validation", "ASSET_REFERENCE");
      const path = literal(node.source);
      const u = new URL(path, modules[0]);
      trace.expect(
        u.origin === manifest.origin &&
          !u.search &&
          !u.hash &&
          /^\/assets\/[A-Za-z0-9_-]+\.js$/.test(u.pathname),
        "ASSET_REFERENCE",
      );
      trace.enter("public_config_selection");
      assets.add(u.pathname);
    }
    for (const value of Object.values(node))
      if (Array.isArray(value)) value.forEach(walk);
      else if (value && typeof value === "object") walk(value);
  }
  walk(ast);
  trace.enter("public_config_selection");
  trace.expect(candidates.length > 0, "CONFIG_MISSING");
  const selected = candidates[0];
  trace.expect(
    candidates.every((c) => JSON.stringify(c) === JSON.stringify(selected)),
    "CONFIG_AMBIGUOUS",
  );
  trace.enter("public_config_validation");
  trace.expect(
    selected.VITE_SUPABASE_URL === manifest.provider &&
      selected.VITE_LIFE_RHYTHM_AUTH_ENABLED === "true" &&
      selected.VITE_LIFE_RHYTHM_MODE === "required" &&
      /^sb_publishable_[A-Za-z0-9_-]{1,256}$/.test(
        selected.VITE_SUPABASE_PUBLISHABLE_KEY,
      ),
    "CONFIG_VALUES",
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
  trace.expect(
    publicKeys.size === 1 &&
      publicKeys.has(selected.VITE_SUPABASE_PUBLISHABLE_KEY),
    "CONFIG_KEY_AMBIGUOUS",
  );
  return {
    publishableKey: selected.VITE_SUPABASE_PUBLISHABLE_KEY,
    provider: manifest.provider,
    assets,
  };
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
// Supervision replaces the unprovisioned external signing endpoint. The only
// reader is GitHub's authenticated run/approval/comment APIs.
import { verifyNativeObservation } from "./supervision.mjs";
import { githubGet } from "./preflight.mjs";
export async function verifyAttribution(env, config, phase = "pre", get = githubGet, target = manifest) {
  check(phase === "pre");
  return verifyNativeObservation(env, config, get, target);
}
