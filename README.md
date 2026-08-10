# Pontx API Metadata

[![Validate and publish metadata](https://github.com/pontjs/pontx-api-metadata/actions/workflows/publish.yml/badge.svg?branch=master)](https://github.com/pontjs/pontx-api-metadata/actions/workflows/publish.yml)

The source-of-truth catalog for [Pontx Hub](https://pontx-hub.vercel.app). It stores approved OpenAPI documents and compiles them into the catalog consumed by the Hub.

## APIs

- Frankfurter API — exchange-rate reference data
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

1. Replace an approved document under `specs/<api>/openapi.json`.
2. Update its SHA-256 and curated fields in `catalog/source.json`.
3. Run `node scripts/build-catalog.mjs`.
4. Run `node scripts/verify-specs.mjs` before committing.

`catalog/catalog.json` is generated and committed intentionally: deployment consumers can fetch one immutable, validated catalog payload without needing a Node toolchain or package installation. The compiled payload includes searchable product metadata, HTTP operations, parameters, request-body schema relationships, every response/status schema relationship, and `components.schemas` data structures. Hub search can therefore follow an endpoint's complete input/output metadata graph instead of matching isolated names only.

## Branches and deployment

- `develop` publishes metadata to the Hub preview environment.
- `master` publishes metadata to the Hub production environment.

GitHub Actions validates the approved hashes and generated catalog before deploying Pontx Hub with the Vercel CLI. See [CONTRIBUTING.md](./CONTRIBUTING.md) for the review workflow and required repository secrets.
