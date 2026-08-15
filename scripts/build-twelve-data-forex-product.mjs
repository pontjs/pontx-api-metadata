import { createHash } from "node:crypto";
import { mkdir, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { importOpenAPI, loadPontxSpec, PontxSpec } from "@pontx/spec";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const outputRoot = resolve(root, "products/twelve-data-forex");
const sourceUrl = "https://api.twelvedata.com/doc/swagger/openapi.json";
const expectedSha256 = "d0a219a5c19518cff59a3ab7275e8308ad8083ef618a58390b73f1164653bc0c";
const verifiedAt = "2026-08-15";

/*
 * This is deliberately a curation transform, not a vendor-spec mirror.  It
 * retains only the independently reviewed Forex surface, writes new bilingual
 * prose and examples, and never stores the supplier's OAS document.
 */
const includedOperationIds = new Set([
  "GetPrice",
  "GetQuote",
  "GetTimeSeries",
  "GetEod",
  "GetExchangeRate",
  "GetCurrencyConversion",
  "GetForexPairs",
  "GetIntervals",
  "GetTechnicalIndicators",
]);

const endpointText = {
  GetPrice: {
    zh: ["查询外汇最新价格", "返回指定外汇货币对当前可用的最新价格。"],
    en: ["Get the latest Forex price", "Returns the latest available price for one Forex currency pair."],
  },
  GetQuote: {
    zh: ["查询外汇报价", "返回指定外汇货币对的报价字段。"],
    en: ["Get a Forex quote", "Returns quote fields for one Forex currency pair."],
  },
  GetTimeSeries: {
    zh: ["查询外汇时间序列", "按给定时间间隔返回外汇货币对的历史时间序列。"],
    en: ["Get a Forex time series", "Returns historical observations for a Forex pair at the requested interval."],
  },
  GetEod: {
    zh: ["查询外汇日终价格", "返回指定外汇货币对的日终价格数据。"],
    en: ["Get Forex end-of-day prices", "Returns end-of-day price data for a Forex pair."],
  },
  GetExchangeRate: {
    zh: ["查询外汇汇率", "返回指定基准/报价货币对的汇率。"],
    en: ["Get an exchange rate", "Returns the rate for a base/quote currency pair."],
  },
  GetCurrencyConversion: {
    zh: ["换算货币金额", "按指定外汇货币对换算一个金额。"],
    en: ["Convert a currency amount", "Converts an amount using the requested Forex pair."],
  },
  GetForexPairs: {
    zh: ["列出外汇货币对", "列出可用外汇货币对，可按货币对或基准/报价货币筛选。"],
    en: ["List Forex pairs", "Lists available Forex pairs and supports pair or base/quote filtering."],
  },
  GetIntervals: {
    zh: ["列出时间间隔", "列出可用于时间序列与技术指标计算的时间间隔。"],
    en: ["List time intervals", "Lists intervals available to time-series and technical-indicator requests."],
  },
  GetTechnicalIndicators: {
    zh: ["列出技术指标", "列出可用于外汇时间序列的技术指标标识。"],
    en: ["List technical indicators", "Lists technical-indicator identifiers available for Forex time series."],
  },
};

const commonFieldText = {
  symbol: {
    zh: "外汇货币对，使用 BASE/QUOTE 格式，例如 EUR/USD。",
    en: "Forex currency pair in BASE/QUOTE form, for example EUR/USD.",
  },
  amount: { zh: "需要换算的金额。", en: "Amount to convert." },
  interval: { zh: "时间序列或指标计算的时间间隔。", en: "Interval for the time series or indicator calculation." },
  outputsize: { zh: "返回的数据点数量。", en: "Number of data points to return." },
  timezone: { zh: "输出时间使用的时区。", en: "Timezone used for output timestamps." },
  date: { zh: "用于查询或换算的日期。", en: "Date used for the query or conversion." },
  start_date: { zh: "时间范围的起始日期或时间。", en: "Start date or time of a requested range." },
  end_date: { zh: "时间范围的结束日期或时间。", en: "End date or time of a requested range." },
  type: { zh: "金融工具类型。", en: "Financial-instrument type." },
  price: { zh: "外汇价格数值。", en: "Forex price value." },
  rate: { zh: "外汇汇率数值。", en: "Foreign-exchange rate value." },
  currency: { zh: "货币代码。", en: "Currency code." },
  currency_base: { zh: "基准货币代码。", en: "Base-currency code." },
  currency_quote: { zh: "报价货币代码。", en: "Quote-currency code." },
  timestamp: { zh: "上游返回的时间标识。", en: "Time identifier returned by the upstream service." },
  datetime: { zh: "上游返回的日期时间文本。", en: "Date-time text returned by the upstream service." },
  status: { zh: "上游请求状态。", en: "Upstream request status." },
  code: { zh: "上游错误或状态代码。", en: "Upstream error or status code." },
  message: { zh: "上游返回的说明消息。", en: "Message returned by the upstream service." },
  data: { zh: "上游返回的数据集合。", en: "Data collection returned by the upstream service." },
  meta: { zh: "与数据集关联的元数据。", en: "Metadata associated with the data set." },
  values: { zh: "时间序列或指标值集合。", en: "Time-series or indicator values." },
  open: { zh: "开盘价格。", en: "Opening price." },
  high: { zh: "最高价格。", en: "Highest price." },
  low: { zh: "最低价格。", en: "Lowest price." },
  close: { zh: "收盘或最新价格。", en: "Closing or latest price." },
  previous_close: { zh: "前一收盘价格。", en: "Previous closing price." },
  change: { zh: "价格变动值。", en: "Price change." },
  percent_change: { zh: "价格变动百分比。", en: "Percentage price change." },
  is_market_open: { zh: "市场是否处于开放状态。", en: "Whether the market is open." },
  exchange: { zh: "上游返回的交易场所名称。", en: "Trading venue name returned by the upstream service." },
  name: { zh: "上游返回的金融工具名称。", en: "Instrument name returned by the upstream service." },
};

const technicalParamNames = new Set([
  "series_type", "series_type_1", "series_type_2", "time_period", "time_period_1",
  "time_period_2", "time_period_3", "fast_period", "slow_period", "fast_k_period",
  "fast_d_period", "slow_k_period", "slow_d_period", "period", "multiplier", "sd",
  "ma_type", "slow_kma_type", "slow_dma_type", "fast_dma_type", "rsi_length",
  "rsi_period", "stoch_length", "k_period", "d_period", "wma_period", "v_factor",
]);

const structuralSchemaKeys = new Set([
  "$ref", "type", "format", "enum", "const", "default", "readOnly", "nullable",
  "multipleOf", "maximum", "exclusiveMaximum", "minimum", "exclusiveMinimum", "maxLength",
  "minLength", "pattern", "contentMediaType", "contentEncoding", "maxItems", "minItems",
  "uniqueItems", "maxProperties", "minProperties", "required", "additionalProperties",
  "items", "properties", "allOf", "anyOf", "oneOf", "not", "genericRef",
  "genericTypeParameters", "genericTypeParameterRef",
]);

function sha256(value) {
  return createHash("sha256").update(value).digest("hex");
}

function toWords(value) {
  return String(value)
    .replace(/([a-z])([A-Z])/g, "$1 $2")
    .replace(/[_/.-]+/g, " ")
    .trim();
}

function endpointProse(api, language) {
  const known = endpointText[api.operationId]?.[language];
  if (known) return { summary: known[0], description: known[1] };
  const indicator = api.path.replace(/^\//, "").replaceAll("_", " ").toUpperCase();
  return language === "zh"
    ? {
      summary: `计算外汇 ${indicator} 技术指标`,
      description: `基于 EUR/USD 等外汇货币对的时间序列计算 ${indicator} 技术指标。`,
    }
    : {
      summary: `Calculate the ${indicator} Forex technical indicator`,
      description: `Calculates the ${indicator} technical indicator from a Forex pair time series such as EUR/USD.`,
    };
}

function fieldProse(name, language, context) {
  if (commonFieldText[name]) return commonFieldText[name][language];
  if (technicalParamNames.has(name)) {
    return language === "zh"
      ? `技术指标 ${toWords(name)} 配置项。`
      : `Configuration value for the technical indicator: ${toWords(name)}.`;
  }
  return language === "zh"
    ? `${toWords(name)} 字段。`
    : `${toWords(name)} field.`;
}

function titleProse(name, language, context) {
  if (context.kind === "schema") {
    return language === "zh" ? `${toWords(name)} 数据结构` : `${toWords(name)} data structure`;
  }
  return language === "zh" ? `${toWords(name)} 值` : `${toWords(name)} value`;
}

function responseDescription(status, language) {
  const number = Number(status);
  if (language === "zh") {
    if (number >= 200 && number < 300) return "请求成功，返回该 Endpoint 定义的 JSON 数据。";
    if (number === 400) return "请求参数无效。";
    if (number === 401) return "调用方凭据无效或缺失。";
    if (number === 403) return "调用方套餐或权限不允许此请求。";
    if (number === 404) return "请求的资源或数据不存在。";
    if (number === 414) return "请求参数超过服务允许的长度。";
    if (number === 429) return "调用方超过服务速率或额度限制。";
    return "上游服务未能完成请求。";
  }
  if (number >= 200 && number < 300) return "Request succeeded and returns this Endpoint's JSON payload.";
  if (number === 400) return "The request parameters are invalid.";
  if (number === 401) return "The caller credential is missing or invalid.";
  if (number === 403) return "The caller plan or permission does not allow this request.";
  if (number === 404) return "The requested resource or data does not exist.";
  if (number === 414) return "The request parameters exceed the service length limit.";
  if (number === 429) return "The caller exceeded a service rate or credit limit.";
  return "The upstream service could not complete the request.";
}

function candidateExample(name, schema) {
  if (name === "interval") return "1day";
  if (name === "format") return "JSON";
  if (name === "type") return "Forex";
  if (schema.enum?.length) {
    if (name === "type") return schema.enum.find((value) => String(value).toLowerCase().includes("forex")) ?? schema.enum[0];
    if (name === "interval") return schema.enum.find((value) => value === "1day") ?? schema.enum[0];
    if (name === "format") return schema.enum.find((value) => String(value).toLowerCase() === "json") ?? schema.enum[0];
    return schema.enum[0];
  }
  if (["symbol"].includes(name)) return "EUR/USD";
  if (["currency_base"].includes(name)) return "EUR";
  if (["currency_quote"].includes(name)) return "USD";
  if (["timezone"].includes(name)) return "UTC";
  if (["date"].includes(name)) return "2025-01-02";
  if (["start_date"].includes(name)) return "2025-01-01";
  if (["end_date"].includes(name)) return "2025-01-02";
  if (["status"].includes(name)) return "ok";
  if (["message"].includes(name)) return "Request accepted.";
  if (["name"].includes(name)) return "Euro / US Dollar";
  if (["exchange"].includes(name)) return "FOREX";
  if (["type"].includes(name)) return "Forex";
  if (["code"].includes(name)) return 429;
  if (schema.type === "boolean") return false;
  if (schema.type === "integer") {
    const minimum = typeof schema.minimum === "number" ? schema.minimum : 1;
    return Math.max(minimum, name.includes("period") ? 9 : name === "outputsize" ? 2 : 1);
  }
  if (schema.type === "number") return typeof schema.minimum === "number" ? Math.max(schema.minimum, 1) : 1.2345;
  if (schema.type === "string") return `${name}-sample`;
  return undefined;
}

function copyStructure(schema, context, language) {
  if (!schema || typeof schema !== "object") return schema;
  if (schema.$ref) return { $ref: schema.$ref };
  const result = {};
  for (const [key, value] of Object.entries(schema)) {
    if (!structuralSchemaKeys.has(key)) continue;
    if (key === "properties") {
      result.properties = Object.fromEntries(Object.entries(value ?? {}).map(([name, child]) => [
        name,
        copyStructure(child, { kind: "field", name, parent: context.name }, language),
      ]));
    } else if (key === "items" || key === "additionalProperties" || key === "not") {
      result[key] = typeof value === "object" && value !== null
        ? copyStructure(value, { kind: "field", name: context.name, parent: context.parent }, language)
        : value;
    } else if (["allOf", "anyOf", "oneOf"].includes(key)) {
      result[key] = value.map((item) => copyStructure(item, context, language));
    } else if (key === "genericRef" && value && typeof value === "object") {
      result.genericRef = {
        ...value,
        ...(Array.isArray(value.typeArguments)
          ? { typeArguments: value.typeArguments.map((item) => copyStructure(item, context, language)) }
          : {}),
      };
    } else {
      result[key] = value;
    }
  }
  if (!result.type && result.enum?.length) {
    result.type = result.enum.every((value) => typeof value === "string") ? "string" : "number";
  }
  result.title = titleProse(context.name, language, context);
  result.description = fieldProse(context.name, language, context);
  if (result.enum?.length) {
    result.enumValueTitles = Object.fromEntries(result.enum.map((value) => [
      String(value),
      language === "zh" ? `可选值：${value}。` : `Available value: ${value}.`,
    ]));
  }
  const composed = result.allOf?.length || result.anyOf?.length || result.oneOf?.length || result.not;
  const container = result.type === "object" || result.type === "array" || result.type === "generic"
    || result.properties || result.items || result.additionalProperties || composed;
  if (!container) {
    const example = candidateExample(context.name, result);
    if (example !== undefined) result.examples = [example];
  }
  return result;
}

function collectRefs(value, destination) {
  if (!value || typeof value !== "object") return;
  if (Array.isArray(value)) {
    value.forEach((entry) => collectRefs(entry, destination));
    return;
  }
  if (typeof value.$ref === "string" && value.$ref.startsWith("#/components/schemas/")) {
    destination.add(value.$ref.split("/").at(-1));
  }
  Object.values(value).forEach((entry) => collectRefs(entry, destination));
}

function selectSchemas(imported, apis) {
  const names = new Set();
  collectRefs(apis, names);
  const queue = [...names];
  while (queue.length) {
    const name = queue.pop();
    const schema = imported.components.schemas[name];
    if (!schema) throw new Error(`Selected Endpoint references unavailable schema ${name}`);
    const before = names.size;
    collectRefs(schema, names);
    if (names.size > before) {
      for (const added of names) if (!queue.includes(added) && added !== name) queue.push(added);
    }
  }
  return Object.fromEntries(Object.entries(imported.components.schemas)
    .filter(([name]) => names.has(name)));
}

function exampleQuery(api) {
  const query = {};
  for (const parameter of api.parameters ?? []) {
    if (parameter.in !== "query") continue;
    const name = parameter.name;
    if (name === "symbol") {
      query.symbol = "EUR/USD";
      continue;
    }
    if (parameter.required) {
      const value = candidateExample(name, parameter.schema ?? {});
      if (value === undefined) throw new Error(`${api.operationId}: no stable sample for required ${name}`);
      query[name] = value;
    }
  }
  return query;
}

function curateApi(api, language) {
  const prose = endpointProse(api, language);
  const parameters = (api.parameters ?? [])
    .filter((parameter) => !["figi", "isin", "cusip"].includes(parameter.name))
    .map((parameter) => ({
      in: parameter.in,
      name: parameter.name,
      required: parameter.name === "symbol" ? true : Boolean(parameter.required),
      schema: copyStructure(parameter.schema, { kind: "field", name: parameter.name }, language),
    }));
  const preExample = { ...api, parameters };
  const responses = Object.fromEntries(Object.entries(api.responses ?? {}).map(([status, response]) => [
    status,
    {
      description: responseDescription(status, language),
      ...(response.schema ? { schema: copyStructure(response.schema, { kind: "schema", name: `${api.operationId}Response` }, language) } : {}),
      ...(response.content ? {
        content: Object.fromEntries(Object.entries(response.content).map(([contentType, media]) => [
          contentType,
          {
            ...(media.schema ? { schema: copyStructure(media.schema, { kind: "schema", name: `${api.operationId}Response` }, language) } : {}),
          },
        ])),
      } : {}),
    },
  ]));
  return {
    summary: prose.summary,
    description: prose.description,
    operationId: api.operationId,
    tags: api.tags,
    method: api.method,
    path: api.path,
    consumes: api.consumes ?? [],
    produces: api.produces ?? ["application/json"],
    parameters,
    responses,
    requestExamples: {
      default: {
        summary: language === "zh" ? "可复现的外汇读取请求" : "Reproducible Forex read request",
        request: { query: exampleQuery(preExample), headers: {} },
        expectedStatus: "200",
        serverUrl: "https://api.twelvedata.com",
        verifiedAt,
      },
    },
    metadata: {
      documentation: {
        status: "official",
        evidence: ["https://twelvedata.com/docs", sourceUrl],
        verifiedAt,
      },
    },
  };
}

function asyncApi(language) {
  const text = language === "zh" ? {
    infoTitle: "Twelve Data 外汇实时行情流", infoDescription: "经免费账户实测的价格流契约；入站字段按观测建模。",
    stream: "外汇价格流", subscribe: "订阅外汇货币对", unsubscribe: "取消订阅外汇货币对", reset: "重置订阅", heartbeat: "请求心跳", subscribeStatus: "订阅状态", price: "外汇价格事件", heartbeatStatus: "心跳状态",
    action: "动作", symbols: "以逗号分隔的外汇货币对", event: "事件名称", status: "服务状态", success: "成功订阅的货币对", fails: "未成功订阅的货币对", exchange: "上游返回的交易场所", type: "上游返回的工具类型", base: "基准货币名称", quote: "报价货币名称", timestamp: "上游时间标识", priceValue: "外汇价格数值",
  } : {
    infoTitle: "Twelve Data Forex realtime quote stream", infoDescription: "Price-stream contract verified with a free account; inbound fields are explicitly modelled as observed.",
    stream: "Forex price stream", subscribe: "Subscribe to Forex pairs", unsubscribe: "Unsubscribe from Forex pairs", reset: "Reset subscriptions", heartbeat: "Request heartbeat", subscribeStatus: "Subscription status", price: "Forex price event", heartbeatStatus: "Heartbeat status",
    action: "Action", symbols: "Comma-separated Forex pairs", event: "Event name", status: "Service status", success: "Successfully subscribed pairs", fails: "Pairs that were not subscribed", exchange: "Trading venue returned by the upstream service", type: "Instrument type returned by the upstream service", base: "Base currency name", quote: "Quote currency name", timestamp: "Upstream time identifier", priceValue: "Forex price value",
  };
  const scalar = (type, description, examples, extra = {}) => ({ type, description, examples, ...extra });
  const actionMessage = (name, action, description, withSymbols = false) => ({
    name,
    title: description,
    description,
    contentType: "application/json",
    payload: {
      type: "object",
      description,
      required: withSymbols ? ["action", "params"] : ["action"],
      properties: {
        action: scalar("string", text.action, [action], { const: action }),
        ...(withSymbols ? {
          params: {
            type: "object", description: text.symbols, required: ["symbols"], properties: {
              symbols: scalar("string", text.symbols, ["EUR/USD"]),
            },
          },
        } : {}),
      },
    },
  });
  const pair = {
    type: "object", description: text.success, required: ["symbol", "exchange", "type"], properties: {
      symbol: scalar("string", commonFieldText.symbol[language], ["EUR/USD"]),
      exchange: scalar("string", text.exchange, ["PHYSICAL CURRENCY"]),
      type: scalar("string", text.type, ["PHYSICAL_CURRENCY"]),
    },
  };
  return {
    version: "3.0.0",
    info: { title: text.infoTitle, version: "1.0.0", description: text.infoDescription },
    servers: {
      twelveDataQuotes: {
        name: "twelveDataQuotes", protocol: "wss", host: "ws.twelvedata.com", pathname: "/v1/quotes/price",
        url: "wss://ws.twelvedata.com/v1/quotes/price",
        description: text.stream,
        security: [{ apiKey: [] }],
      },
    },
    channels: {
      quotesPrice: { name: "quotesPrice", address: "/v1/quotes/price", title: text.stream, messages: ["subscribe", "unsubscribe", "reset", "heartbeat", "subscribeStatus", "price", "heartbeatStatus"] },
    },
    operations: {
      subscribe: { name: "subscribe", action: "send", channel: "quotesPrice", title: text.subscribe, messages: ["subscribe"], security: [{ apiKey: [] }] },
      unsubscribe: { name: "unsubscribe", action: "send", channel: "quotesPrice", title: text.unsubscribe, messages: ["unsubscribe"], security: [{ apiKey: [] }] },
      reset: { name: "reset", action: "send", channel: "quotesPrice", title: text.reset, messages: ["reset"], security: [{ apiKey: [] }] },
      heartbeat: { name: "heartbeat", action: "send", channel: "quotesPrice", title: text.heartbeat, messages: ["heartbeat"], security: [{ apiKey: [] }] },
      receiveSubscribeStatus: { name: "receiveSubscribeStatus", action: "receive", channel: "quotesPrice", title: text.subscribeStatus, messages: ["subscribeStatus"], security: [{ apiKey: [] }] },
      receivePrice: { name: "receivePrice", action: "receive", channel: "quotesPrice", title: text.price, messages: ["price"], security: [{ apiKey: [] }] },
      receiveHeartbeat: { name: "receiveHeartbeat", action: "receive", channel: "quotesPrice", title: text.heartbeatStatus, messages: ["heartbeatStatus"], security: [{ apiKey: [] }] },
    },
    messages: {
      subscribe: actionMessage("subscribe", "subscribe", text.subscribe, true),
      unsubscribe: actionMessage("unsubscribe", "unsubscribe", text.unsubscribe, true),
      reset: actionMessage("reset", "reset", text.reset),
      heartbeat: actionMessage("heartbeat", "heartbeat", text.heartbeat),
      subscribeStatus: {
        name: "subscribeStatus", title: text.subscribeStatus, description: `${text.subscribeStatus}. ${text.infoDescription}`, contentType: "application/json",
        payload: { type: "object", description: text.subscribeStatus, required: ["event", "status", "success", "fails"], properties: {
          event: scalar("string", text.event, ["subscribe-status"], { const: "subscribe-status" }),
          status: scalar("string", text.status, ["ok"], { enum: ["ok", "error"], enumValueTitles: { ok: language === "zh" ? "订阅成功。" : "Subscription succeeded.", error: language === "zh" ? "订阅失败。" : "Subscription failed." } }),
          success: { type: "array", nullable: true, description: text.success, items: pair },
          fails: { type: "array", nullable: true, description: text.fails, items: { type: "object", description: text.fails, required: ["symbol"], properties: { symbol: scalar("string", commonFieldText.symbol[language], ["PONTX_INVALID"]) } } },
        } },
      },
      price: {
        name: "price", title: text.price, description: `${text.price}. ${text.infoDescription}`, contentType: "application/json",
        payload: { type: "object", description: text.price, required: ["event", "symbol", "currency_base", "currency_quote", "type", "timestamp", "price"], properties: {
          event: scalar("string", text.event, ["price"], { const: "price" }),
          symbol: scalar("string", commonFieldText.symbol[language], ["EUR/USD"]),
          currency_base: scalar("string", text.base, ["Euro"]),
          currency_quote: scalar("string", text.quote, ["US Dollar"]),
          type: scalar("string", text.type, ["Physical Currency"]),
          timestamp: scalar("integer", text.timestamp, [1]),
          price: scalar("number", text.priceValue, [1.2345]),
        } },
      },
      heartbeatStatus: {
        name: "heartbeatStatus", title: text.heartbeatStatus, description: `${text.heartbeatStatus}. ${text.infoDescription}`, contentType: "application/json",
        payload: { type: "object", description: text.heartbeatStatus, required: ["event", "status"], properties: {
          event: scalar("string", text.event, ["heartbeat"], { const: "heartbeat" }),
          status: scalar("string", text.status, ["ok"], { const: "ok" }),
        } },
      },
    },
    components: {
      schemas: {},
      securitySchemes: { apiKey: { type: "apiKey", in: "query", name: "apikey", description: language === "zh" ? "调用方提供的 Twelve Data API Key。" : "Twelve Data API key supplied by the caller." } },
    },
  };
}

function buildSpec(imported, language) {
  const apis = Object.fromEntries(Object.entries(imported.apis)
    .filter(([, api]) => api.tags?.includes("technical_indicator") || includedOperationIds.has(api.operationId))
    .map(([, api]) => [`${api.tags[0]}/${api.operationId}`, curateApi(api, language)]));
  const selected = selectSchemas(imported, apis);
  const schemas = Object.fromEntries(Object.entries(selected).map(([name, schema]) => [
    name,
    copyStructure(schema, { kind: "schema", name }, language),
  ]));
  const tagText = language === "zh"
    ? {
      technical_indicator: "外汇技术指标", market_data: "外汇市场数据", currencies: "外汇换算", reference_data: "外汇参考数据",
    }
    : {
      technical_indicator: "Forex technical indicators", market_data: "Forex market data", currencies: "Forex conversion", reference_data: "Forex reference data",
    };
  const usedTags = new Set(Object.values(apis).flatMap((api) => api.tags));
  const spec = {
    pontx: "2.1",
    style: "RESTFul",
    name: "twelve-data-forex",
    info: language === "zh"
      ? { title: "Twelve Data Forex API", version: "2026-08-15", description: "独立整理的 Twelve Data 外汇 REST 与实时行情契约。仅包含可用于外汇的市场数据、货币换算、技术指标与参考 Endpoint；调用方凭据直连上游。" }
      : { title: "Twelve Data Forex API", version: "2026-08-15", description: "Independently curated Twelve Data Forex REST and realtime-quote contract. It includes only Forex-applicable market data, conversion, technical-indicator, and reference Endpoints; caller credentials connect directly to the upstream service." },
    servers: [{ id: "twelveDataApi", url: "https://api.twelvedata.com", description: language === "zh" ? "Twelve Data HTTPS API。" : "Twelve Data HTTPS API." }],
    security: [{ apiKey: [] }],
    externalDocs: { url: "https://twelvedata.com/docs", description: language === "zh" ? "供应商文档证据。" : "Supplier documentation evidence." },
    components: {
      schemas,
      securitySchemes: {
        apiKey: {
          type: "apiKey",
          in: "query",
          name: "apikey",
          description: language === "zh" ? "调用方提供的 Twelve Data API Key；不得写入请求示例或持久化。" : "Twelve Data API key supplied by the caller; it must not be stored in request examples or persisted.",
        },
      },
    },
    tags: [...usedTags].map((name) => ({ name, description: tagText[name] })),
    apis,
    asyncapi: asyncApi(language),
  };
  return loadPontxSpec(spec, { expectedName: "twelve-data-forex" });
}

const upstreamResponse = await fetch(sourceUrl);
if (!upstreamResponse.ok) throw new Error(`Unable to fetch official OAS: HTTP ${upstreamResponse.status}`);
const bytes = Buffer.from(await upstreamResponse.arrayBuffer());
const sourceSha256 = sha256(bytes);
if (sourceSha256 !== expectedSha256) {
  throw new Error(`Official OAS SHA-256 changed: expected ${expectedSha256}, received ${sourceSha256}`);
}
const imported = importOpenAPI(JSON.parse(bytes.toString("utf8")), { name: "twelve-data-forex" });
const zh = buildSpec(imported, "zh");
const en = buildSpec(imported, "en");
await mkdir(resolve(outputRoot, "locales/en-US"), { recursive: true });
await mkdir(resolve(outputRoot, "sources"), { recursive: true });
await writeFile(resolve(outputRoot, "spec.pontx.json"), `${JSON.stringify(PontxSpec.reOrder(zh), null, 2)}\n`);
await writeFile(resolve(outputRoot, "locales/en-US/spec.pontx.json"), `${JSON.stringify(PontxSpec.reOrder(en), null, 2)}\n`);
await writeFile(resolve(outputRoot, "sources/provenance.json"), `${JSON.stringify({
  source: {
    url: sourceUrl,
    sha256: sourceSha256,
    observedAt: verifiedAt,
    retained: "No supplier OAS file or prose is retained; this product is an independently curated contract.",
  },
  scope: {
    endpointCount: Object.keys(zh.apis).length,
    operationIds: Object.values(zh.apis).map((api) => api.operationId),
    includes: ["Forex market data", "currency conversion", "technical indicators", "Forex reference data", "observed realtime quote stream"],
    excludes: ["Equities, funds, crypto, regulatory, and unrelated cross-asset Endpoint families"],
  },
  streamEvidence: {
    observedAt: verifiedAt,
    documentedOutbound: ["subscribe", "unsubscribe", "reset", "heartbeat"],
    observedInbound: ["subscribe-status", "price", "heartbeat"],
    semantics: "Inbound message fields are explicitly modelled as observed contract evidence, not copied supplier schemas.",
  },
}, null, 2)}\n`);
console.log(`Built Twelve Data Forex product: ${Object.keys(zh.apis).length} Endpoints, ${Object.keys(zh.components.schemas).length} Schemas.`);
