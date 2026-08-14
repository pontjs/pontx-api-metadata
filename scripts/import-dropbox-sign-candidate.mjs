import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const outputPath = path.join(root, "specs/dropbox-sign/locales/en-US/openapi.json");
const revision = "f0c7887f2f56fb7a082b5db78a09856df2cb6ccf";
const pinnedUrl =
  `https://raw.githubusercontent.com/hellosign/hellosign-openapi/${revision}/openapi.yaml`;
const expectedHashes = {
  "openapi.yaml": "7535b8f1a18865de14f6e31e2e648fe31f6340d6ae120215425d6a6021ada25c",
  LICENSE: "9a2384fe250ebd5ca3854b11fa2d0c2855e95284f6326851ebe6e29cfa5e424a",
  "README.md": "bc3a09ef9d7a66e1ef11320ef02e83a2406ffceeff5617f69d05e12430e7b3bd"
};
const methods = new Set(["get", "put", "post", "delete", "patch", "head", "options", "trace"]);

function fail(message) {
  throw new Error(message);
}

function digest(file) {
  return crypto.createHash("sha256").update(fs.readFileSync(file)).digest("hex");
}

function argumentValue(name) {
  const index = process.argv.indexOf(name);
  return index >= 0 ? process.argv[index + 1] : undefined;
}

const upstreamRoot = argumentValue("--upstream");
const write = process.argv.includes("--write");
if (!upstreamRoot || process.argv.includes("--help")) {
  console.error(
    "Usage: node scripts/import-dropbox-sign-candidate.mjs --upstream /path/to/hellosign-openapi [--check|--write]"
  );
  process.exit(upstreamRoot ? 0 : 2);
}

for (const [name, expected] of Object.entries(expectedHashes)) {
  const file = path.resolve(upstreamRoot, name);
  if (!fs.existsSync(file)) fail(`missing pinned upstream file: ${file}`);
  const actual = digest(file);
  if (actual !== expected) fail(`${name}: expected ${expected}, received ${actual}`);
}

const git = spawnSync("git", ["-C", upstreamRoot, "rev-parse", "HEAD"], { encoding: "utf8" });
if (git.status !== 0 || git.stdout.trim() !== revision) {
  fail(`upstream checkout must be pinned to ${revision}`);
}

const ruby = spawnSync(
  "ruby",
  [
    "-ryaml",
    "-rjson",
    "-e",
    "print JSON.generate(YAML.load(File.read(ARGV.fetch(0))))",
    path.resolve(upstreamRoot, "openapi.yaml")
  ],
  { encoding: "utf8", maxBuffer: 4 * 1024 * 1024 }
);
if (ruby.status !== 0) fail(`cannot parse pinned YAML with Ruby Psych: ${ruby.stderr}`);
let document = JSON.parse(ruby.stdout);

const counts = {
  removedCodeSampleGroups: 0,
  removedCodeSampleReferences: 0,
  inlinedJsonExamples: 0,
  repairedJsonExamples: 0,
  inlinedTagMarkdown: 0,
  inlinedWebhookMarkdown: 0
};

function countExternalReferences(value) {
  if (Array.isArray(value)) {
    return value.reduce((total, item) => total + countExternalReferences(item), 0);
  }
  if (!value || typeof value !== "object") return 0;
  return Object.entries(value).reduce((total, [key, item]) =>
    total + (key === "$ref" && typeof item === "string" && !item.startsWith("#/") ? 1 : 0) +
    countExternalReferences(item), 0);
}

function parseExternalJson(file) {
  const source = fs.readFileSync(file, "utf8");
  try {
    return JSON.parse(source);
  } catch {
    const repaired = source.replace(/,\s*([}\]])/g, "$1");
    const value = JSON.parse(repaired);
    counts.repairedJsonExamples += 1;
    return value;
  }
}

