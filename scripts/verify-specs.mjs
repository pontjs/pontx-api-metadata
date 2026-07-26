import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const source = JSON.parse(await readFile(resolve(root, "catalog/source.json"), "utf8"));
const compiled = JSON.parse(await readFile(resolve(root, "catalog/catalog.json"), "utf8"));

if (compiled.version !== source.version || compiled.apis.length !== source.apis.length) {
  throw new Error("catalog/catalog.json is stale; run node scripts/build-catalog.mjs");
}
for (const api of source.apis) {
  const spec = await readFile(resolve(root, api.specFile));
  const actual = createHash("sha256").update(spec).digest("hex");
  if (actual !== api.approvedSha256) throw new Error(`${api.slug}: SHA-256 mismatch`);
  if (!compiled.apis.find((item) => item.slug === api.slug)) throw new Error(`${api.slug}: missing from compiled catalog`);
}
console.log(`Verified ${source.apis.length} approved OpenAPI documents.`);
