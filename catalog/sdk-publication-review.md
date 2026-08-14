# SDK publication and redistribution review

Reviewed on 2026-08-14. This is an operational release gate for the Pontx
catalog, not a substitute for legal advice. A collection remains publishable
only when authoritative provider material supports automated API integration
and Pontx can distribute client code without redistributing provider data.

## Release standard

A collection passes only when all of the following are true:

- The provider exposes an official developer API or an openly licensed public
  API implementation.
- Pontx can describe the interface and publish independently generated client
  code without copying proprietary documentation or provider data.
- Every caller supplies its own credentials and accepts the provider's account,
  entitlement, rate-limit, and data-use terms.
- The npm package contains code and types only. It does not bundle, cache,
  mirror, display, sublicense, or redistribute API responses or market data.
- Hub proxy execution is disabled when the provider's data terms make Pontx
  relaying responses an avoidable redistribution risk.

Observed browser requests, public reachability, a `robots.txt` allowance, or a
working unauthenticated GET request are not affirmative publication rights.

## Decisions

| Collection | Decision | Authoritative basis and release conditions |
| --- | --- | --- |
| Frankfurter v1 | Keep / published | The provider operates a public API and publishes the implementation as open source. Preserve attribution and do not represent reference rates as trading prices. |
| Frankfurter v2 | Keep / published | The provider documents the public v2 API in its open-source repository and invites third-party libraries and tools. `@pontx/frankfurter-v2` contains generated code and types and preserves provider/source attribution. |
| Dida365 | Keep / published | Dida365 publishes and supports its developer API. Callers must create their own app, use OAuth scopes, and keep credentials session-local. |
| Massive | Keep / published with restrictions | Massive publishes official REST documentation, an official MIT JavaScript client, and generated OpenAPI-based clients. `@pontx/massive` contains client code only; callers must use their own API key and data entitlement. Hub proxying, response storage, and data redistribution remain disabled. |
| Yahoo Finance web endpoints | Remove | The collection was derived from unsupported website traffic. Yahoo's API terms prohibit automated collection outside Yahoo APIs and restrict reverse engineering of API specifications. No authorization was found for these web endpoints or for publishing a client for them. |
| Stooq downloads | Remove | No provider-maintained developer contract or redistribution license was found. The recorded routes now require provider-controlled browser verification or an API key flow and are not a stable, licensed public API surface. |
| Sina Finance web endpoints | Remove | The collection was derived from internal page requests. Sina's service/copyright terms require authorization for reuse and derivative use of protected content, and the Finance agreement restricts disclosure and third-party use of collected data without written consent. |
| Tencent Finance web endpoints | Remove | No provider-maintained Finance developer API or redistribution grant was found. The collection depended on internal page interaction data and non-authorized third-party access patterns rather than a published interface. |
| Eastmoney fund web endpoints | Remove | No public developer API or SDK/spec redistribution grant was found. The routes are internal website JSON/JSONP contracts containing proprietary market/fund data and unstable page tokens. |
| CNBC web endpoints | Remove | NBCUniversal prohibits automated or manual data extraction except through interfaces it publishes for that purpose. The captured REST and persisted GraphQL requests are internal page interfaces, not a published developer API. |
| i3Investor SGX pages | Remove | This was HTML extraction rather than an API. i3Investor grants no license for its or third-party copyrightable material, and the pages contain third-party market data. No SDK or redistribution authorization was found. |

## Primary evidence

- Frankfurter project and public API: https://github.com/lineofflight/frankfurter
- Dida365 supported API: https://help.ticktick.com/articles/7055781495671095296
- Massive REST quickstart: https://massive.com/docs/rest/quickstart
- Massive official MIT JavaScript client: https://github.com/massive-com/client-js
- Massive market-data terms: https://massive.com/legal/market-data-terms-of-service
- Yahoo API terms: https://legal.yahoo.com/us/en/yahoo/terms/product-atos/apitnc/index.html
- Sina service and copyright terms: https://corp.sina.com.cn/chn/sina_item.html and https://corp.sina.com.cn/chn/copyright.html
- Sina Finance software agreement: https://finance.sina.cn/app/SFAuser.shtml
- Eastmoney service agreement and legal statement: https://about.eastmoney.com/home/protocol and https://about.eastmoney.com/home/disclaimer
- NBCUniversal prohibited actions: https://www.nbcuniversal.com/terms/prohibited-actions
- i3Investor terms: https://us.i3investor.com/web/general/tac

## Re-entry rule

A removed collection may return only after the provider publishes an official
developer interface with compatible terms or gives Pontx written permission to
publish the OpenAPI metadata and generated SDK/CLI. A working website request
alone is not sufficient.
