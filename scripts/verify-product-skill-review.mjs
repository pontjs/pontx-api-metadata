import { execFileSync } from "node:child_process";
import { readFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { verifyProductSkillReviewDecision } from "./lib/product-skill-review.mjs";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const argument = (name) => {
  const index = process.argv.indexOf(name);
  return index >= 0 ? process.argv[index + 1] : undefined;
};
const input = argument("--input");
const base = argument("--base");
const head = argument("--head");
const explicitSkills = (argument("--skills") ?? "").split(",").filter(Boolean);
if (!input || !/^[a-f0-9]{40}$/i.test(base ?? "") || !/^[a-f0-9]{40}$/i.test(head ?? "")) {
  console.error("Usage: node scripts/verify-product-skill-review.mjs --input <json> --base <sha> --head <sha> [--skills <names>]");
  process.exit(2);
}

const changedPaths = execFileSync("git", ["diff", "--name-only", base, head], {
  cwd: root,
  encoding: "utf8",
}).split(/\r?\n/).filter(Boolean);
const skillNames = new Set();
for (const path of changedPaths) {
  const match = path.match(/^skills\/(?:products\/(pontx-[a-z0-9-]+)\/|(?:manifests|evidence|evals)\/(pontx-[a-z0-9-]+)\.json$)/);
  const name = match?.[1] ?? match?.[2];
  if (name) skillNames.add(name);
}
for (const name of explicitSkills) {
  if (!/^pontx-[a-z0-9]+(?:-[a-z0-9]+)*$/.test(name)) {
    console.error(`Invalid explicit product Skill name ${name}.`);
    process.exit(2);
  }
  skillNames.add(name);
}
if (!skillNames.size) {
  console.error("Independent review has no changed product Skill sources to verify.");
  process.exit(1);
}

let review;
try {
  review = JSON.parse(await readFile(resolve(root, input), "utf8"));
} catch (error) {
  console.error(`Independent review output is not valid JSON: ${error.message}`);
  process.exit(1);
}
const expectedClaims = new Map();
for (const skillName of [...skillNames].sort()) {
  const evidence = JSON.parse(await readFile(resolve(root, "skills/evidence", `${skillName}.json`), "utf8"));
  for (const claim of evidence.claims) {
    expectedClaims.set(`${skillName}#${claim.id}`, claim.sourceUrl);
  }
}
const errors = verifyProductSkillReviewDecision({ review, head, expectedClaims });

if (errors.length) {
  console.error(`Independent product Skill review gate failed with ${errors.length} error(s):`);
  errors.forEach((error) => console.error(`- ${error}`));
  process.exitCode = 1;
} else {
  console.log(`Independent review passed for ${skillNames.size} Skill(s) at ${head}.`);
}
