import fs from "node:fs";
import { createHash } from "node:crypto";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { evaluatePontxQuality, validatePontxSpecLocale } from "@pontx/spec";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const registry = JSON.parse(fs.readFileSync(path.join(root, "candidates/products.json"), "utf8"));
const catalog = JSON.parse(fs.readFileSync(path.join(root, "catalog/products.json"), "utf8"));
const expectedCandidates = new Set(["open-exchange-rates", "currencybeacon-rest"]);

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

function candidate(slug) {
  assert(registry.products.includes(slug), `${slug}: candidate record is missing`);
  const result = JSON.parse(fs.readFileSync(
    path.join(root, "candidates", slug, "candidate.json"),
    "utf8",
  ));
  assert(result.admissionDecision === "not-approved", `${slug}: candidate must remain pre-admission`);
  assert(!catalog.products.includes(slug), `${slug}: blocked candidate entered catalog`);
  return result;
}

const oxr = candidate("open-exchange-rates");
assert(oxr.stage === "contract-in-progress" && oxr.gateStatus.redistribution === "passed"
  && oxr.gateStatus.contract === "pending" && oxr.gateStatus.risk === "passed"
  && oxr.gateStatus.sdkCli === "pending", "OXR independent-policy and contract gates drifted");
assert(oxr.contractSource.sourceSha256 === "1e70ee723f49313c1d618c2065ca127ebb411d78c3abf60a0c4eae8fc408ea84"
  && oxr.contractSource.observedOperations === 7 && oxr.contractSource.observedSchemas === 0,
"OXR official embedded snapshot evidence drifted");
assert(oxr.contractSource.qualityAudit.invalidCodegenOperationIds === 6
  && oxr.contractSource.qualityAudit.pathTemplateMismatches === 1
  && oxr.contractSource.qualityAudit.missingSuccessSchemas === 4
  && oxr.contractSource.qualityAudit.missing4xxOrDefaultResponses === 2
  && oxr.contractSource.qualityAudit.missingPontxRequestExamples === 7,
"OXR quality audit drifted");
assert(oxr.contractSource.humanDocumentationAudit?.reverifiedAt === "2026-08-15"
  && oxr.contractSource.humanDocumentationAudit.schemasReconstructableFromOfficialPages?.length === 5
  && oxr.contractSource.humanDocumentationAudit.remainingSuccessBodiesRequiringAuthorisedFixture?.join(",") === "convert"
  && oxr.contractSource.humanDocumentationAudit.authorisedFreePlanProbe?.successEndpoints?.join(",") === "latest,historical,currencies,usage"
  && oxr.contractSource.humanDocumentationAudit.authorisedFreePlanProbe?.planDeniedEndpoints?.join(",") === "time-series,convert,ohlc",
"OXR page-level and authorised-free-plan evidence drifted");
assert(oxr.independentImplementationPolicy?.reviewedAt === "2026-08-15"
  && oxr.independentImplementationPolicy.requirements?.includes(
    "Hub must not proxy, cache, persist, or display supplier responses."),
"OXR independent implementation boundary drifted");
assert(oxr.pontxProbe.generatedOperations === 7 && oxr.pontxProbe.generatedSchemas === 0
  && oxr.pontxProbe.anonymousCurrenciesSdkCall === "passed-173-currencies"
  && oxr.pontxProbe.publicationReady === false,
"OXR derived generation probe drifted");

const currencyBeacon = candidate("currencybeacon-rest");
assert(currencyBeacon.stage === "external-service-blocked"
  && currencyBeacon.gateStatus.redistribution === "passed"
  && currencyBeacon.gateStatus.contract === "pending"
  && currencyBeacon.gateStatus.risk === "passed"
  && currencyBeacon.gateStatus.sdkCli === "pending", "CurrencyBeacon independent-policy and contract gates drifted");
