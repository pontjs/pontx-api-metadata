import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import {
  compareLocalizedDocuments,
  isTranslatableText
} from "./lib/localization.mjs";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const specRoot = path.join(root, "specs/dropbox-sign");
const zhPath = path.join(specRoot, "openapi.json");
const enPath = path.join(specRoot, "locales/en-US/openapi.json");
const provenancePath = path.join(specRoot, "provenance.json");
const zh = JSON.parse(fs.readFileSync(zhPath, "utf8"));
const en = JSON.parse(fs.readFileSync(enPath, "utf8"));
const provenance = JSON.parse(fs.readFileSync(provenancePath, "utf8"));
const candidates = JSON.parse(
  fs.readFileSync(path.join(root, "catalog/api-collection-candidates.json"), "utf8")
);
const catalogSource = JSON.parse(fs.readFileSync(path.join(root, "catalog/source.json"), "utf8"));

const methods = new Set(["get", "put", "post", "delete", "patch", "head", "options", "trace"]);
const pinnedRevision = "f0c7887f2f56fb7a082b5db78a09856df2cb6ccf";
const pinnedSourceUrl =
  `https://raw.githubusercontent.com/hellosign/hellosign-openapi/${pinnedRevision}/openapi.yaml`;

function fail(message) {
  throw new Error(message);
}

function assert(condition, message) {
  if (!condition) fail(message);
}

function sha256(file) {
  return crypto.createHash("sha256").update(fs.readFileSync(file)).digest("hex");
}

function operationEntries(document) {
  return Object.entries(document.paths).flatMap(([pathname, pathItem]) =>
    Object.entries(pathItem)
      .filter(([method]) => methods.has(method))
      .map(([method, operation]) => ({ pathname, method, pathItem, operation }))
  );
}

function resolveLocal(document, ref) {
  assert(typeof ref === "string" && ref.startsWith("#/"), `expected local reference, got ${ref}`);
  return ref.slice(2).split("/").reduce((value, segment) =>
    value[segment.replaceAll("~1", "/").replaceAll("~0", "~")], document);
}

function dereference(document, value, seen = new Set()) {
  if (!value?.$ref) return value;
  assert(!seen.has(value.$ref), `cyclic parameter reference ${value.$ref}`);
  return dereference(document, resolveLocal(document, value.$ref), new Set([...seen, value.$ref]));
}

function walk(value, visit, segments = []) {
  visit(value, segments);
  if (Array.isArray(value)) {
    value.forEach((item, index) => walk(item, visit, [...segments, index]));
  } else if (value && typeof value === "object") {
    Object.entries(value).forEach(([key, item]) => walk(item, visit, [...segments, key]));
  }
}

function countExternalReferences(document) {
  let count = 0;
  walk(document, (value) => {
    if (value && typeof value === "object" &&
      typeof value.$ref === "string" && !value.$ref.startsWith("#/")) count += 1;
  });
  return count;
}

function countKey(document, target) {
  let count = 0;
  walk(document, (value) => {
    if (value && typeof value === "object" && Object.hasOwn(value, target)) count += 1;
  });
  return count;
}

function mediaCounts(document) {
  const request = {};
  const response = {};
  for (const { operation } of operationEntries(document)) {
    for (const mediaType of Object.keys(operation.requestBody?.content ?? {})) {
      request[mediaType] = (request[mediaType] ?? 0) + 1;
    }
    const operationResponseTypes = new Set(
      Object.values(operation.responses ?? {}).flatMap((item) => Object.keys(item.content ?? {}))
    );
    for (const mediaType of operationResponseTypes) {
      response[mediaType] = (response[mediaType] ?? 0) + 1;
    }
  }
  return { request, response };
}

function sortedMatches(value, expression) {
  return [...value.matchAll(expression)].map((match) => match[0]).sort();
}

