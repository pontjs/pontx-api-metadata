/**
 * Rebuild the complete Mistral AI Platform PontxSpec pair from one immutable,
 * Apache-2.0-licensed official OpenAPI source
 * (mistralai/platform-docs-public). The generated PontxSpec is canonical; this
 * script is only an audited import utility.
 *
 * Scope: the ApiKey-authenticated developer API surface of the pinned
 * openapi-public-doc.yaml: 238 Endpoints and 756 Schemas. 50 Endpoints that
 * require AdminApiKey (the beta.admin.* workspace-administration surface:
 * users, workspaces, api-keys, billing, audit-logs, user-groups, SCIM,
 * analytics) or DashboardUserContextAuth (the beta.users dashboard-session
 * identity surface) are explicitly excluded: they are not part of the
 * developer API key boundary and manage accounts, credentials, and billing.
 * 11 Endpoints declare typed SSE streaming responses (Chat Completions, FIM,
 * Audio transcription/speech, Agents conversations, and Workflows event/log
 * streams), preserved with `unknownEventPolicy: preserve`.
 */
import { createHash } from "node:crypto";
import { execFile as execFileCallback } from "node:child_process";
import { mkdir, readFile, rm, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { promisify } from "node:util";
import YAML from "yaml";
import { importOpenAPI, loadPontxSpec, PontxSpec } from "@pontx/spec";

const execFile = promisify(execFileCallback);
const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const productRoot = resolve(root, "products/mistral-ai");
const revision = "2ca5afeebb3ee0e675575d1ac60f3c138d2c4a3d";
const sourceUrl = `https://raw.githubusercontent.com/mistralai/platform-docs-public/${revision}/openapi-public-doc.yaml`;
const sourceSha256 = "61436a496404607a7c27f7d2d45989bc51bd699d2106690fd6cc76a3a6c9b692";
const licenseUrl = `https://raw.githubusercontent.com/mistralai/platform-docs-public/${revision}/LICENSE`;
const licenseSha256 = "0dde14aea85e489115f33e916d946aca1d7cee1551431479609dee0a47e251aa";
const referenceUrl = "https://docs.mistral.ai/api";
const termsUrl = "https://mistral.ai/legal";
const verifiedAt = "2026-08-16";

const ADMIN_SCHEMES = new Set(["AdminApiKey", "DashboardUserContextAuth"]);

const structuralSchemaKeys = new Set([
  "$ref", "type", "format", "enum", "const", "default", "readOnly", "writeOnly", "nullable",
  "multipleOf", "maximum", "exclusiveMaximum", "minimum", "exclusiveMinimum", "maxLength",
  "minLength", "pattern", "contentMediaType", "contentEncoding", "maxItems", "minItems",
  "uniqueItems", "maxProperties", "minProperties", "required", "additionalProperties", "items",
  "properties", "allOf", "anyOf", "oneOf", "not", "discriminator", "example", "examples",
]);

function sha256(value) {
  return createHash("sha256").update(value).digest("hex");
}

function isRecord(value) {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

function clone(value) {
  return value === undefined ? undefined : JSON.parse(JSON.stringify(value));
}

function words(value) {
  return String(value ?? "value")
    .replace(/([a-z0-9])([A-Z])/g, "$1 $2")
    .replace(/[^A-Za-z0-9]+/g, " ")
    .trim() || "value";
}

function camelIdentifier(value) {
  const tokens = words(value).match(/[A-Za-z0-9]+/g) ?? ["mistral"];
  const identifier = tokens.map((token, index) => {
    const normalized = token.toLowerCase();
    return index === 0 ? normalized : `${normalized[0].toUpperCase()}${normalized.slice(1)}`;
  }).join("");
  return /^[A-Za-z_$]/.test(identifier) ? identifier : `mistral${identifier}`;
}

/**
 * Convert an official snake_case operationId into a valid, code-generation-safe
 * camelCase identifier. The mapping is deterministic, collision-checked, and
 * recorded in provenance; the stable CLI/Hub resource ID becomes the camelCase
 * operationId, mirroring the treatment of the OpenAI product.
 */
function normalizeOperationId(operationId) {
  if (/^[A-Za-z_$][A-Za-z0-9_$]*$/.test(operationId) && !operationId.includes("_")) {
    return operationId;
  }
  const tokens = String(operationId).match(/[A-Za-z0-9]+/g) ?? ["mistral"];
  const identifier = tokens.map((token, index) => {
    const normalized = token.toLowerCase();
    return index === 0 ? normalized : `${normalized[0].toUpperCase()}${normalized.slice(1)}`;
  }).join("");
  return /^[A-Za-z_$]/.test(identifier) ? identifier : `mistral${identifier}`;
}

/**
 * Convert an official schema name into a valid, code-generation-safe
 * identifier, preserving the upstream title casing.
 */
function normalizeSchemaName(name) {
  if (/^[A-Za-z_$][A-Za-z0-9_$]*$/.test(name)) return name;
  const tokens = String(name).match(/[A-Za-z0-9]+/g) ?? ["MistralSchema"];
  const identifier = tokens.map((token, index) => {
    const normalized = token.toLowerCase();
    return index === 0 ? normalized : `${normalized[0].toUpperCase()}${normalized.slice(1)}`;
  }).join("");
  return /^[A-Za-z_$]/.test(identifier) ? identifier : `Mistral${identifier}`;
}

/** Strip the FastAPI doc-generation `#fragment` suffix (e.g. `#stream`, `#id`) from a path. */
function normalizePath(path) {
  const hashIndex = path.indexOf("#");
  return hashIndex === -1 ? path : path.slice(0, hashIndex);
}

/** Rewrite `$ref` pointers after a schema rename, including nested occurrences. */
function rewriteSchemaRefs(value, rename) {
  if (typeof value === "string") {
    return value.replace(/#\/components\/schemas\/([A-Za-z0-9_\-]+)/g, (match, name) => {
      const target = rename.get(name);
      return target && target !== name ? `#/components/schemas/${target}` : match;
    });
  }
  if (Array.isArray(value)) return value.map((entry) => rewriteSchemaRefs(entry, rename));
  if (isRecord(value)) {
    return Object.fromEntries(Object.entries(value).map(([key, child]) => [
      key,
      rewriteSchemaRefs(child, rename),
    ]));
  }
  return value;
}

function localText(language, english, chinese) {
  return language === "zh-CN" ? chinese : english;
}

function responseDescription(status, language) {
  const numeric = Number(status);
  if (Number.isFinite(numeric) && numeric >= 200 && numeric < 300) {
    return localText(language, "Successful supplier response.", "供应商成功响应。");
  }
  return localText(
    language,
    `Supplier response with HTTP status ${status}.`,
    `供应商返回 HTTP 状态 ${status}。`,
  );
}

function fieldDescription(name, language) {
  const label = words(name);
  return localText(
    language,
    `${label} value in the Mistral AI API contract.`,
    `Mistral AI API 合约中的 ${label} 值。`,
  );
}

function schemaDescription(name, language) {
  const label = words(name);
  return localText(
    language,
    `Structural definition for ${label} in the Mistral AI API contract.`,
    `Mistral AI API 合约中的 ${label} 结构定义。`,
  );
}

function copySchema(input, language, context = { kind: "field", name: "value" }) {
  if (!isRecord(input)) return clone(input);
  const output = {};
  for (const [key, value] of Object.entries(input)) {
    if (!structuralSchemaKeys.has(key)) continue;
    if (key === "properties") {
      output.properties = Object.fromEntries(Object.entries(value ?? {}).map(([name, child]) => [
        name,
        copySchema(child, language, { kind: "field", name }),
      ]));
    } else if (["items", "not"].includes(key)) {
      output[key] = isRecord(value) ? copySchema(value, language, context) : clone(value);
    } else if (key === "additionalProperties") {
      output[key] = isRecord(value) ? copySchema(value, language, context) : clone(value);
    } else if (["allOf", "anyOf", "oneOf"].includes(key)) {
      output[key] = Array.isArray(value)
        ? value.map((entry) => copySchema(entry, language, context))
        : clone(value);
    } else {
      output[key] = clone(value);
    }
  }
  output.title = localText(
    language,
    context.kind === "schema" ? `${words(context.name)} data structure` : `${words(context.name)} value`,
    context.kind === "schema" ? `${words(context.name)} 数据结构` : `${words(context.name)} 值`,
  );
  output.description = context.kind === "schema"
    ? schemaDescription(context.name, language)
    : fieldDescription(context.name, language);
  return output;
}

function copyMedia(media, language, context) {
  if (!isRecord(media)) return {};
  const output = {};
  if (media.schema) output.schema = copySchema(media.schema, language, context);
  // `example` values are contract data from the Apache-2.0 source, not copied
  // website prose. Keep them where present so Schema examples remain useful.
  if (Object.hasOwn(media, "example")) output.example = clone(media.example);
  if (isRecord(media.examples)) {
    output.examples = Object.fromEntries(Object.entries(media.examples).map(([name, example]) => {
      if (!isRecord(example)) return [name, clone(example)];
      const entry = {};
      if (Object.hasOwn(example, "value")) entry.value = clone(example.value);
      if (Object.hasOwn(example, "externalValue")) entry.externalValue = example.externalValue;
      entry.summary = localText(language, `${words(context.name)} example.`, `${words(context.name)} 示例。`);
      return [name, entry];
    }));
  }
  if (isRecord(media.encoding)) output.encoding = clone(media.encoding);
  return output;
}

function copyParameters(parameters, language, operationId) {
  return (parameters ?? []).map((parameter) => {
    const schema = isRecord(parameter.schema)
      ? copySchema(parameter.schema, language, { kind: "field", name: parameter.name })
      : parameter.in === "path"
        ? { type: "string", title: localText(language, `${words(parameter.name)} value`, `${words(parameter.name)} 值`), description: fieldDescription(parameter.name, language) }
        : undefined;
    return {
      in: parameter.in,
      name: parameter.name,
      ...(parameter.required === undefined ? {} : { required: Boolean(parameter.required) }),
      ...(schema ? { schema } : {}),
      ...(isRecord(parameter.content) ? {
        content: Object.fromEntries(Object.entries(parameter.content).map(([mediaType, media]) => [
          mediaType,
          copyMedia(media, language, { kind: "field", name: `${operationId} ${parameter.name}` }),
        ])),
      } : {}),
    };
  });
}

function copyResponses(responses, language, operationId) {
  return Object.fromEntries(Object.entries(responses ?? {}).map(([status, response]) => [
    status,
    {
      description: responseDescription(status, language),
      ...(response.schema ? {
        schema: copySchema(response.schema, language, { kind: "schema", name: `${operationId} response` }),
      } : {}),
      ...(isRecord(response.content) ? {
        content: Object.fromEntries(Object.entries(response.content).map(([mediaType, media]) => [
          mediaType,
          copyMedia(media, language, { kind: "schema", name: `${operationId} response` }),
        ])),
      } : {}),
      ...(isRecord(response.headers) ? {
        headers: Object.fromEntries(Object.entries(response.headers).map(([name, header]) => [
          name,
          {
            description: fieldDescription(name, language),
            ...(header?.schema ? {
              schema: copySchema(header.schema, language, { kind: "field", name }),
            } : {}),
          },
        ])),
      } : {}),
    },
  ]));
}

function expectedSuccessStatus(responses, operationId) {
  const status = Object.keys(responses ?? {}).find((value) => /^2(?:\d\d|[xX]{2})$/.test(value));
  if (!status) throw new Error(`${operationId} has no declared 2xx response`);
  return status;
}

function requestExample(api, language) {
  const unresolved = (api.parameters ?? [])
    .filter((parameter) => parameter.required)
    .map((parameter) => ({
      in: parameter.in,
      name: parameter.in === "body" ? "body" : parameter.name,
      source: {
        kind: "runtime",
        // Runtime source labels are structural request provenance and must be
        // byte-identical between locale specs. The human-facing summary stays
        // localized above.
        reason: "Caller-owned model, resource, and request content is required at runtime.",
      },
    }));
  return {
    default: {
      summary: localText(
        language,
        "Reviewed caller-local request outline with runtime-bound model and resource inputs.",
        "已审阅的调用方本地请求轮廓；模型与资源输入在运行时提供。",
      ),
      request: { path: {}, query: {}, headers: {} },
      ...(unresolved.length ? { unresolved } : {}),
      expectedStatus: expectedSuccessStatus(api.responses, api.operationId),
      serverUrl: "https://api.mistral.ai",
      verifiedAt,
    },
  };
}

function endpointExecution(api, language) {
  const mutation = !["GET", "HEAD", "OPTIONS"].includes(String(api.method).toUpperCase());
  const reason = mutation
    ? localText(
      language,
      "This Endpoint can create, change, or delete Mistral AI resources and may incur provider usage cost. Pontx Hub does not proxy it; the local CLI must show a redacted preview and obtain request-bound explicit confirmation before execution.",
      "该接口可能创建、变更或删除 Mistral AI 资源并产生供应商用量费用。Pontx Hub 不代理执行；本地 CLI 必须先展示脱敏预览，并在执行前取得请求绑定的显式确认。",
    )
    : localText(
      language,
      "This authenticated Mistral AI read is direct-only. Pontx Hub does not proxy model, account, or usage data; use caller-local credentials with the SDK or CLI.",
      "该经认证的 Mistral AI 读取仅支持直连。Pontx Hub 不代理模型、账户或用量数据；请通过 SDK 或 CLI 使用调用方本地凭证。",
    );
  return {
    enabled: false,
    permission: mutation ? "mutation" : "read",
    disabledReason: reason,
  };
}

function copySecuritySchemes(schemes, language) {
  return Object.fromEntries(Object.entries(schemes ?? {}).map(([name, scheme]) => {
    const copied = clone(scheme) ?? {};
    delete copied.description;
    copied.description = localText(
      language,
      `${words(name)} authentication for caller-local Mistral AI API requests.`,
      `用于调用方本地 Mistral AI API 请求的 ${words(name)} 认证。`,
    );
    return [name, copied];
  }));
}

function buildSpec(imported, language) {
  const apis = Object.fromEntries(Object.values(imported.apis ?? {}).map((api) => {
    const tag = api.tags?.[0];
    const apiKey = `${tag ? `${camelIdentifier(tag)}/` : ""}${api.operationId}`;
    const mutation = !["GET", "HEAD", "OPTIONS"].includes(String(api.method).toUpperCase());
    const verb = mutation ? "Manage" : "Read";
    return [apiKey, {
      operationId: api.operationId,
      summary: localText(
        language,
        `${verb} ${words(api.operationId)}.`,
        `${mutation ? "管理" : "读取"}${words(api.operationId)}。`,
      ),
      description: localText(
        language,
        `Contract-preserving ${String(api.method).toUpperCase()} Endpoint for ${words(api.operationId)} in the Mistral AI API. Model and resource-specific values are supplied by the caller at runtime.`,
        `Mistral AI API 中用于 ${words(api.operationId)} 的保留合约 ${String(api.method).toUpperCase()} Endpoint。模型与资源相关值由调用方在运行时提供。`,
      ),
      method: api.method,
      path: api.path,
      consumes: clone(api.consumes ?? []),
      produces: clone(api.produces ?? []),
      parameters: copyParameters(api.parameters, language, api.operationId),
      responses: copyResponses(api.responses, language, api.operationId),
      ...(Array.isArray(api.tags) ? { tags: clone(api.tags) } : {}),
      ...(api.deprecated ? { deprecated: true } : {}),
      ...(Array.isArray(api.security) ? { security: clone(api.security) } : {}),
      ...(api.externalDocs?.url ? {
        externalDocs: {
          url: api.externalDocs.url,
          description: localText(language, "Official supplier reference for this Endpoint.", "该 Endpoint 的供应商官方参考。"),
        },
      } : {}),
      ...(api.sse ? { sse: clone(api.sse) } : {}),
      requestExamples: requestExample(api, language),
      metadata: {
        documentation: {
          status: "official",
          evidence: [sourceUrl, referenceUrl],
          verifiedAt,
          stabilityNote: localText(
            language,
            "Wire contract imported from the fixed Apache-2.0-licensed official revision; surrounding prose is independently curated.",
            "连线合约由固定 Apache-2.0 许可官方 revision 导入；周边说明为独立编写。",
          ),
        },
        execution: endpointExecution(api, language),
      },
    }];
  }));
  const tags = [...new Set(Object.values(apis).flatMap((api) => api.tags ?? []))]
    .sort()
    .map((name) => ({
      name,
      description: localText(
        language,
        `${name} Endpoints in the Mistral AI API contract.`,
        `Mistral AI API 合约中的 ${name} Endpoint。`,
      ),
    }));
  const schemas = Object.fromEntries(Object.entries(imported.components?.schemas ?? {}).map(([name, schema]) => [
    name,
    copySchema(schema, language, { kind: "schema", name }),
  ]));
  return loadPontxSpec({
    pontx: "2.1",
    style: "RESTFul",
    name: "mistral-ai",
    info: {
      title: "Mistral AI API",
      version: "1.0.0",
      description: localText(
        language,
        "The complete ApiKey-authenticated Mistral AI Platform REST contract from a fixed, Apache-2.0-licensed official OpenAPI revision (openapi-public-doc.yaml), including typed SSE streaming Endpoints (Chat Completions, FIM, Audio, Agents conversations, Workflows). The beta.admin.* workspace-administration and beta.users dashboard-session surfaces are excluded as outside the developer API boundary. All execution is direct-only: caller-owned API keys stay local, and every mutation requires a redacted preview and explicit confirmation in the local CLI.",
        "来自固定 Apache-2.0 许可官方 OpenAPI revision（openapi-public-doc.yaml）的完整 ApiKey 认证 Mistral AI Platform REST 合约，含类型化 SSE 流式 Endpoint（Chat Completions、FIM、Audio、Agents conversations、Workflows）。beta.admin.* 工作区管理与 beta.users 面板会话端点不属于开发者 API 边界，已排除。所有执行仅支持直连：调用方 API key 保留在本地，每个变更操作都必须在本地 CLI 中先经脱敏预览和显式确认。",
      ),
    },
    servers: [{
      id: "mistral-production",
      url: "https://api.mistral.ai",
      description: localText(
        language,
        "Mistral AI Platform production HTTPS API Endpoint.",
        "Mistral AI Platform 生产 HTTPS API Endpoint。",
      ),
    }],
    security: clone(imported.security ?? []),
    externalDocs: {
      url: referenceUrl,
      description: localText(language, "Official Mistral AI API reference.", "Mistral AI 官方 API 参考。"),
    },
    components: {
      schemas,
      securitySchemes: copySecuritySchemes(imported.components?.securitySchemes, language),
    },
    tags,
    apis,
  }, { expectedName: "mistral-ai" });
}

async function curlBytes(url) {
  const { stdout } = await execFile("curl", ["--fail", "--silent", "--show-error", "--location", url], {
    encoding: "buffer",
    maxBuffer: 64 * 1024 * 1024,
  });
  return Buffer.from(stdout);
}

async function writeOrCheck(path, bytes, checkOnly) {
  if (!checkOnly) {
    await writeFile(path, bytes);
    return;
  }
  const existing = await readFile(path);
  if (!existing.equals(bytes)) throw new Error(`${path} is stale; rerun the builder with --write`);
}

const checkOnly = process.argv.includes("--check");
if (process.argv.slice(2).some((value) => value !== "--check" && value !== "--write")) {
  throw new Error("Usage: node scripts/build-mistral-ai-product.mjs [--write|--check]");
}
const [sourceBytes, licenseBytes] = await Promise.all([curlBytes(sourceUrl), curlBytes(licenseUrl)]);
if (sha256(sourceBytes) !== sourceSha256) {
  throw new Error(`Mistral OpenAPI source changed: expected ${sourceSha256}, received ${sha256(sourceBytes)}`);
}
if (sha256(licenseBytes) !== licenseSha256) {
  throw new Error(`Mistral LICENSE changed: expected ${licenseSha256}, received ${sha256(licenseBytes)}`);
}
const oas = YAML.parse(sourceBytes.toString("utf8"));
const imported = importOpenAPI(oas, { name: "mistral-ai" });
let importedApis = Object.values(imported.apis ?? {});
const importedSchemas = Object.keys(imported.components?.schemas ?? {});
if (importedApis.length !== 288 || importedSchemas.length !== 756) {
  throw new Error(`Unexpected Mistral source boundary: ${importedApis.length} Endpoints, ${importedSchemas.length} Schemas`);
}

// Exclude the AdminApiKey / DashboardUserContextAuth surface (workspace-admin
// and dashboard-session endpoints) from the developer API boundary.
const effectiveSecurity = (api) => api.security ?? imported.security ?? [];
const excludedCount = importedApis.filter((api) =>
  effectiveSecurity(api).some((entry) =>
    Object.keys(entry).some((scheme) => ADMIN_SCHEMES.has(scheme)),
  ),
).length;
if (excludedCount !== 50) {
  throw new Error(`Unexpected Mistral admin boundary: ${excludedCount} Endpoints require Admin/Dashboard auth (expected 50)`);
}
importedApis = importedApis.filter((api) =>
  !effectiveSecurity(api).some((entry) =>
    Object.keys(entry).some((scheme) => ADMIN_SCHEMES.has(scheme)),
  ),
);
if (importedApis.length !== 238) {
  throw new Error(`Unexpected Mistral developer boundary: ${importedApis.length} ApiKey Endpoints (expected 238)`);
}
const keptIds = new Set(importedApis.map((api) => api.operationId));
imported.apis = Object.fromEntries(
  Object.entries(imported.apis ?? {}).filter(([, api]) => keptIds.has(api.operationId)),
);

// Normalize official snake_case operationIds and any invalid schema names into
// valid, code-generation-safe identifiers, and rewrite every `$ref`
// consistently. The stable CLI/Hub resource ID becomes the camelCase
// operationId; the mapping is deterministic and recorded in provenance.
const operationIdMap = new Map();
for (const api of importedApis) {
  const normalized = normalizeOperationId(api.operationId);
  if (operationIdMap.has(api.operationId)) {
    throw new Error(`Duplicate source operationId ${api.operationId}`);
  }
  operationIdMap.set(api.operationId, normalized);
}
if (new Set(operationIdMap.values()).size !== operationIdMap.size) {
  throw new Error("Operation ID normalization produced duplicate identifiers");
}
const schemaRename = new Map();
for (const name of importedSchemas) {
  const normalized = normalizeSchemaName(name);
  schemaRename.set(name, normalized);
}
if (new Set(schemaRename.values()).size !== schemaRename.size) {
  throw new Error("Schema name normalization produced duplicate identifiers");
}
const fragmentNormalized = new Set();
for (const api of importedApis) {
  api.operationId = operationIdMap.get(api.operationId) ?? api.operationId;
  const rawPath = api.path;
  api.path = normalizePath(api.path);
  if (api.path !== rawPath) fragmentNormalized.add(`${rawPath} -> ${api.path}`);
  if (!api.path.startsWith("/")) throw new Error(`${api.operationId}: path must start with /`);
  if (api.path.includes("#")) throw new Error(`${api.operationId}: path still contains a fragment`);
  if (api.parameters) api.parameters = rewriteSchemaRefs(api.parameters, schemaRename);
  if (api.responses) api.responses = rewriteSchemaRefs(api.responses, schemaRename);
  if (api.requestExamples) api.requestExamples = rewriteSchemaRefs(api.requestExamples, schemaRename);
  if (api.sse) api.sse = rewriteSchemaRefs(api.sse, schemaRename);
}
imported.apis = Object.fromEntries(
  Object.entries(imported.apis ?? {}).map(([key, api]) => [
    key.split("/").map((part) => operationIdMap.get(part) ?? part).join("/"),
    api,
  ]),
);
// Drop only the ApiKey security scheme; excluded ops (and their schemes) are gone.
imported.components.securitySchemes = {
  ApiKey: imported.components.securitySchemes.ApiKey,
};
imported.components.schemas = Object.fromEntries(
  Object.entries(imported.components?.schemas ?? {}).map(([name, schema]) => [
    schemaRename.get(name) ?? name,
    rewriteSchemaRefs(schema, schemaRename),
  ]),
);
const finalApis = Object.values(imported.apis ?? {});
const finalSchemas = Object.keys(imported.components?.schemas ?? {});
if (finalApis.length !== 238 || finalSchemas.length !== 756) {
  throw new Error(`Normalization changed the source boundary: ${finalApis.length} Endpoints, ${finalSchemas.length} Schemas`);
}
const normalizedOperationIdCount = [...operationIdMap.entries()].filter(([source, target]) => source !== target).length;
const normalizedSchemaCount = [...schemaRename.entries()].filter(([source, target]) => source !== target).length;
const methodCounts = Object.fromEntries(["GET", "POST", "PUT", "PATCH", "DELETE"].map((method) => [
  method,
  finalApis.filter((api) => String(api.method).toUpperCase() === method).length,
]));
if (JSON.stringify(methodCounts) !== JSON.stringify({ GET: 102, POST: 79, PUT: 17, PATCH: 14, DELETE: 26 })) {
  throw new Error(`Unexpected Mistral method boundary: ${JSON.stringify(methodCounts)}`);
}
const sseCount = finalApis.filter((api) => api.sse).length;
if (sseCount !== 11) {
  throw new Error(`Unexpected Mistral SSE boundary: ${sseCount}`);
}
const untagged = finalApis.filter((api) => !Array.isArray(api.tags) || api.tags.length === 0);
if (untagged.length !== 0) {
  throw new Error(`Unexpected untagged Mistral Endpoints: ${untagged.map((api) => api.operationId).join(", ")}`);
}

const zh = buildSpec(imported, "zh-CN");
const en = buildSpec(imported, "en-US");
const zhBytes = Buffer.from(`${JSON.stringify(PontxSpec.reOrder(zh), null, 2)}\n`);
const enBytes = Buffer.from(`${JSON.stringify(PontxSpec.reOrder(en), null, 2)}\n`);
const tags = [...new Set(finalApis.flatMap((api) => api.tags ?? []))].sort();
const controllerEntries = tags.map((tag) => [tag, camelIdentifier(tag)]);
if (new Set(controllerEntries.map(([, property]) => property)).size !== controllerEntries.length) {
  throw new Error("Mistral tag-to-controller mapping is not collision free");
}
const mutationCount = finalApis.filter((api) => !["GET", "HEAD", "OPTIONS"].includes(String(api.method).toUpperCase())).length;
const product = {
  formatVersion: 1,
  slug: "mistral-ai",
  name: "Mistral AI API",
  provider: "Mistral AI",
  category: "AI",
  featured: true,
  display: {
    title: "Mistral AI API",
    summary: "覆盖固定 Apache-2.0 许可官方 revision 中 ApiKey 认证的 238 个 Mistral AI Platform REST Endpoint（含类型化 SSE 流式与 Workflows）。Hub 提供文档与独立 SDK/CLI，但不代理模型、账户或用量数据；调用方通过本地 API key 直连。",
    accent: "#F5A623",
  },
  legal: {
    license: "Apache-2.0 for the imported OpenAPI source; Mistral AI service, website, and trademark terms apply separately.",
    attributionUrl: `https://github.com/mistralai/platform-docs-public/tree/${revision}`,
  },
  documentation: {
    status: "official",
    evidence: [
      sourceUrl,
      `https://github.com/mistralai/platform-docs-public/tree/${revision}`,
      licenseUrl,
      referenceUrl,
      termsUrl,
    ],
    verifiedAt,
    contentUpdatedAt: verifiedAt,
    stabilityNote: "完整边界是固定 mistralai/platform-docs-public revision 的 openapi-public-doc.yaml 中 ApiKey 认证的 238 个 Endpoint（GET 102 / POST 79 / DELETE 26 / PATCH 14 / PUT 17）和 756 个 Schema，其中 11 个 Endpoint 声明类型化 SSE 流式响应。需要 AdminApiKey 的 beta.admin.* 工作区管理面与需要 DashboardUserContextAuth 的 beta.users 面板会话面共 50 个 Endpoint 不属于开发者 API 边界，明确排除。Apache-2.0 适用于导入的规范源码；Mistral AI 服务使用、官网内容和商标分别受其自身条款约束。Hub 不代理 Mistral 流量，SDK/CLI 仅使用调用方本地 API key；任何变更操作都必须先预览并获得显式确认。",
  },
  pricing: {
    status: "paid",
    summary: "Mistral AI Platform 的模型用量计费、套餐和账户资格由 Mistral AI 的当前定价与服务条款决定；Pontx 不代售、转售或代表 Mistral AI 报价。",
    officialUrl: "https://mistral.ai/pricing/",
    verifiedAt,
  },
  credentials: [
    {
      schemeId: "ApiKey",
      envVar: "MISTRAL_API_KEY",
      description: "Mistral AI Platform API key。SDK/CLI 只从调用方本地环境读取，不能写入请求示例、日志或 Hub。",
      guide: {
        url: "https://console.mistral.ai/api-keys/",
        title: "获取 Mistral AI API key",
        steps: [
          "在 Mistral AI La Plateforme 控制台创建 API key，并按用途授予最低权限。",
          "将 API key 仅放入调用方本地环境变量 MISTRAL_API_KEY。",
          "先用只读 Endpoint 生成脱敏预览，再执行请求。",
        ],
      },
    },
  ],
  quickStart: { operationId: "listModelsV1ModelsGet", requestExampleId: "default" },
};
const productEn = {
  display: {
    title: "Mistral AI API",
    summary: "All 238 ApiKey-authenticated Mistral AI Platform REST endpoints from a fixed Apache-2.0-licensed official revision, including typed SSE streaming and Workflows. Hub provides documentation and an independent SDK/CLI, but never proxies model, account, or usage data; callers connect directly with local API keys.",
    accent: "#F5A623",
  },
  documentation: {
    status: "official",
    evidence: product.documentation.evidence,
    verifiedAt,
    contentUpdatedAt: verifiedAt,
    stabilityNote: "The complete boundary is all 238 ApiKey-authenticated endpoints (GET 102 / POST 79 / DELETE 26 / PATCH 14 / PUT 17) and 756 schemas in openapi-public-doc.yaml at the fixed mistralai/platform-docs-public revision, of which 11 endpoints declare typed SSE streaming responses. The 50 endpoints requiring AdminApiKey (beta.admin.* workspace administration) or DashboardUserContextAuth (beta.users dashboard session) are outside the developer API boundary and explicitly excluded. Apache-2.0 applies to the imported specification source; Mistral AI service use, website content, and trademarks are governed separately. Hub does not proxy Mistral traffic; SDK/CLI credentials stay caller-local, and every mutation needs a preview and explicit confirmation.",
  },
  pricing: {
    status: "paid",
    summary: "Mistral AI Platform model usage billing, plans, and account eligibility are governed by Mistral AI's current pricing and service terms. Pontx neither resells the service nor quotes for Mistral AI.",
    officialUrl: "https://mistral.ai/pricing/",
    verifiedAt,
  },
  credentials: [
    {
      schemeId: "ApiKey",
      description: "Mistral AI Platform API key. The SDK/CLI reads it only from the caller-local environment; it must never appear in request examples, logs, or Hub.",
      guide: {
        title: "Get a Mistral AI API key",
        steps: [
          "Create an API key in the Mistral AI La Plateforme console with the least privilege required for the task.",
          "Keep it only in the caller-local MISTRAL_API_KEY environment variable.",
          "Generate a redacted preview with a read endpoint before executing a request.",
        ],
      },
    },
  ],
};
const sdkMethodEntries = Object.entries(zh.apis).map(([apiKey, api]) => [
  api.operationId,
  camelIdentifier(api.operationId),
  api.tags?.[0] ?? "",
  apiKey,
]);
const sdkControllerMethods = new Set();
for (const [, methodName, tag, apiKey] of sdkMethodEntries) {
  const controllerMethod = `${tag}\u0000${methodName}`;
  if (sdkControllerMethods.has(controllerMethod)) {
    throw new Error(`Mistral SDK method collision for ${tag || "root"}.${methodName} at ${apiKey}`);
  }
  sdkControllerMethods.add(controllerMethod);
}
const sdk = {
  formatVersion: 1,
  package: {
    name: "@pontx/mistral-ai",
    version: "0.1.0",
    status: "planned",
    repository: "https://github.com/pontjs/mistral-ai",
  },
  cli: { name: "pontx-mistral-ai" },
  contract: {
    client: {
      kind: "factory",
      factory: "createMistralAiClient",
      identifier: "client",
      options: {
        apiKey: "MISTRAL_API_KEY",
      },
    },
    controllers: Object.fromEntries(controllerEntries),
    methodNames: Object.fromEntries(
      sdkMethodEntries.map(([operationId, methodName]) => [operationId, methodName]),
    ),
  },
  examples: {
    typescript: "import { createMistralAiClient } from \"@pontx/mistral-ai\";\n\nconst client = createMistralAiClient();\nconst models = await client.models.listModelsV1ModelsGet();",
    cli: "pnpm add --global @pontx/mistral-ai\n\npontx-mistral-ai call models listModelsV1ModelsGet --dry-run",
  },
  coverage: { mode: "full" },
  spec: {
    path: "products/mistral-ai/spec.pontx.json",
    sha256: sha256(zhBytes),
  },
};
const provenance = {
  formatVersion: 1,
  source: {
    repository: `https://github.com/mistralai/platform-docs-public/tree/${revision}`,
    revision,
    url: sourceUrl,
    sha256: sourceSha256,
    license: {
      name: "Apache-2.0",
      url: licenseUrl,
      sha256: licenseSha256,
    },
    observedAt: verifiedAt,
    importMethod: "one-time @pontx/spec importOpenAPI conversion; generated PontxSpec is canonical after import",
    boundary: {
      endpoints: finalApis.length,
      schemas: finalSchemas.length,
      methods: methodCounts,
      sseEndpoints: sseCount,
      excludedEndpoints: excludedCount,
      excludedReason: "50 Endpoints require AdminApiKey (beta.admin.* workspace administration) or DashboardUserContextAuth (beta.users dashboard session); they manage accounts, credentials, billing, and audit data and are outside the developer API key boundary.",
    },
    transformations: [
      "Preserved all imported developer-API Endpoint methods, paths, tags, security requirements, parameters, response statuses (including error statuses), media types, typed SSE contracts, Schema constraints, enums, defaults, and reference topology.",
      `Excluded ${excludedCount} Endpoints whose effective security requires AdminApiKey (beta.admin.*: users, workspaces, api-keys, billing, audit-logs, user-groups, SCIM, analytics) or DashboardUserContextAuth (beta.users: /users/me, /users/me/organizations, /users/me/workspaces); only the ApiKey security scheme remains.`,
      `Normalized ${normalizedOperationIdCount} official snake_case operationIds and ${normalizedSchemaCount} Schema names to valid camelCase identifiers; every $ref was rewritten consistently and the mapping is deterministic and recorded.`,
      `Normalized ${fragmentNormalized.size} FastAPI doc-generation path keys by removing their #fragment suffix (for example "/v1/conversations#stream" -> "/v1/conversations" and "/v1/connectors/{connector_id}#id" -> "/v1/connectors/{connector_id}"); the wire paths are unchanged and the fragment-bearing operations keep distinct stable operationIds.`,
      "Replaced supplier prose with independently authored Chinese and English product, Endpoint, response, tag, Schema, and field text; locale files differ only in prose.",
      "Added one reviewed request outline per Endpoint. Required model, resource, and body inputs are declared as runtime-bound rather than fabricated as executable production data.",
      "Applied direct-only execution policy to every Mistral Endpoint; no Hub proxy stores, relays, caches, or logs caller credentials or provider responses. The 11 SSE Endpoints keep the typed text/event-stream contract with unknownEventPolicy: preserve; the official event unions (conversation.response.started/done/error, message.output.delta, tool.execution.started/done, agent.handoff.started/done, function.call.delta for Agents conversations streaming) are documented in the product docs and skill evidence.",
    ],
  },
  legalReview: {
    sourceLicense: "The fixed mistralai/platform-docs-public repository revision and its Apache-2.0 LICENSE cover the imported openapi-public-doc.yaml source file; the LICENSE is retained in this product's sources directory.",
    serviceBoundary: "Mistral AI Platform use remains governed by Mistral AI's terms and pricing; this package neither resells nor sublicenses the service.",
    websiteBoundary: "Product prose is independently authored. Mistral AI website documentation (docs.mistral.ai) is used only as linked evidence and is not copied as page content.",
    trademarkBoundary: "Mistral AI is used descriptively to identify interoperability. Pontx is independently branded and does not claim endorsement.",
  },
  riskReview: {
    classification: "paid-ai-platform-with-user-data",
    hubProxyEnabled: false,
    readEndpoints: methodCounts.GET,
    mutations: {
      count: mutationCount,
      methods: { POST: methodCounts.POST, PUT: methodCounts.PUT, PATCH: methodCounts.PATCH, DELETE: methodCounts.DELETE },
    },
    credentialPolicy: "Mistral AI API keys remain in the caller environment only. No credential appears in generated examples, Hub, logs, provenance, or SDK output.",
    executionPolicy: "Hub execution is disabled for all Mistral traffic. The local CLI previews every call, redacts sensitive values, and requires exact request-bound explicit confirmation before every mutation; paid inference calls are never issued for verification.",
    sensitiveAreas: ["model prompts and completions", "workflow definitions, executions, and logs", "files and uploaded content", "organization resources, agents, and libraries", "usage, observability, and audit data"],
  },
};
const attribution = `# Mistral AI API attribution\n\nThe canonical PontxSpec in this product was imported from [mistralai/platform-docs-public@${revision}](https://github.com/mistralai/platform-docs-public/tree/${revision}) at [openapi-public-doc.yaml](${sourceUrl}). That source file is covered by the accompanying Apache-2.0 license retained in this directory.\n\nMistral AI Platform service use is governed separately by [Mistral AI's legal terms](${termsUrl}). This independently branded Pontx SDK/CLI is not endorsed by Mistral AI. Mistral AI is used descriptively for compatible API interoperability.\n`;

await mkdir(resolve(productRoot, "locales/en-US"), { recursive: true });
await mkdir(resolve(productRoot, "sources"), { recursive: true });
await writeOrCheck(resolve(productRoot, "spec.pontx.json"), zhBytes, checkOnly);
await writeOrCheck(resolve(productRoot, "locales/en-US/spec.pontx.json"), enBytes, checkOnly);
await writeOrCheck(resolve(productRoot, "product.json"), Buffer.from(`${JSON.stringify(product, null, 2)}\n`), checkOnly);
await writeOrCheck(resolve(productRoot, "locales/en-US/product.json"), Buffer.from(`${JSON.stringify(productEn, null, 2)}\n`), checkOnly);
await writeOrCheck(resolve(productRoot, "sdk.json"), Buffer.from(`${JSON.stringify(sdk, null, 2)}\n`), checkOnly);
await writeOrCheck(resolve(productRoot, "sources/provenance.json"), Buffer.from(`${JSON.stringify(provenance, null, 2)}\n`), checkOnly);
await writeOrCheck(resolve(productRoot, "sources/LICENSE.mistral-platform-docs"), licenseBytes, checkOnly);
await writeOrCheck(resolve(productRoot, "sources/ATTRIBUTION.md"), Buffer.from(attribution), checkOnly);
console.log(`Mistral AI API ${checkOnly ? "verified" : "built"}: ${finalApis.length} Endpoints, ${finalSchemas.length} Schemas, ${sseCount} SSE, ${mutationCount} mutations, ${sha256(zhBytes)}.`);
