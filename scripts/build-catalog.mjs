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

const requestExampleIdPattern = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
const forbiddenExampleHeaders = new Set([
  "authorization",
  "cookie",
  "host",
  "proxy-authorization",
  "x-api-key"
]);

function hasOwn(value, key) {
  return value && typeof value === "object" && Object.hasOwn(value, key);
}

function isRequestScalar(value) {
  return ["string", "number", "boolean"].includes(typeof value) &&
    (typeof value !== "number" || Number.isFinite(value));
}

function requestLocation(request, location) {
  if (location === "header") return request.headers ?? {};
  return request[location] ?? {};
}

function declaredInput(parameters, requestSchema, location, name) {
  if (location === "body") {
    return Boolean(requestSchema) &&
      (name === "body" || name === "/" || name.startsWith("/"));
  }
  return parameters.some((parameter) =>
    parameter.in === location && parameter.name === name
  );
}

function makeRequestExamples({
  slug,
  operation,
  englishOperation,
  parameters,
  requestSchema,
  serverIdByUrl,
  auth
}) {
  const sourceExamples = operation["x-pontx-request-examples"];
  const englishExamples = englishOperation["x-pontx-request-examples"];
  if (!sourceExamples || typeof sourceExamples !== "object" || Array.isArray(sourceExamples)) {
    throw new Error(`${slug}.${operation.operationId}: x-pontx-request-examples is required`);
  }
  const entries = Object.entries(sourceExamples);
  if (!entries.length) {
    throw new Error(`${slug}.${operation.operationId}: x-pontx-request-examples must not be empty`);
  }

  return entries.map(([id, example]) => {
    if (!requestExampleIdPattern.test(id)) {
      throw new Error(`${slug}.${operation.operationId}: invalid request example id ${id}`);
    }
    const englishExample = englishExamples?.[id];
    if (!englishExample) {
      throw new Error(`${slug}.${operation.operationId}.${id}: localized request example is missing`);
    }
    if (!example || typeof example !== "object" || Array.isArray(example)) {
      throw new Error(`${slug}.${operation.operationId}.${id}: request example must be an object`);
    }
    const request = example.request ?? {};
    if (!request || typeof request !== "object" || Array.isArray(request)) {
      throw new Error(`${slug}.${operation.operationId}.${id}: request must be an object`);
    }
    const unresolved = example.unresolved ?? [];
    if (!Array.isArray(unresolved)) {
      throw new Error(`${slug}.${operation.operationId}.${id}: unresolved must be an array`);
    }
    const unresolvedKeys = new Set();
    for (const input of unresolved) {
      if (!input || typeof input !== "object" || Array.isArray(input)) {
        throw new Error(`${slug}.${operation.operationId}.${id}: unresolved input must be an object`);
      }
      const key = `${input.in}:${input.name}`;
      if (!["path", "query", "header", "body"].includes(input.in) ||
        typeof input.name !== "string" || !input.name) {
        throw new Error(`${slug}.${operation.operationId}.${id}: invalid unresolved input ${key}`);
      }
      if (unresolvedKeys.has(key)) {
        throw new Error(`${slug}.${operation.operationId}.${id}: duplicate unresolved input ${key}`);
      }
      unresolvedKeys.add(key);
      if (!declaredInput(parameters, requestSchema, input.in, input.name)) {
        throw new Error(`${slug}.${operation.operationId}.${id}: unresolved input is not declared: ${key}`);
      }
      if (input.source?.kind === "operation" && !input.source.operationId) {
        throw new Error(`${slug}.${operation.operationId}.${id}: ${key} needs source.operationId`);
      }
      if (input.source?.kind === "runtime" && !input.source.reason) {
        throw new Error(`${slug}.${operation.operationId}.${id}: ${key} needs source.reason`);
      }
      if (!input.source || !["operation", "runtime"].includes(input.source.kind)) {
        throw new Error(`${slug}.${operation.operationId}.${id}: ${key} has an invalid source`);
      }
    }

    for (const location of ["path", "query", "header"]) {
      const values = requestLocation(request, location);
      if (!values || typeof values !== "object" || Array.isArray(values)) {
        throw new Error(`${slug}.${operation.operationId}.${id}: request ${location} values must be an object`);
      }
      for (const name of Object.keys(values)) {
        if (!declaredInput(parameters, requestSchema, location, name)) {
          throw new Error(`${slug}.${operation.operationId}.${id}: request value is not declared: ${location}:${name}`);
        }
        if (unresolvedKeys.has(`${location}:${name}`)) {
          throw new Error(`${slug}.${operation.operationId}.${id}: ${location}:${name} cannot be both preset and unresolved`);
        }
        if (!isRequestScalar(values[name])) {
          throw new Error(`${slug}.${operation.operationId}.${id}: ${location}:${name} must be a string, number, or boolean`);
        }
      }
    }
    for (const name of Object.keys(request.headers ?? {})) {
      if (typeof request.headers[name] !== "string") {
        throw new Error(`${slug}.${operation.operationId}.${id}: header:${name} must be a string`);
      }
      if (forbiddenExampleHeaders.has(name.toLowerCase())) {
        throw new Error(`${slug}.${operation.operationId}.${id}: credentials are forbidden in request example header ${name}`);
      }
    }
    for (const scheme of auth ?? []) {
      if (scheme.type !== "apiKey") continue;
      const values = requestLocation(request, scheme.in === "header" ? "header" : "query");
      if (Object.keys(values).some((name) => name.toLowerCase() === scheme.name.toLowerCase())) {
        throw new Error(`${slug}.${operation.operationId}.${id}: API credentials must not appear in request examples`);
      }
    }

    for (const parameter of parameters.filter((item) => item.required && item.in !== "body")) {
      const values = requestLocation(request, parameter.in);
      if (!hasOwn(values, parameter.name) && !unresolvedKeys.has(`${parameter.in}:${parameter.name}`)) {
        throw new Error(`${slug}.${operation.operationId}.${id}: missing required input ${parameter.in}:${parameter.name}`);
      }
    }
    const requiredBody = Boolean(operation.requestBody?.required) ||
      parameters.some((parameter) => parameter.in === "body" && parameter.required);
    if (requiredBody && !hasOwn(request, "body") && !unresolvedKeys.has("body:body")) {
      throw new Error(`${slug}.${operation.operationId}.${id}: missing required request body`);
    }
    if (hasOwn(request, "body") && !requestSchema) {
      throw new Error(`${slug}.${operation.operationId}.${id}: request body is not declared`);
    }

    const expectedStatus = String(example.expectedStatus ?? "");
    if (!/^2(?:\d\d|[xX]{2})$/.test(expectedStatus)) {
      throw new Error(`${slug}.${operation.operationId}.${id}: expectedStatus must be a 2xx response`);
    }
    if (!Object.keys(operation.responses ?? {}).some((status) => status === expectedStatus)) {
      throw new Error(`${slug}.${operation.operationId}.${id}: expectedStatus ${expectedStatus} is not declared`);
    }
    if (example.serverUrl !== undefined && typeof example.serverUrl !== "string") {
      throw new Error(`${slug}.${operation.operationId}.${id}: serverUrl must be a string`);
    }
    const serverUrl = example.serverUrl?.replace(/\/$/, "");
    const serverId = serverUrl ? serverIdByUrl.get(serverUrl) : undefined;
    if (serverUrl && !serverId) {
      throw new Error(`${slug}.${operation.operationId}.${id}: serverUrl is not approved for this endpoint`);
    }

    return {
      id,
      title: localized(
        example.summary ?? operation.summary ?? operation.operationId,
        englishExample.summary ?? englishOperation.summary ?? operation.operationId
      ),
      request: {
        ...(serverId ? { serverId } : {}),
        path: { ...(request.path ?? {}) },
        query: { ...(request.query ?? {}) },
        headers: { ...(request.headers ?? {}) },
        ...(hasOwn(request, "body") ? { body: request.body } : {})
      },
      expectedStatus,
      ...(example.verifiedAt ?? operation["x-pontx-verified-at"]
        ? { verifiedAt: example.verifiedAt ?? operation["x-pontx-verified-at"] }
        : {}),
      completeness: unresolved.length ? "requires-input" : "ready",
      unresolved
    };
  });
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

function makeOperation(document, englishDocument, path, method, operation, englishOperation, pathParameters, englishPathParameters, serverIdByUrl, catalogSlug, auth) {
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
  const requestExamples = makeRequestExamples({
    slug: catalogSlug,
    operation,
    englishOperation,
    parameters: resolvedParameters,
    requestSchema,
    serverIdByUrl,
    auth
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
    requestExamples,
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
        serverIdByUrl,
        entry.slug,
        entry.auth
      ))
  );
  const operationIds = new Set(operations.map((operation) => operation.operationId));
  for (const operation of operations) {
    for (const example of operation.requestExamples) {
      for (const input of example.unresolved) {
        if (input.source.kind === "operation" && !operationIds.has(input.source.operationId)) {
          throw new Error(
            `${entry.slug}.${operation.operationId}.${example.id}: source operation does not exist: ${input.source.operationId}`
          );
        }
      }
    }
  }
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
  const quickStartOperation = operations.find(
    (operation) => operation.operationId === entry.quickStart?.operationId
  );
  if (!quickStartOperation) {
    throw new Error(`${entry.slug}: quickStart.operationId does not match an operation`);
  }
  const quickStartExampleId = entry.quickStart?.requestExampleId ?? "default";
  if (!quickStartOperation.requestExamples.some((example) => example.id === quickStartExampleId)) {
    throw new Error(`${entry.slug}: quickStart request example not found: ${quickStartExampleId}`);
  }
  const quickStartExample = quickStartOperation.requestExamples.find(
    (example) => example.id === quickStartExampleId
  );
  if (quickStartExample.completeness !== "ready") {
    throw new Error(`${entry.slug}: quickStart request example must be ready to send`);
  }
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
    ...(entry.sdkExamples ? { sdkExamples: entry.sdkExamples } : {}),
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
    quickStart: {
      operationSlug: quickStartOperation.slug,
      requestExampleId: quickStartExampleId
    },
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
