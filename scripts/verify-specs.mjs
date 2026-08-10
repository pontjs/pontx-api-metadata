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

  const document = JSON.parse(spec.toString("utf8"));
  for (const server of document.servers ?? []) {
    if (!server.url.startsWith("https://")) throw new Error(`${api.slug}: non-HTTPS server ${server.url}`);
  }

  const operationIds = new Set();
  for (const [path, pathItem] of Object.entries(document.paths ?? {})) {
    for (const [method, operation] of Object.entries(pathItem)) {
      if (!["get", "put", "post", "delete", "patch", "head", "options", "trace"].includes(method)) continue;
      if (!operation.operationId) throw new Error(`${api.slug}: ${method.toUpperCase()} ${path} has no operationId`);
      if (operationIds.has(operation.operationId)) throw new Error(`${api.slug}: duplicate operationId ${operation.operationId}`);
      operationIds.add(operation.operationId);

      if (api.documentationStatus && !operation["x-pontx-documentation-status"]) {
        throw new Error(`${api.slug}: ${operation.operationId} has no documentation status`);
      }
      if (api.documentationStatus && !(operation["x-pontx-evidence"]?.length > 0)) {
        throw new Error(`${api.slug}: ${operation.operationId} has no evidence URL`);
      }
      if (api.documentationStatus && !operation["x-pontx-verified-at"]) {
        throw new Error(`${api.slug}: ${operation.operationId} has no verification date`);
      }
    }
  }
}
console.log(`Verified ${source.apis.length} approved OpenAPI documents.`);
