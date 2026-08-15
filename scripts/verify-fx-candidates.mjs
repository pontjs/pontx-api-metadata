import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const registry = JSON.parse(
  fs.readFileSync(path.join(root, "candidates/products.json"), "utf8")
);
const catalog = JSON.parse(fs.readFileSync(path.join(root, "catalog/products.json"), "utf8"));
const expected = new Set([
  "open-exchange-rates", "currencybeacon-rest", "twelve-data-forex"
]);

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

function product(slug) {
  assert(registry.products.includes(slug), `${slug}: candidate record is missing`);
  return JSON.parse(fs.readFileSync(
    path.join(root, "candidates", slug, "candidate.json"),
    "utf8"
  ));
}

function candidate(slug) {
  const result = product(slug);
  assert(result.admissionDecision === "not-approved", `${slug}: candidate must remain pre-admission`);
  assert(!catalog.products.includes(slug), `${slug}: blocked candidate entered catalog`);
  return result;
}

assert(catalog.products.includes("ecb-data-portal"), "admitted ECB must remain in products.json");
const ecb = JSON.parse(fs.readFileSync(
  path.join(root, "products/ecb-data-portal/spec.pontx.json"),
  "utf8"
));
assert(Object.keys(ecb.apis).length === 8 && Object.keys(ecb.components.schemas).length === 12,
  "ECB PontxSpec counts drifted");

const oxr = candidate("open-exchange-rates");
assert(oxr.gateStatus.redistribution === "passed" && oxr.gateStatus.contract === "pending" &&
  oxr.gateStatus.sdkCli === "pending", "OXR unresolved gates drifted");
assert(oxr.contractSource.independentImplementationPolicy?.reviewedAt === "2026-08-15" &&
  oxr.contractSource.independentImplementationPolicy.dataHandling.includes("does not proxy"),
"OXR independent implementation and no-data-relay boundary must remain explicit");
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
assert(oxr.contractSource.humanDocumentationAudit?.reverifiedAt === "2026-08-15" &&
  oxr.contractSource.humanDocumentationAudit.schemasReconstructableFromOfficialPages?.length === 5 &&
  oxr.contractSource.humanDocumentationAudit.remainingSuccessBodiesRequiringAuthorisedFixture?.join(",") === "convert,usage",
"OXR page-level remediation evidence drifted");
assert(oxr.pontxProbe.generatedOperations === 7 && oxr.pontxProbe.generatedSchemas === 0 &&
  oxr.pontxProbe.anonymousCurrenciesSdkCall === "passed-173-currencies" &&
  oxr.pontxProbe.publicationReady === false,
"OXR derived generation probe drifted");

const currencyBeacon = candidate("currencybeacon-rest");
assert(currencyBeacon.gateStatus.redistribution === "passed" &&
  currencyBeacon.gateStatus.contract === "pending" &&
  currencyBeacon.gateStatus.sdkCli === "pending", "CurrencyBeacon unresolved gates drifted");
assert(currencyBeacon.contractSource.independentImplementationPolicy?.reviewedAt === "2026-08-15" &&
  currencyBeacon.contractSource.independentImplementationPolicy.dataHandling.includes("does not proxy"),
"CurrencyBeacon independent implementation and no-data-relay boundary must remain explicit");
assert(currencyBeacon.contractSource.observedOperations === 5 &&
  currencyBeacon.contractSource.documentedCompleteSuccessExamples === 2 &&
  currencyBeacon.contractSource.observedAnonymousError.httpStatus === 401,
"CurrencyBeacon evidence counts drifted");
assert(currencyBeacon.contractSource.humanDocumentationAudit?.reverifiedAt === "2026-08-15" &&
  currencyBeacon.contractSource.humanDocumentationAudit.responseFieldPathEvidence?.historical?.[0] === "response.rates" &&
  currencyBeacon.contractSource.humanDocumentationAudit.responseFieldPathEvidence?.timeseries?.[0] === "response.rates" &&
  currencyBeacon.contractSource.humanDocumentationAudit.missingCompleteSuccessSchemas?.join(",") === "historical,timeseries,currencies",
"CurrencyBeacon page-level remediation evidence drifted");
assert(currencyBeacon.pontxProbe.status === "not-run-contract-blocked" &&
  currencyBeacon.pontxProbe.completeSuccessSchemasDocumented === 2 &&
  currencyBeacon.pontxProbe.publicationReady === false,
"CurrencyBeacon must stop before speculative SDK generation");

const twelve = candidate("twelve-data-forex");
assert(twelve.stage === "protocol-blocked" && twelve.gateStatus.transport === "blocked",
  "Twelve Data Forex must remain atomically blocked until its complete WebSocket contract and client path are validated");
assert(twelve.gateStatus.redistribution === "passed",
  "Twelve Data must distinguish independently authored client publication from prohibited data redistribution");
assert(twelve.contractSource.independentImplementationPolicy?.reviewedAt === "2026-08-15" &&
  twelve.contractSource.independentImplementationPolicy.dataHandling.includes("does not proxy"),
"Twelve Data independent implementation and no-data-relay boundary must remain explicit");
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
assert(twelve.websocketAudit?.reverifiedAt === "2026-08-15" &&
  twelve.websocketAudit.officialConnectionUrl === "wss://ws.twelvedata.com/v1/quotes/price?apikey={apiKey}" &&
  twelve.websocketAudit.outboundActionsConfirmedByOfficialSdk?.join(",") === "subscribe,unsubscribe,reset,heartbeat" &&
  twelve.websocketAudit.documentedInboundEventNames?.join(",") === "subscribe-status,price" &&
  twelve.websocketAudit.missingCompleteInboundEventSchemas?.join(",") === "subscribe-status,price",
"Twelve Data official WebSocket evidence drifted");
assert(twelve.websocketAudit.officialPythonSdk?.commit ===
  "3d53d271a450c50b2199722b5d2db7b92e213d3b" &&
  twelve.websocketAudit.pontxProgress?.runtimeCommit ===
  "7b1e60f0de6cbfe4874b476bc237f2d4c628b839" &&
  twelve.websocketAudit.pontxProgress?.asyncapiCommit ===
  "0f6a32e61f993bfb1c37373ef95efd79465c181f" &&
  twelve.websocketAudit.pontxProgress?.generatedClientCommit ===
  "1ef0a829c785422b06e9fa0d76fff244de8446cb" &&
  twelve.websocketAudit.pontxProgress?.implemented?.includes("generated-stream-client") &&
  twelve.websocketAudit.pontxProgress?.remaining?.includes("provider-complete-inbound-schemas") &&
  twelve.websocketAudit.pontxProgress?.remaining?.includes("complete-stream-sdk-cli-e2e") &&
  !twelve.websocketAudit.pontxProgress?.remaining?.includes("generated-stream-client-binding"),
"Twelve Data partial Pontx support and remaining contract work must stay explicit");

const actual = new Set(
  registry.products.filter((slug) => expected.has(slug))
);
assert(actual.size === expected.size, "FX candidate set is incomplete");

console.log("Verified FX candidates and the admitted ECB PontxSpec boundary.");
