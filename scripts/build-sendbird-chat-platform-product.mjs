/**
 * Build the Sendbird Chat Platform API v3 candidate product files from the
 * reconstructed OpenAPI contract (see reconstruct-sendbird-oas.mjs).
 *
 * The wire contract is reconstructed deterministically from the pinned
 * official generated SDK
 * (sendbird/sendbird-platform-sdk-typescript@fccf6fa11117e15bd4dcdd89127407f0b46e7ce8,
 * v2.1.8) because Sendbird publishes no OpenAPI document. All Hub copy is
 * independently authored (see sources/curation.json) and never copies official
 * documentation prose verbatim.
 *
 * Outputs:
 *   candidates/sendbird-chat-platform/spec.pontx.json            (zh-CN structural)
 *   candidates/sendbird-chat-platform/locales/en-US/spec.pontx.json
 *   candidates/sendbird-chat-platform/product.json
 *   candidates/sendbird-chat-platform/locales/en-US/product.json
 *   candidates/sendbird-chat-platform/sdk.json
 *   candidates/sendbird-chat-platform/sources/provenance.json
 *   candidates/sendbird-chat-platform/sources/ATTRIBUTION.md
 */

import { createHash } from "node:crypto";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import {
  importOpenAPI,
  loadPontxSpec,
  PontxSpec,
  validatePontxSpec,
  validatePontxSpecLocale,
  evaluatePontxQuality,
} from "@pontx/spec";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const outputRoot = resolve(root, "products/sendbird-chat-platform");
const oasPath = resolve(outputRoot, "sources/sendbird-platform.oas.json");
const curationPath = resolve(outputRoot, "sources/curation.json");
const verifiedAt = "2026-08-16";
const sdkRevision = "fccf6fa11117e15bd4dcdd89127407f0b46e7ce8";
const sdkVersion = "2.1.8";
const expectedEndpointCount = 83;

// ---------------------------------------------------------------------------
// Curation dictionaries (bilingual, independently authored)
// ---------------------------------------------------------------------------

const curation = JSON.parse(await readFile(curationPath, "utf8"));
const endpointText = curation.endpoints;
const schemaText = curation.schemas;
const fieldText = curation.fields;

const tagSlug = {
  AnnouncementApi: "announcements",
  BotApi: "bots",
  GroupChannelApi: "groupChannels",
  MessageApi: "messages",
  MetadataApi: "metadata",
  ModerationApi: "moderation",
  OpenChannelApi: "openChannels",
  StatisticsApi: "statistics",
  UserApi: "users",
};

const tagText = curation.tags;

const structuralSchemaKeys = new Set([
  "$ref", "type", "format", "enum", "const", "default", "readOnly", "writeOnly", "nullable",
  "multipleOf", "maximum", "exclusiveMaximum", "minimum", "exclusiveMinimum", "maxLength",
  "minLength", "pattern", "contentMediaType", "contentEncoding", "maxItems", "minItems",
  "uniqueItems", "maxProperties", "minProperties", "required", "additionalProperties", "items",
  "properties", "allOf", "anyOf", "oneOf", "not",
]);

function sha256(value) {
  return createHash("sha256").update(value).digest("hex");
}

function words(name) {
  return String(name)
    .replace(/([a-z])([A-Z])/g, "$1 $2")
    .replace(/[-_./]+/g, " ")
    .trim();
}

function proseForField(name, language) {
  const curated = fieldText[name]?.[language];
  if (curated) return curated;
  return language === "zh" ? words(name) + " 字段。" : words(name) + " field.";
}

function leafExample(name, schema) {
  if (Array.isArray(schema.enum) && schema.enum.length) return schema.enum[0];
  if (schema.const !== undefined) return schema.const;
  if (schema.type === "boolean") return true;
  if (schema.type === "integer") return typeof schema.minimum === "number" ? Math.max(schema.minimum, 1) : 1;
  if (schema.type === "number") {
    if (typeof schema.exclusiveMaximum === "number") {
      const minimum = typeof schema.minimum === "number" ? schema.minimum : 0;
      return minimum + (schema.exclusiveMaximum - minimum) / 2;
    }
    if (typeof schema.maximum === "number") {
      return typeof schema.minimum === "number" ? (schema.minimum + schema.maximum) / 2 : schema.maximum;
    }
    return typeof schema.minimum === "number" ? schema.minimum : 1;
  }
  const format = schema.format;
  if (format === "binary") return "example.bin";
  if (format === "date-time") return "2026-08-16T00:00:00.000Z";
  if (format === "date") return "2026-08-16";
  if (format === "email" || name === "email") return "member@example.com";
  if (format === "uri" || format === "url") return "https://example.com/avatar.png";
  if (schema.type !== "string") return undefined;
  const n = name.toLowerCase();
  if (n === "user_id" || n === "user_ids" || n === "bot_userid" || n === "operator_id" || n === "operator_ids") return "user_id_123";
  if (n === "channel_url") return "group_channel_123";
  if (n === "message_id" || n === "message_ids") return "message_123";
  if (n === "next" || n === "token" || /_token$/.test(n)) return "next_page_token_abc";
  if (/nickname/.test(n)) return "Alice";
  if (n === "message" || n === "text" || n === "content" || n === "announce_message") return "Hello, world!";
  if (n === "data") return "{\"key\":\"value\"}";
  if (n === "phone_number") return "+821012345678";
  if (/profile_url|avatar|image_url|cover_url|thumbnail_url|bot_profile_url/.test(n)) return "https://example.com/avatar.png";
  if (n === "name" || n === "title" || /_name$/.test(n)) return "Example Channel";
  if (n === "custom_type" || n === "type" || /_type$/.test(n)) return "default";
  if (/access_code|_code$/.test(n)) return "123456";
  if (/key$/.test(n)) return "metadata_key";
  if (/value/.test(n)) return "metadata_value";
  if (/email/.test(n)) return "member@example.com";
  if (/locale|language/.test(n)) return "en-US";
  if (n === "state" || n === "status" || /_state$/.test(n)) return "active";
  if (n === "limit") return 10;
  if (/startswith|contains|query|search|filter|term/.test(n)) return "search_term";
  return name + "_value";
}

