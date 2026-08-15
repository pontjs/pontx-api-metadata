# API 集合增长优先级

> 状态：候选路线图，不代表已批准收录。证据快照：2026-08-15（Asia/Shanghai）。

本文件决定调查和制作顺序；当前 19 个产品的结构化 intake、权威证据、门槛状态与下一步维护在
[`candidates/products.json`](../candidates/products.json) 和各个
`candidates/<slug>/candidate.json`。正式 Hub catalog 仍只包含
`catalog/products.json` 中通过全部准入门槛且拥有完整分级产品目录的集合。

## 目标

优先建设用户需求高、供应商边界稳定、契约完整且能统一生成文档、SDK、CLI 和 Agent Skill
的 API 集合。北极星指标是首次成功集成时间（Time to First Successful Integration）；配套观察
Agent 任务成功率、开发者激活率、7/30 日回访和非品牌自然搜索增长。

用户量增长是高质量集成能力产生的结果，不是用残缺页面堆出来的目标。每个正式集合都必须让
开发者或 Agent 在不猜测参数、不读取第三方碎片资料、不泄露凭证的前提下，构造正确请求并清楚
理解执行影响。

## 集合边界

- 一项候选对应一个由上游供应商稳定定义的 API 产品，而不是模型版本、单个 Endpoint、提示词、
  计算器或聚合能力。
- Qwen、DeepSeek、Gemini、Claude、Kimi、GLM、Grok、混元、星火、千帆和 Mistral 的模型版本
  归入各自供应商级 API 集合，不按型号拆分。
- MongoDB 候选仅指 Atlas Administration API v2，不包含数据库 wire protocol 或其他 Atlas 产品。
- Sendbird 候选仅指服务端 Chat Platform API v3，不包含客户端实时协议。
- ECB 候选保留完整 Data Portal SDMX 2.1 REST 服务边界；EXR 汇率数据流不冒充独立供应商 API。
- CurrencyBeacon 候选仅指官方 v1 REST API；供应商另行提供的 MCP server 不并入 REST 集合。
- Open Exchange Rates 候选按官方 v0.7 的七个 JSON REST Endpoint 定界。
- Twelve Data Forex 已正式收录完整的 Forex REST 与 WebSocket 产品面；实时入站字段明确为免费账户观测契约，不伪称为供应商发布的 Schema。
- Stripe Identity 只在供应商明确的 Identity 子产品边界内单独合规审查，不扩展成完整支付集合。
- 当前 catalog 已有 Frankfurter v1、Frankfurter v2、Dida365、Massive、ECB Data Portal、Twelve Data Forex、CurrencyBeacon、Dropbox Sign、Stripe Identity 和 Amazon SQS；已准入产品在账本中保留持续治理状态，其余候选不进入正式目录。

## 不可绕过的准入门槛

1. **权威来源**：发现平台只提供历史热度线索；Endpoint、Schema、认证、错误、示例和约束必须来自
   供应商官方规范、文档、SDK 源码或书面确认。
2. **许可与再分发**：必须证明 metadata/spec 和独立生成客户端可发布；不能证明时不收录。
3. **完整契约**：供应商定义的完整边界、全部 Endpoint、Schema、错误、枚举、限制和认证必须完整，
   且 `zh-CN` / `en-US` 结构一致。
4. **协议原子性**：只要完整集合包含 SSE、WebSocket 或其他 Pontx 尚未支持并验证的实时协议，整集
   暂缓；不得删除流式 Endpoint 后发布残缺版本。
5. **安全与隐私**：身份、签署、消息、文件、队列删除和云资源管理等敏感 mutation 必须逐 Endpoint
   设计 preview、确认、代理与凭证边界。
6. **SDK/CLI 发布**：正式 metadata 提升前，运营者必须先构建、测试并发布 `@pontx/{slug}` 与
   `pontx-{slug}`，Hub 只验证已发布版本，不代用户发布。

## 评分模型

| 维度 | 权重 | 判断内容 |
| --- | ---: | --- |
| 使用需求 | 25 | 历史热度线索、开发者受众广度、常见集成需求 |
| 契约稳定性 | 20 | 官方版本策略、维护状态、兼容性和权威规范 |
| 服务范围 | 15 | 能否覆盖完整且可复用的开发任务 |
| 统一产品化价值 | 20 | 同一 metadata 生成文档、SDK、CLI、Skill 和示例的价值 |
| 获客价值 | 10 | 可形成的搜索落地页、教程意图和激活机会 |
| 制作可行性 | 10 | 官方规范、边界、认证和安全复杂度 |
| **合计** | **100** | 仅用于确定审核和制作顺序 |

历史 `pv`、试用、购买与不透明热度值不是关键词搜索量。上线后应以 Pontx 自有 Search Console、
站内搜索、激活和留存数据替代第三方方向性信号。

## 非 LLM 候选质量顺序

