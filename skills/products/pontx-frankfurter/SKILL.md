---
name: pontx-frankfurter
description: Maintain legacy Frankfurter v1 integrations through Pontx. Use for /v1, @pontx/frankfurter, pontx-frankfurter, symbols, or nested rates responses; route new provider-aware work to pontx-frankfurter-v2.
---

# Frankfurter v1

Use this skill for tasks that explicitly depend on Frankfurter v1. For a new
integration, first decide whether the provider-aware v2 product is a better fit.

## Choose the contract before coding

Frankfurter v1 is superseded by v2 but remains available. Keep v1 when an
existing integration depends on `/v1`, `@pontx/frankfurter`,
`pontx-frankfurter`, the `symbols` input, or the nested `rates` response.

Prefer `pontx-frankfurter-v2` for new work that needs provider selection,
attribution, broader history, grouping, or streaming. V1 returns a nested
`rates` object, while v2 returns flat arrays. Treat migration as an application
contract change: compare both live contracts, explain the differences, and
obtain approval before changing a parser or request.

## Resolve live facts through Pontx

Do not memorize Endpoint names, parameters, Schemas, auth, generated symbols,
or package versions. Load only what the task needs:

```bash
pontx-hub search "Frankfurter v1 <capability>" --type endpoint --json
pontx-hub show <returned-resource-id>
pontx-hub sdk frankfurter
```

Use the published `@pontx/frankfurter` package for application code. Use
`pontx-frankfurter` only for a single-product script, after inspecting its
current contract through `pontx-hub sdk frankfurter`.

For a request, use the controller and API name returned by Pontx:

```bash
pontx-hub frankfurter preview <controller> <api-name> <named-options>
pontx-hub frankfurter call <controller> <api-name> <named-options>
```

Preview first. Execute the unchanged read only when the user explicitly asks
for live retrieval. Never expose or invent a credential; recheck the selected
resource if current metadata says authentication is required.

## Preserve v1 semantics

- V1 dates are interpreted in UTC, and latest means the latest available
  working day rather than the user's current calendar day.
- Treat the response `date` as authoritative. Use an explicit completed date
  rather than `today` for a reproducible report.
- Filtering target currencies makes a v1 time-series response smaller and
  faster. Ask for only the currencies required by the calculation.
- Perform amount conversion in application code. Use decimal-capable arithmetic
  for accounting and round only at the declared business boundary.
- Describe the values as reference exchange rates, not guaranteed execution or
  settlement prices.
- Keep the v1 nested-map adapter separate from v2 flat records. A parser should
  not guess which version produced a response.

If the product guidance and the current Pontx contract differ, stop and surface
the conflict. Use `show` and `sdk` for executable facts; do not work around the
catalog with a guessed URL or signature.

## Few-shot workflows

### Scenario 1: Maintain a legacy application

**User:** "Our service already imports `@pontx/frankfurter`; add CAD and JPY
without migrating."

**Approach:** Keep v1, inspect the live SDK and selected Endpoint, update the
existing call, preserve the nested response adapter, and preview any live read.
Do not introduce v2 parameters, types, or a fixed package version.

### Scenario 2: Select a compliance-ready source

**User:** "Build a new report that must identify the central bank behind each
rate."

**Approach:** Explain that provider selection and attribution belong to v2,
load `pontx-frankfurter-v2`, and ask which authority controls the calculation.
Do not pretend legacy v1 satisfies the requirement.

### Scenario 3: Prepare a reproducible series

**User:** "Prepare, but do not run, a v1 date-range request for an audit."

**Approach:** Inspect the current time-series contract, use explicit UTC
boundaries and only required target currencies, then show the preview. Do not
execute, and note that returned working-day dates are authoritative.
