---
name: pontx-api-collection-builder
description: >-
  Onboard or substantially extend a Pontx API product through the complete production lifecycle: authoritative evidence research, complete bilingual PontxSpec, isolated product/SDK metadata, generated @pontx/{slug} SDK plus pontx-{slug} CLI, concise evidence-backed pontx-{slug} product Skill, safety and package validation, product-index admission, Hub Preview/Production rollout, universal CLI and semantic-search discovery, and AI-assistant request preparation/execution verification. Use this skill whenever a user asks to add, onboard, curate, import, reconstruct, publish, launch, or “完整收录/上线” an API/API 集合/接口集合/开放平台 for Pontx Hub, even if they mention only metadata or “收录这个 API”; do not stop at imported OAS evidence, a PontxSpec file, local SDK release candidate, a release request, PR, or Preview deployment. Do not use it merely to call an API that is already cataloged.
---

# Pontx API Collection Builder

把一个 API 产品从候选证据推进到生产可发现、可集成、可安全调用的完整 Pontx 产品。PontxSpec 是 metadata、SDK、产品 CLI、Hub、统一 CLI、语义搜索和助手的唯一规范；OAS 只允许作为一次性导入格式或上游证据。

## 完成定义

只有以下结果同时成立，才报告“产品上线完成”：

1. 产品完整边界内的 API 契约有权威证据、许可/再分发依据、双语内容和明确安全策略；
2. `@pontx/<slug>` SDK 与同包 `pontx-<slug>` CLI 从该契约生成并通过标准质量门；若要求发布，必须经 operator 的独立 npm 发布流程与 registry 复验，不能由 metadata CI 或普通贡献者代发；
3. `pontx-<slug>` 产品 Skill 只表达提供商特有流程、最佳实践、风险和 few-shot，事实由官方证据支持且不复制 PontxSpec；其独立 Agent 审核、registry、skills.sh 安装和 ClawHub 发布门通过；
4. metadata 绑定真实 registry 版本、SDK 源 commit 和 CI 证据，经 Preview 审查后进入 Production；
5. 生产网站、公共 Hub API、统一 `pontx-hub` CLI、产品 Skill、非品牌中英文语义查询和 AI 助手都能发现该产品；
6. 助手能把自然语言任务变成 catalog-approved 请求，经既有 preview/credential/confirmation 边界完成至少一条获准的安全读取调用。若许可或代理策略不允许任何受控调用，产品可交付文档和本地 SDK/CLI，但不能把本 skill 的“完整助手调用闭环”标为通过。

读取并执行 [references/quality-gates.md](references/quality-gates.md) 的 G0–G10；进入 SDK、发包或上线阶段前，再完整读取 [references/release-and-launch.md](references/release-and-launch.md)。早期门失败时继续修复或明确阻断，不用后续页面、包或部署掩盖问题。

## 开始前

1. 定位工作区和 `pontx-api-metadata`，读取根 `AGENTS.md`、跨仓库架构/契约/变更路由/发布 runbook、动态 `api-hub-plan.md`、目标仓库 README/package scripts/本地说明。
2. 识别实际涉及的独立仓库：metadata、API 专属 SDK、`pontx` 生成/runtime（仅有通用缺口时）、`pontx-hub`，以及公共合同变化时的 `pontx-hub-cli`。每个仓库编辑前分别运行 `git status --short`、当前分支和相关近期提交检查，保留既有改动。
3. 创建或更新一个产品 launch ledger，记录阶段、证据、阻断项、产物 commit/version、验证命令、CI/deployment 和生产验收结果。候选账本、计划或产品专属 provenance 文件存在时复用，不另建冲突事实源。
4. 以当前仓库脚本和公共契约为准，不照抄旧产品的字段、包结构、Controller 路径或发布命令。

只读审计不授权修改或外部发布。用户要求“添加、构建、补充、收录、发布、上线”时，按工作区已有的实现与发布授权推进完整闭环，不在每个正常阶段重复停下询问。提供方真实 mutation、付费调用、用户数据调用和新凭证使用始终需要该次请求对应的明确批准；不得把产品上线授权解释成业务写入授权。

## 阶段 0：固定产品边界与上线账本

先记录：

