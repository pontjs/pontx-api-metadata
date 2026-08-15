import { createHash } from "node:crypto";
import { lstat, readdir, readFile } from "node:fs/promises";
import { resolve } from "node:path";

const SKILL_NAME_PATTERN = /^pontx-[a-z0-9]+(?:-[a-z0-9]+)*$/;
const SLUG_PATTERN = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
const SEMVER_PATTERN = /^(0|[1-9]\d*)\.(0|[1-9]\d*)\.(0|[1-9]\d*)$/;
const SHA256_PATTERN = /^[a-f0-9]{64}$/;
const MANIFEST_KEYS = new Set([
  "formatVersion",
  "name",
  "apiSlug",
  "version",
  "license",
  "status",
  "files",
]);
const EVIDENCE_KEYS = new Set(["formatVersion", "apiSlug", "claims"]);
const CLAIM_KEYS = new Set([
  "id",
  "claim",
  "summary",
  "sourceUrl",
  "sourceType",
  "verifiedAt",
]);
const SOURCE_TYPES = new Set([
  "official-spec",
  "official-documentation",
  "official-sdk",
  "official-changelog",
]);
const REGISTRY_ITEM_KEYS = new Set([
  "name",
  "apiSlug",
  "version",
  "description",
  "license",
  "contentHash",
  "files",
]);

const readJson = async (path) => JSON.parse(await readFile(path, "utf8"));
const sha256 = (bytes) => createHash("sha256").update(bytes).digest("hex");
const hasText = (value) => typeof value === "string" && value.trim().length > 0;
const compareUtf8Paths = (left, right) => Buffer.compare(
  Buffer.from(left, "utf8"),
  Buffer.from(right, "utf8"),
);
const sorted = (values) => [...values].sort(compareUtf8Paths);

function exactKeys(value, allowed, context, errors) {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    errors.push(`${context}: must be an object`);
    return;
  }
  for (const key of Object.keys(value)) {
    if (!allowed.has(key)) errors.push(`${context}: unexpected field ${key}`);
  }
  for (const key of allowed) {
    if (!Object.hasOwn(value, key)) errors.push(`${context}: missing field ${key}`);
  }
}

function parseScalar(value) {
  const trimmed = value.trim();
  if ((trimmed.startsWith('"') && trimmed.endsWith('"'))
    || (trimmed.startsWith("'") && trimmed.endsWith("'"))) {
    return trimmed.slice(1, -1);
  }
  return trimmed;
}

export function parseSkillMarkdown(text, context = "SKILL.md") {
  const match = text.match(/^---\r?\n([\s\S]*?)\r?\n---(?:\r?\n|$)/);
  if (!match) throw new Error(`${context}: YAML frontmatter is required`);
  const lines = match[1].split(/\r?\n/);
  const frontmatter = {};
  for (let index = 0; index < lines.length; index += 1) {
    const line = lines[index];
    if (!line.trim()) continue;
    const field = line.match(/^([A-Za-z][A-Za-z0-9_-]*):(?:\s*(.*))?$/);
    if (!field) throw new Error(`${context}: unsupported frontmatter line ${index + 1}`);
    const [, key, rawValue = ""] = field;
    if (!new Set(["name", "description"]).has(key)) {
      throw new Error(`${context}: unsupported frontmatter field ${key}`);
    }
    if (Object.hasOwn(frontmatter, key)) {
      throw new Error(`${context}: duplicate frontmatter field ${key}`);
    }
    if (/^[>|][+-]?$/.test(rawValue.trim())) {
      const folded = rawValue.trim().startsWith(">");
      const parts = [];
      while (index + 1 < lines.length && (/^\s+/.test(lines[index + 1]) || !lines[index + 1])) {
        index += 1;
        parts.push(lines[index].replace(/^\s+/, ""));
      }
      frontmatter[key] = folded ? parts.join(" ").replace(/\s+/g, " ").trim() : parts.join("\n").trim();
    } else {
      frontmatter[key] = parseScalar(rawValue);
    }
  }
  return {
    frontmatter,
    body: text.slice(match[0].length),
  };
}

