# Pontx API Metadata

[![Validate and publish metadata](https://github.com/pontjs/pontx-api-metadata/actions/workflows/publish.yml/badge.svg?branch=main)](https://github.com/pontjs/pontx-api-metadata/actions/workflows/publish.yml)

The source-of-truth catalog for [Pontx Hub](https://pontx.dev). It stores approved OpenAPI documents and compiles them into the catalog consumed by the Hub.

## APIs

- Frankfurter API v1 — legacy exchange-rate reference data
- Frankfurter API v2 — multi-provider exchange rates, currencies, and provider attribution
- Dida365 Open API — task and project management
- Massive Stock Market Data API — official stock trades, aggregates, snapshots, and reference data
- Dropbox Sign v3 API — signatures, templates, teams, files, fax, and event callbacks
- ECB Data Portal SDMX API — public European Central Bank statistics and structural metadata
- Stripe Identity API — verification sessions and reports; documentation and local SDK/CLI only

Only collections that pass the SDK publication and redistribution gate remain
in the catalog. See
[`catalog/sdk-publication-review.md`](./catalog/sdk-publication-review.md) for
the current decisions, provider evidence, package-only restrictions, and
re-entry rule. Massive remains an official API collection, but Hub proxying and
market-data redistribution are disabled; callers use their own account and API
key directly from the SDK or CLI.
Stripe Identity is similarly documentation-only in the Hub: all eight
Endpoints remain proxy-disabled because identity documents, selfies, identity
numbers, contact data, verification results, and client secrets are sensitive.

## Candidate API products

The ranked growth roadmap lives in
[`catalog/api-collection-growth-priority.md`](./catalog/api-collection-growth-priority.md),
and its 24 supplier-level products have structured intake records in
[`catalog/api-collection-candidates.json`](./catalog/api-collection-candidates.json).
Candidate records are deliberately separate from the generated Hub catalog:
they record authoritative evidence, exact product boundaries, protocol and
compliance holds, redistribution status, and the next admission action. Records
that have passed every gate remain there as an admission and maintenance ledger;
only their matching entries in `catalog/source.json` are published metadata.

Run the candidate gate whenever the roadmap or intake evidence changes:

```bash
node scripts/verify-candidates.mjs
node scripts/verify-dropbox-sign-candidate.mjs
node scripts/verify-stripe-identity.mjs
node scripts/verify-ecb-data-portal-candidate.mjs
node scripts/verify-fx-candidates.mjs
```

The admitted ECB collection is independently reconstructed from current ECB
pages and can be reproduced offline with
`node scripts/build-ecb-data-portal-candidate.mjs`. Its published package,
immutable CI evidence, and registry release are sealed in provenance. The FX
verifier also seals quality findings for Open Exchange Rates, CurrencyBeacon,
and Twelve Data without copying provider-owned mutable contracts into the
repository.

The admitted Dropbox Sign contract is normalized without network access from
already-pinned upstream checkout. Reproduce or review the English source
normalization with:

```bash
node scripts/import-dropbox-sign-candidate.mjs \
  --upstream /path/to/hellosign-openapi \
  --check
```

A candidate moves into `catalog/source.json` only after every admission gate
passes and the operator-published SDK/CLI evidence is available. Collections
that contain SSE or another unsupported realtime protocol remain whole and
deferred; they are never admitted by deleting those endpoints.

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
node scripts/verify-candidates.mjs
node scripts/verify-stripe-identity.mjs
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

Published SDK entries also declare a structured `sdkContract`: the package
export/factory shape, controller mapping, credential environment variables,
and the exact Endpoint set present in the published package. Hub uses this
contract to generate type-checkable snippets and to avoid advertising SDK code
for Endpoints that are not included in the declared package version.
Controller mappings use a JavaScript identifier for explicitly tagged
Endpoints and `null` for untagged Endpoints whose methods live directly on the
client. Never synthesize `common`, `default`, or another public Controller for
an Endpoint without an explicit OAS `tags` value.

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

## SDK quality evidence

Every published SDK entry includes version-bound CI evidence for its source
commit. Catalog compilation requires every unit test to pass, rejects skipped
or todo tests, and requires the built-package E2E suite to pass. The Hub renders
that evidence as the public badge used by SDK pages and package READMEs:

```text
https://pontx.dev/badges/sdk/<api-slug>.svg
```

Update `sdkQuality` only from a completed successful SDK workflow run. The
record must keep the exact package version, full source commit, unit totals,
tested Node.js versions, verification date, repository URL, and immutable
workflow-run URL.

## Agent skills

- [`pontx-api-collection-builder`](./skills/pontx-api-collection-builder/SKILL.md) owns the complete onboarding lifecycle: authoritative and iteratively verified API evidence, production-ready bilingual metadata, generated and safety-tested `@pontx/<slug>` SDK plus `pontx-<slug>` CLI, npm publication, staged Hub rollout, and production verification through the website, universal CLI, semantic search, and AI-assistant call path.
- [`pontx-api-collection-governance`](./skills/pontx-api-collection-governance/SKILL.md) audits and remediates existing collections for freshness, drift, compatibility, deprecation, localization, execution safety, SDK truth, and consumer readiness.
- The internal [`pontx-metadata-quality-loop`](https://github.com/pontjs/pontx-beta/tree/main/.agents/skills/pontx-metadata-quality-loop) workflow lives in `pontx-beta`; it owns the scorer, dynamic benchmark, state machine, and evaluator-auditor protocol while this repository remains the Metadata source of truth.

These skills treat review, publishing, and execution as separate authorization boundaries. They do not commit, push, deploy, or call mutating APIs merely because a user asked to inspect or govern metadata.
