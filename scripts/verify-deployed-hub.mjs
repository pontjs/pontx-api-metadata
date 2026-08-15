import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { resolve } from "node:path";

function valueAfter(flag) {
  const index = process.argv.indexOf(flag);
  return index >= 0 ? process.argv[index + 1] : undefined;
}

const baseUrl = valueAfter("--base-url")?.replace(/\/$/, "");
const catalogPath = resolve(valueAfter("--catalog") ?? "catalog/catalog.json");
if (!baseUrl?.startsWith("https://")) {
  throw new Error("Usage: node scripts/verify-deployed-hub.mjs --base-url https://deployment --catalog catalog/catalog.json");
}
const catalog = JSON.parse(await readFile(catalogPath, "utf8"));
assert(Array.isArray(catalog.apis) && catalog.apis.length > 0, "compiled catalog is empty");

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
  for (const api of catalog.apis) {
    const apiPath = `/${locale}/apis/${api.slug}`;
    assert(homepage.body.includes(apiPath), `${locale} homepage is missing card link ${apiPath}`);
    const detail = await fetchReady(apiPath);
    checked += 1;
    assert(detail.body.includes(api.title[locale]), `${apiPath} is missing its localized title`);

    const operation = api.operations[0];
    assert(operation, `${api.slug} has no Endpoint`);
    await fetchReady(`${apiPath}/${operation.slug}`);
    checked += 1;

    const schema = api.schemas[0];
    assert(schema, `${api.slug} has no Schema`);
    await fetchReady(`${apiPath}/schemas/${encodeURIComponent(schema.name)}`);
    checked += 1;

    if (api.sdkStatus === "published") {
      const sdkPath = `/${locale}/sdks/${api.slug}`;
      const sdk = await fetchReady(sdkPath);
      checked += 1;
      assert(sdk.body.includes(api.packageName), `${sdkPath} is missing ${api.packageName}`);
    }
  }
}

console.log(`Verified deployed Hub ${baseUrl}: ${catalog.apis.length} homepage cards and ${checked} SSR routes across zh/en.`);
