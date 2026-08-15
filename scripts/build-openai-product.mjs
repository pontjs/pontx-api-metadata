/**
 * Rebuild the complete OpenAI API PontxSpec pair from one immutable,
 * MIT-licensed official OpenAPI source (openai/openai-openapi). The generated
 * PontxSpec is canonical; this script is only an audited import utility.
 *
 * Scope: every Endpoint and Schema in the pinned official revision. SSE
 * streaming Endpoints (Responses, Chat Completions, Images, Audio) and the
 * Realtime call-management REST surface are preserved from the official
 * machine contract. The dedicated `wss://` Realtime WebSocket protocol is
 * documented by OpenAI outside this repository's machine contract and is out
 * of this product's scope; it is neither invented nor trimmed from the OAS.
 */
import { createHash } from "node:crypto";
import { execFile as execFileCallback } from "node:child_process";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { promisify } from "node:util";
import { importOpenAPI, loadPontxSpec, PontxSpec } from "@pontx/spec";

const execFile = promisify(execFileCallback);
const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const productRoot = resolve(root, "products/openai");
const revision = "2186421dca0cca7c1e67caa7739005e8b1ccc4dd";
const sourceUrl = `https://raw.githubusercontent.com/openai/openai-openapi/${revision}/openapi.json`;
const sourceSha256 = "542299d304cdeb78deff4172b3790d52c7e7e75fb2b517e9c2787c52f1424acc";
const licenseUrl = `https://raw.githubusercontent.com/openai/openai-openapi/${revision}/LICENSE`;
const licenseSha256 = "bcba3de214851cce46ed5af42d6698044616eeace887c3231bc7a20474ab639e";
const referenceUrl = "https://developers.openai.com/api/reference/overview";
const servicesAgreementUrl = "https://openai.com/policies/services-agreement/";
const platformTermsUrl = "https://openai.com/policies/usage-policies/";
const verifiedAt = "2026-08-16";

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
  const tokens = words(value).match(/[A-Za-z0-9]+/g) ?? ["openai"];
  const identifier = tokens.map((token, index) => {
    const normalized = token.toLowerCase();
    return index === 0 ? normalized : `${normalized[0].toUpperCase()}${normalized.slice(1)}`;
  }).join("");
  return /^[A-Za-z_$]/.test(identifier) ? identifier : `openai${identifier}`;
}

/**
 * Convert an official dashed operationId into a valid, code-generation-safe
 * camelCase identifier. OpenAI's official SDKs expose the same camelCase
 * naming, so this keeps the SDK property path aligned with upstream while the
 * stable CLI/Hub resource ID remains the operationId.
 */
function normalizeOperationId(operationId) {
  if (/^[A-Za-z_$][A-Za-z0-9_$]*$/.test(operationId)) return operationId;
  const tokens = String(operationId).match(/[A-Za-z0-9]+/g) ?? ["openai"];
  const identifier = tokens.map((token, index) => {
    const normalized = token.toLowerCase();
    return index === 0 ? normalized : `${normalized[0].toUpperCase()}${normalized.slice(1)}`;
  }).join("");
  return /^[A-Za-z_$]/.test(identifier) ? identifier : `openai${identifier}`;
}

/**
 * Convert an official schema name into a valid, code-generation-safe
 * identifier, preserving the upstream title casing.
 */
function normalizeSchemaName(name) {
  if (/^[A-Za-z_$][A-Za-z0-9_$]*$/.test(name)) return name;
  const tokens = String(name).match(/[A-Za-z0-9]+/g) ?? ["OpenaiSchema"];
  const identifier = tokens.map((token, index) => {
    const normalized = token.toLowerCase();
    return index === 0 ? normalized : `${normalized[0].toUpperCase()}${normalized.slice(1)}`;
  }).join("");
  return /^[A-Za-z_$]/.test(identifier) ? identifier : `Openai${identifier}`;
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
    `${label} value in the OpenAI API contract.`,
    `OpenAI API 合约中的 ${label} 值。`,
  );
}

