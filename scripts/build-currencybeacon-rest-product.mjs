import { mkdir, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { loadPontxSpec, PontxSpec } from "@pontx/spec";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const outputRoot = resolve(root, "products/currencybeacon-rest");
const verifiedAt = "2026-08-15";
const documentationUrl = "https://currencybeacon.com/api-documentation";
const codeSamplesUrl = "https://currencybeacon.com/code-samples";
const sdkRepositoryUrl = "https://github.com/pontjs/currencybeacon-rest";
const sdkWorkflowRunUrl = "https://github.com/pontjs/currencybeacon-rest/actions/runs/31867826366";
const sdkPackageUrl = "https://www.npmjs.com/package/@pontx/currencybeacon-rest/v/0.1.1";
const copy = {
  zh: {
    info: "独立整理的 CurrencyBeacon v1 只读 REST 契约，覆盖供应商公开列出的 latest、historical、convert、timeseries 与 currencies Endpoint。调用方使用自己的凭据；Hub 仅在用户明确执行后转发该次请求，不缓存或持久化响应。",
    server: "CurrencyBeacon v1 HTTPS API。",
    security: "调用方提供的 CurrencyBeacon API key；不得写入请求示例或持久化。",
    bearer: "调用方通过 Bearer Authorization header 提供的 CurrencyBeacon API key；不得写入请求示例或持久化。",
    meta: "服务返回的状态与免责声明元数据。",
    errorMeta: "服务返回的错误状态与说明元数据。",
    rates: "以货币代码为 key、汇率数值为 value 的动态映射。",
    datedRates: "以 YYYY-MM-DD 日期为 key、当日汇率映射为 value 的动态映射。",
    latest: "最新汇率成功响应；服务同时返回 response 包装与其顶层字段。",
    historical: "历史汇率成功响应；服务同时返回 response 包装与其顶层字段。",
    conversion: "货币换算成功响应；服务同时返回 response 包装与其顶层字段。",
    timeseries: "时间序列成功响应；服务同时返回 response 包装与其顶层日期键。",
    currency: "供应商列出的一个可用货币定义。",
    currencies: "以数字字符串为 key 的货币定义动态映射；这是供应商实际返回的 JSON 对象，而非数组。",
    error: "服务未能完成请求时返回的错误响应。",
    latestSummary: "查询最新汇率",
    latestDescription: "按基准货币返回当前可用汇率，可按 symbols 限制返回货币。",
    historicalSummary: "查询历史汇率",
    historicalDescription: "返回指定日期的历史汇率，可按 symbols 限制返回货币。",
    convertSummary: "换算货币金额",
    convertDescription: "使用当前或指定历史日期的汇率换算金额。",
    timeseriesSummary: "查询汇率时间序列",
    timeseriesDescription: "返回给定日期范围内的每日汇率。",
    currenciesSummary: "列出支持的货币",
    currenciesDescription: "返回可用货币的数字 key 映射及其名称、代码、精度和显示符号。",
    base: "基准货币的三字母代码；未提供时服务默认使用 USD。",
    symbols: "可选的逗号分隔货币代码列表，用于限制返回汇率。",
    date: "历史查询或换算使用的日期，格式为 YYYY-MM-DD。",
    from: "待换算货币的三字母代码。",
    to: "目标货币的三字母代码。",
    amount: "待换算的金额。",
    startDate: "时间序列起始日期，格式为 YYYY-MM-DD。",
    endDate: "时间序列结束日期，格式为 YYYY-MM-DD，且不得早于起始日期。",
    success: "请求成功，返回该 Endpoint 定义的 JSON 响应。",
    invalid: "请求参数无效。",
    unauthenticated: "调用方凭据缺失、无效或尚未激活。",
    forbidden: "调用方套餐或权限不允许此请求。",
    missing: "请求的 Endpoint 或资源不存在。",
    limited: "调用方超过服务调用额度或速率限制。",
    unavailable: "上游服务发生内部错误。",
    request: "可复现的只读请求",
    sourceNote: "供应商未发布可保留的完整 OAS；本产品以公开文档和经授权的免费账户只读响应独立整理，不保留市场数据或凭据。",
  },
  en: {
    info: "Independently curated CurrencyBeacon v1 read-only REST contract covering the supplier's published latest, historical, convert, timeseries, and currencies endpoints. Callers use their own credentials; Hub forwards a request only after explicit user execution and does not cache or persist responses.",
    server: "CurrencyBeacon v1 HTTPS API.",
    security: "CurrencyBeacon API key supplied by the caller; it must not be placed in request examples or persisted.",
    bearer: "CurrencyBeacon API key supplied by the caller through the Bearer Authorization header; it must not be placed in request examples or persisted.",
    meta: "Status and disclaimer metadata returned by the service.",
    errorMeta: "Error status and explanatory metadata returned by the service.",
    rates: "Dynamic map with currency codes as keys and rate numbers as values.",
    datedRates: "Dynamic map with YYYY-MM-DD dates as keys and daily rate maps as values.",
    latest: "Successful latest-rates response; the service returns both a response wrapper and its top-level fields.",
    historical: "Successful historical-rates response; the service returns both a response wrapper and its top-level fields.",
    conversion: "Successful conversion response; the service returns both a response wrapper and its top-level fields.",
    timeseries: "Successful time-series response; the service returns both a response wrapper and top-level date keys.",
    currency: "One available-currency definition returned by the supplier.",
    currencies: "Dynamic currency-definition map keyed by numeric strings; this is the JSON object actually returned by the supplier, not an array.",
    error: "Error response returned when the service cannot complete a request.",
    latestSummary: "Get latest exchange rates",
    latestDescription: "Returns currently available rates for a base currency and can be limited by symbols.",
    historicalSummary: "Get historical exchange rates",
    historicalDescription: "Returns rates for a specified historical date and can be limited by symbols.",
    convertSummary: "Convert a currency amount",
    convertDescription: "Converts an amount using current rates or rates for a specified historical date.",
    timeseriesSummary: "Get an exchange-rate time series",
    timeseriesDescription: "Returns daily rates for a requested date range.",
    currenciesSummary: "List supported currencies",
    currenciesDescription: "Returns a numeric-key map of available currencies with names, codes, precision, and display symbols.",
    base: "Three-letter base currency code; the service defaults to USD when it is omitted.",
    symbols: "Optional comma-separated currency-code list used to limit returned rates.",
    date: "Date used for a historical lookup or conversion, in YYYY-MM-DD format.",
    from: "Three-letter code of the currency to convert from.",
    to: "Three-letter code of the target currency.",
    amount: "Amount to convert.",
    startDate: "Time-series start date in YYYY-MM-DD format.",
    endDate: "Time-series end date in YYYY-MM-DD format; it must not precede the start date.",
    success: "Request succeeded and returns this Endpoint's JSON response.",
    invalid: "The request parameters are invalid.",
    unauthenticated: "The caller credential is missing, invalid, or not activated.",
    forbidden: "The caller plan or permission does not allow this request.",
    missing: "The requested Endpoint or resource does not exist.",
    limited: "The caller exceeded a service quota or rate limit.",
    unavailable: "The upstream service encountered an internal error.",
    request: "Reproducible read-only request",
    sourceNote: "The supplier does not publish a complete retainable OAS. This product is independently curated from public documentation and authorised free-account read responses, and retains neither market data nor credentials.",
  },
};

function scalar(type, description, examples, extra = {}) {
  return { type, description, ...(examples ? { examples } : {}), ...extra };
}

function ref(name) {
  return { $ref: `#/components/schemas/${name}` };
}

function schemas(text) {
  const rateMap = {
    type: "object", title: text.rates, description: text.rates,
    additionalProperties: scalar("number", text.rates, [0.86426828]),
  };
  const dateRateMap = {
    type: "object", title: text.datedRates, description: text.datedRates,
    additionalProperties: rateMap,
  };
  const successMeta = {
    type: "object", title: text.meta, description: text.meta, required: ["code", "disclaimer"],
    properties: {
      code: scalar("integer", text.meta, [200], { const: 200 }),
      disclaimer: scalar("string", text.meta, ["Usage subject to terms: https://currencybeacon.com/terms"]),
    },
    additionalProperties: true,
  };
  const errorMeta = {
    type: "object", title: text.errorMeta, description: text.errorMeta, required: ["code"],
    properties: {
      code: scalar("integer", text.errorMeta, [400]),
      disclaimer: scalar("string", text.errorMeta, ["Usage subject to terms: https://currencybeacon.com/terms"]),
      error_type: scalar("string", text.errorMeta, ["auth failed"]),
      error_detail: scalar("string", text.errorMeta, ["Missing or invalid api credentials."]),
    },
    additionalProperties: true,
  };
  const errorResponse = {
    type: "object", title: text.error, description: text.error, required: ["meta", "response"],
    properties: {
      meta: ref("ErrorMeta"),
      message: scalar("string", text.error, ["Dates must use YYYY-MM-DD format."]),
      response: {
        type: "array", description: text.error, examples: [[]], maxItems: 0,
        items: { type: "string", description: text.error, examples: [""] },
      },
    },
    additionalProperties: true,
  };
  const rateEnvelope = (title, description, dateSchema) => ({
    type: "object", title, description, required: ["meta", "response", "date", "base", "rates"],
    properties: {
      meta: ref("SuccessMeta"),
      response: {
        type: "object", description, required: ["date", "base", "rates"],
        properties: { date: dateSchema, base: scalar("string", text.base, ["USD"], { pattern: "^[A-Z]{3}$" }), rates: ref("RateMap") },
        additionalProperties: true,
      },
      date: dateSchema,
      base: scalar("string", text.base, ["USD"], { pattern: "^[A-Z]{3}$" }),
      rates: ref("RateMap"),
    },
    additionalProperties: true,
  });
  const conversion = {
    type: "object", title: text.conversion, description: text.conversion,
    required: ["meta", "response", "timestamp", "date", "from", "to", "amount", "value"],
    properties: {
      meta: ref("SuccessMeta"),
      response: { type: "object", description: text.conversion, required: ["timestamp", "date", "from", "to", "amount", "value"], properties: {
        timestamp: scalar("integer", text.conversion, [1786770980]),
        date: scalar("string", text.date, ["2026-08-15"], { format: "date" }),
        from: scalar("string", text.from, ["USD"], { pattern: "^[A-Z]{3}$" }),
        to: scalar("string", text.to, ["EUR"], { pattern: "^[A-Z]{3}$" }),
        amount: scalar("number", text.amount, [10]),
        value: scalar("number", text.conversion, [8.6426828]),
      }, additionalProperties: true },
      timestamp: scalar("integer", text.conversion, [1786770980]),
      date: scalar("string", text.date, ["2026-08-15"], { format: "date" }),
      from: scalar("string", text.from, ["USD"], { pattern: "^[A-Z]{3}$" }),
      to: scalar("string", text.to, ["EUR"], { pattern: "^[A-Z]{3}$" }),
      amount: scalar("number", text.amount, [10]),
      value: scalar("number", text.conversion, [8.6426828]),
    }, additionalProperties: true,
  };
  const timeseries = {
    type: "object", title: text.timeseries, description: text.timeseries, required: ["meta", "response"],
    properties: { meta: ref("SuccessMeta"), response: ref("DateRateMap") },
    additionalProperties: rateMap,
  };
  const currency = {
    type: "object", title: text.currency, description: text.currency,
    required: ["id", "name", "short_code", "code", "precision", "subunit", "symbol", "symbol_first", "decimal_mark", "thousands_separator"],
    properties: {
      id: scalar("integer", text.currency, [1], { minimum: 1 }),
      name: scalar("string", text.currency, ["UAE Dirham"]),
      short_code: scalar("string", text.currency, ["AED"], { pattern: "^[A-Z]{3}$" }),
      code: scalar("string", text.currency, ["784"], { pattern: "^[0-9]{1,3}$" }),
      precision: scalar("integer", text.currency, [2], { minimum: 0 }),
      subunit: scalar("integer", text.currency, [100], { minimum: 0 }),
      symbol: scalar("string", text.currency, ["د.إ"]),
      symbol_first: scalar("boolean", text.currency, [true]),
      decimal_mark: scalar("string", text.currency, ["."]),
      thousands_separator: scalar("string", text.currency, [","]),
    }, additionalProperties: true,
  };
  return {
    RateMap: rateMap,
    DateRateMap: dateRateMap,
    SuccessMeta: successMeta,
    ErrorMeta: errorMeta,
    ErrorResponse: errorResponse,
    LatestRatesResponse: rateEnvelope(text.latest, text.latest, scalar("string", text.latest, ["2026-08-15T05:16:21Z"], { format: "date-time" })),
    HistoricalRatesResponse: rateEnvelope(text.historical, text.historical, scalar("string", text.historical, ["2025-01-02"], { format: "date" })),
    ConversionResponse: conversion,
    TimeseriesResponse: timeseries,
    Currency: currency,
    CurrenciesResponse: { type: "object", title: text.currencies, description: text.currencies, minProperties: 1, additionalProperties: currency },
  };
}

function response(description, schema) {
  return { description, content: { "application/json": { schema } } };
}

function parameter(name, description, schema, required = false) {
  const { example, ...rest } = schema;
  return {
    in: "query",
    name,
    required,
    schema: { description, ...rest, ...(example === undefined ? {} : { examples: [example] }) },
  };
}

function endpoint({ text, apiKey, path, operationId, summary, description, parameters, schema, query }) {
  return [apiKey, {
    summary,
    description,
    operationId,
    tags: [],
    method: "GET",
    path: `/${path}`,
    consumes: [],
    produces: ["application/json"],
    parameters,
    responses: {
      "200": response(text.success, ref(schema)),
      "400": response(text.invalid, ref("ErrorResponse")),
      "401": response(text.unauthenticated, ref("ErrorResponse")),
      "403": response(text.forbidden, ref("ErrorResponse")),
      "404": response(text.missing, ref("ErrorResponse")),
      "429": response(text.limited, ref("ErrorResponse")),
      "500": response(text.unavailable, ref("ErrorResponse")),
    },
    requestExamples: {
      default: {
        summary: text.request,
        request: { query, headers: {} },
        expectedStatus: "200",
        serverUrl: "https://api.currencybeacon.com/v1",
        verifiedAt,
      },
    },
    metadata: {
      documentation: { status: "official", evidence: [documentationUrl, codeSamplesUrl], verifiedAt },
    },
  }];
}

function buildSpec(language) {
  const text = copy[language];
  const code = { type: "string", pattern: "^[A-Z]{3}$", example: "USD" };
  const symbolList = { type: "string", pattern: "^[A-Za-z0-9]+(?:,[A-Za-z0-9]+)*$", example: "EUR,GBP" };
  const isoDate = { type: "string", format: "date", pattern: "^\\d{4}-\\d{2}-\\d{2}$", example: "2025-01-02" };
  const apis = Object.fromEntries([
    endpoint({
      text, apiKey: "getLatestRates", path: "latest", operationId: "getLatestRates", summary: text.latestSummary, description: text.latestDescription,
      parameters: [parameter("base", text.base, code), parameter("symbols", text.symbols, symbolList)],
      schema: "LatestRatesResponse", query: { base: "USD", symbols: "EUR,GBP" },
    }),
    endpoint({
      text, apiKey: "getHistoricalRates", path: "historical", operationId: "getHistoricalRates", summary: text.historicalSummary, description: text.historicalDescription,
      parameters: [parameter("date", text.date, isoDate, true), parameter("base", text.base, code), parameter("symbols", text.symbols, symbolList)],
      schema: "HistoricalRatesResponse", query: { date: "2025-01-02", base: "USD", symbols: "EUR,GBP" },
    }),
    endpoint({
      text, apiKey: "convertCurrency", path: "convert", operationId: "convertCurrency", summary: text.convertSummary, description: text.convertDescription,
      parameters: [parameter("from", text.from, code, true), parameter("to", text.to, code, true), parameter("amount", text.amount, { type: "number", minimum: 0, example: 10 }, true), parameter("date", text.date, isoDate)],
      schema: "ConversionResponse", query: { from: "USD", to: "EUR", amount: 10 },
    }),
    endpoint({
      text, apiKey: "getTimeseries", path: "timeseries", operationId: "getTimeseries", summary: text.timeseriesSummary, description: text.timeseriesDescription,
      parameters: [parameter("start_date", text.startDate, isoDate, true), parameter("end_date", text.endDate, isoDate, true), parameter("base", text.base, code), parameter("symbols", text.symbols, symbolList)],
      schema: "TimeseriesResponse", query: { start_date: "2025-01-01", end_date: "2025-01-02", base: "USD", symbols: "EUR,GBP" },
    }),
    endpoint({
      text, apiKey: "listCurrencies", path: "currencies", operationId: "listCurrencies", summary: text.currenciesSummary, description: text.currenciesDescription,
      parameters: [], schema: "CurrenciesResponse", query: {},
    }),
  ]);
  return loadPontxSpec({
    pontx: "2.1",
    style: "RESTFul",
    name: "currencybeacon-rest",
    info: { title: "CurrencyBeacon REST API v1", version: "1.0.0", description: text.info },
    servers: [{ id: "currencybeacon-api", url: "https://api.currencybeacon.com/v1", description: text.server }],
    security: [{ apiKey: [] }, { bearerAuth: [] }],
    externalDocs: { url: documentationUrl, description: language === "zh" ? "CurrencyBeacon 官方 API 文档。" : "CurrencyBeacon official API documentation." },
    components: {
      schemas: schemas(text),
      securitySchemes: {
        apiKey: { type: "apiKey", in: "query", name: "api_key", description: text.security },
        bearerAuth: { type: "http", scheme: "bearer", description: text.bearer },
      },
    },
    tags: [],
    apis,
  }, { expectedName: "currencybeacon-rest" });
}

function product(language) {
  const text = copy[language];
  return {
    formatVersion: 1,
    slug: "currencybeacon-rest",
    name: "CurrencyBeacon REST API v1",
    provider: "CurrencyBeacon",
    category: "Finance",
    featured: true,
    display: {
      title: language === "zh" ? "CurrencyBeacon 汇率 API" : "CurrencyBeacon exchange-rate API",
      summary: language === "zh"
        ? "查询最新、历史、换算、时间序列与支持货币数据；在浏览器会话中使用自己的 CurrencyBeacon 凭据调试。"
        : "Query latest, historical, conversion, time-series, and supported-currency data with caller-owned CurrencyBeacon credentials in the browser session.",
      accent: "#0f766e",
    },
    legal: { license: "CurrencyBeacon Terms of Service", attributionUrl: "https://currencybeacon.com/terms" },
    documentation: {
      status: "official", evidence: [
        documentationUrl,
        codeSamplesUrl,
        "https://currencybeacon.com/pricing",
        "https://currencybeacon.com/terms",
        sdkRepositoryUrl,
        sdkWorkflowRunUrl,
        sdkPackageUrl,
      ],
      verifiedAt, contentUpdatedAt: verifiedAt, stabilityNote: text.info,
    },
    pricing: {
      status: "freemium",
      summary: language === "zh" ? "CurrencyBeacon 提供免费与付费套餐；可用数据范围和额度取决于调用方当前套餐。" : "CurrencyBeacon offers free and paid plans; available data and quotas depend on the caller's current plan.",
      officialUrl: "https://currencybeacon.com/pricing", verifiedAt,
    },
    credentials: [{ schemeId: "apiKey", envVar: "PONTX_CURRENCYBEACON_API_KEY", description: text.security }],
    quickStart: { operationId: "getLatestRates", requestExampleId: "default" },
  };
}

function localizedProduct(language) {
  const { display, documentation, pricing, credentials } = product(language);
  return { display, documentation, pricing, credentials };
}

const zh = buildSpec("zh");
const en = buildSpec("en");
await mkdir(resolve(outputRoot, "locales/en-US"), { recursive: true });
await mkdir(resolve(outputRoot, "sources"), { recursive: true });
await writeFile(resolve(outputRoot, "spec.pontx.json"), `${JSON.stringify(PontxSpec.reOrder(zh), null, 2)}\n`);
await writeFile(resolve(outputRoot, "locales/en-US/spec.pontx.json"), `${JSON.stringify(PontxSpec.reOrder(en), null, 2)}\n`);
await writeFile(resolve(outputRoot, "product.json"), `${JSON.stringify(product("zh"), null, 2)}\n`);
await writeFile(resolve(outputRoot, "locales/en-US/product.json"), `${JSON.stringify(localizedProduct("en"), null, 2)}\n`);
await writeFile(resolve(outputRoot, "sources/provenance.json"), `${JSON.stringify({
  source: { documentationUrl, codeSamplesUrl, observedAt: verifiedAt, retained: copy.en.sourceNote },
  scope: { endpointCount: 5, operationIds: Object.values(zh.apis).map((api) => api.operationId), includes: ["latest", "historical", "convert", "timeseries", "currencies"], excludes: ["CurrencyBeacon MCP server and every non-REST transport"] },
  authenticatedReadEvidence: {
    observedAt: verifiedAt,
    plan: "free",
    authentication: ["api_key query", "Bearer authorization header"],
    successShapes: {
      latest: ["meta", "response", "date", "base", "rates"],
      historical: ["meta", "response", "date", "base", "rates"],
      convert: ["meta", "response", "timestamp", "date", "from", "to", "amount", "value"],
      timeseries: ["meta", "response", "YYYY-MM-DD dynamic keys"],
      currencies: ["numeric-string dynamic keys"],
    },
    errorShapes: { invalidDate: ["meta", "message", "response"], invalidRange: ["meta", "message", "response"], invalidCredential: ["meta", "response"] },
    retainedData: false,
  },
}, null, 2)}\n`);
console.log(`Built CurrencyBeacon REST product: ${Object.keys(zh.apis).length} Endpoints, ${Object.keys(zh.components.schemas).length} Schemas.`);
