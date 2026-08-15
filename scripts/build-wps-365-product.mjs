import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import {
  root, outputRoot, sourceUrl, curatedUrl, sourceSha256, curatedSha256, verifiedAt, apiVersion, baseUrl,
  methods, sha256, words, copySchema, responseDescription, sampleForSchema,
  pathValue, queryValue, yaml,
  importOpenAPI, loadPontxSpec, validatePontxSpec, validatePontxSpecLocale, evaluatePontxQuality, PontxSpec,
  mkdir, writeFile,
} from "./lib/wps365-shared.mjs";

// ---------------------------------------------------------------------------
// Load pinned official sources (byte-verified)
// ---------------------------------------------------------------------------
const sourceBytes = await readFile(resolve(outputRoot, "sources/openapi.yaml"));
if (sha256(sourceBytes) !== sourceSha256) {
  throw new Error("WPS 365 official spec changed: expected " + sourceSha256 + ", got " + sha256(sourceBytes));
}
const curatedBytes = await readFile(resolve(outputRoot, "sources/curated.yaml"));
if (sha256(curatedBytes) !== curatedSha256) {
  throw new Error("WPS 365 curated spec changed: expected " + curatedSha256 + ", got " + sha256(curatedBytes));
}
const doc = yaml.load(sourceBytes.toString("utf8"));
const curated = yaml.load(curatedBytes.toString("utf8"));
const imported = importOpenAPI(doc, { name: "wps-365" });

// ---------------------------------------------------------------------------
// Derivation: stable operationIds anchored on curated command IDs
// ---------------------------------------------------------------------------
function camelParts(parts) {
  return parts
    .map((p, i) => {
      const clean = String(p).replace(/[^a-zA-Z0-9]+/g, " ").trim();
      if (!clean) return "";
      const words = clean.split(/\s+/).filter(Boolean);
      if (i === 0) return words[0].toLowerCase() + words.slice(1).map((w) => w.charAt(0).toUpperCase() + w.slice(1)).join("");
      return words.map((w) => w.charAt(0).toUpperCase() + w.slice(1)).join("");
    })
    .join("");
}

function buildDerivation(imported, curated) {
  const anchors = new Map();
  for (const cmd of curated.commands || []) {
    anchors.set(cmd.method.toUpperCase() + " " + cmd.path, cmd.id);
  }
  const derivation = new Map();
  for (const [key, api] of Object.entries(imported.apis)) {
    const method = String(api.method || "").toUpperCase();
    const path = api.path;
    const anchor = anchors.get(method + " " + path);
    const segs = path.split("/").filter(Boolean);
    const moduleName = segs[1] || "misc";
    let id;
    if (anchor) {
      id = anchor.split(".").map((p, i) => {
        const clean = p.split(/[-_]+/).filter(Boolean);
        if (i === 0) {
          return clean.map((w, j) => (j === 0 ? w : w.charAt(0).toUpperCase() + w.slice(1))).join("");
        }
        return clean.map((w) => w.charAt(0).toUpperCase() + w.slice(1)).join("");
      }).join("");
    } else {
      const verb = { GET: "List", POST: "Create", DELETE: "Delete" }[method] || "Call";
      const noun = camelParts([moduleName]);
      const action = camelParts(segs.slice(2).filter((s) => !s.startsWith("{")));
      id = noun + (action || verb);
      if (method === "GET" && !segs.slice(2).some((s) => !s.startsWith("{"))) id = noun + "List";
      if (!id) id = method.toLowerCase() + "Root";
    }
    derivation.set(key, { id, tag: moduleName });
  }
  // ensure uniqueness
  const used = new Map();
  for (const [key, entry] of derivation) {
    let final = entry.id;
    let n = 1;
    while (used.has(final)) {
      n += 1;
      final = entry.id + n;
    }
    used.set(final, key);
    derivation.set(key, { id: final, tag: entry.tag });
  }
  return derivation;
}

