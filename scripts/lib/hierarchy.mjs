import { createHash } from "node:crypto";
import { readdir, readFile } from "node:fs/promises";
import { resolve } from "node:path";
import { pathToFileURL } from "node:url";
import { validateSdkQuality } from "./sdk-quality.mjs";

const SLUG_PATTERN = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
const SHA256_PATTERN = /^[a-f0-9]{64}$/;
const COMMIT_PATTERN = /^[a-f0-9]{40}$/;
const PRODUCT_KEYS = new Set([
  "formatVersion",
  "slug",
  "name",
  "provider",
  "category",
  "featured",
  "display",
  "legal",
  "documentation",
  "pricing",
  "credentials",
  "quickStart",
]);
const PRODUCT_LOCALE_KEYS = new Set([
  "display",
  "documentation",
  "pricing",
  "credentials",
]);
const FORBIDDEN_PRODUCT_KEYS = new Set([
  "apis",
  "operations",
  "schemas",
  "servers",
  "security",
  "packageName",
  "sdkQuality",
]);

const readJson = async (path) => JSON.parse(await readFile(path, "utf8"));
const sha256 = (bytes) => createHash("sha256").update(bytes).digest("hex");
const hasText = (value) => typeof value === "string" && value.trim().length > 0;

async function loadSpecModule(moduleReference) {
  const reference = moduleReference.startsWith("/")
    ? pathToFileURL(moduleReference).href
    : moduleReference;
  return import(reference);
}

function checkExactKeys(value, allowed, context, errors) {
  for (const key of Object.keys(value ?? {})) {
    if (!allowed.has(key)) errors.push(`${context}: unexpected field ${key}`);
  }
}

function validateProduct(slug, product, errors) {
  checkExactKeys(product, PRODUCT_KEYS, `${slug}/product.json`, errors);
  if (product.formatVersion !== 1) errors.push(`${slug}: product formatVersion must be 1`);
  if (product.slug !== slug) errors.push(`${slug}: product slug must match its directory`);
  for (const key of FORBIDDEN_PRODUCT_KEYS) {
    if (Object.hasOwn(product, key)) errors.push(`${slug}: product.json cannot contain ${key}`);
  }
  for (const [field, value] of [
    ["name", product.name],
    ["provider", product.provider],
    ["category", product.category],
    ["display.title", product.display?.title],
    ["display.summary", product.display?.summary],
    ["legal.license", product.legal?.license],
    ["legal.attributionUrl", product.legal?.attributionUrl],
  ]) {
    if (!hasText(value)) errors.push(`${slug}: ${field} must be non-empty`);
  }
  if (!String(product.legal?.attributionUrl ?? "").startsWith("https://")) {
    errors.push(`${slug}: legal attribution URL must use HTTPS`);
  }
  if (!hasText(product.quickStart?.operationId)
    || !hasText(product.quickStart?.requestExampleId)) {
    errors.push(`${slug}: quickStart must identify an Endpoint and request example`);
  }
  for (const credential of product.credentials ?? []) {
    if (!credential.guide) continue;
    const context = `${slug}: credential ${credential.schemeId} guide`;
    checkExactKeys(
      credential.guide,
      new Set(["url", "title", "steps"]),
      context,
      errors,
    );
    if (!String(credential.guide.url ?? "").startsWith("https://")) {
      errors.push(`${context} URL must use HTTPS`);
    }
    if (!hasText(credential.guide.title)) {
      errors.push(`${context} title must be non-empty`);
    }
    if (!Array.isArray(credential.guide.steps)
      || credential.guide.steps.length < 1
      || credential.guide.steps.length > 8
      || credential.guide.steps.some((step) => !hasText(step))) {
      errors.push(`${context} must contain 1 to 8 non-empty steps`);
    }
  }
}

function validateProductLocale(slug, locale, localized, product, errors) {
  const context = `${slug}/locales/${locale}/product.json`;
  checkExactKeys(localized, PRODUCT_LOCALE_KEYS, context, errors);
  if (!hasText(localized.display?.title) || !hasText(localized.display?.summary)) {
    errors.push(`${context}: display title and summary are required`);
  }
  const baseCredentialIds = new Set(product.credentials.map((item) => item.schemeId));
  for (const credential of localized.credentials ?? []) {
    if (!baseCredentialIds.has(credential.schemeId)) {
      errors.push(`${context}: unknown credential scheme ${credential.schemeId}`);
    }
    if (!hasText(credential.description)) {
      errors.push(`${context}: credential ${credential.schemeId} needs translated description`);
    }
    const baseCredential = product.credentials.find(
      (item) => item.schemeId === credential.schemeId,
    );
    if (credential.guide && !baseCredential?.guide) {
      errors.push(`${context}: credential ${credential.schemeId} cannot add a locale-only guide`);
    }
    if (baseCredential?.guide) {
      checkExactKeys(
        credential.guide,
        new Set(["title", "steps"]),
        `${context}: credential ${credential.schemeId} guide`,
        errors,
      );
      if (!hasText(credential.guide?.title)) {
        errors.push(`${context}: credential ${credential.schemeId} needs a translated guide title`);
      }
      if (!Array.isArray(credential.guide?.steps)
        || credential.guide.steps.length !== baseCredential.guide.steps.length
        || credential.guide.steps.some((step) => !hasText(step))) {
        errors.push(`${context}: credential ${credential.schemeId} guide steps must match the source structure`);
      }
    }
  }
}

