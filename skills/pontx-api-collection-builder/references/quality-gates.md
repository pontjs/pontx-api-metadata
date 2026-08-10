# API 集合构建质量门

在写规范前读完本文件。按 G0 → G6 顺序检查；较早质量门失败时，不要用后续文档润色掩盖问题。

## 严重级别

- `BLOCKER`：可能造成错误契约、凭证/隐私泄露、越权执行、许可风险、不可复现构建或消费者破坏。发布前必须解决。
- `MAJOR`：重要 Endpoint、参数、响应、Schema、翻译或迁移信息缺失，明显降低搜索、生成或集成可靠性。通常应在同一变更解决。
- `MINOR`：不影响契约正确性的表达、示例或组织改进。可以记录后续工作，但不能把多个 minor 当作“高质量”。

分数不能抵消 blocker。一份 95 分但包含任意 blocker 的集合仍不可发布。

## G0：授权、来源与许可

- 上游身份和版本可唯一确认。
- 有稳定的一手证据；每个非官方 Endpoint 有精确证据和验证日期。
- attribution、license/terms 和再分发边界已审查。
- 未授权抓取、登录后私有流量、用户数据、真实凭证和内部主机均不进入仓库。
- 对无法确认的事实显式保留未知，不通过猜测补齐。

任一项不满足即为 `BLOCKER`。

## G1：稳定身份与版本

- `slug`、`operationId`、Schema 名和资源路径在编辑性变化中保持稳定。
- 不兼容的主版本分离；同一主版本内的变更审查 source、wire 和 semantic compatibility。
- 重命名按“删除旧身份 + 添加新身份”对待，不能伪装成无害编辑。
- 已弃用能力仍保留可见标记、替代方案和迁移说明。

参考 [Google AIP-180 Backwards compatibility](https://google.aip.dev/180) 和 [AIP-185 API Versioning](https://google.aip.dev/185)。它们是兼容性思考框架；上游真实契约仍是本集合的事实来源。

## G2：OpenAPI 契约完整性

对每个 Endpoint 检查：

- 唯一、稳定、适合代码生成的 `operationId`；
- path 参数必填且模板一一对应；
- 参数/请求体位置、序列化、类型、格式、约束、默认值、枚举与示例完整；
- 每个真实成功/错误状态、media type、response headers 和 Schema 均有记录；
- 分页、游标、异步状态、速率限制、重试条件和错误恢复有证据时均被表达；
- `$ref` 可解析，无孤儿或循环误建模；Schema 的 required、nullable、readOnly/writeOnly 和组合语义准确；
- 安全要求与 `components.securitySchemes` 对齐；公共 Endpoint 不被误标为必需鉴权，受保护 Endpoint 不被误标为匿名；
- 示例不只是“看起来合理”，而是能通过对应 Schema 和约束。

OpenAPI 的规范基线见 [OpenAPI Specification 3.1.2](https://spec.openapis.org/oas/v3.1.2.html)。仓库验证器通过不代表规范语义自动正确；结构校验、语义审查和证据核对缺一不可。

## G3：HTTP 与执行安全

- 方法与真实副作用一致；不要把 mutation 建模为安全读取。
- 自动验证只覆盖经授权的低成本只读请求；写入、删除、付费和用户数据调用需要独立明确授权。
- 凭证只以环境变量名建模，示例和日志不包含值。
- 代理目标采用 Endpoint 级 HTTPS allowlist，不接受调用者提供的任意目标。
- 审核 OWASP API 风险，尤其是对象/属性级授权、资源消耗、敏感业务流、SSRF、安全配置和不安全的第三方 API 消费。
- 错误响应避免泄露堆栈、内部地址、令牌或隐私数据。

方法安全性和幂等性以 [RFC 9110 HTTP Semantics](https://www.rfc-editor.org/rfc/rfc9110.html#name-common-method-properties) 为基线；API 风险清单见 [OWASP API Security Top 10 2023](https://owasp.org/API-Security/editions/2023/en/0x11-t10/)。若提供方实际使用标准问题详情，按 [RFC 9457](https://www.rfc-editor.org/rfc/rfc9457.html) 建模，不要凭空替换其错误格式。

## G4：国际化一致性

- `zh-CN` 是唯一结构基线；locale 使用 BCP 47 标识。
- localized OAS 只改 approved prose，结构、顺序、示例、安全和执行策略完全相同。
- 产品、Endpoint、参数、响应、Schema/property、enum 和 auth prose 在所有发布 locale 中有用且完整。
- 翻译保留 API 专有名词、约束和强弱语气，不把 required、may、deprecated 等语义翻错。
- 运行 locale 单元测试和 JSON Pointer 级差异检查。

结构漂移是 `BLOCKER`；重要 prose 缺失是 `MAJOR`。

## G5：完整性与可复现构建

- approved hash 与最终审阅字节一致。
- `catalog/catalog.json` 只由编译器生成并提交。
- locale test/lint、catalog build、spec verify 和 `git diff --check` 全部通过。
- 连续两次构建结果一致。
- 生成 catalog 能追溯到 source entry 与 OAS，且数量、身份和图关系合理。

hash 失配、生成物过期或非确定性构建均为 `BLOCKER`。

## G6：消费者就绪

- Hub 能在每个 locale 加载、验证和搜索该 API。
- Endpoint 请求体、所有响应和 Schema 图可在服务端 HTML/资源 API 中发现。
- server path prefix、auth、SDK 状态、deprecated 和稳定 ID 在转换中未丢失。
- Hub 测试、类型检查和生产构建通过；必要时检查桌面和 390px 移动布局。
- 目录字段变化遵循“消费者兼容旧/新 → producer 发新数据”的顺序。

消费者不接受新负载是 `BLOCKER`；仅展示质量不足通常为 `MAJOR`。

## 发布判定

只有同时满足以下条件才称为“高质量完成”：

1. G0–G6 无 blocker；
2. 所有 major 已解决，或有用户明确接受且不影响准确性/安全性的限界说明；
3. 工作树只包含有意改动；
4. 证据、验证命令、风险与未执行步骤已在交付报告中披露；
5. 未在缺少授权时提交、推送、发布、部署或执行有副作用的请求。
