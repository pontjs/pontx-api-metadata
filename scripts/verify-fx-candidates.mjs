import fs from "node:fs";
import { createHash } from "node:crypto";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { evaluatePontxQuality, validatePontxSpecLocale } from "@pontx/spec";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const registry = JSON.parse(fs.readFileSync(path.join(root, "candidates/products.json"), "utf8"));
const catalog = JSON.parse(fs.readFileSync(path.join(root, "catalog/products.json"), "utf8"));
const expectedCandidates = new Set();

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

assert(catalog.products.includes("ecb-data-portal"), "admitted ECB must remain in products.json");
assert(catalog.products.includes("twelve-data-forex"), "Twelve Data Forex must be admitted to the catalog");
assert(catalog.products.includes("currencybeacon-rest"), "CurrencyBeacon must be admitted to the catalog");
assert(catalog.products.includes("open-exchange-rates"), "Open Exchange Rates must be admitted to the catalog");
assert(!registry.products.includes("twelve-data-forex"), "Twelve Data Forex must leave the candidate registry");
assert(!registry.products.includes("currencybeacon-rest"), "CurrencyBeacon must leave the candidate registry");
assert(!registry.products.includes("open-exchange-rates"), "Open Exchange Rates must leave the candidate registry");

const oxrRoot = path.join(root, "products/open-exchange-rates");
const oxrContractBytes = fs.readFileSync(path.join(oxrRoot, "spec.pontx.json"));
const oxrContract = JSON.parse(oxrContractBytes.toString("utf8"));
const oxrEnglishContract = JSON.parse(fs.readFileSync(
  path.join(oxrRoot, "locales/en-US/spec.pontx.json"),
));
const oxrProduct = JSON.parse(fs.readFileSync(path.join(oxrRoot, "product.json"), "utf8"));
const oxrSdk = JSON.parse(fs.readFileSync(path.join(oxrRoot, "sdk.json"), "utf8"));
const oxrProvenance = JSON.parse(fs.readFileSync(path.join(oxrRoot, "sources/provenance.json"), "utf8"));
assert(createHash("sha256").update(oxrContractBytes).digest("hex")
  === "7b45dc185947af8ad0bdd862334cc8ae4caf0006212a109dedd488b0cd2eaa67"
  && Object.keys(oxrContract.apis).length === 7
  && Object.keys(oxrContract.components.schemas).length === 17
  && Object.values(oxrContract.apis).every((api) => api.tags.length === 0
    && api.method === "GET" && api.metadata?.execution?.enabled === false),
"Open Exchange Rates scope, untagged Endpoint contract, or direct-only policy drifted");
assert(validatePontxSpecLocale(oxrContract, oxrEnglishContract).valid,
  "Open Exchange Rates must retain bilingual locale parity");
