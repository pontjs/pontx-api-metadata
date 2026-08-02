# Contributing to Pontx API Metadata

Thank you for helping make reliable API metadata available to developers and agents.

## Branch workflow

- `develop` is the integration branch. Pushes deploy the preview environment after validation.
- `master` is the production branch. Pushes deploy the production environment after validation.
- Open feature and metadata pull requests against `develop`.
- Promote reviewed changes from `develop` to `master` with a pull request.

Do not commit directly to `master` except for an explicitly approved emergency fix.

## Add or update an API

1. Add the approved OpenAPI document at `specs/<slug>/openapi.json`.
2. Add or update the curated entry in `catalog/source.json`.
3. Record the exact SHA-256 of the OpenAPI document in `approvedSha256`.
4. Run `node scripts/build-catalog.mjs`.
5. Run `node scripts/verify-specs.mjs`.
6. Commit both the source metadata and generated `catalog/catalog.json`.

Every API must have a stable upstream source, an attribution URL, a reviewed license, HTTPS servers, and credentials represented only as environment-variable names. Never commit real API keys or access tokens.

## Pull request checklist

- The OpenAPI document parses successfully.
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

The workflow validates the catalog, checks out the public Hub repository, and deploys it with `METADATA_REPO_RAW_URL` pinned to the pushed metadata branch. `develop` creates a Vercel Preview deployment; `master` deploys Production.
