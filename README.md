# Pontx API Metadata

[![Validate and publish metadata](https://github.com/pontjs/pontx-api-metadata/actions/workflows/publish.yml/badge.svg?branch=main)](https://github.com/pontjs/pontx-api-metadata/actions/workflows/publish.yml)

The source-of-truth catalog for [Pontx Hub](https://pontx-hub.vercel.app). It stores approved OpenAPI documents and compiles them into the catalog consumed by the Hub.

## APIs

- Frankfurter API v1 — legacy exchange-rate reference data
- Frankfurter API v2 — multi-provider exchange rates, currencies, and provider attribution
- Dida365 Open API — task and project management
- Massive Stock Market Data API — official stock trades, aggregates, snapshots, and reference data

Only collections that pass the SDK publication and redistribution gate remain
in the catalog. See
[`catalog/sdk-publication-review.md`](./catalog/sdk-publication-review.md) for
the current decisions, provider evidence, package-only restrictions, and
re-entry rule. Massive remains an official API collection, but Hub proxying and
market-data redistribution are disabled; callers use their own account and API
key directly from the SDK or CLI.

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

### Successful request examples

Every Endpoint declares at least one coherent successful request through the
operation-level `x-pontx-request-examples` extension. Unlike independent
OpenAPI parameter examples, one entry represents the complete set of path,
query, header, and body values that belong together:

```json
{
  "x-pontx-request-examples": {
    "default": {
      "request": {
        "path": {},
        "query": { "base": "USD" },
        "headers": {}
      },
      "expectedStatus": "200",
      "unresolved": [
        {
          "in": "query",
          "name": "cursor",
          "source": { "kind": "runtime", "reason": "provider-state" }
        }
      ]
    }
  }
}
```

Stable values belong in `request`. Values that cannot be curated safely are
omitted and listed in `unresolved`; they may be IDs, timestamps, cursors,
provider state, or any other dynamic input. An unresolved source is either a
prerequisite Endpoint (`kind: "operation"` with `operationId`) or a documented
runtime reason (`kind: "runtime"` with `reason`). Credentials are never example
values.

Each API also selects a ready-to-send landing-page example in
`catalog/source.json` as `quickStart.operationId` and, when needed,
`quickStart.requestExampleId`. The compiler validates every required input,
successful response status, approved server, dependency reference, credential
boundary, locale counterpart, and Quick Start target before emitting
`requestExamples` and `quickStart` into the catalog.

## Branches and deployment

- `develop` publishes metadata to the Hub preview environment.
- `main` publishes metadata to the Hub production environment.

GitHub Actions validates the approved hashes and generated catalog before deploying Pontx Hub with the Vercel CLI. See [CONTRIBUTING.md](./CONTRIBUTING.md) for the review workflow and required repository secrets.

## Agent skills

- [`pontx-api-collection-builder`](./skills/pontx-api-collection-builder/SKILL.md) turns authoritative API evidence into a production-ready bilingual OpenAPI collection, catalog entry, execution policy, approved hashes, and verified Hub integration.
- [`pontx-api-collection-governance`](./skills/pontx-api-collection-governance/SKILL.md) audits and remediates existing collections for freshness, drift, compatibility, deprecation, localization, execution safety, SDK truth, and consumer readiness.
- The internal [`pontx-metadata-quality-loop`](https://github.com/pontjs/pontx-beta/tree/main/.agents/skills/pontx-metadata-quality-loop) workflow lives in `pontx-beta`; it owns the scorer, dynamic benchmark, state machine, and evaluator-auditor protocol while this repository remains the Metadata source of truth.

These skills treat review, publishing, and execution as separate authorization boundaries. They do not commit, push, deploy, or call mutating APIs merely because a user asked to inspect or govern metadata.
