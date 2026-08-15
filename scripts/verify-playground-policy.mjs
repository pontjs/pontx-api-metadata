import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const catalog = JSON.parse(await readFile(resolve(root, "catalog/products.json"), "utf8"));

let restOperations = 0;
let nonRestOperations = 0;
const disabledOperations = [];

for (const slug of catalog.products) {
  const path = resolve(root, "products", slug, "spec.pontx.json");
  const spec = JSON.parse(await readFile(path, "utf8"));
  for (const api of Object.values(spec.apis ?? {})) {
    if (api.metadata?.execution?.enabled === false) {
      disabledOperations.push(`${slug}/${api.operationId}`);
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
  `No Endpoint may ship a policy-based execution disablement: ${disabledOperations.join(", ")}`,
);

console.log(
  `Playground policy verified: ${restOperations} REST Endpoints are execution-eligible; ${nonRestOperations} non-REST Endpoints require a real protocol adapter rather than a policy disablement.`,
);
