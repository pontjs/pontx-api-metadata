import { createHash } from "node:crypto";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import {
  compareLocalizedDocuments,
  localized,
  localizedSpecPath,
  mergeLocalizedText
} from "./lib/localization.mjs";

const repositoryRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const source = JSON.parse(
  await readFile(resolve(repositoryRoot, "catalog/source.json"), "utf8")
);
const catalogLocales = Object.fromEntries(
  await Promise.all(
    (source.locales ?? []).map(async (locale) => [
      locale,
      JSON.parse(
        await readFile(
          resolve(repositoryRoot, "catalog/locales", `${locale}.json`),
          "utf8"
        )
      )
    ])
  )
);
const englishCatalog = catalogLocales["en-US"];

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

function schemaName(schema) {
  const reference = schema?.$ref ?? schema?.items?.$ref;
  return reference?.split("/").pop();
}

function schemaPropertyNames(document, schema) {
  const resolved = dereference(document, schema);
  const target = resolved?.type === "array"
    ? dereference(document, resolved.items)
    : resolved;
  return Object.keys(target?.properties ?? {});
}

function payloadMetadata(document, schema, contentTypes, description, englishDescription) {
  return {
    ...(description ? { description: localized(description, englishDescription) } : {}),
    ...(contentTypes?.length ? { contentTypes } : {}),
    ...(schema ? { schemaType: catalogType(document, schema) } : {}),
    ...(schemaName(schema) ? { schemaName: schemaName(schema) } : {}),
    ...(schemaPropertyNames(document, schema).length
      ? { properties: schemaPropertyNames(document, schema) }
      : {})
  };
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

function makeSchema(document, englishDocument, name, schema, englishSchema) {
  const resolved = dereference(document, schema) ?? {};
  const englishResolved = dereference(englishDocument, englishSchema) ?? {};
  const zhTitle = resolved.title || name;
  const enTitle = englishResolved.title || name;
  const zhDescription = resolved.description || `${name} 数据结构`;
  const enDescription = englishResolved.description || `${name} data structure`;
  const required = new Set(resolved.required ?? []);
  const properties = Object.entries(resolved.properties ?? {}).map(([propertyName, property]) => {
    const englishProperty = englishResolved.properties?.[propertyName] ?? {};
    const propertyRef = property?.$ref ?? property?.items?.$ref;
    return {
      name: propertyName,
      type: catalogType(document, property),
      ...(property?.format ? { format: property.format } : {}),
      ...(property?.description
        ? { description: localized(property.description, englishProperty.description) }
        : {}),
      ...(required.has(propertyName) ? { required: true } : {}),
      ...(propertyRef
        ? { ref: propertyRef.split("/").pop() }
        : {})
    };
  });

  return {
    name,
    title: localized(zhTitle, enTitle),
    description: localized(zhDescription, enDescription),
    type: catalogType(document, resolved),
    required: [...required],
    properties,
    // Keep the historical English raw Schema while exposing the full localized
    // documents additively for locale-aware consumers.
    schema: englishResolved,
    localizedSchema: {
      zh: resolved
    }
  };
}

function pickMedia(content) {
  if (!content) return undefined;
  return content["application/json"] ?? Object.values(content)[0];
}

const parameterSchemaKeywords = [
  "default",
  "const",
  "multipleOf",
  "minimum",
  "maximum",
  "exclusiveMinimum",
  "exclusiveMaximum",
  "minLength",
  "maxLength",
  "pattern",
  "minItems",
  "maxItems",
  "uniqueItems",
  "minProperties",
  "maxProperties",
  "nullable",
  "readOnly",
  "writeOnly",
  "deprecated",
  "examples"
];

function parameterSchemaMetadata(schema) {
  return Object.fromEntries(
    parameterSchemaKeywords
      .filter((keyword) => schema[keyword] !== undefined)
      .map((keyword) => [keyword, schema[keyword]])
  );
}

function makeOperation(document, englishDocument, path, method, operation, englishOperation, pathParameters, englishPathParameters, serverIdByUrl) {
  const operationId = operation.operationId || `${method}-${path}`;
  const zhTitle = operation.summary || operationId;
  const enTitle = englishOperation.summary || operationId;
  const zhDescription = operation.description || operation.summary || operationId;
  const enDescription = englishOperation.description || englishOperation.summary || operationId;
  const resolvedParameters = [...(pathParameters ?? []), ...(operation.parameters ?? [])]
    .map((parameter) => dereference(document, parameter));
  const englishResolvedParameters = [...(englishPathParameters ?? []), ...(englishOperation.parameters ?? [])]
    .map((parameter) => dereference(englishDocument, parameter));
  const parameters = resolvedParameters.map((parameter, index) => {
    const englishParameter = englishResolvedParameters[index] ?? {};
    const schema = parameter.schema ?? {};
    return {
      name: parameter.name,
      in: parameter.in,
      ...(parameter.required ? { required: true } : {}),
      type: catalogType(document, schema),
      ...(schema.format ? { format: schema.format } : {}),
      ...(schemaName(schema) ? { schemaName: schemaName(schema) } : {}),
      ...(schema.enum?.length ? { enum: schema.enum } : {}),
      ...parameterSchemaMetadata(schema),
      ...(parameter.description
        ? { description: localized(parameter.description, englishParameter.description) }
        : {}),
      ...(parameter.example !== undefined
        ? { example: parameter.example }
        : schema.example !== undefined
          ? { example: schema.example }
          : schema.examples?.length
            ? { example: schema.examples[0] }
            : {})
    };
  });
  const requestMedia = pickMedia(operation.requestBody?.content);
  const requestContentTypes = Object.keys(operation.requestBody?.content ?? {});
  if (requestMedia) {
    parameters.push({
      name: "body",
      in: "body",
      ...(operation.requestBody.required ? { required: true } : {}),
      type: catalogType(document, requestMedia.schema),
      ...(schemaName(requestMedia.schema)
        ? { schemaName: schemaName(requestMedia.schema) }
        : {}),
      ...(requestMedia.example !== undefined
        ? { example: requestMedia.example }
        : exampleFor(document, requestMedia.schema) !== undefined
          ? { example: exampleFor(document, requestMedia.schema) }
          : {})
    });
  }
  const bodyParameter = resolvedParameters
    .find((parameter) => parameter.in === "body");
  const requestSchema = requestMedia?.schema ?? bodyParameter?.schema;
  const requestBody = requestSchema
    ? payloadMetadata(
        document,
        requestSchema,
        requestContentTypes.length
          ? requestContentTypes
          : operation.consumes ?? document.consumes ?? [],
        operation.requestBody?.description ?? bodyParameter?.description,
        englishOperation.requestBody?.description ??
          englishResolvedParameters.find((parameter) => parameter.in === "body")?.description
      )
    : undefined;
  const responseEntries = Object.entries(operation.responses ?? {});
  const response = responseEntries.find(([status]) => status.startsWith("2"))?.[1];
  const responseMedia = pickMedia(response?.content);
  const security = (operation.security ?? document.security ?? []).flatMap((requirement) =>
    Object.entries(requirement).map(([schemeId, scopes]) => ({
      schemeId,
      scopes: Array.isArray(scopes) ? scopes : []
    }))
  );
  const responses = responseEntries.map(([status, responseValue]) => {
    const englishResponse = englishOperation.responses?.[status];
    const responseContentTypes = Object.keys(responseValue?.content ?? {});
    const media = pickMedia(responseValue?.content);
    const schema = media?.schema ?? responseValue?.schema;
    return {
      status,
      ...payloadMetadata(
        document,
        schema,
        responseContentTypes.length
          ? responseContentTypes
          : operation.produces ?? document.produces ?? [],
        responseValue?.description,
        englishResponse?.description
      )
    };
  });
  return {
    slug: slugify(operationId),
    operationId,
    tag: operation.tags?.[0] ?? "default",
    method: method.toUpperCase(),
    path,
    title: localized(zhTitle, enTitle),
    description: localized(zhDescription, enDescription),
    ...(requestMedia ? { contentType: requestMedia === operation.requestBody?.content?.["application/x-www-form-urlencoded"] ? "application/x-www-form-urlencoded" : "application/json" } : {}),
    parameters,
    ...(requestBody ? { requestBody } : {}),
    responses,
    serverIds: (operation.servers ?? document.servers ?? [])
      .map((server) => serverIdByUrl.get(server.url.replace(/\/$/, "")))
      .filter(Boolean),
    proxyHeaders: operation["x-pontx-proxy-headers"] ?? {},
    proxyEnabled: operation["x-pontx-proxy-enabled"] ?? true,
    ...(operation["x-pontx-proxy-disabled-reason"]
      ? { proxyDisabledReason: localized(operation["x-pontx-proxy-disabled-reason"], englishOperation["x-pontx-proxy-disabled-reason"]) }
      : {}),
    documentationStatus: operation["x-pontx-documentation-status"] ?? "official",
    evidenceUrls: operation["x-pontx-evidence"] ?? [],
    ...(operation["x-pontx-verified-at"] ? { verifiedAt: operation["x-pontx-verified-at"] } : {}),
    ...(operation["x-pontx-stability-note"]
      ? { stabilityNote: localized(operation["x-pontx-stability-note"], englishOperation["x-pontx-stability-note"]) }
      : {}),
    ...(security.length ? { security } : {}),
    ...(responseMedia?.example !== undefined
      ? { responseExample: responseMedia.example }
      : exampleFor(document, responseMedia?.schema) !== undefined
        ? { responseExample: exampleFor(document, responseMedia.schema) }
        : {}),
    ...(operation.deprecated ? { deprecated: true } : {})
  };
}

function localizedCatalogText(zh, en, context) {
  if (typeof zh !== "string" || typeof en !== "string") {
    throw new Error(`${context}: missing zh-CN or en-US catalog text`);
  }
  return localized(zh, en);
}

function makeAuth(englishDocument, entryAuth, englishAuth, slug) {
  const schemes = englishDocument.components?.securitySchemes ?? {};
  return entryAuth.map((auth) => {
    const english = englishAuth?.[auth.id];
    if (!english) throw new Error(`${slug}: missing en-US auth text for ${auth.id}`);
    const localizedAuth = {
      ...auth,
      description: localizedCatalogText(
        auth.description,
        english.description,
        `${slug}.auth.${auth.id}.description`
      ),
      ...(auth.credentialGuide
        ? {
            credentialGuide: {
              ...auth.credentialGuide,
              title: localizedCatalogText(
                auth.credentialGuide.title,
                english.credentialGuide?.title,
                `${slug}.auth.${auth.id}.credentialGuide.title`
              ),
              steps: auth.credentialGuide.steps.map((step, index) =>
                localizedCatalogText(
                  step,
                  english.credentialGuide?.steps?.[index],
                  `${slug}.auth.${auth.id}.credentialGuide.steps.${index}`
                )
              )
            }
          }
        : {})
    };
    if (auth.type !== "oauth2") return localizedAuth;
    const openapiScheme = schemes[auth.id];
    if (!openapiScheme || openapiScheme.type !== "oauth2") return localizedAuth;
    return {
      ...localizedAuth,
      flows: openapiScheme.flows ?? {}
    };
  });
}

const apis = [];
for (const entry of source.apis) {
  const englishEntry = englishCatalog?.apis?.[entry.slug];
  if (!englishEntry) throw new Error(`${entry.slug}: missing catalog/locales/en-US.json entry`);
  const specPath = resolve(repositoryRoot, entry.specFile);
  const specText = await readFile(specPath, "utf8");
  const hash = createHash("sha256").update(specText).digest("hex");
  if (hash !== entry.approvedSha256) {
    throw new Error(`${entry.slug}: approvedSha256 does not match ${entry.specFile}`);
  }
  const document = JSON.parse(specText);
  const englishSpecPath = localizedSpecPath(repositoryRoot, entry.specFile, "en-US");
  const englishSpecText = await readFile(englishSpecPath, "utf8");
  const englishHash = createHash("sha256").update(englishSpecText).digest("hex");
  if (englishHash !== entry.approvedLocaleSha256?.["en-US"]) {
    throw new Error(`${entry.slug}: approvedLocaleSha256.en-US does not match ${englishSpecPath}`);
  }
  const rawEnglishDocument = JSON.parse(englishSpecText);
  const localeDifferences = compareLocalizedDocuments(document, rawEnglishDocument);
  if (localeDifferences.length) {
    throw new Error(
      `${entry.slug}: en-US structure differs from zh-CN (${localeDifferences[0]})`
    );
  }
  const englishDocument = mergeLocalizedText(document, rawEnglishDocument);
  const servers = [{
    ...entry.server,
    description: localizedCatalogText(
      entry.server.description,
      englishEntry.server?.description,
      `${entry.slug}.server.description`
    )
  }];
  for (const [index, server] of (document.servers ?? []).entries()) {
    const normalizedUrl = server.url.replace(/\/$/, "");
    if (servers.some((item) => item.url.replace(/\/$/, "") === normalizedUrl)) continue;
    const hostname = new URL(normalizedUrl).hostname;
    const englishServer = englishDocument.servers?.[index];
    servers.push({
      id: slugify(hostname),
      url: normalizedUrl,
      description: localized(
        server.description ?? hostname,
        englishServer?.description ?? hostname
      )
    });
  }
  const serverIdByUrl = new Map(servers.map((server) => [server.url.replace(/\/$/, ""), server.id]));
  const operations = Object.entries(document.paths ?? {}).flatMap(([path, pathItem]) =>
    Object.entries(pathItem)
      .filter(([method]) => ["get", "post", "put", "patch", "delete", "head", "options"].includes(method))
      .map(([method, operation]) => makeOperation(
        document,
        englishDocument,
        path,
        method,
        operation,
        englishDocument.paths[path][method],
        pathItem.parameters,
        englishDocument.paths[path].parameters,
        serverIdByUrl
      ))
  );
  const schemaEntries = document.components?.schemas ?? document.definitions ?? {};
  const schemas = Object.entries(schemaEntries).map(([name, schema]) =>
    makeSchema(
      document,
      englishDocument,
      name,
      schema,
      englishDocument.components?.schemas?.[name] ?? englishDocument.definitions?.[name]
    )
  );
  apis.push({
    slug: entry.slug,
    name: entry.name,
    provider: entry.provider,
    category: entry.category,
    featured: entry.featured,
    sourceUrl: `https://raw.githubusercontent.com/pontjs/pontx-api-metadata/main/${entry.specFile}`,
    license: entry.license,
    attributionUrl: entry.attributionUrl,
    approvedSha256: entry.approvedSha256,
    title: localizedCatalogText(entry.title, englishEntry.title, `${entry.slug}.title`),
    summary: localizedCatalogText(entry.summary, englishEntry.summary, `${entry.slug}.summary`),
    accent: entry.accent,
    packageName: entry.packageName,
    sdkVersion: entry.sdkVersion,
    sdkStatus: entry.sdkStatus,
    ...(entry.cliName ? { cliName: entry.cliName } : {}),
    proxyEnabled: entry.proxyEnabled,
    documentationStatus: entry.documentationStatus ?? "official",
    evidenceUrls: entry.evidenceUrls ?? [],
    ...(entry.verifiedAt ? { verifiedAt: entry.verifiedAt } : {}),
    ...(entry.stabilityNote
      ? {
          stabilityNote: localizedCatalogText(
            entry.stabilityNote,
            englishEntry.stabilityNote,
            `${entry.slug}.stabilityNote`
          )
        }
      : {}),
    servers,
    auth: makeAuth(englishDocument, entry.auth, englishEntry.auth, entry.slug),
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
