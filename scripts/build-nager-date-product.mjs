import { createHash } from "node:crypto";
import { mkdir, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { importOpenAPI, loadPontxSpec, PontxSpec } from "@pontx/spec";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const outputRoot = resolve(root, "products/nager-date");
const sourceUrl = "https://nagerholidays.com/openapi/community-v4.json";
const sourceSha256 = "105d4805f426663e21ceecfd865015f247c6d6e9ba4a696630fd524386c6179a";
const sourceRevision = "54958d527be004653906b98d5f7e7dbda019e7a1";
const licenseUrl = `https://raw.githubusercontent.com/nager/Nager.Date/${sourceRevision}/LICENSE`;
const licenseApiUrl = `https://api.github.com/repos/nager/Nager.Date/contents/LICENSE?ref=${sourceRevision}`;
const licenseSha256 = "c3395894541167f40ec38bfa4fbe8f13f0e8347cf728f2425a1fde80d0a2b031";
const verifiedAt = "2026-08-15";

const methods = new Set(["get", "put", "post", "delete", "patch", "head", "options", "trace"]);
const operationIds = {
  "countries/getByCountryCode": "getCountry",
  "countries/getAvailable": "listAvailableCountries",
  "holidays/getByYear": "listHolidaysByYear",
  "holidays/getNext": "listUpcomingHolidays",
  "iotHolidays/getByOffset": "isTodayHoliday",
  "versions/getVersions": "getVersions",
};

const endpointText = {
  getCountry: {
    zh: ["查询国家信息", "使用 ISO 3166-1 alpha-2 国家代码查询国家名称、地区和可用的陆地边界信息。"],
    en: ["Get country information", "Gets country names, region, and available land-border information for an ISO 3166-1 alpha-2 code."],
  },
  listAvailableCountries: {
    zh: ["列出支持的国家", "返回 Nager.Date Community API 提供公共节假日数据的国家和地区代码。"],
    en: ["List supported countries", "Returns the country and territory codes for which the Nager.Date Community API provides public-holiday data."],
  },
  listHolidaysByYear: {
    zh: ["查询年度公共节假日", "返回指定国家和年份的公共节假日，包括名称、适用范围、行政区和节假日类型。"],
    en: ["List public holidays for a year", "Returns public holidays for one country and year, including names, scope, subdivisions, and classifications."],
  },
  listUpcomingHolidays: {
    zh: ["查询未来公共节假日", "返回指定国家未来 365 天内的公共节假日；没有结果时上游返回 204。"],
    en: ["List upcoming public holidays", "Returns a country's public holidays in the next 365 days; the upstream service returns 204 when none are available."],
  },
  isTodayHoliday: {
    zh: ["检查今天是否为公共节假日", "按 UTC 或给定时区偏移检查国家或 ISO 3166-2 行政区今天是否为公共节假日；200 表示是，204 表示否。"],
    en: ["Check whether today is a public holiday", "Checks whether today is a public holiday for a country or ISO 3166-2 subdivision at UTC or the requested offset; 200 means yes and 204 means no."],
  },
  getVersions: {
    zh: ["查询服务版本", "返回上游服务当前使用的 Nager.Date 实现名称和版本。"],
    en: ["Get service version", "Returns the name and version of the Nager.Date implementation currently used by the upstream service."],
  },
};

const fieldText = {
  commonName: { zh: "国家的常用名称。", en: "Commonly used country name." },
  nativeName: { zh: "国家以本地语言表示的名称。", en: "Country name in a native language." },
  officialName: { zh: "国家的正式名称。", en: "Official country name." },
  countryCode: { zh: "ISO 3166-1 alpha-2 国家代码。", en: "ISO 3166-1 alpha-2 country code." },
  region: { zh: "国家所属地区。", en: "Country region." },
  borders: { zh: "相邻国家列表；没有边界信息时可为空。", en: "Adjacent countries; may be null when border data is unavailable." },
  name: { zh: "上游返回的名称。", en: "Name returned by the upstream service." },
  date: { zh: "节假日日期，使用 ISO 8601 date 格式。", en: "Holiday date in ISO 8601 date format." },
  nationalHoliday: { zh: "该节假日是否适用于整个国家。", en: "Whether the holiday applies across the whole country." },
  subdivisionCodes: { zh: "适用行政区的 ISO 3166-2 代码；全国节假日时可为空。", en: "ISO 3166-2 codes of applicable subdivisions; may be null for national holidays." },
  holidayTypes: { zh: "节假日分类列表。", en: "Holiday classification list." },
  type: { zh: "问题详情类型 URI；上游可返回空值。", en: "Problem-detail type URI; upstream may return null." },
  title: { zh: "问题标题；上游可返回空值。", en: "Problem title; upstream may return null." },
  status: { zh: "HTTP 问题状态码；上游可返回空值。", en: "HTTP problem status; upstream may return null." },
  detail: { zh: "问题详情；上游可返回空值。", en: "Problem detail; upstream may return null." },
  instance: { zh: "问题实例 URI；上游可返回空值。", en: "Problem instance URI; upstream may return null." },
  errors: { zh: "按字段返回的验证错误。", en: "Validation errors returned by field." },
  version: { zh: "Nager.Date 实现版本。", en: "Nager.Date implementation version." },
  isoCode: { zh: "ISO 3166-1 alpha-2 国家代码，或 ISO 3166-2 行政区代码。", en: "ISO 3166-1 alpha-2 country code or ISO 3166-2 subdivision code." },
  offset: { zh: "相对 UTC 的整点偏移，范围为 -12 至 12。", en: "Whole-hour UTC offset, from -12 through 12." },
  year: { zh: "要查询公共节假日的公历年份。", en: "Gregorian year for the requested public holidays." },
};

const schemaText = {
  CountryInfoDto: { zh: "国家的名称、地区和 ISO 代码。", en: "Country names, region, and ISO code." },
  CountryInfoWithBordersDto: { zh: "附带可用边界信息的国家资料。", en: "Country information with available border data." },
  CountryV4Dto: { zh: "支持公共节假日数据的国家。", en: "Country supported for public-holiday data." },
  HolidayTypes: { zh: "公共节假日分类。", en: "Public-holiday classification." },
  ProblemDetails: { zh: "上游返回的问题详情。", en: "Problem details returned by the upstream service." },
  PublicHolidayV4Dto: { zh: "公共节假日资料。", en: "Public-holiday information." },
  ValidationProblemDetails: { zh: "带字段验证错误的问题详情。", en: "Problem details with field-level validation errors." },
  VersionInfoDto: { zh: "服务实现版本资料。", en: "Service implementation version information." },
};

const tagText = {
  countries: { zh: "国家与地区资料。", en: "Country and territory information." },
  holidays: { zh: "公共节假日查询。", en: "Public-holiday lookups." },
  iotHolidays: { zh: "面向自动化状态检查的节假日查询。", en: "Holiday checks for automation workflows." },
  versions: { zh: "服务版本资料。", en: "Service-version information." },
};

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
  return fieldText[name]?.[language]
    ?? (language === "zh" ? `${words(name)} 字段。` : `${words(name)} field.`);
}

