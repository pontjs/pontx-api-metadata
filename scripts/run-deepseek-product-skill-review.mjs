import { execFileSync } from "node:child_process";
import { readFile, writeFile } from "node:fs/promises";
import { dirname, relative, resolve, sep } from "node:path";
import { fileURLToPath } from "node:url";

import {
  aggregateProductSkillReviews,
  buildDeepSeekReviewMessages,
  requestDeepSeekProductSkillReview,
} from "./lib/deepseek-product-skill-review.mjs";
import { buildBoundedSpecExcerpt } from "./lib/bounded-spec-excerpt.mjs";
import { validateProductSkillReviewPayload } from "./lib/product-skill-review.mjs";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const argument = (name) => {
  const index = process.argv.indexOf(name);
  return index >= 0 ? process.argv[index + 1] : undefined;
};
const names = (argument("--skills") ?? "").split(",").filter(Boolean).sort();
const evidenceRoot = resolve(root, argument("--evidence") ?? ".review-evidence");
const output = argument("--output");
const baseSha = argument("--base");
const headSha = argument("--head");

if (!names.length
  || names.some((name) => !/^pontx-[a-z0-9]+(?:-[a-z0-9]+)*$/.test(name))
  || !output
  || !/^[a-f0-9]{40}$/i.test(baseSha ?? "")
  || !/^[a-f0-9]{40}$/i.test(headSha ?? "")) {
  console.error("Usage: node scripts/run-deepseek-product-skill-review.mjs --skills <names> --evidence <dir> --output <json> --base <sha> --head <sha>");
  process.exit(2);
}

const outputSchema = JSON.parse(await readFile(
  resolve(root, ".github/schemas/product-skill-review-output.schema.json"),
  "utf8",
));
const evidenceIndex = JSON.parse(await readFile(resolve(evidenceRoot, "index.json"), "utf8"));
if (evidenceIndex?.formatVersion !== 1 || !Array.isArray(evidenceIndex.claims)) {
  throw new Error("independently fetched evidence index is invalid");
}

const readRepositoryFile = async (path) => ({
  path,
  role: "untrusted repository data",
  content: await readFile(resolve(root, path), "utf8"),
});
const gitText = (args, fallback = undefined) => {
  try {
    return execFileSync("git", args, { cwd: root, encoding: "utf8", maxBuffer: 8 * 1024 * 1024 });
  } catch (error) {
    if (fallback !== undefined) return fallback;
    throw error;
  }
};
const resolveEvidencePath = (path) => {
  const resolved = resolve(evidenceRoot, path);
  const inside = relative(evidenceRoot, resolved);
  if (!inside || inside === ".." || inside.startsWith(`..${sep}`)) {
    throw new Error(`unsafe evidence path ${path}`);
  }
  return resolved;
};

/** Bounded PontxSpec slice (referenced Endpoints + Schema closure) for review. */
const boundedSpecCache = new Map();
async function boundedSpecDocument(apiSlug, skillText) {
  const cacheKey = `${apiSlug}:${skillText.length}`;
  if (boundedSpecCache.has(cacheKey)) return boundedSpecCache.get(cacheKey);
  const { excerpt, selectedKeys, narrowed } = await buildBoundedSpecExcerpt({
    root,
    apiSlug,
    skillText,
    extraPathPrefixes: ["/v7/sse/", "/v7/aippt/"],
  });
  const document = {
    path: `products/${apiSlug}/spec.pontx.json`,
    role: narrowed
      ? `untrusted repository data (bounded excerpt: ${selectedKeys.size} Endpoints referenced by the Skill plus their Schema closure; security schemes and servers retained for contract cross-check)`
      : "untrusted repository data",
    content: JSON.stringify(excerpt, null, 1),
  };
  boundedSpecCache.set(cacheKey, document);
  return document;
}

