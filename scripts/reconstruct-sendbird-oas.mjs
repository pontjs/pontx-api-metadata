/**
 * Reconstruct the Sendbird Chat Platform API v3 OpenAPI contract from the
 * pinned official generated SDK source.
 *
 * Source of truth: sendbird/sendbird-platform-sdk-typescript@fccf6fa11117e15bd4dcdd89127407f0b46e7ce8
 * (v2.1.8). The repository publishes no OpenAPI document; the generated SDK
 * (openapi-generator output) is the official machine-readable representation
 * of the Platform API v3 wire contract. This script parses the generated
 * TypeScript deterministically and emits an OpenAPI 3.1 document plus an
 * endpoint evidence manifest used by the product build.
 *
 * Usage:
 *   node scripts/reconstruct-sendbird-oas.mjs [sdk-checkout-path]
 *
 * Outputs (relative to the repository root):
 *   candidates/sendbird-chat-platform/sources/sendbird-platform.oas.json
 *   candidates/sendbird-chat-platform/sources/endpoint-manifest.json
 */

import { existsSync } from "node:fs";
import { execSync } from "node:child_process";
import { readdir, readFile, mkdir, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const PINNED_REVISION = "fccf6fa11117e15bd4dcdd89127407f0b46e7ce8";
const sdkPath = resolve(process.argv[2] ?? "/tmp/sendbird-sdk-checkout");
if (!existsSync(sdkPath)) {
  console.log("Cloning pinned Sendbird SDK into " + sdkPath + " ...");
  execSync("git clone https://github.com/sendbird/sendbird-platform-sdk-typescript.git " + sdkPath, { stdio: "inherit" });
  execSync("git -C " + sdkPath + " checkout " + PINNED_REVISION, { stdio: "inherit" });
}
const apiDir = resolve(sdkPath, "src/api/generated/apis");
const modelsDir = resolve(sdkPath, "models");
const outDir = resolve(root, "candidates/sendbird-chat-platform/sources");

const API_CLASSES = [
  "AnnouncementApi", "BotApi", "GroupChannelApi", "MessageApi",
  "MetadataApi", "ModerationApi", "OpenChannelApi", "StatisticsApi", "UserApi",
];

const tagByClass = {
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

import { createHash } from "node:crypto";

function sha256(value) {
  return createHash("sha256").update(value).digest("hex");
}

function extractJSDoc(text, anchor) {
  // Find the /** ... */ block immediately preceding the anchor.
  const index = text.indexOf(anchor);
  if (index < 0) return null;
  const end = index;
  const start = text.lastIndexOf("/**", end);
  if (start < 0) return null;
  const raw = text.slice(start + 3, end).replace(/^\s*\*\s?/gm, "").trim();
  return raw;
}

function parseArgs(signature) {
  // signature: "userId: string, apiToken?: string, ..." possibly multiline
  const args = [];
  let depth = 0;
  let current = "";
  for (const ch of signature) {
    if (ch === "<") depth += 1;
    else if (ch === ">") depth = Math.max(0, depth - 1);
    if (ch === "," && depth === 0) {
      args.push(current.trim());
      current = "";
    } else {
      current += ch;
    }
  }
  if (current.trim()) args.push(current.trim());
  return args
    .filter((arg) => arg && !arg.startsWith("_options"))
    .map((arg) => {
      // name?: Type  |  name: Type
      const match = arg.match(/^([A-Za-z_$][\w$]*)(\??):\s*(.+)$/);
      if (!match) return null;
      return { name: match[1], required: match[2] !== "?", type: match[3].trim() };
    })
    .filter(Boolean);
}

function parseRequestMethods(fileText, className) {
  const methods = [];
  const parts = fileText.split("public async ");
  for (let i = 1; i < parts.length; i += 1) {
    const chunk = parts[i];
    const sigEnd = chunk.indexOf("): Promise<RequestContext>");
    if (sigEnd < 0) continue; // response method or other
    const sig = chunk.slice(0, sigEnd);
    const nameMatch = sig.match(/^(\w+)\s*\(([\s\S]*)$/);
    if (!nameMatch) continue;
    const name = nameMatch[1];
    const args = parseArgs(nameMatch[2]);
    const body = chunk.slice(0, Math.max(sigEnd, chunk.indexOf("return requestContext;")));

    const pathMatch = body.match(/const localVarPath = '([^']+)'/);
    if (!pathMatch) continue;
    const path = pathMatch[1];
    const methodMatch = body.match(/HttpMethod\.(\w+)/);
    if (!methodMatch) continue;
    const httpMethod = methodMatch[1].toUpperCase();

    // Path params: {token} in the template mapped to args via .replace calls.
    const pathParams = [];
    for (const token of path.matchAll(/\{([^}]+)\}/g)) {
      const paramName = token[1];
      const replaceMatch = body.match(
        new RegExp("replace\\('\\{' \\+ '" + paramName.replace(/[.*+?^${}()|[\]\\]/g, "\\$&") + "' \\+ '\\}', encodeURIComponent\\(String\\(([^)]+)\\)\\)")
      );
      const argName = replaceMatch ? replaceMatch[1] : paramName;
      const arg = args.find((a) => a.name === argName);
      pathParams.push({
        name: paramName,
        arg: argName,
        required: Boolean(arg && arg.required),
        type: arg ? arg.type : "string",
      });
    }

    const queryParams = [];
    for (const m of body.matchAll(/setQueryParam\("([^"]+)", ObjectSerializer\.serialize\(([^,]+), "([^"]+)", "([^"]*)"\)\)/g)) {
      const arg = args.find((a) => a.name === m[2].trim());
      queryParams.push({
        name: m[1],
        arg: m[2].trim(),
        type: m[3],
        format: m[4],
        required: Boolean(arg && arg.required),
      });
    }

    // Body: the serialized body type feeding requestContext.setBody.
    let bodyType = null;
    const bodySerialize = body.match(/ObjectSerializer\.serialize\(([^,]+), "([^"]+)", "([^"]*)"\)/g);
    if (bodySerialize && /setBody\(/.test(body)) {
      // The last serialize feeding the body (the body arg is serialized last).
      const serialized = body.match(/const serializedBody = ObjectSerializer\.stringify\(\s*ObjectSerializer\.serialize\(([^,]+), "([^"]+)", "([^"]*)"\)/);
      if (serialized) {
        bodyType = { arg: serialized[1].trim(), type: serialized[2], format: serialized[3] };
      }
    }

    // Auth: api-token header (case varies across generated classes).
    const usesApiToken = /setHeaderParam\("(?:api-token|Api-Token)"/.test(body);

    // Required args per RequiredError checks.
    const requiredArgs = new Set();
    for (const m of body.matchAll(/if \(([\w$]+) === null \|\| \1 === undefined\)/g)) {
      requiredArgs.add(m[1]);
    }

    const jsdoc = extractJSDoc(fileText, "public async " + name + "(");
    let summary = name;
    let description = "";
    let docsUrl = "";
    if (jsdoc) {
      const lines = jsdoc.split("\n").map((line) => line.trim()).filter(Boolean);
      const titleLine = lines.find((line) => line.startsWith("## "));
      const summaryLine = lines.find((line) => /^[A-Za-z]/.test(line) && !line.startsWith("#") && !line.startsWith("@") && !line.startsWith("["));
      if (titleLine) description = titleLine.replace(/^##\s+/, "");
      if (summaryLine) summary = summaryLine.replace(/^[•\-\*]\s*/, "");
      const urlMatch = jsdoc.match(/https:\/\/sendbird\.com\/docs\/chat\/[^\s]+/);
      if (urlMatch) docsUrl = urlMatch[0];
    }

    methods.push({
      name,
      className,
      tag: tagByClass[className],
      httpMethod,
      path,
      args,
      pathParams,
      queryParams,
      bodyType,
      usesApiToken,
      requiredArgs: [...requiredArgs],
      summary,
      description,
      docsUrl,
    });
  }
  return methods;
}

function parseResponseMethods(fileText) {
  const responses = {};
  const parts = fileText.split("public async ");
  for (let i = 1; i < parts.length; i += 1) {
    const chunk = parts[i];
    const match = chunk.match(/^(\w+)\s*\(\s*response:\s*ResponseContext\s*\):\s*Promise<([^>]+(?:<[^>]+>)?)>/);
    if (match) responses[match[1]] = match[2].trim();
  }
  return responses;
}

const PRIMITIVES = new Set(["string", "number", "boolean", "any", "HttpFile"]);
const MAP_PATTERN = /^\{\s*\[key: string\]:\s*([^;}]+);?\s*\}$/;

function parseType(type, enums, models) {
  const t = String(type).trim();
  if (t === "any") return { additionalProperties: true };
  if (t === "HttpFile") return { type: "string", format: "binary" };
  const mapMatch = t.match(MAP_PATTERN);
  if (mapMatch) {
    return { type: "object", additionalProperties: parseType(mapMatch[1].trim(), enums, models) };
  }
  const arrayMatch = t.match(/^Array<(.+)>$/);
  if (arrayMatch) {
    return { type: "array", items: parseType(arrayMatch[1].trim(), enums, models) };
  }
  if (PRIMITIVES.has(t)) {
    if (t === "number") return { type: "number" };
    return { type: t };
  }
  if (enums.has(t)) {
    return { $ref: "#/components/schemas/" + t };
  }
  if (models.has(t)) {
    return { $ref: "#/components/schemas/" + t };
  }
  // Unknown reference type: treat as free-form object rather than guessing.
  return { additionalProperties: true };
}

async function parseModels() {
  const files = (await readdir(modelsDir)).filter((file) => file.endsWith(".ts"));
  const schemas = {};
  const enums = new Set();
  const models = new Set();
  const enumValues = {};

  for (const file of files) {
    const text = await readFile(resolve(modelsDir, file), "utf8");

    // Pure enum files: export type X = "a" | "b" ;
    for (const m of text.matchAll(/export type (\w+) = ([^;]+);/g)) {
      const values = m[2].split("|").map((v) => v.trim().replace(/^"(.*)"$/, "$1")).filter((v) => v !== "");
      if (values.length) {
        enums.add(m[1]);
        enumValues[m[1]] = values;
        schemas[m[1]] = {
          type: "string",
          enum: values,
          description: "枚举：允许的值。",
        };
      }
    }

    const classMatch = text.match(/export class (\w+)/);
    if (!classMatch) continue;
    const className = classMatch[1];
    models.add(className);

    const attrMatch = text.match(/static readonly attributeTypeMap:[^=]*=\s*(\[[\s\S]*?\])\s*;/);
    if (!attrMatch) continue;
    let attrs;
    try {
      attrs = JSON.parse(attrMatch[1]);
    } catch {
      console.error("Failed to parse attributeTypeMap for " + className);
      continue;
    }

    // Requiredness from class property declarations: 'name':  vs 'name'?:
    const classBody = text.slice(classMatch.index + classMatch[0].length);
    const required = new Set();
    for (const line of classBody.split("\n")) {
      const prop = line.match(/^\s*'([^']+)'(\??):/);
      if (prop && prop[2] !== "?") required.add(prop[1]);
    }

    const properties = {};
    const requiredProps = [];
    for (const attr of attrs) {
      const { name, baseName, type, format } = attr;
      const schema = parseType(type, enums, models);
      if (format === "int64" && schema.type === "number") {
        schema.type = "integer";
        schema.format = "int64";
      } else if (format === "double" && schema.type === "number") {
        schema.format = "double";
      }
      const propJSDoc = text.match(new RegExp("/\\*\\*([\\s\\S]*?)\\*/\\s*'?" + name.replace(/[.*+?^${}()|[\]\\]/g, "\\$&") + "'?\\??:" ));
      let description = "";
      if (propJSDoc) {
        description = propJSDoc[1].replace(/^\s*\*\s?/gm, "").trim().split("\n")[0] ?? "";
      }
      const entry = { ...schema };
      if (description) entry.description = description;
      properties[baseName] = entry;
      if (required.has(name)) requiredProps.push(baseName);
    }
    const classJSDoc = text.match(/\/\*\*([\s\S]*?)\*\/\s*\nexport class /);
    const classDescription = classJSDoc
      ? classJSDoc[1].replace(/^\s*\*\s?/gm, "").trim().split("\n").pop() ?? ""
      : "";
    schemas[className] = {
      type: "object",
      description: classDescription || undefined,
      properties,
      required: requiredProps,
    };
  }
  return { schemas, enums, models, enumValues };
}

// ---------------------------------------------------------------------------

const apiTexts = {};
const requestMethods = [];
const responseMethods = {};
for (const className of API_CLASSES) {
  const file = resolve(apiDir, className + ".ts");
  const text = await readFile(file, "utf8");
  apiTexts[className] = text;
  requestMethods.push(...parseRequestMethods(text, className));
  responseMethods[className] = parseResponseMethods(text);
}

// Attach response types by name.
for (const method of requestMethods) {
  method.responseType = responseMethods[method.className]?.[method.name] ?? null;
}

// Deduplicate by method+path (same route registered in multiple classes).
const seen = new Set();
const endpoints = [];
for (const method of requestMethods) {
  const key = method.httpMethod + " " + method.path;
  if (seen.has(key)) {
    console.warn("Duplicate route " + key + " (" + method.className + "); keeping first.");
    continue;
  }
  seen.add(key);
  endpoints.push(method);
}
endpoints.sort((a, b) => {
  const tagCompare = a.tag.localeCompare(b.tag);
  return tagCompare !== 0 ? tagCompare : a.path.localeCompare(b.path);
});

const { schemas, enums, models, enumValues } = await parseModels();

// Build OpenAPI 3.1.
const oas = {
  openapi: "3.1.0",
  info: {
    title: "Sendbird Chat Platform API",
    description:
      "服务端 Chat Platform API v3（官方生成 SDK v2.1.8 重建契约）：管理用户、群组频道、开放频道、消息、元数据、审核、机器人、公告与统计。REST/JSON；鉴权使用 api-token 头。基址 https://api-{app_id}.sendbird.com。",
    version: "3.0.0",
    termsOfService: "https://sendbird.com/terms-of-service/",
    contact: { name: "Sendbird Support", url: "https://sendbird.com/contact-us/" },
  },
  servers: [
    {
      url: "https://api-{app_id}.sendbird.com",
      description: "Sendbird Platform API（以应用 ID 替换 {app_id}）",
      variables: {
        app_id: { default: "APP_ID", description: "Sendbird 应用 ID" },
      },
    },
  ],
  security: [{ apiTokenAuth: [] }],
  tags: Object.entries(tagByClass).map(([className, tag]) => ({ name: tag })),
  paths: {},
  components: {
    securitySchemes: {
      apiTokenAuth: {
        type: "apiKey",
        in: "header",
        name: "api-token",
        description: "Sendbird 主 API 令牌（application API token），通过 api-token 请求头提供；请通过 SENDBIRD_API_TOKEN 环境变量注入。",
      },
    },
    schemas: {},
  },
};

function typeToSchema(type) {
  const t = String(type ?? "").trim();
  if (!t || t === "any") return { additionalProperties: true };
  if (t === "string") return { type: "string" };
  if (t === "boolean") return { type: "boolean" };
  if (t === "number") return { type: "number" };
  if (t === "HttpFile") return { type: "string", format: "binary" };
  // Inline union literal enums from the generated TS, e.g. 'all' | 'super' | 'nonsuper'.
  if (/^'.+'\s*(\|.+)+$/.test(t)) {
    const values = t.split("|").map((v) => v.trim().replace(/^'(.*)'$/, "$1")).filter((v) => v !== "");
    return { type: "string", enum: values };
  }
  const mapMatch = t.match(MAP_PATTERN);
  if (mapMatch) return { type: "object", additionalProperties: typeToSchema(mapMatch[1].trim()) };
  const arrayMatch = t.match(/^Array<(.+)>$/);
  if (arrayMatch) return { type: "array", items: typeToSchema(arrayMatch[1].trim()) };
  if (enums.has(t) || models.has(t)) return { $ref: "#/components/schemas/" + t };
  return { additionalProperties: true };
}

function typeNameToSchema(name) {
  return typeToSchema(name);
}

for (const endpoint of endpoints) {
  const parameters = [];
  for (const pp of endpoint.pathParams) {
    parameters.push({
      name: pp.name,
      in: "path",
      required: true,
      schema: typeNameToSchema(pp.type === "string" ? "string" : pp.type),
      description: "路径参数 " + pp.name + "。",
    });
  }
  for (const qp of endpoint.queryParams) {
    parameters.push({
      name: qp.name,
      in: "query",
      required: qp.required,
      schema: typeToSchema(qp.type),
      description: "查询参数 " + qp.name + "。",
    });
  }
  if (endpoint.usesApiToken) {
    parameters.push({
      name: "api-token",
      in: "header",
      required: false,
      schema: { type: "string" },
      description: "应用 API 令牌（也支持 Api-Token 头）。",
    });
  }
  const operation = {
    operationId: endpoint.name,
    summary: endpoint.summary,
    description: endpoint.description,
    tags: [endpoint.tag],
    parameters,
    responses: {
      "200": {
        description: "请求成功。",
        content: {
          "application/json": { schema: typeNameToSchema(endpoint.responseType ?? "any") },
        },
      },
    },
  };
  if (endpoint.bodyType) {
    operation.requestBody = {
      required: false,
      content: {
        "application/json": { schema: typeNameToSchema(endpoint.bodyType.type) },
      },
    };
  }
  oas.paths[endpoint.path] = oas.paths[endpoint.path] ?? {};
  if (oas.paths[endpoint.path][endpoint.httpMethod.toLowerCase()]) {
    console.warn("Duplicate operation for " + endpoint.httpMethod + " " + endpoint.path);
  }
  oas.paths[endpoint.path][endpoint.httpMethod.toLowerCase()] = operation;
}

oas.components.schemas = Object.fromEntries(
  Object.entries(schemas).map(([name, schema]) => [name, schema])
);

// ---------------------------------------------------------------------------

await mkdir(outDir, { recursive: true });
const oasBytes = Buffer.from(JSON.stringify(oas, null, 2) + "\n");
await writeFile(resolve(outDir, "sendbird-platform.oas.json"), oasBytes);

const manifest = {
  formatVersion: 1,
  sdk: {
    repository: "https://github.com/sendbird/sendbird-platform-sdk-typescript",
    revision: PINNED_REVISION,
    version: "2.1.8",
    generator: "openapi-generator",
  },
  endpoints: endpoints.map(({ name, className, tag, httpMethod, path, args, pathParams, queryParams, bodyType, responseType, summary, docsUrl }) => ({
    operationId: name,
    className,
    tag,
    method: httpMethod,
    path,
    pathParams: pathParams.map((p) => p.name),
    queryParams: queryParams.map((q) => q.name),
    bodyType: bodyType ? bodyType.type : null,
    responseType,
    summary,
    docsUrl: docsUrl || null,
  })),
  counts: {
    endpoints: endpoints.length,
    schemas: Object.keys(schemas).length,
    models: models.size,
    enums: enums.size,
  },
};
await writeFile(resolve(outDir, "endpoint-manifest.json"), JSON.stringify(manifest, null, 2) + "\n");

console.log("Reconstructed Sendbird Chat Platform API v3:");
const methodCounts = endpoints.reduce((acc, e) => (acc[e.httpMethod] = (acc[e.httpMethod] ?? 0) + 1, acc), {});
console.log("  endpoints:", endpoints.length, "| methods:", JSON.stringify(methodCounts));
console.log("  schemas:", Object.keys(schemas).length, "| models:", models.size, "| enums:", enums.size);
console.log("  OAS SHA-256:", sha256(oasBytes));
console.log("  wrote", resolve(outDir, "sendbird-platform.oas.json"));