function leafExample(name, schema) {
  if (Array.isArray(schema.enum) && schema.enum.length) return schema.enum[0];
  if (name === "countryCode" || name === "isoCode") return "US";
  if (name === "year") return 2026;
  if (name === "offset") return 0;
  if (name === "date") return "2026-01-01";
  if (name === "name") return "New Year's Day";
  if (name === "commonName") return "United States";
  if (name === "nativeName") return "United States";
  if (name === "officialName") return "United States of America";
  if (name === "region") return "Americas";
  if (name === "type" || name === "instance") return "https://example.com/problems/not-found";
  if (name === "title") return "Not found";
  if (name === "detail") return "The requested country code is not available.";
  if (name === "version") return "2.19.0";
  if (schema.type === "boolean") return true;
  if (schema.type === "integer") return typeof schema.minimum === "number" ? Math.max(schema.minimum, 1) : 404;
  if (schema.type === "number") return typeof schema.minimum === "number" ? schema.minimum : 1;
  if (schema.type === "string") return `${name}-example`;
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
  output.title = context.kind === "schema"
    ? (language === "zh" ? `${context.name} 数据结构` : `${context.name} data structure`)
    : (language === "zh" ? `${words(context.name)} 值` : `${words(context.name)} value`);
  output.description = context.kind === "schema"
    ? (schemaText[context.name]?.[language] ?? proseForField(context.name, language))
    : proseForField(context.name, language);
  if (output.enum?.length) {
    output.enumValueTitles = Object.fromEntries(output.enum.map((value) => [
      String(value),
      language === "zh" ? `节假日类型：${value}。` : `Holiday type: ${value}.`,
    ]));
  }
  const compound = output.type === "object" || output.type === "array" || output.properties || output.items
    || output.additionalProperties || output.allOf || output.anyOf || output.oneOf || output.not;
  if (!compound) {
    const example = leafExample(context.name, output);
    if (example !== undefined) output.examples = [example];
  }
  return output;
}