function schemaDescription(name, language) {
  const label = words(name);
  return localText(
    language,
    `Structural definition for ${label} in the OpenAI API contract.`,
    `OpenAI API 合约中的 ${label} 结构定义。`,
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
  // `example` values are contract data from the MIT source, not copied website
  // prose. Keep them where present so Schema examples remain useful.
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
  return (parameters ?? []).map((parameter) => ({
    in: parameter.in,
    name: parameter.name,
    ...(parameter.required === undefined ? {} : { required: Boolean(parameter.required) }),
    schema: copySchema(parameter.schema ?? {}, language, { kind: "field", name: parameter.name }),
    ...(isRecord(parameter.content) ? {
      content: Object.fromEntries(Object.entries(parameter.content).map(([mediaType, media]) => [
        mediaType,
        copyMedia(media, language, { kind: "field", name: `${operationId} ${parameter.name}` }),
      ])),
    } : {}),
  }));
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
      serverUrl: "https://api.openai.com/v1",
      verifiedAt,
    },
  };
}

function endpointExecution(api, language) {
  const mutation = !["GET", "HEAD", "OPTIONS"].includes(String(api.method).toUpperCase());
  const admin = (api.security ?? []).some((entry) => "AdminApiKeyAuth" in entry);
  const reason = admin
    ? localText(
      language,
      "This organization administration Endpoint requires an OpenAI admin API key and can read or change account-wide settings, credentials, or usage data. Pontx Hub does not proxy it; the local CLI must show a redacted preview and obtain request-bound explicit confirmation before execution.",
      "该组织管理 Endpoint 需要 OpenAI admin API key，可能读取或修改账户级设置、凭证或用量数据。Pontx Hub 不代理执行；本地 CLI 必须先展示脱敏预览，并在执行前取得请求绑定的显式确认。",
    )
    : mutation
      ? localText(
        language,
        "This Endpoint can create, change, or delete OpenAI resources and may incur provider usage cost. Pontx Hub does not proxy it; the local CLI must show a redacted preview and obtain request-bound explicit confirmation before execution.",
        "该接口可能创建、变更或删除 OpenAI 资源并产生供应商用量费用。Pontx Hub 不代理执行；本地 CLI 必须先展示脱敏预览，并在执行前取得请求绑定的显式确认。",
      )
      : localText(
        language,
        "This authenticated OpenAI read is direct-only. Pontx Hub does not proxy model, account, or usage data; use caller-local credentials with the SDK or CLI.",
        "该经认证的 OpenAI 读取仅支持直连。Pontx Hub 不代理模型、账户或用量数据；请通过 SDK 或 CLI 使用调用方本地凭证。",
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
      `${words(name)} authentication for caller-local OpenAI API requests.`,
      `用于调用方本地 OpenAI API 请求的 ${words(name)} 认证。`,
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
        `Contract-preserving ${String(api.method).toUpperCase()} Endpoint for ${words(api.operationId)} in the OpenAI API. Model and resource-specific values are supplied by the caller at runtime.`,
        `OpenAI API 中用于 ${words(api.operationId)} 的保留合约 ${String(api.method).toUpperCase()} Endpoint。模型与资源相关值由调用方在运行时提供。`,
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
            "Wire contract imported from the fixed MIT-licensed official revision; surrounding prose is independently curated.",
            "连线合约由固定 MIT 许可官方 revision 导入；周边说明为独立编写。",
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
        `${name} Endpoints in the OpenAI API contract.`,
        `OpenAI API 合约中的 ${name} Endpoint。`,
      ),
    }));
  const schemas = Object.fromEntries(Object.entries(imported.components?.schemas ?? {}).map(([name, schema]) => [
    name,
    copySchema(schema, language, { kind: "schema", name }),
  ]));
  return loadPontxSpec({
    pontx: "2.1",
    style: "RESTFul",
    name: "openai",
    info: {
      title: "OpenAI API",
      version: "2.3.0",
      description: localText(
        language,
        "The complete OpenAI Platform REST contract from a fixed, MIT-licensed official OpenAPI revision, including typed SSE streaming Endpoints (Responses, Chat Completions, Images, Audio) and Realtime call-management Endpoints. All execution is direct-only: caller-owned API keys stay local, and every mutation requires a redacted preview and explicit confirmation in the local CLI.",
        "来自固定 MIT 许可官方 OpenAPI revision 的完整 OpenAI Platform REST 合约，含类型化 SSE 流式 Endpoint（Responses、Chat Completions、Images、Audio）与 Realtime 调用管理 Endpoint。所有执行仅支持直连：调用方 API key 保留在本地，每个变更操作都必须在本地 CLI 中先经脱敏预览和显式确认。",
      ),
    },
    servers: [{
      id: "openai-production",
      url: "https://api.openai.com/v1",
      description: localText(
        language,
        "OpenAI Platform production HTTPS API Endpoint.",
        "OpenAI Platform 生产 HTTPS API Endpoint。",
      ),
    }],
    security: clone(imported.security ?? []),
    externalDocs: {
      url: referenceUrl,
      description: localText(language, "Official OpenAI API reference.", "OpenAI 官方 API 参考。"),
    },
    components: {
      schemas,
      securitySchemes: copySecuritySchemes(imported.components?.securitySchemes, language),
    },
    tags,
    apis,
  }, { expectedName: "openai" });
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
  throw new Error("Usage: node scripts/build-openai-product.mjs [--write|--check]");
}
const [sourceBytes, licenseBytes] = await Promise.all([curlBytes(sourceUrl), curlBytes(licenseUrl)]);
if (sha256(sourceBytes) !== sourceSha256) {
  throw new Error(`OpenAI OpenAPI source changed: expected ${sourceSha256}, received ${sha256(sourceBytes)}`);
}
if (sha256(licenseBytes) !== licenseSha256) {
  throw new Error(`OpenAI OpenAPI LICENSE changed: expected ${licenseSha256}, received ${sha256(licenseBytes)}`);
}
const imported = importOpenAPI(JSON.parse(sourceBytes.toString("utf8")), { name: "openai" });
const importedApis = Object.values(imported.apis ?? {});
const importedSchemas = Object.keys(imported.components?.schemas ?? {});
if (importedApis.length !== 288 || importedSchemas.length !== 1421) {
  throw new Error(`Unexpected OpenAI source boundary: ${importedApis.length} Endpoints, ${importedSchemas.length} Schemas`);
}