| 排名 | API 集合 | 分数 | 审计结果（以各条验证日期为准） | 当前下一步 |
| ---: | --- | ---: | --- | --- |
| 1 | Notion API | 92 | 官方文档与 MIT SDK 可用，但 Notion Developer Terms §3.1 禁止复制、展示或向第三方分发 API；完整 OAS 与协议审计也仍待完成 | 取得书面许可，明确可发布 metadata、重建 OAS 与独立生成 SDK 后再固定 `Notion-Version: 2026-03-11` 并逐接口对账 |
| 2 | WPS 365 OpenAPI | 90 | 官方称超过 1,000 个接口；事件订阅使用加密 HTTP callback，但无公开完整规范快照，许可与其余协议面待确认 | 获取官方规范或书面授权后做全产品盘点 |
| 3 | MongoDB Atlas Administration API v2 | 88 | 335 paths / 540 operations / 1,145 Schemas，未发现 SSE media type；但固定 OAS 的 `info.license` 是 CC BY-NC-SA 3.0 US，仓库 Apache-2.0 LICENSE 未解决 OAS 的非商用限制 | 取得 MongoDB 对 OAS/独立生成 SDK 的书面商用再分发澄清，或固定一个明确许可的 OAS 版本 |
| 4 | PostHog Public API | 86 | 官方托管 OAS 3.1 为可变来源；观测到 1,314 paths / 1,863 operations / 3,403 Schemas，含多个 SSE Endpoint | 固定可再分发的不可变完整快照；整集协议暂缓并复核混合许可 |
| 5 | Amazon SQS API | 84 | 已正式准入：官方 Apache-2.0 Smithy 模型完整列出 23 个 RPC actions / 114 个 Schemas；AWS JSON 1.0、AWS Query compatibility、SigV4 与区域 endpoint-rule 保持为 RPC 语义，未伪造为 JSON REST。`@pontx/amazon-sqs@0.1.3`、独立 CLI、fresh-install、Node 20/22 CI 与生产 Hub 验证均已通过 | 持续复核固定 Smithy source、AWS 协议/端点规则、风险策略和 npm fresh-install |
| 6 | Dropbox Sign API | 80 | 已正式准入：固定官方 OAS 覆盖 67 paths / 73 operations / 217 Schemas；双语、风险、SDK/CLI 与发布证据全部通过 | 持续监控上游 OAS、安全公告、npm fresh-install 与 Node.js 兼容矩阵 |
| 7 | Sendbird Chat Platform API v3 | 77 | 官方 REST/JSON 文档与声明 Unlicense 的生成 SDK 可用；完整上游 OAS 与文档 prose 再分发条件未确认 | 获取生成源并完成全协议/Endpoint 对账 |
| 8 | ECB Data Portal SDMX API | 76 | 已正式准入：基于 ECB 当前文档独立重建 8 个 GET path variants / 12 个 Schemas；`@pontx/ecb-data-portal@0.1.0`、fresh-install、限定只读实调和 Node 18/20/22 CI 全部通过 | 持续复核 ECB 文档、复用条款、内容协商、状态码和 Node.js 兼容性 |
| 9 | Open Exchange Rates API | 74 | 官方 v0.7 OAS 含七个 Endpoint，但为可变内嵌文档、0 个 component Schema、四个成功响应缺 Schema；2026-08-15 的免费账户已实测 latest/historical/currencies/usage，time-series/convert/ohlc 被套餐拒绝。官方逐页文档可重建五类 Schema，仍缺 Unlimited 套餐才可取得的 convert 成功 payload。Pontx 仅以独立表述发布 metadata/客户端，不转发文档、数据或标识 | 取得可审核的 Unlimited convert 成功 fixture；不以推测值完成契约 |
| 10 | CurrencyBeacon REST API v1 | 72 | 已正式准入：供应商没有完整可保留 OAS；依据官方文档、代码样例和免费账户对五个只读 Endpoint 的实测，独立重建 5 个 Endpoint / 11 个 Schema（含完整成功及已观测错误响应）。中英文同构静态质量为 A；`@pontx/currencybeacon-rest@0.1.0` 与 CLI 已完成生成、类型、4 个单测、3 个 SDK/CLI E2E、npm pack、fresh-install 和 Node 18/20/22 CI。调用方使用自己的凭据直连，Hub 不代理、缓存、持久化或展示响应 | 持续复核官方文档、免费/付费套餐边界、实际响应结构与 Node.js 兼容性 |
| 11 | Twelve Data Forex API | 70 | 已正式准入：固定的官方 REST OAS 为 187 个 Endpoint / 797 个 Schema；独立收敛为 111 个 Forex Endpoint / 443 个 Schema（2 currencies、4 market data、3 reference data、102 technical indicators），逐 Endpoint request example 与中英文同构静态质量为 A。免费账户已实测 REST 与 WebSocket 的 price/subscribe-status/heartbeat；实时入站结构明确为观测契约。`@pontx/twelve-data-forex@0.1.0` 与 CLI 已完成本地生成、类型、4 单测、4 REST/CLI/WebSocket E2E、npm pack、直接服务验证及 Node 18/20/22 CI；市场数据始终由调用方按自己的套餐直连，Hub 不代理或再分发 | 持续复核供应商文档、套餐边界、OAS 指纹、观测流契约、npm fresh-install 和 Node.js 兼容性 |