function responseDescription(status, language) {
  const numeric = Number(status);
  if (language === "zh") {
    if (numeric >= 200 && numeric < 300) return "请求成功。";
    if (numeric === 400) return "请求参数无效。";
    if (numeric === 404) return "未找到指定国家或资源。";
    if (numeric >= 500) return "上游服务未能完成请求。";
    return "上游服务返回该状态。";
  }
  if (numeric >= 200 && numeric < 300) return "Request succeeded.";
  if (numeric === 400) return "Request parameters are invalid.";
  if (numeric === 404) return "The requested country or resource was not found.";
  if (numeric >= 500) return "The upstream service could not complete the request.";
  return "The upstream service returned this status.";
}

function requestPath(operationId) {
  if (operationId === "getCountry") return { countryCode: "US" };
  if (operationId === "listHolidaysByYear") return { countryCode: "US", year: 2026 };
  if (operationId === "listUpcomingHolidays") return { countryCode: "US" };
  if (operationId === "isTodayHoliday") return { isoCode: "US", offset: 0 };
  return {};
}

function expectedStatus(operationId) {
  // The IoT endpoint's response intentionally depends on the current date.  The
  // verified sample below currently returns 204, which is a documented success.
  return operationId === "isTodayHoliday" ? "204" : "200";
}

function tagForImportedKey(key) {
  if (key.startsWith("countries/")) return "countries";
  if (key.startsWith("holidays/")) return "holidays";
  if (key.startsWith("iotHolidays/")) return "iotHolidays";
  if (key.startsWith("versions/")) return "versions";
  throw new Error(`Unexpected imported endpoint: ${key}`);
}

function curateApi(key, api, language) {
  const operationId = operationIds[key];
  if (!operationId) throw new Error(`Unmapped official endpoint: ${key}`);
  const [summary, description] = endpointText[operationId][language];
  const parameters = (api.parameters ?? []).map((parameter) => ({
    in: parameter.in,
    name: parameter.name,
    required: Boolean(parameter.required),
    schema: copySchema(parameter.schema, language, { kind: "field", name: parameter.name }),
  }));
  const responses = Object.fromEntries(Object.entries(api.responses ?? {}).map(([status, response]) => [
    status,
    {
      description: responseDescription(status, language),
      ...(response.schema ? { schema: copySchema(response.schema, language, { kind: "schema", name: `${operationId}Response` }) } : {}),
      ...(response.content ? {
        content: Object.fromEntries(Object.entries(response.content).map(([mediaType, media]) => [
          mediaType,
          media.schema ? { schema: copySchema(media.schema, language, { kind: "schema", name: `${operationId}Response` }) } : {},
        ])),
      } : {}),
    },
  ]));
  const disabledReason = language === "zh"
    ? "Nager.Date Community API 条款限制其用途，商业使用需要有效赞助；Pontx Hub 不代理、缓存或聚合节假日数据。请由调用方在确认自身许可后使用本地 SDK 或 CLI 直连。"
    : "Nager.Date Community API terms restrict use and require active sponsorship for commercial use; Pontx Hub does not proxy, cache, or aggregate holiday data. Use the local SDK or CLI directly only after confirming your own entitlement.";
  return {
    summary,
    description,
    operationId,
    tags: [tagForImportedKey(key)],
    method: api.method,
    path: api.path,
    consumes: api.consumes ?? [],
    produces: api.produces ?? ["application/json"],
    parameters,
    responses,
    security: [],
    requestExamples: {
      default: {
        summary: language === "zh" ? "可复现的只读请求" : "Reproducible read-only request",
        request: { path: requestPath(operationId), query: {}, headers: {} },
        expectedStatus: expectedStatus(operationId),
        serverUrl: "https://nagerholidays.com",
        verifiedAt,
      },
    },
    metadata: {
      documentation: {
        status: "official",
        evidence: [sourceUrl, "https://nagerholidays.com/legal/termsofservice"],
        verifiedAt,
      },
      execution: { enabled: false, disabledReason },
    },
  };
}

