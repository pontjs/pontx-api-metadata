---
name: pontx-mongodb-atlas-admin
description: Safely integrate the MongoDB Atlas Administration API through Pontx. Use for Atlas inventory, organization and project discovery, local SDK or CLI setup, and explicitly approved administration changes.
---

# MongoDB Atlas Administration API

Use this skill for MongoDB Atlas administration work. Resolve the live
Endpoint, request, Schema, credential, and package information rather than
copying a contract into application code:

```bash
pontx-hub search "MongoDB Atlas <capability>" --type endpoint --json
pontx-hub show <returned-resource-id>
pontx-hub sdk mongodb-atlas-admin
```

Use `@pontx/mongodb-atlas-admin` for application code. Use
`pontx-mongodb-atlas-admin` for explicitly requested caller-local operations.
Hub discovery is not an execution path: Atlas management calls stay
caller-local. Keep OAuth client credentials or legacy Digest credentials out
of source, shell history, inputs, logs, and chat.

## Start with least privilege and a read

Use an Atlas OAuth service account with only the required role when it is
available. Keep `MONGODB_ATLAS_SERVICE_ACCOUNT_CLIENT_ID` and
`MONGODB_ATLAS_SERVICE_ACCOUNT_CLIENT_SECRET` in the caller environment. Use
legacy Digest public/private keys only when the caller requires that mode. Do
not include either credential form in generated snippets, previews, or output.

Start with a narrow read and the current Endpoint contract. Atlas management
data can expose account, organization, project, network, backup, billing, log,
and access information, so return only the fields the user asked for. Do not
broaden a read from one organization or project to all accessible resources
without clear user intent.

## Preview every direct call

List current local Endpoints and preview exact input before any direct call:

```bash
pnpm exec pontx-mongodb-atlas-admin list apis
pnpm exec pontx-mongodb-atlas-admin call organizations listOrgs --dry-run
```

Every mutation must be previewed with redacted input and then receive explicit
confirmation. Explain the target, affected resource, irreversible effect,
credential scope, retry behavior, and idempotency decision. Only then run the
unchanged input with its request-bound confirmation token:

```bash
pnpm exec pontx-mongodb-atlas-admin call <controller> <Endpoint> \
  <required-options> --confirm '<preview-confirmation-token>'
```

If the target, input, credential scope, or intended effect changes, discard the
token and create a new preview. Never execute a delete, restore, rotation,
network, access-policy, backup, billing, or cluster change from an ambiguous
request.

## Few-shot workflows

### Scenario 1: Read organization inventory

**User:** "List the organizations available to this service account; do not
change anything."

**Approach:** Resolve the current list Endpoint, prepare a redacted local
preview with caller-owned credentials, obtain approval for the direct read,
and return only the requested organization identifiers and names.

### Scenario 2: Change a project network setting

**User:** "Open access for this project so the migration can proceed."

**Approach:** Do not infer the requested CIDR, project, duration, or rollback
plan. Resolve the exact Endpoint and current configuration, explain the
security impact, prepare a redacted preview, and stop for explicit confirmation
before a caller-local mutation.

### Scenario 3: Rotate a credential

**User:** "Rotate the Atlas API key now."

**Approach:** Determine the exact key, dependent workloads, safe storage
destination, overlap window, and rollback plan. Preview the rotation without
printing credentials, obtain explicit approval, then execute only the unchanged
request and redact the result.