const derivation = buildDerivation(imported, curated);
const tagMapRaw = JSON.parse(await readFile(resolve(outputRoot, "sources/tag-map.json"), "utf8"));
// tagMapRaw: { modules: { "<module>": "<tagSlug>" }, coop: { "<submodule>": "<tagSlug>" }, tags: { "<tagSlug>": { zh, en } } }
const moduleToTag = tagMapRaw.modules;
const coopSubTag = tagMapRaw.coop || {};
const tagText = tagMapRaw.tags || {};

function tagForPath(path) {
  const segs = path.split("/").filter(Boolean);
  const moduleName = segs[1] || "misc";
  if (moduleName === "coop") {
    const sub = segs[2] || "files";
    return coopSubTag[sub] || "cooperation";
  }
  return moduleToTag[moduleName] || "misc";
}

// Validate: every endpoint resolves a tag with text
const unresolvedTags = new Set();
for (const [, api] of Object.entries(imported.apis)) {
  const tag = tagForPath(api.path);
  if (!tagText[tag]) unresolvedTags.add(tag);
}
if (unresolvedTags.size) {
  throw new Error("Missing tag text for: " + [...unresolvedTags].join(", "));
}

// ---------------------------------------------------------------------------
// Endpoint-level bilingual prose (anchored by curated command where available)
// ---------------------------------------------------------------------------
const curatedAnchorText = {}; // method+path -> { zh: [summary, description] }
for (const cmd of curated.commands || []) {
  const key = cmd.method.toUpperCase() + " " + cmd.path;
  curatedAnchorText[key] = [cmd.summary || "", cmd.description || ""];
}

function endpointTextFor(api, language, tag) {
  const anchor = curatedAnchorText[(api.method || "").toUpperCase() + " " + api.path];
  const moduleLabel = words(tagForPath(api.path));
  const methodVerb = {
    GET: language === "zh" ? "查询" : "Get",
    POST: language === "zh" ? "创建或执行" : "Create or run",
    DELETE: language === "zh" ? "删除" : "Delete",
  }[String(api.method || "").toUpperCase()] || (language === "zh" ? "调用" : "Call");
  if (anchor && anchor[0]) {
    return {
      zh: [anchor[0], anchor[1] || (methodVerb + "「" + moduleLabel + "」资源。")],
      en: [methodVerb + " " + moduleLabel + " resource", methodVerb + " the " + moduleLabel + " resource."],
    };
  }
  const pathTail = words(String(api.path.split("/").pop() || ""));
  const zhTitle = methodVerb + (pathTail ? "「" + pathTail + "」" : "「" + moduleLabel + "」资源");
  const enTitle = methodVerb + " " + (pathTail || moduleLabel) + " resource";
  return {
    zh: [zhTitle, zhTitle + "；通过 " + String(api.method || "").toUpperCase() + " " + api.path + " 调用。"],
    en: [enTitle, enTitle + " via " + String(api.method || "").toUpperCase() + " " + api.path + "."],
  };
}

// ---------------------------------------------------------------------------
// Build one locale PontxSpec
// ---------------------------------------------------------------------------
function disabledReason(language) {
  return language === "zh"
    ? "WPS 365 企业数据（通讯录、云文档、消息、会议、邮件等）属于最终用户的私有业务数据，且 WPS 开放平台开发者协议对集成方施加数据使用与隐私义务；Pontx Hub 不代理、缓存或聚合 WPS 365 数据。请由调用方使用本地 SDK/CLI 直连，并自行承担与 WPS 之间的条款与数据合规责任。"
    : "WPS 365 enterprise data (contacts, cloud documents, messaging, meetings, mail, etc.) is private business data of end users, and the WPS Open Platform developer agreement imposes data-handling and privacy obligations on integrators; Pontx Hub does not proxy, cache, or aggregate WPS 365 data. Use the local SDK/CLI to call upstream directly and own your own terms and data-compliance obligations with WPS.";
}