const reviews = [];
for (const skillName of names) {
  const manifestPath = `skills/manifests/${skillName}.json`;
  const evidencePath = `skills/evidence/${skillName}.json`;
  const evalsPath = `skills/evals/${skillName}.json`;
  const manifest = JSON.parse(await readFile(resolve(root, manifestPath), "utf8"));
  const evidence = JSON.parse(await readFile(resolve(root, evidencePath), "utf8"));
  if (manifest.name !== skillName
    || manifest.apiSlug !== skillName.slice("pontx-".length)
    || evidence.apiSlug !== manifest.apiSlug) {
    throw new Error(`identity mismatch in review inputs for ${skillName}`);
  }

  const installedFiles = [];
  for (const path of manifest.files) {
    if (!/^(?:SKILL\.md|references\/[a-z0-9]+(?:-[a-z0-9]+)*\.md)$/.test(path)) {
      throw new Error(`unsafe installed review path ${skillName}/${path}`);
    }
    installedFiles.push(await readRepositoryFile(`skills/products/${skillName}/${path}`));
  }

  const fetchedClaims = evidenceIndex.claims.filter((claim) => claim.skillName === skillName);
  const fetchedById = new Map(fetchedClaims.map((claim) => [claim.claimId, claim]));
  const sourceDocuments = [];
  for (const claim of evidence.claims) {
    const fetched = fetchedById.get(claim.id);
    if (!fetched || fetched.sourceUrl !== claim.sourceUrl) {
      throw new Error(`sanitized evidence is missing or mismatched for ${skillName}#${claim.id}`);
    }
    sourceDocuments.push({
      path: `.review-evidence/${fetched.path}`,
      role: "untrusted sanitized official-source data",
      content: await readFile(resolveEvidencePath(fetched.path), "utf8"),
    });
  }
  if (fetchedClaims.length !== evidence.claims.length) {
    throw new Error(`sanitized evidence contains undeclared claims for ${skillName}`);
  }

  const baseManifest = gitText(
    ["show", `${baseSha}:${manifestPath}`],
    "BASE MANIFEST DOES NOT EXIST; this is an initial Skill version.\n",
  );
  const diff = gitText([
    "diff",
    "--no-ext-diff",
    "--unified=40",
    baseSha,
    headSha,
    "--",
    `skills/products/${skillName}`,
    manifestPath,
    evidencePath,
    evalsPath,
    "skills/registry.json",
  ]);
  const documents = [
    ...installedFiles,
    await readRepositoryFile(manifestPath),
    await readRepositoryFile(evidencePath),
    await readRepositoryFile(evalsPath),
    await readRepositoryFile(`products/${manifest.apiSlug}/product.json`),
    await boundedSpecDocument(manifest.apiSlug, installedFiles.map((file) => file.content).join("\n")),
    await readRepositoryFile(`products/${manifest.apiSlug}/sdk.json`),
    await readRepositoryFile("skills/products/AUTHORING_PROMPT.md"),
    await readRepositoryFile("skills/registry.json"),
    {
      path: `.review-base/${manifestPath}`,
      role: "untrusted immutable base-commit data",
      content: baseManifest,
    },
    {
      path: `.review-diff/${skillName}.diff`,
      role: "untrusted immutable git diff data",
      content: diff || "NO CONTENT DIFF (manual review of the current published Skill).\n",
    },
    ...sourceDocuments,
  ];
  const messages = buildDeepSeekReviewMessages({
    baseSha,
    headSha,
    skillName,
    documents,
    outputSchema,
    skillStatus: manifest.status ?? "published",
  });
  const expectedClaims = new Map(evidence.claims.map((claim) => [
    `${skillName}#${claim.id}`,
    claim.sourceUrl,
  ]));

  let review;
  let validationErrors = [];
  for (let attempt = 1; attempt <= 2; attempt += 1) {
    try {
      review = await requestDeepSeekProductSkillReview({
        apiKey: process.env.DEEPSEEK_API_KEY,
        messages,
      });
    } catch (error) {
      if (attempt < 2 && /no review JSON|not valid JSON/.test(error.message)) continue;
      throw error;
    }
    validationErrors = validateProductSkillReviewPayload({
      review,
      head: headSha,
      expectedClaims,
    });
    if (!validationErrors.length) break;
  }
  if (validationErrors.length) {
    throw new Error(`DeepSeek returned an invalid structured review for ${skillName}: ${validationErrors.join("; ")}`);
  }
  reviews.push(review);
  console.log(`Independent DeepSeek review completed for ${skillName} at ${headSha}.`);
}

const combined = aggregateProductSkillReviews({ headSha, reviews });
await writeFile(resolve(root, output), `${JSON.stringify(combined, null, 2)}\n`, { mode: 0o600 });
console.log(`Wrote the head-bound independent review for ${reviews.length} Skill(s).`);
