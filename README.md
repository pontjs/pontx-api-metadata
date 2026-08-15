# Pontx API Metadata

[![Validate and publish metadata](https://github.com/pontjs/pontx-api-metadata/actions/workflows/publish.yml/badge.svg?branch=main)](https://github.com/pontjs/pontx-api-metadata/actions/workflows/publish.yml)

The product-isolated source of truth for [Pontx Hub](https://pontx.dev). PontxSpec is the only canonical API protocol in this repository. OpenAPI may be retained as import evidence under a product's `sources/` directory, but Hub sync, validation, search, and SDK generation never read it.

## Published products

- Frankfurter API v1
- Frankfurter API v2
- Dida365 Open API
- Massive Stock Market Data API
- ECB Data Portal SDMX API
- Dropbox Sign v3 API
- Stripe Identity API

Only slugs in [`catalog/products.json`](./catalog/products.json) are published. That file is intentionally a small ordered list; it contains no product details, Endpoints, Schemas, or SDK fields.

## Repository contract

```text
catalog/
└── products.json

products/
└── <slug>/
    ├── product.json
    ├── spec.pontx.json
    ├── sdk.json
    ├── locales/
    │   └── en-US/
    │       ├── product.json
    │       └── spec.pontx.json
    └── sources/
        ├── provenance.json
        └── openapi.json        # optional evidence; never a build input

candidates/
└── <slug>/candidate.json
```

- `product.json` owns product summary, presentation, legal attribution, pricing, credential guidance, execution policy, and Quick Start.
- `spec.pontx.json` owns API/Endpoint definitions, Schemas, servers, security, request examples, evidence, and Endpoint execution metadata. It must declare `pontx` and `style`.
- `locales/en-US/spec.pontx.json` is structurally identical to the Chinese baseline. Only approved prose may differ; IDs, parameters, Schemas, constraints, examples, security, servers, and execution semantics are immutable across locales.
- `sdk.json` owns package/CLI status, client and Controller contracts, examples, coverage, quality evidence, and the canonical specification path/hash/metadata commit. Full coverage is declared only as `coverage.mode: "full"`; Endpoint IDs are listed only for partial coverage and are never duplicated in the client contract.
- `sources/` is evidence only. No validation, Hub, search, or SDK build path may depend on files there.

The repository deliberately has no aggregate catalog payload. Hub derives its search index, Schema summaries, and compatibility view models from each product's PontxSpec at build time.

## Editing a product

Chinese (`zh-CN`) is the structural baseline.

1. Change only `products/<slug>/` for a product-specific update.
2. Update `product.json` for product copy/policy, `spec.pontx.json` for API protocol data, and `sdk.json` for SDK release evidence.
3. Apply the same protocol structure to every locale PontxSpec, translating prose only.
4. Recompute `sdk.json.spec.sha256` from the exact raw bytes of the Chinese `spec.pontx.json`.
5. Pin published SDK evidence to the metadata commit containing those exact bytes.
6. Run the repository checks.

```bash
pnpm install
pnpm test
pnpm validate
git diff --check
```

Every Endpoint needs a stable `operationId`. RESTFul specs additionally require `method` and `path`; other Pontx styles remain loadable and searchable without an HTTP executor. Untagged Endpoints remain flat and must never receive a synthetic `common` or `default` Controller.

## Request examples and credentials

`requestExamples` belongs directly to each PontxSpec Endpoint. A complete example groups path, query, header, and body values that are safe to store; dynamic IDs, cursors, timestamps, or provider state go in `unresolved`. Credentials are never stored as examples.

Credential instructions and environment-variable names live in `product.json`. The actual security schemes and requirements live in PontxSpec. Real credentials, private endpoints, and user data must never be committed.

## Candidate products

Unadmitted products are isolated under [`candidates/`](./candidates/). [`candidates/products.json`](./candidates/products.json) is the candidate list and [`docs/api-collection-growth-priority.md`](./docs/api-collection-growth-priority.md) is the roadmap. Candidate slugs never enter Hub unless they are deliberately promoted into `catalog/products.json` with a complete product directory and published SDK evidence.

## Deployment and immutable revisions

- `develop` deploys a Hub Preview after validation.
- `main` deploys Hub Production after validation.

The workflow passes the exact metadata Git SHA to Hub. Production never follows a mutable branch URL. SDK npm publication remains an operator action; metadata and Hub only verify declared versions and evidence.

See [CONTRIBUTING.md](./CONTRIBUTING.md) for the review checklist and [`docs/sdk-publication-review.md`](./docs/sdk-publication-review.md) for package policy.
