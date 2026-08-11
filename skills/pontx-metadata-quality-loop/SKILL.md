---
name: pontx-metadata-quality-loop
description: Repeatedly score and improve Pontx API metadata with isolated scorer, improver, and evaluator-auditor agents. Use whenever a user asks to 循环提分, 自动修复 metadata 直到无法提升, run a metadata quality improvement loop, accept only score-improving changes, or investigate whether Pontx quality rules are unreasonable. This skill owns orchestration and evidence; it never weakens rules merely to raise the current catalog score.
---

# Pontx Metadata Quality Loop

用可复现、可回滚的循环持续提升 Metadata。把“元数据变好”和“评分器改变”隔离：同一轮候选必须在同一个评估器、评测集和运行环境下比较，只有真实净增分且没有阻断回归才允许进入集成分支。

## 开始前

1. 读取工作区 `AGENTS.md`、仓库 `README.md`、`CONTRIBUTING.md`，并完整阅读 [references/protocol.md](references/protocol.md)。
2. 确认用户授权的是试跑、整改、提交、推送还是合并；默认只在临时集成分支和 worktree 中运行，不修改 `main`/`develop`。
3. 记录 `pontx-api-metadata`、`pontx`、评测集和 Node/pnpm 版本。保护所有已有工作树改动。
4. 构建本地 `@pontx/spec`，但不要发布 npm 包。
5. 动态评测只使用 fixture 和 dry-run。不得调用生产 API、写入 Endpoint 或真实凭证。

## 角色隔离

由主控 Agent 保管状态文件和合并权。每轮创建独立子 Agent：

- **scorer**：只读运行评分与验证，输出 JSON；不得修改文件。
- **improver**：只修改候选 Metadata worktree；不得修改评估器、评分权重或 golden cases。
- **evaluator-auditor**：只修改 `pontx` 评估器和回归测试；不得修改 Metadata。

不要让 improver 自己宣布提分，也不要让 evaluator-auditor 同时修改 Metadata。主控只相信 scorer 在候选提交之后生成的报告。所有最终结论必须引用实际 state、评分报告、门禁报告和候选 commit；fixture 或模拟运行只能证明协议行为，不能充当真实提分、停滞或合并证据。

## 建立基线

从当前接受的 Metadata commit 创建只读评分 worktree，然后运行：

```bash
node skills/pontx-metadata-quality-loop/scripts/score-metadata.mjs \
  --metadata-repo "$METADATA_WORKTREE" \
  --spec-module "$PONTX_REPO/packages/spec/lib/index.js" \
  --output "$RUN_DIR/baseline.json"
```

使用确定性状态机初始化 epoch：

```bash
node skills/pontx-metadata-quality-loop/scripts/quality-loop-state.mjs init \
  --state "$RUN_DIR/state.json" \
  --baseline "$RUN_DIR/baseline.json" \
  --metadata-commit "$METADATA_COMMIT" \
  --evaluator-commit "$EVALUATOR_COMMIT" \
  --benchmark-hash "$BENCHMARK_HASH" \
  --runtime-hash "$RUNTIME_HASH"
```

状态与报告放在运行目录，不要写入 OAS、catalog 或生产分支。

## 每轮循环

1. 从 state 中的 accepted commit 创建 `quality/improve-<epoch>-<cycle>` worktree。
2. scorer 对基线复核；如果输入 fingerprint 改变，停止并重建 epoch。
3. improver 只接收本轮 findings、权威证据和允许修改范围，优先选择预估收益最高且证据充分的问题。
4. improver 完成双语修改、hash、catalog 构建和仓库门禁，提交单一候选 commit。
5. scorer 在候选 commit 上生成 `candidate.json`。不得复用 improver 的自报分数。
6. 运行 `assess`，获得 `accept`、`reject` 或 `incomparable`：

```bash
node skills/pontx-metadata-quality-loop/scripts/quality-loop-state.mjs assess \
  --state "$RUN_DIR/state.json" \
  --candidate "$RUN_DIR/candidate.json" \
  --gates "$RUN_DIR/candidate-gates.json" \
  --candidate-commit "$CANDIDATE_COMMIT" \
  --candidate-branch "$CANDIDATE_BRANCH" \
  --evaluator-commit "$EVALUATOR_COMMIT" \
  --benchmark-hash "$BENCHMARK_HASH" \
  --runtime-hash "$RUNTIME_HASH"
```

7. `accept` 时主控在接受分支执行 fast-forward 或明确的单提交 cherry-pick，重跑评分确认，然后执行 `finalize --outcome merged`。
8. `reject` 时删除或归档候选 worktree，不合并，执行 `finalize --outcome discarded`。
9. `incomparable` 表示评分环境不同；不算一次失败，修复环境后重跑。
10. 同一 epoch 连续 3 个候选被拒绝后，先处理已上报的评估器 concerns；没有可接受的评估器修复就停止。

## 评估器 concern

scorer 或 improver 只能用带最小复现的 JSON 上报 concern：

```bash
node skills/pontx-metadata-quality-loop/scripts/quality-loop-state.mjs concern \
  --state "$RUN_DIR/state.json" \
  --input "$RUN_DIR/concern.json"
```

evaluator-auditor 必须复现问题、添加先失败后通过的测试，并在历史 Metadata 与对抗 fixture 上验证。仅当规则存在假阳性、假阴性、解析丢失、不确定性或有证据的权重失真时才修改评估器。当前目录分数提高本身不是接受理由。

评估器修复合并后，用新评估器重新评分当前 accepted Metadata，并运行：

```bash
node skills/pontx-metadata-quality-loop/scripts/quality-loop-state.mjs new-epoch \
  --state "$RUN_DIR/state.json" \
  --baseline "$RUN_DIR/rebaseline.json" \
  --evaluator-commit "$NEW_EVALUATOR_COMMIT" \
  --benchmark-hash "$BENCHMARK_HASH" \
  --runtime-hash "$RUNTIME_HASH"
```

被驳回的 concern 不清零连续失败次数。相同 concern fingerprint 不重复修改评估器。

## 接受标准

候选必须同时满足：

- 可比较分数严格提高；静态最小增量默认 `0.01`，动态最小增量默认 `0.5`；
- Critical 不增加，任何评分维度不回退；
- 确定性 CLI coverage 不回退；
- 没有动态 case 从通过变成失败；
- locale、hash、catalog、spec verification、构建和相关消费者门禁通过；
- 候选提交不包含评估器、测试期望或无关文件修改。

分数相同即丢弃。finding 数减少但分数不变，只记录为未接受证据，不绕过用户要求。

## 停止与报告

达到满分，或同一 epoch 连续 3 次无法提升且没有成立的 evaluator concern 时停止。最终报告包含：

- 初始/最终分数及各维度变化；
- 接受和拒绝的候选 commit；
- 三次停滞的目标、结果和丢弃原因；
- evaluator concern 的接受/驳回证据；
- 未解决 findings、缺失权威证据和后续人工动作；
- Metadata、评估器、benchmark、runtime fingerprint；
- 提交、推送、PR、部署状态。

不把 npm 发布、生产部署或真实 API 执行包含在循环授权中。
