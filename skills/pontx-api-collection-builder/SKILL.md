---
name: pontx-api-collection-builder
description: Build or substantially extend a production-grade API collection in pontx-api-metadata from authoritative evidence through bilingual OpenAPI, catalog registration, execution policy, approved hashes, compilation, and Hub verification. Use this skill whenever a user asks to add, onboard, curate, import, reconstruct, or rebuild an API/API 集合/接口集合/开放平台 for Pontx Hub, including requests phrased only as “收录这个 API” or “把这些文档做成 API 集合”. Do not use it merely to call or consume an API that is already cataloged.
---

# Pontx API Collection Builder

把来源分散的 API 事实整理成准确、可追溯、可搜索、可安全执行且可持续维护的 Pontx API 集合。目标不是“生成一个能解析的 OpenAPI 文件”，而是交付一个能够经受证据审查、代码生成、双语展示和运行时安全检查的契约。

## 开始前

1. 定位 `pontx-api-metadata` 仓库，读取工作区 `AGENTS.md`、仓库 `README.md`、`CONTRIBUTING.md` 和相关本地说明。
2. 在编辑前运行 `git status --short` 和 `git branch --show-current`。保留所有既有改动，不清理或覆盖无关文件。
3. 完整阅读 [references/quality-gates.md](references/quality-gates.md)，按其中的阻断级质量门执行。
4. 读取将要修改的 `catalog/source.json` 条目、`catalog/locales/<locale>.json`、同类 API 的 OAS，以及仓库现有构建脚本。以当前仓库实际契约为准，不从旧示例猜字段。
5. 若目录字段或公共负载需要变化，先读取跨仓库契约和变更路由；先让消费者兼容旧/新负载，再更新生产者。

如果用户只要求方案、评审或诊断，保持只读并交付证据和建议。只有“添加、构建、修改、修复”等明确请求才授权编辑文件。提交、推送、发布和部署始终需要单独授权。

## 1. 固定范围与身份

先形成一份简短的 intake，再开始写 OAS：

- API 产品、提供方、上游版本和稳定版本标识；
- 稳定 `slug`、包名和 CLI 名；
- 官方文档、官方 OAS、源代码、变更日志、许可或服务条款；
- 目标 Endpoint 范围，以及明确排除的范围；
- 服务器、区域、鉴权方式、OAuth flow/scope、速率限制和套餐差异；
- `official`、`observed` 或 `inferred` 的文档状态；
- 已知缺口、验证时间和无法确认的假设。

同一上游 API 的不兼容主版本通常建成独立集合和独立 `slug`。不要为了减少条目而把 v1、v2 合并，也不要因标题或描述变化修改已有稳定身份。

## 2. 建立证据账本

按以下优先级收集事实：官方机器可读契约 → 官方开发者文档/变更日志 → 官方源代码与测试 → 经授权的代表性响应 → 可复现的浏览器网络观测。搜索结果、博客和 SDK 猜测只能用于发现线索，不能单独批准结构或安全语义。

为关键事实记录：

| 事实 | 证据 URL/文件 | 状态 | 置信度 | 最后验证 |
| --- | --- | --- | --- | --- |
| Endpoint、参数、响应、鉴权、限制等 | 精确到页面或文件 | official/observed/inferred | high/medium/low | `YYYY-MM-DD` |

对于 `observed` 或 `inferred` 集合：

- 产品级填写 `documentationStatus`、`evidenceUrls`、`verifiedAt` 和双语 `stabilityNote`；
- 每个 Endpoint 填写匹配的 `x-pontx-documentation-status`、`x-pontx-evidence` 和 `x-pontx-verified-at`；
- 不把网页流量描述成官方开发者 API；
- 不收录登录、账户、交易、广告、写入或用户隐私数据 Endpoint；
- 没有足够证据时保留缺口或停止发布，不用“常见做法”补齐事实。

## 3. 编写规范中文 OpenAPI

使用仓库当前支持的 OpenAPI 版本；新集合优先沿用当前基线，不为追逐最新版本而制造工具兼容风险。`specs/<slug>/openapi.json` 是 `zh-CN` 结构源。

完整覆盖下列内容：

