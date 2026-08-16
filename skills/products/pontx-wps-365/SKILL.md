---
name: pontx-wps-365
description: Use for WPS 365 OpenAPI (Kingsoft Office) integration — app and delegated OAuth2 channels, kso.* permission scopes, calendars, drive, chats, mail, meetings, approvals, AI and SSE streaming, encrypted event callbacks — with caller-owned credentials and preview-first mutation confirmation.
---

# WPS 365 OpenAPI (Kingsoft Office Open APIs v7)

Start with live Pontx discovery rather than copying API fields into an
application. Use the universal CLI to resolve the current product, Endpoint,
Schema, and package guidance:

```bash
pontx-hub search "create calendar event" --type endpoint --json
pontx-hub show <returned-resource-id>
pontx-hub sdk wps-365
```

Use `@pontx/wps-365` in application code and `pontx-wps-365` for an optional
local script. WPS 365 OpenAPI is the official Kingsoft Office Open APIs v7
machine contract: 806 paths, 827 operations, and 3,119 schemas, byte-identical
to the spec embedded in the official MIT CLI `@wps365-open/wps365`. The SDK
groups the contract into 24 controllers covering address book and
organization, drive and documents, wiki, sheets and DBSheet, chats, meetings,
calendars, mail, approvals, attendance, and AI. It is a caller-directed
service: Pontx Hub does not proxy, cache, or aggregate WPS 365 enterprise
data. The client connects directly to the official production host
`https://openapi.wps.cn` (path prefix `/v7`) with the caller's own OAuth2
credentials.

## Integration sequence

1. Create an application on the open.wps.cn developer console and apply for
   the permission scopes each workflow needs. Every Endpoint is gated by
   `kso.*` scopes — for example `kso.calendar_events.readwrite` gates calendar
   reads and writes.
2. Choose the OAuth2 channel. Use the app channel (client credentials) for
   server-to-server automation owned by the application, and the delegated
   channel (authorization code) when acting on behalf of a specific user. The
   app and delegated channels can carry different scope sets, so inspect each
   Endpoint's security via `pontx-hub show`.
3. Inject credentials only through environment variables:
   `WPS365_APP_CLIENT_ID` and `WPS365_APP_CLIENT_SECRET` for the app channel,
   `WPS365_USER_ACCESS_TOKEN` for a delegated token. Never log, print, or
   commit them, and never put them in a request example.
4. Resolve the current Endpoint with `pontx-hub search` and `pontx-hub show`,
   then call it directly from the caller's own environment.

## KSO-1 signing caveat

KSO-1 request signing is optional and enabled per application under the
developer console security settings. When enabled, requests must carry the
`X-Kso-Date` and `X-Kso-Authorization` headers with an HMAC-SHA256 signature;
the Pontx SDK and CLI attach them automatically, so keep the app secret out of
examples.

## SSE streaming endpoints

15 operations stream `text/event-stream` responses (13 under `/v7/sse/*` plus
2 AIPPT variants under `/v7/aippt/*`: `gen_slides_from_multipages` and
`generate_slides_from_pxf_v2`), covering AIPPT generation, AI docs search,
document QA, and agent chat. The machine contract
enumerates no per-endpoint event names: every event is a JSON payload that
carries the type and terminal-state markers. Stream incrementally, never
buffer the full response, and keep streaming output out of logs; the CLI does
not buffer streaming responses.

## Encrypted callback events

Event subscriptions are encrypted HTTP callbacks pushed by WPS to the caller:
each event carries `encrypted_data` plus `signature`, `nonce`, and `iv`
fields. Decrypt and verify the signature before processing, and treat these
callbacks as inbound events, not callable Endpoints.

## Mutations are preview-first and explicitly confirmed

Reads are GET and mutations are POST or DELETE only; the official document
declares no PUT or PATCH. Sending chat messages, creating calendar events,
deleting drive files, and changing approvals all alter enterprise state.
Before executing:

1. Resolve the Endpoint and its required path and body inputs.
2. Preview the exact request locally:

```bash
pnpm exec pontx-wps-365 call calendars calendarList --dry-run
```

3. Review the rendered path, body, and side effects — deletes are permanent,
   and messages reach real members — then require the caller's explicit
   confirmation before sending. If any input changes, discard the preview and
   create a new one.

## Few-shot workflows

### Scenario 1: List drive files

**User:** "List the files in our shared drive; do not change anything."

**Approach:** Resolve `drive/driveFileList` and its drive_id and parent_id
path inputs, preview the exact read with the caller's tokens, and return only
the requested file identifiers and names.

### Scenario 2: Create a calendar event

**User:** "Create a calendar event for the launch on Friday at 10:00."

**Approach:** Resolve `calendars/calendarEventCreate`, build the title,
start, end, and timezone fields from the current Schema, preview the exact
POST, and require explicit confirmation before sending. If the timezone or
attendees change, preview again.

### Scenario 3: Stream an AI document answer

**User:** "Ask the AI assistant about our onboarding doc and stream the
answer."

**Approach:** Resolve the current `/v7/sse/*` Q&A Endpoint, preview the
request, and stream the text/event-stream incrementally until the terminal
marker inside the JSON payload, without buffering or caching the answer.
