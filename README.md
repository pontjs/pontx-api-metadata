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

skills/products/pontx-<slug>/{SKILL.md,references/<name>.md?}
skills/{manifests,evidence,evals}/pontx-<slug>.json
skills/registry.json
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

## Product Skills

Every admitted API can publish a concise `pontx-<slug>` Agent Skill. Product
Skills contain provider-specific integration workflows, best practices,
caveats, and two or three realistic task flows. They deliberately defer live
Endpoint, parameter, Schema, auth, and package details to `pontx-hub` and the
same-commit product hierarchy instead of copying API metadata.

Only `SKILL.md` and an optional declared reference live in the discoverable
`skills/products/<name>/` folder. Version/status manifests, primary-source
evidence ledgers, and smoke evals live in separate control directories so they
are reviewed in this repository but are not installed by skills.sh or ClawHub.
See [`skills/products/README.md`](./skills/products/README.md) and the
[authoring prompt](./skills/products/AUTHORING_PROMPT.md).

`skills/registry.json` is deterministic and embeds only `published` bundles.
Hub consumes it together with the product hierarchy from one immutable metadata
commit; a missing or invalid registry hides product Skills without affecting
the separately maintained universal Hub Skill.

## Editing and verification

1. Update only `products/<slug>/` for a product-specific change.
2. Update the corresponding locale prose without changing protocol structure.
3. Recompute the raw canonical spec SHA in `sdk.json` and pin SDK evidence to
   the metadata commit containing those bytes.
4. Keep upstream OAS only under `sources/` when licensing or reproducibility
   requires it.

```bash
pnpm install
pnpm skills:build
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
action and is never triggered by metadata validation. Published product Skill
changes are install-tested through the open skills CLI and released to ClawHub
with immutable SemVer after the independent review gate. ClawHub credentials
remain protected GitHub secrets and are never stored in repository files.

Repository-authored software and product Skills are licensed under MIT-0 unless
a file carries a separate notice. Upstream evidence under `products/*/sources/`
retains its provider-specific license or terms; see [`LICENSE`](./LICENSE).
