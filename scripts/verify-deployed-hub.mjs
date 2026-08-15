import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { resolve } from "node:path";

function valueAfter(flag) {
  const index = process.argv.indexOf(flag);
  return index >= 0 ? process.argv[index + 1] : undefined;
}

function slugify(value) {
  return value
    .replace(/([a-z0-9])([A-Z])/g, "$1-$2")
    .replace(/[^a-zA-Z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .toLowerCase();
}

const baseUrl = valueAfter("--base-url")?.replace(/\/$/, "");
const metadataRoot = resolve(valueAfter("--metadata-root") ?? ".");
if (!baseUrl?.startsWith("https://")) {
  throw new Error(
    "Usage: node scripts/verify-deployed-hub.mjs --base-url https://deployment --metadata-root metadata",
  );
}

const readJson = async (path) => JSON.parse(await readFile(path, "utf8"));
const catalog = await readJson(resolve(metadataRoot, "catalog/products.json"));
const skillRegistry = await readJson(resolve(metadataRoot, "skills/registry.json"));
assert(Array.isArray(catalog.products) && catalog.products.length > 0, "product list is empty");
assert(
  skillRegistry?.formatVersion === 1 && Array.isArray(skillRegistry.skills),
  "product Skill registry is invalid",
);

const products = await Promise.all(catalog.products.map(async (slug) => {
  const productRoot = resolve(metadataRoot, "products", slug);
  const [product, localizedProduct, spec, sdk] = await Promise.all([
    readJson(resolve(productRoot, "product.json")),
    readJson(resolve(productRoot, "locales/en-US/product.json")),
    readJson(resolve(productRoot, "spec.pontx.json")),
    readJson(resolve(productRoot, "sdk.json")),
  ]);
  return { slug, product, localizedProduct, spec, sdk };
}));

async function fetchReady(pathname) {
  const url = `${baseUrl}${pathname}`;
  let lastError;
  for (let attempt = 1; attempt <= 6; attempt += 1) {
    try {
      const response = await fetch(url, {
        redirect: "follow",
        signal: AbortSignal.timeout(15_000),
      });
      const body = await response.text();
      if (response.ok && body.length > 100) return { response, body };
      lastError = new Error(`${url} returned ${response.status} (${body.length} bytes)`);
    } catch (error) {
      lastError = error;
    }
    if (attempt < 6) await new Promise((resolveWait) => setTimeout(resolveWait, 5000));
  }
  throw lastError;
}

async function fetchJson(pathname) {
  const { body } = await fetchReady(pathname);
  return JSON.parse(body);
}

const expectedProductSkillNames = skillRegistry.skills.map((skill) => skill.name);
assert(expectedProductSkillNames.length > 0, "published product Skill registry is empty");

const skillList = await fetchJson("/api/v1/skills");
assert.equal(skillList.version, "v1", "Skill list has an unexpected version");
assert.deepEqual(
  skillList.data.map((skill) => skill.name),
  ["pontx-hub", ...expectedProductSkillNames],
  "deployed Skill list does not match the metadata registry",
);

const discoveryIndex = await fetchJson("/.well-known/skills/index.json");
assert.deepEqual(
  discoveryIndex.skills.map((skill) => skill.name),
  ["pontx-hub", ...expectedProductSkillNames],
  "well-known Skill index does not match the metadata registry",
);

for (const expectedSkill of skillRegistry.skills) {
  const detail = await fetchJson(`/api/v1/skills/${expectedSkill.name}`);
  assert.equal(detail.data.name, expectedSkill.name, `${expectedSkill.name} detail has the wrong name`);
  assert.equal(
    detail.data.contentHash,
    expectedSkill.contentHash,
    `${expectedSkill.name} detail has the wrong content hash`,
  );
  assert.deepEqual(
    detail.data.files,
    expectedSkill.files,
    `${expectedSkill.name} install bundle differs from the metadata registry`,
  );
}

let checked = 0;
for (const locale of ["zh", "en"]) {
  const homepage = await fetchReady(`/${locale}`);
  checked += 1;
  const skillsIndex = await fetchReady(`/${locale}/skills`);
  checked += 1;
  for (const skillName of expectedProductSkillNames) {
    assert(
      skillsIndex.body.includes(`/${locale}/skills/${skillName}`),
      `${locale} Skills page is missing ${skillName}`,
    );
    await fetchReady(`/${locale}/skills/${skillName}`);
    checked += 1;
  }
  for (const item of products) {
    const apiPath = `/${locale}/apis/${item.slug}`;
    assert(homepage.body.includes(apiPath), `${locale} homepage is missing card link ${apiPath}`);
    const detail = await fetchReady(apiPath);
    checked += 1;
    const title = locale === "zh"
      ? item.product.display.title
      : item.localizedProduct.display.title;
    assert(detail.body.includes(title), `${apiPath} is missing its localized title`);

    const endpoint = Object.values(item.spec.apis)[0];
    assert(endpoint?.operationId, `${item.slug} has no Endpoint`);
    await fetchReady(`${apiPath}/${slugify(endpoint.operationId)}`);
    checked += 1;

    const schemaName = Object.keys(item.spec.components?.schemas ?? {})[0];
    assert(schemaName, `${item.slug} has no Schema`);
    await fetchReady(`${apiPath}/schemas/${encodeURIComponent(schemaName)}`);
    checked += 1;

    if (item.sdk.package.status === "published") {
      const sdkPath = `/${locale}/sdks/${item.slug}`;
      const sdk = await fetchReady(sdkPath);
      checked += 1;
      assert(sdk.body.includes(item.sdk.package.name), `${sdkPath} is missing ${item.sdk.package.name}`);
    }
  }
}

console.log(
  `Verified deployed Hub ${baseUrl}: ${products.length} homepage cards, ${expectedProductSkillNames.length} product Skills, and ${checked} SSR routes across zh/en.`,
);
