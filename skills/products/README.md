# Product Skill sources

Each admitted API may own one concise, English-only product Skill at
`skills/products/pontx-<apiSlug>/`. Product Skills explain provider-specific
integration workflows, choices, caveats, and realistic task flows. They do not
repeat the Endpoint, parameter, Schema, auth, package-version, or other current
facts already available from the same-commit product hierarchy.

```text
skills/products/pontx-<apiSlug>/{SKILL.md,references/<name>.md?}
skills/manifests/pontx-<apiSlug>.json
skills/evidence/pontx-<apiSlug>.json
skills/evals/pontx-<apiSlug>.json
```

One `references/<name>.md` file is allowed only when a workflow cannot remain
clear within the main Skill. Declare every installed file in the separate
manifest. Keeping manifests, evidence, and evals outside the discoverable Skill
directory ensures skills.sh and ClawHub do not add them to installation bundles.

Use [`AUTHORING_PROMPT.md`](./AUTHORING_PROMPT.md) as the generation contract.
The JSON Schemas live in [`../schemas/`](../schemas/). Run:

```bash
pnpm skills:build
pnpm skills:validate
pnpm skills:test
```

`skills/registry.json` is a deterministic, generated, single-file registry. It
contains only `published` Skills and embeds their installable file contents.
Hub must fetch the registry and product hierarchy from the same immutable
metadata commit. Missing or invalid registry data hides all product Skills;
the universal Hub Skill remains independently available.

## Lifecycle and versions

- New Skills start at `1.0.0` and normally remain `draft` while being curated.
- Facts or wording fixes increment patch.
- New workflows or few-shot scenarios increment minor.
- Incompatible identity, installation, or behavior changes increment major.
- Changing installed bytes without increasing the version is rejected in CI.
- Only `published` Skills are included in the registry or marketplace jobs.

Content-only PRs may be independently reviewed and enrolled in repository
auto-merge. The allowed scope is limited to product Skill source files and the
generated registry. License, CI, scripts, schemas, documentation, or any other
infrastructure change always requires normal human review.