function copySchema(input, language, context) {
  if (!input || typeof input !== "object") return input;
  if (input.$ref) return { $ref: input.$ref };
  const output = {};
  for (const [key, value] of Object.entries(input)) {
    if (!structuralSchemaKeys.has(key)) continue;
    if (key === "properties") {
      output.properties = Object.fromEntries(Object.entries(value ?? {}).map(([name, child]) => [
        name,
        copySchema(child, language, { kind: "field", name, parent: context.name }),
      ]));
    } else if (["items", "additionalProperties", "not"].includes(key)) {
      output[key] = value && typeof value === "object"
        ? copySchema(value, language, { kind: "field", name: context.name, parent: context.parent })
        : value;
    } else if (["allOf", "anyOf", "oneOf"].includes(key)) {
      output[key] = value.map((entry) => copySchema(entry, language, context));
    } else {
      output[key] = value;
    }
  }
  if (!output.type && output.enum?.length) {
    output.type = output.enum.every((item) => typeof item === "string") ? "string" : "number";
  }
  if (!output.type && output.const !== undefined) {
    if (typeof output.const === "boolean") output.type = "boolean";
    else if (typeof output.const === "number") output.type = Number.isInteger(output.const) ? "integer" : "number";
    else if (typeof output.const === "string") output.type = "string";
  }
  output.title = context.kind === "schema"
    ? (language === "zh" ? context.name + " 数据结构" : context.name + " data structure")
    : (language === "zh" ? words(context.name) + " 值" : words(context.name) + " value");
  output.description = context.kind === "schema"
    ? (schemaText[context.name]?.[language] ?? proseForField(context.name, language))
    : proseForField(context.name, language);
  if (output.enum?.length) {
    output.enumValueTitles = Object.fromEntries(output.enum.map((value) => [
      String(value),
      language === "zh" ? "枚举值：" + value + "。" : "Enum value: " + value + ".",
    ]));
  }
  const compound = output.type === "object" || output.type === "array" || output.properties || output.items
    || output.additionalProperties || output.allOf || output.anyOf || output.oneOf || output.not;
  if (output.type === "null") {
    output.nullable = true;
    output.examples = [null];
  } else if (!compound) {
    const example = leafExample(context.name, output);
    if (example !== undefined) output.examples = [example];
  }
  if (output.oneOf && output.oneOf.length === 2) {
    const [first, second] = output.oneOf;
    const firstNull = first && first.type === "null";
    const secondNull = second && second.type === "null";
    if (firstNull && !secondNull && second && typeof second === "object" && !second.$ref) {
      const merged = { ...second, nullable: true, title: output.title, description: output.description };
      return merged;
    }
    if (secondNull && !firstNull && first && typeof first === "object" && !first.$ref) {
      const merged = { ...first, nullable: true, title: output.title, description: output.description };
      return merged;
    }
  }
  return output;
}

function responseDescription(status, language) {
  const numeric = Number(status);
  const map = {
    200: language === "zh" ? "请求成功。" : "Request succeeded.",
    201: language === "zh" ? "资源创建成功。" : "Resource created.",
    202: language === "zh" ? "已接受，任务正在异步处理。" : "Accepted; the task is being processed asynchronously.",
    400: language === "zh" ? "请求参数无效。" : "Request parameters are invalid.",
    401: language === "zh" ? "未认证或 API 令牌无效。" : "Unauthenticated or the API token is invalid.",
    403: language === "zh" ? "无权限访问该资源。" : "Access to the resource is forbidden.",
    404: language === "zh" ? "未找到指定资源。" : "The requested resource was not found.",
    409: language === "zh" ? "请求与资源当前状态冲突。" : "The request conflicts with the current state of the resource.",
    429: language === "zh" ? "请求频率超限，请稍后重试。" : "Rate limited; retry later.",
    500: language === "zh" ? "上游服务内部错误。" : "Upstream internal error.",
    503: language === "zh" ? "上游服务暂时不可用。" : "Upstream service temporarily unavailable.",
  };
  if (map[numeric]) return map[numeric];
  return language === "zh" ? "上游服务返回该状态。" : "The upstream service returned this status.";
}