function curateApi(key, api, language, schemas) {
  const tag = tagForPath(api.path);
  const text = endpointTextFor(api, language, tag);
  const [summary, description] = language === "zh" ? text.zh : text.en;
  const parameters = (api.parameters ?? []).map((parameter) => ({
    in: parameter.in,
    name: parameter.name,
    required: Boolean(parameter.required),
    schema: parameter.schema ? copySchema(parameter.schema, language, { kind: "field", name: parameter.name }) : undefined,
  }));
  const responses = Object.fromEntries(Object.entries(api.responses ?? {}).map(([status, response]) => [
    status,
    {
      description: responseDescription(status, language),
      ...(response.schema ? { schema: copySchema(response.schema, language, { kind: "schema", name: api.operationId + "Response" }) } : {}),
      ...(response.content ? {
        content: Object.fromEntries(Object.entries(response.content).map(([mediaType, media]) => [
          mediaType,
          media.schema ? { schema: copySchema(media.schema, language, { kind: "schema", name: api.operationId + "Response" }) } : {},
        ])),
      } : {}),
    },
  ]));
  const request = { path: {}, query: {}, headers: {} };
  for (const parameter of parameters) {
    if (parameter.in === "path") request.path[parameter.name] = pathValue(parameter.name, parameter.schema);
    if (parameter.in === "query" && parameter.required) request.query[parameter.name] = queryValue(parameter.name, parameter.schema);
    if (parameter.in === "header" && parameter.required) request.headers[parameter.name] = parameter.name === "X-Kso-Id-Type" ? "internal" : "example";
  }
  const unresolved = [];
  const bodyParameter = parameters.find((parameter) => parameter.in === "body");
  if (bodyParameter && bodyParameter.schema) {
    const sample = sampleForSchema(bodyParameter.schema, schemas, new Set(), 0);
    if (sample !== undefined) {
      request.body = sample;
    } else {
      // Structurally ambiguous or unresolvable body (e.g. overlapping oneOf
      // branches with no single-matching value): declare it a dynamic input
      // instead of fabricating a value. The reason is locale-neutral so both
      // locales stay structurally isomorphic.
      unresolved.push({
        in: "body",
        name: "/",
        source: {
          kind: "runtime",
          reason: "Request body is caller-constructed per business semantics; the upstream oneOf union cannot be statically disambiguated.",
        },
      });
    }
  }
  const evidence = [sourceUrl, curatedUrl];
  const isSse = Object.values(api.responses ?? {}).some((r) =>
    Object.keys(r.content ?? {}).some((ct) => ct.includes("event-stream")));
  const sse = isSse ? {
    events: {
      message: {
        dataFormat: "json",
        description: language === "zh"
          ? "供应商 SSE 事件负载，data 字段结构见该 Endpoint 200 响应的 schema。官方契约未枚举事件名，未知事件保留。"
          : "Supplier SSE event payload; the data field follows the 200 response schema of this endpoint. The official contract does not enumerate event names, so unknown events are preserved.",
      },
    },
    unknownEventPolicy: "preserve",
  } : undefined;
  return {
    summary,
    description,
    operationId: derivation.get(key)?.id ?? api.operationId,
    tags: [tag],
    method: api.method,
    path: api.path,
    consumes: api.consumes ?? [],
    produces: api.produces ?? ["application/json"],
    parameters,
    responses,
    security: api.security ?? [],
    requestExamples: {
      default: {
        summary: language === "zh" ? "可复现的请求示例（不含凭证）" : "Reproducible request example (no credentials)",
        request,
        ...(unresolved.length ? { unresolved } : {}),
        expectedStatus: "200",
        serverUrl: baseUrl,
        verifiedAt,
      },
    },
    ...(sse ? { sse } : {}),
    metadata: {
      documentation: {
        status: "official",
        evidence,
        verifiedAt,
      },
      execution: {
        enabled: false,
        disabledReason: disabledReason(language),
      },
    },
  };
}

