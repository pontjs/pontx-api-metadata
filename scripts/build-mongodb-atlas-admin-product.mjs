/**
 * Rebuild the complete MongoDB Atlas Administration API v2 PontxSpec pair
 * from one immutable, Apache-2.0 licensed OpenAPI source. The generated
 * PontxSpec is canonical; this script is only an audited import utility.
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
const productRoot = resolve(root, "products/mongodb-atlas-admin");
const revision = "1287e6eb1c4fa28e13f1a76e16f18055d3e9e029";
const sourceUrl = `https://raw.githubusercontent.com/mongodb/openapi/${revision}/openapi/v2.json`;
const sourceSha256 = "3c39ed724df4079b2c1ede6156e23590f0defa45b821c68f059d3bb5e9d89461";
const licenseUrl = `https://raw.githubusercontent.com/mongodb/openapi/${revision}/LICENSE`;
const licenseSha256 = "c71d239df91726fc519c6eb72d318ec65820627232b2f796219e87dcf35d0ab4";
const officialReferenceUrl = "https://www.mongodb.com/docs/atlas/reference/api-resources-spec/v2/";
const cloudTermsUrl = "https://www.mongodb.com/legal/terms-and-conditions/cloud";
const trademarkUrl = "https://www.mongodb.com/legal/trademark-usage-guidelines";
const verifiedAt = "2026-08-15";
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
  const tokens = words(value).match(/[A-Za-z0-9]+/g) ?? ["atlas"];
  const identifier = tokens.map((token, index) => {
    const normalized = token.toLowerCase();
    return index === 0 ? normalized : `${normalized[0].toUpperCase()}${normalized.slice(1)}`;
  }).join("");
  return /^[A-Za-z_$]/.test(identifier) ? identifier : `atlas${identifier}`;
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
    `${label} value in the Atlas Administration API contract.`,
    `Atlas Administration API 合约中的 ${label} 值。`,
  );
}

function schemaDescription(name, language) {
  const label = words(name);
  return localText(
    language,
    `Structural definition for ${label} in the Atlas Administration API contract.`,
    `Atlas Administration API 合约中的 ${label} 结构定义。`,
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
        reason: "Caller-owned Atlas account, organization, project, or resource state is required at runtime.",
      },
    }));
  return {
    default: {
      summary: localText(
        language,
        "Reviewed caller-local request outline with runtime-bound resource inputs.",
        "已审阅的调用方本地请求轮廓；资源输入在运行时提供。",
      ),
      request: { path: {}, query: {}, headers: {} },
      ...(unresolved.length ? { unresolved } : {}),
      expectedStatus: expectedSuccessStatus(api.responses, api.operationId),
      serverUrl: "https://cloud.mongodb.com",
      verifiedAt,
    },
  };
}

function endpointExecution(api, language) {
  const mutation = !["GET", "HEAD", "OPTIONS"].includes(String(api.method).toUpperCase());
  return {
    enabled: false,
    permission: mutation ? "mutation" : "read",
    disabledReason: mutation
      ? localText(
        language,
        "This Atlas management endpoint can create, change, or delete persistent resources. Pontx Hub does not proxy it; the local CLI must show a redacted preview and obtain request-bound explicit confirmation before execution.",
        "该 Atlas 管理接口可能创建、变更或删除持久资源。Pontx Hub 不代理执行；本地 CLI 必须先展示脱敏预览，并在执行前取得请求绑定的显式确认。",
      )
      : localText(
        language,
        "This authenticated Atlas management read is direct-only. Pontx Hub does not proxy account, organization, project, or operational data; use caller-local credentials with the SDK or CLI.",
        "该经认证的 Atlas 管理读取仅支持直连。Pontx Hub 不代理账户、组织、项目或运行数据；请通过 SDK 或 CLI 使用调用方本地凭证。",
      ),
  };
}

function copySecuritySchemes(schemes, language) {
  return Object.fromEntries(Object.entries(schemes ?? {}).map(([name, scheme]) => {
    const copied = clone(scheme) ?? {};
    delete copied.description;
    copied.description = localText(
      language,
      `${words(name)} authentication for caller-local MongoDB Atlas Administration API requests.`,
      `用于调用方本地 MongoDB Atlas Administration API 请求的 ${words(name)} 认证。`,
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
        `Contract-preserving ${String(api.method).toUpperCase()} endpoint for ${words(api.operationId)} in the MongoDB Atlas Administration API. Resource-specific values are supplied by the caller at runtime.`,
        `MongoDB Atlas Administration API 中用于 ${words(api.operationId)} 的保留合约 ${String(api.method).toUpperCase()} Endpoint。资源相关值由调用方在运行时提供。`,
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
      requestExamples: requestExample(api, language),
      metadata: {
        documentation: {
          status: "official",
          evidence: [sourceUrl, officialReferenceUrl],
          verifiedAt,
          stabilityNote: localText(
            language,
            "Wire contract imported from the fixed Apache-2.0 source revision; surrounding prose is independently curated.",
            "连线合约由固定 Apache-2.0 源码 revision 导入；周边说明为独立编写。",
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
        `${name} endpoints in the Atlas Administration API contract.`,
        `Atlas Administration API 合约中的 ${name} Endpoint。`,
      ),
    }));
  const schemas = Object.fromEntries(Object.entries(imported.components?.schemas ?? {}).map(([name, schema]) => [
    name,
    copySchema(schema, language, { kind: "schema", name }),
  ]));
  return loadPontxSpec({
    pontx: "2.1",
    style: "RESTFul",
    name: "mongodb-atlas-admin",
    info: {
      title: "MongoDB Atlas Administration API v2",
      version: "2.0",
      description: localText(
        language,
        "The complete MongoDB Atlas Administration API v2 contract from a fixed, Apache-2.0 licensed OpenAPI source. Atlas management traffic is direct-only: caller-owned credentials stay local, and every mutation requires a redacted preview and explicit confirmation in the local CLI.",
        "来自固定 Apache-2.0 许可 OpenAPI 源码的完整 MongoDB Atlas Administration API v2 合约。Atlas 管理流量仅支持直连：调用方凭证保留在本地，每个变更操作都必须在本地 CLI 中先经脱敏预览和显式确认。",
      ),
    },
    servers: [{
      id: "atlas-production",
      url: "https://cloud.mongodb.com",
      description: localText(
        language,
        "MongoDB Atlas production HTTPS API endpoint.",
        "MongoDB Atlas 生产 HTTPS API Endpoint。",
      ),
    }],
    security: clone(imported.security ?? []),
    externalDocs: {
      url: officialReferenceUrl,
      description: localText(language, "Official MongoDB Atlas API reference.", "MongoDB Atlas 官方 API 参考。"),
    },
    components: {
      schemas,
      securitySchemes: copySecuritySchemes(imported.components?.securitySchemes, language),
    },
    tags,
    apis,
  }, { expectedName: "mongodb-atlas-admin" });
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
  throw new Error("Usage: node scripts/build-mongodb-atlas-admin-product.mjs [--write|--check]");
}
const [sourceBytes, licenseBytes] = await Promise.all([curlBytes(sourceUrl), curlBytes(licenseUrl)]);
if (sha256(sourceBytes) !== sourceSha256) {
  throw new Error(`MongoDB OpenAPI source changed: expected ${sourceSha256}, received ${sha256(sourceBytes)}`);
}
if (sha256(licenseBytes) !== licenseSha256) {
  throw new Error(`MongoDB OpenAPI LICENSE changed: expected ${licenseSha256}, received ${sha256(licenseBytes)}`);
}
const imported = importOpenAPI(JSON.parse(sourceBytes.toString("utf8")), { name: "mongodb-atlas-admin" });
const importedApis = Object.values(imported.apis ?? {});
const importedSchemas = Object.keys(imported.components?.schemas ?? {});
if (importedApis.length !== 540 || importedSchemas.length !== 1145) {
  throw new Error(`Unexpected MongoDB Atlas source boundary: ${importedApis.length} Endpoints, ${importedSchemas.length} Schemas`);
}
const methodCounts = Object.fromEntries(["GET", "POST", "PATCH", "PUT", "DELETE"].map((method) => [
  method,
  importedApis.filter((api) => String(api.method).toUpperCase() === method).length,
]));
if (JSON.stringify(methodCounts) !== JSON.stringify({ GET: 268, POST: 115, PATCH: 67, PUT: 10, DELETE: 80 })) {
  throw new Error(`Unexpected MongoDB Atlas method boundary: ${JSON.stringify(methodCounts)}`);
}
const zh = buildSpec(imported, "zh-CN");
const en = buildSpec(imported, "en-US");
const zhBytes = Buffer.from(`${JSON.stringify(PontxSpec.reOrder(zh), null, 2)}\n`);
const enBytes = Buffer.from(`${JSON.stringify(PontxSpec.reOrder(en), null, 2)}\n`);
const tags = [...new Set(importedApis.flatMap((api) => api.tags ?? []))].sort();
const controllerEntries = tags.map((tag) => [tag, camelIdentifier(tag)]);
if (new Set(controllerEntries.map(([, property]) => property)).size !== controllerEntries.length) {
  throw new Error("Atlas tag-to-controller mapping is not collision free");
}
const mutationCount = importedApis.filter((api) => !["GET", "HEAD", "OPTIONS"].includes(String(api.method).toUpperCase())).length;
const product = {
  formatVersion: 1,
  slug: "mongodb-atlas-admin",
  name: "MongoDB Atlas Administration API v2",
  provider: "MongoDB",
  category: "Cloud",
  featured: true,
  display: {
    title: "MongoDB Atlas 管理 API v2",
    summary: "覆盖固定 Apache-2.0 OpenAPI revision 中全部 540 个 MongoDB Atlas 管理 Endpoint。Hub 提供文档与独立 SDK/CLI，但不代理账户、组织、项目、网络、备份或运行数据；调用方通过本地凭证直连。",
    accent: "#13AA52",
  },
  legal: {
    license: "Apache-2.0 for the imported OpenAPI source; MongoDB Cloud service, website, and trademark terms apply separately.",
    attributionUrl: `https://github.com/mongodb/openapi/tree/${revision}`,
  },
  documentation: {
    status: "official",
    evidence: [
      sourceUrl,
      `https://github.com/mongodb/openapi/tree/${revision}`,
      licenseUrl,
      officialReferenceUrl,
      cloudTermsUrl,
      trademarkUrl,
    ],
    verifiedAt,
    contentUpdatedAt: verifiedAt,
    stabilityNote: "完整边界是固定 mongodb/openapi revision 中 openapi/v2.json 的 540 个 Endpoint 和 1,145 个 Schema。Apache-2.0 适用于导入的规范源码；MongoDB Cloud 服务使用、官网内容和商标分别受其自身条款约束。Hub 不代理 Atlas 管理流量，SDK/CLI 仅使用调用方本地凭证；任何变更操作都必须先预览并获得显式确认。",
  },
  pricing: {
    status: "paid",
    summary: "MongoDB Atlas 的套餐、资源计费和账户资格由 MongoDB 的当前定价与服务条款决定；Pontx 不代售、转售或代表 MongoDB 报价。",
    officialUrl: "https://www.mongodb.com/pricing",
    verifiedAt,
  },
  credentials: [
    {
      schemeId: "ServiceAccounts",
      envVar: "MONGODB_ATLAS_SERVICE_ACCOUNT_CLIENT_ID",
      secretEnvVar: "MONGODB_ATLAS_SERVICE_ACCOUNT_CLIENT_SECRET",
      description: "OAuth 服务账号客户端 ID。SDK/CLI 还要求 MONGODB_ATLAS_SERVICE_ACCOUNT_CLIENT_SECRET；两项凭证只保留在调用方本地环境，不能写入请求示例、日志或 Hub。",
      guide: {
        url: "https://www.mongodb.com/docs/atlas/configure-api-access/",
        title: "配置 Atlas OAuth 服务账号",
        steps: [
          "在 Atlas 中创建仅具所需最低权限的服务账号。",
          "将客户端 ID 和客户端密钥仅放入调用方本地环境变量。",
          "先用只读 Endpoint 生成脱敏预览，再执行请求。",
        ],
      },
    },
    {
      schemeId: "DigestAuth",
      usernameEnvVar: "MONGODB_ATLAS_PUBLIC_KEY",
      passwordEnvVar: "MONGODB_ATLAS_PRIVATE_KEY",
      description: "旧版 Digest API 公钥和私钥。仅在调用方仍需该认证方式时使用，并限制到最低权限；不得写入示例、日志或 Hub。",
    },
  ],
  quickStart: { operationId: "listOrgs", requestExampleId: "default" },
};
const productEn = {
  display: {
    title: "MongoDB Atlas Administration API v2",
    summary: "All 540 MongoDB Atlas administration endpoints from a fixed Apache-2.0 OpenAPI revision. Hub provides documentation and an independent SDK/CLI, but never proxies account, organization, project, network, backup, or operational data; callers connect directly with local credentials.",
    accent: "#13AA52",
  },
  documentation: {
    status: "official",
    evidence: product.documentation.evidence,
    verifiedAt,
    contentUpdatedAt: verifiedAt,
    stabilityNote: "The complete boundary is all 540 endpoints and 1,145 schemas in openapi/v2.json at the fixed mongodb/openapi revision. Apache-2.0 applies to the imported specification source; MongoDB Cloud service use, website content, and trademarks are governed separately. Hub does not proxy Atlas management traffic; SDK/CLI credentials stay caller-local, and every mutation needs a preview and explicit confirmation.",
  },
  pricing: {
    status: "paid",
    summary: "MongoDB Atlas plans, resource billing, and account eligibility are governed by MongoDB's current pricing and service terms. Pontx neither resells the service nor quotes for MongoDB.",
    officialUrl: "https://www.mongodb.com/pricing",
    verifiedAt,
  },
  credentials: [
    {
      schemeId: "ServiceAccounts",
      description: "OAuth service-account client ID. The SDK/CLI also requires MONGODB_ATLAS_SERVICE_ACCOUNT_CLIENT_SECRET; both values remain only in the caller-local environment and must not appear in request examples, logs, or Hub.",
      guide: {
        title: "Configure an Atlas OAuth service account",
        steps: [
          "Create an Atlas service account with only the minimum required role.",
          "Keep its client ID and client secret only in caller-local environment variables.",
          "Generate a redacted preview with a read endpoint before executing a request.",
        ],
      },
    },
    {
      schemeId: "DigestAuth",
      description: "Legacy Digest API public and private keys. Use this mode only where the caller still requires it, keep least privilege, and never place either value in examples, logs, or Hub.",
    },
  ],
};
const sdk = {
  formatVersion: 1,
  package: {
    name: "@pontx/mongodb-atlas-admin",
    version: "0.1.0",
    status: "published",
    repository: "https://github.com/pontjs/mongodb-atlas-admin",
  },
  cli: { name: "pontx-mongodb-atlas-admin" },
  contract: {
    client: {
      kind: "factory",
      factory: "createMongoDbAtlasAdminClient",
      identifier: "client",
      options: {
        clientId: "MONGODB_ATLAS_SERVICE_ACCOUNT_CLIENT_ID",
        clientSecret: "MONGODB_ATLAS_SERVICE_ACCOUNT_CLIENT_SECRET",
      },
    },
    // Pontx generated clients pass an explicit query object before any body.
    // Keep this public call shape explicit so Hub-generated SDK snippets are
    // checked against the package rather than relying on a global convention.
    argumentOrder: ["path", "query", "body"],
    controllers: Object.fromEntries(controllerEntries),
  },
  examples: {
    typescript: "import { createMongoDbAtlasAdminClient } from \"@pontx/mongodb-atlas-admin\";\n\nconst client = createMongoDbAtlasAdminClient();\nconst organizations = await client.organizations.listOrgs({});",
    cli: "pnpm add --global @pontx/mongodb-atlas-admin\n\npontx-mongodb-atlas-admin call organizations listOrgs --dry-run",
  },
  coverage: { mode: "full" },
  spec: {
    path: "products/mongodb-atlas-admin/spec.pontx.json",
    sha256: sha256(zhBytes),
    metadataCommit: "8bd9128f25e92191072624212626540d68d543e1",
  },
  quality: {
    testedVersion: "0.1.0",
    unitTests: { passed: 4, total: 4, skipped: 0 },
    e2eStatus: "passed",
    nodeVersions: ["18", "20", "22"],
    sourceCommit: "30539888cf6795b3a67f7cf948bbb84d19527ebf",
    testedAt: "2026-08-15",
    repositoryUrl: "https://github.com/pontjs/mongodb-atlas-admin",
    workflowRunUrl: "https://github.com/pontjs/mongodb-atlas-admin/actions/runs/31891578691",
  },
};
const provenance = {
  formatVersion: 1,
  source: {
    repository: `https://github.com/mongodb/openapi/tree/${revision}`,
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
      endpoints: importedApis.length,
      schemas: importedSchemas.length,
      methods: methodCounts,
    },
    transformations: [
      "Preserved all imported endpoint methods, paths, operation IDs, tags, security requirements, parameters, response statuses, media types, Schema constraints, enums, defaults, and reference topology.",
      "Replaced supplier prose with independently authored Chinese and English product, Endpoint, response, tag, Schema, and field text; locale files differ only in prose.",
      "Added one reviewed request outline per Endpoint. Required account, organization, project, resource, and body inputs are declared as runtime-bound rather than fabricated as executable production data.",
      "Applied direct-only execution policy to every authenticated Atlas management Endpoint; no Hub proxy stores, relays, caches, or logs caller credentials or provider responses.",
    ],
  },
  legalReview: {
    sourceLicense: "The fixed mongodb/openapi repository revision and its LICENSE grant Apache-2.0 permissions for the imported source file.",
    serviceBoundary: "MongoDB Cloud use remains governed by MongoDB Cloud terms; this package neither resells nor sublicenses the service.",
    websiteBoundary: "Product prose is independently authored. MongoDB website documentation is used only as linked evidence and is not copied as page content.",
    trademarkBoundary: "MongoDB and Atlas are used descriptively to identify interoperability. Pontx is independently branded and does not claim endorsement.",
  },
  riskReview: {
    classification: "high-impact-cloud-administration",
    hubProxyEnabled: false,
    readEndpoints: methodCounts.GET,
    mutations: {
      count: mutationCount,
      methods: { POST: methodCounts.POST, PATCH: methodCounts.PATCH, PUT: methodCounts.PUT, DELETE: methodCounts.DELETE },
    },
    credentialPolicy: "OAuth service-account client credentials or legacy Digest key pairs remain in the caller environment only. No credential appears in generated examples, Hub, logs, provenance, or SDK output.",
    executionPolicy: "Hub execution is disabled for all Atlas management traffic. The local CLI previews every call, redacts sensitive values, and requires exact request-bound explicit confirmation before every mutation.",
    sensitiveAreas: ["account and organization data", "project and cluster configuration", "network and private endpoint configuration", "database access and API credentials", "backup, restore, billing, logs, and audit data"],
  },
};
const attribution = `# MongoDB Atlas Administration API v2 attribution\n\nThe canonical PontxSpec in this product was imported from [mongodb/openapi@${revision}](https://github.com/mongodb/openapi/tree/${revision}) at [openapi/v2.json](${sourceUrl}). That source file is covered by the accompanying Apache-2.0 license retained in this directory.\n\nMongoDB Cloud service use is governed separately by the [MongoDB Cloud Terms](${cloudTermsUrl}). This independently branded Pontx SDK/CLI is not endorsed by MongoDB. MongoDB and Atlas are used descriptively for compatible API interoperability.\n`;

await mkdir(resolve(productRoot, "locales/en-US"), { recursive: true });
await mkdir(resolve(productRoot, "sources"), { recursive: true });
await writeOrCheck(resolve(productRoot, "spec.pontx.json"), zhBytes, checkOnly);
await writeOrCheck(resolve(productRoot, "locales/en-US/spec.pontx.json"), enBytes, checkOnly);
await writeOrCheck(resolve(productRoot, "product.json"), Buffer.from(`${JSON.stringify(product, null, 2)}\n`), checkOnly);
await writeOrCheck(resolve(productRoot, "locales/en-US/product.json"), Buffer.from(`${JSON.stringify(productEn, null, 2)}\n`), checkOnly);
await writeOrCheck(resolve(productRoot, "sdk.json"), Buffer.from(`${JSON.stringify(sdk, null, 2)}\n`), checkOnly);
await writeOrCheck(resolve(productRoot, "sources/provenance.json"), Buffer.from(`${JSON.stringify(provenance, null, 2)}\n`), checkOnly);
await writeOrCheck(resolve(productRoot, "sources/LICENSE.mongodb-openapi"), licenseBytes, checkOnly);
await writeOrCheck(resolve(productRoot, "sources/ATTRIBUTION.md"), Buffer.from(attribution), checkOnly);
console.log(`MongoDB Atlas Administration API v2 ${checkOnly ? "verified" : "built"}: ${importedApis.length} Endpoints, ${importedSchemas.length} Schemas, ${mutationCount} mutations, ${sha256(zhBytes)}.`);
