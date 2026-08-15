# SDK、CLI、发包与生产上线标准

进入 SDK 生成前读完本文件。这里定义产品从已审 metadata 到 npm 与 Production 的可复现闭环；具体命令以目标仓库当前 `package.json`、工作区 runbook 和发布权限为准。

## 1. 产物边界

每个正式产品拥有独立 SDK 仓库和一个 public npm 包：

- SDK package：`@pontx/<slug>`；
- 同包产品 CLI binary：`pontx-<slug>`；
- 统一目录 CLI：`@pontx/hub-cli` / `pontx-hub`，通常通过动态 catalog 自动获得新产品，不因每次新增产品而发版；
- metadata：只在产品包已发布并从 registry 复验后，于该产品 `sdk.json` 声明 `package.status: "published"`；SDK 规范来源必须是固定 metadata commit 的 `products/<slug>/spec.pontx.json` 原始字节；
- Hub：从同一精确 metadata commit 的产品分片消费 metadata、提供网站/API/搜索/Playground/Agent Skill/助手，不代替 SDK 仓库发包。

冻结的 `@pontx/api-*` 不再发布。未 tagged Endpoint 直接挂在 client 根；只有显式 PontxSpec tags 生成 Controller。CLI/Hub stable resource ID 与 SDK property path 是不同合同，不能互相推导或用 `common`/`default` 伪造。

## 2. SDK/CLI 标准验证

一个发布候选至少通过以下检查，且每项结果绑定同一 commit 和同一目标版本：

| 类别 | 必须证明 |
| --- | --- |
| Provenance | 规范来源、不可变 revision/hash、生成脚本、license/notice 和再分发边界可追溯 |
| Contract | Endpoint/Schema/auth/server/媒体类型/错误/示例数量和关键语义有 drift assertions |
| Generation | 重新生成无 diff；不靠手改 generated files 修契约 |
| Types/build | strict typecheck；ESM、CommonJS、`.d.ts` 与 `pontx-<slug>` CLI 均可构建和加载 |
| Unit | 100% pass、0 skipped，覆盖 auth、URL/序列化、响应/错误、脱敏及产品特例 |
| Built E2E | 用最终 `dist` 验证 ESM/CJS import、代表请求、CLI help/preview/call、server path 和 Controller/root 路径 |
| Safety | credential 仅环境/调用配置；输出脱敏；mutation 无确认不发出、请求变化后旧确认失效；任意目标不可注入 |
| Media | 按产品覆盖 JSON、form/multipart、binary/download、流式/异步等已支持且真实存在的媒体/协议 |
| Package | `npm pack --dry-run --json` 只有预期 code/types/bin/license/notices；无凭证、缓存、测试 fixture 或无权分发的源材料 |
| Fresh install | 在新临时目录从 tarball 安装并运行；之后还要从实际 registry 再重复一次 |
| Runtime matrix | CI 使用产品声明的最低 Node 与当前支持版本；工作区基线通常至少为 Node 18/20/22 |
| Bounded probe | 许可、费用、数据与用户授权允许时，至少一条安全只读 SDK 调用和一条 CLI 调用返回符合 Schema 的非空业务结果 |

对 mutation、删除、签署、支付、发消息、云资源修改、付费调用或真实用户数据，不用生产实调证明 SDK 质量；使用本地受控 server/sandbox 验证精确 request binding 和确认机制。

## 3. Release gate

发布脚本必须在发包前验证：

1. `package.json` 的 Pontx runtime/generator 依赖是已存在于 registry 的精确版本；
2. lockfile 已提交且 fresh install 使用 frozen 模式；
3. workspace 配置、lockfile 和 manifest 中没有 `link:`、`file:`、`workspace:`、本地 override 或未发布 tarball；
4. version、exports、bin、engines、files、license、repository/homepage 和 public access 正确；
5. generation、typecheck、tests、build、built E2E、pack inspection 全部重跑；
6. npm 登录身份、org scope 和 2FA/automation policy 符合 operator 流程；
7. `npm view <package>@<version>` 在发布前确认版本未占用，发布后确认 registry 精确解析到该版本。

不要用 `--ignore-scripts` 绕过 `prepublishOnly`，不要用范围依赖或 unpublished local core 包发布“临时可用”版本。发布命令失败时先查 registry、scope、provenance、2FA、网络和包内容；不得把本地 tarball 当作 registry 已发布证据。

## 4. 发布后 registry 复验

在全新临时目录只从 registry 安装目标精确版本，并保存脱敏证据：

- `npm view`/registry 返回 package、version、dist-tag 和 integrity；
- ESM import、CJS require、types consumer compile；
- `pontx-<slug> --help`、代表性 preview 和参数/Controller 路径；
- credential redaction、mutation blocking、binary output 等产品风险路径；
- 获准时执行一条安全只读 SDK 与产品 CLI 请求；
- 包内 license/notices 和文件清单与 pack review 一致。