assert(provenance.status === "candidate-pre-admission", "provenance must remain pre-admission");
assert(provenance.source.revision === pinnedRevision, "provenance revision drifted");
assert(provenance.source.url === pinnedSourceUrl, "provenance source URL must pin the revision");
assert(
  provenance.source.sha256 === "7535b8f1a18865de14f6e31e2e648fe31f6340d6ae120215425d6a6021ada25c",
  "pinned upstream OAS hash drifted"
);
assert(
  provenance.repositoryLicense.sha256 ===
    "9a2384fe250ebd5ca3854b11fa2d0c2855e95284f6326851ebe6e29cfa5e424a",
  "pinned repository license hash drifted"
);
assert(provenance.source.declaredLicense === "MIT", "OAS license declaration must remain MIT");
assert(provenance.repositoryLicense.spdx === "Apache-2.0", "repository license must remain Apache-2.0");
assert(provenance.repositoryLicense.scopeStatus === "reviewed", "repository license scope must be reviewed");
assert(provenance.repositoryLicense.noticeFileAtPinnedRevision === "not-present",
  "pinned repository NOTICE finding drifted");
assert(
  provenance.licenseEvidence.readme.sha256 ===
    "bc3a09ef9d7a66e1ef11320ef02e83a2406ffceeff5617f69d05e12430e7b3bd" &&
    provenance.licenseEvidence.readme.line === 188,
  "pinned README license evidence drifted"
);
assert(provenance.licenseEvidence.officialGeneratedSdks.license === "MIT",
  "official generated SDK license record drifted");
assert(
  sha256(path.join(specRoot, "LICENSE")) ===
    "9a2384fe250ebd5ca3854b11fa2d0c2855e95284f6326851ebe6e29cfa5e424a",
  "retained upstream LICENSE drifted"
);
assert(fs.existsSync(path.join(specRoot, "ATTRIBUTION.md")), "source attribution is missing");
assert(provenance.normalization.networkRequiredAtBuildTime === false,
  "candidate normalization must remain offline at build time");
assert(provenance.normalization.importer === "scripts/import-dropbox-sign-candidate.mjs" &&
  fs.existsSync(path.join(root, provenance.normalization.importer)), "deterministic importer is missing");
assert(sha256(zhPath) === provenance.outputs["zh-CN"].sha256, "zh-CN output hash drifted");
assert(sha256(enPath) === provenance.outputs["en-US"].sha256, "en-US output hash drifted");

const candidate = candidates.products.find((product) => product.slug === "dropbox-sign");
assert(candidate, "Dropbox Sign candidate record is missing");
assert(candidate.admissionDecision === "not-approved", "candidate must not claim admission");
assert(candidate.gateStatus.redistribution === "passed", "reviewed redistribution gate must remain passed");
assert(candidate.gateStatus.contract === "passed", "the pinned complete contract should remain passed");
assert(candidate.gateStatus.risk === "pending", "risk review must remain pending");
assert(candidate.gateStatus.sdkCli === "pending", "SDK/CLI publication must remain pending");
assert(candidate.contractSource.url === pinnedSourceUrl, "candidate source URL drifted");
assert(candidate.contractSource.sourceSha256 === provenance.source.sha256, "candidate source hash drifted");
assert(candidate.contractSource.license === "Apache-2.0", "candidate OAS content license drifted");
assert(candidate.contractSource.repositoryLicense === "Apache-2.0", "candidate repository license drifted");
assert(candidate.contractSource.oasDeclaredLicense === "MIT", "candidate OAS license drifted");
assert(candidate.contractSource.officialGeneratedSdkLicense === "MIT", "candidate SDK license record drifted");
assert(candidate.contractSource.normalizationManifest === "specs/dropbox-sign/provenance.json",
  "candidate must point to the normalization manifest");
assert(!candidate.blockers.some((blocker) => blocker.gate === "redistribution"),
  "reviewed repository redistribution must not retain a conflict blocker");
assert(candidate.blockers.filter((blocker) => blocker.gate === "risk").length >= 2,
  "candidate needs protocol/media and mutation risk blockers");
assert(!catalogSource.apis.some((api) => api.slug === "dropbox-sign"),
  "pre-admission Dropbox Sign must not enter catalog/source.json");

const localeErrors = compareLocalizedDocuments(zh, en);
if (localeErrors.length) {
  fail(`locale structure differs:\n${localeErrors.slice(0, 50).join("\n")}`);
}

