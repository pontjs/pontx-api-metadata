import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const registry = JSON.parse(
  fs.readFileSync(path.join(root, "catalog/api-collection-candidates.json"), "utf8")
);
const catalog = JSON.parse(fs.readFileSync(path.join(root, "catalog/source.json"), "utf8"));
const expected = new Set([
  "ecb-data-portal", "open-exchange-rates", "currencybeacon-rest", "twelve-data-forex"
]);

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

function product(slug) {
  const result = registry.products.find((product) => product.slug === slug);
  assert(result, `${slug}: candidate record is missing`);
  return result;
}

function candidate(slug) {
  const result = product(slug);
  assert(result.admissionDecision === "not-approved", `${slug}: candidate must remain pre-admission`);
  assert(!catalog.apis.some((api) => api.slug === slug), `${slug}: blocked candidate entered catalog`);
  return result;
}

const ecb = product("ecb-data-portal");
assert(ecb.admissionDecision === "approved" && ecb.stage === "admitted",
  "ECB must be formally admitted after SDK/CLI publication");
assert(catalog.apis.some((api) => api.slug === "ecb-data-portal"),
  "admitted ECB must enter catalog/source.json");
assert(ecb.gateStatus.redistribution === "passed" && ecb.gateStatus.contract === "passed" &&
  ecb.gateStatus.transport === "passed" && ecb.gateStatus.risk === "passed" &&
  ecb.gateStatus.sdkCli === "passed",
"ECB must retain all passed admission gates");
assert(ecb.contractSource.kind === "independent-official-docs-reconstruction" &&
  ecb.contractSource.observedOperations === 8 && ecb.contractSource.observedSchemas === 12,
"ECB reconstructed-contract counts drifted");
assert(ecb.pontxProbe.generatedOperations === 8 && ecb.pontxProbe.generatedSchemas === 12 &&
  ecb.pontxProbe.unitTests === "passed-3-of-3" &&
  ecb.pontxProbe.e2eTests === "passed-3-of-3" &&
  ecb.pontxProbe.sdkLiveChecks === "passed" &&
  ecb.pontxProbe.cliDryRunAndLiveCall === "passed" &&
  ecb.pontxProbe.publicationReady === true,
"ECB published SDK/CLI proof drifted");

const oxr = candidate("open-exchange-rates");
assert(oxr.gateStatus.redistribution === "pending" && oxr.gateStatus.contract === "pending" &&
  oxr.gateStatus.sdkCli === "pending", "OXR unresolved gates drifted");
assert(oxr.contractSource.sourceSha256 ===
  "1e70ee723f49313c1d618c2065ca127ebb411d78c3abf60a0c4eae8fc408ea84" &&
  oxr.contractSource.observedOperations === 7 && oxr.contractSource.observedSchemas === 0,
"OXR official embedded snapshot evidence drifted");
assert(oxr.contractSource.qualityAudit.invalidCodegenOperationIds === 6 &&
  oxr.contractSource.qualityAudit.pathTemplateMismatches === 1 &&
  oxr.contractSource.qualityAudit.missingSuccessSchemas === 4 &&
  oxr.contractSource.qualityAudit.missing4xxOrDefaultResponses === 2 &&
  oxr.contractSource.qualityAudit.missingPontxRequestExamples === 7,
"OXR quality audit drifted");
assert(oxr.pontxProbe.generatedOperations === 7 && oxr.pontxProbe.generatedSchemas === 0 &&
  oxr.pontxProbe.anonymousCurrenciesSdkCall === "passed-173-currencies" &&
  oxr.pontxProbe.publicationReady === false,
"OXR derived generation probe drifted");

const currencyBeacon = candidate("currencybeacon-rest");
assert(currencyBeacon.gateStatus.redistribution === "pending" &&
  currencyBeacon.gateStatus.contract === "pending" &&
  currencyBeacon.gateStatus.sdkCli === "pending", "CurrencyBeacon unresolved gates drifted");
assert(currencyBeacon.contractSource.observedOperations === 5 &&
  currencyBeacon.contractSource.documentedCompleteSuccessExamples === 2 &&
  currencyBeacon.contractSource.observedAnonymousError.httpStatus === 401,
"CurrencyBeacon evidence counts drifted");
assert(currencyBeacon.pontxProbe.status === "not-run-contract-blocked" &&
  currencyBeacon.pontxProbe.completeSuccessSchemasDocumented === 2 &&
  currencyBeacon.pontxProbe.publicationReady === false,
"CurrencyBeacon must stop before speculative SDK generation");

const twelve = candidate("twelve-data-forex");
assert(twelve.stage === "protocol-blocked" && twelve.gateStatus.transport === "blocked",
  "Twelve Data Forex must remain atomically blocked on WebSocket");
assert(twelve.contractSource.sourceSha256 ===
  "d0a219a5c19518cff59a3ab7275e8308ad8083ef618a58390b73f1164653bc0c" &&
  twelve.contractSource.observedOperations === 187 && twelve.contractSource.observedSchemas === 797,
"Twelve Data official REST OAS evidence drifted");
assert(twelve.contractSource.qualityAudit.duplicateOperationIds === 0 &&
  twelve.contractSource.qualityAudit.pathTemplateMismatches === 0 &&
  twelve.contractSource.qualityAudit.missingSuccessSchemas === 0 &&
  twelve.contractSource.qualityAudit.missing4xxOrDefaultResponses === 0 &&
  twelve.contractSource.qualityAudit.missingPontxRequestExamples === 187,
"Twelve Data REST OAS quality audit drifted");
assert(twelve.pontxProbe.generatedOperations === 187 && twelve.pontxProbe.generatedSchemas === 797 &&
  twelve.pontxProbe.typescriptCheck === "passed" &&
  twelve.pontxProbe.esmCjsDeclarationsBuild === "passed" &&
  twelve.pontxProbe.sdkDemoPriceCall === "passed" &&
  twelve.pontxProbe.publicationReady === false,
"Twelve Data REST generation proof drifted");
assert(twelve.pontxProbe.credentialFinding.includes("printed"),
  "Twelve Data CLI credential safety finding must remain explicit");

const actual = new Set(
  registry.products.filter((product) => expected.has(product.slug)).map((product) => product.slug)
);
assert(actual.size === expected.size, "FX candidate set is incomplete");

console.log("Verified FX candidates: ECB admission-ready contract, OXR/Twelve probes, CurrencyBeacon stop gate");
