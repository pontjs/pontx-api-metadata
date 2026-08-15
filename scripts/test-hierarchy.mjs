import assert from "node:assert/strict";
import { cp, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
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
assert.equal(production.productCount, 10);
assert.equal(production.endpointCount, 281);
assert.equal(production.schemaCount, 890);

const rpc = await validateHierarchy({ root: fixtureRoot, requireMetadataCommit: false });
assert.deepEqual(rpc.errors, []);
assert.equal(rpc.productCount, 1);
assert.equal(rpc.endpointCount, 1);
assert.equal(rpc.schemaCount, 1);

const forbiddenAliasRoot = await mkdtemp(resolve(tmpdir(), "pontx-forbidden-alias-"));
try {
  await cp(fixtureRoot, forbiddenAliasRoot, { recursive: true });
  const sdkPath = resolve(forbiddenAliasRoot, "products/rpc-minimal/sdk.json");
  const sdk = JSON.parse(await readFile(sdkPath, "utf8"));
  sdk.contract.compatibilityAliases = { common: ["getItem"] };
  await writeFile(sdkPath, `${JSON.stringify(sdk, null, 2)}\n`);
  const forbiddenAlias = await validateHierarchy({
    root: forbiddenAliasRoot,
    requireMetadataCommit: false,
  });
  assert(forbiddenAlias.errors.some(
    (error) => error.includes("cannot retain common/default compatibility aliases"),
  ));
} finally {
  await rm(forbiddenAliasRoot, { recursive: true, force: true });
}

console.log("Hierarchy contract tests passed, including RPC and forbidden common/default alias coverage.");
