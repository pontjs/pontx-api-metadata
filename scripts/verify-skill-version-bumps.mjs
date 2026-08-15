import { execFileSync } from "node:child_process";
import { readdir, readFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const baseIndex = process.argv.indexOf("--base");
const base = baseIndex >= 0 ? process.argv[baseIndex + 1] : undefined;
if (!base || !/^[a-f0-9]{7,40}$/i.test(base)) {
  console.error("Usage: node scripts/verify-skill-version-bumps.mjs --base <git-commit>");
  process.exit(2);
}

const git = (...args) => execFileSync("git", args, { cwd: root, encoding: "utf8", stdio: ["ignore", "pipe", "pipe"] });
const show = (commit, path) => {
  try {
    return git("show", `${commit}:${path}`);
  } catch {
    return null;
  }
};
const parseVersion = (value) => {
  const match = /^(0|[1-9]\d*)\.(0|[1-9]\d*)\.(0|[1-9]\d*)$/.exec(value ?? "");
  return match ? match.slice(1).map(Number) : null;
};
const compareVersions = (left, right) => {
  for (let index = 0; index < 3; index += 1) {
    if (left[index] !== right[index]) return left[index] - right[index];
  }
  return 0;
};

git("cat-file", "-e", `${base}^{commit}`);
const currentNames = (await readdir(resolve(root, "skills/manifests"), { withFileTypes: true }))
  .filter((entry) => entry.isFile() && entry.name.endsWith(".json"))
  .map((entry) => entry.name.slice(0, -5))
  .sort();
const baseNames = git("ls-tree", "-r", "--name-only", base, "--", "skills/manifests")
  .split(/\r?\n/)
  .filter((path) => /^skills\/manifests\/pontx-[a-z0-9-]+\.json$/.test(path))
  .map((path) => path.slice("skills/manifests/".length, -5))
  .sort();
const errors = [];

for (const deleted of baseNames.filter((name) => !currentNames.includes(name))) {
  errors.push(`${deleted}: deleting a product Skill is not a versioned update; retain it as draft and document withdrawal`);
}

for (const name of currentNames) {
  const manifestPath = `skills/manifests/${name}.json`;
  const current = JSON.parse(await readFile(resolve(root, manifestPath), "utf8"));
  const currentVersion = parseVersion(current.version);
  if (!currentVersion) {
    errors.push(`${name}: invalid current SemVer`);
    continue;
  }
  const previousText = show(base, manifestPath);
  if (previousText === null) {
    if (current.version !== "1.0.0") errors.push(`${name}: a new product Skill must start at 1.0.0`);
    continue;
  }
  const previous = JSON.parse(previousText);
  const previousVersion = parseVersion(previous.version);
  if (!previousVersion) {
    errors.push(`${name}: base manifest has invalid SemVer`);
    continue;
  }
  if (previous.name !== current.name || previous.apiSlug !== current.apiSlug) {
    errors.push(`${name}: name and apiSlug are stable identities and cannot change in place`);
  }
  if (compareVersions(currentVersion, previousVersion) < 0) {
    errors.push(`${name}: version cannot decrease from ${previous.version} to ${current.version}`);
  }
  const filePaths = new Set([...(previous.files ?? []), ...(current.files ?? [])]);
  let bundleChanged = JSON.stringify(previous.files ?? []) !== JSON.stringify(current.files ?? []);
  for (const file of filePaths) {
    const path = `skills/products/${name}/${file}`;
    const before = show(base, path);
    let after = null;
    try {
      after = await readFile(resolve(root, path), "utf8");
    } catch {
      // A removed bundle file is still a content change and is validated elsewhere.
    }
    if (before !== after) bundleChanged = true;
  }
  if (bundleChanged && compareVersions(currentVersion, previousVersion) <= 0) {
    errors.push(`${name}: installed bytes changed without increasing ${previous.version}`);
  }
}

if (errors.length) {
  console.error(`Product Skill version validation failed with ${errors.length} error(s):`);
  errors.forEach((error) => console.error(`- ${error}`));
  process.exitCode = 1;
} else {
  console.log(`Verified product Skill versions against ${base}.`);
}