function buildSpec(language) {
  const schemas = imported.components.schemas;
  const bareRefTargets = (name) => {
    let schema = schemas[name];
    const seen = new Set();
    while (schema && typeof schema === "object" && Object.keys(schema).length === 1 && schema.$ref) {
      if (seen.has(name)) return schema;
      seen.add(name);
      const target = String(schema.$ref).split("/").pop();
      if (!schemas[target]) return schema;
      schema = schemas[target];
      name = target;
    }
    return schema;
  };
  // Normalize schemas first so request-example sampling uses the same
  // localized, constraint-normalized contract that is published.
  const localizedSchemas = Object.fromEntries(Object.entries(schemas).map(([name, schema]) => [
    name,
    (schema && typeof schema === "object" && Object.keys(schema).length === 1 && schema.$ref)
      ? copySchema(bareRefTargets(name), language, { kind: "schema", name })
      : copySchema(schema, language, { kind: "schema", name }),
  ]));
  const apis = Object.fromEntries(Object.entries(imported.apis)
    .filter(([, api]) => methods.has(String(api.method || "").toLowerCase()))
    .filter(([, api]) => !EXCLUDED.has(String(api.method).toUpperCase() + " " + api.path))
    .map(([key, api]) => {
      const tag = tagForPath(api.path);
      const id = derivation.get(key)?.id ?? api.operationId;
      return [tag + "/" + id, curateApi(key, api, language, localizedSchemas)];
    }));
  const usedTags = [...new Set(Object.values(apis).flatMap((api) => api.tags))];
  return loadPontxSpec({
    pontx: "2.1",
    style: "RESTFul",
    name: "wps-365",
    info: language === "zh"
      ? {
          title: "WPS 365 OpenAPI",
          version: apiVersion,
          description: "WPS 365 统一 OpenAPI（Kingsoft Office Open APIs v7）完整产品面：通讯录与组织、云文档、多维表/智能表格、消息、会议、日历、邮件、待办、审批、wiki 与事件订阅。官方机器契约（open.wps.cn 发布的 OpenAPI 3.0.0，806 paths / 827 operations / 3,119 schemas）由官方 MIT CLI 分发并可字节复现；15 个 /v7/sse/* 端点使用 text/event-stream，事件订阅为加密 HTTP callback。认证为 OAuth2 app/delegated 双通道，另有可选 KSO-1 请求签名。WPS 365 企业数据为私有业务数据，Pontx 不代理、缓存或聚合，调用方使用本地 SDK/CLI 直连。",
        }
      : {
          title: "WPS 365 OpenAPI",
          version: apiVersion,
          description: "The complete WPS 365 unified OpenAPI surface (Kingsoft Office Open APIs v7): contacts and organization, cloud documents, DBSheet/smart sheets, messaging, meetings, calendars, mail, todo, approvals, wiki, and event subscriptions. The official machine contract (OpenAPI 3.0.0 published on open.wps.cn, 806 paths / 827 operations / 3,119 schemas) is distributed via the official MIT CLI and is byte-reproducible; 15 /v7/sse/* endpoints use text/event-stream and event subscriptions are encrypted HTTP callbacks. Authentication is OAuth2 app/delegated dual-channel with optional KSO-1 request signing. WPS 365 enterprise data is private business data; Pontx does not proxy, cache, or aggregate it and callers use the local SDK/CLI to connect directly.",
        },
    servers: [{
      id: "wps-365-production",
      url: baseUrl,
      description: language === "zh" ? "WPS 365 OpenAPI 生产 HTTPS 服务（路径前缀 /v7）。" : "WPS 365 OpenAPI production HTTPS service (path prefix /v7).",
    }],
    security: [],
    externalDocs: {
      url: "https://open.wps.cn/documents/app-integration-dev/",
      description: language === "zh" ? "WPS 开放平台官方文档（双语）。" : "WPS Open Platform official documentation (bilingual).",
    },
    components: {
      schemas: localizedSchemas,
      securitySchemes: {
        app: {
          type: "oauth2",
          flows: {
            clientCredentials: {
              tokenUrl: baseUrl + "/oauth2/token",
              scopes: Object.fromEntries(
                Object.entries(imported.components.securitySchemes?.app?.flows?.clientCredentials?.scopes ?? {})
                  .map(([k, v]) => [k, String(v)]),
              ),
            },
          },
          description: language === "zh"
            ? "应用授权（OAuth2 client credentials）：应用身份访问令牌，通过环境变量注入，不写入日志或仓库。"
            : "App authorization (OAuth2 client credentials): application identity access token; inject via environment variable and never log or commit it.",
        },
        delegated: {
          type: "oauth2",
          flows: {
            authorizationCode: {
              authorizationUrl: baseUrl + "/oauth2/auth",
              tokenUrl: baseUrl + "/oauth2/token",
              scopes: Object.fromEntries(
                Object.entries(imported.components.securitySchemes?.delegated?.flows?.authorizationCode?.scopes ?? {})
                  .map(([k, v]) => [k, String(v)]),
              ),
            },
          },
          description: language === "zh"
            ? "用户授权（OAuth2 authorization code）：以最终用户身份访问其企业数据，通过环境变量注入，不写入日志或仓库。"
            : "Delegated (user) authorization (OAuth2 authorization code): access enterprise data as an end user; inject via environment variable and never log or commit it.",
        },
      },
    },
    tags: usedTags.map((name) => ({ name, description: tagText[name]?.[language] ?? name })),
    apis,
  }, { expectedName: "wps-365" });
}

