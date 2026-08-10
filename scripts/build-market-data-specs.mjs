import { mkdir, writeFile } from "node:fs/promises";
import { resolve } from "node:path";

const root = resolve(import.meta.dirname, "..");
const checkedAt = "2026-08-10";

const evidence = (status, urls, note) => ({
  "x-pontx-documentation-status": status,
  "x-pontx-evidence": urls,
  "x-pontx-verified-at": checkedAt,
  "x-pontx-stability-note": note
});

const parameter = (name, location, description, required = false, schema = { type: "string" }) => ({
  name,
  in: location,
  description,
  required,
  schema
});

const response = (description, contentType = "application/json", schema = { type: "object", additionalProperties: true }) => ({
  description,
  content: { [contentType]: { schema } }
});

const get = (operationId, summary, parameters, status, urls, note, contentType, schema) => ({
  get: {
    operationId,
    summary,
    description: `${summary}. ${note}`,
    parameters,
    responses: { "200": response("Successful response", contentType, schema) },
    ...evidence(status, urls, note)
  }
});

const object = (properties) => ({ type: "object", properties, additionalProperties: true });
const string = { type: "string" };
const number = { type: "number" };
const array = (items = object({})) => ({ type: "array", items });

const specs = [
  {
    slug: "massive",
    title: "Massive Stock Market Data API",
    description: "Official Massive (formerly Polygon.io) read-only stock market REST API surface used by FiApp and its adjacent market-data resources.",
    servers: [{ url: "https://api.polygon.io", description: "Polygon-compatible production endpoint used by FiApp" }],
    securitySchemes: { ApiKey: { type: "apiKey", in: "query", name: "apiKey" } },
    security: [{ ApiKey: [] }],
    paths: {
      "/v2/last/trade/{stocksTicker}": get("getLastTrade", "Get the last stock trade", [parameter("stocksTicker", "path", "Case-sensitive stock ticker", true)], "official", ["https://massive.com/docs/rest/stocks/trades-quotes/last-trade"], "Officially documented endpoint; availability depends on the account's market-data plan.", "application/json", object({ status: string, request_id: string, results: object({ T: string, p: number, s: number, t: number }) })),
      "/v2/aggs/ticker/{stocksTicker}/prev": get("getPreviousClose", "Get previous-day aggregate", [parameter("stocksTicker", "path", "Stock ticker", true), parameter("adjusted", "query", "Return split-adjusted results", false, { type: "boolean", default: true })], "official", ["https://massive.com/docs/rest/stocks/aggregates/previous-day-bar"], "Officially documented aggregate endpoint.", "application/json", object({ status: string, ticker: string, results: array(object({ c: number, h: number, l: number, o: number, v: number, t: number })) })),
      "/v2/aggs/ticker/{stocksTicker}/range/{multiplier}/{timespan}/{from}/{to}": get("getAggregateBars", "Get custom aggregate bars", [parameter("stocksTicker", "path", "Stock ticker", true), parameter("multiplier", "path", "Timespan multiplier", true, { type: "integer", minimum: 1 }), parameter("timespan", "path", "Bar unit", true, { type: "string", enum: ["minute", "hour", "day", "week", "month", "quarter", "year"] }), parameter("from", "path", "Start date or timestamp", true), parameter("to", "path", "End date or timestamp", true)], "official", ["https://massive.com/docs/rest/stocks/aggregates/custom-bars"], "Officially documented aggregate endpoint.", "application/json", object({ ticker: string, results: array(object({ c: number, h: number, l: number, o: number, v: number, t: number })) })),
      "/v3/snapshot": get("getMarketSnapshot", "Get a stock-market snapshot", [parameter("ticker.any_of", "query", "Comma-separated tickers"), parameter("limit", "query", "Maximum results", false, { type: "integer" })], "official", ["https://massive.com/docs/rest/stocks/snapshots/full-market-snapshot"], "Officially documented snapshot family.", "application/json", object({ status: string, results: array(object({ ticker: string, value: number, session: object({ change_percent: number, close: number }) })) })),
      "/v3/reference/tickers": get("listTickers", "List and search supported tickers", [parameter("ticker", "query", "Ticker filter"), parameter("market", "query", "Market filter"), parameter("active", "query", "Active-listing filter", false, { type: "boolean" })], "official", ["https://massive.com/docs/rest/stocks/tickers/all-tickers"], "Official reference-data endpoint.", "application/json", object({ status: string, results: array(object({ ticker: string, name: string, market: string, locale: string, currency_name: string })) })),
      "/v3/reference/tickers/{ticker}": get("getTickerDetails", "Get ticker reference details", [parameter("ticker", "path", "Stock ticker", true), parameter("date", "query", "Point-in-time date")], "official", ["https://massive.com/docs/rest/stocks/tickers/ticker-overview"], "Official reference-data endpoint.", "application/json", object({ status: string, results: object({ ticker: string, name: string, description: string, market: string, primary_exchange: string }) }))
    }
  },
  {
    slug: "yahoo-finance",
    title: "Yahoo Finance Web Market Data API",
    description: "Undocumented read-only Yahoo Finance web endpoints observed on provider-owned pages. These are not a supported Yahoo developer API.",
    servers: [{ url: "https://query1.finance.yahoo.com" }, { url: "https://query2.finance.yahoo.com" }],
    paths: {
      "/v8/finance/chart/{symbol}": get("getChart", "Get chart and historical price data", [parameter("symbol", "path", "Yahoo Finance symbol", true), parameter("range", "query", "Requested range"), parameter("interval", "query", "Bar interval"), parameter("period1", "query", "Unix start time", false, { type: "integer" }), parameter("period2", "query", "Unix end time", false, { type: "integer" }), parameter("includePrePost", "query", "Include extended hours", false, { type: "boolean" })], "observed", ["https://finance.yahoo.com/quote/AAPL/", "https://query2.finance.yahoo.com/v8/finance/chart/AAPL"], "Observed in Yahoo Finance's quote-page network traffic and used by FiApp; compatibility is not guaranteed.", "application/json", object({ chart: object({ result: array(object({ meta: object({ symbol: string, currency: string, regularMarketPrice: number, previousClose: number, regularMarketTime: number }), timestamp: array({ type: "integer" }), indicators: object({ quote: array(object({ open: array(number), high: array(number), low: array(number), close: array(number), volume: array(number) })) }) })), error: object({}) }) })),
      "/v7/finance/quote": get("getQuotes", "Get batch quote snapshots", [parameter("symbols", "query", "Comma-separated symbols", true), parameter("fields", "query", "Comma-separated response fields"), parameter("formatted", "query", "Return formatted values", false, { type: "boolean" })], "observed", ["https://finance.yahoo.com/quote/AAPL/"], "Observed in Yahoo Finance's own quote-page traffic.", "application/json", object({ quoteResponse: object({ result: array(object({ symbol: string, regularMarketPrice: number, regularMarketChangePercent: number, regularMarketTime: number, currency: string })), error: object({}) }) })),
      "/v7/finance/spark": get("getSpark", "Get compact chart series", [parameter("symbols", "query", "Comma-separated symbols", true), parameter("range", "query", "Requested range"), parameter("interval", "query", "Bar interval")], "observed", ["https://finance.yahoo.com/quote/AAPL/"], "Observed in Yahoo Finance's own market widgets.", "application/json", object({ spark: object({ result: array(object({ symbol: string, response: array(object({ timestamp: array({ type: "integer" }), indicators: object({ quote: array(object({ close: array(number) })) }) })) })) }) })),
      "/v1/finance/quoteType/": get("getQuoteType", "Get security type and identity", [parameter("symbol", "query", "Yahoo Finance symbol", true)], "observed", ["https://finance.yahoo.com/quote/AAPL/"], "Observed on Yahoo Finance's quote page.", "application/json", object({ quoteType: object({ result: array(object({ symbol: string, quoteType: string, longName: string, exchange: string })) }) })),
      "/v1/finance/search": get("searchSymbols", "Search securities", [parameter("q", "query", "Search text", true), parameter("quotesCount", "query", "Maximum securities", false, { type: "integer" }), parameter("newsCount", "query", "Maximum news results", false, { type: "integer" })], "inferred", ["https://finance.yahoo.com/lookup/"], "Provider-owned search endpoint family; validated as a public read-only request.", "application/json", object({ quotes: array(object({ symbol: string, shortname: string, longname: string, exchange: string, quoteType: string })) })),
      "/v10/finance/quoteSummary/{symbol}": get("getQuoteSummary", "Get modular security details", [parameter("symbol", "path", "Yahoo Finance symbol", true), parameter("modules", "query", "Comma-separated modules", true)], "inferred", ["https://finance.yahoo.com/quote/AAPL/profile/"], "Module availability and crumb requirements can change without notice.", "application/json", object({ quoteSummary: object({ result: array(object({ price: object({}), summaryDetail: object({}), assetProfile: object({}) })), error: object({}) }) })),
      "/ws/fundamentals-timeseries/v1/finance/timeseries/{symbol}": get("getFundamentalTimeseries", "Get fundamental and event time series", [parameter("symbol", "path", "Yahoo Finance symbol", true), parameter("type", "query", "Comma-separated series types", true), parameter("period1", "query", "Unix start time", true, { type: "integer" }), parameter("period2", "query", "Unix end time", true, { type: "integer" })], "observed", ["https://finance.yahoo.com/quote/AAPL/"], "Observed on Yahoo Finance's quote chart; supported types are internal and may change.", "application/json", object({ timeseries: object({ result: array(object({ meta: object({}), timestamp: array({ type: "integer" }) })) }) }))
    }
  },
  {
    slug: "stooq",
    title: "Stooq Public Quote Downloads",
    description: "Public read-only Stooq CSV quote and historical-download endpoints. The URL contract is observed rather than formally versioned.",
    servers: [{ url: "https://stooq.com" }],
    paths: {
      "/q/l/": get("downloadLatestQuotes", "Download current or latest quotes", [parameter("s", "query", "Comma-separated Stooq symbols", true), parameter("f", "query", "Field selection code"), parameter("h", "query", "Include header", false, { type: "boolean" }), parameter("e", "query", "Output format", false, { type: "string", enum: ["csv"] })], "observed", ["https://stooq.com/q/l/?s=aapl.us&f=sd2t2ohlcvp&h&e=csv"], "Used by FiApp and verified as a public CSV response.", "text/csv", { type: "string" }),
      "/q/d/l/": get("downloadHistoricalQuotes", "Download historical price data", [parameter("s", "query", "Stooq symbol", true), parameter("d1", "query", "Start date YYYYMMDD"), parameter("d2", "query", "End date YYYYMMDD"), parameter("i", "query", "Interval", false, { type: "string", enum: ["d", "w", "m"] })], "inferred", ["https://stooq.com/q/d/?s=aapl.us"], "Linked by provider-owned historical-data pages and validated as read-only CSV.", "text/csv", { type: "string" })
    }
  },
  {
    slug: "sina-finance",
    title: "Sina Finance Web Quote API",
    description: "Undocumented Sina Finance text and JSONP market-data endpoints observed in public pages and FiApp.",
    servers: [{ url: "https://hq.sinajs.cn" }, { url: "https://quotes.sina.cn" }],
    paths: {
      "/list={symbols}": get("getQuoteSnapshots", "Get single or batch quote snapshots", [parameter("symbols", "path", "Comma-separated prefixed symbols", true)], "observed", ["https://finance.sina.com.cn", "https://hq.sinajs.cn/list=sh000001"], "Used by FiApp; response is GBK-oriented JavaScript assignment text.", "text/plain", { type: "string" }),
      "/cn/api/jsonp_v2.php/var%20_data=/CN_MarketDataService.getKLineData": get("getKLineData", "Get A-share K-line data", [parameter("symbol", "query", "Prefixed security symbol", true), parameter("scale", "query", "Bar size in minutes", true, { type: "integer" }), parameter("ma", "query", "Moving-average mode"), parameter("datalen", "query", "Maximum bars", false, { type: "integer" })], "inferred", ["https://finance.sina.com.cn/realstock/company/sh600000/nc.shtml"], "Derived from provider-owned chart requests and validated as public JSONP.", "application/javascript", { type: "string" })
    }
  },
  {
    slug: "tencent-finance",
    title: "Tencent Finance Web Quote API",
    description: "Undocumented Tencent Finance read-only quote and chart endpoints used by public pages and FiApp.",
    servers: [{ url: "https://qt.gtimg.cn" }, { url: "https://web.ifzq.gtimg.cn" }],
    paths: {
      "/q={symbols}": get("getQuoteSnapshots", "Get single or batch quote snapshots", [parameter("symbols", "path", "Comma-separated Tencent-prefixed symbols", true)], "observed", ["https://gu.qq.com", "https://qt.gtimg.cn/q=hk00700"], "Used by FiApp; HTTPS was verified on 2026-08-10. Response is JavaScript assignment text.", "text/plain", { type: "string" }),
      "/appstock/app/fqkline/get": get("getForwardAdjustedKLine", "Get adjusted K-line data", [parameter("param", "query", "Comma-separated symbol, interval, start, end and count", true)], "inferred", ["https://gu.qq.com/hk00700"], "Observed in the provider's public chart family; response structure can change.", "application/json", object({ code: { type: "integer" }, data: object({}) })),
      "/appstock/app/kline/kline": get("getKLine", "Get unadjusted K-line data", [parameter("param", "query", "Comma-separated symbol, interval, start, end and count", true)], "inferred", ["https://gu.qq.com/hk00700"], "Observed in the provider's public chart family; response structure can change.", "application/json", object({ code: { type: "integer" }, data: object({}) }))
    }
  },
  {
    slug: "eastmoney-funds",
    title: "Eastmoney Fund Web Data API",
    description: "Undocumented Eastmoney/Tiantian Fund read-only JSONP endpoints observed on provider-owned fund pages and used by FiApp.",
    servers: [{ url: "https://api.fund.eastmoney.com" }, { url: "https://fundgz.1234567.com.cn" }, { url: "https://push2.eastmoney.com" }],
    paths: {
      "/js/{fundCode}.js": get("getFundEstimate", "Get latest fund estimate", [parameter("fundCode", "path", "Six-digit fund code", true), parameter("rt", "query", "Cache-busting timestamp", false, { type: "integer" })], "observed", ["https://fund.eastmoney.com/001072.html", "https://fundgz.1234567.com.cn/js/001072.js"], "Used by FiApp; returns a jsonpgz JSONP wrapper.", "application/javascript", { type: "string" }),
      "/f10/lsjz": get("listHistoricalNav", "List historical fund NAV", [parameter("fundCode", "query", "Six-digit fund code", true), parameter("pageIndex", "query", "One-based page", false, { type: "integer", default: 1 }), parameter("pageSize", "query", "Rows per page", false, { type: "integer", default: 20 }), parameter("startDate", "query", "Start date"), parameter("endDate", "query", "End date")], "observed", ["https://fundf10.eastmoney.com/jjjz_001072.html"], "Observed directly in the provider-owned historical-NAV page and used by FiApp.", "application/json", object({ Data: object({ LSJZList: array(object({ FSRQ: string, DWJZ: string, LJJZ: string, JZZZL: string })), TotalCount: { type: "integer" }, PageIndex: { type: "integer" } }) })),
      "/f10/LSJZChart": get("getHistoricalNavChart", "Get historical NAV chart series", [parameter("fundCode", "query", "Six-digit fund code", true), parameter("type", "query", "Chart type"), parameter("pageIndex", "query", "One-based page", false, { type: "integer" }), parameter("pageSize", "query", "Maximum points", false, { type: "integer" }), parameter("startDate", "query", "Start date"), parameter("endDate", "query", "End date")], "observed", ["https://fundf10.eastmoney.com/jjjz_001072.html"], "Captured from the provider-owned historical-NAV page on 2026-08-10.", "application/javascript", { type: "string" }),
      "/api/qt/ulist.np/get": get("getMarketIndexList", "Get related market-index snapshots", [parameter("secids", "query", "Comma-separated Eastmoney security IDs", true), parameter("fields", "query", "Comma-separated response fields", true), parameter("fltt", "query", "Number formatting mode")], "observed", ["https://fundf10.eastmoney.com/jjjz_001072.html"], "Observed on the provider-owned fund page; field identifiers are internal.", "application/json", object({ rc: { type: "integer" }, data: object({ diff: array(object({ f2: number, f3: number, f12: string, f14: string })) }) }))
    }
  },
  {
    slug: "cnbc-market-data",
    title: "CNBC Web Quote API",
    description: "Undocumented CNBC read-only quote and chart endpoints observed on CNBC's own quote pages and used by FiApp.",
    servers: [{ url: "https://quote.cnbc.com" }, { url: "https://webql-redesign.cnbcfm.com" }],
    paths: {
      "/quote-html-webservice/restQuote/symbolType/symbol": get("getRestQuotes", "Get single or batch quote data", [parameter("symbols", "query", "Comma-separated symbols", true), parameter("requestMethod", "query", "Client request mode"), parameter("partnerId", "query", "CNBC partner identifier"), parameter("fund", "query", "Include fund data", false, { type: "boolean" }), parameter("exthrs", "query", "Include extended hours", false, { type: "boolean" }), parameter("output", "query", "Output format", false, { type: "string", enum: ["json"] })], "observed", ["https://www.cnbc.com/quotes/AAPL"], "Captured from CNBC's own quote page on 2026-08-10 and adjacent to FiApp's legacy quick-quote request.", "application/json", object({ FormattedQuoteResult: object({ FormattedQuote: array(object({ symbol: string, name: string, last: string, change_pct: string, currencyCode: string, last_time_msec: string })) }) })),
      "/graphql": get("getQuoteChartData", "Get quote chart data through a persisted query", [parameter("operationName", "query", "Persisted operation name", true), parameter("variables", "query", "JSON-encoded query variables", true), parameter("extensions", "query", "JSON-encoded persisted-query hash", true)], "observed", ["https://www.cnbc.com/quotes/AAPL"], "CNBC uses persisted GraphQL queries; hashes and shapes may change without notice.", "application/json", object({ data: object({}) }))
    }
  },
  {
    slug: "i3investor-sgx",
    title: "i3Investor SGX Public Pages",
    description: "Public i3Investor SGX HTML market pages. This collection documents stable read-only page inputs and extractable semantic fields, not a JSON API.",
    servers: [{ url: "https://sgx.i3investor.com" }],
    paths: {
      "/servlets/stk/{code}.jsp": get("getSgxStockPage", "Get an SGX stock quote page", [parameter("code", "path", "Lowercase SGX stock code", true)], "observed", ["https://sgx.i3investor.com/"], "Used by FiApp. Price is extracted from JSON-LD and change percentage from visible HTML; page markup may change.", "text/html", { type: "string" }),
      "/web/stock/overview/{code}": get("getSgxStockOverview", "Get an SGX stock overview page", [parameter("code", "path", "SGX stock code", true)], "inferred", ["https://sgx.i3investor.com/"], "Provider-owned read-only stock page family; HTML structure is not versioned.", "text/html", { type: "string" })
    }
  }
];

for (const spec of specs) {
  const document = {
    openapi: "3.0.3",
    info: {
      title: spec.title,
      version: "2026-08-10",
      description: spec.description,
      license: { name: spec.slug === "massive" ? "Proprietary" : "Proprietary / undocumented" }
    },
    servers: spec.servers,
    paths: spec.paths,
    components: { schemas: {}, ...(spec.securitySchemes ? { securitySchemes: spec.securitySchemes } : {}) },
    ...(spec.security ? { security: spec.security } : {})
  };
  const directory = resolve(root, "specs", spec.slug);
  await mkdir(directory, { recursive: true });
  await writeFile(resolve(directory, "openapi.json"), `${JSON.stringify(document, null, 2)}\n`);
}

console.log(`Built ${specs.length} market-data OpenAPI documents.`);
