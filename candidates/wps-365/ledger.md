# WPS 365 OpenAPI — Launch Ledger

认领时间：2026-08-16（Asia/Shanghai）
产品 slug：`wps-365`（候选账本 `candidates/wps-365`）
上游：WPS 365 OpenAPI（Kingsoft Office Open APIs v7），provider: Kingsoft Office

## 阶段矩阵

| 阶段 | 状态 | 证据 / 下一步 |
| --- | --- | --- |
| authority（官方来源与边界） | passed | 官方 open.wps.cn 文档站 + API Explorer + 官方 npm CLI `@wps365-open/wps365@0.2.27`（maintainers 为 @wps.cn 员工）；官方机器契约为 OpenAPI 3.0.0 v7 |
| redistribution（再分发） | passed | 官方规范可由 `https://open.wps.cn/v7/developer/cli_tools/specs/api-internal` 免登录下载（无文件级 license 字段），同时随官方 MIT 许可 npm 包分发；独立撰写 Hub 文案、保留 attribution、不暗示官方背书、不复制文档站 prose |
| contract（完整契约） | passed | 官方规范固定：806 paths / 827 operations / 3,119 schemas，SHA-256 `3a2dfe64b4debf6435405e2e15e3b7682504c4c91c842c8a491783ea72ae8548`。已构建双语 PontxSpec：826 个 Endpoint（排除 1 个浏览器重定向 OAuth helper）/ 3,119 Schema，静态质量 50/50，仅 i18n.structure 基线 finding（双语 disabledReason，与 nager-date/dropbox-sign/notion 一致）；`pnpm test` 与 `pnpm validate` 全绿 |
| transport（协议面） | in-progress | 812 纯 REST（GET/POST/DELETE，无 PUT/PATCH）+ 15 个 `/v7/sse/*` text/event-stream 端点（typed SSE 契约已声明，message 事件 + preserve）；事件订阅为加密 HTTP callback（AES-CBC + HMAC-SHA256）；SSE 事件类型逐供应商复核待完成 |
| risk（安全执行策略） | pending | OAuth2 app/delegated 双通道 + 可选 KSO-1 请求签名；敏感读写面（用户/组织、消息、邮件、会议、云文档、审批）需逐 Endpoint 策略 |
| sdkCli（SDK/CLI） | pending | 未开始；next：独立 SDK 仓库生成 `@pontx/wps-365` / `pontx-wps-365` |

## 契约构建记录（2026-08-16）