- `info`：准确的标题、说明、上游版本、许可、联系或问题入口；
- `servers`：真实 HTTPS 基址和必要变量，不放示例密钥、用户 ID 或私有主机；
- Endpoint：稳定且唯一的 `operationId`、简洁 `summary`、行为和边界清楚的 `description`、合理 tags；
- 参数：`name`、`in`、`required`、类型、格式、枚举、默认值、范围、长度、模式、单位、序列化方式和有效示例；
- 请求体：必填性、所有真实 media type、Schema、约束和代表性示例；
- 响应：所有有意义的成功与错误状态、media type、headers、分页/游标和完整 Schema；
- `components`：复用稳定 Schema、参数、响应和 security scheme，保留真实 `readOnly`/`writeOnly`、nullable、枚举和 discriminator 语义；
- 鉴权：准确描述 API Key/Bearer/Basic/OAuth2/OpenID Connect 位置、flow、URL 和 scope，并在根或 Endpoint 级正确引用；
- 生命周期：真实记录 `deprecated`、替代 Endpoint 和迁移说明，不静默删除历史能力；
- 示例：与 Schema、约束、media type 和业务语义一致，不使用真实凭证或个人数据。

把 HTTP 方法语义当作事实校验：GET/HEAD/OPTIONS/TRACE 应保持安全；PUT、DELETE 和安全方法具有幂等语义。上游若不符合规范，应如实记录风险，而不是擅自重设计线上行为。

错误格式以提供方事实为准。只有上游确实采用 RFC 9457 时才标记 `application/problem+json`；不要为了“标准化”而伪造并不存在的错误契约。

## 4. 生成结构相同的本地化规范

从中文结构基线复制出 `specs/<slug>/locales/<locale>/openapi.json`，只翻译仓库批准的 prose 节点。可以翻译标题、摘要、描述、OAuth scope 说明、枚举说明和批准的 Pontx prose 扩展；不得改变或重排：

- path、method、`operationId`、tag、参数名和 Schema/属性名；
- 类型、格式、约束、默认值、枚举值、示例和 `$ref`；
- server、安全声明、OAuth URL/scope key 和执行策略；
- 数组顺序或任何会影响生成代码/运行时的结构。

中文产品文案和非 prose 配置写入 `catalog/source.json`；英语产品文案写入 `catalog/locales/en-US.json`。不要在应用代码中重复 API 文案。

## 5. 注册目录与执行策略

为集合补全当前目录契约要求的身份、提供方、分类、证据、许可、服务器、鉴权、SDK 和展示元数据。

- 凭证只记录环境变量名；不读取、打印、持久化或提交真实值。
- `sdkStatus=published` 必须有可验证的已发布包和版本；否则使用真实的未发布状态。
- 仅根据证据启用代理执行。目标必须是 Endpoint 明确允许的 HTTPS 主机；拒绝任意 URL、私网/回环/链路本地/元数据地址、不安全重定向和危险 headers。
- 对写 Endpoint 保留 preview-first 和绑定原请求的显式确认边界。
- 对 `observed`/`inferred` 集合默认关闭执行；只有经验证的只读 Endpoint、精确主机 allowlist 和固定 headers 才可例外启用。

## 6. 更新完整性并运行质量门

计算规范文件的原始字节 SHA-256，并更新：

- `approvedSha256`；
- 每个 locale 的 `approvedLocaleSha256.<locale>`。

不要先改 hash 再假设文件正确；hash 是已审内容的封条。随后在元数据仓库运行：

```bash
node scripts/test-locales.mjs
node scripts/lint-locales.mjs
node scripts/build-catalog.mjs
node scripts/verify-specs.mjs
git diff --check
```

再次运行构建，确认生成结果稳定且没有新增差异。检查 `catalog/catalog.json` 中的新 API、Endpoint、请求、所有响应和 Schema 图均存在；不要手改生成文件。

## 7. 验证消费者路径

按照工作区 runbook，在相邻 `pontx-hub` 仓库先检查状态并读取其 README/package scripts，然后使用本地生成 catalog 运行相关测试、类型检查和生产构建。至少确认：

- 中英文产品、Endpoint 和 Schema 可发现且身份一致；
- SSR/搜索能够看到重要请求与响应字段；
- auth、服务器路径前缀、弃用和 SDK 状态未丢失；
- 允许执行的只读 Endpoint 先 preview，再做经用户授权的最小真实验证；
- 写 Endpoint、付费调用和需要用户数据的调用不因“验证规范”而自动执行。

如果改动只产生元数据而未改变目录契约，通常无需修改 Hub 代码；但 Hub 消费者验证仍是完成条件。

## 8. 交付报告

使用以下结构收尾：

```markdown
# API 集合构建结果
## 范围与身份
## 权威证据与未决项
## 覆盖情况（Endpoint / Schema / auth / locale）
## 执行与安全策略
## 修改文件
## 验证结果
## 风险、阻断项与后续动作
## Git / 发布状态
```

明确区分已验证事实、基于证据的推断和未知项。报告实际运行的命令及结果；不要把未执行的 Hub 测试、真实请求、提交、推送或部署写成已完成。
