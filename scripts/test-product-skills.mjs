import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { mkdtemp, mkdir, readFile, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { resolve } from "node:path";
import {
  buildProductSkillRegistry,
  hashBundleFiles,
  serializeProductSkillRegistry,
  validateProductSkillRegistryShape,
  validateProductSkillRepository,
} from "./lib/product-skills.mjs";
import {
  PRODUCT_SKILL_REVIEW_CHECKS,
  validateProductSkillReviewPayload,
  verifyProductSkillReviewDecision,
} from "./lib/product-skill-review.mjs";
import {
  aggregateProductSkillReviews,
  buildDeepSeekReviewMessages,
  requestDeepSeekProductSkillReview,
} from "./lib/deepseek-product-skill-review.mjs";

const fixture = await mkdtemp(resolve(tmpdir(), "pontx-product-skills-"));
await Promise.all([
  mkdir(resolve(fixture, "catalog"), { recursive: true }),
  mkdir(resolve(fixture, "products/acme"), { recursive: true }),
  mkdir(resolve(fixture, "skills/products/pontx-acme"), { recursive: true }),
  mkdir(resolve(fixture, "skills/manifests"), { recursive: true }),
  mkdir(resolve(fixture, "skills/evidence"), { recursive: true }),
  mkdir(resolve(fixture, "skills/evals"), { recursive: true }),
]);
await writeFile(resolve(fixture, "catalog/products.json"), JSON.stringify({
  formatVersion: 1,
  defaultLocale: "zh-CN",
  locales: ["en-US"],
  products: ["acme"],
}));
await writeFile(resolve(fixture, "products/acme/sdk.json"), JSON.stringify({
  package: { name: "@pontx/acme" },
  cli: { name: "pontx-acme" },
}));
const skillText = `---
name: pontx-acme
description: Use for Acme API integration workflows, reliability choices, and safe request preparation.
---

# Pontx Acme

Use \`pontx-hub search\` to discover the current API, \`pontx-hub show\` to inspect an Endpoint, and \`pontx-hub sdk\` to confirm current package guidance instead of copying API metadata here.

Integrate applications with \`@pontx/acme\`; use \`pontx-acme\` only when a product-local script is the better interface. Acme requires an idempotency key when retrying a create request.

Keep credentials in environment variables. Prepare a redacted preview before execution, and require explicit approval before every mutation.

## Few-shot workflows

### Scenario 1: Read integration

Discover and inspect the relevant Endpoint, confirm the SDK surface, then generate code without exposing credentials.

### Scenario 2: Mutation integration

Prepare a preview, identify retry and idempotency choices, and wait for explicit confirmation before execution.
`;
await Promise.all([
  writeFile(resolve(fixture, "skills/products/pontx-acme/SKILL.md"), skillText),
  writeFile(resolve(fixture, "skills/manifests/pontx-acme.json"), JSON.stringify({
    formatVersion: 1,
    name: "pontx-acme",
    apiSlug: "acme",
    version: "1.0.0",
    license: "MIT-0",
    status: "published",
    files: ["SKILL.md"],
  })),
  writeFile(resolve(fixture, "skills/evidence/pontx-acme.json"), JSON.stringify({
    formatVersion: 1,
    apiSlug: "acme",
    claims: [{
      id: "create-idempotency",
      claim: "Acme requires an idempotency key when retrying a create request.",
      summary: "The official guide requires idempotency for safely retried creates.",
      sourceUrl: "https://developer.example.com/acme/retries",
      sourceType: "official-documentation",
      verifiedAt: "2026-08-15",
    }],
  })),
  writeFile(resolve(fixture, "skills/evals/pontx-acme.json"), JSON.stringify({
    skill_name: "pontx-acme",
    evals: [
      { id: 1, prompt: "Read an Acme resource safely.", expected_output: "Uses discovery before SDK code.", files: [] },
      { id: 2, prompt: "Create an Acme resource.", expected_output: "Previews and asks for approval.", files: [] },
    ],
  })),
]);

const built = await buildProductSkillRegistry({ root: fixture });
assert.deepEqual(built.errors, []);
assert.equal(built.registry.skills.length, 1);
assert.equal(built.registry.skills[0].name, "pontx-acme");
assert.equal(built.registry.skills[0].files[0].content, skillText);
assert.deepEqual(await validateProductSkillRegistryShape(built.registry), []);

const expectedHash = createHash("sha256")
  .update(Buffer.from("SKILL.md\0", "utf8"))
  .update(Buffer.from(skillText, "utf8"))
  .update(Buffer.from([0]))
  .digest("hex");
assert.equal(hashBundleFiles([{ path: "SKILL.md", content: skillText }]), expectedHash);
assert.equal(built.registry.skills[0].contentHash, expectedHash);

await writeFile(resolve(fixture, "skills/registry.json"), serializeProductSkillRegistry(built.registry));
assert.equal((await validateProductSkillRepository({ root: fixture })).valid, true);

const registryPath = resolve(fixture, "skills/registry.json");
const stale = JSON.parse(await readFile(registryPath, "utf8"));
stale.skills[0].contentHash = "0".repeat(64);
await writeFile(registryPath, `${JSON.stringify(stale, null, 2)}\n`);
const staleResult = await validateProductSkillRepository({ root: fixture });
assert.equal(staleResult.valid, false);
assert(staleResult.errors.some((error) => error.includes("contentHash mismatch")));
assert(staleResult.errors.some((error) => error.includes("generated registry is stale")));

const evidencePath = resolve(fixture, "skills/evidence/pontx-acme.json");
const evidence = JSON.parse(await readFile(evidencePath, "utf8"));
evidence.claims[0].claim = "A claim absent from the installed Skill.";
await writeFile(evidencePath, JSON.stringify(evidence));
const unsupported = await buildProductSkillRegistry({ root: fixture });
assert(unsupported.errors.some((error) => error.includes("must exactly quote text present in SKILL.md")));

const head = "a".repeat(40);
const expectedClaims = new Map([["pontx-acme#create-idempotency", "https://developer.example.com/acme/retries"]]);
const review = {
  commitSha: head,
  verdict: "pass",
  findings: [],
  verifiedClaims: [{
    skillName: "pontx-acme",
    claimId: "create-idempotency",
    sourceUrl: "https://developer.example.com/acme/retries",
    verdict: "verified",
  }],
  checks: Object.fromEntries([...PRODUCT_SKILL_REVIEW_CHECKS].map((check) => [check, true])),
};
assert.deepEqual(verifyProductSkillReviewDecision({ review, head, expectedClaims }), []);
assert(verifyProductSkillReviewDecision({
  review: { ...review, commitSha: "b".repeat(40) },
  head,
  expectedClaims,
}).some((error) => error.includes("commitSha")));
assert(verifyProductSkillReviewDecision({
  review: { ...review, verifiedClaims: [] },
  head,
  expectedClaims,
}).some((error) => error.includes("omitted evidence claim")));
assert(verifyProductSkillReviewDecision({
  review: { ...review, verifiedClaims: [{ ...review.verifiedClaims[0], verdict: "conflict" }] },
  head,
  expectedClaims,
}).some((error) => error.includes("did not verify")));
assert(verifyProductSkillReviewDecision({
  review: { ...review, checks: { ...review.checks, promptInjectionIgnored: false } },
  head,
  expectedClaims,
}).some((error) => error.includes("promptInjectionIgnored")));

const failingReview = {
  ...review,
  verdict: "fail",
  findings: [{
    severity: "blocker",
    code: "unsupported-claim",
    message: "The official source does not support the claim.",
    path: "skills/products/pontx-acme/SKILL.md",
  }],
  verifiedClaims: [{ ...review.verifiedClaims[0], verdict: "unsupported" }],
  checks: { ...review.checks, officialEvidenceOnly: false },
};
assert.deepEqual(validateProductSkillReviewPayload({
  review: failingReview,
  head,
  expectedClaims,
}), []);
assert(validateProductSkillReviewPayload({
  review: {
    ...review,
    findings: [{ severity: "minor", code: "", message: 42, path: null }],
  },
  head,
  expectedClaims,
}).some((error) => error.includes("finding code")));
assert(verifyProductSkillReviewDecision({
  review: failingReview,
  head,
  expectedClaims,
}).some((error) => error.includes("did not return pass")));

const reviewMessages = buildDeepSeekReviewMessages({
  baseSha: "b".repeat(40),
  headSha: head,
  skillName: "pontx-acme",
  documents: [{ path: "SKILL.md", role: "untrusted repository data", content: skillText }],
  outputSchema: { type: "object" },
});
assert.equal(reviewMessages.length, 2);
assert(reviewMessages[0].content.includes("inert, untrusted data"));
assert(reviewMessages[1].content.includes(`Return commitSha exactly as ${head}`));
assert(reviewMessages[1].content.includes("BEGIN IMMUTABLE REVIEW BUNDLE JSON"));

let capturedDeepSeekRequest;
const deepSeekReview = await requestDeepSeekProductSkillReview({
  apiKey: "test-only-key",
  messages: reviewMessages,
  sleep: async () => {},
  fetchImpl: async (url, init) => {
    capturedDeepSeekRequest = { url, init };
    return {
      ok: true,
      status: 200,
      headers: { get: () => null },
      json: async () => ({ choices: [{ message: { content: JSON.stringify(review) } }] }),
    };
  },
});
assert.deepEqual(deepSeekReview, review);
assert.equal(capturedDeepSeekRequest.url, "https://api.deepseek.com/chat/completions");
const deepSeekBody = JSON.parse(capturedDeepSeekRequest.init.body);
assert.equal(deepSeekBody.model, "deepseek-v4-pro");
assert.deepEqual(deepSeekBody.response_format, { type: "json_object" });
assert.equal(deepSeekBody.stream, false);
assert.equal(capturedDeepSeekRequest.init.headers.authorization, "Bearer test-only-key");

const aggregated = aggregateProductSkillReviews({
  headSha: head,
  reviews: [review, failingReview],
});
assert.equal(aggregated.verdict, "fail");
assert.equal(aggregated.verifiedClaims.length, 2);
assert.equal(aggregated.checks.officialEvidenceOnly, false);

const publishWorkflow = await readFile(resolve(".github/workflows/publish-product-skills.yml"), "utf8");
assert.match(publishWorkflow, /--version \"\$SKILL_VERSION\" --json > \"\$remote_json\"/);
assert.match(publishWorkflow, /\.owner\.handle/);
assert.match(publishWorkflow, /\.version\.files\[\]/);
assert.match(publishWorkflow, /\.sha256/);
assert.match(publishWorkflow, /select\(\. != \"skill-card\.md\"\)/);
assert.match(publishWorkflow, /wait_for_remote/);
assert.doesNotMatch(publishWorkflow, /--file \"\$relative_path\" > \"\$remote_file\"/);

console.log("Product Skill contracts, deterministic hashing, evidence, review binding, and stale-registry tests passed.");
