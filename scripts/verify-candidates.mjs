import { readdir, readFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const readJson = async (path) => JSON.parse(await readFile(path, "utf8"));
const registry = await readJson(resolve(root, "candidates/products.json"));
const admitted = new Set((await readJson(resolve(root, "catalog/products.json"))).products);
const errors = [];
const slugPattern = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
const datePattern = /^\d{4}-\d{2}-\d{2}$/;
const gateNames = ["authority", "redistribution", "contract", "transport", "risk", "sdkCli"];
const gateStatuses = new Set(["passed", "pending", "blocked"]);

if (registry.formatVersion !== 1) errors.push("candidate registry formatVersion must be 1");
if (!datePattern.test(registry.snapshotDate)) errors.push("candidate snapshotDate must use YYYY-MM-DD");
if (registry.roadmap !== "docs/api-collection-growth-priority.md") {
  errors.push("candidate registry must point to the canonical roadmap");
} else {
  try {
    await readFile(resolve(root, registry.roadmap));
  } catch {
    errors.push("candidate roadmap does not exist");
  }
}
if (!Array.isArray(registry.products) || registry.products.length !== 22) {
  errors.push("candidate registry must contain the 22 products that are not admitted");
}
if (new Set(registry.products).size !== registry.products.length) {
  errors.push("candidate slugs must be unique");
}
const directories = (await readdir(resolve(root, "candidates"), { withFileTypes: true }))
  .filter((entry) => entry.isDirectory()).map((entry) => entry.name).sort();
if (JSON.stringify(directories) !== JSON.stringify([...registry.products].sort())) {
  errors.push("candidate directories must exactly match candidates/products.json");
}

for (const slug of registry.products) {
  if (!slugPattern.test(slug)) errors.push(`${slug}: invalid candidate slug`);
  if (admitted.has(slug)) errors.push(`${slug}: admitted products cannot remain candidates`);
  try {
    const candidate = await readJson(resolve(root, "candidates", slug, "candidate.json"));
    if (candidate.formatVersion !== 1 || candidate.slug !== slug) {
      errors.push(`${slug}: candidate identity is invalid`);
    }
    if (candidate.admissionDecision !== "not-approved") {
      errors.push(`${slug}: candidate cannot claim catalog admission`);
    }
    for (const field of ["provider", "category", "stage"]) {
      if (typeof candidate[field] !== "string" || !candidate[field].trim()) {
        errors.push(`${slug}: ${field} must be non-empty`);
      }
    }
    for (const localizedField of ["name", "boundary", "nextAction"]) {
      if (!["zh", "en"].every((locale) =>
        typeof candidate[localizedField]?.[locale] === "string"
        && candidate[localizedField][locale].trim())) {
        errors.push(`${slug}: ${localizedField} must include zh and en text`);
      }
    }
    const actualGates = Object.keys(candidate.gateStatus ?? {}).sort();
    if (JSON.stringify(actualGates) !== JSON.stringify([...gateNames].sort())) {
      errors.push(`${slug}: gateStatus is incomplete`);
    }
    for (const gate of gateNames) {
      if (!gateStatuses.has(candidate.gateStatus?.[gate])) {
        errors.push(`${slug}: gate ${gate} is invalid`);
      }
    }
    if (candidate.gateStatus?.sdkCli === "passed") {
      errors.push(`${slug}: an unadmitted candidate cannot claim SDK/CLI publication`);
    }
    if (!Array.isArray(candidate.evidence) || candidate.evidence.length < 2) {
      errors.push(`${slug}: at least two evidence links are required`);
    }
    for (const evidence of candidate.evidence ?? []) {
      if (!String(evidence.url ?? "").startsWith("https://")) {
        errors.push(`${slug}: evidence URLs must use HTTPS`);
      }
    }
    if (!Array.isArray(candidate.blockers) || candidate.blockers.length === 0) {
      errors.push(`${slug}: candidate blockers must explain non-admission`);
    }
    if (!datePattern.test(candidate.verifiedAt)) {
      errors.push(`${slug}: verifiedAt must use YYYY-MM-DD`);
    }
  } catch (error) {
    errors.push(`${slug}: ${error.message}`);
  }
}

if (errors.length) {
  console.error(`Candidate validation failed with ${errors.length} error(s):`);
  errors.forEach((error) => console.error(`- ${error}`));
  process.exitCode = 1;
} else {
  console.log(`Verified ${registry.products.length} isolated candidate products.`);
}