function normalizeExternalContent(value, segments = []) {
  if (Array.isArray(value)) {
    return value.map((item, index) => normalizeExternalContent(item, [...segments, index]));
  }
  if (!value || typeof value !== "object") return value;
  if (Object.keys(value).length === 1 &&
    typeof value.$ref === "string" && !value.$ref.startsWith("#/")) {
    const relative = value.$ref.replace(/^\.\//, "");
    const file = path.resolve(upstreamRoot, relative);
    if (!file.startsWith(`${path.resolve(upstreamRoot)}${path.sep}`)) {
      fail(`unsafe external reference ${value.$ref} at /${segments.join("/")}`);
    }
    if (relative.endsWith(".md")) {
      if (relative.includes("/tags/")) counts.inlinedTagMarkdown += 1;
      else counts.inlinedWebhookMarkdown += 1;
      return fs.readFileSync(file, "utf8").trim();
    }
    if (relative.endsWith(".json")) {
      counts.inlinedJsonExamples += 1;
      return parseExternalJson(file);
    }
    fail(`unexpected external reference ${value.$ref} at /${segments.join("/")}`);
  }
  const normalized = {};
  for (const [key, item] of Object.entries(value)) {
    if (key === "x-codeSamples") {
      counts.removedCodeSampleGroups += 1;
      counts.removedCodeSampleReferences += countExternalReferences(item);
      continue;
    }
    normalized[key] = normalizeExternalContent(item, [...segments, key]);
  }
  return normalized;
}

document = normalizeExternalContent(document);

function resolveLocal(ref) {
  if (!ref?.startsWith("#/")) fail(`expected local reference, got ${ref}`);
  return ref.slice(2).split("/").reduce((value, segment) =>
    value[segment.replaceAll("~1", "/").replaceAll("~0", "~")], document);
}

function dereference(value, seen = new Set()) {
  if (!value?.$ref) return value;
  if (seen.has(value.$ref)) fail(`cyclic reference ${value.$ref}`);
  return dereference(resolveLocal(value.$ref), new Set([...seen, value.$ref]));
}

function scalarEvidence(parameter) {
  return [parameter.example, parameter.schema?.example, parameter.schema?.default]
    .find((value) => ["string", "number", "boolean"].includes(typeof value));
}

const sensitiveInput =
  /(?:^|_)(?:id|ids|email|file|files|url|urls|token|secret|key|account|user|phone|fax_number)(?:$|_)/i;
let operations = 0;
for (const pathItem of Object.values(document.paths)) {
  const commonParameters = (pathItem.parameters ?? []).map(dereference);
  for (const [method, operation] of Object.entries(pathItem)) {
    if (!methods.has(method)) continue;
    operations += 1;
    const request = { path: {}, query: {}, headers: {} };
    const unresolved = [];
    const parameters = [
      ...commonParameters,
      ...(operation.parameters ?? []).map(dereference)
    ];
    for (const parameter of parameters) {
      if (!["path", "query", "header"].includes(parameter.in)) continue;
      const requestLocation = parameter.in === "header" ? "headers" : parameter.in;
      const evidence = scalarEvidence(parameter);
      const dynamic = parameter.in === "path" || sensitiveInput.test(parameter.name) ||
        /authorization/i.test(parameter.name);
      if (!dynamic && evidence !== undefined) {
        request[requestLocation][parameter.name] = evidence;
      } else if (parameter.required) {
        unresolved.push({
          in: parameter.in,
          name: parameter.name,
          source: {
            kind: "runtime",
            reason: parameter.in === "path" ? "provider-state" : "provider-state-or-sensitive-input"
          }
        });
      }
    }
    if (operation.requestBody?.required) {
      unresolved.push({
        in: "body",
        name: "body",
        source: { kind: "runtime", reason: "request-body-requires-user-review" }
      });
    }
    const expectedStatus = Object.keys(operation.responses ?? {}).find((status) => /^2\d\d$/.test(status));
    if (!expectedStatus) fail(`${operation.operationId}: no exact 2xx response`);
    operation["x-pontx-documentation-status"] = "official";
    operation["x-pontx-evidence"] = [pinnedUrl];
    operation["x-pontx-verified-at"] = "2026-08-14";
    operation["x-pontx-proxy-enabled"] = false;
    operation["x-pontx-proxy-disabled-reason"] =
      "Candidate pre-admission only; signing, delivery, file, account, team, OAuth, callback, and fax operations require endpoint-level safety and data-handling review.";
    operation["x-pontx-request-examples"] = {
      default: {
        summary: "Official OAS-backed pre-admission request",
        request,
        expectedStatus,
        ...(unresolved.length ? { unresolved } : {})
      }
    };
  }
}

const descriptions = {
  SignatureRequestEditWithTemplateRequest: "signatureRequestEditWithTemplate",
  SignatureRequestSendWithTemplateRequest: "signatureRequestSendWithTemplate",
  UnclaimedDraftCreateRequest: "unclaimedDraftCreate",
  UnclaimedDraftCreateEmbeddedRequest: "unclaimedDraftCreateEmbedded"
};
function findOperation(operationId) {
  for (const pathItem of Object.values(document.paths)) {
    for (const value of Object.values(pathItem)) {
      if (value?.operationId === operationId) return value;
    }
  }
  fail(`missing operation ${operationId}`);
}
for (const [schema, operationId] of Object.entries(descriptions)) {
  document.components.schemas[schema].description = findOperation(operationId).description;
}

const expectedCounts = {
  removedCodeSampleGroups: 73,
  removedCodeSampleReferences: 511,
  inlinedJsonExamples: 152,
  repairedJsonExamples: 4,
  inlinedTagMarkdown: 12,
  inlinedWebhookMarkdown: 2
};
if (JSON.stringify(counts) !== JSON.stringify(expectedCounts)) {
  fail(`normalization counts drifted: ${JSON.stringify(counts)}`);
}
if (operations !== 73 || Object.keys(document.paths).length !== 67 ||
  Object.keys(document.components.schemas).length !== 217 ||
  countExternalReferences(document) !== 0) {
  fail("normalized contract coverage drifted");
}

const normalized = `${JSON.stringify(document, null, 2)}\n`;
if (write) {
  fs.writeFileSync(outputPath, normalized);
  console.log(`Wrote ${path.relative(root, outputPath)} from pinned upstream checkout.`);
} else {
  const committed = fs.readFileSync(outputPath, "utf8");
  if (committed !== normalized) fail("committed en-US candidate spec differs from deterministic import");
  console.log(
    "Verified deterministic Dropbox Sign import: 67 paths, 73 operations, 217 schemas, " +
    "152 inlined JSON examples, 14 inlined Markdown files, and 0 external refs."
  );
}
