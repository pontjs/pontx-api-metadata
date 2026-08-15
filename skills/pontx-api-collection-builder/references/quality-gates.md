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

## G2：PontxSpec 契约完整性

对每个 Endpoint 检查：

- 唯一、稳定、适合代码生成的 `operationId`；
- path 参数必填且模板一一对应；
- 参数/请求体位置、序列化、类型、格式、约束、默认值、枚举与示例完整；
- 每个真实成功/错误状态、media type、response headers 和 Schema 均有记录；
- 分页、游标、异步状态、速率限制、重试条件和错误恢复有证据时均被表达；
- `$ref` 可解析，无孤儿或循环误建模；Schema 的 required、nullable、readOnly/writeOnly 和组合语义准确；
- 安全要求与 `components.securitySchemes` 对齐；公共 Endpoint 不被误标为必需鉴权，受保护 Endpoint 不被误标为匿名；
- 示例不只是“看起来合理”，而是能通过对应 Schema 和约束。

PontxSpec 必须显式声明 `pontx` 与 `style`；只有 RESTFul 强制 `method/path`。若上游是 OAS2/OAS3，只能用正式导入器一次性转换并逐项审查，后续构建不得读取 OAS。仓库验证器通过不代表规范语义自动正确；结构校验、语义审查和证据核对缺一不可。

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
- localized PontxSpec 只改 approved prose，结构、顺序、示例、安全和执行策略完全相同。
- 产品、Endpoint、参数、响应、Schema/property、enum 和 auth prose 在所有发布 locale 中有用且完整。
- 翻译保留 API 专有名词、约束和强弱语气，不把 required、may、deprecated 等语义翻错。
- 运行 locale 单元测试和 JSON Pointer 级差异检查。

结构漂移是 `BLOCKER`；重要 prose 缺失是 `MAJOR`。

## G5：完整性与可复现构建

- `catalog/products.json` 只含版本、locale 和正式产品 slug。
- 每个产品的概要、PontxSpec、SDK、locale 与 provenance 只存在自己的目录。
- SDK hash 与最终 PontxSpec 原始字节一致，并固定路径和 metadata commit。
- locale 同构、层级验证、SDK 质量验证和 `git diff --check` 全部通过。
- Hub 从同一精确 commit 读取全部分级文件，数量、身份和图关系合理。

hash 失配、生成物过期或非确定性构建均为 `BLOCKER`。

## G6：消费者就绪

- Hub 能在每个 locale 加载、验证和搜索该 API。
- Endpoint 请求体、所有响应和 Schema 图可在服务端 HTML/资源 API 中发现。
- server path prefix、auth、SDK 状态、deprecated 和稳定 ID 在转换中未丢失。
- Hub 测试、类型检查和生产构建通过；必要时检查桌面和 390px 移动布局。
- 目录字段变化遵循“消费者兼容旧/新 → producer 发新数据”的顺序。

消费者不接受新负载是 `BLOCKER`；仅展示质量不足通常为 `MAJOR`。

## G7：SDK 与产品 CLI 契约保真

- 独立产品仓库从固定 commit 的 canonical PontxSpec 生成 `@pontx/<slug>` 和同包 `pontx-<slug>`，生成物可复现且无手改漂移。
- SDK 保留真实 server path、参数序列化、auth、请求/响应类型、媒体类型、错误和二进制语义。
- Controller 只来自 Endpoint 显式 PontxSpec tags；未 tagged Endpoint 保持 client 根调用，不合成 `common`/`default` Controller；旧分组访问只能单独声明为兼容别名，不能成为 stable Endpoint ID。
- strict typecheck、ESM、CommonJS、声明和 CLI build 通过；unit tests 100% 通过且 0 skipped。
- built-package E2E 覆盖代表性 SDK 请求、产品 CLI help/preview/call、凭证脱敏、server path 和产品特有媒体/错误路径。
- mutation 在未确认、请求变化或确认过期时不会发出；mutation/付费/用户数据不通过生产实调验证。
- SDK/CLI 暴露的类型或请求构造缺口回流修复 canonical PontxSpec 或通用 generator，随后重新生成和重跑 G2–G7。

生成代码与已审契约不一致、凭证可泄漏、mutation 可绕过或关键 E2E 失败均为 `BLOCKER`。只通过本地 build 而没有 built-package E2E 是 `MAJOR`。

## G8：不可变发包与 registry 复验

