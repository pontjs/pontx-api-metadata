import assert from "node:assert/strict";
import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { compareLocalizedDocuments } from "./lib/localization.mjs";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const specRoot = path.join(root, "specs/stripe-identity");
const zhPath = path.join(specRoot, "openapi.json");
const enPath = path.join(specRoot, "locales/en-US/openapi.json");
const provenance = JSON.parse(fs.readFileSync(path.join(specRoot, "provenance.json"), "utf8"));
const zh = JSON.parse(fs.readFileSync(zhPath, "utf8"));
const en = JSON.parse(fs.readFileSync(enPath, "utf8"));
const candidates = JSON.parse(fs.readFileSync(path.join(root, "catalog/api-collection-candidates.json"), "utf8"));
const source = JSON.parse(fs.readFileSync(path.join(root, "catalog/source.json"), "utf8"));
const methods = new Set(["get", "put", "post", "delete", "patch", "head", "options", "trace"]);
const revision = "325f3b157f7250f2a5d228b870d77bb63fc7e54c";
const sourceUrl = `https://raw.githubusercontent.com/stripe/openapi/${revision}/openapi/spec3.json`;

function sha256(file) {
  return crypto.createHash("sha256").update(fs.readFileSync(file)).digest("hex");
}

function operations(document) {
  return Object.entries(document.paths ?? {}).flatMap(([pathname, pathItem]) =>
    Object.entries(pathItem)
      .filter(([method]) => methods.has(method))
      .map(([method, operation]) => ({ pathname, method, operation })),
  );
}

function walk(value, visitor, pointer = "$") {
  if (Array.isArray(value)) {
    value.forEach((item, index) => walk(item, visitor, `${pointer}[${index}]`));
    return;
  }
  if (!value || typeof value !== "object") return;
  for (const [key, child] of Object.entries(value)) {
    visitor(key, child, `${pointer}.${key}`);
    walk(child, visitor, `${pointer}.${key}`);
  }
}

function resolveLocal(document, ref) {
  assert(ref.startsWith("#/"), `external reference is forbidden: ${ref}`);
  return ref.slice(2).split("/").reduce((value, segment) =>
    value?.[segment.replaceAll("~1", "/").replaceAll("~0", "~")], document);
}

assert.equal(provenance.status, "approved");
assert.equal(provenance.source.revision, revision);
assert.equal(provenance.source.url, sourceUrl);
assert.equal(provenance.source.sha256, "3653ad45bbec54fcbe461c541c908355b715018bdf455a0e11b27bedb2cbdee5");
assert.equal(provenance.license.spdx, "MIT");
assert.equal(provenance.license.sha256, "8c1ce883f4eee7b531e0b7872dbfc72d410ced87dfff9501305de05ca8d203e5");
assert.equal(sha256(path.join(specRoot, "LICENSE.stripe-openapi")), provenance.license.sha256);
assert(fs.existsSync(path.join(specRoot, "ATTRIBUTION.md")));
assert(fs.existsSync(path.join(root, provenance.derivation.script)));
assert.equal(sha256(zhPath), provenance.outputs["zh-CN"].sha256);
assert.equal(sha256(enPath), provenance.outputs["en-US"].sha256);

const candidate = candidates.products.find((product) => product.slug === "stripe-identity");
assert(candidate, "Stripe Identity candidate is missing");
assert.equal(candidate.stage, "admitted");
assert.equal(candidate.admissionDecision, "approved");
assert(Object.values(candidate.gateStatus).every((status) => status === "passed"));
assert.deepEqual(candidate.blockers, []);
assert.equal(candidate.contractSource.url, sourceUrl);
assert.equal(candidate.contractSource.sourceSha256, provenance.source.sha256);
assert.equal(candidate.contractSource.zhCnSha256, provenance.outputs["zh-CN"].sha256);
assert.equal(candidate.contractSource.enUsSha256, provenance.outputs["en-US"].sha256);

const catalog = source.apis.find((api) => api.slug === "stripe-identity");
assert(catalog, "admitted Stripe Identity must be in catalog/source.json");
assert.equal(catalog.approvedSha256, provenance.outputs["zh-CN"].sha256);
assert.equal(catalog.approvedLocaleSha256["en-US"], provenance.outputs["en-US"].sha256);
assert.equal(catalog.packageName, "@pontx/stripe-identity");
assert.equal(catalog.sdkVersion, "0.1.1");
assert.equal(catalog.sdkStatus, "published");
assert.deepEqual(catalog.sdkQuality.unitTests, { passed: 5, total: 5, skipped: 0 });
assert.deepEqual(catalog.sdkQuality.nodeVersions, ["18", "20", "22"]);
assert.equal(catalog.sdkQuality.e2eStatus, "passed");
assert.equal(catalog.sdkQuality.sourceCommit, "2319bec517bb35b8d3512d1495f784193f178080");
assert.equal(catalog.sdkQuality.workflowRunUrl,
  "https://github.com/pontjs/stripe-identity/actions/runs/31858572852");
