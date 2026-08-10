---
name: pontx-api-collection-governance
description: Govern an existing Pontx API catalog through evidence freshness, OpenAPI completeness, compatibility, deprecation, localization parity, execution safety, SDK status, deterministic builds, scorecards, and staged remediation. Use this skill whenever a user asks to audit, govern, clean up, review quality, detect drift, standardize, deprecate, refresh, score, or batch-fix existing API/API 集合/接口集合 metadata in pontx-api-metadata, even when the request is simply “治理一下 API 集合”. Use pontx-api-collection-builder instead when the main task is onboarding one new API.
---

# Pontx API Collection Governance

持续治理已收录集合，让目录中的“存在”始终意味着：来源可追溯、契约足够完整、兼容性可解释、翻译同构、执行边界安全，并且消费者能稳定使用。治理不是统一格式的美化运动；优先处理会误导用户、破坏客户端或扩大执行风险的问题。

## 开始前

1. 定位 `pontx-api-metadata` 仓库，读取工作区 `AGENTS.md`、仓库 `README.md`、`CONTRIBUTING.md` 和相关本地说明。
2. 在任何编辑前运行 `git status --short`、`git branch --show-current`。记录并保护用户的既有工作树改动。
3. 完整阅读 [references/governance-model.md](references/governance-model.md)，使用其中的风险等级、评审周期、评分维度和报告模板。
4. 读取 `catalog/source.json`、所有 locale overlay、目标 OAS、构建/校验脚本和生成 catalog 契约。
5. 如果检查会影响目录字段、搜索输入或公共 API，读取工作区跨仓库契约与变更路由，并识别 Hub/CLI 消费者。

先判断授权模式：

- **审计/报告模式**：只读，不编辑源文件。需要验证可复现构建时，在 `mktemp -d` 创建的临时副本中运行会写文件的构建命令，再比较结果；不要在工作树中构建后擅自还原。
- **整改模式**：用户明确要求治理、清理、更新或修复时，可编辑范围内文件并验证。
- **发布模式**：提交、推送、PR、部署或生产执行必须有单独明确授权，不能从“治理”推断。

## 1. 建立组合清单

从 source 和生成 catalog 提取每个 API 的基线：

- `slug`、产品/提供方、上游版本、分类和 owner（如仓库有记录）；
- `documentationStatus`、`verifiedAt`、证据、许可/条款和稳定性说明；
- server、auth、proxy policy、SDK package/version/status；
- Endpoint 总数、HTTP 方法、deprecated 数、Schema 数、请求/响应 media type；
- locale 覆盖、hash 状态、生成目录状态；
- 最近变更、已知缺口和消费者依赖。

先报告分母：审计了多少 API、Endpoint、Schema 和 locale。没有明确覆盖范围的“全部通过”没有治理价值。

## 2. 先跑确定性质量门

在整改模式下于元数据仓库运行：

```bash
node scripts/test-locales.mjs
node scripts/lint-locales.mjs
node scripts/build-catalog.mjs
node scripts/verify-specs.mjs
git diff --check
```

在审计模式下对临时副本运行相同命令，并把临时生成的 `catalog/catalog.json` 与工作树版本按字节比较。检查失败时保留完整诊断，按 JSON Pointer、API、Endpoint 或 Schema 聚类，不只报告命令退出码。

确定性失败优先于人工抽查：hash 失配、locale 结构漂移、生成物过期、重复/缺失 `operationId`、非 HTTPS server 都是发布阻断项。

## 3. 核验来源新鲜度与漂移

治理涉及会变化的上游事实，因此优先查一手来源：官方 OAS、开发者文档、变更日志、状态页、官方仓库和包注册表。为每个集合比较：

- 上游版本、base URL、Endpoint 增删和 HTTP 方法；
- 参数 required/type/default/enum/constraint 与序列化；
- 请求/响应状态、media type、Schema 和错误模型；
- auth flow、scope、token URL、套餐/速率限制；
- deprecated、sunset、替代接口和迁移说明；
- license/terms、数据使用限制和归因要求；
- SDK 包实际是否存在、版本是否匹配已声明状态。

`verifiedAt` 不是更新即合格。只有重新核验了与风险相称的证据才更新时间。对于 `observed`/`inferred` Endpoint，逐项维护 evidence extension；网页还能打开不等于接口契约没有漂移。

真实请求只在用户授权范围内执行：优先无凭证、低成本、只读 Endpoint；先 preview。不要为了检查新鲜度调用写入、交易、登录、账户或用户数据接口。

## 4. 审查契约覆盖与语义

对每个 Endpoint 检查以下链路是否闭合：

```text
用户任务 → method/path → auth → parameter/request body → success/error response
       → Schema/property/constraint/example → 中文/英文 prose → 搜索与生成消费者
```

重点查找：

