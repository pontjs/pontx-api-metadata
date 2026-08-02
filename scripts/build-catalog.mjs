import { createHash } from "node:crypto";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const repositoryRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const source = JSON.parse(
  await readFile(resolve(repositoryRoot, "catalog/source.json"), "utf8")
);

function readPointer(document, pointer) {
  if (!pointer?.startsWith("#/")) return undefined;
  return pointer
    .slice(2)
    .split("/")
    .reduce((value, segment) => value?.[segment.replaceAll("~1", "/").replaceAll("~0", "~")], document);
}

function dereference(document, schema) {
  return schema?.$ref ? readPointer(document, schema.$ref) ?? schema : schema;
}

function catalogType(document, schema) {
  const resolved = dereference(document, schema);
  if (resolved?.type === "integer") return "integer";
  if (resolved?.type === "number") return "number";
  if (resolved?.type === "boolean") return "boolean";
  if (resolved?.type === "array") return "array";
  if (resolved?.type === "object" || resolved?.properties) return "object";
  return "string";
}

function exampleFor(document, schema) {
  const resolved = dereference(document, schema);
  if (!resolved) return undefined;
  if (resolved.example !== undefined) return resolved.example;
  if (resolved.default !== undefined) return resolved.default;
  if (resolved.enum?.length) return resolved.enum[0];
  if (resolved.type === "array") return [exampleFor(document, resolved.items) ?? {}];
  if (resolved.type === "object" || resolved.properties) {
    return Object.fromEntries(
      Object.entries(resolved.properties ?? {}).slice(0, 8).map(([key, value]) => [
        key,
        exampleFor(document, value)
      ])
    );
  }
  if (resolved.type === "integer" || resolved.type === "number") return 0;
  if (resolved.type === "boolean") return false;
  return undefined;
}

