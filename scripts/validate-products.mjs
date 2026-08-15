import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { validateHierarchy } from "./lib/hierarchy.mjs";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const result = await validateHierarchy({
  root,
  requireMetadataCommit: process.env.PONTX_ALLOW_UNPINNED_COMMIT !== "1",
});
if (!result.valid) {
  console.error(`Hierarchy validation failed with ${result.errors.length} error(s):`);
  result.errors.slice(0, 200).forEach((error) => console.error(`- ${error}`));
  process.exitCode = 1;
} else {
  console.log(
    `Verified ${result.productCount} products, ${result.endpointCount} Endpoints, and ${result.schemaCount} Schemas.`,
  );
}