function buildSpec(imported, language) {
  const apis = Object.fromEntries(Object.entries(imported.apis).map(([key, api]) => [
    `${tagForImportedKey(key)}/${operationIds[key]}`,
    curateApi(key, api, language),
  ]));
  const usedTags = [...new Set(Object.values(apis).flatMap((api) => api.tags))];
  const schemas = Object.fromEntries(Object.entries(imported.components.schemas).map(([name, schema]) => [
    name,
    copySchema(schema, language, { kind: "schema", name }),
  ]));
  return loadPontxSpec({
    pontx: "2.1",
    style: "RESTFul",
    name: "nager-date",
    info: language === "zh"
      ? { title: "Nager.Date Community API v4", version: "v4", description: "Nager.Date Community API v4 的完整六个只读 HTTPS Endpoint。商业使用需要有效赞助；Pontx 仅提供文档和调用方本地 SDK/CLI，不代理、缓存或聚合节假日数据。" }
      : { title: "Nager.Date Community API v4", version: "v4", description: "The complete six read-only HTTPS endpoints of Nager.Date Community API v4. Commercial use requires active sponsorship; Pontx provides documentation and caller-local SDK/CLI only, and does not proxy, cache, or aggregate holiday data." },
    servers: [{
      id: "community-production",
      url: "https://nagerholidays.com",
      description: language === "zh" ? "Nager.Date Community API v4 HTTPS 服务。" : "Nager.Date Community API v4 HTTPS service.",
    }],
    security: [],
    externalDocs: {
      url: "https://nagerholidays.com/scalar/#community-api-v4",
      description: language === "zh" ? "供应商 Community API v4 参考。" : "Supplier Community API v4 reference.",
    },
    components: { schemas, securitySchemes: {} },
    tags: usedTags.map((name) => ({ name, description: tagText[name][language] })),
    apis,
  }, { expectedName: "nager-date" });
}

const sourceResponse = await fetch(sourceUrl);
if (!sourceResponse.ok) throw new Error(`Unable to fetch official Community API v4 contract: HTTP ${sourceResponse.status}`);
const sourceBytes = Buffer.from(await sourceResponse.arrayBuffer());
if (sha256(sourceBytes) !== sourceSha256) {
  throw new Error(`Official Community API v4 contract changed: expected ${sourceSha256}, received ${sha256(sourceBytes)}`);
}
const licenseResponse = await fetch(licenseApiUrl, { headers: { accept: "application/vnd.github+json" } });
if (!licenseResponse.ok) throw new Error(`Unable to fetch pinned Nager.Date LICENSE: HTTP ${licenseResponse.status}`);
const licenseDocument = await licenseResponse.json();
if (licenseDocument.encoding !== "base64" || typeof licenseDocument.content !== "string") {
  throw new Error("Pinned Nager.Date LICENSE response did not contain a base64 file payload");
}
const licenseBytes = Buffer.from(licenseDocument.content, "base64");
if (sha256(licenseBytes) !== licenseSha256) {
  throw new Error(`Pinned Nager.Date LICENSE changed: expected ${licenseSha256}, received ${sha256(licenseBytes)}`);
}
const imported = importOpenAPI(JSON.parse(sourceBytes.toString("utf8")), { name: "nager-date" });
const upstreamOperations = Object.entries(imported.apis).filter(([, api]) => methods.has(api.method.toLowerCase()));
if (upstreamOperations.length !== 6 || Object.keys(operationIds).length !== upstreamOperations.length) {
  throw new Error(`Expected six official Community API v4 endpoints, received ${upstreamOperations.length}`);
}
const zh = buildSpec(imported, "zh");
const en = buildSpec(imported, "en");
const zhBytes = Buffer.from(`${JSON.stringify(PontxSpec.reOrder(zh), null, 2)}\n`);
const enBytes = Buffer.from(`${JSON.stringify(PontxSpec.reOrder(en), null, 2)}\n`);