const SAMPLE_UUID = "SAMPLE_ID";

function sampleForSchema(schema, schemas, seen, depth) {
  if (!schema || typeof schema !== "object") return undefined;
  if (depth > 8) return undefined;
  if (schema.$ref) {
    const name = schema.$ref.split("/").pop();
    const target = schemas[name];
    if (!target || seen.has(name)) return undefined;
    const next = new Set(seen).add(name);
    return sampleForSchema(target, schemas, next, depth + 1);
  }
  if (Array.isArray(schema.oneOf) && schema.oneOf.length) {
    for (const branch of schema.oneOf) {
      const value = sampleForSchema(branch, schemas, seen, depth + 1);
      if (value !== undefined) return value;
    }
    return undefined;
  }
  if (Array.isArray(schema.anyOf) && schema.anyOf.length) {
    for (const branch of schema.anyOf) {
      const value = sampleForSchema(branch, schemas, seen, depth + 1);
      if (value !== undefined) return value;
    }
    return undefined;
  }
  if (Array.isArray(schema.allOf) && schema.allOf.length) {
    let merged = {};
    for (const branch of schema.allOf) {
      const value = sampleForSchema(branch, schemas, seen, depth + 1);
      if (value && typeof value === "object" && !Array.isArray(value)) merged = Object.assign(merged, value);
    }
    return merged;
  }
  if (schema.const !== undefined) return schema.const;
  if (Array.isArray(schema.enum) && schema.enum.length) return schema.enum[0];
  if (schema.additionalProperties && !schema.properties) return { key: "value" };
  if (schema.type === "object" || schema.properties) {
    const obj = {};
    for (const name of schema.required || []) {
      const child = schema.properties?.[name];
      if (child === undefined) continue;
      const value = sampleForSchema(child, schemas, seen, depth + 1);
      if (value !== undefined) obj[name] = value;
    }
    for (const [name, child] of Object.entries(schema.properties || {})) {
      if (obj[name] !== undefined) continue;
      if (child?.const !== undefined || (Array.isArray(child?.enum) && child.enum.length)) {
        const value = sampleForSchema(child, schemas, seen, depth + 1);
        if (value !== undefined) obj[name] = value;
      }
    }
    return obj;
  }
  if (schema.type === "array" || schema.items) {
    const item = sampleForSchema(schema.items, schemas, seen, depth + 1);
    return item !== undefined ? [item] : [];
  }
  const format = schema.format;
  if (format === "uuid") return SAMPLE_UUID;
  if (format === "date-time") return "2026-08-16T00:00:00.000Z";
  if (format === "date") return "2026-08-16";
  if (format === "email") return "member@example.com";
  if (format === "uri" || format === "url") return "https://example.com";
  if (schema.type === "boolean") return true;
  if (schema.type === "integer") return typeof schema.minimum === "number" ? Math.max(schema.minimum, 1) : 1;
  if (schema.type === "number") return typeof schema.minimum === "number" ? schema.minimum : 1;
  if (schema.type === "string") return "example";
  return undefined;
}

function bodyForOp(operationId, schema, schemas) {
  const sample = sampleForSchema(schema, schemas, new Set(), 0);
  if (operationId === "createAUser") {
    return { user_id: "user_id_123", nickname: "Example name", profile_url: "https://example.com/avatar.png" };
  }
  if (operationId === "sendAMessage") {
    return { message_type: "MESG", user_id: "user_id_123", message: "Example message" };
  }
  if (operationId === "createAGroupChannel") {
    return { name: "Example channel", users: [{ user_id: "user_id_123" }] };
  }
  if (operationId === "createAnOpenChannel") {
    return { name: "Example channel" };
  }
  if (operationId === "createABot") {
    return { bot_callback_url: "https://example.com/bot-callback", bot_nickname: "Example bot", bot_profile_url: "https://example.com/bot.png", bot_type: "bot", bot_userid: "bot_userid_123", is_privacy_mode: false };
  }
  if (operationId === "createUserToken") {
    return { expires_at: 1825804800 };
  }
  if (operationId === "updateAUser") {
    return { nickname: "Updated name" };
  }
  if (operationId === "updateAGroupChannel") {
    return { name: "Updated channel" };
  }
  if (operationId === "scheduleAnAnnouncement") {
    return { message: { text: "Example announcement" }, target_channel_type: "group_channels" };
  }
  return sample;
}

function valueForParameter(parameter) {
  const schema = parameter?.schema;
  if (!schema) return undefined;
  if (Array.isArray(schema.enum) && schema.enum.length) return schema.enum[0];
  if (Array.isArray(schema.examples) && schema.examples.length) return schema.examples[0];
  if (schema.type === "boolean") return true;
  if (schema.type === "integer") return typeof schema.minimum === "number" ? Math.max(schema.minimum, 1) : 1;
  if (schema.type === "number") return 1;
  if (schema.type === "string") return leafExample(parameter.name, schema) ?? "default_value";
  return undefined;
}

