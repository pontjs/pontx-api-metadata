import fs from "node:fs";
import { createHash } from "node:crypto";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { evaluatePontxQuality, validatePontxSpecLocale } from "@pontx/spec";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const registry = JSON.parse(fs.readFileSync(path.join(root, "candidates/products.json"), "utf8"));
const catalog = JSON.parse(fs.readFileSync(path.join(root, "catalog/products.json"), "utf8"));
const expectedCandidates = new Set(["open-exchange-rates"]);

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

assert(catalog.products.includes("ecb-data-portal"), "admitted ECB must remain in products.json");
assert(catalog.products.includes("twelve-data-forex"), "Twelve Data Forex must be admitted to the catalog");
assert(catalog.products.includes("currencybeacon-rest"), "CurrencyBeacon must be admitted to the catalog");
assert(!registry.products.includes("twelve-data-forex"), "Twelve Data Forex must leave the candidate registry");
assert(!registry.products.includes("currencybeacon-rest"), "CurrencyBeacon must leave the candidate registry");
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

const currencyBeaconRoot = path.join(root, "products/currencybeacon-rest");
const currencyBeaconContractBytes = fs.readFileSync(path.join(currencyBeaconRoot, "spec.pontx.json"));
const currencyBeaconContract = JSON.parse(currencyBeaconContractBytes.toString("utf8"));
const currencyBeaconEnglishContract = JSON.parse(fs.readFileSync(
  path.join(currencyBeaconRoot, "locales/en-US/spec.pontx.json"),
));
const currencyBeaconProduct = JSON.parse(fs.readFileSync(path.join(currencyBeaconRoot, "product.json"), "utf8"));
const currencyBeaconSdk = JSON.parse(fs.readFileSync(path.join(currencyBeaconRoot, "sdk.json"), "utf8"));
const currencyBeaconProvenance = JSON.parse(fs.readFileSync(path.join(currencyBeaconRoot, "sources/provenance.json"), "utf8"));
const currencyBeaconQuality = evaluatePontxQuality({
  spec: currencyBeaconContract,
  locales: { "en-US": currencyBeaconEnglishContract },
});
assert(createHash("sha256").update(currencyBeaconContractBytes).digest("hex")
  === "fbc9fa51b59489b6aec95c11c146918d4e6f5c2047318d731a92d150de29159f"
  && Object.keys(currencyBeaconContract.apis).length === 5
  && Object.keys(currencyBeaconContract.components.schemas).length === 11
  && Object.values(currencyBeaconContract.apis).every((api) => api.tags.length === 0),
"CurrencyBeacon product scope or untagged Endpoint contract drifted");
assert(currencyBeaconQuality.score === 100 && currencyBeaconQuality.grade === "A"
  && currencyBeaconQuality.findings.length === 0
  && validatePontxSpecLocale(currencyBeaconContract, currencyBeaconEnglishContract).valid,
"CurrencyBeacon product must remain bilingual and static-quality A");
assert(currencyBeaconProduct.execution.hubProxyEnabled === false
  && currencyBeaconProduct.credentials?.[0]?.envVar === "PONTX_CURRENCYBEACON_API_KEY"
  && currencyBeaconSdk.package.name === "@pontx/currencybeacon-rest"
  && currencyBeaconSdk.package.version === "0.1.1"
  && currencyBeaconSdk.coverage.mode === "full"
  && JSON.stringify(currencyBeaconSdk.contract.methodNames) === JSON.stringify({
    convertCurrency: "convert",
    getHistoricalRates: "historical",
    getLatestRates: "latest",
    getTimeseries: "timeseries",
    listCurrencies: "currencies",
  })
  && currencyBeaconSdk.spec.sha256 === "fbc9fa51b59489b6aec95c11c146918d4e6f5c2047318d731a92d150de29159f",
"CurrencyBeacon product safety and SDK contract drifted");
assert(currencyBeaconProvenance.scope.endpointCount === 5
  && currencyBeaconProvenance.authenticatedReadEvidence.plan === "free"
  && currencyBeaconProvenance.authenticatedReadEvidence.retainedData === false
  && currencyBeaconProvenance.authenticatedReadEvidence.successShapes.currencies?.[0] === "numeric-string dynamic keys",
"CurrencyBeacon authenticated read evidence drifted");

const actualCandidates = new Set(registry.products.filter((slug) => expectedCandidates.has(slug)));
assert(actualCandidates.size === expectedCandidates.size, "FX candidate set is incomplete");

console.log("Verified the blocked OXR candidate and admitted Twelve Data Forex and CurrencyBeacon products.");
