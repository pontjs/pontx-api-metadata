import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { compareLocalizedDocuments } from "./lib/localization.mjs";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const specRoot = path.join(root, "specs/ecb-data-portal");
const zhPath = path.join(specRoot, "openapi.json");
const enPath = path.join(specRoot, "locales/en-US/openapi.json");
const provenancePath = path.join(specRoot, "provenance.json");
const zh = JSON.parse(fs.readFileSync(zhPath, "utf8"));
const en = JSON.parse(fs.readFileSync(enPath, "utf8"));
const provenance = JSON.parse(fs.readFileSync(provenancePath, "utf8"));
const candidates = JSON.parse(
  fs.readFileSync(path.join(root, "catalog/api-collection-candidates.json"), "utf8")
);
const catalog = JSON.parse(fs.readFileSync(path.join(root, "catalog/source.json"), "utf8"));
const methods = new Set(["get", "put", "post", "delete", "patch", "head", "options", "trace"]);

function assert(condition, message) {
  if (!condition) throw new Error(message);
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
  assert(ref.startsWith("#/"), `external reference is not allowed: ${ref}`);
  return ref.slice(2).split("/").reduce((value, segment) =>
    value?.[segment.replaceAll("~1", "/").replaceAll("~0", "~")], document);
}

function walk(value, visit, pointer = "") {
  visit(value, pointer);
  if (Array.isArray(value)) {
    value.forEach((item, index) => walk(item, visit, `${pointer}/${index}`));
  } else if (value && typeof value === "object") {
    Object.entries(value).forEach(([key, item]) =>
      walk(item, visit, `${pointer}/${key.replaceAll("~", "~0").replaceAll("/", "~1")}`));
  }
}

assert(provenance.status === "approved", "ECB provenance must record formal approval");
assert(provenance.slug === "ecb-data-portal", "ECB provenance slug drifted");
assert(provenance.license.status === "reviewed", "ECB website reuse terms must remain reviewed");
assert(provenance.derivation.method.includes("Independent reconstruction"),
  "ECB candidate must remain an independent reconstruction");
assert(provenance.derivation.liveChecks.length === 3 &&
  provenance.derivation.liveChecks.every((check) => check.status === 200),
"all three ECB route families need bounded live evidence");
assert(provenance.sdkProbe.status === "operator-published" &&
  provenance.sdkProbe.generatedOperations === 8 && provenance.sdkProbe.generatedSchemas === 12 &&
  provenance.sdkProbe.typeCheck === "passed" &&
  provenance.sdkProbe.esmCjsDeclarationsBuild === "passed" &&
  provenance.sdkProbe.cliBuild === "passed" &&
  provenance.sdkProbe.unitTests.status === "passed" &&
  provenance.sdkProbe.unitTests.passed === 3 && provenance.sdkProbe.unitTests.total === 3 &&
  provenance.sdkProbe.unitTests.skipped === 0 &&
  provenance.sdkProbe.e2eTests.status === "passed" &&
  provenance.sdkProbe.e2eTests.passed === 3 && provenance.sdkProbe.e2eTests.total === 3 &&
  provenance.sdkProbe.e2eTests.skipped === 0 &&
  provenance.sdkProbe.npmPackDryRun.status === "passed" &&
  provenance.sdkProbe.publicationReady === true,
"ECB published SDK/CLI proof must remain complete");
assert(provenance.publication?.packageName === "@pontx/ecb-data-portal" &&
  provenance.publication?.version === "0.1.0" &&
  provenance.publication?.sourceCommit === "533ef4716cca0b66b50bb7a810f84504a4008f46" &&
  provenance.publication?.workflowRunUrl ===
    "https://github.com/pontjs/ecb-data-portal/actions/runs/31814621599",
"ECB publication provenance drifted");
assert(sha256(zhPath) === provenance.outputs["zh-CN"].sha256, "ECB zh-CN hash drifted");
assert(sha256(enPath) === provenance.outputs["en-US"].sha256, "ECB en-US hash drifted");
assert(compareLocalizedDocuments(zh, en).length === 0, "ECB locale structure drifted");

const entries = operationEntries(zh);
assert(zh.openapi === "3.1.2", "ECB candidate must use OpenAPI 3.1.2");
assert(Object.keys(zh.paths).length === 8, "ECB candidate must expose eight path variants");
assert(entries.length === 8, "ECB candidate must expose eight operations");
assert(Object.keys(zh.components.schemas).length === 12, "ECB candidate must expose 12 schemas");
assert(new Set(entries.map(({ operation }) => operation.operationId)).size === entries.length,
  "ECB operationIds must be unique");
assert(entries.every(({ method }) => method === "get"), "ECB candidate must remain read-only");
assert(!zh.components.securitySchemes && !zh.security,
  "anonymous ECB API must not acquire an authentication requirement");

