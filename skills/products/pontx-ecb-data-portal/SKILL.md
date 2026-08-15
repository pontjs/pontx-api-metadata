---
name: pontx-ecb-data-portal
description: Integrate ECB Data Portal statistics through Pontx. Use for dataflows, DSDs, codelists, series keys, frequency-aware periods, bounded or incremental retrieval, availability, and SDMX formats.
---

# ECB Data Portal

Use this skill when an ECB statistics task needs SDMX discovery, query design,
incremental ingestion, or representation choices beyond the API metadata.

## Start with the current contract

Do not copy Endpoint names, parameters, Schemas, formats, generated symbols,
auth, or versions into a durable answer. Resolve the current facts through
Pontx:

```bash
pontx-hub search "<ECB dataset, series, or integration goal>" --json
pontx-hub show <returned-resource-id>
pontx-hub sdk ecb-data-portal
```

Use `@pontx/ecb-data-portal` for application code. Use
`pontx-ecb-data-portal` only for a single-product script after inspecting its
current contract. Hub can discover and preview this product but does not proxy
its live requests.

Preview the exact bounded request before any live retrieval:

```bash
pontx-hub ecb-data-portal preview <controller> <api-name> <named-options>
```

Execute through the caller-owned SDK or product CLI only when the user
explicitly approves the unchanged GET. Keep credentials and tokens out of
arguments, source, logs, and generated examples.

## Discover structure before data

When the series is unfamiliar, identify the dataflow, inspect its DSD, and load
the required codelists. The API series key follows DSD dimension order, uses
dots between dimensions, empty segments for wildcards, and plus signs for
alternative values. Validate order and codes rather than guessing them.

A portal code such as `EXR.M.USD.EUR.SP00.A` includes the dataflow prefix. Split
it into `flowRef=EXR` and `key=M.USD.EUR.SP00.A`; confirm both against current
metadata before previewing.

Reporting-period syntax depends on the selected series frequency.

## Bound and synchronize retrieval

- Add a date range or observation limit before a broad wildcard query.
  Observation limits apply to every matching series and are not cursor
  pagination; partition a large job by non-overlapping keys or periods.
- `serieskeysonly` can enumerate matching series without returning observations.
  Use it to check availability before downloading data.
- Choose the representation deliberately: a processing format for applications,
  tabular output for analysis, or SDMX XML for SDMX tooling. Prefer a versioned
  media type and request compression for large responses.
- For recurring ingestion, retain a successful checkpoint and use
  `updatedAfter`. Apply additions, revisions, and deletions rather than treating
  a response as append-only. If deltas cannot be applied, use conditional
  retrieval and treat HTTP 304 as unchanged.

## Handle failures and meaning

Treat 404 as no match for the query, not proof that the entire dataset is
absent. Correct invalid requests or representations before retrying; retry
temporary provider failures only with bounded backoff.

Do not silently aggregate frequencies. Preserve series metadata so observations
retain their statistical meaning. Document any application transformation.
Do not present an observation as real-time, unrevised, or suitable for a
financial decision without current authoritative support.

## Few-shot workflows

### Scenario 1: Latest observation

**User:** "Get the latest monthly USD/EUR ECB value."

**Approach:** Inspect the current data contract and EXR DSD order, construct a
single-series request with a last-observation bound, preview it, and retrieve
only after explicit approval. Report its period and revision context rather
than calling it real-time.

### Scenario 2: Series availability

**User:** "Which daily currencies against EUR exist? Do not download values."

**Approach:** Confirm the DSD order and codelists, construct a deliberate
wildcard key, use the live availability option that returns series keys only,
and treat an empty result as no match for that query.

### Scenario 3: Incremental ingestion

**User:** "Keep our ECB mirror current without full downloads."

**Approach:** Perform a bounded initial backfill, persist the last successful
checkpoint, then request updates. Apply additions, revisions, and deletions
atomically; never invent a page token or advance after partial failure.
