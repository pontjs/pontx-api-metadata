# Pontx API Metadata

[![Validate and publish metadata](https://github.com/pontjs/pontx-api-metadata/actions/workflows/publish.yml/badge.svg?branch=master)](https://github.com/pontjs/pontx-api-metadata/actions/workflows/publish.yml)

The source-of-truth catalog for [Pontx Hub](https://pontx-hub.vercel.app). It stores approved OpenAPI documents and compiles them into the catalog consumed by the Hub.

## APIs

- Frankfurter API — exchange-rate reference data
- Dida365 Open API — task and project management

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
