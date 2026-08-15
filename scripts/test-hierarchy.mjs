import assert from "node:assert/strict";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { validateHierarchy } from "./lib/hierarchy.mjs";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const fixtureRoot = resolve(root, "tests/fixtures/rpc-hierarchy");

const production = await validateHierarchy({
  root,
  requireMetadataCommit: process.env.PONTX_ALLOW_UNPINNED_COMMIT !== "1",
});
assert.deepEqual(production.errors, []);
assert.equal(production.productCount, 9);
assert.equal(production.endpointCount, 258);
assert.equal(production.schemaCount, 776);

const rpc = await validateHierarchy({ root: fixtureRoot, requireMetadataCommit: false });
assert.deepEqual(rpc.errors, []);
assert.equal(rpc.productCount, 1);
assert.equal(rpc.endpointCount, 1);
assert.equal(rpc.schemaCount, 1);

console.log("Hierarchy contract tests passed, including the non-HTTP RPC fixture.");
