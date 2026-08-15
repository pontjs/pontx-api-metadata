# API 集合治理模型

本模型给出默认政策。仓库或用户若有更严格的已批准政策，以更严格者为准；若业务风险明显较低或较高，可以调整周期和权重，但必须记录理由。

## 1. 风险等级

| 等级 | 含义 | 示例 | 处理目标 |
| --- | --- | --- | --- |
| P0 / BLOCKER | 可能立即造成秘密、隐私、越权执行、SSRF、许可或大面积错误契约 | 真实 token、任意代理 URL、交易 Endpoint 被当作读取、PontxSpec hash 无法追溯 | 先封堵，不发布 |
| P1 / MAJOR | 高概率破坏消费者或严重误导集成 | server/auth 漂移、required/type 错误、主版本混入旧 slug、结构翻译漂移 | 当前整改波次解决 |
| P2 | 影响完整性、可发现性或维护成本，但有可靠规避路径 | 缺错误 Schema、分页说明、重要属性 prose | 排入近期治理 |
| P3 | 非契约性表达或组织问题 | 标签不理想、示例可以更代表性 | 机会性改进 |

任何 P0 都使发布判定为失败；P1 未处理时只能在明确的限界接受下继续，且不得涉及准确性、安全或兼容性核心。

## 2. 默认复审周期

| 集合类型 | 默认最大间隔 | 提前复审触发器 |
| --- | ---: | --- |
| 官方、稳定、只读、无需鉴权 | 180 天 | 上游 release、server/terms 变化、用户报告 |
| 官方、含鉴权/写入/付费/快速演进 | 90 天 | auth/scope、套餐、deprecated、breaking release |
| observed / inferred 公共只读 web API | 30 天 | 页面部署、流量形态、条款或 host 变化 |
| deprecated 或已宣布 sunset | 30 天 | 迁移期限、替代能力、下线事件 |

这些周期是治理默认值，不是行业规范。`verifiedAt` 只有在相关证据被实际复核后才能更新；只运行本地 linter 不算上游复审。

## 3. 评分卡

先判 blocker，再计分。每个维度按 0–5 评分，乘以权重后折算到 100：

| 维度 | 权重 | 5 分条件 |
| --- | ---: | --- |
| 来源与新鲜度 | 20 | 一手证据完整、分类真实、在周期内、许可/归因清楚 |
| 契约覆盖 | 25 | Endpoint、参数、请求、所有响应、Schema、约束和示例完整准确 |
| 安全与执行 | 20 | auth 真实、无秘密、精确 allowlist、mutation 确认、风险与数据边界清楚 |
| 兼容性与生命周期 | 15 | 稳定身份、版本分离、弃用/迁移完整、无未说明 breaking drift |
| 国际化 | 10 | 所有 locale 同构，关键 prose 完整且语义一致 |
| 消费者与可复现性 | 10 | 分级加载和 hash 确定，Hub/CLI 接受，SDK 状态真实，关键资源可发现 |

计算：`总分 = Σ(维度分 / 5 × 权重)`。

状态建议：

- `Ready`：无 P0/P1，且 ≥ 90；
- `Ready with follow-ups`：无 P0/P1，80–89；
- `Needs remediation`：60–79，或存在已限界 P1；
- `Blocked`：存在 P0，或 < 60。

不要把阈值包装成客观真理。报告原始发现和证据，让读者能独立判断。

## 4. 漂移分类

| 漂移 | 常见影响 | 默认判定 |
| --- | --- | --- |
| 新增可选输入/独立 Endpoint | 通常加性，但生成器和默认行为仍需检查 | P2 或 P3 |
| 新增响应字段/enum 值 | 旧客户端可能严格反序列化或 exhaustive match | P1/P2 |
| 删除/重命名身份 | source 与生成代码破坏 | P1 |
| 增加 required、收紧范围、改变 type/format | wire/source 破坏 | P1 |
| 改变默认、排序、分页、字段含义 | semantic 破坏 | P1 |
| server/auth/scope 变化 | 调用失败或越权风险 | P0/P1 |
| license/terms/数据权限变化 | 合规风险 | P0/P1 |
| deprecated/sunset | 迁移和时间风险 | P1/P2 |

兼容性审查参考 [Google AIP-180](https://google.aip.dev/180) 的 source/wire/semantic 三层模型和 [AIP-185](https://google.aip.dev/185) 的版本/弃用思路。不要照搬其产品特有期限；Pontx 的实际处理由上游承诺、用户风险和仓库政策共同决定。

## 5. 标准与安全基线

- PontxSpec 2.1：metadata、Hub、CLI 与 SDK 的唯一规范；OAS 只作为一次性导入格式或证据。
- [OpenAPI Specification 3.1.2](https://spec.openapis.org/oas/v3.1.2.html)：审核 REST 上游证据时使用的对象语义基线。
- [RFC 9110 HTTP Semantics](https://www.rfc-editor.org/rfc/rfc9110.html#name-methods)：safe、idempotent、method 和 status 语义。
- [RFC 9457 Problem Details](https://www.rfc-editor.org/rfc/rfc9457.html)：仅在上游采用时核验标准错误结构，并防止错误详情泄露内部信息。
- [OWASP API Security Top 10 2023](https://owasp.org/API-Security/editions/2023/en/0x11-t10/)：授权、资源消耗、敏感业务流、SSRF、安全配置、库存与第三方 API 风险。

这些标准用于发现和描述风险。Pontx 是上游契约的策展者，不能把与上游不一致的“理想设计”写成事实。

## 6. 治理报告模板

```markdown
# API 集合治理报告

## 执行摘要
- 模式：审计 / 整改
- 范围：N APIs / N Endpoints / N Schemas / locales
- 结论：Ready / Ready with follow-ups / Needs remediation / Blocked
- P0 / P1 / P2 / P3 数量

## 组合评分
| API | 文档状态 | verifiedAt | 总分 | 状态 | P0/P1 摘要 |
| --- | --- | --- | ---: | --- | --- |

## 关键发现
### [P0/P1] 标题
- 事实：
- 证据：
- 影响：
- 建议：
- owner / 依赖 / 验收：

## 上游漂移与兼容性
| API / Endpoint | 漂移 | source/wire/semantic 影响 | 处置 |
| --- | --- | --- | --- |

## 证据新鲜度与下次复审
| API | 状态 | 最近核验 | 默认周期 | 下次复审 | 触发器 |
| --- | --- | --- | --- | --- | --- |

## 整改波次
### Wave 0 — 封堵
### Wave 1 — 恢复可信
### Wave 2 — 补齐契约
### Wave 3 — 提升可发现性
### Wave 4 — 生命周期

## 验证与授权边界
- 已运行：
- 未运行：
- 外部调用：
- Git / 发布状态：
```