assert.equal(catalog.proxyEnabled, false);
assert.deepEqual(catalog.sdkContract.controllers, { default: null });
assert.equal(catalog.sdkContract.operations.length, 8);
assert.equal(catalog.quickStart.operationId, "getIdentityVerificationSessions");
assert.equal(catalog.auth.length, 1);
assert.equal(catalog.auth[0].envVar, "STRIPE_SECRET_KEY");

const localeErrors = compareLocalizedDocuments(zh, en);
assert.equal(localeErrors.length, 0, `localized contract drift:\n${localeErrors.slice(0, 20).join("\n")}`);
const entries = operations(en);
assert.equal(Object.keys(en.paths).length, 6);
assert.equal(entries.length, 8);
assert.equal(new Set(entries.map(({ operation }) => operation.operationId)).size, 8);
assert.equal(Object.keys(en.components.schemas).length, 35);
assert.equal(entries.filter(({ method }) => method === "post").length, 4);
assert.deepEqual(en.security, [{ basicAuth: [] }, { bearerAuth: [] }]);
assert.equal(en.components.securitySchemes.basicAuth.scheme, "basic");
assert.equal(en.components.securitySchemes.bearerAuth.scheme, "bearer");
assert(en.components.schemas.stripe_identity_verification_report);
assert(en.components.schemas.stripe_identity_verification_session);
assert(Object.keys(en.components.schemas).every((name) => /^[A-Za-z_$][A-Za-z0-9_$]*$/.test(name)));

const expectedIds = new Set(catalog.sdkContract.operations);
for (const { pathname, method, operation } of entries) {
  const label = `${method.toUpperCase()} ${pathname}`;
  assert(pathname.startsWith("/v1/identity/"));
  assert(expectedIds.delete(operation.operationId), `${label}: SDK operation evidence is missing or duplicated`);
  assert.match(operation.operationId, /^[a-z][A-Za-z0-9]*$/);
  assert.match(operation["x-pontx-upstream-operation-id"], /^[A-Z][A-Za-z0-9]*$/);
  assert.equal(operation.tags, undefined, `${label}: synthetic SDK tag detected`);
  assert.equal(operation["x-pontx-documentation-status"], "official");
  assert.equal(operation["x-pontx-proxy-enabled"], false);
  assert.match(operation["x-pontx-proxy-disabled-reason"], /highly sensitive personal data/);
  assert(operation["x-pontx-evidence"].includes(sourceUrl));
  assert.equal(operation["x-pontx-verified-at"], "2026-08-15");
  const example = operation["x-pontx-request-examples"]?.default;
  assert(example?.request && example.expectedStatus === "200", `${label}: reviewed example missing`);
  assert(!/sk_(?:test|live|restricted)_|authorization|secret[_-]?key/i.test(JSON.stringify(example)),
    `${label}: example contains a credential`);
  if (method === "get") assert.equal(operation.requestBody, undefined, `${label}: empty GET body returned`);
  if (method === "post") {
    assert(operation.requestBody?.content?.["application/x-www-form-urlencoded"],
      `${label}: form request contract missing`);
  }
  assert(Object.values(operation.responses).some((response) => response.content?.["application/json"]),
    `${label}: JSON response contract missing`);
}
assert.equal(expectedIds.size, 0, "catalog lists an operation absent from the OAS");

walk(en, (key, value, pointer) => {
  if (key === "$ref") assert(resolveLocal(en, value) !== undefined, `unresolved reference at ${pointer}`);
  if (typeof value === "string") {
    assert(!/\]\(\/docs\/|href="\/docs\//.test(value), `relative Stripe docs link at ${pointer}`);
  }
});

assert.equal(provenance.riskReview.classification, "high-sensitivity-identity");
assert.equal(provenance.riskReview.hubProxyEnabled, false);
assert.equal(provenance.riskReview.proxyDisabledOperations, 8);
assert.equal(provenance.riskReview.mutations.postOperations, 4);
assert.equal(provenance.riskReview.mutations.cancelIsIrreversible, true);
assert.equal(provenance.riskReview.mutations.redactionIsIrreversible, true);
assert.equal(provenance.sdk.status, "published");
assert.equal(provenance.sdk.sourceCommit, catalog.sdkQuality.sourceCommit);
assert.equal(provenance.sdk.workflowRunUrl, catalog.sdkQuality.workflowRunUrl);

console.log("Verified admitted Stripe Identity: pinned official 6-path/8-Endpoint contract, bilingual parity, 35 Schemas, zero Hub proxying, published flat SDK/CLI, and immutable CI evidence.");
