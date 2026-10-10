// Only code-defined values cross the error/report boundary. Raw exceptions and
// response objects are never attached to a diagnostic or serialized.
const failures = new WeakMap();
const stages = new Set([
  "root_request", "root_response", "root_body", "html_discovery",
  "bootstrap_request", "bootstrap_response", "bootstrap_body",
  "javascript_parse", "javascript_assets", "public_config_selection", "public_config_validation",
]);
const categories = new Set([
  "transport_unknown", "transport_timeout", "transport_aborted", "transport_dns",
  "transport_connection", "transport_tls", "http_response", "body_read", "validation",
  "javascript_parse",
]);
const types = new Set(["unknown", "missing", "html", "javascript", "json", "plain_text", "other"]);
const codes = new Set([
  "HTTP_STATUS", "HTTP_REDIRECT", "CONTENT_TYPE", "RESPONSE_INVALID",
  "BODY_MISSING", "BODY_READ", "BODY_UTF8", "BODY_LIMIT", "TEXT_INVALID",
  "MODULE_SOURCE_MISSING", "MODULE_COUNT", "ASSET_REFERENCE", "JS_PARSE",
  "CONFIG_READS", "CONFIG_LITERAL", "CONFIG_PROPERTIES", "CONFIG_MISSING",
  "CONFIG_AMBIGUOUS", "CONFIG_VALUES", "CONFIG_KEY_FORMAT", "CONFIG_KEY_AMBIGUOUS",
]);
export function validateAdmissionFailure(value) {
  if (!value || typeof value !== "object") return null;
  try {
    const names = ["stage", "category", "responseReceived", "status", "contentType", "validationCode"];
    const descriptors = Object.getOwnPropertyDescriptors(value);
    if (Reflect.ownKeys(descriptors).length !== names.length ||
        !names.every(k => Object.hasOwn(descriptors, k) && Object.hasOwn(descriptors[k], "value"))) return null;
    const v = Object.fromEntries(names.map(k => [k, descriptors[k].value]));
    if (!stages.has(v.stage) || !categories.has(v.category) || !types.has(v.contentType) ||
        typeof v.responseReceived !== "boolean" ||
        !(v.validationCode === null || codes.has(v.validationCode))) return null;
    if (v.responseReceived ? !(Number.isInteger(v.status) &&
        (v.status === 0 || v.status >= 100 && v.status <= 599)) :
        !(v.status === null && v.contentType === "unknown")) return null;
    if (v.category.startsWith("transport_") &&
        (v.validationCode !== null || v.responseReceived || !v.stage.endsWith("_request"))) return null;
    if (v.category === "http_response" && (!v.stage.endsWith("_response") ||
        !["HTTP_STATUS", "HTTP_REDIRECT", "CONTENT_TYPE", "RESPONSE_INVALID"].includes(v.validationCode) ||
        (!v.responseReceived && v.validationCode !== "RESPONSE_INVALID"))) return null;
    if (v.category === "body_read" && (!v.stage.endsWith("_body") || !v.responseReceived ||
        !["BODY_MISSING", "BODY_READ", "BODY_UTF8", "BODY_LIMIT"].includes(v.validationCode))) return null;
    if (v.category === "javascript_parse" &&
        (v.stage !== "javascript_parse" || v.validationCode !== "JS_PARSE")) return null;
    if (v.category === "validation" &&
        (v.stage.endsWith("_request") || v.stage.endsWith("_response") || v.stage.endsWith("_body"))) return null;
    return v;
  } catch { return null; }
}
export function admissionFailureFrom(error) {
  return validateAdmissionFailure(failures.get(error));
}
function transportCategory(error) {
  // Do not inspect messages, stacks, arbitrary names or redirect locations.
  // Undici's generic redirect rejection has no reliable fixed code: UNKNOWN.
  try {
    if (error instanceof DOMException) {
      if (error.name === "TimeoutError") return "transport_timeout";
      if (error.name === "AbortError") return "transport_aborted";
    }
    if (error instanceof Error) {
      const cause = Object.getOwnPropertyDescriptor(error, "cause")?.value;
      const code = Object.getOwnPropertyDescriptor(cause instanceof Error ? cause : error, "code")?.value;
      if (["ENOTFOUND", "EAI_AGAIN"].includes(code)) return "transport_dns";
      if (["ECONNREFUSED", "ECONNRESET", "UND_ERR_SOCKET"].includes(code)) return "transport_connection";
      if (["ETIMEDOUT", "UND_ERR_CONNECT_TIMEOUT", "UND_ERR_HEADERS_TIMEOUT", "UND_ERR_BODY_TIMEOUT"].includes(code)) return "transport_timeout";
      if (["CERT_HAS_EXPIRED", "DEPTH_ZERO_SELF_SIGNED_CERT", "ERR_TLS_CERT_ALTNAME_INVALID"].includes(code)) return "transport_tls";
    }
  } catch { /* Unknown, never copy an exception property. */ }
  return "transport_unknown";
}
export class AdmissionTrace {
  #stage = null;
  #category = "validation";
  #code = null;
  #response = {responseReceived:false, status:null, contentType:"unknown"};
  #first = null;
  enter(stage, category="validation", validationCode=null) {
    if (!stages.has(stage) || !categories.has(category) ||
        !(validationCode === null || codes.has(validationCode))) throw Error("C1_DIAGNOSTIC_SCHEMA_BLOCK");
    this.#stage = stage; this.#category = category; this.#code = validationCode;
    if (stage.endsWith("_request")) this.#response = {responseReceived:false, status:null, contentType:"unknown"};
  }
  response(response) {
    this.expect(response instanceof Response, "RESPONSE_INVALID", "http_response");
    this.#response = {responseReceived:true, status:response.status, contentType:"unknown"};
    const type = response.headers.get("content-type")?.split(";")[0].trim().toLowerCase();
    this.#response = {responseReceived:true, status:response.status,
      contentType:type === undefined ? "missing" : type === "text/html" ? "html" :
        ["application/javascript", "text/javascript"].includes(type) ? "javascript" :
        type === "application/json" ? "json" : type === "text/plain" ? "plain_text" : "other"};
  }
  expect(condition, code, category="validation") {
    if (!condition) throw this.capture(null, category, code);
  }
  capture(error, category=this.#category, code=this.#code) {
    if (this.#first) return this.#first;
    const known = admissionFailureFrom(error);
    if (!this.#stage && !known) return error;
    const diagnostic = known ?? validateAdmissionFailure({stage:this.#stage,
      category:category === "transport_unknown" ? transportCategory(error) : category,
      ...this.#response, validationCode:code});
    if (!diagnostic) return Error("C1_DIAGNOSTIC_SCHEMA_BLOCK");
    const safe = Error("C1_ADMISSION_BLOCK");
    failures.set(safe, Object.freeze(diagnostic)); this.#first = safe;
    return safe;
  }
  failure(error) { return admissionFailureFrom(this.#first ?? (this.#stage ? this.capture(error) : error)); }
  finish() { this.#stage = null; }
}