const product = {
  formatVersion: 1,
  slug: "nager-date",
  name: "Nager.Date Community API v4",
  provider: "Nager.Date",
  category: "Productivity",
  featured: true,
  display: {
    title: "Nager.Date 公共节假日 API",
    summary: "查询支持国家、国家资料、年度或未来公共节假日、当天节假日状态与服务版本。完整 Community API v4 仅含六个只读 Endpoint；商业使用需要有效赞助。",
    accent: "#0F766E",
  },
  legal: {
    license: "Nager.Date MIT source; Community API Terms of Service",
    attributionUrl: "https://nagerholidays.com/legal/termsofservice",
  },
  documentation: {
    status: "official",
    evidence: [
      sourceUrl,
      "https://nagerholidays.com/scalar/#community-api-v4",
      "https://nagerholidays.com/legal/termsofservice",
      `https://github.com/nager/Nager.Date/tree/${sourceRevision}`,
      licenseUrl,
    ],
    verifiedAt,
    contentUpdatedAt: verifiedAt,
    stabilityNote: "完整边界为供应商 Community API v4 OpenAPI 文档中的全部六个 GET Endpoint；不包含单独标记的 Pro API 或已弃用的 Community API v3。条款允许私用或非营利项目，商业用途需要有效赞助；Hub 不代理、缓存、汇总或展示节假日数据，调用方应自行确认许可后通过本地 SDK/CLI 直连。",
  },
  pricing: {
    status: "contact",
    summary: "Community API 的私用或非营利使用依据上游条款；商业使用需要有效赞助，具体资格和价格请联系供应商。",
    officialUrl: "https://nagerholidays.com/legal/termsofservice",
    verifiedAt,
  },
  credentials: [],
  quickStart: { operationId: "listHolidaysByYear", requestExampleId: "default" },
};
const productEn = {
  display: {
    title: "Nager.Date public-holiday API",
    summary: "Look up supported countries, country information, annual or upcoming public holidays, today's holiday status, and the service version. The complete Community API v4 has six read-only endpoints; commercial use requires active sponsorship.",
    accent: "#0F766E",
  },
  documentation: {
    status: "official",
    evidence: product.documentation.evidence,
    verifiedAt,
    contentUpdatedAt: verifiedAt,
    stabilityNote: "The complete boundary is all six GET endpoints in the supplier's Community API v4 OpenAPI document; it excludes the separately labelled Pro API and deprecated Community API v3. Terms permit private or non-profit projects and require active sponsorship for commercial use. Hub does not proxy, cache, aggregate, or display holiday data; callers must confirm their own entitlement before using the local SDK or CLI directly.",
  },
  pricing: {
    status: "contact",
    summary: "Community API use for private or non-profit projects is governed by upstream terms; commercial use requires active sponsorship. Contact the supplier for eligibility and pricing.",
    officialUrl: "https://nagerholidays.com/legal/termsofservice",
    verifiedAt,
  },
};
const sdk = {
  formatVersion: 1,
  package: {
    name: "@pontx/nager-date",
    version: "0.1.0",
    status: "planned",
    repository: "https://github.com/pontjs/nager-date",
  },
  cli: { name: "pontx-nager-date" },
  contract: {
    client: { kind: "factory", factory: "createNagerDateClient", identifier: "client", options: {} },
    controllers: { countries: "countries", holidays: "holidays", iotHolidays: "iotHolidays", versions: "versions" },
  },
  examples: {
    typescript: "import { createNagerDateClient } from \"@pontx/nager-date\";\n\nconst client = createNagerDateClient();\nconst holidays = await client.holidays.listHolidaysByYear({\n  countryCode: \"US\",\n  year: 2026\n});",
    cli: "pnpm add --global @pontx/nager-date\n\npontx-nager-date call holidays listHolidaysByYear --countryCode US --year 2026 --dry-run",
  },
  coverage: { mode: "full" },
  spec: { path: "products/nager-date/spec.pontx.json", sha256: sha256(zhBytes) },
};
const provenance = {
  formatVersion: 1,
  status: "staged-for-sdk-release",
  canonicalSpec: "products/nager-date/spec.pontx.json",
  import: {
    format: "OpenAPI 3.1.1",
    importer: "@pontx/spec importOpenAPI",
    sourceUrl,
    sourceSha256,
    observedAt: verifiedAt,
    retained: "The supplier OpenAPI is used only as one-time import evidence and is not stored locally because no redistribution licence for the document was supplied. PontxSpec is canonical after this curation.",
  },
  license: {
    status: "reviewed",
    sourceRepository: `https://github.com/nager/Nager.Date/tree/${sourceRevision}`,
    spdx: "MIT",
    url: licenseUrl,
    sha256: licenseSha256,
    localCopy: "products/nager-date/sources/LICENSE.nager-date",
    notice: "products/nager-date/sources/ATTRIBUTION.md",
    scope: "The MIT file governs the Nager.Date repository source. The hosted Community API is governed separately by its Terms of Service.",
  },
  terms: {
    url: "https://nagerholidays.com/legal/termsofservice",
    verifiedAt,
    commercialUse: "The Terms of Service state that private or non-profit projects may use the Web API and that commercial purposes require active sponsorship.",
    hubPolicy: "Hub proxying, caching, aggregation, and holiday-data display are disabled for every endpoint. The local SDK/CLI connects directly only at the caller's direction and entitlement.",
  },
  derivation: {
    boundary: "All six endpoints in the official Community API v4 OpenAPI document; the separately labelled Pro API and deprecated Community API v3 are excluded.",
    method: "one-time @pontx/spec importOpenAPI conversion followed by a source-free, bilingual PontxSpec curation; methods, paths, parameters, response statuses, media types, schemas, nullable fields, enums, and constraints are retained.",
    paths: 6,
    endpoints: 6,
    schemas: 8,
    methods: { GET: 6 },
    responseMediaTypes: ["application/json"],
  },
  riskReview: {
    classification: "public-holiday-data-with-commercial-use-terms",
    mutations: 0,
    credentials: "None required by the Community API v4 contract.",
    execution: "All Hub execution is disabled because the provider terms restrict use and Hub must not operate a holiday-data portal or proxy. The package exposes caller-direct reads only.",
  },
  observations: {
    verifiedAt,
    requests: [
      { operationId: "getCountry", method: "GET", path: "/api/v4/Countries/US", status: 200, responseShape: "object: borders, commonName, countryCode, nativeName, officialName, region" },
      { operationId: "listAvailableCountries", method: "GET", path: "/api/v4/Countries/Available", status: 200, responseShape: "array entries: countryCode, name" },
      { operationId: "listHolidaysByYear", method: "GET", path: "/api/v4/Holidays/US/2026", status: 200, responseShape: "array entries: countryCode, date, holidayTypes, name, nationalHoliday, subdivisionCodes" },
      { operationId: "listUpcomingHolidays", method: "GET", path: "/api/v4/Holidays/US/Next", status: 200, responseShape: "array entries: countryCode, date, holidayTypes, name, nationalHoliday, subdivisionCodes" },
      { operationId: "isTodayHoliday", method: "GET", path: "/api/v4/IotHolidays/US/IsToday/0", status: 204, responseShape: "empty documented success response" },
      { operationId: "getVersions", method: "GET", path: "/api/v4/Versions", status: 200, responseShape: "object: name, version" },
    ],
  },
  outputs: {
    "zh-CN": { path: "products/nager-date/spec.pontx.json", sha256: sha256(zhBytes), endpoints: 6, schemas: 8 },
    "en-US": { path: "products/nager-date/locales/en-US/spec.pontx.json", sha256: sha256(enBytes), endpoints: 6, schemas: 8 },
  },
};

