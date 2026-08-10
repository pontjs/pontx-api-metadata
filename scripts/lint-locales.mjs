import { readFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import {
  DEFAULT_LOCALE,
  SUPPORTED_LOCALES,
  compareLocalizedDocuments,
  localizedSpecPath,
  readLocalizedDocument,
  validateLocaleTag
} from "./lib/localization.mjs";

const repositoryRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const source = JSON.parse(
  await readFile(resolve(repositoryRoot, "catalog/source.json"), "utf8")
);
const errors = [];

function checkExactKeys(value, expectedKeys, context) {
  const actualKeys = Object.keys(value ?? {});
  const missing = expectedKeys.filter((key) => !actualKeys.includes(key));
  const extra = actualKeys.filter((key) => !expectedKeys.includes(key));
  if (missing.length) errors.push(`${context}: missing keys ${missing.join(", ")}`);
  if (extra.length) errors.push(`${context}: unexpected keys ${extra.join(", ")}`);
}

function checkText(value, context) {
  if (typeof value !== "string" || value.trim() === "") {
    errors.push(`${context}: expected non-empty translated text`);
  }
}

if (source.defaultLocale !== DEFAULT_LOCALE) {
  errors.push(`catalog/source.json: defaultLocale must be ${DEFAULT_LOCALE}`);
}
if (JSON.stringify(source.locales) !== JSON.stringify(SUPPORTED_LOCALES)) {
  errors.push(`catalog/source.json: locales must be ${JSON.stringify(SUPPORTED_LOCALES)}`);
}

for (const locale of source.locales ?? []) validateLocaleTag(locale);

for (const api of source.apis ?? []) {
  for (const [field, value] of [
    ["title", api.title],
    ["summary", api.summary],
    ["server.description", api.server?.description],
    ...(api.stabilityNote === undefined ? [] : [["stabilityNote", api.stabilityNote]])
  ]) {
    if (typeof value !== "string" || value.trim() === "") {
      errors.push(`${api.slug}: ${field} must be non-empty ${DEFAULT_LOCALE} text`);
    }
  }
  for (const legacyField of ["translations", "parameterTranslations", "schemaTranslations"]) {
    if (Object.hasOwn(api, legacyField)) {
      errors.push(`${api.slug}: legacy ${legacyField} is not allowed; translate the locale OAS instead`);
    }
  }
  for (const auth of api.auth ?? []) {
    if (typeof auth.description !== "string" || auth.description.trim() === "") {
      errors.push(`${api.slug}: auth ${auth.id} description must be ${DEFAULT_LOCALE} text`);
    }
  }
  const defaultPath = resolve(repositoryRoot, api.specFile);
  const defaultDocument = JSON.parse(await readFile(defaultPath, "utf8"));
  for (const locale of source.locales ?? []) {
    try {
      const localizedDocument = await readLocalizedDocument(repositoryRoot, api.specFile, locale);
      const differences = compareLocalizedDocuments(defaultDocument, localizedDocument);
      errors.push(...differences.map((message) => `${api.slug} ${locale} ${message}`));
    } catch (error) {
      errors.push(
        `${api.slug} ${locale}: cannot read ${localizedSpecPath(repositoryRoot, api.specFile, locale)} (${error.message})`
      );
    }
  }
}

for (const locale of source.locales ?? []) {
  const catalogLocalePath = resolve(repositoryRoot, "catalog/locales", `${locale}.json`);
  try {
    const catalogLocale = JSON.parse(await readFile(catalogLocalePath, "utf8"));
    if (catalogLocale.version !== source.version) {
      errors.push(`${catalogLocalePath}: version must match catalog/source.json`);
    }
    if (catalogLocale.locale !== locale) {
      errors.push(`${catalogLocalePath}: locale must be ${locale}`);
    }
    const expectedSlugs = source.apis.map((api) => api.slug);
    const actualSlugs = Object.keys(catalogLocale.apis ?? {});
    for (const slug of expectedSlugs.filter((slug) => !actualSlugs.includes(slug))) {
      errors.push(`${catalogLocalePath}: missing API ${slug}`);
    }
    for (const slug of actualSlugs.filter((slug) => !expectedSlugs.includes(slug))) {
      errors.push(`${catalogLocalePath}: unexpected API ${slug}`);
    }
    for (const api of source.apis) {
      const localizedApi = catalogLocale.apis?.[api.slug];
      if (!localizedApi) continue;
      const expectedKeys = ["title", "summary", "server"];
      if (api.stabilityNote !== undefined) expectedKeys.push("stabilityNote");
      if (api.auth?.length) expectedKeys.push("auth");
      checkExactKeys(localizedApi, expectedKeys, `${locale}.${api.slug}`);
      checkText(localizedApi.title, `${locale}.${api.slug}.title`);
      checkText(localizedApi.summary, `${locale}.${api.slug}.summary`);
      if (api.stabilityNote !== undefined) {
        checkText(localizedApi.stabilityNote, `${locale}.${api.slug}.stabilityNote`);
      }
      checkExactKeys(localizedApi.server, ["description"], `${locale}.${api.slug}.server`);
      checkText(localizedApi.server?.description, `${locale}.${api.slug}.server.description`);
      if (api.auth?.length) {
        const expectedAuthIds = api.auth.map((auth) => auth.id);
        checkExactKeys(localizedApi.auth, expectedAuthIds, `${locale}.${api.slug}.auth`);
        for (const auth of api.auth) {
          const localizedAuth = localizedApi.auth?.[auth.id];
          if (!localizedAuth) continue;
          const expectedAuthKeys = ["description"];
          if (auth.credentialGuide) expectedAuthKeys.push("credentialGuide");
          checkExactKeys(localizedAuth, expectedAuthKeys, `${locale}.${api.slug}.auth.${auth.id}`);
          checkText(localizedAuth.description, `${locale}.${api.slug}.auth.${auth.id}.description`);
          if (auth.credentialGuide) {
            checkExactKeys(
              localizedAuth.credentialGuide,
              ["title", "steps"],
              `${locale}.${api.slug}.auth.${auth.id}.credentialGuide`
            );
            checkText(
              localizedAuth.credentialGuide?.title,
              `${locale}.${api.slug}.auth.${auth.id}.credentialGuide.title`
            );
            if (
              !Array.isArray(localizedAuth.credentialGuide?.steps) ||
              localizedAuth.credentialGuide.steps.length !== auth.credentialGuide.steps.length
            ) {
              errors.push(
                `${locale}.${api.slug}.auth.${auth.id}.credentialGuide.steps: expected ${auth.credentialGuide.steps.length} translated steps`
              );
            } else {
              localizedAuth.credentialGuide.steps.forEach((step, index) =>
                checkText(
                  step,
                  `${locale}.${api.slug}.auth.${auth.id}.credentialGuide.steps.${index}`
                )
              );
            }
          }
        }
      }
    }
  } catch (error) {
    errors.push(`${catalogLocalePath}: cannot read locale catalog (${error.message})`);
  }
}

if (errors.length) {
  console.error(`Locale lint failed with ${errors.length} error(s):`);
  errors.slice(0, 200).forEach((error) => console.error(`- ${error}`));
  if (errors.length > 200) console.error(`- ...and ${errors.length - 200} more`);
  process.exitCode = 1;
} else {
  console.log(
    `Verified ${source.apis.length} ${DEFAULT_LOCALE} specifications against ${source.locales.length} locale(s).`
  );
}