- Pontx runtime/generator 使用 registry 已存在的精确版本；冻结 lockfile 无 `link:`、`file:`、`workspace:` 或本地 override。
- 发布前固定完整 SDK source commit，目标 Node 矩阵 CI 全绿，generation/typecheck/tests/build/E2E 在 release gate 中重跑。
- `npm pack --dry-run --json` 文件清单只含预期 code/types/bin/license/notices，不含凭证、缓存、私有 fixture 或无权再分发的上游材料。
- npm package/scope/version/public access 已核对，发布前版本未占用；不得绕过 `prepublishOnly` 或等价质量门。
- 发布后从全新临时目录仅安装 registry 精确版本，验证 ESM/CJS/types、`pontx-<slug>`、preview、安全门和获准的代表性只读路径。
- package/version、integrity、完整 source commit、CI URL、Node 矩阵、unit/E2E 和验证日期形成 version-bound 证据。

tarball 只在本地可用、依赖未发布、registry 版本不可复现、CI 未完成或质量证据未绑定同一版本均为 `BLOCKER`。`npm publish` 成功但未 fresh-install 复验仍未通过本门。

## G9：Metadata 准入与分阶段上线

- 只有 G8 registry 复验通过后，metadata 才在该产品 `sdk.json` 设置 `package.status: "published"` 并写入真实 package/version/CLI/quality 证据。
- SDK/CLI 示例与 registry 产物的真实导出、Controller/root 路径和参数完全一致。
- metadata 全部门与 Hub tests、typecheck、production build、SDK registry verification、搜索/SSR/Schema/Playground/snippet/AI tool eval 通过。
- 公共 catalog/Hub HTTP/CLI contract 变化遵循 consumer-first；动态 catalog 已足够时不为新增产品发布无意义的统一 CLI 版本。
- `develop` 的 Preview Ready 且完成中英文浏览器审查后，才提升 `main`；Production workflow/deployment 必须实际 Ready。
- SDK、必要消费者、metadata、Preview 和 Production 的 commit/run/deployment 证据写入同一 launch ledger。

先标 published、生产 metadata 指向不存在/不匹配的包、Preview 未审直接提升、消费者未兼容或 Production 未 Ready 均为 `BLOCKER`。PR、merge、source fix 或 Preview 本身不是完成状态。

## G10：生产发现、语义检索与助手调用

- 生产 Hub API、zh/en API/Endpoint/Schema/SDK 页面加载最终 catalog，稳定 ID、SSR、canonical/hreflang/sitemap 和 SDK 版本正确。
- fresh-installed 统一 `pontx-hub` CLI 能 list/search/show/sdk/preview 该产品和代表 Endpoint/Schema。
- 至少一条中文和一条英文非品牌任务查询在要求 top-k 返回正确资源，并暴露 `strategy`、`semanticVersion`、`match.mode` 与 `match.fields`；查询进入持久化 relevance eval。
- AI deterministic eval 覆盖 search → resource/auth → SDK/CLI → prepare，且 credential 不进入模型/tool input。
- 生产登录态助手从自然语言任务选中正确产品并完成 catalog-approved preview；客户端用 session-only credential 完成一条获准的安全 read，首个响应非空且满足关键 Schema。
- mutation 只验证 preview 和未变请求确认边界；任意 URL、未批准 server、私网、危险 header、凭证日志和未确认 mutation 仍被拒绝。
- 使用 Agent Browser 或当前工作区指定的浏览器工具验证真实生产 UI、网络和控制台，而不是只用直接 HTTP。

精确产品名可搜到但非品牌意图不可发现是 `MAJOR`。统一 CLI 不接受产品、助手无法准确 prepare、没有任何合法安全的助手 read 调用路径、凭证进入模型或生产安全边界失效是 `BLOCKER`。

## 发布判定

只有同时满足以下条件才称为“高质量完成”：

1. G0–G10 无 blocker；
2. 所有 major 已解决，或有用户明确接受且不影响准确性/安全性的限界说明；
3. 工作树只包含有意改动；
4. 证据、验证命令、包/commit/CI/deployment、风险与未执行 mutation 已在交付报告中披露；
5. Production 网站、统一 CLI、语义搜索和助手调用矩阵有最终 registry artifact 与 production catalog 的同版本证据；
6. 未在缺少授权时执行提供方 mutation、付费调用、用户数据调用或其他超出产品上线范围的外部副作用。
