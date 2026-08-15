# Contributing to Pontx API Metadata

## Branch workflow

- `develop` is the integration branch and deploys Preview after validation.
- `main` is the production branch and deploys Production after validation.
- Open product and protocol changes against `develop`, then promote reviewed metadata to `main`.

## Add or update a product

Create or modify only the owning directory:

```text
products/<slug>/
├── product.json
├── spec.pontx.json
├── sdk.json
├── locales/en-US/{product.json,spec.pontx.json}
└── sources/{provenance.json,openapi.json?}
```

PontxSpec is canonical. If authoritative evidence arrives as OAS2/OAS3, import it once with the official `@pontx/spec` importer, review every Endpoint and Schema, commit the resulting PontxSpec, and treat the OAS only as optional evidence from then on. Do not add conversion to a build or validation path.

Product metadata belongs in `product.json`; servers, security schemes, API definitions, Schemas, examples, and Endpoint policy belong in `spec.pontx.json`; SDK release data belongs in `sdk.json`. Do not duplicate those fields across files.

Locale names use BCP 47 tags. Locale PontxSpecs may change translated prose only. They must not change API keys, operation IDs, tags, request/response structure, parameters, Schemas, constraints, examples, security, servers, or execution semantics.

Published SDK evidence must include:

- the exact npm package and version;
- a full SDK source commit and immutable CI run;
- Node.js/test/package E2E evidence;
- `coverage.mode: "full"`, or the exact Endpoint IDs for partial coverage;
- the canonical PontxSpec path, raw-byte SHA-256, and a metadata commit containing those bytes.

## Add or update a candidate

Candidates live at `candidates/<slug>/candidate.json` and must be listed in `candidates/products.json`. Keep them out of `catalog/products.json` until authority, redistribution, complete-contract, transport, risk, and SDK/CLI publication gates all pass.

Use supplier-owned documentation, specifications, source repositories, licenses, or terms as evidence. Preserve the complete supplier product boundary. Unsupported transports and unresolved legal or safety issues block admission; do not delete difficult Endpoints to make a candidate appear complete.

## Required checks

```bash
pnpm install
pnpm test
pnpm validate
git diff --check
```

## Add or update a product Skill

Use the admitted API slug and stable name `pontx-<slug>`. Put only installable
files below `skills/products/<name>/`; keep its manifest, official-evidence
ledger, and two or three smoke evals in `skills/manifests/`, `skills/evidence/`,
and `skills/evals/`. Follow `skills/products/AUTHORING_PROMPT.md`, regenerate
`skills/registry.json`, and keep the Skill concise rather than copying protocol
metadata.

New Skills start at `1.0.0`. Installed-byte changes require a higher SemVer;
only `published` entries reach the registry and marketplace workflow. A
content-only PR may enter a fresh, stateless DeepSeek review and repository
auto-merge, but any script, schema, workflow, license, or documentation change
requires normal human review. The reviewer calls DeepSeek's OpenAI-compatible
Chat Completions endpoint directly with an immutable, read-only review bundle;
it does not reuse an author session or expose repository tools to source
content. After the unchanged reviewed head merges, that workflow explicitly
dispatches the main metadata deployment and the idempotent marketplace rollout;
this avoids relying on suppressed recursive `push` events from `GITHUB_TOKEN`.
Missing `DEEPSEEK_API_KEY` or ClawHub credentials block those external steps;
never weaken or bypass the gate.

The hierarchy test fixes the current production baseline at 7 products, 142 Endpoints, and 322 Schemas and also validates a non-HTTP RPC fixture. The earlier 5-product baseline was 126 Endpoints and 275 Schemas; ECB Data Portal and Stripe Identity were admitted before this migration, and the hierarchy preserves every currently published resource. If a deliberate product change alters those counts, update the fixture expectation in the same reviewed change.

## Pull request checklist

- Only the intended product/candidate directories changed.
- `catalog/products.json` contains slugs only and remains ordered.
- PontxSpec declares a supported `pontx` version and explicit `style`.
- RESTFul Endpoints have method/path; other styles do not need HTTP fields.
- Stable operation IDs, resource slugs, explicit tags, servers, security, examples, media types, responses, and Schema constraints are preserved.
- Chinese and English PontxSpecs are structurally identical outside approved prose.
- Product credentials are environment-variable names/instructions only; security semantics remain in PontxSpec.
- SDK coverage, version, quality, spec SHA, and metadata commit are accurate.
- Every server and evidence URL is HTTPS.
- No real credentials, private endpoints, or user data are present.
- Candidate slugs are absent from the published product list.
- Product Skill claims exactly map to current official evidence and do not
  conflict with `product.json`, `spec.pontx.json`, or `sdk.json`.
- Product Skill controls, SemVer, compactness budgets, generated registry,
  independent review, and marketplace dry-runs pass when in scope.

## Deployment setup

Repository administrators configure `VERCEL_TOKEN`, `VERCEL_ORG_ID`, and `VERCEL_PROJECT_ID`. The workflow deploys Hub with `METADATA_REPO_RAW_URL` and `METADATA_REPO_COMMIT` pinned to the pushed Git SHA, never to a moving branch reference. After a verified Production deployment, it also updates the Hub project's Production `METADATA_REPO_COMMIT`; this keeps later Hub Git deployments on the same latest validated metadata commit instead of silently reverting to an older catalog or Skill registry.
