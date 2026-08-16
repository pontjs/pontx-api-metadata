import { execFileSync } from "node:child_process";
import { readFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const argument = (name) => {
  const index = process.argv.indexOf(name);
  return index >= 0 ? process.argv[index + 1] : undefined;
};
const base = argument("--base");
const site = argument("--site") ?? "https://pontx.dev";
const dryRun = process.argv.includes("--dry-run");

if (!base || !(/^[a-f0-9]{7,40}$/i.test(base) || base === "HEAD")) {
  console.error("Usage: node scripts/submit-indexnow.mjs --base <git-commit> [--site https://pontx.dev] [--dry-run]");
  process.exit(2);
}

let origin;
try {
  origin = new URL(site).origin;
  if (!origin.startsWith("https://")) throw new Error("IndexNow requires an HTTPS site origin");
} catch (error) {
  console.error(`Invalid --site origin: ${error instanceof Error ? error.message : String(error)}`);
  process.exit(2);
}

const changedFiles = execFileSync(
  "git",
  ["diff", "--name-only", `${base}..HEAD`, "--", "catalog/products.json", "products", "skills/registry.json"],
  { cwd: root, encoding: "utf8" }
).split("\n").filter(Boolean);

const productSlugs = new Set(
  changedFiles
    .map((file) => /^products\/([a-z0-9]+(?:-[a-z0-9]+)*)\//.exec(file)?.[1])
    .filter(Boolean)
);
const catalogChanged = changedFiles.includes("catalog/products.json");
if (catalogChanged) productSlugs.add("__catalog__");

const index = JSON.parse(await readFile(resolve(root, "catalog/products.json"), "utf8"));
const publishedProducts = new Set(index.products);
const registry = JSON.parse(await readFile(resolve(root, "skills/registry.json"), "utf8"));
let previousRegistry = { skills: [] };
try {
  previousRegistry = JSON.parse(execFileSync("git", ["show", `${base}:skills/registry.json`], {
    cwd: root,
    encoding: "utf8"
  }));
} catch {
  // A commit before the product-Skill registry has no public Skill URLs.
}
const previousSkills = new Map((previousRegistry.skills ?? []).map((skill) => [skill.name, skill]));
const changedSkillApiSlugs = new Set(
  (registry.skills ?? [])
    .filter((skill) => {
      const previous = previousSkills.get(skill.name);
      return !previous || previous.contentHash !== skill.contentHash || previous.version !== skill.version;
    })
    .map((skill) => skill.apiSlug)
);
const urls = new Set();

function addLocaleUrls(path) {
  urls.add(`${origin}/en${path}`);
  urls.add(`${origin}/zh${path}`);
}

if (productSlugs.size || changedSkillApiSlugs.size) {
  addLocaleUrls("");
}

for (const slug of productSlugs) {
  if (slug === "__catalog__" || !publishedProducts.has(slug)) continue;
  const [product, sdk] = await Promise.all([
    readFile(resolve(root, "products", slug, "product.json"), "utf8").then(JSON.parse),
    readFile(resolve(root, "products", slug, "sdk.json"), "utf8").then(JSON.parse)
  ]);
  if (product.slug !== slug) throw new Error(`Product path and declared slug differ for ${slug}`);
  addLocaleUrls(`/apis/${slug}`);
  if (sdk.package?.status === "published") addLocaleUrls(`/sdks/${slug}`);
}

for (const skill of registry.skills ?? []) {
  if (productSlugs.has(skill.apiSlug) || changedSkillApiSlugs.has(skill.apiSlug)) {
    addLocaleUrls(`/skills/${skill.name}`);
  }
}

const urlList = [...urls].sort();
if (!urlList.length) {
  console.log("IndexNow: no changed public entry-point URLs to submit.");
  process.exit(0);
}
if (dryRun) {
  console.log(`IndexNow dry run: ${urlList.length} changed public entry-point URLs.`);
  process.exit(0);
}

const keyLocation = `${origin}/.well-known/indexnow-key.txt`;
const keyResponse = await fetch(keyLocation);
const key = (await keyResponse.text()).trim();
if (!keyResponse.ok || !/^[A-Za-z0-9-]{8,128}$/.test(key)) {
  throw new Error("IndexNow verification key is unavailable or invalid on the deployed canonical host");
}

const response = await fetch("https://api.indexnow.org/IndexNow", {
  method: "POST",
  headers: { "Content-Type": "application/json; charset=utf-8" },
  body: JSON.stringify({
    host: new URL(origin).host,
    key,
    keyLocation,
    urlList
  })
});
if (!response.ok) {
  throw new Error(`IndexNow rejected the submission with HTTP ${response.status}`);
}
console.log(`IndexNow accepted ${urlList.length} changed public entry-point URLs.`);