for (const { pathname, pathItem, operation } of entries) {
  const variables = [...pathname.matchAll(/\{([^}]+)\}/g)].map((match) => match[1]).sort();
  const allParameters = [...(pathItem.parameters ?? []), ...(operation.parameters ?? [])]
    .map((parameter) => parameter.$ref ? resolveLocal(zh, parameter.$ref) : parameter);
  const pathParameters = allParameters.filter((parameter) => parameter.in === "path");
  assert(JSON.stringify(variables) === JSON.stringify(pathParameters.map(({ name }) => name).sort()),
    `${operation.operationId}: path parameters do not match ${pathname}`);
  assert(pathParameters.every(({ required }) => required === true),
    `${operation.operationId}: every path parameter must be required`);
  assert(operation["x-pontx-documentation-status"] === "official",
    `${operation.operationId}: documentation status drifted`);
  assert(operation["x-pontx-proxy-enabled"] === false,
    `${operation.operationId}: pre-admission proxying must remain disabled`);
  assert(operation["x-pontx-evidence"].length === 5,
    `${operation.operationId}: complete official evidence set is missing`);
  const requestExample = operation["x-pontx-request-examples"]?.default;
  assert(requestExample?.expectedStatus === "200", `${operation.operationId}: request example missing`);
  assert(requestExample.request && typeof requestExample.request.path === "object" &&
    typeof requestExample.request.query === "object" &&
    typeof requestExample.request.headers === "object",
  `${operation.operationId}: request example sections are incomplete`);
  assert(operation.responses["200"] && operation.responses["400"] && operation.responses["404"] &&
    operation.responses["406"] && operation.responses["500"] &&
    operation.responses["501"] && operation.responses["503"],
  `${operation.operationId}: official status-code coverage is incomplete`);
}

const dataEntries = entries.filter(({ operation }) => operation.tags.includes("Data"));
assert(dataEntries.length === 2 && dataEntries.every(({ operation }) => operation.responses["304"]),
  "both data variants must model conditional 304 responses");
for (const { operation } of dataEntries) {
  const media = Object.keys(operation.responses["200"].content);
  for (const expected of [
    "application/vnd.sdmx.data+json;version=1.0.0-wd",
    "application/vnd.sdmx.genericdata+xml;version=2.1",
    "application/vnd.sdmx.structurespecificdata+xml;version=2.1",
    "text/csv",
    "application/vnd.ecb.data+csv;version=1.0.0"
  ]) assert(media.includes(expected), `${operation.operationId}: missing ${expected}`);
}

const metadataEntries = entries.filter(({ operation }) => operation.tags.includes("Metadata"));
assert(metadataEntries.length === 4, "four optional-segment metadata variants are required");
assert(entries.filter(({ operation }) => operation.tags.includes("Validation")).length === 2,
  "two optional-version XML Schema variants are required");
assert(zh.components.parameters.resource.schema.enum.length === 21,
  "all 21 ECB-documented structural metadata artefact types are required");

walk(zh, (value, pointer) => {
  if (value && typeof value === "object" && typeof value.$ref === "string") {
    assert(resolveLocal(zh, value.$ref) !== undefined, `unresolved reference at ${pointer}`);
  }
});

const candidate = candidates.products.find(({ slug }) => slug === "ecb-data-portal");
assert(candidate, "ECB candidate record is missing");
assert(candidate.admissionDecision === "approved" && candidate.stage === "admitted",
  "ECB must record formal admission");
assert(candidate.gateStatus.authority === "passed" && candidate.gateStatus.redistribution === "passed" &&
  candidate.gateStatus.contract === "passed" && candidate.gateStatus.transport === "passed",
"ECB evidence, reuse, contract, and transport gates must remain passed");
assert(candidate.gateStatus.risk === "passed", "ECB read-only risk gate should be passed");
assert(candidate.gateStatus.sdkCli === "passed", "published ECB SDK/CLI gate must remain passed");
assert(candidate.contractSource.normalizationManifest === "specs/ecb-data-portal/provenance.json",
  "ECB candidate must point to its provenance manifest");
assert(candidate.blockers.length === 0, "admitted ECB must not retain blockers");
const catalogEntry = catalog.apis.find(({ slug }) => slug === "ecb-data-portal");
assert(catalogEntry, "admitted ECB must enter catalog/source.json");
assert(catalogEntry.approvedSha256 === provenance.outputs["zh-CN"].sha256 &&
  catalogEntry.approvedLocaleSha256?.["en-US"] === provenance.outputs["en-US"].sha256,
"ECB catalog approval hashes drifted");
assert(catalogEntry.packageName === "@pontx/ecb-data-portal" &&
  catalogEntry.sdkVersion === "0.1.0" && catalogEntry.sdkStatus === "published",
"ECB published package metadata drifted");
assert(catalogEntry.sdkQuality?.sourceCommit === provenance.publication.sourceCommit &&
  catalogEntry.sdkQuality?.workflowRunUrl === provenance.publication.workflowRunUrl &&
  catalogEntry.sdkQuality?.unitTests?.passed === 3 &&
  catalogEntry.sdkQuality?.unitTests?.total === 3 &&
  catalogEntry.sdkQuality?.unitTests?.skipped === 0 &&
  catalogEntry.sdkQuality?.e2eStatus === "passed" &&
  JSON.stringify(catalogEntry.sdkQuality?.nodeVersions) === JSON.stringify(["18", "20", "22"]),
"ECB SDK quality evidence drifted");
assert(catalogEntry.proxyEnabled === false, "ECB Hub proxy must remain disabled");
assert(catalogEntry.sdkContract?.client?.kind === "named" &&
  catalogEntry.sdkContract?.client?.identifier === "ecbDataPortalClient" &&
  catalogEntry.sdkContract?.operations?.length === 8,
"ECB SDK contract drifted");

console.log("Verified admitted ECB Data Portal: 8 operations, 12 schemas, bilingual parity, published SDK evidence");
