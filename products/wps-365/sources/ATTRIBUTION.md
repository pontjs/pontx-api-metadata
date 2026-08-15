# Attribution — WPS 365 OpenAPI

The Pontx WPS 365 OpenAPI collection is an independent, derived metadata product. It
was built from the following official upstream sources:

## Official OpenAPI specification

- Source: `https://open.wps.cn/v7/developer/cli_tools/specs/api-internal`
- Title: "Kingsoft Office Open APIs", version `v7` (OpenAPI 3.0.0)
- SHA-256: `3a2dfe64b4debf6435405e2e15e3b7682504c4c91c842c8a491783ea72ae8548`
- The same bytes are distributed inside the official CLI package
  [`@wps365-open/wps365@0.2.27`](https://www.npmjs.com/package/@wps365-open/wps365),
  which is published under the **MIT** license with maintainer emails at `wps.cn`.

## Official curated command catalog

- Source: `https://open.wps.cn/v7/developer/cli_tools/specs/curated-internal`
- SHA-256: `24e11b4206c126c7f4f7bf614f2e2422c9a3bcad4b02311ae94ce88f0b3dffd5`

## Official developer documentation

- Docs site: `https://open.wps.cn/documents/app-integration-dev/` (zh/en markdown
  mirrors at `https://open-docs.wpscdn.cn/docs-md/{zh,en}/app-integration-dev/`)

## Terms of use

- This collection reproduces the *machine contract* (paths, methods, parameters,
  schemas) from the official OpenAPI document for interoperability and developer
  convenience. It does **not** copy the prose of the official documentation site.
  All product, endpoint, and schema prose in this collection is independently
  written. The collection does not imply official endorsement by Kingsoft.
- API usage, credentials, and data-handling obligations are governed by the WPS
  Open Platform developer agreement between the caller and Kingsoft. Callers use
  their own credentials; Pontx does not proxy or aggregate WPS 365 data on behalf
  of callers.

## Upstream license preservation

When redistributing or embedding this metadata, retain this ATTRIBUTION file and
the provenance record (`sources/provenance.json`) alongside the collection.