- 导入：`@pontx/spec@1.0.0-beta.9` `importOpenAPI`（一次性）；`candidates/wps-365/sources/openapi.yaml`（官方 api-internal 字节，SHA 3a2dfe64...）与 `curated.yaml`（SHA 24e11b42...）字节校验通过。
- 稳定 operationId：curated.yaml 101 个官方命令 ID 作锚点，其余按 method+path 派生（确定性、唯一，827/827 无重复）。
- tags：24 个规范 tag（addressBook/calendars/chats/meetings/mail/drive/documents/filetransfer/wiki/doclib/sheets/dbsheet/airsheet/airpage/lowCodeApp/ai/developer/store/security/audit/attendance/announce/workflow/todo），由路径模块映射（`sources/tag-map.json`），coop 按子模块拆分。
- 双语 prose：Endpoint 摘要/描述以 curated.yaml 中文为锚 + 按模块/动词派生；Schema/字段 prose 独立撰写（公共字段双语字典 + 名称派生回退）；info/tags/securitySchemes 双语。
- 边界：826 个 Endpoint；排除 `GET /v7/oauth2/qrcode_auth_code`（浏览器重定向 OAuth helper：官方仅声明 302+default、无 JSON 成功契约、无官方文档页、不在 curated CLI、未登录返回 404 Route Not Found）。
- 质量：静态 50/50（structure 6 / directory 6 / contract 8 / description 10 / examples 6 / requestExamples 4 / runtime 5 / i18n 5），0 Critical/0 Major/0 Minor，仅 1 条 i18n.structure 基线（双语 disabledReason，与已上线产品一致）。
- 产物：`spec.pontx.json`（zh，SHA a9edac87...）、`locales/en-US/spec.pontx.json`、`product.json`、`sdk.json`、`sources/provenance.json`、`sources/ATTRIBUTION.md`、`sources/tag-map.json`、`sources/derivation.json`。
- 验证：`pnpm test`（SDK quality / hierarchy / product skills）、`pnpm validate`（products 14/playground/candidates/fx/skills）全绿；`verify-candidates.mjs` 通过 16 个候选。
- 下一步：SSE 事件类型逐供应商复核（15 个 /v7/sse/* 的官方事件语义）→ risk 策略 → SDK/CLI 生成与发布（需 operator）→ metadata 准入 → Preview/Production → 生产验收。

## 官方证据清单（已固定）

| 证据 | URL / 位置 | 哈希 / 状态 |
| --- | --- | --- |
| 官方 OpenAPI 规范（api） | https://open.wps.cn/v7/developer/cli_tools/specs/api-internal | SHA-256 `3a2dfe64b4debf6435405e2e15e3b7682504c4c91c842c8a491783ea72ae8548`（与官方 CLI 内嵌字节一致） |
| 官方 curated 规范 | https://open.wps.cn/v7/developer/cli_tools/specs/curated-internal | SHA-256 `24e11b4206c126c7f4f7bf614f2e2422c9a3bcad4b02311ae94ce88f0b3dffd5`，101 个官方命令 ID |
| 官方 CLI npm 包 | https://www.npmjs.com/package/@wps365-open/wps365 | `@wps365-open/wps365@0.2.27`，MIT，repository 指向 ksogit.kingsoft.net |
| 文档站（zh/en markdown） | https://open-docs.wpscdn.cn/docs-md/{zh,en}/app-integration-dev/... | 每 Endpoint 一页 markdown，双语可用 |

## 关键事实（已验证）

- OpenAPI 3.0.0，`info.title = Kingsoft Office Open APIs`，`info.version = v7`，无 license/termsOfService 字段，无 servers 字段（实际 base 为 https://openapi.wps.cn）。
- securitySchemes：`app`（clientCredentials，如 kso.airsheet.readwrite）、`delegated`（用户授权）；操作级 security 为 `[{app:[...]},{delegated:[...]}]`。
- 827 operations：GET 51% / POST 44% / DELETE 5%；无 PUT/PATCH。
- 15 个 SSE 端点：`/v7/sse/aippt/*`（10）、`/v7/sse/aidocs/*`（2）、`/v7/sse/docqa/insight/chat`、`/v7/sse/generator/generate_slides`、`/v7/sse/wps365agent/chat_stream`。
- 路径模块（按 path 前缀统计）：coop(61)、drives(46)、aiopen(43)、calendars(34)、workflow(30)、chats(26)、developer(25)、users(25)、sheets(21)、todo(21)、groups(19)、depts(18)、filetransfer(18)、meetings(18)、aidocs(17)、dbsheet(17)、airpage(16)、wiki(16)、airsheet(14)、documents(13)、sse(13) 等。
- curated.yaml：7 组（calendar/im/user/mail/drive/dbsheet/meeting）、101 个命令，命令 path/method 100% 存在于 api.yaml。
- 官方文档站存在 zh 与 en markdown 镜像（en 为 `docs-md/en/...`）。

## 派生 ID 与 tags 策略（待实现）

- operationId：以 curated.yaml 命令 ID（如 `calendar.event.create`）为官方锚点；其余按 `method + path` 派生（如 `GET /v7/calendars` → `calendars.list`），确保稳定、代码生成安全、G2 兼容。
- tags：按路径模块分组（如 calendars/drives/users/meetings/...），显式 tags 生成 SDK Controller。
- prose：从官方文档站逐 Endpoint 提取 zh 描述 → 英译，双语同构（zh-CN 为结构基线）。

## 阻断项与解除条件

- 无不可解除的 blocker。当前工作量集中在：827 个 Endpoint 的 ID/tags 派生、双语 prose 提取与复核（官方文档站为权威来源）、SSE 事件类型复核、risk 策略编写、SDK/CLI 生成与发布（需 operator）、metadata 准入、Preview/Production。