let translatedNodes = 0;
walk(zh, (zhValue, segments) => {
  if (!isTranslatableText(segments, zhValue)) return;
  const enValue = segments.reduce((value, segment) => value[segment], en);
  translatedNodes += 1;
  assert(zhValue.trim() && enValue.trim(), `empty prose at /${segments.join("/")}`);
  const cjkRequired = !["Dropbox Sign API", "Dropbox Sign v3 API"].includes(enValue);
  assert(!cjkRequired || /\p{Script=Han}/u.test(zhValue),
    `zh-CN prose lacks useful Chinese text at /${segments.join("/")}`);
  for (const expression of [/`[^`]+`/g, /https?:\/\/[^\s)<]+/g, /(?<=\]\()[^)]+(?=\))/g]) {
    assert(JSON.stringify(sortedMatches(zhValue, expression)) ===
      JSON.stringify(sortedMatches(enValue, expression)),
    `protected prose tokens differ at /${segments.join("/")}`);
  }
});
assert(translatedNodes === provenance.normalization.localization.translatedNodes,
  `translated prose count drifted: ${translatedNodes}`);

const entries = operationEntries(en);
assert(Object.keys(en.paths).length === 67, "expected 67 paths");
assert(entries.length === 73, "expected 73 operations");
assert(Object.keys(en.components.schemas).length === 217, "expected 217 schemas");
assert(en.info.license?.name === "MIT", "normalized OAS must preserve info.license MIT");
const operationIds = entries.map(({ operation }) => operation.operationId);
assert(operationIds.every((id) => typeof id === "string" && id), "every operation needs an operationId");
assert(new Set(operationIds).size === operationIds.length, "operationIds must be unique");
walk(en, (value, segments) => {
  if (value && typeof value === "object" && typeof value.$ref === "string") {
    assert(value.$ref.startsWith("#/"), `external reference remains at /${segments.join("/")}`);
    assert(resolveLocal(en, value.$ref) !== undefined,
      `unresolved local reference ${value.$ref} at /${segments.join("/")}`);
  }
});
assert(Object.keys(en.components.schemas).filter((name) => name.startsWith("EventCallback")).length === 27,
  "expected 27 EventCallback-prefixed schemas");
assert(en.tags.length === 12 && en.tags.every((tag) => typeof tag.description === "string"),
  "all 12 tag Markdown descriptions must be inlined");
assert(Object.keys(en["x-webhooks"] ?? {}).length === 2 &&
  Object.values(en["x-webhooks"]).every((item) => typeof item.post?.description === "string"),
  "both webhook Markdown descriptions must be inlined");
assert(countExternalReferences(en) === 0, "normalized spec must not retain external references");
assert(countKey(en, "x-codeSamples") === 0, "x-codeSamples must be removed");
assert(provenance.normalization.removed[0].occurrences === 73, "removed x-codeSamples count drifted");
assert(provenance.normalization.removed[0].externalReferences === 511,
  "removed code-sample reference count drifted");
assert(provenance.normalization.inlined.jsonExamples === 152, "inlined JSON example count drifted");
assert(provenance.normalization.inlined.tagMarkdown === 12, "inlined tag Markdown count drifted");
assert(provenance.normalization.inlined.webhookDescriptionMarkdown === 2,
  "inlined webhook Markdown count drifted");

assert(JSON.stringify(mediaCounts(en)) === JSON.stringify(provenance.mediaCoverage),
  `media coverage drifted: ${JSON.stringify(mediaCounts(en))}`);

let readyExamples = 0;
let examplesRequiringInput = 0;
let unresolvedInputs = 0;
let nonGetOperations = 0;
const sensitiveDownloadGets = [];
for (const { pathname, method, pathItem, operation } of entries) {
  const context = `${method.toUpperCase()} ${pathname} (${operation.operationId})`;
  assert(operation["x-pontx-documentation-status"] === "official", `${context}: source status drifted`);
  assert(JSON.stringify(operation["x-pontx-evidence"]) === JSON.stringify([pinnedSourceUrl]),
    `${context}: evidence must pin the official OAS`);
  assert(operation["x-pontx-verified-at"] === "2026-08-14", `${context}: verification date drifted`);
  assert(operation["x-pontx-proxy-enabled"] === false, `${context}: proxy must remain disabled`);
  assert(typeof operation["x-pontx-proxy-disabled-reason"] === "string" &&
    operation["x-pontx-proxy-disabled-reason"].trim(), `${context}: proxy reason is missing`);

  const example = operation["x-pontx-request-examples"]?.default;
  assert(example, `${context}: request example is missing`);
  assert(example.request && !Array.isArray(example.request), `${context}: request must be an object`);
  for (const location of ["path", "query", "headers"]) {
    assert(example.request[location] && !Array.isArray(example.request[location]),
      `${context}: request.${location} must be an object`);
  }
  for (const name of Object.keys(example.request.headers)) {
    assert(!["authorization", "cookie", "x-api-key", "api-key"].includes(name.toLowerCase()),
      `${context}: credential header ${name} is forbidden in request examples`);
  }
  assert(!/(?:bearer\s+[a-z0-9._-]+|basic\s+[a-z0-9+/=]+|api[_-]?key["']?\s*[:=]\s*["'][^"']+)/i
    .test(JSON.stringify(example.request)), `${context}: request example appears to contain credentials`);
  assert(/^2\d\d$/.test(example.expectedStatus) &&
    Object.hasOwn(operation.responses, example.expectedStatus), `${context}: expected status is invalid`);
  const unresolved = example.unresolved ?? [];
  const unresolvedKeys = new Set(unresolved.map((input) => `${input.in}:${input.name}`));
  assert(unresolvedKeys.size === unresolved.length, `${context}: duplicate unresolved inputs`);
  unresolvedInputs += unresolved.length;
  if (unresolved.length) examplesRequiringInput += 1;
  else readyExamples += 1;

  const parameters = [...(pathItem.parameters ?? []), ...(operation.parameters ?? [])]
    .map((parameter) => dereference(en, parameter));
  for (const location of ["path", "query", "header"]) {
    const requestLocation = location === "header" ? "headers" : location;
    for (const [name, value] of Object.entries(example.request[requestLocation])) {
      const parameter = parameters.find((item) => item.in === location && item.name === name);
      assert(parameter, `${context}: undeclared preset ${location}:${name}`);
      const evidence = [parameter.example, parameter.schema?.example, parameter.schema?.default]
        .find((item) => ["string", "number", "boolean"].includes(typeof item));
      assert(Object.is(value, evidence), `${context}: preset ${location}:${name} lacks upstream example/default evidence`);
    }
  }
  for (const parameter of parameters.filter((item) => item.required &&
    ["path", "query", "header"].includes(item.in))) {
    const requestLocation = parameter.in === "header" ? "headers" : parameter.in;
    assert(Object.hasOwn(example.request[requestLocation], parameter.name) ||
      unresolvedKeys.has(`${parameter.in}:${parameter.name}`),
    `${context}: required ${parameter.in}:${parameter.name} is neither preset nor unresolved`);
  }
  if (operation.requestBody?.required) {
    assert(Object.hasOwn(example.request, "body") || unresolvedKeys.has("body:body"),
      `${context}: required body is neither preset nor unresolved`);
  }
  if (method !== "get") nonGetOperations += 1;
  const responseMedia = new Set(
    Object.values(operation.responses ?? {}).flatMap((response) => Object.keys(response.content ?? {}))
  );
  if (method === "get" && ["application/pdf", "application/zip"].some((type) => responseMedia.has(type))) {
    sensitiveDownloadGets.push(operation.operationId);
  }
}

assert(readyExamples === 13, `ready request example count drifted: ${readyExamples}`);
assert(examplesRequiringInput === 60,
  `requires-input request example count drifted: ${examplesRequiringInput}`);
assert(unresolvedInputs === 72, `unresolved input count drifted: ${unresolvedInputs}`);
assert(nonGetOperations === 46, `non-GET operation count drifted: ${nonGetOperations}`);
assert(JSON.stringify(sensitiveDownloadGets.sort()) ===
  JSON.stringify(["faxFiles", "signatureRequestFiles", "templateFiles"].sort()),
"sensitive download GET set drifted");

console.log(
  "Verified Dropbox Sign candidate pre-admission: " +
  "67 paths, 73 operations, 217 schemas, 27 EventCallback schemas, " +
  "1,738 bilingual prose nodes, 73 proxy-disabled request examples, and 0 external refs."
);
