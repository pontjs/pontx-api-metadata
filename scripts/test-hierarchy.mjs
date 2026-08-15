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
assert.equal(production.productCount, 18);
assert.equal(production.endpointCount, 1534);
assert.equal(production.schemaCount, 4976);

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

const missingCredentialEnvRoot = await mkdtemp(resolve(tmpdir(), "pontx-missing-credential-env-"));
try {
  await cp(fixtureRoot, missingCredentialEnvRoot, { recursive: true });
  const productPath = resolve(missingCredentialEnvRoot, "products/rpc-minimal/product.json");
  const product = JSON.parse(await readFile(productPath, "utf8"));
  product.credentials = [{
    schemeId: "fixtureToken",
    description: "A fixture bearer credential.",
  }];
  await writeFile(productPath, `${JSON.stringify(product, null, 2)}\n`);
  for (const path of [
    resolve(missingCredentialEnvRoot, "products/rpc-minimal/spec.pontx.json"),
    resolve(missingCredentialEnvRoot, "products/rpc-minimal/locales/en-US/spec.pontx.json"),
  ]) {
    const spec = JSON.parse(await readFile(path, "utf8"));
    spec.components.securitySchemes = { fixtureToken: { type: "http", scheme: "bearer" } };
    await writeFile(path, `${JSON.stringify(spec, null, 2)}\n`);
  }
  const missingCredentialEnv = await validateHierarchy({
    root: missingCredentialEnvRoot,
    requireMetadataCommit: false,
  });
  assert(missingCredentialEnv.errors.some(
    (error) => error.includes("requires an uppercase envVar"),
  ));
} finally {
  await rm(missingCredentialEnvRoot, { recursive: true, force: true });
}

const invalidCredentialSecretRoot = await mkdtemp(resolve(tmpdir(), "pontx-invalid-credential-secret-"));
try {
  await cp(fixtureRoot, invalidCredentialSecretRoot, { recursive: true });
  const productPath = resolve(invalidCredentialSecretRoot, "products/rpc-minimal/product.json");
  const product = JSON.parse(await readFile(productPath, "utf8"));
  product.credentials = [{
    schemeId: "fixtureToken",
    envVar: "PONTX_FIXTURE_TOKEN",
    secretEnvVar: "fixture-secret",
    description: "A fixture OAuth credential.",
  }];
  await writeFile(productPath, `${JSON.stringify(product, null, 2)}\n`);
  const invalidCredentialSecret = await validateHierarchy({
    root: invalidCredentialSecretRoot,
    requireMetadataCommit: false,
  });
  assert(invalidCredentialSecret.errors.some(
    (error) => error.includes("secretEnvVar must be an uppercase environment variable name"),
  ));
} finally {
  await rm(invalidCredentialSecretRoot, { recursive: true, force: true });
}

const invalidSdkArgumentOrderRoot = await mkdtemp(resolve(tmpdir(), "pontx-invalid-sdk-argument-order-"));
try {
  await cp(fixtureRoot, invalidSdkArgumentOrderRoot, { recursive: true });
  const sdkPath = resolve(invalidSdkArgumentOrderRoot, "products/rpc-minimal/sdk.json");
  const sdk = JSON.parse(await readFile(sdkPath, "utf8"));
  sdk.contract.argumentOrder = ["path", "body", "body"];
  await writeFile(sdkPath, `${JSON.stringify(sdk, null, 2)}\n`);
  const invalidSdkArgumentOrder = await validateHierarchy({
    root: invalidSdkArgumentOrderRoot,
    requireMetadataCommit: false,
  });
  assert(invalidSdkArgumentOrder.errors.some(
    (error) => error.includes("SDK argumentOrder must contain path, body, and query exactly once"),
  ));
} finally {
  await rm(invalidSdkArgumentOrderRoot, { recursive: true, force: true });
}

console.log("Hierarchy contract tests passed, including RPC, credential env vars, and forbidden common/default alias coverage.");
