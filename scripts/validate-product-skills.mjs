import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { validateProductSkillRepository } from "./lib/product-skills.mjs";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const result = await validateProductSkillRepository({ root });
if (!result.valid) {
  console.error(`Product Skill validation failed with ${result.errors.length} error(s):`);
  result.errors.slice(0, 200).forEach((error) => console.error(`- ${error}`));
  process.exitCode = 1;
} else {
  console.log(
    `Verified ${result.allSkills.length} product Skill source(s) and ${result.registry.skills.length} published bundle(s).`,
  );
}
