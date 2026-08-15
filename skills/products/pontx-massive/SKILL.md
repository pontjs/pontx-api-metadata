---
name: pontx-massive
description: Integrate Massive market data through Pontx. Use for bars, snapshots, ticker lookup, backtests, dashboards, entitlements, pagination, market-session time zones, throttling, or licensing.
---

# Massive market data

Use this skill for product-specific market-data workflow and rights decisions.
Retrieve current API and package facts from Pontx rather than copying them here.

## Resolve the live contract

```bash
pontx-hub search "<market-data task>" --type endpoint --json
pontx-hub show <returned-resource-id>
pontx-hub sdk massive
```

Confirm the account plan, required recency, history window, and intended use
before promising that data is available. Plan tiers differ in history, recency,
request allowance, and dataset access; a valid key is not universal entitlement.

Use the cataloged REST surface for bounded, on-demand queries. Massive
recommends Flat Files for bulk history and WebSockets for continuous live
streams. Do not design a high-frequency REST polling loop for streaming work.

## Preserve market-time semantics

- Treat Massive's U.S. stock aggregate intervals as Eastern Time (ET).
  Interpret returned Unix timestamps as UTC using the unit in the current
  Schema. Implement ET with the `America/New_York` IANA zone rather than a fixed
  offset across daylight-saving transitions.
- Make adjusted versus unadjusted history an explicit decision. Never combine
  series with different adjustment policies silently.
- An aggregate interval with no qualifying trade can be absent. Do not invent a
  zero-price or zero-volume bar unless the user defines a filling policy.
- Report the as-of time, recency tier, time zone, and known gaps when results
  drive analysis or a user-facing dashboard.

## Paginate and throttle deliberately

Inspect current limit, sort, and continuation fields with `pontx-hub show`.
Choose an explicit order for reproducible ingestion. Follow `next_url` until it
is absent, but accept a continuation only on the approved Massive API host.
Keep the credential in the authorization header, never in stored URLs or logs.

Checkpoint and deduplicate a partially retried import. Bound concurrency to the
current plan. On throttling, honor `Retry-After` when present or use exponential
backoff with jitter; distinguish authentication, entitlement, throttling, and
provider failures.

## Preview, then integrate

```bash
pontx-hub massive preview <api-name> <named-options>
```

Hub proxy execution is disabled for this product. After preview and explicit
approval, execute the unchanged read from the caller process through
`@pontx/massive` or the `pontx-massive` product CLI. Keep untagged SDK methods
flat; never invent a `common` or `default` controller.

Read the credential environment variable from `show` or `sdk`. Never print,
persist, or place its value in source, command arguments, URLs, examples, or
traces. Begin product-CLI work in dry-run mode.

## Respect market-data rights

Personal or non-professional access does not grant commercial redistribution,
public-display, non-display, or derived-work rights. Before caching, exporting,
selling, or publicly displaying data, verify subscriber classification and
written rights for the intended use. If unclear, stop before retrieval and use
Massive's current terms or business licensing channel.

Market data can be delayed, incomplete, corrected, or unavailable. Do not call
it guaranteed and do not turn an API result into personalized investment advice.

## Few-shot workflows

### Scenario 1: Reproducible backtest

**User:** "Build an adjusted five-minute backtest across a U.S. daylight-saving
transition."

**Approach:** Inspect the aggregate contract and plan coverage, define sessions
in `America/New_York`, preserve UTC timestamps, choose adjustment and sort,
preview, traverse all continuations, and document intentionally missing bars.

### Scenario 2: Live dashboard

**User:** "Refresh hundreds of stock prices every second on a free plan."

**Approach:** Do not promise unsupported freshness or REST polling. Check live
entitlements and intended display rights, then evaluate the streaming product
while using REST only for a bounded bootstrap or reference query.

### Scenario 3: Paid public export

**User:** "Cache all data and expose it from our paid public API."

**Approach:** Stop before retrieval. Ask for business, redistribution, display,
storage, and derived-work rights. Never request the key value or treat technical
read access as permission to redistribute.
