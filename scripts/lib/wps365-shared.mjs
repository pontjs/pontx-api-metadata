import { createHash } from "node:crypto";
import { mkdir, writeFile, readFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { createRequire } from "node:module";
import {
  importOpenAPI,
  loadPontxSpec,
  validatePontxSpec,
  validatePontxSpecLocale,
  evaluatePontxQuality,
  PontxSpec,
} from "@pontx/spec";

const require = createRequire(import.meta.url);
const yaml = require("js-yaml");

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..", "..");
const outputRoot = resolve(root, "candidates/wps-365");
const sourceUrl = "https://open.wps.cn/v7/developer/cli_tools/specs/api-internal";
const curatedUrl = "https://open.wps.cn/v7/developer/cli_tools/specs/curated-internal";
const sourceSha256 = "3a2dfe64b4debf6435405e2e15e3b7682504c4c91c842c8a491783ea72ae8548";
const curatedSha256 = "24e11b4206c126c7f4f7bf614f2e2422c9a3bcad4b02311ae94ce88f0b3dffd5";
const verifiedAt = "2026-08-16";
const apiVersion = "v7";
const baseUrl = "https://openapi.wps.cn";

const methods = new Set(["get", "put", "post", "delete", "patch", "head", "options", "trace"]);

function sha256(value) {
  return createHash("sha256").update(value).digest("hex");
}

// ---------------------------------------------------------------------------
// Shared prose helpers (deterministic bilingual text generation)
// ---------------------------------------------------------------------------

/** Split camelCase/snake/kebab into words. */
function words(name) {
  return String(name)
    .replace(/([a-z])([A-Z])/g, "$1 $2")
    .replace(/[-_./]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

/** Curated bilingual text for well-known field names. */
const fieldText = {
  id: { zh: "资源的唯一标识。", en: "Unique identifier of the resource." },
  file_id: { zh: "文件 ID。", en: "File ID." },
  drive_id: { zh: "云文档空间（drive）ID。", en: "Cloud document drive ID." },
  calendar_id: { zh: "日历 ID；可使用 primary 指代主日历。", en: "Calendar ID; use primary for the primary calendar." },
  user_id: { zh: "用户 ID。", en: "User ID." },
  chat_id: { zh: "群会话 ID。", en: "Chat (group conversation) ID." },
  message_id: { zh: "消息 ID。", en: "Message ID." },
  group_id: { zh: "用户组 ID。", en: "User group ID." },
  dept_id: { zh: "部门 ID。", en: "Department ID." },
  meeting_id: { zh: "会议 ID。", en: "Meeting ID." },
  meeting_room_id: { zh: "会议室 ID。", en: "Meeting room ID." },
  task_id: { zh: "任务或异步任务 ID。", en: "Task or async task ID." },
  template_id: { zh: "模板 ID。", en: "Template ID." },
  name: { zh: "名称。", en: "Name." },
  title: { zh: "标题。", en: "Title." },
  description: { zh: "描述。", en: "Description." },
  type: { zh: "类型。", en: "Type." },
  status: { zh: "状态。", en: "Status." },
  page_token: { zh: "分页起始令牌，不透明，应原样回传。", en: "Pagination start token; opaque and passed back verbatim." },
  page_size: { zh: "每页返回条数。", en: "Number of results per page." },
  total: { zh: "总数。", en: "Total count." },
  has_more: { zh: "是否还有更多结果。", en: "Whether more results remain." },
  next_page_token: { zh: "下一页令牌，不透明。", en: "Next page token; opaque." },
  start_time: { zh: "开始时间（RFC3339）。", en: "Start time (RFC3339)." },
  end_time: { zh: "结束时间（RFC3339）。", en: "End time (RFC3339)." },
  created_at: { zh: "创建时间。", en: "Creation time." },
  updated_at: { zh: "更新时间。", en: "Last update time." },
  created_time: { zh: "创建时间。", en: "Creation time." },
  updated_time: { zh: "更新时间。", en: "Last update time." },
  creator: { zh: "创建者。", en: "Creator." },
  owner: { zh: "所有者。", en: "Owner." },
  members: { zh: "成员列表。", en: "Member list." },
  avatar: { zh: "头像地址。", en: "Avatar URL." },
  email: { zh: "电子邮箱。", en: "Email address." },
  phone: { zh: "电话号码。", en: "Phone number." },
  url: { zh: "链接地址。", en: "URL." },
  content: { zh: "内容。", en: "Content." },
  data: { zh: "业务数据。", en: "Business data." },
  code: { zh: "错误码。", en: "Error code." },
  msg: { zh: "错误消息。", en: "Error message." },
  request_id: { zh: "请求 ID，用于排查问题。", en: "Request ID for troubleshooting." },
  error_code: { zh: "错误码。", en: "Error code." },
  error_msg: { zh: "错误消息。", en: "Error message." },
  scope: { zh: "授权范围（scope）。", en: "Authorization scope." },
  scopes: { zh: "授权范围列表。", en: "Authorization scope list." },
  access_token: { zh: "访问令牌。", en: "Access token." },
  refresh_token: { zh: "刷新令牌。", en: "Refresh token." },
  expires_in: { zh: "令牌有效期（秒）。", en: "Token lifetime in seconds." },
  lang: { zh: "展示语言。", en: "Display language." },
  offset: { zh: "偏移量。", en: "Offset." },
  limit: { zh: "返回条数上限。", en: "Maximum number of items to return." },
  keyword: { zh: "搜索关键词。", en: "Search keyword." },
  sort: { zh: "排序方式。", en: "Sort order." },
  order: { zh: "排序方向。", en: "Sort direction." },
  filter: { zh: "过滤条件。", en: "Filter conditions." },
  "X-Kso-Id-Type": { zh: "身份类型：internal（内部）或 external（外部）。", en: "Identity type: internal or external." },
  "X-Kso-Date": { zh: "RFC1123 格式的请求时间，KSO-1 签名需要。", en: "RFC1123 request time required for KSO-1 signing." },
  "X-Kso-Authorization": { zh: "KSO-1 签名值，格式为 KSO-1 accessKey:signature。", en: "KSO-1 signature value in the form KSO-1 accessKey:signature." },
  "Content-Type": { zh: "请求内容类型。", en: "Request content type." },
};

function proseForField(name, language) {
  const curated = fieldText[name]?.[language];
  if (curated) return curated;
  const label = words(name);
  if (!label) return language === "zh" ? "字段。" : "Field.";
  return language === "zh" ? label + "。" : label.charAt(0).toUpperCase() + label.slice(1) + ".";
}

/** Schema-level bilingual text: name-derived with a curated dictionary. */
const schemaText = {
  error: { zh: "通用错误响应。", en: "Common error response." },
  error_code: { zh: "错误码枚举。", en: "Error code enum." },
  error_msg: { zh: "错误消息。", en: "Error message." },
};

function proseForSchema(name, language) {
  const curated = schemaText[name]?.[language];
  if (curated) return curated;
  const label = words(name);
  if (!label) return language === "zh" ? "数据结构。" : "Data structure.";
  return language === "zh" ? label + "。" : label.charAt(0).toUpperCase() + label.slice(1) + ".";
}

// ---------------------------------------------------------------------------
// Structural keys (kept from OAS; prose keys dropped)
// ---------------------------------------------------------------------------
const structuralSchemaKeys = new Set([
  "$ref", "type", "format", "enum", "const", "default", "readOnly", "writeOnly", "nullable",
  "multipleOf", "maximum", "exclusiveMaximum", "minimum", "exclusiveMinimum", "maxLength",
  "minLength", "pattern", "contentMediaType", "contentEncoding", "maxItems", "minItems",
  "uniqueItems", "maxProperties", "minProperties", "required", "additionalProperties", "items",
  "properties", "allOf", "anyOf", "oneOf", "not",
]);

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
  const maxLen = typeof schema.maxLength === "number" ? schema.maxLength : Infinity;
  const minLen = typeof schema.minLength === "number" ? schema.minLength : 0;
  if (format === "uuid" || /id$/.test(name)) {
    const base = format === "uuid" ? "0ab51e95-9373-4d42-97f8-1b5b0a5c0b52" : "example-id-0123456789";
    if (base.length <= maxLen && base.length >= minLen) return base;
    const target = Math.max(minLen, Math.min(maxLen, 16));
    return "id".padEnd(target, "x").slice(0, target);
  }
  if (format === "date-time" || /time/.test(name)) {
    const base = "2026-08-16T00:00:00.000Z";
    if (base.length <= maxLen) return base;
    return base.slice(0, Math.max(minLen, Math.min(maxLen, 20)));
  }
  if (format === "date") return "2026-08-16";
  if (format === "email" || name === "email") return "member@example.com";
  if (format === "uri" || format === "url" || /url|link|href|avatar|icon/.test(name)) return "https://example.com";
  if (name === "title" || name === "name" || name === "content") return "Example title";
  if (name === "page_size") return 20;
  if (name === "page_token" || name === "next_page_token") return "example-page-token";
  if (name === "keyword") return "example-keyword";
  if (name === "lang") return "zh-CN";
  if (schema.type === "string") {
    const base = "example content";
    if (base.length <= maxLen) return base;
    const target = Math.max(minLen, Math.min(maxLen, 8));
    const truncated = "example-value".slice(0, target).replace(/\s+$/, "");
    return truncated || "ex";
  }
  return undefined;
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
  if (!output.type && (output.properties || output.additionalProperties)) {
    output.type = "object";
  }
  output.title = context.kind === "schema"
    ? (language === "zh" ? context.name + " 数据结构" : context.name + " data structure")
    : (language === "zh" ? words(context.name) + " 值" : words(context.name) + " value");
  output.description = context.kind === "schema"
    ? proseForSchema(context.name, language)
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
  // Normalize OAS nullability encoding: oneOf [X, {type:"null"}] -> X with nullable: true.
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
  // Normalize wrapper-only object that delegates to a single allOf branch
  // (e.g. value_type: {type:"object", allOf:[string-enum]}). The wrapper type
  // contradicts its own branch and the official docs model the value as the
  // branch type; the branch keeps the semantic contract.
  if (output.allOf && output.allOf.length === 1 && output.type === "object"
      && !output.properties && !output.items && !output.required) {
    const branch = output.allOf[0];
    if (branch && typeof branch === "object" && (branch.$ref || branch.type !== "object")) {
      const merged = { ...branch, title: output.title, description: output.description };
      return merged;
    }
  }
  return output;
}

function responseDescription(status, language) {
  const numeric = Number(status);
  const map = {
    200: language === "zh" ? "请求成功。" : "Request succeeded.",
    201: language === "zh" ? "创建成功。" : "Created.",
    202: language === "zh" ? "已接受，任务正在异步处理。" : "Accepted; the task is being processed asynchronously.",
    204: language === "zh" ? "请求成功，无返回内容。" : "Request succeeded with no content.",
    400: language === "zh" ? "请求参数无效。" : "Request parameters are invalid.",
    401: language === "zh" ? "未认证或令牌无效。" : "Unauthenticated or the token is invalid.",
    403: language === "zh" ? "无权限访问该资源。" : "Access to the resource is forbidden.",
    404: language === "zh" ? "未找到指定资源。" : "The requested resource was not found.",
    405: language === "zh" ? "方法不被允许。" : "Method not allowed.",
    406: language === "zh" ? "请求无法按要求表示。" : "The request cannot be represented as requested.",
    409: language === "zh" ? "请求与资源当前状态冲突。" : "The request conflicts with the current state of the resource.",
    415: language === "zh" ? "不支持的媒体类型。" : "Unsupported media type.",
    429: language === "zh" ? "请求频率超限，请遵循限频策略后重试。" : "Rate limited; retry per the rate-limit policy.",
    500: language === "zh" ? "上游服务内部错误。" : "Upstream internal error.",
    503: language === "zh" ? "上游服务暂时不可用。" : "Upstream service temporarily unavailable.",
  };
  if (map[numeric]) return map[numeric];
  return language === "zh" ? "上游服务返回该状态。" : "The upstream service returned this status.";
}

// ---------------------------------------------------------------------------
// Request example generation
// ---------------------------------------------------------------------------
const SAMPLE_UUID = "0ab51e95-9373-4d42-97f8-1b5b0a5c0b52";

function sampleForSchema(schema, schemas, seen, depth) {
  if (!schema || typeof schema !== "object") return undefined;
  if (depth > 16) return undefined;
  if (schema.$ref) {
    const name = schema.$ref.split("/").pop();
    const target = schemas[name];
    if (!target || seen.has(name)) return undefined;
    const next = new Set(seen).add(name);
    return sampleForSchema(target, schemas, next, depth + 1);
  }
  if (Array.isArray(schema.oneOf) && schema.oneOf.length) {
    // oneOf: prefer a branch whose sample validates against exactly one branch,
    // so the value is a faithful, unambiguous member of the union. If the
    // upstream union is structurally ambiguous (no value matches exactly one
    // branch), return undefined so the caller treats the input as dynamic.
    const candidates = [];
    for (const branch of schema.oneOf) {
      const value = sampleForSchema(branch, schemas, seen, depth + 1);
      if (value !== undefined) candidates.push({ branch, value });
    }
    if (candidates.length === 0) return undefined;
    if (candidates.length === 1) return candidates[0].value;
    const counts = candidates.map(({ value }) => {
      let match = 0;
      for (const branch of schema.oneOf) {
        if (branchValueMatches(branch, value, schemas)) match++;
      }
      return match;
    });
    const unique = candidates.find((_, i) => counts[i] === 1);
    return (unique?.value) ?? undefined;
  }
  if (Array.isArray(schema.anyOf) && schema.anyOf.length) {
    for (const branch of schema.anyOf) {
      const value = sampleForSchema(branch, schemas, seen, depth + 1);
      if (value !== undefined) return value;
    }
    return undefined;
  }
  if (Array.isArray(schema.allOf) && schema.allOf.length) {
    // If the wrapper has no own properties/required and the allOf resolves to a
    // scalar (e.g. {type:"object", allOf:[ref-to-string-enum]}), return the
    // branch sample directly so the value matches the leaf contract.
    const ownProps = schema.properties || {};
    const ownRequired = schema.required || [];
    const isWrapperOnly = Object.keys(ownProps).length === 0 && ownRequired.length === 0
      && schema.type !== "array" && !schema.items;
    if (isWrapperOnly && schema.allOf.length === 1) {
      const branchValue = sampleForSchema(schema.allOf[0], schemas, seen, depth + 1);
      if (branchValue !== undefined) return branchValue;
    }
    let merged = {};
    for (const branch of schema.allOf) {
      const value = sampleForSchema(branch, schemas, seen, depth + 1);
      if (value && typeof value === "object" && !Array.isArray(value)) merged = Object.assign(merged, value);
    }
    // If nothing object-like merged but there is a scalar branch value, prefer it.
    if (Object.keys(merged).length === 0 && schema.allOf.length === 1) {
      const branchValue = sampleForSchema(schema.allOf[0], schemas, seen, depth + 1);
      if (branchValue !== undefined) return branchValue;
    }
    return merged;
  }
  if (schema.const !== undefined) return schema.const;
  if (Array.isArray(schema.enum) && schema.enum.length) return schema.enum[0];
  if (schema.type === "object" || schema.properties) {
    const obj = {};
    for (const name of schema.required || []) {
      const child = schema.properties?.[name];
      if (child === undefined) continue;
      const value = sampleForSchema(child, schemas, seen, depth + 1);
      if (value === undefined) return undefined; // required input unresolvable -> propagate
      obj[name] = value;
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
  if (schema.type === "string") return "example-content";
  if (schema.type === "generic") return "example-content";
  return undefined;
}

/** Whether a value satisfies a oneOf branch schema (structural subset check). */
function branchValueMatches(branch, value, schemas, seen = new Set()) {
  if (!branch || typeof branch !== "object") return false;
  if (seen.has(branch)) return true;
  const next = new Set(seen).add(branch);
  if (branch.$ref) {
    const name = branch.$ref.startsWith("#/components/schemas/") ? branch.$ref.split("/").pop() || "" : "";
    const target = schemas[name];
    return !!target && branchValueMatches(target, value, schemas, next);
  }
  if (Array.isArray(branch.allOf)) {
    return branch.allOf.every((item) => branchValueMatches(item, value, schemas, next));
  }
  if (Array.isArray(branch.oneOf)) {
    return branch.oneOf.filter((item) => branchValueMatches(item, value, schemas, next)).length === 1;
  }
  if (Array.isArray(branch.anyOf)) {
    return branch.anyOf.some((item) => branchValueMatches(item, value, schemas, next));
  }
  if (branch.type === "object" || branch.properties) {
    if (!value || typeof value !== "object" || Array.isArray(value)) return false;
    for (const requiredName of branch.required || []) {
      if (!Object.prototype.hasOwnProperty.call(value, requiredName)) return false;
    }
    for (const [name, child] of Object.entries(branch.properties || {})) {
      if (Object.prototype.hasOwnProperty.call(value, name)) {
        if (!branchValueMatches(child, value[name], schemas, next)) return false;
      }
    }
    return true;
  }
  if (branch.type === "array" || branch.items) {
    if (!Array.isArray(value)) return false;
    if (branch.items && !value.every((item) => branchValueMatches(branch.items, item, schemas, next))) return false;
    return true;
  }
  // leaf: enum/const/type checks (structural only)
  if (branch.enum?.length && !branch.enum.some((item) => JSON.stringify(item) === JSON.stringify(value))) return false;
  if (branch.const !== undefined && JSON.stringify(branch.const) !== JSON.stringify(value)) return false;
  if (branch.type === "string") return typeof value === "string";
  if (branch.type === "integer") return Number.isInteger(value);
  if (branch.type === "number") return typeof value === "number" && Number.isFinite(value);
  if (branch.type === "boolean") return typeof value === "boolean";
  if (branch.type === "generic") return true;
  return true;
}

function pathValue(name, schema) {
  const type = schema?.type;
  if (type === "integer" || type === "number") {
    return typeof schema.minimum === "number" ? Math.max(schema.minimum, 1) : 1;
  }
  if (type === "boolean") return true;
  const maxLen = typeof schema?.maxLength === "number" ? schema.maxLength : Infinity;
  const minLen = typeof schema?.minLength === "number" ? schema.minLength : 0;
  const base = "0ab51e95-9373-4d42-97f8-1b5b0a5c0b52";
  if (base.length <= maxLen && base.length >= minLen) return base;
  const target = Math.max(minLen, Math.min(maxLen, 16));
  return "id".padEnd(target, "x").slice(0, target);
}

function queryValue(name, schema) {
  const type = schema?.type;
  const format = schema?.format;
  if (name === "page_size") {
    const max = typeof schema.maximum === "number" ? schema.maximum : 20;
    const min = typeof schema.minimum === "number" ? schema.minimum : 1;
    return Math.min(Math.max(min, 20), max);
  }
  if (name === "page_token" || name === "next_page_token") return "example-page-token";
  if (name === "lang") return "zh-CN";
  if (name === "keyword") return "example-keyword";
  if (type === "integer") {
    const max = typeof schema.maximum === "number" ? schema.maximum : Number.MAX_SAFE_INTEGER;
    const min = typeof schema.minimum === "number" ? schema.minimum : Number.MIN_SAFE_INTEGER;
    return Math.min(Math.max(min, 1), max);
  }
  if (type === "number") {
    const max = typeof schema.maximum === "number" ? schema.maximum : Number.MAX_VALUE;
    const min = typeof schema.minimum === "number" ? schema.minimum : Number.MIN_VALUE;
    return Math.min(Math.max(min, 1), max);
  }
  if (type === "boolean") return true;
  if (format === "date-time") return "2026-08-16T00:00:00.000Z";
  if (format === "date") return "2026-08-16";
  if (name === "email") return "member@example.com";
  const maxLen = typeof schema?.maxLength === "number" ? schema.maxLength : Infinity;
  const minLen = typeof schema?.minLength === "number" ? schema.minLength : 0;
  const base = "example-query-value";
  if (base.length <= maxLen && base.length >= minLen) return base;
  const target = Math.max(minLen, Math.min(maxLen, 16));
  return "ex".padEnd(target, "m").slice(0, target);
}

function requestPathValues(api) {
  const result = {};
  for (const parameter of api.parameters || []) {
    if (parameter.in === "path") result[parameter.name] = pathValue(parameter.name);
  }
  return result;
}

export {
  root, outputRoot, sourceUrl, curatedUrl, sourceSha256, curatedSha256, verifiedAt, apiVersion, baseUrl,
  methods, sha256, words, fieldText, proseForField, proseForSchema, copySchema, responseDescription,
  sampleForSchema, pathValue, queryValue, requestPathValues, SAMPLE_UUID, yaml,
  importOpenAPI, loadPontxSpec, validatePontxSpec, validatePontxSpecLocale, evaluatePontxQuality, PontxSpec,
  readFile, mkdir, writeFile, createHash,
};
