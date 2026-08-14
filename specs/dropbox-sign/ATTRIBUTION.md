# Dropbox Sign OpenAPI attribution

This candidate specification is derived from the official
[`hellosign/hellosign-openapi`](https://github.com/hellosign/hellosign-openapi)
repository at revision
[`f0c7887f2f56fb7a082b5db78a09856df2cb6ccf`](https://github.com/hellosign/hellosign-openapi/tree/f0c7887f2f56fb7a082b5db78a09856df2cb6ccf).
The primary input is that revision's `openapi-fern.yaml`, which the pinned
README identifies as the self-contained documentation specification. The
importer also proves its HTTP contract equivalent to `openapi.yaml` after
resolving that file's external content, stripping display prose and
`x-codeSamples`, and canonicalizing the two webhook container forms by
`operationId`.

The pinned repository README states that the repository is published under
Apache License 2.0. The exact upstream license is retained as
[`LICENSE`](./LICENSE). No `NOTICE` file exists at the root of the pinned
revision. The normalized specification preserves the OAS `info.license` value
of MIT as upstream metadata. Dropbox Sign documents the MIT license of its
generated SDKs separately in its
[official SDK overview](https://developers.hellosign.com/docs/sdks/overview/);
that SDK license is not used as the license for the repository-derived OAS
content.

The exact source files, hashes, transformations, coverage counts, and output
hashes are recorded in [`provenance.json`](./provenance.json).

Pontx-derived enrichment is clearly separate from upstream content. It consists
of identifier-based Schema titles, literal-preserving enum labels,
constraint-valid examples generated from declared defaults/enums or fixed safe
values, one directory registration for the upstream-used but undeclared `Fax`
tag, and three unambiguous schema corrections. Generic unconstrained strings
without a meaningful field/format mapping, binary bodies, credentials, secrets,
and schemas without a safely inferable scalar type remain without fabricated
examples. The 73 embedded `x-codeSamples` groups are removed because
they are SDK documentation display inputs, not HTTP contract data.

## 归因说明

本候选规范派生自上述 Dropbox Sign 官方 OpenAPI 仓库的固定 revision。固定版本 README
明确仓库内容按 Apache License 2.0 发布，因此候选规范保留了上游 `LICENSE` 和本归因说明；
该 revision 根目录没有 `NOTICE` 文件。OAS 中的 MIT 声明作为上游 `info.license`
metadata 原样保留，官方生成 SDK 的 MIT 许可则单独记录，不将其混作仓库规范内容的许可依据。

主输入使用固定 revision 中 README 明确标注为自包含文档规范的 `openapi-fern.yaml`。
importer 会解析 `openapi.yaml` 的外部内容，剥离展示 prose 与 `x-codeSamples`，再按
`operationId` 归一两种 webhook 容器，确定性验证两份来源的 HTTP 合同等价。
Pontx 派生补全与上游内容明确分开：仅增加基于标识符的 Schema 标题、保留枚举字面量的标签、
基于已声明 default/enum 或固定安全值的约束有效示例、上游 Endpoint 已使用但顶层未声明的
`Fax` 目录注册，以及三项无歧义 Schema 修正。没有可靠字段/格式映射的通用无约束字符串、
二进制正文、凭据、秘密和无法安全判断标量类型的 Schema 不会获得编造示例；73 组
`x-codeSamples` 作为 SDK 文档展示输入予以剥离。