- 提供方、产品、上游主版本、稳定 `slug`、`@pontx/<slug>` 和 `pontx-<slug>`；
- 完整产品协议面与 Endpoint 范围，包括 REST、SSE、WebSocket、webhook/callback、异步任务、文件和二进制；
- 官方规范/文档/源码/变更日志、条款/许可/attribution、价格/套餐/速率限制；
- server/region、auth/OAuth flow/scope、凭证环境变量、敏感数据和 mutation 分类；
- `official`、`observed`、`inferred` 状态、验证日期、未知项和每个准入门状态；
- metadata、SDK、Preview、Production、生产验收的当前状态与下一动作。

同一上游 API 的不兼容主版本通常使用独立集合。完整产品含 Pontx 尚未支持的必要协议时，整集暂缓，不通过删除 SSE/WebSocket 等能力伪装完整。

## 阶段 1：迭代建立权威、完整契约

先用公开互联网搜索广泛发现官方入口、机器契约、变更记录、SDK 源码、条款、错误/限制和已知差异，再按以下优先级批准事实：官方不可变机器契约 → 官方开发者文档/变更日志 → 官方源码与测试 → 经授权的代表性响应 → 可复现的浏览器网络观测。搜索摘要、博客和第三方 SDK 只用于找到线索，不能单独批准结构、许可或安全语义。

维护事实级证据账本，精确关联 Endpoint、参数、请求、响应、Schema、auth、限制、协议与版本。对每一轮：

1. 对比所有权威来源并列出冲突、遗漏和版本漂移；
2. 在安全、低成本、许可允许且已获调用授权时，用最小只读请求验证 wire 事实；未知响应不得靠猜测补全；
3. 量化 Endpoint/Schema/response/status/example/prose 覆盖与静态质量；
4. 修复 metadata 后重新生成 SDK/CLI，用类型、请求构造和 E2E 暴露下一轮缺口；
5. 重复，直到 G0–G6 无 blocker/major，或记录不能继续的外部证据/许可/协议阻断。

对 `observed`/`inferred` 内容保留精确证据和日期，不冒充官方 API；登录、账户、交易、用户隐私、内部主机或无授权再分发的接口不得进入正式产品。

## 阶段 2：构建双语分级 metadata

为产品创建以下隔离目录，不能把任一产品的详情回填到集中式 JSON：

```text
catalog/products.json
products/<slug>/product.json
products/<slug>/spec.pontx.json
products/<slug>/sdk.json
products/<slug>/locales/<locale>/{product.json,spec.pontx.json}
products/<slug>/sources/{provenance.json,openapi.json?}
```

`catalog/products.json` 只能有格式版本、默认 locale、发布 locale 和有序正式 slug，绝不含产品详情、Endpoint、Schema、SDK 或质量字段。`product.json` 只保存概要、展示、法律归因、定价、凭证指引、执行策略和 Quick Start；server、安全方案、API、Schema 和请求示例只归 `spec.pontx.json`。`sdk.json` 只保存 npm/CLI、contract、coverage、示例、质量证据及规范路径/hash/commit。候选只能放在 `candidates/<slug>/`，只有正式 slug 才能进入 Hub。`sources/openapi.json` 可按许可保留，但构建、SDK 生成、Hub 同步、搜索和验证不得读取它；不得创建 `catalog/source.json`、`catalog/catalog.json` 或集中 locale catalog。

PontxSpec 必须显式声明 `pontx` 与 `style`，完整表达稳定 `operationId`、显式 tags、参数和约束、所有请求/响应媒体、完整 Schema 图、HTTPS server（如适用）、安全方案、请求示例及 Endpoint 证据/执行元数据。只有 `RESTFul` Endpoint 强制 `method/path`；RPC 等其他 style 不伪造 HTTP 字段。新增非 REST 产品时，至少验证它能被加载、locale 同构校验、Hub 同步和搜索索引；没有专用执行适配器时，Hub 必须明确禁用 Playground，而不是把它转换成伪 HTTP 请求。

若权威输入是 OAS2/OAS3，使用正式 `@pontx/spec importOpenAPI` 一次性导入，逐 Endpoint/Schema 对比 operationId、显式 tags、约束、全部响应、媒体类型、安全和 `x-pontx-*`，之后构建与维护不得读取 OAS。locale PontxSpec 只能翻译批准的 prose；标识、顺序、约束、示例、安全和执行策略必须与中文源一致。

