import { readFile } from "node:fs/promises";
import { resolve } from "node:path";

/**
 * Build a bounded PontxSpec excerpt for Skill review.
 *
 * The independent review only needs to cross-check the Endpoints, Schemas,
 * security schemes, and servers that the Skill actually references. Sending a
 * full PontxSpec (e.g. WPS 365 at 5.5 MB, OpenAI at ~4 MB) exceeds the model
 * context window and makes the review gate fail with HTTP 400. This builder
 * keeps the immutable, reference-closed slice of the spec that a reviewer
 * needs to validate `metadataContractConsistent` and `cliSdkExamplesValid`
 * without shipping the whole document.
 */
export async function buildBoundedSpecExcerpt({
  root,
  apiSlug,
  skillText,
  extraPathPrefixes = [],
}) {
  const spec = JSON.parse(await readFile(
    resolve(root, "products", apiSlug, "spec.pontx.json"),
    "utf8",
  ));

  // Endpoint keys the Skill names as `tag/operationId` (e.g. calendars/calendarEventCreate)
  const namedKeys = new Set();
  for (const match of skillText.matchAll(/\b([a-zA-Z][a-zA-Z0-9]*)\/([a-zA-Z][a-zA-Z0-9]*)\b/g)) {
    const key = `${match[1]}/${match[2]}`;
    if (Object.prototype.hasOwnProperty.call(spec.apis, key)) namedKeys.add(key);
  }
  // Endpoint keys whose path starts with a documented prefix (e.g. /v7/sse/*)
  const prefixKeys = new Set();
  for (const [key, api] of Object.entries(spec.apis ?? {})) {
    if (extraPathPrefixes.some((prefix) => String(api.path ?? "").startsWith(prefix))) {
      prefixKeys.add(key);
    }
  }

  const selectedKeys = new Set([...namedKeys, ...prefixKeys]);
  if (selectedKeys.size === 0) {
    // Fall back to the whole spec only when nothing can be narrowed (tiny specs).
    const raw = JSON.parse(await readFile(
      resolve(root, "products", apiSlug, "spec.pontx.json"),
      "utf8",
    ));
    return { excerpt: raw, selectedKeys: new Set(Object.keys(raw.apis ?? {})), narrowed: false };
  }

  // Schema closure: collect every $ref reachable from the selected Endpoints.
  const schemaNames = new Set();
  const visit = (value) => {
    if (!value || typeof value !== "object") return;
    if (typeof value.$ref === "string" && value.$ref.startsWith("#/components/schemas/")) {
      const name = value.$ref.slice("#/components/schemas/".length);
      if (schemaNames.has(name)) return;
      schemaNames.add(name);
      const target = spec.components?.schemas?.[name];
      if (target) visit(target);
      return;
    }
    if (Array.isArray(value)) {
      for (const item of value) visit(item);
      return;
    }
    for (const child of Object.values(value)) visit(child);
  };
  for (const key of selectedKeys) {
    const api = spec.apis[key];
    visit(api?.parameters);
    visit(api?.responses);
    visit(api?.requestExamples);
  }

  const selectedApis = Object.fromEntries(
    [...selectedKeys].sort().map((key) => [key, spec.apis[key]]),
  );
  const selectedSchemas = Object.fromEntries(
    [...schemaNames].sort().map((name) => [name, spec.components?.schemas?.[name]]),
  );

  const excerpt = {
    pontx: spec.pontx,
    style: spec.style,
    name: spec.name,
    info: spec.info,
    servers: spec.servers,
    security: spec.security,
    externalDocs: spec.externalDocs,
    components: {
      securitySchemes: spec.components?.securitySchemes ?? {},
      schemas: selectedSchemas,
    },
    tags: spec.tags,
    apis: selectedApis,
  };
  return { excerpt, selectedKeys, narrowed: true };
}