- `operationId` 缺失、重复、重命名或同一身份指向不同语义；
- path 参数和模板不匹配，required、nullable、默认值或 enum 不真实；
- 只记录一个 2xx 响应，遗漏有意义的错误、headers、media type 或分页；
- 内联 Schema 导致重复和漂移，或 `$ref`/组合/判别器关系错误；
- 示例违反 Schema、泄露秘密/PII，或把时间、ID、金额单位写错；
- 根级和 Endpoint 级 security 覆盖关系错误；
- mutating behavior 被建模为安全方法，或重试/幂等语义被误导；
- 重要字段只存在于原始 OAS，却在 catalog 编译和 Hub 搜索中丢失。

治理应忠实描述提供方实际 API。通用设计规范只能帮助发现风险，不能授权修改上游 wire contract。

## 5. 做兼容性与生命周期判定

对每项拟议修改同时评估：

- **source compatibility**：生成客户端是否还能编译；
- **wire compatibility**：旧客户端与新服务/新规范能否正确序列化和通信；
- **semantic compatibility**：行为、默认值、排序、分页或字段含义是否改变用户合理预期。

通常可加性变更：新增可选字段、独立 Endpoint、请求专用 enum 值，但仍需检查代码生成器和语义。

通常破坏性变更：删除/重命名 Endpoint、参数、Schema 或响应字段；增加 required 输入；收紧取值；改变类型、格式、默认行为、资源身份；把旧 slug/operationId 指向新主版本。

破坏性事实来自上游时：

1. 保留历史主版本或稳定身份；
2. 标记 deprecated，记录官方证据、替代能力和迁移说明；
3. 新主版本使用独立集合/身份；
4. 先让消费者兼容，再发布 producer metadata；
5. 删除前给出明确的审查窗口、使用证据和回滚路径。

不要用“看起来没人用”作为直接删除依据。

## 6. 审查安全与执行边界

按 API 和 Endpoint 风险审查：

- 凭证只有环境变量名，OAS、示例、生成 catalog、日志和 Git 历史中无真实值；
- auth scheme、位置、OAuth flow/scope 和匿名例外准确；
- proxy 只允许目录批准的 API/Endpoint/server，使用精确 HTTPS allowlist；
- 拒绝任意目标、私网/回环/链路本地/云元数据主机、不安全 redirect 和危险 headers；
- GET/HEAD 等只读语义与实际行为一致；mutation 始终 preview-first，并绑定未变化请求的显式确认；
- 未受支持的 web API 明确标注稳定性与证据，默认不执行；
- 资源消耗、批量遍历、敏感业务流、第三方数据和 PII 风险有约束说明。

发现 secret、越权目标或错误开启的 mutation 执行时，标为 `P0/BLOCKER`，先收紧暴露面再处理文案质量。不要在未获授权时主动轮换凭证或操作外部系统；报告需要谁执行什么动作。

## 7. 检查国际化、SDK 和消费者

- 运行 locale 结构比较，确认所有发布语言仅 prose 不同。
- 抽查产品、Endpoint、参数、响应、Schema/property、enum 和 auth 文案，确保不是空翻译或语义弱化。
- 验证 `sdkStatus` 与包注册表事实；未发布包不能展示安装命令。
- 检查编译 catalog 是否保留 localized Schema、所有响应和稳定资源 ID。
- 对契约或结构变化，在 Hub 运行相关测试、类型检查和生产构建；公共响应变化还要检查 `pontx-hub-cli` 类型与兼容性。
- 只有 UI/路由/SSR 受影响时才做浏览器桌面与 390px 检查；不要用截图替代契约测试。

## 8. 排定整改波次

按风险而非文件便利性排序：

1. **Wave 0 — 封堵**：secret、任意 URL/SSRF、错误 mutation、私有/用户数据、许可阻断。
2. **Wave 1 — 恢复可信**：hash/构建/locale 漂移、错误 server/auth、上游破坏性漂移、虚假 SDK 状态。
3. **Wave 2 — 补齐契约**：参数、请求、所有响应、Schema、错误、分页、约束和示例。
4. **Wave 3 — 提升可发现性**：双语 prose、标签、任务表达、Schema/property 描述和搜索输入。
5. **Wave 4 — 生命周期**：版本拆分、弃用、迁移、归档候选和复审日程。

每个整改项写清 owner、依赖、目标文件、验收命令、风险和回滚方式。跨仓库变更按 consumer-first 顺序执行。

## 9. 验证并报告

整改后重跑元数据全套质量门，再运行受影响消费者验证。检查工作树只含有意改动，并报告每个仓库的状态，不跨仓库一次性提交。

最终报告使用 [references/governance-model.md](references/governance-model.md) 中的模板，至少包含：

- 覆盖范围和审计时间；
- 组合级概览和逐 API 评分；
- P0/P1 阻断项及证据；
- upstream drift、兼容性和弃用判定；
- 整改波次、owner 与验收标准；
- 已运行验证、未运行验证和授权边界；
- Git/提交/推送/部署状态。

把事实、推断和建议分开。分数用于排序，不用于证明发布安全。