await mkdir(resolve(outputRoot, "locales/en-US"), { recursive: true });
await mkdir(resolve(outputRoot, "sources"), { recursive: true });
await writeFile(resolve(outputRoot, "product.json"), `${JSON.stringify(product, null, 2)}\n`);
await writeFile(resolve(outputRoot, "locales/en-US/product.json"), `${JSON.stringify(productEn, null, 2)}\n`);
await writeFile(resolve(outputRoot, "spec.pontx.json"), zhBytes);
await writeFile(resolve(outputRoot, "locales/en-US/spec.pontx.json"), enBytes);
await writeFile(resolve(outputRoot, "sdk.json"), `${JSON.stringify(sdk, null, 2)}\n`);
await writeFile(resolve(outputRoot, "sources/provenance.json"), `${JSON.stringify(provenance, null, 2)}\n`);
await writeFile(resolve(outputRoot, "sources/LICENSE.nager-date"), licenseBytes);
await writeFile(resolve(outputRoot, "sources/ATTRIBUTION.md"), `# Nager.Date attribution\n\nThis directory retains the Nager.Date repository MIT license from [nager/Nager.Date@${sourceRevision}](https://github.com/nager/Nager.Date/tree/${sourceRevision}).\n\nThe hosted Community API v4 contract was observed from [the supplier's OpenAPI document](${sourceUrl}) on ${verifiedAt}. That supplier document is not redistributed here. The hosted API is governed by the provider's [Terms of Service](https://nagerholidays.com/legal/termsofservice); commercial use requires active sponsorship according to those terms.\n`);
console.log(`Built Nager.Date Community API v4: ${Object.keys(zh.apis).length} endpoints, ${Object.keys(zh.components.schemas).length} schemas, ${sha256(zhBytes)}.`);
