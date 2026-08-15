# Pontx API Metadata

[![Validate metadata](https://github.com/pontjs/pontx-api-metadata/actions/workflows/publish.yml/badge.svg?branch=main)](https://github.com/pontjs/pontx-api-metadata/actions/workflows/publish.yml)

The product-isolated source of truth for [Pontx Hub](https://pontx.dev).
PontxSpec is the only canonical API protocol. OpenAPI may be retained as import
evidence under a product's `sources/` directory, but Hub sync, validation,
search, and SDK generation never read it.

## Repository contract

```text
catalog/products.json

products/<slug>/
├── product.json
├── spec.pontx.json
├── sdk.json
├── locales/en-US/{product.json,spec.pontx.json}
└── sources/{provenance.json,openapi.json?}

candidates/<slug>/candidate.json
```

`catalog/products.json` is a small ordered admission list only. It contains no
Endpoint, Schema, package, or SDK-quality data. Every published product owns
its overview, canonical Chinese PontxSpec, SDK evidence, translations, and
optional immutable provenance files.

`spec.pontx.json` declares `pontx` and `style` and owns all Endpoint, Schema,
server, security, request-example, and execution metadata. RESTFul specs need
HTTP method/path; other styles remain loadable and searchable without a
fabricated HTTP executor. Locale specs are structurally identical to `zh-CN`;
only approved prose can differ.

`sdk.json` pins its raw canonical specification path, SHA-256, and metadata
commit. SDK repositories mirror those exact bytes and reject independent drift.

There is deliberately no `catalog/source.json`, `catalog/catalog.json`, or
centralized catalog locale file. Hub derives its compatibility data and search
indexes from the isolated product sources at one exact metadata commit.

## Editing and verification

1. Update only `products/<slug>/` for a product-specific change.
2. Update the corresponding locale prose without changing protocol structure.
3. Recompute the raw canonical spec SHA in `sdk.json` and pin SDK evidence to
   the metadata commit containing those bytes.
4. Keep upstream OAS only under `sources/` when licensing or reproducibility
   requires it.

```bash
pnpm install
pnpm test
pnpm validate
git diff --check
```

Candidates are isolated below [`candidates/`](./candidates/); a candidate can
enter Hub only after complete product files, evidence, and operator-published
SDK status are admitted in `catalog/products.json`.

## Deployment

- `develop` validates and deploys a Hub Preview.
- `main` validates and deploys Hub Production.

Hub builds use an exact metadata commit. npm publication remains an operator
action and is never triggered by metadata validation.
