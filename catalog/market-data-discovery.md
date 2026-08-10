# FiApp market-data discovery audit

Validated on 2026-08-10. This inventory is limited to public, read-only market-data requests. No authentication, account, trading, mutation, advertising, or user-data endpoints were inspected or included.

| Provider | Included family | Status | Evidence | Wire format |
| --- | --- | --- | --- | --- |
| Massive | Last trade, previous close, custom aggregates, snapshots, ticker search/details | official | [Massive Stocks REST docs](https://massive.com/docs/rest/stocks/overview) and FiApp `polygon.ts` | JSON |
| Yahoo Finance | Chart, batch quote, spark, quote type, search, quote summary, fundamental time series | observed / inferred | [Yahoo AAPL quote page](https://finance.yahoo.com/quote/AAPL/) network capture and FiApp `yahoo.ts` | JSON |
| Stooq | Latest quote and historical downloads | observed / inferred | [Latest CSV](https://stooq.com/q/l/?s=aapl.us&f=sd2t2ohlcvp&h&e=csv), [historical page](https://stooq.com/q/d/?s=aapl.us), and FiApp `stooq.ts` | CSV |
| Sina Finance | Single/batch snapshots and K-line data | observed / inferred | [Sina Finance](https://finance.sina.com.cn/), public quote request, and FiApp `sina.ts` | GBK-oriented text / JSONP |
| Tencent Finance | Single/batch snapshots and adjusted/unadjusted K-line data | observed / inferred | [Tencent Stocks](https://gu.qq.com/), [HTTPS snapshot](https://qt.gtimg.cn/q=hk00700), and FiApp `tencent.ts` | text / JSON |
| Eastmoney | Fund estimate, historical NAV, NAV chart, related market indices | observed | [Tiantian Fund NAV page](https://fundf10.eastmoney.com/jjjz_001072.html) network capture and FiApp `eastmoneyFund.ts` | JSON / JSONP |
| CNBC | REST quotes and persisted GraphQL chart data | observed | [CNBC AAPL quote page](https://www.cnbc.com/quotes/AAPL) network capture and FiApp `cnbc.ts` | JSON / GraphQL JSON |
| i3Investor | SGX stock quote and overview pages | observed / inferred | [i3Investor SGX](https://sgx.i3investor.com/) and FiApp `i3.ts` | HTML / JSON-LD |

## Evidence rules

- `official`: backed by provider-maintained API documentation.
- `observed`: emitted by a provider-owned page or already exercised by FiApp and reproduced as a public GET request.
- `inferred`: adjacent read-only family found in provider-owned navigation or frontend behavior and validated without credentials.
- Third-party blog-only endpoints, login/account calls, mutation calls, and endpoints that could not be reproduced were excluded.

## Known gaps

- Yahoo Finance does not publish a compatibility contract for these web endpoints; crumb requirements and module availability can change.
- Sina and Tencent response field positions are internal and are intentionally modeled conservatively.
- Eastmoney fund search/profile/performance calls were not added unless captured from provider-owned pages in this audit.
- CNBC persisted-query hashes can rotate; only the quote REST family and the observed chart operation are represented.
- i3Investor exposes HTML pages rather than a stable JSON API; only page inputs and semantic output format are documented.
