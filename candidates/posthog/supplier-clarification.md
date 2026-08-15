# Draft: PostHog Public API contract and redistribution clarification

Status: draft only — not sent

Hello PostHog team,

We are evaluating an independently authored, open-source TypeScript SDK and
API directory entry for the PostHog Public API. We will not copy PostHog's
Enterprise Edition source, website assets outside `posthog.com/contents/`, or
an unlicensed hosted-schema payload. To make the integration accurate and
avoid any ambiguity, could you please clarify the following?

1. Is there a versioned, complete OpenAPI document for the hosted Public API
   that PostHog permits third parties to redistribute and use to create
   independently authored API metadata and SDKs? If so, please provide its
   immutable URL/revision and applicable license.
2. If the hosted schema at `/api/schema/?format=json` is the intended contract,
   may it be stored, redistributed, and used for independent derived metadata
   and SDK generation? Please identify its license and any required notices.
3. For Public API routes implemented through `ee/` (including Groups,
   quota limits, dashboard collaborators, experiment resources, and Vercel
   management routes), is there an approved public contract source or a
   permission path for independently documenting the route, parameters,
   responses, errors, and SDK surface without using Enterprise Edition source?
4. May you provide a public, versioned event contract for the task-run and
   wizard-session Server-Sent Events endpoints, including payload variants,
   authentication/scopes, resume/reconnect behavior, keepalives, terminal
   events, and errors?
5. Are there any trademark, attribution, naming, or distribution requirements
   beyond describing the SDK as an independent integration for PostHog and
   linking back to your official documentation?

Our current audit recorded an observed hosted document with 1,326 paths, 1,877
operations, and 3,441 schemas. We have intentionally not copied that mutable
document. A pinned source-only routing inventory identifies 363 registration
calls, 14 of which are EE-dependent; it is not being represented as a complete
API contract.

Thank you. A response that identifies the authoritative, fixed contract and
redistribution terms will let us publish accurate documentation while keeping
PostHog customers in control of their credentials and request execution.