先审最终 PontxSpec 字节，再把其原始字节 SHA-256、规范路径和包含该字节的 metadata commit 写入 `sdk.json`。运行 `pnpm test`、`pnpm validate` 和 diff 检查；检查分级源中产品、Endpoint、请求、每个响应与 Schema 图数量和身份。不要以“生成 Catalog”作为验证步骤：层级验证器必须直接验证清单、文件、hash、同构和隔离性。

### 产品 Skill：只写 metadata 之外的有用增量

使用 `skills/products/AUTHORING_PROMPT.md`，为正式 slug 创建 `pontx-<slug>`。安装目录只放英文 `SKILL.md` 和确有必要的单个 reference；manifest、官方 claim 证据和 2–3 个冒烟任务分别进入 `skills/manifests/`、`skills/evidence/`、`skills/evals/`。Skill 必须通过 `pontx-hub search/show/sdk` 获取当前 Endpoint、Schema、auth 和包事实，突出 `@pontx/<slug>`、产品 CLI 与统一 Hub Skill 的分工，不复制清单或固定版本。

先保持 `draft`；官方来源与当前 product/PontxSpec/SDK 任何冲突都回流修复事实源，不能让 Skill 自选一个版本。生成确定性 `skills/registry.json`，完成静态预算/claim/版本/hash 门和全新只读 Codex 审核后，才转为 `published` 并验证 skills.sh 干净安装、ClawHub exact SemVer 发布与 Hub same-commit 消费。

## 阶段 3：从契约构建 SDK 与产品 CLI

在独立、可发布的产品 SDK 仓库生成 `@pontx/<slug>`；可执行文件 `pontx-<slug>` 与 SDK 在同一 npm 包发布。不要创建或更新冻结的 `@pontx/api-*` 包，也不要把产品 CLI 混进 `pontx-hub-cli`。

包必须：

- 固定规范/provenance、上游版本/hash/license/notice，生成物可复现并有 drift check；
- 将固定 metadata commit 的 `products/<slug>/spec.pontx.json` 原始字节镜像到 SDK 仓库；CI 必须重算 SHA-256，并拒绝独立编辑镜像或任何 canonical OAS 副本；
- 使用已发布的精确 Pontx runtime/generator 版本和冻结 lockfile；
- 输出 Node 支持矩阵要求的 ESM、CommonJS、声明和 CLI；
- 只从环境/调用方配置读取凭证并始终脱敏；
- 保留 server path、auth、serialization、multipart/binary、错误和真实 Controller 映射；Controller 只来自 PontxSpec 显式 tags，未 tagged Endpoint 保持 client 根调用；
- 对 mutation 实施 preview-first、绑定未变请求且短期有效的确认；不得把上线测试变成真实 mutation；
- 只打包运行所需代码、types、license/notices 和 CLI 产物，不携带凭证、缓存、测试数据或无权再分发的上游内容。

执行 `release-and-launch.md` 的标准验证。若生成、类型检查、SDK/CLI E2E 或真实只读 probe 暴露契约问题，优先修 canonical PontxSpec 或通用 generator 并重生成，不手改生成代码掩盖问题；metadata、SDK/CLI 和测试必须再次整轮通过。

## 阶段 4：安全发包与 registry 复验

在发布前固定 SDK 源 commit，并要求目标 Node 矩阵 CI 全绿。`prepublishOnly` 或等价 release gate 必须拒绝：未发布的依赖、范围依赖、本地 `link:`/`file:`/`workspace:`、override、缺失/漂移 lockfile、镜像规范 hash 或生成漂移、失败/跳过测试、缺失 notice 或意外包文件。

确认 npm 身份/scope、包名和目标版本，检查版本尚未占用，再由 operator 按独立 SDK 仓库的 release 流程发布 public 包；metadata CI、Hub CI 和普通贡献者绝不能代发。发布后不要只看 `npm publish` 退出码：从 registry 查询精确版本，在全新临时目录安装，验证 ESM/CJS/types、产品 CLI `--help`、代表性 preview、凭证脱敏、mutation guard，并在许可和授权允许时完成一条安全只读调用。记录 package/version、完整源 commit、CI run、pack 摘要和 registry 复验。

只有 registry 复验全部通过，metadata 才能在该产品的 `sdk.json` 设置 `package.status: "published"`；发包失败或版本事实不一致时继续修复，不能先标 published。

## 阶段 5：回写 metadata 并分阶段上线