function slugify(value) {
  return value
    .replace(/([a-z0-9])([A-Z])/g, "$1-$2")
    .replace(/[^a-zA-Z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .toLowerCase();
}

function localized(zh, en) {
  return { zh: zh || en, en: en || zh };
}

function makeSchema(document, name, schema, translations) {
  const resolved = dereference(document, schema) ?? {};
  const translation = translations?.[name];
  const enTitle = resolved.title || name;
  const enDescription = resolved.description || `${name} data structure`;
  const required = new Set(resolved.required ?? []);
  const properties = Object.entries(resolved.properties ?? {}).map(([propertyName, property]) => {
    const propertyRef = property?.$ref ?? property?.items?.$ref;
    return {
      name: propertyName,
      type: catalogType(document, property),
      ...(property?.format ? { format: property.format } : {}),
      ...(property?.description
        ? { description: localized(property.description, property.description) }
        : {}),
      ...(required.has(propertyName) ? { required: true } : {}),
      ...(propertyRef
        ? { ref: propertyRef.split("/").pop() }
        : {})
    };
  });

  return {
    name,
    title: localized(translation?.title ?? enTitle, enTitle),
    description: localized(
      translation?.description ?? enDescription,
      enDescription
    ),
    type: catalogType(document, resolved),
    required: [...required],
    properties,
    schema: resolved
  };
}

function pickMedia(content) {
  if (!content) return undefined;
  return content["application/json"] ?? Object.values(content)[0];
}

function makeOperation(document, path, method, operation, pathParameters, translations, parameterTranslations) {
  const operationId = operation.operationId || `${method}-${path}`;
  const translation = translations?.[operationId];
  const enTitle = operation.summary || operationId;
  const enDescription = operation.description || operation.summary || operationId;
  const parameters = [...(pathParameters ?? []), ...(operation.parameters ?? [])].map((parameter) => {
    const schema = parameter.schema ?? {};
    return {
      name: parameter.name,
      in: parameter.in,
      ...(parameter.required ? { required: true } : {}),
      type: catalogType(document, schema),
      ...(parameter.description
        ? { description: localized(parameterTranslations?.[parameter.description] ?? parameter.description, parameter.description) }
        : {}),
      ...(exampleFor(document, schema) !== undefined
        ? { example: exampleFor(document, schema) }
        : {})
    };
  });
  const requestMedia = pickMedia(operation.requestBody?.content);
  if (requestMedia) {
    parameters.push({
      name: "body",
      in: "body",
      ...(operation.requestBody.required ? { required: true } : {}),
      type: catalogType(document, requestMedia.schema),
      ...(requestMedia.example !== undefined
        ? { example: requestMedia.example }
        : exampleFor(document, requestMedia.schema) !== undefined
          ? { example: exampleFor(document, requestMedia.schema) }
          : {})
    });
  }
  const response = Object.entries(operation.responses ?? {}).find(([status]) => status.startsWith("2"))?.[1];
  const responseMedia = pickMedia(response?.content);
  return {
    slug: slugify(operationId),
    operationId,
    tag: operation.tags?.[0] ?? "default",
    method: method.toUpperCase(),
    path,
    title: localized(translation?.title ?? enTitle, enTitle),
    description: localized(translation?.description ?? enDescription, enDescription),
    ...(requestMedia ? { contentType: requestMedia === operation.requestBody?.content?.["application/x-www-form-urlencoded"] ? "application/x-www-form-urlencoded" : "application/json" } : {}),
    parameters,
    ...(responseMedia?.example !== undefined
      ? { responseExample: responseMedia.example }
      : exampleFor(document, responseMedia?.schema) !== undefined
        ? { responseExample: exampleFor(document, responseMedia.schema) }
        : {}),
    ...(operation.deprecated ? { deprecated: true } : {})
  };
}

const apis = [];
for (const entry of source.apis) {
  const specPath = resolve(repositoryRoot, entry.specFile);
  const specText = await readFile(specPath, "utf8");
  const hash = createHash("sha256").update(specText).digest("hex");
  if (hash !== entry.approvedSha256) {
    throw new Error(`${entry.slug}: approvedSha256 does not match ${entry.specFile}`);
  }
  const document = JSON.parse(specText);
  const operations = Object.entries(document.paths ?? {}).flatMap(([path, pathItem]) =>
    Object.entries(pathItem)
      .filter(([method]) => ["get", "post", "put", "patch", "delete", "head", "options"].includes(method))
      .map(([method, operation]) => makeOperation(document, path, method, operation, pathItem.parameters, entry.translations, entry.parameterTranslations))
  );
  const schemaEntries = document.components?.schemas ?? document.definitions ?? {};
  const schemas = Object.entries(schemaEntries).map(([name, schema]) =>
    makeSchema(document, name, schema, entry.schemaTranslations)
  );
  apis.push({
    slug: entry.slug,
    name: entry.name,
    provider: entry.provider,
    category: entry.category,
    featured: entry.featured,
    sourceUrl: `https://raw.githubusercontent.com/pontjs/pontx-api-metadata/master/${entry.specFile}`,
    license: entry.license,
    attributionUrl: entry.attributionUrl,
    approvedSha256: entry.approvedSha256,
    title: entry.title,
    summary: entry.summary,
    accent: entry.accent,
    packageName: entry.packageName,
    sdkVersion: entry.sdkVersion,
    sdkStatus: entry.sdkStatus,
    proxyEnabled: entry.proxyEnabled,
    servers: [entry.server],
    auth: entry.auth,
    operations,
    schemas
  });
}

await mkdir(resolve(repositoryRoot, "catalog"), { recursive: true });
await writeFile(
  resolve(repositoryRoot, "catalog/catalog.json"),
  `${JSON.stringify({ version: source.version, apis }, null, 2)}\n`
);
console.log(`Built catalog/catalog.json with ${apis.length} APIs, ${apis.reduce((count, api) => count + api.operations.length, 0)} operations, and ${apis.reduce((count, api) => count + api.schemas.length, 0)} schemas.`);
