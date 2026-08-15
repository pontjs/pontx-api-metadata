# PostHog `ee/` route-resolution ledger

Verified: 2026-08-15 (Asia/Shanghai)

This ledger covers the 14 static router registrations tagged
`requires-ee-resolution` in [the source inventory](source-route-inventory.json).
It records permitted public documentation that can support future independent
reconstruction, but it does **not** copy, inspect, or derive from `ee/` source.
No row below has a complete request/response/schema contract yet.

| Static route tree(s) | Why the root-MIT source is insufficient | Permitted documentation evidence | Current result |
| --- | --- | --- | --- |
| `api/projects/persons/`, `api/person/` | The router contains both MIT fallback and EE enterprise implementations; a hosted instance can select the EE branch. | MIT `contents/` [persons API prose](https://github.com/PostHog/posthog.com/blob/7516256e3a9d19863cb6952afbe4282d7a4433f8/contents/docs/api/persons/persons_list.mdx). | Supplemental documentation only; endpoint forms, implementation selection, and all schemas remain unverified. |
| `api/projects/groups/`, `api/projects/groups_types/`, `api/projects/groups_types/metrics/` | The hosted group views are imported inside the router's `EE_AVAILABLE` branch. | MIT `contents/` [groups list prose](https://github.com/PostHog/posthog.com/blob/7516256e3a9d19863cb6952afbe4282d7a4433f8/contents/docs/api/groups/groups_list.mdx). | The list resource is described, but group-type and metrics contracts are absent; not reconstructable yet. |
| `api/projects/quota_limits/` | The view is imported from `ee.api.quota_limits`. | No matching API contract found in the pinned MIT documentation tree. | Unresolved. |
| `api/projects/dashboards/collaborators/` | The product route conditionally imports an EE collaborator view. | No matching API contract found in the pinned MIT documentation tree. | Unresolved. |
| `api/projects/experiments/`, `api/projects/experiment_holdouts/`, `api/projects/experiment_saved_metrics/` | The route module's `if not EE_AVAILABLE: return` guard makes the complete surface EE-gated; two viewsets import directly from `ee/`. | MIT [Experiments API](https://github.com/PostHog/posthog.com/blob/7516256e3a9d19863cb6952afbe4282d7a4433f8/contents/docs/experiments/surfaces/api.mdx) states the three base routes, lifecycle classes, and `experiment:read`/`experiment:write` scopes. | High-level routes and scopes are supported; methods, actions, errors, and schemas are still incomplete. |
| `api/vercel/v1/installations/`, nested `resources/`, `api/vercel/v1/products/`, `api/vercel/proxy/` | All four viewsets are imported from `ee.api.vercel`. | MIT [Vercel integration documentation](https://github.com/PostHog/posthog.com/blob/7516256e3a9d19863cb6952afbe4282d7a4433f8/contents/docs/libraries/vercel.mdx) covers SDK integration, not the management routes. | No usable management API contract; unresolved. |

The corresponding non-`ee/` router locations are
[core registrations](https://github.com/PostHog/posthog/blob/6fca5f877e5140ddbc82c018a5458b27505c9450/posthog/api/rest_router.py#L430-L468),
[experiment guard](https://github.com/PostHog/posthog/blob/6fca5f877e5140ddbc82c018a5458b27505c9450/products/experiments/backend/routes.py#L1-L23),
and [dashboard conditional registration](https://github.com/PostHog/posthog/blob/6fca5f877e5140ddbc82c018a5458b27505c9450/products/dashboards/backend/routes.py#L25-L45).
They establish that an EE dependency exists; they do not authorize inspecting
or reusing the EE implementation.

## Gate consequence

The `contract` and `redistribution` gates stay pending. Before a complete
PostHog Public API product can be published, each unresolved row needs either a
pinned, explicitly publishable first-party contract or a written supplier
permission covering independent reconstruction and redistribution. The public
documentation above is sufficient only for the limited facts recorded here.

The unsent, ready-to-review request for that clarification is in
[supplier-clarification.md](supplier-clarification.md).
