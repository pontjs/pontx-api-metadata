---
name: pontx-stripe-identity
description: Integrate Stripe Identity safely through Pontx. Use for VerificationSessions, document, selfie, or ID-number checks, webhooks, retries, sensitive results, cancellation, or redaction.
---

# Stripe Identity

Use this skill for provider-specific lifecycle, webhook, PII, and mutation
decisions. Use Pontx for the current machine-readable API and SDK contract.

## Load the current contract

```bash
pontx-hub search "Stripe Identity <capability>" --type endpoint --json
pontx-hub show <returned-resource-id>
pontx-hub sdk stripe-identity
```

Use `@pontx/stripe-identity` for application code and
`pontx-stripe-identity` for a direct single-product script. Do not hardcode a
version or reconstruct parameters from this skill. Hub proxying is disabled;
requests originate in the caller-owned SDK or CLI process.

Keep the Stripe secret key server-side in the process environment. Never send
it to a browser, put it in arguments, or print a complete session, report,
webhook, or PII-bearing error.

## Design one session lifecycle

Decide the minimum verification check and PII needed before writing code.
Document consent, disclosure, retention, deletion, and any required alternative
with the appropriate legal or policy owner.

Reuse one VerificationSession for the same verification flow and provide an
idempotency key when creating it. Authenticate the application user, create the
session server-side, associate only an opaque internal reference, and store its
ID rather than its client secret.

Return only the client secret to the same authenticated user over TLS. Never
store it, log it, embed it in a URL, or disclose it to another user. Treat a
browser return as submission, not proof of verification; advance business state
from verified server-side state.

For `requires_input`, show safe corrective guidance and retrieve the same
session for a fresh client secret or URL. Do not create a new retry session
without a product reason.

## Handle webhooks defensively

Verify `Stripe-Signature` against the untouched raw request body before parsing
or trusting an event. Deduplicate event IDs, tolerate delivery reordering, make
business actions idempotent, and retrieve the latest session when current state
matters. Queue nontrivial work and acknowledge a valid event promptly.

Keep webhook signing secrets separate from API keys. Never log raw Identity
events or PII.

## Minimize sensitive-result access

Retrieve only necessary verification data and use a restricted server-side key
for sensitive results when Stripe requires it. Prefer controlled Dashboard
access when programmatic retrieval is unnecessary.

Avoid copying document or face images. If access is justified, use a
short-lived FileLink and remove downstream copies under the declared retention
policy. Do not expose VerificationReports, expanded PII, client secrets, or raw
events through logs, analytics, error trackers, or Hub.

## Execute mutations safely

Creating, updating, canceling, and redacting sessions change provider state.
Resolve the live API name, then preview locally:

```bash
pontx-stripe-identity list apis
pontx-stripe-identity call <api-name> ... --dry-run
pontx-stripe-identity call <same-api-name> ... --confirm '<preview-token>'
```

Show the redacted preview and obtain explicit approval before confirming it.
Any changed session, body, API name, or option requires a new preview.

Cancellation prevents later submission and cannot be undone. Redaction is
irreversible and asynchronous and affects related reports, events, logs,
metadata, and collected files. Confirm deletion scope, inspect current state,
and plan deletion of application-owned copies before execution.

## Few-shot workflows

### Scenario 1: Onboarding verification

**User:** "Add document verification to our Next.js onboarding flow."

**Approach:** Discover current create/retrieve shapes, authenticate the backend,
create one idempotent session, return only its client secret, launch Stripe's
client flow, and finish onboarding only from a signature-verified event. Include
`requires_input` and failure-path tests.

### Scenario 2: Retry a failed verification

**User:** "The customer failed once and wants to retry."

**Approach:** Retrieve the existing session, present a safe failure reason, and
return a fresh client secret only to the same authenticated user. Preserve the
session ID for auditability.

### Scenario 3: Fulfil deletion

**User:** "Permanently delete this customer's Identity data."

**Approach:** Inventory the session and downstream copies, explain irreversible
asynchronous redaction, preview the exact call, require explicit confirmation,
wait for redacted state, then remove authorized application copies.
