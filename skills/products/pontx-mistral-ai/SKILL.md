---
name: pontx-mistral-ai
description: Integrate Mistral AI models, agents, audio, and workflows safely through Pontx. Use for model and Endpoint discovery, local SDK or CLI setup, chat/FIM/agents streaming guidance, OCR or audio calls, and explicitly approved paid inference.
---

# Mistral AI API

Use this skill for Mistral AI Platform work. Resolve the live Endpoint, request,
Schema, credential, and package information through Pontx rather than copying a
contract into application code:

```bash
pontx-hub search "Mistral <capability>" --type endpoint --json
pontx-hub show <returned-resource-id>
pontx-hub sdk mistral-ai
```

Use `@pontx/mistral-ai` for application code. Use `pontx-mistral-ai` for
explicitly requested caller-local operations. Hub discovery is not an execution
path: Mistral AI calls stay caller-local and are paid provider traffic. Keep
`MISTRAL_API_KEY` out of source, shell history, inputs, logs, and chat.

## Start with a narrow read

Mistral AI Platform bills per model usage, and prompts, completions, uploaded
files, agents, and workflow data can be sensitive. Start with a caller-owned
API key with least privilege and a low-cost read such as the model catalog:

```bash
export MISTRAL_API_KEY=<caller-local-key>
pnpm exec pontx-mistral-ai call models listModelsV1ModelsGet --dry-run
```

Return only the fields the user asked for. Do not broaden a read from one model
or resource to all accessible data without clear user intent, and never echo
prompt or completion content into chat unless explicitly requested.

## Preview every direct call

List current local Endpoints and preview exact input before any direct call:

```bash
pnpm exec pontx-mistral-ai list apis
pnpm exec pontx-mistral-ai call models listModelsV1ModelsGet --dry-run
```

Every mutation (and every paid inference call) must be previewed with redacted
input and then receive explicit confirmation. Explain the model, target,
resource, expected usage cost, irreversible effect, credential scope, and
idempotency decision. Only then run the unchanged input with its request-bound
confirmation token:

```bash
pnpm exec pontx-mistral-ai call <controller> <Endpoint> \
  <required-options> --confirm '<preview-confirmation-token>'
```

If the target, input, credential scope, or intended effect changes, discard the
old token and preview again. The confirmation is valid for five minutes and is
bound to the exact request that was previewed.

## Streaming is SSE, not a one-shot buffer

Chat Completions, FIM, Agents conversations, Audio transcription/speech, and
Workflows event/log Endpoints stream responses as Server-Sent Events. The
one-shot CLI executor refuses to buffer an unbounded stream; use the generated
SSE stream client in `@pontx/mistral-ai` for streaming calls. Agents
conversation streams emit named events such as `conversation.response.started`,
`message.output.delta`, `tool.execution.started`, and `tool.execution.done`;
unknown future events must be preserved, not dropped.

## Batch, OCR, and audio

For large or asynchronous workloads prefer Batch jobs over live inference.
OCR Endpoints extract structured text from documents. Audio Endpoints cover
transcription, speech synthesis, and voice management. Preview the exact input
and expected cost before any of these paid calls.

## Few-shot workflows

### Scenario 1: Chat completion with a caller key

The user asks to call a Mistral chat model with their own key. Search
`pontx-hub search "Mistral chat completion"`, show the Endpoint, then preview
`pnpm exec pontx-mistral-ai call chat chatCompletionV1ChatCompletionsPost
--body '{"model":"mistral-large-latest","messages":[{"role":"user",
"content":"<user-request>"}]}' --dry-run` with the prompt redacted. Explain the
model, target, and estimated usage cost, get explicit approval, then execute
the unchanged request with its confirmation token and report only the
non-empty business response.

### Scenario 2: Streaming agents conversation

The user wants streaming output from an Agents conversation. Confirm the
conversation Endpoint (`betaConversations` controller, `*Stream` operation) and
its SSE contract, then guide them to the `@pontx/mistral-ai` stream client.
Never buffer the stream through the one-shot CLI; call it out as a protected
SSE path and keep the caller's key local.

### Scenario 3: Asynchronous batch job

The user wants to process a large file set without interactive latency. Check
the Batch controller, preview the batch-jobs create request with the file
reference redacted, confirm the estimated cost and job scope, then execute with
the confirmation token and poll the job status Endpoint read-only.