// ---------------------------------------------------------------------------
// Boundary assertions
// ---------------------------------------------------------------------------
// ---------------------------------------------------------------------------
// Boundary: exclude non-callable browser-redirect OAuth helper
// ---------------------------------------------------------------------------
// GET /v7/oauth2/qrcode_auth_code is a browser navigation target (302 redirect
// to the WPS authorization page). The official spec declares only 302 + default,
// it has no JSON success contract, no official docs page, and is absent from the
// official curated CLI command surface. It is not a callable REST API for SDK/CLI
// consumers, so it is excluded from the collection boundary (documented in
// provenance). The remaining boundary is 826 callable endpoints.
const EXCLUDED = new Set(["GET /v7/oauth2/qrcode_auth_code"]);
const upstream = Object.entries(imported.apis)
  .filter(([, api]) => methods.has(api.method.toLowerCase()))
  .filter(([, api]) => !EXCLUDED.has(String(api.method).toUpperCase() + " " + api.path));
console.log("imported endpoints:", Object.keys(imported.apis).length, "→ boundary:", upstream.length, "schemas:", Object.keys(imported.components.schemas).length);
if (upstream.length !== 826) throw new Error("Expected 826 endpoints in boundary, got " + upstream.length);
const derivedIds = upstream.map(([key]) => derivation.get(key)?.id ?? key);
const idSet = new Set(derivedIds);
if (idSet.size !== derivedIds.length) throw new Error("Duplicate derived operationIds: " + derivedIds.length + " total, " + idSet.size + " unique");

const zh = buildSpec("zh");
const en = buildSpec("en");
const zhBytes = Buffer.from(JSON.stringify(PontxSpec.reOrder(zh), null, 2) + "\n");
const enBytes = Buffer.from(JSON.stringify(PontxSpec.reOrder(en), null, 2) + "\n");

const zhValidation = validatePontxSpec(zh);
if (!zhValidation.valid) {
  throw new Error("zh PontxSpec invalid: " + zhValidation.issues.map((issue) => issue.message).join(" | "));
}
const localeValidation = validatePontxSpecLocale(zh, en);
if (localeValidation.issues.length) {
  throw new Error("en-US locale not isomorphic: " + localeValidation.issues.map((issue) => issue.message).join(" | "));
}
const zhEndpointCount = Object.keys(zh.apis).length;
const zhSchemaCount = Object.keys(zh.components.schemas).length;
if (zhEndpointCount !== 826) throw new Error("Expected 826 Endpoints, got " + zhEndpointCount);

const quality = evaluatePontxQuality({
  spec: zh,
  defaultLocale: "zh-CN",
  locales: { "en-US": en },
});

