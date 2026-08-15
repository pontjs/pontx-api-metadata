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
assert(Array.isArray(catalog.products) && catalog.products.length > 0, "product list is empty");

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
      const response = await fetch(url, { redirect: "follow" });
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

let checked = 0;
for (const locale of ["zh", "en"]) {
  const homepage = await fetchReady(`/${locale}`);
  checked += 1;
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
  `Verified deployed Hub ${baseUrl}: ${products.length} homepage cards and ${checked} SSR routes across zh/en.`,
);
