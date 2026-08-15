import { execFileSync } from "node:child_process";
import { appendFile, readFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const argument = (name) => {
  const index = process.argv.indexOf(name);
  return index >= 0 ? process.argv[index + 1] : undefined;
};
const base = argument("--base");
const outputPath = argument("--github-output");
const forceSkill = argument("--skill");
const includeAll = process.argv.includes("--all");
if (!base || !/^[a-f0-9]{7,40}$/i.test(base)) {
  console.error("Usage: node scripts/list-changed-published-skills.mjs --base <git-commit> [--github-output <path>]");
  process.exit(2);
}

const current = JSON.parse(await readFile(resolve(root, "skills/registry.json"), "utf8"));
let previous = { formatVersion: 1, skills: [] };
try {
  previous = JSON.parse(execFileSync("git", ["show", `${base}:skills/registry.json`], {
    cwd: root,
    encoding: "utf8",
    stdio: ["ignore", "pipe", "pipe"],
  }));
} catch {
  // The first registry-bearing commit compares against an empty registry.
}
const previousByName = new Map((previous.skills ?? []).map((skill) => [skill.name, skill]));
const include = (current.skills ?? [])
  .filter((skill) => {
    if (includeAll) return true;
    if (forceSkill) return skill.name === forceSkill || skill.apiSlug === forceSkill;
    const before = previousByName.get(skill.name);
    return !before || before.contentHash !== skill.contentHash || before.version !== skill.version;
  })
  .map((skill) => ({
    name: skill.name,
    path: `skills/products/${skill.name}`,
    version: skill.version,
    contentHash: skill.contentHash,
  }));
if (forceSkill && include.length !== 1) {
  console.error(`--skill must identify one currently published Skill: ${forceSkill}`);
  process.exit(1);
}
const matrix = JSON.stringify({ include });
if (outputPath) {
  await appendFile(outputPath, `matrix=${matrix}\ncount=${include.length}\n`);
} else {
  console.log(matrix);
}
