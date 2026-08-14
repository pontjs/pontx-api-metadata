# API 集合增长优先级

> 状态：候选路线图，不代表已批准收录。证据快照：2026-08-14（Asia/Shanghai）。

本文件决定调查和制作顺序；20 个产品的结构化 intake、权威证据、门槛状态与下一步维护在
[`api-collection-candidates.json`](./api-collection-candidates.json)。正式 Hub catalog 仍只包含
`catalog/source.json` 中通过全部准入门槛的集合。

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
- Stripe Identity 只在供应商明确的 Identity 子产品边界内单独合规审查，不扩展成完整支付集合。
- 当前 catalog 已有 Frankfurter v1、Frankfurter v2、Dida365 和 Massive，不进入本轮候选。

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

| 排名 | API 集合 | 分数 | 2026-08-14 审计结果 | 当前下一步 |
| ---: | --- | ---: | --- | --- |
| 1 | Notion API | 92 | 官方文档与 MIT SDK 可用；完整 OAS、协议与 prose 再分发待确认 | 固定 `Notion-Version: 2026-03-11` 并逐接口对账 |
| 2 | WPS 365 OpenAPI | 90 | 官方称超过 1,000 个接口；无公开完整规范快照，许可与全协议面待确认 | 获取官方规范或书面授权后做全产品盘点 |
| 3 | MongoDB Atlas Administration API v2 | 88 | 官方 Apache-2.0 OAS；335 paths / 540 operations / 1,145 Schemas，未发现 SSE media type | 双语化、风险策略、SDK/CLI 发布 |
| 4 | PostHog Public API | 86 | 官方 OAS 3.1；1,314 paths / 1,863 operations / 3,403 Schemas；含多个 SSE Endpoint | 整集协议暂缓，复核混合许可 |
| 5 | Amazon SQS API | 84 | 官方 Apache-2.0 Smithy 模型完整列出 23 actions；无 Server-Sent Events | 建立可复现 Smithy→OAS 转换并完成 SigV4/风险策略 |
| 6 | Dropbox Sign API | 80 | 官方 Apache-2.0 OAS；67 paths / 73 operations / 217 Schemas，未发现 SSE media type | 双语化、高风险执行策略、SDK/CLI 发布 |
| 7 | Sendbird Chat Platform API v3 | 77 | 官方 REST/JSON 文档与声明 Unlicense 的生成 SDK 可用；完整上游 OAS 与文档 prose 再分发条件未确认 | 获取生成源并完成全协议/Endpoint 对账 |

分数高不等于可直接上线。WPS 覆盖和增长潜力很大，但错误定界或残缺发布的代价也最大；PostHog
虽然有完整机器规范，但协议门已经阻断。

## AI/LLM 候选：整集协议暂缓

官方协议证据已确认以下 12 个完整产品面包含 SSE、WebSocket 或其他实时协议。它们的编辑分仅表示
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
| Stripe Identity API | 合规阻断 | 官方 MIT OAS 中有 8 个 Identity operations，但政府证件、自拍、生物特征与身份号码属于高度敏感个人数据；数据角色、地域、保留、同意、日志和代理边界未获书面批准 |

## 当前实施队列

### 契约源已具备，继续准入工程

1. MongoDB Atlas Administration API v2
2. Amazon SQS API
3. Dropbox Sign API

这三项仍不是 catalog-ready：需完成双语规范、全部风险策略、成功请求示例、SDK/CLI 构建测试与运营者
发布。未完成前保持在候选注册表。

### 先解决证据或边界缺口

1. Notion API
2. Sendbird Chat Platform API v3
3. WPS 365 OpenAPI

### 暂缓

- PostHog 与 12 个 AI/LLM 集合：协议门阻断。
- Stripe Identity：隐私与合规门阻断。
- 没有权威完整契约、可接受再分发条件或可发布 SDK/CLI 的任何候选。

## 维护规则

- 每月使用 Pontx 第一方搜索、激活和留存数据复核制作顺序。
- 每季度复核供应商版本、许可、协议面、规范快照和候选证据 URL。
- 新候选先进入本文件和结构化注册表，通过审核后才创建正式 OAS/catalog 变更。
- 排名变化不自动授权收录、npm 发布、推送或部署。
- 每次修改运行 `node scripts/verify-candidates.mjs`；候选注册表的数量、顺序、权威证据和阻断状态是 CI 契约。
