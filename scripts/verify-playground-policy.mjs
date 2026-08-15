import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const catalog = JSON.parse(await readFile(resolve(root, "catalog/products.json"), "utf8"));

let restOperations = 0;
let nonRestOperations = 0;
const disabledOperations = [];
const riskScopedDisabledOperations = [];

for (const slug of catalog.products) {
  const path = resolve(root, "products", slug, "spec.pontx.json");
  const spec = JSON.parse(await readFile(path, "utf8"));
  const provenance = JSON.parse(await readFile(
    resolve(root, "products", slug, "sources", "provenance.json"),
    "utf8",
  ));
  const hubProxyEnabled = provenance.riskReview?.hubProxyEnabled;
  for (const api of Object.values(spec.apis ?? {})) {
    if (api.metadata?.execution?.enabled === false) {
      const operation = `${slug}/${api.operationId}`;
      if (hubProxyEnabled === false) {
        riskScopedDisabledOperations.push(operation);
      } else {
        disabledOperations.push(operation);
      }
    }

    if (spec.style === "RESTFul") {
      restOperations += 1;
      assert.equal(typeof api.method, "string", `${slug}/${api.operationId} needs an HTTP method`);
      assert.equal(typeof api.path, "string", `${slug}/${api.operationId} needs an HTTP path`);
    } else {
      nonRestOperations += 1;
    }
  }
}

assert.deepEqual(
  disabledOperations,
  [],
  `Execution disablement requires product-specific provenance that sets riskReview.hubProxyEnabled to false: ${disabledOperations.join(", ")}`,
);

console.log(
  `Playground policy verified: ${restOperations} REST Endpoints, ${riskScopedDisabledOperations.length} risk-scoped direct-only Endpoints, and ${nonRestOperations} non-REST Endpoints.`,
);