// ---------------------------------------------------------------------------
// product.json / sdk.json
// ---------------------------------------------------------------------------
const product = {
  formatVersion: 1,
  slug: "wps-365",
  name: "WPS 365 OpenAPI",
  provider: "Kingsoft Office",
  category: "Productivity",
  display: {
    title: "WPS 365 企业协作开放 API",
    summary: "通过 WPS 365 官方 OpenAPI（v7）管理通讯录与组织、云文档、多维表/智能表格、消息、会议、日历、邮件、待办、审批与事件订阅；官方机器契约为 open.wps.cn 发布的 OpenAPI 3.0.0（827 个 Endpoint / 3,119 个 Schema）。企业数据为私有业务数据，Pontx 不代理、缓存或聚合，调用方使用本地 SDK/CLI 直连。",
    accent: "#FFFFFF",
  },
  legal: {
    license: "Official spec distributed via MIT-licensed @wps365-open/wps365 CLI; WPS Open Platform developer agreement governs API usage",
    attributionUrl: "https://www.npmjs.com/package/@wps365-open/wps365",
  },
  documentation: {
    status: "official",
    evidence: [
      sourceUrl,
      curatedUrl,
      "https://www.npmjs.com/package/@wps365-open/wps365",
      "https://open.wps.cn/documents/app-integration-dev/guide/overview",
      "https://open.wps.cn/documents/app-integration-dev/wps365/server/api-description/signature-description",
    ],
    verifiedAt,
    contentUpdatedAt: verifiedAt,
    stabilityNote: "完整边界为 open.wps.cn 发布的 Kingsoft Office Open APIs v7 OpenAPI 3.0.0 规范（806 paths / 827 operations / 3,119 schemas），SHA-256 3a2dfe64...；该规范同时随官方 MIT CLI 包 @wps365-open/wps365@0.2.27 分发，字节可复现。规范本身无 operationId/tags/prose，本集合的稳定 operationId 以官方 curated.yaml 的 101 个命令 ID 为锚点、其余按 method+path 派生；tags 按路径模块分组；双语 prose 独立撰写并经官方文档核对。事件订阅为加密 HTTP callback；15 个 /v7/sse/* 端点使用 text/event-stream。",
  },
  pricing: {
    status: "free",
    summary: "WPS 365 API 调用随企业 WPS 365 订阅与开发者应用权限提供，多数接口按应用权限申请；部分 AI 能力（AIPPT、AI 问答、AI 提取、AI 翻译、AI 创作）有免费试用配额并在认证后提升。具体以 WPS 开放平台开发者后台为准。",
    officialUrl: "https://open.wps.cn/documents/app-integration-dev/",
    verifiedAt,
  },
  credentials: [
    {
      schemeId: "app",
      envVar: "WPS365_APP_CLIENT_ID",
      secretEnvVar: "WPS365_APP_CLIENT_SECRET",
      description: "应用授权（client credentials）客户端 ID/Secret；通过环境变量注入，不写入日志或仓库。",
    },
    {
      schemeId: "delegated",
      envVar: "WPS365_USER_ACCESS_TOKEN",
      description: "用户授权访问令牌（authorization code 换取）；通过环境变量注入，不写入日志或仓库。",
    },
  ],
  quickStart: { operationId: "calendars/calendarList", requestExampleId: "default" },
};
const productEn = {
  display: {
    title: "WPS 365 enterprise collaboration open API",
    summary: "Manage contacts and organization, cloud documents, DBSheet/smart sheets, messaging, meetings, calendars, mail, todo, approvals, and event subscriptions through the official WPS 365 OpenAPI (v7); the official machine contract is the OpenAPI 3.0.0 published on open.wps.cn (827 endpoints / 3,119 schemas). Enterprise data is private business data; Pontx does not proxy, cache, or aggregate it and callers use the local SDK/CLI directly.",
    accent: "#FFFFFF",
  },
  documentation: {
    status: "official",
    evidence: product.documentation.evidence,
    verifiedAt,
    contentUpdatedAt: verifiedAt,
    stabilityNote: "The complete boundary is the Kingsoft Office Open APIs v7 OpenAPI 3.0.0 document published on open.wps.cn (806 paths / 827 operations / 3,119 schemas), SHA-256 3a2dfe64...; the same bytes are distributed in the official MIT CLI package @wps365-open/wps365@0.2.27 and are byte-reproducible. The document itself has no operationIds/tags/prose; stable operationIds in this collection anchor on the 101 official curated command IDs and are derived from method+path otherwise; tags group by path module; bilingual prose is independently authored and checked against the official docs. Event subscriptions are encrypted HTTP callbacks; 15 /v7/sse/* endpoints use text/event-stream.",
  },
  pricing: {
    status: "free",
    summary: "WPS 365 API calls are provided with the enterprise WPS 365 subscription and developer app permissions; most endpoints require applied app permissions. Some AI capabilities (AIPPT, AI Q&A, AI extraction, AI translation, AI creation) have free trial quotas that increase after certification. See the WPS Open Platform developer console for details.",
    officialUrl: "https://open.wps.cn/documents/app-integration-dev/",
    verifiedAt,
  },
  credentials: [
    {
      schemeId: "app",
      description: "App authorization (client credentials) client ID/Secret; inject via environment variables and never log or commit them.",
    },
    {
      schemeId: "delegated",
      description: "Delegated (user) access token obtained via authorization code; inject via environment variable and never log or commit it.",
    },
  ],
};