function countWords(text) {
  return text.match(/[A-Za-z0-9]+(?:['’-][A-Za-z0-9]+)*/g)?.length ?? 0;
}

function validateRelativeFilePath(path, context, errors) {
  if (!hasText(path)
    || path.startsWith("/")
    || path.includes("\\")
    || path.split("/").some((part) => !part || part === "." || part === "..")) {
    errors.push(`${context}: unsafe bundle path ${JSON.stringify(path)}`);
  }
}

async function validateSourceLayout(skillRoot, manifest, context, errors) {
  const allowed = new Set(["SKILL.md"]);
  if (manifest.files?.some((path) => path.startsWith("references/"))) allowed.add("references");
  const rootEntries = await readdir(skillRoot, { withFileTypes: true });
  for (const entry of rootEntries) {
    if (!allowed.has(entry.name)) errors.push(`${context}: unexpected source entry ${entry.name}`);
  }

  const references = manifest.files?.filter((path) => path.startsWith("references/")) ?? [];
  if (references.length > 1) errors.push(`${context}: at most one reference file may be bundled`);
  if (references.length) {
    const referenceEntries = await readdir(resolve(skillRoot, "references"), { withFileTypes: true });
    if (referenceEntries.length !== 1
      || `references/${referenceEntries[0].name}` !== references[0]
      || !referenceEntries[0].isFile()) {
      errors.push(`${context}: references/ must contain exactly the one manifest-declared Markdown file`);
    }
  }
}

async function loadBundleFiles(skillRoot, manifest, context, manifestContext, errors) {
  if (!Array.isArray(manifest.files)) {
    errors.push(`${manifestContext}: files must be an array`);
    return [];
  }
  if (manifest.files.length < 1 || manifest.files.length > 2 || manifest.files[0] !== "SKILL.md") {
    errors.push(`${manifestContext}: files must start with SKILL.md and contain at most one reference`);
  }
  if (new Set(manifest.files).size !== manifest.files.length) {
    errors.push(`${manifestContext}: files must be unique`);
  }
  if (JSON.stringify(manifest.files) !== JSON.stringify(sorted(manifest.files))) {
    errors.push(`${manifestContext}: files must be lexicographically sorted`);
  }

  const files = [];
  for (const path of manifest.files) {
    validateRelativeFilePath(path, manifestContext, errors);
    if (path !== "SKILL.md" && !/^references\/[a-z0-9]+(?:-[a-z0-9]+)*\.md$/.test(path)) {
      errors.push(`${manifestContext}: unsupported bundle file ${path}`);
    }
    try {
      const absolute = resolve(skillRoot, path);
      const stat = await lstat(absolute);
      if (!stat.isFile() || stat.isSymbolicLink()) {
        errors.push(`${context}/${path}: bundle entries must be regular files, not links`);
        continue;
      }
      const bytes = await readFile(absolute);
      const content = bytes.toString("utf8");
      if (!Buffer.from(content, "utf8").equals(bytes)) {
        errors.push(`${context}/${path}: bundle files must be valid UTF-8`);
        continue;
      }
      files.push({ path, sha256: sha256(bytes), content, bytes });
    } catch (error) {
      errors.push(`${context}/${path}: ${error.message}`);
    }
  }
  return files;
}

export function hashBundleFiles(files) {
  const hash = createHash("sha256");
  for (const file of [...files].sort((left, right) => compareUtf8Paths(left.path, right.path))) {
    hash.update(Buffer.from(file.path, "utf8"));
    hash.update(Buffer.from([0]));
    hash.update(file.bytes ?? Buffer.from(file.content, "utf8"));
    hash.update(Buffer.from([0]));
  }
  return hash.digest("hex");
}

function validateManifest(manifest, directoryName, catalogSlugs, context, errors) {
  exactKeys(manifest, MANIFEST_KEYS, context, errors);
  if (manifest.formatVersion !== 1) errors.push(`${context}: manifest formatVersion must be 1`);
  if (!SKILL_NAME_PATTERN.test(manifest.name ?? "")) errors.push(`${context}: invalid skill name`);
  if (!SLUG_PATTERN.test(manifest.apiSlug ?? "")) errors.push(`${context}: invalid apiSlug`);
  if (manifest.name !== directoryName || manifest.name !== `pontx-${manifest.apiSlug}`) {
    errors.push(`${context}: directory, name, and pontx-<apiSlug> identity must match`);
  }
  if (!catalogSlugs.has(manifest.apiSlug)) errors.push(`${context}: apiSlug is not admitted in catalog/products.json`);
  if (!SEMVER_PATTERN.test(manifest.version ?? "")) errors.push(`${context}: version must be stable SemVer`);
  if (manifest.license !== "MIT-0") errors.push(`${context}: distributable skills must use MIT-0`);
  if (!new Set(["draft", "published"]).has(manifest.status)) {
    errors.push(`${context}: status must be draft or published`);
  }
}

function validateSkillBody({ manifest, markdown, sdk, context, errors }) {
  const { frontmatter, body } = markdown;
  if (frontmatter.name !== manifest.name) errors.push(`${context}/SKILL.md: frontmatter name must match manifest`);
  if (!hasText(frontmatter.description)) errors.push(`${context}/SKILL.md: description is required`);
  if ((frontmatter.description ?? "").length > 300) errors.push(`${context}/SKILL.md: description exceeds 300 characters`);
  if (/\p{Script=Han}/u.test(frontmatter.description ?? "") || /\p{Script=Han}/u.test(body)) {
    errors.push(`${context}/SKILL.md: product skill content must be English-only`);
  }
  if (countWords(body) > 1000) errors.push(`${context}/SKILL.md: body exceeds 1,000 English words`);
  if (body.split(/\r?\n/).filter((line) => line.trim()).length > 120) {
    errors.push(`${context}/SKILL.md: body exceeds 120 non-empty lines`);
  }
  for (const command of ["pontx-hub search", "pontx-hub show", "pontx-hub sdk"]) {
    if (!body.includes(command)) errors.push(`${context}/SKILL.md: must defer current metadata to ${command}`);
  }
  if (!body.includes(`@pontx/${manifest.apiSlug}`)) {
    errors.push(`${context}/SKILL.md: must present the unified @pontx/${manifest.apiSlug} SDK`);
  }
  const expectedCli = sdk?.cli?.name ?? `pontx-${manifest.apiSlug}`;
  if (!body.includes(expectedCli)) errors.push(`${context}/SKILL.md: must mention the declared product CLI ${expectedCli}`);
  if (!/preview/i.test(body) || !/(explicit|confirm|approval|approve)/i.test(body)) {
    errors.push(`${context}/SKILL.md: preview-first and explicit approval boundaries are required`);
  }
  if (!/(credential|secret|token)/i.test(body)) {
    errors.push(`${context}/SKILL.md: credential handling guidance is required`);
  }
  if (!/^## Few-shot workflows\s*$/m.test(body)) {
    errors.push(`${context}/SKILL.md: a Few-shot workflows section is required`);
  }
  const scenarios = body.match(/^### Scenario [1-3](?:\b|:)/gm) ?? [];
  if (scenarios.length < 2 || scenarios.length > 3) {
    errors.push(`${context}/SKILL.md: include two or three ` + "`### Scenario N`" + " workflows");
  }
  for (const forbidden of [
    /^## (?:Endpoint|Parameter|Schema)s?\s*$/im,
    /^openapi:\s*["']?3/im,
    /^\s*["']?(?:paths|components)["']?\s*:/im,
  ]) {
    if (forbidden.test(body)) {
      errors.push(`${context}/SKILL.md: do not duplicate Endpoint, parameter, Schema, or OAS inventories`);
      break;
    }
  }
}

function validateEvidence(evidence, manifest, skillText, context, errors) {
  exactKeys(evidence, EVIDENCE_KEYS, context, errors);
  if (evidence.formatVersion !== 1) errors.push(`${context}: evidence formatVersion must be 1`);
  if (evidence.apiSlug !== manifest.apiSlug) errors.push(`${context}: evidence apiSlug must match manifest`);
  if (!Array.isArray(evidence.claims) || !evidence.claims.length) {
    errors.push(`${context}: evidence must contain at least one claim`);
    return;
  }
  const ids = new Set();
  const normalizedSkillText = skillText.replace(/\s+/g, " ").trim();
  for (const [index, claim] of evidence.claims.entries()) {
    const claimContext = `${context} claims[${index}]`;
    exactKeys(claim, CLAIM_KEYS, claimContext, errors);
    if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(claim.id ?? "") || ids.has(claim.id)) {
      errors.push(`${claimContext}: id must be unique lowercase kebab-case`);
    }
    ids.add(claim.id);
    for (const field of ["claim", "summary"]) {
      if (!hasText(claim[field])) errors.push(`${claimContext}: ${field} must be non-empty`);
    }
    if (hasText(claim.claim)
      && !normalizedSkillText.includes(claim.claim.replace(/\s+/g, " ").trim())) {
      errors.push(`${claimContext}: claim must exactly quote text present in SKILL.md`);
    }
    let source;
    try {
      source = new URL(claim.sourceUrl);
      if (source.protocol !== "https:" || source.username || source.password || (source.port && source.port !== "443")) {
        throw new Error("not a credential-free HTTPS URL on the default port");
      }
    } catch (error) {
      errors.push(`${claimContext}: sourceUrl must be a credential-free HTTPS URL (${error.message})`);
    }
    if (!SOURCE_TYPES.has(claim.sourceType)) errors.push(`${claimContext}: unsupported sourceType`);
    if (!/^\d{4}-\d{2}-\d{2}$/.test(claim.verifiedAt ?? "")
      || Number.isNaN(Date.parse(`${claim.verifiedAt}T00:00:00Z`))) {
      errors.push(`${claimContext}: verifiedAt must be an ISO calendar date`);
    } else {
      const verified = Date.parse(`${claim.verifiedAt}T00:00:00Z`);
      const ageDays = Math.floor((Date.now() - verified) / 86_400_000);
      if (ageDays < 0) errors.push(`${claimContext}: verifiedAt cannot be in the future`);
      if (ageDays > 365) errors.push(`${claimContext}: official evidence is older than 365 days and must be reverified`);
    }
  }
}

function validateEvals(evals, manifest, context, errors) {
  exactKeys(evals, new Set(["skill_name", "evals"]), context, errors);
  if (evals.skill_name !== manifest.name) errors.push(`${context}: eval skill_name must match manifest`);
  if (!Array.isArray(evals.evals) || evals.evals.length < 2 || evals.evals.length > 3) {
    errors.push(`${context}: provide two or three smoke evals`);
    return;
  }
  const ids = new Set();
  for (const [index, evaluation] of evals.evals.entries()) {
    const evalContext = `${context} evals[${index}]`;
    exactKeys(evaluation, new Set(["id", "prompt", "expected_output", "files"]), evalContext, errors);
    if ((!Number.isInteger(evaluation.id) && !hasText(evaluation.id)) || ids.has(String(evaluation.id))) {
      errors.push(`${evalContext}: id must be a unique integer or string`);
    }
    ids.add(String(evaluation.id));
    if (!hasText(evaluation.prompt) || !hasText(evaluation.expected_output)) {
      errors.push(`${evalContext}: prompt and expected_output are required`);
    }
    if (!Array.isArray(evaluation.files) || evaluation.files.length !== 0) {
      errors.push(`${evalContext}: product smoke eval files must currently be empty`);
    }
  }
}

async function loadOneSkill({ root, directoryName, catalogSlugs, errors }) {
  const context = `skills/products/${directoryName}`;
  const manifestContext = `skills/manifests/${directoryName}.json`;
  const evidenceContext = `skills/evidence/${directoryName}.json`;
  const evalsContext = `skills/evals/${directoryName}.json`;
  const skillRoot = resolve(root, context);
  try {
    const [manifest, evidence, evals, skillBytes] = await Promise.all([
      readJson(resolve(root, "skills/manifests", `${directoryName}.json`)),
      readJson(resolve(root, "skills/evidence", `${directoryName}.json`)),
      readJson(resolve(root, "skills/evals", `${directoryName}.json`)),
      readFile(resolve(skillRoot, "SKILL.md")),
    ]);
    validateManifest(manifest, directoryName, catalogSlugs, manifestContext, errors);
    await validateSourceLayout(skillRoot, manifest, context, errors);
    const files = await loadBundleFiles(skillRoot, manifest, context, manifestContext, errors);
    const skillText = skillBytes.toString("utf8");
    let markdown = { frontmatter: {}, body: "" };
    try {
      markdown = parseSkillMarkdown(skillText, `${context}/SKILL.md`);
    } catch (error) {
      errors.push(error.message);
    }
    let sdk;
    try {
      sdk = await readJson(resolve(root, "products", manifest.apiSlug, "sdk.json"));
    } catch (error) {
      errors.push(`${context}: cannot load declared product SDK metadata (${error.message})`);
    }
    validateSkillBody({ manifest, markdown, sdk, context, errors });
    validateEvidence(evidence, manifest, skillText, evidenceContext, errors);
    validateEvals(evals, manifest, evalsContext, errors);
    for (const file of files.filter((item) => item.path.startsWith("references/"))) {
      if (countWords(file.content) > 600
        || file.content.split(/\r?\n/).filter((line) => line.trim()).length > 80) {
        errors.push(`${context}/${file.path}: reference exceeds 600 words or 80 non-empty lines`);
      }
      if (/\p{Script=Han}/u.test(file.content)) {
        errors.push(`${context}/${file.path}: product skill references must be English-only`);
      }
    }
    return {
      manifest,
      evidence,
      evals,
      description: markdown.frontmatter.description,
      files: files.map(({ path, sha256: fileSha, content }) => ({ path, sha256: fileSha, content })),
      contentHash: hashBundleFiles(files),
    };
  } catch (error) {
    errors.push(`${context}: ${error.message}`);
    return null;
  }
}

export async function buildProductSkillRegistry({ root }) {
  const errors = [];
  const catalog = await readJson(resolve(root, "catalog/products.json"));
  const catalogSlugs = new Set(catalog.products ?? []);
  const productsRoot = resolve(root, "skills/products");
  const entries = await readdir(productsRoot, { withFileTypes: true });
  const directoryNames = sorted(entries
    .filter((entry) => entry.isDirectory() && entry.name.startsWith("pontx-"))
    .map((entry) => entry.name));
  for (const controlDirectory of ["manifests", "evidence", "evals"]) {
    const controlEntries = await readdir(resolve(root, "skills", controlDirectory), { withFileTypes: true });
    const actual = sorted(controlEntries
      .filter((entry) => entry.isFile() && entry.name.endsWith(".json"))
      .map((entry) => entry.name));
    const expected = sorted(directoryNames.map((name) => `${name}.json`));
    if (JSON.stringify(actual) !== JSON.stringify(expected)
      || controlEntries.some((entry) => !entry.isFile()
        || (entry.name !== ".gitkeep" && !entry.name.endsWith(".json")))) {
      errors.push(`skills/${controlDirectory}/ must contain exactly one JSON file per product Skill`);
    }
  }
  const skills = [];
  for (const directoryName of directoryNames) {
    const skill = await loadOneSkill({ root, directoryName, catalogSlugs, errors });
    if (skill) skills.push(skill);
  }
  const registry = {
    formatVersion: 1,
    skills: skills
      .filter((skill) => skill.manifest.status === "published")
      .map((skill) => ({
        name: skill.manifest.name,
        apiSlug: skill.manifest.apiSlug,
        version: skill.manifest.version,
        description: skill.description,
        license: skill.manifest.license,
        contentHash: skill.contentHash,
        files: skill.files,
      })),
  };
  return { errors, registry, allSkills: skills };
}

export function serializeProductSkillRegistry(registry) {
  return `${JSON.stringify(registry, null, 2)}\n`;
}

export async function validateProductSkillRegistryShape(registry, errors = []) {
  exactKeys(registry, new Set(["formatVersion", "skills"]), "skills/registry.json", errors);
  if (registry.formatVersion !== 1) errors.push("skills/registry.json: formatVersion must be 1");
  if (!Array.isArray(registry.skills)) {
    errors.push("skills/registry.json: skills must be an array");
    return errors;
  }
  const names = [];
  for (const [index, skill] of registry.skills.entries()) {
    const context = `skills/registry.json skills[${index}]`;
    exactKeys(skill, REGISTRY_ITEM_KEYS, context, errors);
    names.push(skill.name);
    if (!SKILL_NAME_PATTERN.test(skill.name ?? "") || skill.name !== `pontx-${skill.apiSlug}`) {
      errors.push(`${context}: invalid name/apiSlug identity`);
    }
    if (!SEMVER_PATTERN.test(skill.version ?? "")) errors.push(`${context}: invalid version`);
    if (skill.license !== "MIT-0") errors.push(`${context}: license must be MIT-0`);
    if (!hasText(skill.description) || skill.description.length > 300) errors.push(`${context}: invalid description`);
    if (!SHA256_PATTERN.test(skill.contentHash ?? "")) errors.push(`${context}: invalid contentHash`);
    if (!Array.isArray(skill.files) || !skill.files.length) {
      errors.push(`${context}: files must be non-empty`);
      continue;
    }
    const hashFiles = [];
    for (const [fileIndex, file] of skill.files.entries()) {
      const fileContext = `${context}.files[${fileIndex}]`;
      exactKeys(file, new Set(["path", "sha256", "content"]), fileContext, errors);
      validateRelativeFilePath(file.path, fileContext, errors);
      if (!SHA256_PATTERN.test(file.sha256 ?? "") || sha256(Buffer.from(file.content ?? "", "utf8")) !== file.sha256) {
        errors.push(`${fileContext}: SHA-256 does not match content`);
      }
      hashFiles.push({ path: file.path, content: file.content });
    }
    if (JSON.stringify(skill.files.map((file) => file.path))
      !== JSON.stringify(sorted(skill.files.map((file) => file.path)))) {
      errors.push(`${context}: files must be sorted by path`);
    }
    if (hashBundleFiles(hashFiles) !== skill.contentHash) errors.push(`${context}: contentHash mismatch`);
  }
  if (JSON.stringify(names) !== JSON.stringify(sorted(names)) || new Set(names).size !== names.length) {
    errors.push("skills/registry.json: skills must be unique and sorted by name");
  }
  return errors;
}

export async function validateProductSkillRepository({ root }) {
  const { errors, registry, allSkills } = await buildProductSkillRegistry({ root });
  try {
    const registryPath = resolve(root, "skills/registry.json");
    const registryText = await readFile(registryPath, "utf8");
    let committedRegistry;
    try {
      committedRegistry = JSON.parse(registryText);
      await validateProductSkillRegistryShape(committedRegistry, errors);
    } catch (error) {
      errors.push(`skills/registry.json: ${error.message}`);
    }
    const expected = serializeProductSkillRegistry(registry);
    if (registryText !== expected) {
      errors.push("skills/registry.json: generated registry is stale; run pnpm skills:build");
    }
  } catch (error) {
    errors.push(`skills/registry.json: ${error.message}`);
  }
  return { valid: errors.length === 0, errors, registry, allSkills };
}