这些结果产生 metadata 中的 version-bound `sdkQuality` 或当前等价证据：`testedVersion`、unit/E2E 状态、Node versions、完整 source commit、testedAt、repository URL、workflow run URL。字段以当前 schema 为准，不发明平行合同。

## 5. Metadata admission 与部署顺序

推荐顺序：

1. 先发布并 registry-verify 通用 Pontx 依赖（若本产品需要新 generator/runtime 能力）；
2. 镜像固定 metadata commit 的 `spec.pontx.json` 到产品 SDK，验证路径/SHA/生成漂移后提交产品 SDK，等待目标 Node CI；
3. 发布并 registry-verify `@pontx/<slug>` / `pontx-<slug>`；
4. 将真实 package/version/quality、双语同构 PontxSpec、原始字节 hash、固定 metadata commit、执行策略和真实示例一起写入分级 metadata；
5. 编写 evidence-backed `pontx-<slug>` 产品 Skill，保持 draft 直至静态/独立 Agent 门通过，生成 registry 并验证 skills.sh/ClawHub dry-run；
6. metadata 层级验证与本地 Hub consumer 全部门通过；Hub 只读取 `catalog/products.json`、产品分片和 same-commit Skill registry，不读取任何 OAS 或聚合 catalog；公共响应变化时先发布兼容的 Hub/Hub CLI consumer；
7. metadata `develop` → Preview Ready → Agent Browser 中英文审查；
8. metadata `main` → Production Ready → 精确部署 URL/ID、production catalog 与产品 Skill 复核；
9. 发布产品 Skill exact SemVer，运行 skills.sh/ClawHub/Hub 安装和生产验收矩阵，失败则修 owning repo 并重复受影响阶段。

SDK 版本和 metadata 必须原子一致。禁止先上线 `planned` 安装命令、先写不存在的版本、或把本地 source 导出路径当作 registry API。

## 6. 生产验收矩阵

### Web 与公共 Hub API

- 生产 catalog/API detail 暴露稳定 `api:<slug>`，Endpoint/Schema 数量和 metadata 一致；
- zh/en 页面 SSR 含真实标题、请求/响应/Schema，语言切换保留资源；
- SDK 页面只展示实际 registry package/version，安装和调用示例能在 clean install 运行；
- Skills 页面只展示 same-commit registry 中的 published bundle；统一 Skill 与 `pontx-<slug>` 的关系、版本、安装命令和 API 返回一致；
- canonical、hreflang、JSON-LD 与 sitemap 只包含 canonical 200 页面；
- 一个安全代表 Endpoint 的文档 → Playground → preview → 获准 read response 链路通过。

### 统一 CLI 与语义搜索

从 registry fresh install 当前受支持的 `@pontx/hub-cli`，对 Production 运行：

1. `list` 能看到产品；
2. 用 stable ID `show api:<slug>`、代表 Endpoint 和 Schema；
3. `sdk <slug>` 返回真实 package/version/CLI；
4. 代表 Endpoint `preview` 生成正确 method/path/auth 参数且无凭证；
5. 中文、英文各一个不含品牌/slug/operationId 的任务查询在约定 top-k 返回目标资源，并有匹配 provenance；
6. 将查询和 relevance judgment 加到 Hub 持久化 search eval，防止未来排序回归。

新产品仅依赖动态 catalog 时，不发布无意义的 Hub CLI 版本。若 CLI 类型、参数、稳定 ID 或 HTTP contract 必须变化，则先做兼容 consumer release，再放出 producer metadata。

### AI 助手与受控调用

先增加 deterministic tool eval：

1. `search_resources` 用非品牌任务发现目标；
2. `get_resource` 返回准确 request/response/auth/proxy 状态；
3. `get_sdk_and_cli` 返回 registry package/version；
4. `prepare_api_call` 产生正确 preview、CLI 和 `pontx.request_prepared`，不接收 credential；
5. mutation 显示 requires-confirmation，且模型不能自行确认。

再用 production 登录态 UI smoke：输入自然语言任务，确认助手选择正确资源并准备请求；credential 只由客户端从 session 注入，不进入模型消息、tool input、日志或报告。对允许 Hub 执行的低成本安全 read，在用户授权下从同一 UI 完成 preview/execute 并断言首个响应非空且符合关键 Schema。若产品没有任何合法可执行 read，则本项为 blocker，而不是用 SDK 代码片段冒充助手调用成功。

## 7. 可接受的 blocker 证据

以下状态可以阻断上线，但必须给出精确解除条件：

- 上游未提供完整产品契约或关键成功/错误 Schema；
- metadata/spec 或独立生成 SDK/CLI 的发布权不明确；
- 完整产品需要 Pontx 尚未支持的协议；
- 敏感数据、代理/再分发、凭证或 mutation 边界无法安全满足；
- Pontx 依赖未发布、npm scope/2FA/权限拒绝或 registry 不一致；
- CI、Preview、Production 或生产验收实际失败；
- 没有可合法、安全验证的助手调用路径。

“本地能 build”“pack dry-run 通过”“PR 已开”“等待后续上线”不是 blocker 也不是完成；在授权范围内继续推进。
