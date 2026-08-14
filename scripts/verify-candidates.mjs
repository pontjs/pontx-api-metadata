import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const candidates = JSON.parse(
  fs.readFileSync(path.join(root, "catalog/api-collection-candidates.json"), "utf8")
);
const source = JSON.parse(fs.readFileSync(path.join(root, "catalog/source.json"), "utf8"));

const expectedGroups = new Map([
  ["eligible-review", [
    "notion",
    "wps-365",
    "mongodb-atlas-admin",
    "posthog",
    "amazon-sqs",
    "dropbox-sign",
    "sendbird-chat-platform"
  ]],
  ["llm-protocol-hold", [
    "openai",
    "qwen",
    "deepseek",
    "gemini",
    "anthropic",
    "kimi",
    "zhipu-bigmodel",
    "xai-grok",
    "tencent-hunyuan",
    "iflytek-spark",
    "baidu-qianfan",
    "mistral-ai"
  ]],
  ["separate-compliance-review", ["stripe-identity"]]
]);
const gateNames = [
  "authority",
  "redistribution",
  "contract",
  "transport",
  "risk",
  "sdkCli"
];
const gateStatuses = new Set(["passed", "pending", "blocked"]);
const stages = new Set(["audit-required", "protocol-blocked", "compliance-blocked", "admitted"]);
const evidenceKinds = new Set(["docs", "spec", "source", "license", "protocol", "terms"]);
const slugPattern = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
const datePattern = /^\d{4}-\d{2}-\d{2}$/;

function fail(message) {
  throw new Error(message);
}

function requireLocalized(value, location) {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    fail(`${location} must be a localized object`);
  }
  for (const locale of ["zh", "en"]) {
    if (typeof value[locale] !== "string" || !value[locale].trim()) {
      fail(`${location}.${locale} must be a non-empty string`);
    }
  }
}

if (candidates.version !== 1) fail("candidate registry version must be 1");
if (!datePattern.test(candidates.snapshotDate)) {
  fail("candidate registry snapshotDate must use YYYY-MM-DD");
}
if (candidates.sourceRoadmap !== "catalog/api-collection-growth-priority.md") {
  fail("candidate registry must point at the canonical growth roadmap");
}
if (!fs.existsSync(path.join(root, candidates.sourceRoadmap))) {
  fail("candidate registry sourceRoadmap does not exist");
}
requireLocalized(candidates.admissionPolicy, "admissionPolicy");
if (!Array.isArray(candidates.products) || candidates.products.length !== 20) {
  fail("candidate registry must contain exactly the roadmap's 20 products");
}

const approvedSlugs = new Set(source.apis.map((api) => api.slug));
const seenSlugs = new Set();

