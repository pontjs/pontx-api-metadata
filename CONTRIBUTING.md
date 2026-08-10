# Contributing to Pontx API Metadata

Thank you for helping make reliable API metadata available to developers and agents.

## Branch workflow

- `develop` is the integration branch. Pushes deploy the preview environment after validation.
- `main` is the production branch. Pushes deploy the production environment after validation.
- Open feature and metadata pull requests against `develop`.
- Promote reviewed changes from `develop` to `main` with a pull request.

Do not commit directly to `main` except for an explicitly approved emergency fix.

## Add or update an API

1. Add the canonical Chinese OpenAPI document at `specs/<slug>/openapi.json`.
2. Add its structurally identical English translation at
   `specs/<slug>/locales/en-US/openapi.json`.
3. Add or update Chinese product metadata in `catalog/source.json` and English
   product copy in `catalog/locales/en-US.json`.
4. Record the exact SHA-256 values in `approvedSha256` and
   `approvedLocaleSha256.en-US`.
5. Run `node scripts/test-locales.mjs` and `node scripts/lint-locales.mjs`.
6. Run `node scripts/build-catalog.mjs` and `node scripts/verify-specs.mjs`.
7. Commit all source locale files and the generated `catalog/catalog.json`.

Locale names must be BCP 47 tags (`zh-CN`, `en-US`). A translation may change
only approved prose fields. Do not translate or reorder paths, HTTP methods,
operation IDs, tags, parameter names, Schema/property names, formats,
constraints, examples, security declarations, server URLs, or Pontx execution
policy. Locale lint reports violations with an exact JSON Pointer.

Every API must have a stable upstream source, an attribution URL, a reviewed license, HTTPS servers, and credentials represented only as environment-variable names. Never commit real API keys or access tokens.

For provider-owned but undocumented read-only web APIs, record `documentationStatus`, `evidenceUrls`, `verifiedAt`, and a bilingual `stabilityNote`. Each operation must also carry the matching `x-pontx-*` evidence extensions. Proxy execution may be enabled only for verified read-only endpoints with an endpoint-specific HTTPS server allowlist and curated fixed headers; login, account, trading, mutation, advertising, and user-data endpoints remain prohibited.

## Pull request checklist

- The OpenAPI document parses successfully.
- `node scripts/lint-locales.mjs` confirms that locale files differ only in prose.
- The approved SHA-256 matches the committed document.
- Chinese and English titles and summaries are useful and accurate.
- Important data structures have useful bilingual entries in `schemaTranslations`.
- Request parameters, request bodies, response descriptions, media types, and schema references are complete enough for semantic retrieval.
- Operation slugs remain stable unless the upstream operation identity changed.
- Mutating endpoints and authentication requirements are described correctly.
- `catalog/catalog.json` has been regenerated and committed.
- No credentials, private endpoints, or user data are present.

## Deployment setup

Repository administrators configure three GitHub Actions secrets:

- `VERCEL_TOKEN` with deployment access to the Pontx Hub project.
- `VERCEL_ORG_ID` for the `pontjs` Vercel team.
- `VERCEL_PROJECT_ID` for the Pontx Hub Vercel project.

The workflow validates the catalog, checks out the public Hub repository, and deploys it with `METADATA_REPO_RAW_URL` pinned to the pushed metadata branch. `develop` creates a Vercel Preview deployment; `main` deploys Production.