assert(currencyBeacon.contractSource.observedOperations === 5
  && currencyBeacon.contractSource.documentedCompleteSuccessExamples === 2
  && currencyBeacon.contractSource.observedAnonymousError.httpStatus === 401,
"CurrencyBeacon evidence counts drifted");
assert(currencyBeacon.contractSource.humanDocumentationAudit?.reverifiedAt === "2026-08-15"
  && currencyBeacon.contractSource.humanDocumentationAudit.responseFieldPathEvidence?.historical?.[0] === "response.rates"
  && currencyBeacon.contractSource.humanDocumentationAudit.responseFieldPathEvidence?.timeseries?.[0] === "response.rates"
  && currencyBeacon.contractSource.humanDocumentationAudit.missingCompleteSuccessSchemas?.join(",") === "historical,timeseries,currencies",
"CurrencyBeacon page-level remediation evidence drifted");
assert(currencyBeacon.contractSource.humanDocumentationAudit.authorisedFreeRegistrationProbe?.initialFreeDashboard === "created-without-payment"
  && currencyBeacon.contractSource.humanDocumentationAudit.authorisedFreeRegistrationProbe?.currentRecoveryFailures?.join(",")
    === "Google OAuth callback returned HTTP 500,password reset submission returned HTTP 500"
  && currencyBeacon.independentImplementationPolicy?.reviewedAt === "2026-08-15",
"CurrencyBeacon authorised-registration failure evidence drifted");
assert(currencyBeacon.pontxProbe.status === "not-run-contract-blocked"
  && currencyBeacon.pontxProbe.completeSuccessSchemasDocumented === 2
  && currencyBeacon.pontxProbe.publicationReady === false,
"CurrencyBeacon must stop before speculative SDK generation");

assert(catalog.products.includes("ecb-data-portal"), "admitted ECB must remain in products.json");
assert(catalog.products.includes("twelve-data-forex"), "Twelve Data Forex must be admitted to the catalog");
assert(!registry.products.includes("twelve-data-forex"), "Twelve Data Forex must leave the candidate registry");
const twelveRoot = path.join(root, "products/twelve-data-forex");
const twelveContractBytes = fs.readFileSync(path.join(twelveRoot, "spec.pontx.json"));
const twelveContract = JSON.parse(twelveContractBytes.toString("utf8"));
const twelveEnglishContract = JSON.parse(fs.readFileSync(
  path.join(twelveRoot, "locales/en-US/spec.pontx.json"),
  "utf8",
));
const twelveProduct = JSON.parse(fs.readFileSync(path.join(twelveRoot, "product.json"), "utf8"));
const twelveSdk = JSON.parse(fs.readFileSync(path.join(twelveRoot, "sdk.json"), "utf8"));
const twelveProvenance = JSON.parse(fs.readFileSync(path.join(twelveRoot, "sources/provenance.json"), "utf8"));
const twelveQuality = evaluatePontxQuality({
  spec: twelveContract,
  locales: { "en-US": twelveEnglishContract },
});
assert(createHash("sha256").update(twelveContractBytes).digest("hex")
  === "5705b5bff48cd1b4736d29ca59c132a545339ae9e56879173cc46017a2190d6b"
  && Object.keys(twelveContract.apis).length === 111
  && Object.keys(twelveContract.components.schemas).length === 443
  && twelveContract.tags.map((tag) => tag.name).sort().join(",")
    === "currencies,market_data,reference_data,technical_indicator",
"Twelve Data Forex product scope drifted");
assert(twelveQuality.score === 100 && twelveQuality.grade === "A"
  && twelveQuality.findings.length === 0
  && validatePontxSpecLocale(twelveContract, twelveEnglishContract).valid,
"Twelve Data Forex product must remain bilingual and static-quality A");
assert(twelveProduct.execution.hubProxyEnabled === false
  && twelveProduct.credentials?.[0]?.envVar === "PONTX_TWELVE_DATA_API_KEY"
  && twelveSdk.package.name === "@pontx/twelve-data-forex"
  && twelveSdk.package.version === "0.1.1"
  && twelveSdk.coverage.mode === "full"
  && twelveSdk.spec.sha256 === "5705b5bff48cd1b4736d29ca59c132a545339ae9e56879173cc46017a2190d6b",
"Twelve Data product safety and SDK contract drifted");
assert(twelveProvenance.source.sha256 === "d0a219a5c19518cff59a3ab7275e8308ad8083ef618a58390b73f1164653bc0c"
  && twelveProvenance.scope.endpointCount === 111
  && twelveProvenance.streamEvidence.observedInbound.join(",") === "subscribe-status,price,heartbeat",
"Twelve Data source and observed stream evidence drifted");

const actualCandidates = new Set(registry.products.filter((slug) => expectedCandidates.has(slug)));
assert(actualCandidates.size === expectedCandidates.size, "FX candidate set is incomplete");

console.log("Verified blocked FX candidates and the admitted Twelve Data Forex product.");