for (const product of candidates.products) {
  const location = `products.${product.slug ?? "<missing>"}`;
  if (!slugPattern.test(product.slug ?? "")) {
    fail(`${location}.slug must be a stable kebab-case identifier`);
  }
  if (seenSlugs.has(product.slug)) fail(`${location}.slug is duplicated`);
  seenSlugs.add(product.slug);
  const admitted = product.admissionDecision === "approved";
  if (admitted !== approvedSlugs.has(product.slug)) {
    fail(`${location} admissionDecision must match catalog/source.json`);
  }

  requireLocalized(product.name, `${location}.name`);
  requireLocalized(product.boundary, `${location}.boundary`);
  requireLocalized(product.nextAction, `${location}.nextAction`);
  for (const field of ["provider", "category"]) {
    if (typeof product[field] !== "string" || !product[field].trim()) {
      fail(`${location}.${field} must be a non-empty string`);
    }
  }

  if (!expectedGroups.has(product.priority?.group)) {
    fail(`${location}.priority.group is not recognized`);
  }
  if (!Number.isInteger(product.priority.rank) || product.priority.rank < 1) {
    fail(`${location}.priority.rank must be a positive integer`);
  }
  if (product.priority.group === "separate-compliance-review") {
    if (product.priority.score !== undefined) {
      fail(`${location}.priority.score must remain unset because the roadmap did not assign one`);
    }
  } else if (!Number.isInteger(product.priority.score) ||
    product.priority.score < 0 || product.priority.score > 100) {
    fail(`${location}.priority.score must be an integer from 0 through 100`);
  }

  if (!stages.has(product.stage)) fail(`${location}.stage is not recognized`);
  if (!["not-approved", "approved"].includes(product.admissionDecision)) {
    fail(`${location}.admissionDecision is not recognized`);
  }
  const actualGateNames = Object.keys(product.gateStatus ?? {}).sort();
  if (actualGateNames.join("\n") !== [...gateNames].sort().join("\n")) {
    fail(`${location}.gateStatus must contain exactly ${gateNames.join(", ")}`);
  }
  for (const gate of gateNames) {
    if (!gateStatuses.has(product.gateStatus[gate])) {
      fail(`${location}.gateStatus.${gate} is invalid`);
    }
  }
  if (product.gateStatus.authority !== "passed") {
    fail(`${location} requires at least one authoritative supplier source`);
  }
  if (!admitted && product.gateStatus.sdkCli === "passed") {
    fail(`${location} cannot pass SDK/CLI without immutable package evidence in catalog/source.json`);
  }
  if (admitted) {
    if (product.stage !== "admitted") fail(`${location} approved products must use admitted stage`);
    if (!gateNames.every((gate) => product.gateStatus[gate] === "passed")) {
      fail(`${location} approved products require every admission gate to pass`);
    }
    const sourceEntry = source.apis.find((api) => api.slug === product.slug);
    if (sourceEntry?.sdkStatus !== "published" || !sourceEntry.sdkQuality) {
      fail(`${location} approved product requires immutable published SDK evidence`);
    }
  } else {
    if (product.gateStatus.transport === "blocked" && product.stage !== "protocol-blocked") {
      fail(`${location} must use protocol-blocked when transport is blocked`);
    }
    if (product.gateStatus.risk === "blocked" && product.stage !== "compliance-blocked") {
      fail(`${location} must use compliance-blocked when risk is blocked`);
    }
    if (!Object.values(product.gateStatus).includes("blocked") && product.stage !== "audit-required") {
      fail(`${location} has no blocked gate and must remain audit-required`);
    }
  }

  if (!Array.isArray(product.evidence) || product.evidence.length < 2) {
    fail(`${location}.evidence must contain at least two authoritative sources`);
  }
  const seenEvidence = new Set();
  const seenEvidenceKinds = new Set();
  for (const [index, evidence] of product.evidence.entries()) {
    const evidenceLocation = `${location}.evidence.${index}`;
    if (!evidenceKinds.has(evidence.kind)) fail(`${evidenceLocation}.kind is invalid`);
    if (typeof evidence.url !== "string" || !evidence.url.startsWith("https://")) {
      fail(`${evidenceLocation}.url must be HTTPS`);
    }
    if (/explinks\.com/i.test(evidence.url)) {
      fail(`${evidenceLocation}.url uses a discovery signal instead of an authoritative source`);
    }
    if (seenEvidence.has(evidence.url)) fail(`${evidenceLocation}.url is duplicated`);
    seenEvidence.add(evidence.url);
    seenEvidenceKinds.add(evidence.kind);
  }
  if (seenEvidenceKinds.size < 2) {
    fail(`${location}.evidence must contain at least two distinct evidence kinds`);
  }
  if (!product.evidence.some((item) => ["docs", "spec", "source"].includes(item.kind))) {
    fail(`${location} needs authoritative documentation, specification, or source evidence`);
  }
  if (product.gateStatus.transport === "blocked" &&
    !product.evidence.some((item) => item.kind === "protocol")) {
    fail(`${location} needs exact protocol evidence for a transport block`);
  }
  if (product.gateStatus.redistribution === "passed" &&
    !product.evidence.some((item) => item.kind === "license")) {
    fail(`${location} needs license evidence for a passed redistribution gate`);
  }
  if (product.gateStatus.contract === "passed") {
    if (!product.contractSource) {
      fail(`${location} needs contractSource for a passed contract gate`);
    }
    if (product.contractSource.mutableSource === true) {
      fail(`${location} cannot pass the contract gate with a mutable source`);
    }
    const revision = product.contractSource.revision ?? "";
    const sourceUrl = typeof product.contractSource.url === "string"
      ? product.contractSource.url
      : "";
    if (!/^[0-9a-f]{40}$/.test(revision) || !sourceUrl.includes(`/${revision}/`)) {
      fail(`${location} must pin a passed contract source to a 40-character Git revision in its URL`);
    }
  }
  if (product.contractSource) {
    if (typeof product.contractSource.url !== "string" ||
      !product.contractSource.url.startsWith("https://")) {
      fail(`${location}.contractSource.url must be HTTPS`);
    }
    if (!datePattern.test(product.contractSource.observedAt) ||
      product.contractSource.observedAt > candidates.snapshotDate) {
      fail(`${location}.contractSource.observedAt must be YYYY-MM-DD on or before snapshotDate`);
    }
    if (/raw\.githubusercontent\.com/.test(product.contractSource.url)) {
      if (!/^[0-9a-f]{40}$/.test(product.contractSource.revision ?? "") ||
        !product.contractSource.url.includes(`/${product.contractSource.revision}/`)) {
        fail(`${location}.contractSource must pin raw GitHub evidence to its 40-character revision`);
      }
    }
    if (product.contractSource.mutableSource !== undefined &&
      product.contractSource.mutableSource !== true) {
      fail(`${location}.contractSource.mutableSource may only explicitly mark a mutable source`);
    }
    if (!Number.isInteger(product.contractSource.observedOperations) ||
      product.contractSource.observedOperations < 1) {
      fail(`${location}.contractSource.observedOperations must be positive`);
    }
    if (product.gateStatus.redistribution === "passed" &&
      (!product.contractSource.license || product.contractSource.license === "review-required")) {
      fail(`${location}.contractSource needs an approved license for redistribution`);
    }
  }

  if (!Array.isArray(product.blockers) || (!admitted && !product.blockers.length)) {
    fail(`${location}.blockers must explain why admission is not approved`);
  }
  if (admitted && product.blockers.length) {
    fail(`${location}.blockers must be empty after admission`);
  }
  const blockedGates = gateNames.filter((gate) => product.gateStatus[gate] === "blocked");
  for (const gate of blockedGates) {
    if (!product.blockers.some((blocker) => blocker.gate === gate)) {
      fail(`${location}.blockers must explain blocked gate ${gate}`);
    }
  }
  for (const [index, blocker] of product.blockers.entries()) {
    if (!gateNames.includes(blocker.gate)) {
      fail(`${location}.blockers.${index}.gate is invalid`);
    }
    requireLocalized(blocker, `${location}.blockers.${index}`);
  }

  if (!datePattern.test(product.verifiedAt) || product.verifiedAt > candidates.snapshotDate) {
    fail(`${location}.verifiedAt must be YYYY-MM-DD on or before snapshotDate`);
  }
}

for (const [group, expected] of expectedGroups) {
  const actual = candidates.products
    .filter((product) => product.priority.group === group)
    .sort((a, b) => a.priority.rank - b.priority.rank)
    .map((product) => product.slug);
  if (actual.join("\n") !== expected.join("\n")) {
    fail(`${group} must preserve the roadmap order: ${expected.join(", ")}`);
  }
}

const summary = Object.fromEntries(
  [...expectedGroups.keys()].map((group) => [
    group,
    candidates.products.filter((product) => product.priority.group === group).length
  ])
);
console.log(
  `Verified ${candidates.products.length} candidate API products (${Object.entries(summary)
    .map(([group, count]) => `${group}: ${count}`)
    .join(", ")}).`
);