把实际 npm 版本、包/CLI 名、源 commit、CI URL、Node 矩阵、unit/E2E 结果和验证日期回写 metadata 的当前质量证据字段；SDK/CLI 示例必须与 registry 产物的真实导出、Controller 和参数一致。

重新运行 metadata 全部门和 Hub 本地消费者门，至少包括 Hub tests、typecheck、production build、SDK registry verification，以及该产品的搜索、SSR、Schema、snippet 和 AI tool eval；RESTFul 产品再验证 Playground/preview，其他 style 没有执行适配器时验证明确的 disabled 状态。Hub 必须从同一精确 metadata commit 的所有产品分片加载，任一文件/校验失败都中止构建。新产品通常不需要发布新版统一 Hub CLI；只有公共 Hub HTTP/CLI 合同变化时才按 consumer-first 顺序修改并发布 `@pontx/hub-cli`。

按仓库 runbook：

1. 独立提交/推送 SDK 与必要消费者，等待 CI；
2. metadata 进入 `develop`，等待 Preview Ready，并用 Agent Browser 检查中英文完整用户路径；
3. Preview 无 blocker 后提升到 `main`，等待 Production Ready；
4. 不把 PR、source fix、local build、npm publish 或 Preview 当成完成。

跨仓库提交、依赖发布和部署顺序以当前工作区 runbook 为准；每个仓库保持独立 commit/status。

## 阶段 6：生产产品验收

针对最终 registry artifact 和最终生产 catalog 执行同一份矩阵：

- **网站/API**：中英文 API/Endpoint/Schema/SDK 页面、SSR、canonical/hreflang/sitemap、身份、auth、完整请求/响应和安全状态正确；
- **精确发现**：生产 Hub API 和 freshly installed `pontx-hub` 能以 stable ID list/search/show/sdk/preview 该产品；
- **语义发现**：至少一条中文和一条英文非品牌任务查询能在要求的 top-k 找到正确 API/Endpoint/Schema，并返回 `strategy`、`semanticVersion`、`match.mode`/`match.fields`；把这些查询加入持久化 relevance eval；
- **产品包**：fresh install 的 `@pontx/<slug>` 与 `pontx-<slug>` 对 registry 版本再次通过代表性 SDK/CLI 路径；
- **助手**：持久化 deterministic eval 覆盖 search → resource/auth → SDK/CLI → prepare；生产登录态助手用自然语言选中该产品，模型不接触凭证，客户端注入 session-only credential，经 preview 后完成一条获准的安全只读调用并校验非空业务响应；mutation 只检查确认边界，不执行；
- **安全**：任意 URL、未批准 server、私网/回环、危险 header、凭证日志和未确认 mutation 仍被拒绝。

使用浏览器验证真实生产用户路径和控制台/网络状态，不能只用直接 HTTP 替代 UI。失败必须回到 owning repository 修复并重新走受影响门；生产验收全部通过后，更新 launch ledger 和 `api-hub-plan.md`。

## 持续推进与阻断规则

- 任务默认终点是阶段 6，不在“metadata 已写”“SDK RC 可 build”“npm 已发”“Preview 可见”处主动结束。
- 只有权威证据、许可/书面授权、必要协议能力、凭证/权限、registry/CI/部署外部拒绝等真实 blocker 才能中止。先穷尽安全恢复步骤，再记录失败阶段、已完成证据、确切外部错误和解除条件。
- 不用“后续可做”隐藏本次范围内仍未完成的发布或生产验收；launch ledger 必须始终显示当前阶段和下一动作。
- 上线后将证据 freshness、上游 drift、SDK registry install、语义 relevance 和安全调用 canary 交给治理/巡检流程，避免产品再次退化。

## 交付报告

按以下结构收尾：

```markdown
# API 产品上线结果
## 结论（complete / blocked）
## 阶段矩阵（contract / metadata / SDK+CLI / npm / Preview / Production / discovery / assistant call）
## 产品边界、权威证据与许可
## 契约覆盖与质量迭代
## SDK/CLI 包、版本、commit 与 registry 证据
## Metadata / Hub / 统一 CLI / 语义搜索 / 助手验证
## 安全、真实调用与未执行 mutation
## 各仓库 commit、CI、部署 URL/ID
## 阻断项、解除条件或持续治理
```

明确区分事实、推断和未知。只报告实际执行且有证据的命令、发布、部署和生产调用；未通过阶段不得写成完成。