// Normalize official dashed operationIds and schema names into valid,
// code-generation-safe identifiers, and rewrite every `$ref` consistently.
// The stable CLI/Hub resource ID remains the operationId (now camelCase,
// matching OpenAI's own official SDK naming); only dashes are removed.
const operationIdMap = new Map();
for (const api of importedApis) {
  const normalized = normalizeOperationId(api.operationId);
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
for (const api of importedApis) {
  api.operationId = operationIdMap.get(api.operationId) ?? api.operationId;
  if (api.path) api.path = rewriteSchemaRefs(api.path, schemaRename);
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
imported.components.schemas = Object.fromEntries(
  Object.entries(imported.components?.schemas ?? {}).map(([name, schema]) => [
    schemaRename.get(name) ?? name,
    rewriteSchemaRefs(schema, schemaRename),
  ]),
);
const importedApisAfter = Object.values(imported.apis ?? {});
const importedSchemasAfter = Object.keys(imported.components?.schemas ?? {});
if (importedApisAfter.length !== 288 || importedSchemasAfter.length !== 1421) {
  throw new Error(`Normalization changed the source boundary: ${importedApisAfter.length} Endpoints, ${importedSchemasAfter.length} Schemas`);
}
const normalizedOperationIdCount = [...operationIdMap.entries()].filter(([source, target]) => source !== target).length;
const normalizedSchemaCount = [...schemaRename.entries()].filter(([source, target]) => source !== target).length;
const methodCounts = Object.fromEntries(["GET", "POST", "DELETE"].map((method) => [
  method,
  importedApis.filter((api) => String(api.method).toUpperCase() === method).length,
]));
if (JSON.stringify(methodCounts) !== JSON.stringify({ GET: 122, POST: 123, DELETE: 43 })) {
  throw new Error(`Unexpected OpenAI method boundary: ${JSON.stringify(methodCounts)}`);
}
const sseCount = importedApis.filter((api) => api.sse).length;
if (sseCount !== 7) {
  throw new Error(`Unexpected OpenAI SSE boundary: ${sseCount}`);
}
const zh = buildSpec(imported, "zh-CN");
const en = buildSpec(imported, "en-US");
const zhBytes = Buffer.from(`${JSON.stringify(PontxSpec.reOrder(zh), null, 2)}\n`);
const enBytes = Buffer.from(`${JSON.stringify(PontxSpec.reOrder(en), null, 2)}\n`);
const tags = [...new Set(importedApis.flatMap((api) => api.tags ?? []))].sort();
const controllerEntries = tags.map((tag) => [tag, camelIdentifier(tag)]);
if (new Set(controllerEntries.map(([, property]) => property)).size !== controllerEntries.length) {
  throw new Error("OpenAI tag-to-controller mapping is not collision free");
}
const mutationCount = importedApis.filter((api) => !["GET", "HEAD", "OPTIONS"].includes(String(api.method).toUpperCase())).length;
const product = {
  formatVersion: 1,
  slug: "openai",
  name: "OpenAI API",
  provider: "OpenAI",
  category: "AI",
  featured: true,
  display: {
    title: "OpenAI API",
    summary: "覆盖固定 MIT 许可官方 revision 中全部 288 个 OpenAI Platform REST Endpoint（含类型化 SSE 流式与 Realtime 调用管理）。Hub 提供文档与独立 SDK/CLI，但不代理模型、账户或用量数据；调用方通过本地 API key 直连。",
    accent: "#10A37F",
  },
  legal: {
    license: "MIT for the imported OpenAPI source; OpenAI Platform service, website, and trademark terms apply separately.",
    attributionUrl: `https://github.com/openai/openai-openapi/tree/${revision}`,
  },
  documentation: {
    status: "official",
    evidence: [
      sourceUrl,
      `https://github.com/openai/openai-openapi/tree/${revision}`,
      licenseUrl,
      referenceUrl,
      servicesAgreementUrl,
      platformTermsUrl,
    ],
    verifiedAt,
    contentUpdatedAt: verifiedAt,
    stabilityNote: "完整边界是固定 openai/openai-openapi revision 中 openapi.json 的 288 个 Endpoint（GET 122 / POST 123 / DELETE 43）和 1,421 个 Schema，其中 7 个 Endpoint 声明类型化 SSE 流式响应。MIT 适用于导入的规范源码；OpenAI Platform 服务使用、官网内容和商标分别受其自身条款约束。Hub 不代理 OpenAI 流量，SDK/CLI 仅使用调用方本地 API key；任何变更操作都必须先预览并获得显式确认。",
  },
  pricing: {
    status: "paid",
    summary: "OpenAI Platform 的模型用量计费、套餐和账户资格由 OpenAI 的当前定价与服务条款决定；Pontx 不代售、转售或代表 OpenAI 报价。",
    officialUrl: "https://openai.com/api/pricing/",
    verifiedAt,
  },
  credentials: [
    {
      schemeId: "ApiKeyAuth",
      envVar: "OPENAI_API_KEY",
      description: "OpenAI Platform API key。SDK/CLI 只从调用方本地环境读取，不能写入请求示例、日志或 Hub。",
      guide: {
        url: "https://platform.openai.com/docs/quickstart",
        title: "获取 OpenAI API key",
        steps: [
          "在 OpenAI Platform 创建 API key，并按用途授予最低权限。",
          "将 API key 仅放入调用方本地环境变量 OPENAI_API_KEY。",
          "先用只读 Endpoint 生成脱敏预览，再执行请求。",
        ],
      },
    },
    {
      schemeId: "AdminApiKeyAuth",
      envVar: "OPENAI_ADMIN_API_KEY",
      description: "组织管理 Endpoint 所需的 admin API key。仅调用方本地使用，限制到所需最低权限；不得写入示例、日志或 Hub。",
    },
  ],
  quickStart: { operationId: "listModels", requestExampleId: "default" },
};
const productEn = {
  display: {
    title: "OpenAI API",
    summary: "All 288 OpenAI Platform REST endpoints from a fixed MIT-licensed official revision, including typed SSE streaming and Realtime call management. Hub provides documentation and an independent SDK/CLI, but never proxies model, account, or usage data; callers connect directly with local API keys.",
    accent: "#10A37F",
  },
  documentation: {
    status: "official",
    evidence: product.documentation.evidence,
    verifiedAt,
    contentUpdatedAt: verifiedAt,
    stabilityNote: "The complete boundary is all 288 endpoints (GET 122 / POST 123 / DELETE 43) and 1,421 schemas in openapi.json at the fixed openai/openai-openapi revision, of which 7 endpoints declare typed SSE streaming responses. MIT applies to the imported specification source; OpenAI Platform service use, website content, and trademarks are governed separately. Hub does not proxy OpenAI traffic; SDK/CLI credentials stay caller-local, and every mutation needs a preview and explicit confirmation.",
  },
  pricing: {
    status: "paid",
    summary: "OpenAI Platform model usage billing, plans, and account eligibility are governed by OpenAI's current pricing and service terms. Pontx neither resells the service nor quotes for OpenAI.",
    officialUrl: "https://openai.com/api/pricing/",
    verifiedAt,
  },
  credentials: [
    {
      schemeId: "ApiKeyAuth",
      description: "OpenAI Platform API key. The SDK/CLI reads it only from the caller-local environment; it must never appear in request examples, logs, or Hub.",
      guide: {
        title: "Get an OpenAI API key",
        steps: [
          "Create an API key in OpenAI Platform with the least privilege required for the task.",
          "Keep it only in the caller-local OPENAI_API_KEY environment variable.",
          "Generate a redacted preview with a read endpoint before executing a request.",
        ],
      },
    },
    {
      schemeId: "AdminApiKeyAuth",
      description: "Admin API key required for organization administration endpoints. Use caller-locally with least privilege only; never place it in examples, logs, or Hub.",
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
    throw new Error(`OpenAI SDK method collision for ${tag || "root"}.${methodName} at ${apiKey}`);
  }
  sdkControllerMethods.add(controllerMethod);
}
const sdk = {
  formatVersion: 1,
  package: {
    name: "@pontx/openai",
    version: "0.1.0",
    status: "published",
    repository: "https://github.com/pontjs/openai",
  },
  cli: { name: "pontx-openai" },
  contract: {
    client: {
      kind: "factory",
      factory: "createOpenAiClient",
      identifier: "client",
      options: {
        apiKey: "OPENAI_API_KEY",
      },
    },
    controllers: Object.fromEntries(controllerEntries),
    methodNames: Object.fromEntries(
      sdkMethodEntries.map(([operationId, methodName]) => [operationId, methodName]),
    ),
  },
  examples: {
    typescript: "import { createOpenAiClient } from \"@pontx/openai\";\n\nconst client = createOpenAiClient();\nconst models = await client.models.listModels();",
    cli: "pnpm add --global @pontx/openai\n\npontx-openai call models listModels --dry-run",
  },
  coverage: { mode: "full" },
  quality: {
    testedVersion: "0.1.0",
    unitTests: {
      passed: 4,
      total: 4,
      skipped: 0,
    },
    e2eStatus: "passed",
    nodeVersions: ["18", "20", "22"],
    sourceCommit: "f5036814eb2233778b6c4c22e75f897ee30f10df",
    testedAt: "2026-08-16",
    repositoryUrl: "https://github.com/pontjs/openai",
    workflowRunUrl: "https://github.com/pontjs/openai/actions/runs/31893519355",
  },
  spec: {
    path: "products/openai/spec.pontx.json",
    sha256: sha256(zhBytes),
    metadataCommit: "3a415bf4358cf353176b82aa4171eede3a4d41f7",
  },
};
const provenance = {
  formatVersion: 1,
  source: {
    repository: `https://github.com/openai/openai-openapi/tree/${revision}`,
    revision,
    url: sourceUrl,
    sha256: sourceSha256,
    license: {
      name: "MIT",
      url: licenseUrl,
      sha256: licenseSha256,
    },
    observedAt: verifiedAt,
    importMethod: "one-time @pontx/spec importOpenAPI conversion; generated PontxSpec is canonical after import",
    boundary: {
      endpoints: importedApis.length,
      schemas: importedSchemas.length,
      methods: methodCounts,
      sseEndpoints: sseCount,
    },
    transformations: [
      "Preserved all imported Endpoint methods, paths, tags, security requirements, parameters, response statuses, media types, typed SSE contracts, Schema constraints, enums, defaults, and reference topology.",
      `Normalized ${normalizedOperationIdCount} official dashed operationIds and ${normalizedSchemaCount} dashed Schema names to valid camelCase identifiers (matching OpenAI's own official SDK naming); every $ref was rewritten consistently and the mapping is deterministic.`,
      "Replaced supplier prose with independently authored Chinese and English product, Endpoint, response, tag, Schema, and field text; locale files differ only in prose.",
      "Added one reviewed request outline per Endpoint. Required model, resource, and body inputs are declared as runtime-bound rather than fabricated as executable production data.",
      "Applied direct-only execution policy to every OpenAI Endpoint; no Hub proxy stores, relays, caches, or logs caller credentials or provider responses.",
      "The dedicated wss:// Realtime WebSocket protocol is documented by OpenAI outside this repository's machine contract and remains out of scope; it is neither invented nor trimmed from the OAS.",
    ],
  },
  legalReview: {
    sourceLicense: "The fixed openai/openai-openapi repository revision and its LICENSE grant MIT permissions for the imported source file.",
    serviceBoundary: "OpenAI Platform use remains governed by the OpenAI Services Agreement; this package neither resells nor sublicenses the service.",
    websiteBoundary: "Product prose is independently authored. OpenAI website documentation is used only as linked evidence and is not copied as page content.",
    trademarkBoundary: "OpenAI is used descriptively to identify interoperability. Pontx is independently branded and does not claim endorsement.",
  },
  riskReview: {
    classification: "paid-ai-platform-with-user-data",
    hubProxyEnabled: false,
    readEndpoints: methodCounts.GET,
    mutations: {
      count: mutationCount,
      methods: { POST: methodCounts.POST, DELETE: methodCounts.DELETE },
    },
    credentialPolicy: "OpenAI API keys (and admin keys where required) remain in the caller environment only. No credential appears in generated examples, Hub, logs, provenance, or SDK output.",
    executionPolicy: "Hub execution is disabled for all OpenAI traffic. The local CLI previews every call, redacts sensitive values, and requires exact request-bound explicit confirmation before every mutation; paid inference calls are never issued for verification.",
    sensitiveAreas: ["model prompts and completions", "organization and account administration", "API keys and certificates", "usage, costs, and audit data", "fine-tuning, files, and uploaded content"],
  },
};
const attribution = `# OpenAI API attribution\n\nThe canonical PontxSpec in this product was imported from [openai/openai-openapi@${revision}](https://github.com/openai/openai-openapi/tree/${revision}) at [openapi.json](${sourceUrl}). That source file is covered by the accompanying MIT license retained in this directory.\n\nOpenAI Platform service use is governed separately by the [OpenAI Services Agreement](${servicesAgreementUrl}). This independently branded Pontx SDK/CLI is not endorsed by OpenAI. OpenAI is used descriptively for compatible API interoperability.\n`;

await mkdir(resolve(productRoot, "locales/en-US"), { recursive: true });
await mkdir(resolve(productRoot, "sources"), { recursive: true });
await writeOrCheck(resolve(productRoot, "spec.pontx.json"), zhBytes, checkOnly);
await writeOrCheck(resolve(productRoot, "locales/en-US/spec.pontx.json"), enBytes, checkOnly);
await writeOrCheck(resolve(productRoot, "product.json"), Buffer.from(`${JSON.stringify(product, null, 2)}\n`), checkOnly);
await writeOrCheck(resolve(productRoot, "locales/en-US/product.json"), Buffer.from(`${JSON.stringify(productEn, null, 2)}\n`), checkOnly);
await writeOrCheck(resolve(productRoot, "sdk.json"), Buffer.from(`${JSON.stringify(sdk, null, 2)}\n`), checkOnly);
await writeOrCheck(resolve(productRoot, "sources/provenance.json"), Buffer.from(`${JSON.stringify(provenance, null, 2)}\n`), checkOnly);
await writeOrCheck(resolve(productRoot, "sources/LICENSE.openai-openapi"), licenseBytes, checkOnly);
await writeOrCheck(resolve(productRoot, "sources/ATTRIBUTION.md"), Buffer.from(attribution), checkOnly);
console.log(`OpenAI API ${checkOnly ? "verified" : "built"}: ${importedApis.length} Endpoints, ${importedSchemas.length} Schemas, ${sseCount} SSE, ${mutationCount} mutations, ${sha256(zhBytes)}.`);