assert(oxrProduct.credentials?.[0]?.envVar === "PONTX_OPEN_EXCHANGE_RATES_APP_ID"
  && oxrSdk.package.name === "@pontx/open-exchange-rates"
  && oxrSdk.package.version === "0.1.0"
  && oxrSdk.package.status === "published"
  && oxrSdk.coverage.mode === "full"
  && oxrSdk.quality?.sourceCommit === "53377dca8fed944cb0098138e4f340f1a548879e"
  && oxrSdk.spec.sha256 === "7b45dc185947af8ad0bdd862334cc8ae4caf0006212a109dedd488b0cd2eaa67"
  && oxrProvenance.status === "admitted"
  && oxrProvenance.riskReview?.hubProxyEnabled === false,
"Open Exchange Rates SDK release evidence or terms-scoped execution policy drifted");

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
assert(!Object.hasOwn(twelveProduct, "execution")
  && twelveProduct.credentials?.[0]?.envVar === "PONTX_TWELVE_DATA_API_KEY"
  && twelveProduct.credentials?.[0]?.guide?.url === "https://twelvedata.com/account/api-keys"
  && twelveProduct.credentials?.[0]?.guide?.steps?.length === 3
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
  === "a8177a8f8d814a03760dc3fdae83927ad7adf91a6eeb84b48b990cb47b03a029"
  && Object.keys(currencyBeaconContract.apis).length === 5
  && Object.keys(currencyBeaconContract.components.schemas).length === 11
  && Object.values(currencyBeaconContract.apis).every((api) => api.tags.length === 0
    && api.method === "GET" && api.metadata?.execution?.enabled !== false),
"CurrencyBeacon product scope or untagged Endpoint contract drifted");
assert(currencyBeaconQuality.score === 100 && currencyBeaconQuality.grade === "A"
  && currencyBeaconQuality.findings.length === 0
  && validatePontxSpecLocale(currencyBeaconContract, currencyBeaconEnglishContract).valid,
"CurrencyBeacon product must remain bilingual and static-quality A");
assert(!Object.hasOwn(currencyBeaconProduct, "execution")
  && currencyBeaconProduct.credentials?.[0]?.envVar === "PONTX_CURRENCYBEACON_API_KEY"
  && currencyBeaconSdk.package.name === "@pontx/currencybeacon-rest"
  && currencyBeaconSdk.package.version === "0.1.2"
  && currencyBeaconSdk.coverage.mode === "full"
  && JSON.stringify(currencyBeaconSdk.contract.methodNames) === JSON.stringify({
    convertCurrency: "convert",
    getHistoricalRates: "historical",
    getLatestRates: "latest",
    getTimeseries: "timeseries",
    listCurrencies: "currencies",
  })
  && currencyBeaconSdk.spec.sha256 === "a8177a8f8d814a03760dc3fdae83927ad7adf91a6eeb84b48b990cb47b03a029",
"CurrencyBeacon product safety and SDK contract drifted");
assert(currencyBeaconProvenance.scope.endpointCount === 5
  && currencyBeaconProvenance.authenticatedReadEvidence.plan === "free"
  && currencyBeaconProvenance.authenticatedReadEvidence.retainedData === false
  && currencyBeaconProvenance.authenticatedReadEvidence.successShapes.currencies?.[0] === "numeric-string dynamic keys",
"CurrencyBeacon authenticated read evidence drifted");

const ecbRoot = path.join(root, "products/ecb-data-portal");
const ecbContractBytes = fs.readFileSync(path.join(ecbRoot, "spec.pontx.json"));
const ecbContract = JSON.parse(ecbContractBytes.toString("utf8"));
const ecbEnglishContract = JSON.parse(fs.readFileSync(
  path.join(ecbRoot, "locales/en-US/spec.pontx.json"),
));
const ecbProduct = JSON.parse(fs.readFileSync(path.join(ecbRoot, "product.json"), "utf8"));
const ecbSdk = JSON.parse(fs.readFileSync(path.join(ecbRoot, "sdk.json"), "utf8"));
const ecbProvenance = JSON.parse(fs.readFileSync(path.join(ecbRoot, "sources/provenance.json"), "utf8"));
const ecbQuality = evaluatePontxQuality({
  spec: ecbContract,
  locales: { "en-US": ecbEnglishContract },
});
assert(createHash("sha256").update(ecbContractBytes).digest("hex")
  === "9f674cba032fc2fe2a21205731aa4a1bc704309303528d80a5ce41c412cb623f"
  && Object.keys(ecbContract.apis).length === 8
  && Object.keys(ecbContract.components.schemas).length === 12
  && Object.values(ecbContract.apis).every((api) => api.method === "GET"
    && api.metadata?.execution?.enabled !== false),
"ECB scope or safe read Playground contract drifted");
assert(ecbQuality.grade === "A" && ecbQuality.criticals.length === 0
  && validatePontxSpecLocale(ecbContract, ecbEnglishContract).valid,
"ECB product must retain bilingual locale parity and a static-quality A grade");
assert(!Object.hasOwn(ecbProduct, "execution")
  && ecbProduct.credentials.length === 0
  && ecbSdk.package.name === "@pontx/ecb-data-portal"
  && ecbSdk.package.version === "0.1.1"
  && ecbSdk.coverage.mode === "full"
  && ecbSdk.spec.sha256 === "9f674cba032fc2fe2a21205731aa4a1bc704309303528d80a5ce41c412cb623f"
  && ecbProvenance.outputs["zh-CN"].sha256 === "9f674cba032fc2fe2a21205731aa4a1bc704309303528d80a5ce41c412cb623f",
"ECB product safety and SDK contract drifted");

const actualCandidates = new Set(registry.products.filter((slug) => expectedCandidates.has(slug)));
assert(actualCandidates.size === expectedCandidates.size, "FX candidate set is incomplete");

console.log("Verified admitted Open Exchange Rates, Twelve Data Forex, CurrencyBeacon, and ECB products, plus the remaining FX candidate registry.");