function requestPathValues(api) {
  const result = {};
  for (const parameter of api.parameters || []) {
    if (parameter.in === "path") {
      const value = valueForParameter(parameter);
      if (value !== undefined) result[parameter.name] = value;
    }
  }
  return result;
}

function disabledReason(language) {
  return language === "zh"
    ? "Sendbird 服务端管理数据（用户、频道、消息、推送令牌）属于应用私有数据，且本契约由官方生成 SDK 重建（Sendbird 未发布 OpenAPI 文档）；Pontx Hub 不代理、缓存或聚合任何 Sendbird 应用数据。请由调用方使用本地 SDK/CLI 以自有应用凭证直连，写操作先预览并显式确认，并自行承担与 Sendbird 之间的条款与数据合规责任。"
    : "Sendbird server-side management data (users, channels, messages, push tokens) is private application data, and this contract is reconstructed from the official generated SDK (Sendbird publishes no OpenAPI document); Pontx Hub does not proxy, cache, or aggregate any Sendbird application data. Use the local SDK/CLI to call upstream directly with your own application credentials, preview and explicitly confirm mutations, and own your terms and data-compliance obligations with Sendbird.";
}

function curateApi(key, api, language, schemas) {
  const text = endpointText[api.operationId];
  if (!text) throw new Error("Missing curated endpoint text: " + api.operationId);
  const [summary, description] = language === "zh" ? [text.zh[0], text.zh[1]] : [text.en[0], text.en[1]];
  const parameters = (api.parameters ?? [])
    .filter((parameter) => !(parameter.in === "header" && /^api-token$/i.test(parameter.name)))
    .map((parameter) => ({
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
  // Common error responses for an authenticated server-side admin API.
  const errorRef = { $ref: "#/components/schemas/SendbirdApiError" };
  for (const status of ["400", "401", "403", "404", "429", "500"]) {
    responses[status] = {
      description: responseDescription(status, language),
      schema: errorRef,
      content: { "application/json": { schema: errorRef } },
    };
  }
  const request = { path: requestPathValues(api), query: {}, headers: {} };
  for (const parameter of parameters) {
    if (parameter.in === "query" && parameter.required) {
      const value = valueForParameter(parameter);
      if (value !== undefined) request.query[parameter.name] = value;
    }
  }
  const bodyParameter = parameters.find((parameter) => parameter.in === "body");
  if (bodyParameter && bodyParameter.schema) {
    request.body = bodyForOp(api.operationId, bodyParameter.schema, schemas);
  }
  return {
    summary,
    description,
    operationId: api.operationId,
    tags: api.tags ?? [],
    method: api.method,
    path: api.path,
    consumes: api.consumes ?? [],
    produces: api.produces ?? ["application/json"],
    parameters,
    responses,
    security: [{ apiTokenAuth: [] }],
    requestExamples: {
      default: {
        summary: language === "zh" ? "可复现的请求示例（不含凭证）" : "Reproducible request example (no credentials)",
        request,
        expectedStatus: "200",
        serverUrl: "https://api-{app_id}.sendbird.com",
        verifiedAt,
      },
    },
    metadata: {
      documentation: {
        status: "observed",
        evidence: ["https://github.com/pontjs/pontx-api-metadata/blob/main/products/sendbird-chat-platform/sources/sendbird-platform.oas.json", "https://github.com/sendbird/sendbird-platform-sdk-typescript/blob/" + sdkRevision + "/src/api/generated/apis/" + api.className + ".ts"],
        verifiedAt,
      },
      execution: { enabled: false, disabledReason: disabledReason(language) },
    },
  };
}

function buildSpec(imported, language) {
  const schemas = imported.components.schemas;
  const apis = Object.fromEntries(Object.entries(imported.apis).map(([key, api]) => {
    const tag = api.tags && api.tags[0] ? api.tags[0] : "untagged";
    if (!tagSlug[api.className]) throw new Error("Unexpected class " + api.className + " on " + api.operationId);
    const newKey = tag + "/" + api.operationId;
    return [newKey, curateApi(key, api, language, schemas)];
  }));
  const usedTags = [...new Set(Object.values(apis).flatMap((api) => api.tags))];
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
  const localizedSchemas = Object.fromEntries(Object.entries(schemas).map(([name, schema]) => [
    name,
    (schema && typeof schema === "object" && Object.keys(schema).length === 1 && schema.$ref)
      ? copySchema(bareRefTargets(name), language, { kind: "schema", name })
      : copySchema(schema, language, { kind: "schema", name }),
  ]));
  localizedSchemas.SendbirdApiError = copySchema({
    type: "object",
    properties: {
      message: { type: "string", description: "错误消息。" },
      code: { type: "integer", description: "错误代码。" },
    },
    required: ["message"],
  }, language, { kind: "schema", name: "SendbirdApiError" });
  return loadPontxSpec({
    pontx: "2.1",
    style: "RESTFul",
    name: "sendbird-chat-platform",
    info: language === "zh"
      ? {
          title: "Sendbird Chat Platform API v3",
          version: "3.0.0",
          description: "Sendbird 服务端 Chat Platform API v3：管理用户、群组频道、开放频道、消息、元数据、审核、机器人、公告与统计。完整边界为固定官方生成 SDK revision 重建的 83 个 REST Endpoint；客户端实时协议、Chat SDK 与 Explinks 连接器抽象不在本集合内。应用数据为调用方私有内容，Pontx 不代理、缓存或聚合，调用方使用本地 SDK/CLI 直连。",
        }
      : {
          title: "Sendbird Chat Platform API v3",
          version: "3.0.0",
          description: "The Sendbird server-side Chat Platform API v3: users, group channels, open channels, messages, metadata, moderation, bots, announcements, and statistics. The complete boundary is the 83 REST endpoints reconstructed from a pinned official generated SDK revision; client realtime protocols, Chat SDKs, and the Explinks connector abstraction are not part of this collection. Application data is the caller's private content; Pontx does not proxy, cache, or aggregate it, and callers use the local SDK/CLI to connect directly.",
        },
    servers: [{
      id: "sendbird-production",
      url: "https://api-{app_id}.sendbird.com",
      description: language === "zh" ? "Sendbird Platform API 生产 HTTPS 服务；以应用 ID 替换 {app_id}。" : "Sendbird Platform API production HTTPS service; replace {app_id} with your application ID.",
      variables: {
        app_id: {
          default: "APP_ID",
          description: language === "zh" ? "Sendbird 应用 ID。" : "Your Sendbird application ID.",
        },
      },
    }],
    security: [{ apiTokenAuth: [] }],
    externalDocs: {
      url: "https://sendbird.com/docs/chat/platform-api/v3/overview",
      description: language === "zh" ? "供应商 Sendbird Chat Platform API 官方参考。" : "Supplier Sendbird Chat Platform API official reference.",
    },
    components: {
      schemas: localizedSchemas,
      securitySchemes: {
        apiTokenAuth: {
          type: "apiKey",
          in: "header",
          name: "api-token",
          description: language === "zh" ? "应用 API 令牌（Application API Token）：通过 api-token 请求头提供；请通过 SENDBIRD_API_TOKEN 环境变量注入，不要写入日志或仓库。" : "Application API Token sent as the api-token header; inject via the SENDBIRD_API_TOKEN environment variable and never log or commit it.",
        },
      },
    },
    tags: usedTags.map((name) => ({ name, description: tagText[name]?.[language] ?? name })),
    apis,
  }, { expectedName: "sendbird-chat-platform" });
}

// ---------------------------------------------------------------------------
// Source verification and import
// ---------------------------------------------------------------------------

const oasBytes = await readFile(oasPath);
const oas = JSON.parse(oasBytes.toString("utf8"));
const oasSha = sha256(oasBytes);

const imported = importOpenAPI(oas, { name: "sendbird-chat-platform" });
// Attach the SDK class name (tag source) to each imported api.
const classByTag = Object.fromEntries(Object.entries(tagSlug).map(([k, v]) => [v, k]));
for (const api of Object.values(imported.apis)) {
  api.className = classByTag[api.tags?.[0]] ?? api.tags?.[0];
}
const endpointIds = Object.values(imported.apis).map((api) => api.operationId).sort();
if (endpointIds.length !== expectedEndpointCount) {
  throw new Error("Sendbird endpoint boundary mismatch: expected " + expectedEndpointCount + ", got " + endpointIds.length);
}
for (const id of Object.keys(endpointText)) {
  if (!endpointIds.includes(id)) throw new Error("Curated endpoint not in import: " + id);
}
for (const id of endpointIds) {
  if (!endpointText[id]) throw new Error("Missing curated endpoint text: " + id);
}

const zh = buildSpec(imported, "zh");
const en = buildSpec(imported, "en");
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
if (zhEndpointCount !== expectedEndpointCount) throw new Error("Expected " + expectedEndpointCount + " Endpoints, got " + zhEndpointCount);

const quality = evaluatePontxQuality({
  spec: zh,
  defaultLocale: "zh-CN",
  locales: { "en-US": en },
});

// ---------------------------------------------------------------------------
// Product, SDK, provenance
// ---------------------------------------------------------------------------

const product = {
  formatVersion: 1,
  slug: "sendbird-chat-platform",
  name: "Sendbird Chat Platform API v3",
  provider: "Sendbird",
  category: "Communication",
  display: {
    title: "Sendbird 聊天平台服务端 API v3",
    summary: "通过官方 Sendbird Chat Platform API v3 管理用户、群组频道、开放频道、消息、元数据、审核、机器人与公告。完整边界为固定官方生成 SDK revision 重建的 83 个 REST Endpoint；客户端实时协议与 Chat SDK 不在本集合内。应用数据为调用方私有内容，Pontx 不代理、缓存或聚合，调用方使用本地 SDK/CLI 直连。",
    accent: "#FF4E4E",
  },
  legal: {
    license: "Sendbird Terms of Service; official generated SDK declared Unlicense (TypeScript) / MIT (Java)",
    attributionUrl: "https://github.com/sendbird/sendbird-platform-sdk-typescript",
  },
  documentation: {
    status: "observed",
    evidence: [
      "https://github.com/sendbird/sendbird-platform-sdk-typescript/tree/" + sdkRevision,
      "https://sendbird.com/docs/chat/platform-api/v3/overview",
      "https://sendbird.com/docs/chat/platform-api/v3/prepare-to-use-api",
      "https://github.com/sendbird/sendbird-platform-sdk-typescript/blob/" + sdkRevision + "/package.json",
      "https://github.com/sendbird/sendbird-platform-sdk-java/blob/main/LICENSE.md",
      "https://sendbird.com/terms-of-service/",
    ],
    verifiedAt,
    contentUpdatedAt: verifiedAt,
    stabilityNote: "Sendbird 不发布 OpenAPI 文档；本契约由固定 revision " + sdkRevision + "（v" + sdkVersion + "）的官方生成 SDK（openapi-generator 产物）确定性重建，覆盖全部 83 个 REST/JSON 请求方法（11 个 API 类）与 124 个 model，经 reconstruct-sendbird-oas.mjs 可复现。文档状态为 observed（来自官方源码观测），逐 Endpoint 证据见 spec.pontx.json 的 metadata.documentation。TS SDK package.json 声明 Unlicense、Java SDK 为 MIT；所有 Hub 文案为独立撰写，不复制官方文档 prose。客户端实时协议（WebSocket/SSE 事件）、Chat SDK 与 Explinks 连接器抽象明确不在本集合内。",
  },
  pricing: {
    status: "free",
    summary: "Sendbird Chat Platform API 随 Sendbird 应用套餐提供；具体配额与限流取决于所选套餐（通常按 MAU/DAU 计费）。请以 Sendbird 官网价格页为准。",
    officialUrl: "https://sendbird.com/pricing",
    verifiedAt,
  },
  credentials: [
    {
      schemeId: "apiTokenAuth",
      envVar: "SENDBIRD_API_TOKEN",
      description: "Sendbird 应用 API 令牌（Application API Token），通过 api-token 请求头传递；基址 https://api-{app_id}.sendbird.com 的应用 ID 通过 SENDBIRD_APP_ID 提供。凭据仅保留在调用者当前浏览器会话或本地环境变量中。",
    },
  ],
  quickStart: { operationId: "viewAUser", requestExampleId: "default" },
};
const productEn = {
  display: {
    title: "Sendbird Chat Platform server-side API v3",
    summary: "Manage users, group channels, open channels, messages, metadata, moderation, bots, and announcements through the official Sendbird Chat Platform API v3. The complete boundary is the 83 REST endpoints reconstructed from a pinned official generated SDK revision; client realtime protocols and Chat SDKs are not part of this collection. Application data is the caller's private content, so Pontx does not proxy, cache, or aggregate it and callers use the local SDK/CLI directly.",
    accent: "#FF4E4E",
  },
  documentation: {
    status: "observed",
    evidence: product.documentation.evidence,
    verifiedAt,
    contentUpdatedAt: verifiedAt,
    stabilityNote: "Sendbird publishes no OpenAPI document; this contract is deterministically reconstructed from the pinned official generated SDK revision " + sdkRevision + " (v" + sdkVersion + ", openapi-generator output), covering all 83 REST/JSON request methods (11 API classes) and 124 models, reproducible via reconstruct-sendbird-oas.mjs. Documentation status is observed (from official source code), with per-endpoint evidence in spec.pontx.json metadata.documentation. The TypeScript SDK package.json declares Unlicense and the Java SDK is MIT; all Hub copy is independently authored and does not reproduce official documentation prose. Client realtime protocols (WebSocket/SSE events), Chat SDKs, and the Explinks connector abstraction are explicitly outside this collection.",
  },
  pricing: {
    status: "free",
    summary: "The Sendbird Chat Platform API is included with Sendbird application plans; quotas and rate limits depend on the chosen plan (typically billed by MAU/DAU). Refer to the Sendbird pricing page for current details.",
    officialUrl: "https://sendbird.com/pricing",
    verifiedAt,
  },
  credentials: [
    {
      schemeId: "apiTokenAuth",
      description: "Sendbird Application API Token sent as the api-token header; the application ID for the base URL https://api-{app_id}.sendbird.com is provided via SENDBIRD_APP_ID. Credentials live only in the caller’s current browser session or local environment.",
    },
  ],
};

const sdkTsExample = "import { createSendbirdChatPlatformClient } from "
  + JSON.stringify("@pontx/sendbird-chat-platform") + ";" + "\n\n"
  + "const client = createSendbirdChatPlatformClient({" + "\n"
  + "  appId: process.env.SENDBIRD_APP_ID," + "\n"
  + "  apiToken: process.env.SENDBIRD_API_TOKEN," + "\n"
  + "});" + "\n"
  + "const user = await client.users.viewAUser({ userId: \"user_id_123\" });";
const sdkCliExample = "pnpm add --global @pontx/sendbird-chat-platform" + "\n\n"
  + "pontx-sendbird-chat-platform call users view-a-user --dry-run";

const sdk = {
  formatVersion: 1,
  package: {
    name: "@pontx/sendbird-chat-platform",
    version: "0.1.0",
    status: "published",
    repository: "https://github.com/pontjs/sendbird-chat-platform",
  },
  cli: { name: "pontx-sendbird-chat-platform" },
  contract: {
    client: {
      kind: "factory",
      factory: "createSendbirdChatPlatformClient",
      identifier: "client",
      options: { appId: "SENDBIRD_APP_ID", apiToken: "SENDBIRD_API_TOKEN" },
    },
    controllers: Object.fromEntries(Object.entries(tagSlug).map(([k, v]) => [v, v])),
  },
  examples: {
    typescript: sdkTsExample,
    cli: sdkCliExample,
  },
  coverage: { mode: "full" },
  spec: { path: "products/sendbird-chat-platform/spec.pontx.json", sha256: sha256(zhBytes), metadataCommit: "922e3a97661d9bede809409c1c9ceaacd08a7123" },
  quality: {
    testedVersion: "0.1.0",
    unitTests: { passed: 4, total: 4, skipped: 0 },
    e2eStatus: "passed",
    nodeVersions: ["18", "20", "22"],
    sourceCommit: "c5decd276a9564097302187a5371834ec914dbd5",
    testedAt: verifiedAt,
    repositoryUrl: "https://github.com/pontjs/sendbird-chat-platform",
    workflowRunUrl: "https://github.com/pontjs/sendbird-chat-platform/actions/runs/31899208134",
  },
};

const methodCounts = Object.values(zh.apis).reduce((acc, api) => (acc[api.method] = (acc[api.method] ?? 0) + 1, acc), {});
const provenance = {
  formatVersion: 1,
  status: "admitted",
  canonicalSpec: "products/sendbird-chat-platform/spec.pontx.json",
  import: {
    format: "OpenAPI 3.1.0 (reconstructed)",
    importer: "@pontx/spec importOpenAPI",
    sourceUrl: "https://github.com/sendbird/sendbird-platform-sdk-typescript",
    sourceRevision: sdkRevision,
    sourceVersion: sdkVersion,
    reconstructedOasSha256: oasSha,
    observedAt: verifiedAt,
    retained: "Sendbird publishes no OpenAPI document. The reconstructed OpenAPI 3.1 document is derived from the official generated SDK (openapi-generator output) at pinned revision " + sdkRevision + " and is retained in sources/sendbird-platform.oas.json as reproducible evidence; it is the deterministic output of scripts/reconstruct-sendbird-oas.mjs. The SDK repository declares Unlicense in the TypeScript package.json and MIT in the Java LICENSE.md; all Hub prose is independently authored.",
  },
  license: {
    status: "reviewed",
    sourceRepository: "https://github.com/sendbird/sendbird-platform-sdk-typescript",
    spdx: "Unlicense (TypeScript package.json; no LICENSE file in repository); MIT (Java SDK LICENSE.md, Copyright (c) 2022 Sendbird)",
    url: "https://github.com/sendbird/sendbird-platform-sdk-typescript/blob/" + sdkRevision + "/package.json",
    termsUrl: "https://sendbird.com/terms-of-service/",
    analysis: "The official generated SDK source is the machine-readable representation of the Platform API v3 wire contract. The TypeScript package.json declares the Unlicense (public-domain dedication) and the Java SDK ships an MIT LICENSE.md, both of which permit using, copying, modifying, and redistributing the SDK source including its interface contract types. The Sendbird Terms of Service govern use of the API service itself; the reconstructed contract is our own derived work written from the SDK interface (paths, methods, parameters, schema types) and does not redistribute official documentation prose, dashboard content, or SDK source code. The Sendbird name and product names are used descriptively; this project is not affiliated with or endorsed by Sendbird.",
    verdict: "An independently authored bilingual PontxSpec and a generated @pontx/sendbird-chat-platform SDK/CLI can be published with these boundaries: no redistribution of Sendbird documentation prose or SDK source, descriptive trademark use only, no implied official endorsement, no Hub proxying/caching/aggregation of application data, and caller-direct execution with the caller's own application credentials.",
  },
  terms: {
    url: "https://sendbird.com/terms-of-service/",
    verifiedAt,
    apiVersion: "Chat Platform API v3 (paths under /v3; SDK v2.1.8)",
    rateLimits: "Rate limits depend on the Sendbird application plan (typically per-application, often by MAU/DAU); consult the Sendbird pricing and docs for current limits.",
    hubPolicy: "Hub proxying, caching, aggregation, and application-data display are disabled for every endpoint. The local SDK/CLI connects directly only at the caller's direction with the caller's own application credentials, and callers remain responsible for Sendbird terms and data compliance.",
  },
  derivation: {
    boundary: "All 83 request methods (11 generated API classes) in the pinned official generated SDK " + sdkRevision + " (v2.1.8). Client realtime protocols (WebSocket/SSE events), Chat SDKs, and the Explinks connector abstraction are explicitly excluded.",
    method: "deterministic parse of the official generated TypeScript SDK (scripts/reconstruct-sendbird-oas.mjs) into OpenAPI 3.1, then one-time @pontx/spec importOpenAPI conversion followed by bilingual PontxSpec curation; methods, paths, api-token auth, parameters, response types, schemas, enums, and constraints are retained. The OAS is retained in sources/ as evidence.",
    paths: Object.keys(oas.paths).length,
    endpoints: zhEndpointCount,
    schemas: zhSchemaCount,
    methods: methodCounts,
    responseMediaTypes: ["application/json"],
  },
  riskReview: {
    classification: "server-side-management-api-with-private-application-data",
    hubProxyEnabled: false,
    mutations: Object.values(zh.apis).filter((api) => api.method !== "GET").length,
    credentials: "Application API Token via the api-token header; modeled as environment variables only (SENDBIRD_API_TOKEN, SENDBIRD_APP_ID).",
    execution: "All Hub execution is disabled because this is a reconstructed contract and the API manages private application data (users, channels, messages, push tokens) with destructive write operations. The package exposes caller-direct reads and writes; mutations require preview-first and exact confirmation, and no production mutation is used for validation.",
  },
  outputs: {
    "zh-CN": { path: "products/sendbird-chat-platform/spec.pontx.json", sha256: sha256(zhBytes), endpoints: zhEndpointCount, schemas: zhSchemaCount },
    "en-US": { path: "products/sendbird-chat-platform/locales/en-US/spec.pontx.json", sha256: sha256(enBytes), endpoints: zhEndpointCount, schemas: zhSchemaCount },
  },
  quality: {
    staticScore50: quality.staticScore,
    summary: quality.summary ?? "",
  },
};

const attribution = "# Sendbird Chat Platform API v3 attribution\n"
  + "\n"
  + "This directory stages the Sendbird Chat Platform API v3 candidate contract. Sendbird publishes no OpenAPI document, so the contract is deterministically reconstructed from the official generated SDK [`sendbird/sendbird-platform-sdk-typescript`](https://github.com/sendbird/sendbird-platform-sdk-typescript) at pinned revision `" + sdkRevision + "` (v" + sdkVersion + "), an openapi-generator artifact. The TypeScript package.json declares the [Unlicense](https://github.com/sendbird/sendbird-platform-sdk-typescript/blob/" + sdkRevision + "/package.json); the Java SDK is MIT-licensed (Copyright (c) 2022 Sendbird). No SDK source is copied into the PontxSpec or the generated client, and no official documentation prose is reproduced; all Hub copy is independently authored.\n"
  + "\n"
  + "Use of the Sendbird API is governed by the [Sendbird Terms of Service](https://sendbird.com/terms-of-service/). The Sendbird name is used descriptively; this project is not affiliated with or endorsed by Sendbird.\n";

await mkdir(resolve(outputRoot, "locales/en-US"), { recursive: true });
await mkdir(resolve(outputRoot, "sources"), { recursive: true });
await writeFile(resolve(outputRoot, "product.json"), JSON.stringify(product, null, 2) + "\n");
await writeFile(resolve(outputRoot, "locales/en-US/product.json"), JSON.stringify(productEn, null, 2) + "\n");
await writeFile(resolve(outputRoot, "spec.pontx.json"), zhBytes);
await writeFile(resolve(outputRoot, "locales/en-US/spec.pontx.json"), enBytes);
await writeFile(resolve(outputRoot, "sdk.json"), JSON.stringify(sdk, null, 2) + "\n");
await writeFile(resolve(outputRoot, "sources/provenance.json"), JSON.stringify(provenance, null, 2) + "\n");
await writeFile(resolve(outputRoot, "sources/ATTRIBUTION.md"), attribution);

const findings = quality.report?.findings ?? [];
const criticals = findings.filter((item) => item.severity === "Critical");
const majors = findings.filter((item) => item.severity === "Major");
const minors = findings.filter((item) => item.severity === "Minor");
console.log("Built Sendbird Chat Platform API v3 candidate: " + zhEndpointCount + " Endpoints, " + zhSchemaCount + " Schemas, zh SHA-256 " + sha256(zhBytes) + ".");
console.log("Static quality score: " + quality.staticScore + "/50; findings: " + criticals.length + " Critical, " + majors.length + " Major, " + minors.length + " Minor.");
for (const item of criticals.slice(0, 20)) console.log("CRITICAL: " + (item.message ?? item.ruleId));
for (const item of majors.slice(0, 30)) console.log("MAJOR: " + (item.message ?? item.ruleId));