function operationIds(spec) {
  return new Set(Object.values(spec.apis).map((api) => api.operationId).filter(Boolean));
}

function validateSpec(slug, spec, product, errors) {
  const ids = operationIds(spec);
  if (ids.size !== Object.keys(spec.apis).length) {
    errors.push(`${slug}: every Endpoint must have a unique operationId`);
  }
  const serverIds = new Set();
  for (const server of spec.servers ?? []) {
    if (!hasText(server.id) || serverIds.has(server.id)) {
      errors.push(`${slug}: every server needs a unique stable id`);
    } else {
      serverIds.add(server.id);
    }
    if (!String(server.url ?? "").startsWith("https://")) {
      errors.push(`${slug}: server must use HTTPS (${server.url})`);
    }
  }
  const schemeIds = new Set(Object.keys(spec.components.securitySchemes ?? {}));
  for (const credential of product.credentials) {
    if (!schemeIds.has(credential.schemeId)) {
      errors.push(`${slug}: credential ${credential.schemeId} has no PontxSpec security scheme`);
    }
  }
  const quickStartApi = Object.values(spec.apis)
    .find((api) => api.operationId === product.quickStart.operationId);
  if (!quickStartApi) {
    errors.push(`${slug}: quickStart Endpoint does not exist`);
  } else if (!quickStartApi.requestExamples?.[product.quickStart.requestExampleId]) {
    errors.push(`${slug}: quickStart request example does not exist`);
  }

  for (const [apiId, api] of Object.entries(spec.apis)) {
    const execution = api.metadata?.execution;
    if (execution?.enabled === false && !hasText(execution.disabledReason)) {
      errors.push(`${slug}.${apiId}: disabled execution requires a reason`);
    }
    for (const evidence of api.metadata?.documentation?.evidence ?? []) {
      if (!String(evidence).startsWith("https://")) {
        errors.push(`${slug}.${apiId}: evidence URL must use HTTPS`);
      }
    }
  }
}

function validateSdk(slug, sdk, spec, specBytes, requireMetadataCommit, errors) {
  try {
    validateSdkQuality(slug, sdk);
  } catch (error) {
    errors.push(error.message);
  }
  if (sdk.formatVersion !== 1) errors.push(`${slug}: SDK formatVersion must be 1`);
  if (!hasText(sdk.package?.name) || !hasText(sdk.package?.version)) {
    errors.push(`${slug}: SDK package name and version are required`);
  }
  if (sdk.spec?.path !== `products/${slug}/spec.pontx.json`) {
    errors.push(`${slug}: SDK spec path must point to its product PontxSpec`);
  }
  const actualSha = sha256(specBytes);
  if (!SHA256_PATTERN.test(sdk.spec?.sha256 ?? "") || sdk.spec.sha256 !== actualSha) {
    errors.push(`${slug}: SDK PontxSpec SHA-256 mismatch`);
  }
  if (sdk.package?.status === "published" && requireMetadataCommit
    && !COMMIT_PATTERN.test(sdk.spec?.metadataCommit ?? "")) {
    errors.push(`${slug}: published SDK evidence must pin a metadata commit`);
  }
  const ids = operationIds(spec);
  const apiById = new Map(
    Object.values(spec.apis).map((api) => [api.operationId, api]),
  );
  if (Object.hasOwn(sdk.contract ?? {}, "operations")) {
    errors.push(`${slug}: SDK contract must derive Endpoint IDs from coverage, not duplicate operations`);
  }
  const contractIds = sdk.coverage?.mode === "partial"
    ? new Set(sdk.coverage.endpointIds ?? [])
    : new Set(ids);
  for (const id of contractIds) {
    const api = apiById.get(id);
    if (!api) {
      errors.push(`${slug}: SDK contract references unknown Endpoint ${id}`);
      continue;
    }
    const explicitTag = api.tags?.[0];
    if (explicitTag && !Object.hasOwn(sdk.contract.controllers ?? {}, explicitTag)) {
      errors.push(`${slug}: SDK contract has no Controller for explicit tag ${explicitTag}`);
    }
    if (!explicitTag && Object.keys(sdk.contract.controllers ?? {}).some(
      (name) => name === "default" || name === "common",
    )) {
      errors.push(`${slug}: untagged Endpoints must remain flat; common/default cannot be a Controller`);
    }
  }
  for (const [alias, endpointIds] of Object.entries(
    sdk.contract?.compatibilityAliases ?? {},
  )) {
    if (alias === "common" || alias === "default") {
      errors.push(`${slug}: SDK contract cannot retain common/default compatibility aliases`);
      continue;
    }
    if (!/^[A-Za-z_$][A-Za-z0-9_$]*$/.test(alias)
      || !Array.isArray(endpointIds) || !endpointIds.length) {
      errors.push(`${slug}: invalid SDK compatibility alias ${alias}`);
      continue;
    }
    for (const id of endpointIds) {
      if (!contractIds.has(id)) {
        errors.push(`${slug}: compatibility alias ${alias} references unsupported Endpoint ${id}`);
      }
    }
  }
  if (sdk.coverage?.mode === "full") {
    if (Object.hasOwn(sdk.coverage, "endpointIds")) {
      errors.push(`${slug}: full SDK coverage must not enumerate Endpoint IDs`);
    }
  } else if (sdk.coverage?.mode === "partial") {
    if (!Array.isArray(sdk.coverage.endpointIds) || !sdk.coverage.endpointIds.length) {
      errors.push(`${slug}: partial SDK coverage must enumerate Endpoint IDs`);
    } else {
      for (const id of sdk.coverage.endpointIds) {
        if (!ids.has(id)) errors.push(`${slug}: SDK coverage references unknown Endpoint ${id}`);
      }
    }
  } else {
    errors.push(`${slug}: SDK coverage mode must be full or partial`);
  }
}

