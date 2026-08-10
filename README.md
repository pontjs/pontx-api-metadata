# Pontx API Metadata

[![Validate and publish metadata](https://github.com/pontjs/pontx-api-metadata/actions/workflows/publish.yml/badge.svg?branch=main)](https://github.com/pontjs/pontx-api-metadata/actions/workflows/publish.yml)

The source-of-truth catalog for [Pontx Hub](https://pontx-hub.vercel.app). It stores approved OpenAPI documents and compiles them into the catalog consumed by the Hub.

## APIs

- Frankfurter API v1 — legacy exchange-rate reference data
- Frankfurter API v2 — multi-provider exchange rates, currencies, and provider attribution
- Dida365 Open API — task and project management
- Massive Stock Market Data API — official stock trades, aggregates, snapshots, and reference data
- Yahoo Finance Web Market Data API — observed web quotes, charts, search, and fundamentals
- Stooq Public Quote Downloads — observed latest and historical CSV downloads
- Sina Finance Web Quote API — observed/inferred A-share snapshots and K-lines
- Tencent Finance Web Quote API — observed/inferred HK/A-share snapshots and K-lines
- Eastmoney Fund Web Data API — observed fund estimates and historical NAV
- CNBC Web Quote API — observed quote and chart requests
- i3Investor SGX Public Pages — observed/inferred HTML market pages

The web-derived market-data collections are evidence-labelled rather than presented as official developer APIs. See [`catalog/market-data-discovery.md`](./catalog/market-data-discovery.md) for provenance, confidence, wire formats, and known gaps. All eight collections disable Hub proxy execution.

## Updating the catalog

Chinese (`zh-CN`) is the canonical editing language. Each API keeps the same
OpenAPI structure in every locale:

```text
specs/<api>/
├── openapi.json
└── locales/
    └── en-US/
        └── openapi.json
```

Locale directory names use BCP 47 language tags such as `en-US`, not
underscore forms such as `en_US`. The localized documents may change only
OpenAPI prose fields (`title`, `summary`, `description`, OAuth scope labels,
enum descriptions, and the approved Pontx prose extensions). Paths, methods,
operation IDs, parameters, Schemas, constraints, examples, security, servers,
and array order must remain identical to the Chinese document.

Product-level Chinese copy and non-prose configuration live in
`catalog/source.json`; English product copy lives in
`catalog/locales/en-US.json`.

1. Update the Chinese document at `specs/<api>/openapi.json`.
2. Translate the same prose nodes in `specs/<api>/locales/en-US/openapi.json`.
3. Update `approvedSha256` and `approvedLocaleSha256` in `catalog/source.json`.
4. Run the locale lint, rebuild, and verify commands below.

```bash
node scripts/test-locales.mjs
node scripts/lint-locales.mjs
node scripts/build-catalog.mjs
node scripts/verify-specs.mjs
git diff --check
```

To enable the repository-provided pre-commit hook locally:

```bash
git config core.hooksPath .githooks
```

`catalog/catalog.json` is generated and committed intentionally: deployment consumers can fetch one immutable, validated bilingual catalog payload without needing a Node toolchain or package installation. The compiled payload includes searchable product metadata, HTTP operations, parameters, request-body schema relationships, every response/status schema relationship, and `components.schemas` data structures. Hub search can therefore follow an endpoint's complete input/output metadata graph instead of matching isolated names only.

## Branches and deployment

- `develop` publishes metadata to the Hub preview environment.
- `main` publishes metadata to the Hub production environment.

GitHub Actions validates the approved hashes and generated catalog before deploying Pontx Hub with the Vercel CLI. See [CONTRIBUTING.md](./CONTRIBUTING.md) for the review workflow and required repository secrets.

## Agent skills

- [`pontx-api-collection-builder`](./skills/pontx-api-collection-builder/SKILL.md) turns authoritative API evidence into a production-ready bilingual OpenAPI collection, catalog entry, execution policy, approved hashes, and verified Hub integration.
- [`pontx-api-collection-governance`](./skills/pontx-api-collection-governance/SKILL.md) audits and remediates existing collections for freshness, drift, compatibility, deprecation, localization, execution safety, SDK truth, and consumer readiness.

Both skills treat review, publishing, and execution as separate authorization boundaries. They do not commit, push, deploy, or call mutating APIs merely because a user asked to inspect or govern metadata.
