---
name: pontx-openai
description: Integrate OpenAI models safely through Pontx. Use for model discovery, local SDK or CLI setup, chat or responses preparation, streaming guidance, and explicitly approved paid inference calls.
---

# OpenAI API

Use this skill for OpenAI Platform work. Resolve the live Endpoint, request,
Schema, credential, and package information rather than copying a contract
into application code:

```bash
pontx-hub search "OpenAI <capability>" --type endpoint --json
pontx-hub show <returned-resource-id>
pontx-hub sdk openai
```

Use `@pontx/openai` for application code. Use `pontx-openai` for explicitly
requested caller-local operations. Hub discovery is not an execution path:
OpenAI calls stay caller-local and are paid provider traffic. Keep
`OPENAI_API_KEY` (or `OPENAI_ADMIN_API_KEY` for organization administration
Endpoints) out of source, shell history, inputs, logs, and chat.

## Start with a narrow read

OpenAI Platform bills per model usage, and prompts, completions, uploaded
files, fine-tuning, and organization data can be sensitive. Start with a
caller-owned API key with least privilege and a low-cost read such as the
model catalog:

```bash
export OPENAI_API_KEY=<caller-local-key>
pnpm exec pontx-openai call models listModels --dry-run
```

Return only the fields the user asked for. Do not broaden a read from one
model or resource to all accessible data without clear user intent, and never
echo prompt or completion content into chat unless explicitly requested.

## Preview every direct call

List current local Endpoints and preview exact input before any direct call:

```bash
pnpm exec pontx-openai list apis
pnpm exec pontx-openai call models listModels --dry-run
```

Every mutation (and every paid inference call) must be previewed with redacted
input and then receive explicit confirmation. Explain the model, target,
resource, expected usage cost, irreversible effect, credential scope, and
idempotency decision. Only then run the unchanged input with its
request-bound confirmation token:

```bash
pnpm exec pontx-openai call <controller> <Endpoint> \
  <required-options> --confirm '<preview-confirmation-token>'
```

If the target, input, credential scope, or intended effect changes, discard the
token and create a new preview. Never execute a paid generation, deletion,
fine-tuning, file upload, or organization administration change from an
ambiguous request.

## Streaming Endpoints

Responses, Chat Completions, Images, and Audio Endpoints support typed
Server-Sent Events. The generated CLI refuses to buffer an unbounded stream
into a one-shot result; use the SDK stream client when the caller needs
streaming semantics. Do not guess event shapes that are not in the current
PontxSpec.

## Few-shot workflows

### Scenario 1: Choose a model for a task

The user asks which OpenAI model fits a summarization task without calling the
API yet. Use `pontx-hub search` to find model and chat Endpoints, read their
current request and Schema facts, and present the models Endpoint and the
caller-local `pontx-openai call models listModels --dry-run` preview. Do not
execute a paid call.

### Scenario 2: Prepare a caller-authorized chat completion

The user explicitly approves a low-cost chat completion with their key. Preview
the exact request with `pontx-openai call chat createChatCompletion
--body '<approved-json>' --dry-run`, confirm cost and content boundaries, then
run the unchanged request with its request-bound confirmation token. Redact the
prompt from logs and report only the non-empty business response.

### Scenario 3: Refuse an ambiguous organization change

The user asks to rotate an organization admin API key or change a spend limit.
Stop and ask which exact resource, what scope, and whether the caller holds an
admin key. If confirmed, preview the exact mutation, redact all key material,
and require a fresh request-bound confirmation token before execution.