export async function validateHierarchy({
  root,
  specModule = process.env.PONTX_SPEC_MODULE ?? "@pontx/spec",
  requireMetadataCommit = true,
} = {}) {
  const errors = [];
  const pontx = await loadSpecModule(specModule);
  const catalog = await readJson(resolve(root, "catalog/products.json"));
  checkExactKeys(
    catalog,
    new Set(["formatVersion", "defaultLocale", "locales", "products"]),
    "catalog/products.json",
    errors,
  );
  if (catalog.formatVersion !== 1) errors.push("catalog formatVersion must be 1");
  if (catalog.defaultLocale !== "zh-CN") errors.push("default locale must be zh-CN");
  if (!Array.isArray(catalog.locales) || !catalog.locales.includes("en-US")) {
    errors.push("catalog must declare en-US support");
  }
  if (!Array.isArray(catalog.products) || !catalog.products.length) {
    errors.push("catalog products must be a non-empty ordered slug list");
  }
  const slugs = catalog.products ?? [];
  if (new Set(slugs).size !== slugs.length) errors.push("catalog product slugs must be unique");
  for (const slug of slugs) {
    if (!SLUG_PATTERN.test(slug)) errors.push(`invalid product slug ${slug}`);
  }
  const productDirectories = (await readdir(resolve(root, "products"), { withFileTypes: true }))
    .filter((entry) => entry.isDirectory())
    .map((entry) => entry.name)
    .sort();
  const expectedDirectories = [...slugs].sort();
  if (JSON.stringify(productDirectories) !== JSON.stringify(expectedDirectories)) {
    errors.push("products/ directories must exactly match catalog/products.json");
  }

  let endpointCount = 0;
  let schemaCount = 0;
  for (const slug of slugs) {
    try {
      const productRoot = resolve(root, "products", slug);
      const [product, specBytes, sdk] = await Promise.all([
        readJson(resolve(productRoot, "product.json")),
        readFile(resolve(productRoot, "spec.pontx.json")),
        readJson(resolve(productRoot, "sdk.json")),
      ]);
      const spec = pontx.loadPontxSpec(specBytes.toString("utf8"), { expectedName: slug });
      validateProduct(slug, product, errors);
      validateSpec(slug, spec, product, errors);
      validateSdk(slug, sdk, spec, specBytes, requireMetadataCommit, errors);
      endpointCount += Object.keys(spec.apis).length;
      schemaCount += Object.keys(spec.components.schemas).length;

      for (const locale of catalog.locales) {
        const [localizedProduct, localizedSpec] = await Promise.all([
          readJson(resolve(productRoot, "locales", locale, "product.json")),
          readJson(resolve(productRoot, "locales", locale, "spec.pontx.json")),
        ]);
        validateProductLocale(slug, locale, localizedProduct, product, errors);
        const localeResult = pontx.validatePontxSpecLocale(spec, localizedSpec);
        errors.push(...localeResult.issues.map((item) => `${slug} ${locale}: ${item.message}`));
      }
    } catch (error) {
      errors.push(`${slug}: ${error.message}`);
    }
  }

  return {
    valid: errors.length === 0,
    errors,
    productCount: slugs.length,
    endpointCount,
    schemaCount,
  };
}
