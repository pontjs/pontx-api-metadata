import { writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import {
  buildProductSkillRegistry,
  serializeProductSkillRegistry,
} from "./lib/product-skills.mjs";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const { errors, registry } = await buildProductSkillRegistry({ root });
if (errors.length) {
  console.error(`Product Skill generation failed with ${errors.length} error(s):`);
  errors.forEach((error) => console.error(`- ${error}`));
  process.exitCode = 1;
} else {
  await writeFile(resolve(root, "skills/registry.json"), serializeProductSkillRegistry(registry));
  console.log(`Generated skills/registry.json with ${registry.skills.length} published product Skill(s).`);
}