分数高不等于可直接上线。WPS 覆盖和增长潜力很大，但错误定界或残缺发布的代价也最大；PostHog
虽然托管实例能导出完整机器规范，但该 URL 会变化，需先固定可再分发的不可变快照，且协议门已经阻断。

## AI/LLM 候选：整集协议暂缓

官方协议证据已确认以下 12 个 AI/LLM 完整产品面包含 SSE、WebSocket 或其他实时协议。它们的编辑分仅表示
未来解除协议限制后的潜在顺序，不能与当前可执行队列混排。

| 序位 | API 集合 | 编辑分 | 阻断证据摘要 |
| ---: | --- | ---: | --- |
| 1 | OpenAI API | 96 | Responses、图像和音频等包含 SSE，另有 Realtime API |
| 2 | Qwen API | 94 | 官方流式输出基于 SSE，部分模型仅支持流式调用 |
| 3 | DeepSeek API | 93 | Chat 与 FIM 官方响应定义 `text/event-stream` |
| 4 | Gemini API | 91 | `streamGenerateContent` / Interactions 使用 SSE，Live API 为双向实时协议 |
| 5 | Anthropic API | 91 | Messages streaming 使用带事件类型的 SSE |
| 6 | Kimi API | 86 | Chat `stream=true` 使用 SSE 并以 `data: [DONE]` 结束 |
| 7 | 智谱 BigModel / GLM API | 85 | 模型与知识库 Agent 定义 SSE 流式消息 |
| 8 | xAI Grok API | 84 | 文本输出模型官方流式协议为 SSE |
| 9 | 腾讯混元 API | 82 | 原生及 OpenAI 兼容面包含流式输出，迁移后的完整协议边界待固定 |
| 10 | 讯飞星火 API | 80 | 通用模型使用 WebSocket，知识库与工作流包含 HTTP/SSE |
| 11 | 百度千帆 API | 79 | 模型与应用调用包含 SSE 流式响应 |
| 12 | Mistral AI API | 78 | Chat/Agents、音频转录与 Workflow 事件包含 SSE |

协议暂缓不是删除候选。Pontx 完整实现并验证流式契约、生成、文档、请求构造与运行时安全后，才可
按本表顺序重新审查。

## 单独合规审查

| API 集合 | 当前状态 | 原因 |
| --- | --- | --- |
| Stripe Identity API | 已正式准入（仅文档/本地 SDK） | 固定官方 MIT OAS 的 8 个 Identity Endpoint / 35 个 Schema 已完成双语、风险、SDK/CLI 与生产发布。因证件、自拍、身份号码、联系信息、验证结果与 client secret 属于高度敏感数据，Hub 对 8/8 Endpoint 禁止代理；调用仅从调用者受控环境中的本地 SDK/CLI 发出 |

## 当前实施队列

### 已完成（持续治理）

1. Amazon SQS API：已以 Smithy→Pontx RPC（不伪造 REST path）、AWS JSON 1.0、AWS Query compatibility、SigV4 与区域 endpoint-rule runtime 完成全量 23-action 产品、双语文档、风险策略、SDK/CLI 和生产验证；后续只做来源、协议、风险和 npm 产物复核。

### 需先取得供应商许可

1. MongoDB Atlas Administration API v2：固定 OAS 的 CC BY-NC-SA 条款与仓库 Apache-2.0 LICENSE 冲突，需 MongoDB 书面澄清或另一个明确许可版本。
2. Notion API：Developer Terms §3.1 禁止向第三方复制、展示或分发 API，需 Notion 书面许可。

### 先解决证据或边界缺口

1. Notion API
2. Sendbird Chat Platform API v3
3. WPS 365 OpenAPI
4. Open Exchange Rates API

### 暂缓

- PostHog：协议门阻断，且需固定可再分发、可复现的不可变完整 schema 快照。
- 12 个 AI/LLM 集合：协议门阻断。
- Stripe Identity：已正式准入；因隐私与合规边界，Hub 执行持续保持关闭。
- 没有权威完整契约、可接受再分发条件或可发布 SDK/CLI 的任何候选。

## 维护规则

- 每月使用 Pontx 第一方搜索、激活和留存数据复核制作顺序。
- 每季度复核供应商版本、许可、协议面、规范快照和候选证据 URL。
- 新候选先进入本文件和 `candidates/<slug>/candidate.json`，通过审核后才创建正式 PontxSpec 产品目录并加入产品清单。
- 排名变化不自动授权收录、npm 发布、推送或部署。
- 每次修改运行 `node scripts/verify-candidates.mjs`；候选注册表的数量、顺序、权威证据和阻断状态是 CI 契约。
