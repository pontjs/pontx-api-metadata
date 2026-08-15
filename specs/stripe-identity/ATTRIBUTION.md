# Stripe Identity contract attribution

The bilingual Stripe Identity OpenAPI documents in this directory are a
deterministic subproduct projection of Stripe's official `spec3.json` at Git
revision `325f3b157f7250f2a5d228b870d77bb63fc7e54c`.

- Source: <https://github.com/stripe/openapi/tree/325f3b157f7250f2a5d228b870d77bb63fc7e54c>
- Exact contract: <https://raw.githubusercontent.com/stripe/openapi/325f3b157f7250f2a5d228b870d77bb63fc7e54c/openapi/spec3.json>
- Source SHA-256: `3653ad45bbec54fcbe461c541c908355b715018bdf455a0e11b27bedb2cbdee5`
- Upstream license: MIT; an exact copy is retained in
  `LICENSE.stripe-openapi`.

The projection includes every path whose official path begins with
`/v1/identity/`, all transitively referenced Identity success Schemas, the
official authentication schemes, and the original form-urlencoded request and
JSON response media types. The common Stripe error object is intentionally
projected to the Identity-relevant public fields while allowing additional
properties; this avoids falsely pulling hundreds of unrelated payments,
billing, issuing, and treasury Schemas into the Identity product boundary.

Pontx is not affiliated with Stripe. Stripe and Stripe Identity are trademarks
of Stripe, Inc. The original contract and this projection are provided under
their respective license notices without warranty.
