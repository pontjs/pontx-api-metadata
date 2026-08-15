---
name: pontx-api-collection-governance
description: Govern existing Pontx API products through evidence freshness, PontxSpec completeness, compatibility, deprecation, locale parity, execution safety, SDK evidence, hierarchical product isolation, and staged remediation. Use when asked to audit, govern, clean up, detect drift, standardize, deprecate, refresh, score, or batch-fix pontx-api-metadata, including requests that mention catalog.json/source.json/OpenAPI migration or metadata directory restructuring. Use the builder skill for onboarding one new API.
---

# Pontx API Collection Governance

持续治理正式产品，使目录中的“存在”始终意味着来源可追溯、PontxSpec 完整、身份稳定、翻译同构、执行边界安全、SDK 证据真实且消费者可复现。

## 开始前

1. 读取工作区和仓库说明、[references/governance-model.md](references/governance-model.md)。
2. 运行 `git status --short`、`git branch --show-current`，保护既有改动。
3. 从 `catalog/products.json` 确定正式范围，再按产品读取 `product.json`、`spec.pontx.json`、`sdk.json` 和 locale；`sources/` 只用于证据核对。确认不存在 `catalog/source.json`、`catalog/catalog.json`、集中 locale catalog，且 `candidates/<slug>/` 未被正式清单引用。
4. 审计请求保持只读；明确整改请求才编辑。外部发布/执行遵循工作区授权边界。

## 1. 建立分母与组合清单

报告 API、Endpoint、Schema、locale 总数，并为每个产品记录 slug、提供方、style、证据/许可/验证日期、服务器/安全、执行策略、SDK 包/版本/覆盖/规范路径 + SHA + metadata commit、deprecated 数和消费者依赖。明确报告产品清单只承担索引而非详情，并检查 `product.json`、`spec.pontx.json`、`sdk.json` 的字段归属没有串位。

同时检查隔离性：正式目录必须与产品 slug 清单完全一致；候选不得进入正式清单；产品详情、Endpoint、Schema 和 SDK 质量不得泄漏进 `catalog/products.json`。

## 2. 先跑确定性质量门

```bash
pnpm test
pnpm validate
git diff --check
```

优先处理 Pontx 版本/style、locale 结构、非 HTTPS server、重复/缺失 operationId、SDK hash/commit/质量、Quick Start 和候选隔离错误。仓库不生成聚合 catalog，因此不存在“重建 catalog”步骤。

## 3. 核验一手证据与漂移

使用官方机器契约、开发者文档、变更日志、状态页、官方仓库和 registry。比较 Endpoint 增删、参数/约束、全部响应和媒体类型、Schema、安全、服务器、deprecated、许可/条款、套餐和真实 npm 版本。

OAS 证据可以帮助发现漂移，但整改结果必须写入 PontxSpec；不得重新建立 OAS→构建、SDK 生成、Hub 同步或搜索的运行时依赖。`sources/openapi.json` 只可作为许可允许的证据。更新时间只在完成与风险相称的证据复核后变更。

## 4. 审查协议闭环

```text
用户任务 → style/API key/operationId → 参数/请求 → 全部响应
       → Schema/约束/示例 → 安全/服务器/执行策略 → locale → Hub/SDK
```

RESTFul 额外核验 method/path 和 HTTP 语义。RPC/GraphQL 等其他 style 不得因缺少 method/path 被判失败；它们仍须通过加载、稳定 ID、locale 同构、Hub 同步和搜索索引，并在无适配器时明确禁用 HTTP Playground。

重点检查显式 tags、根级未标记 Endpoint、参数模板、required/nullable/default/enum、所有响应、组合/判别器、示例、security 覆盖与敏感数据。事实来自上游，不用通用规范擅自重设计 wire contract。

## 5. 兼容性与生命周期

分别评估 source、wire、semantic compatibility。删除/重命名身份、增加 required、收紧范围、改变类型/默认/分页/服务器/安全通常是破坏性变更。保留历史主版本和 deprecated 信息；consumer 先兼容，再发布 producer。

## 6. 安全、locale、SDK 与消费者

- 凭证仅为环境变量名/指引，安全方案在 PontxSpec，值永不持久化。
- 代理只允许 PontxSpec 批准的 HTTPS API/Endpoint/server；mutation preview-first 并显式确认。
- locale 只改 prose，示例/安全/服务器/执行语义不可变。
- SDK published 状态必须匹配 registry、source commit、CI、Node 矩阵和 E2E；full/partial 覆盖准确；规范路径/hash/metadata commit 一致。SDK 仓库只能镜像固定 commit 的 canonical `spec.pontx.json`，CI 要重算原始字节 SHA-256 并拒绝独立修改或 canonical OAS 副本。
- Hub 从同一精确 commit 同步产品文件，公共 API/URL/search ID 保持兼容。

## 7. 整改波次

1. Wave 0：秘密、任意 URL/SSRF、错误 mutation、私有/用户数据、许可阻断。
2. Wave 1：协议/style/locale/hash/服务器/安全/SDK 事实错误。
3. Wave 2：参数、请求、全部响应、Schema、约束、示例和证据缺口。
4. Wave 3：双语 prose、显式标签、任务表达和搜索质量。
5. Wave 4：版本、弃用、迁移、候选与复审日程。

## 8. 报告

按治理模型报告覆盖范围、P0–P3、逐产品评分、上游漂移、兼容性、整改波次、已运行/未运行验证、外部调用以及每个仓库的 Git/部署状态。事实、推断和建议分开。
