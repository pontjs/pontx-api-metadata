# Pontx API Metadata

The source-of-truth catalog for [Pontx Hub](https://pontx-hub.vercel.app). It stores approved OpenAPI documents and compiles them into the catalog consumed by the Hub.

## APIs

- Frankfurter API — exchange-rate reference data
- Dida365 Open API — task and project management

## Updating the catalog

1. Replace an approved document under `specs/<api>/openapi.json`.
2. Update its SHA-256 and curated fields in `catalog/source.json`.
3. Run `node scripts/build-catalog.mjs`.
4. Run `node scripts/verify-specs.mjs` before committing.

`catalog/catalog.json` is generated and committed intentionally: deployment consumers can fetch one immutable, validated catalog payload without needing a Node toolchain or package installation.