const sdkTsExample = "import { createWps365Client } from "
  + JSON.stringify("@pontx/wps-365") + ";" + "\n\n"
  + "const client = createWps365Client({ auth: process.env.WPS365_APP_CLIENT_ID, secret: process.env.WPS365_APP_CLIENT_SECRET });" + "\n"
  + "const calendars = await client.calendars.calendarList();";
const sdkCliExample = "pnpm add --global @pontx/wps-365" + "\n\n"
  + "pontx-wps-365 call calendars list-calendars --dry-run";

const usedTagsList = [...new Set(Object.values(imported.apis).map((api) => tagForPath(api.path)))];
const sdk = {
  formatVersion: 1,
  package: {
    name: "@pontx/wps-365",
    version: "0.1.0",
    status: "planned",
    repository: "https://github.com/pontjs/wps-365",
  },
  cli: { name: "pontx-wps-365" },
  contract: {
    client: { kind: "factory", factory: "createWps365Client", identifier: "client", options: { auth: "WPS365_APP_CLIENT_ID", secret: "WPS365_APP_CLIENT_SECRET" } },
    controllers: Object.fromEntries(usedTagsList.map((tag) => [tag, tag])),
  },
  examples: {
    typescript: sdkTsExample,
    cli: sdkCliExample,
  },
  coverage: { mode: "full" },
  spec: { path: "candidates/wps-365/spec.pontx.json", sha256: sha256(zhBytes) },
};

await mkdir(resolve(outputRoot, "locales/en-US"), { recursive: true });
await writeFile(resolve(outputRoot, "product.json"), JSON.stringify(product, null, 2) + "\n");
await writeFile(resolve(outputRoot, "locales/en-US/product.json"), JSON.stringify(productEn, null, 2) + "\n");
await writeFile(resolve(outputRoot, "spec.pontx.json"), zhBytes);
await writeFile(resolve(outputRoot, "locales/en-US/spec.pontx.json"), enBytes);
await writeFile(resolve(outputRoot, "sdk.json"), JSON.stringify(sdk, null, 2) + "\n");

const findings = quality.findings ?? [];
const criticals = findings.filter((item) => item.severity === "Critical");
const majors = findings.filter((item) => item.severity === "Major");
const minors = findings.filter((item) => item.severity === "Minor");
console.log("Built WPS 365 candidate: " + zhEndpointCount + " Endpoints, " + zhSchemaCount + " Schemas, zh SHA-256 " + sha256(zhBytes) + ".");
console.log("Static quality score: " + quality.staticScore + "/50; findings: " + criticals.length + " Critical, " + majors.length + " Major, " + minors.length + " Minor.");
console.log("Dimensions:", quality.dimensions.map((d) => d.id + "=" + d.score).join(" "));
for (const item of criticals.slice(0, 25)) console.log("CRITICAL: " + (item.message ?? item.ruleId));
for (const item of majors.slice(0, 40)) console.log("MAJOR: " + (item.message ?? item.ruleId));
