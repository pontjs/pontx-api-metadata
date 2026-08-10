import { readFile } from "node:fs/promises";
import { basename, dirname, resolve } from "node:path";

export const DEFAULT_LOCALE = "zh-CN";
export const SUPPORTED_LOCALES = ["en-US"];

const localePattern = /^[a-z]{2,3}(?:-[A-Z][a-z]{3})?(?:-(?:[A-Z]{2}|[0-9]{3}))?$/;
const textKeywords = new Set(["title", "summary", "description"]);
const translatedExtensions = new Set([
  "x-pontx-proxy-disabled-reason",
  "x-pontx-stability-note"
]);

function escapePointerSegment(segment) {
  return String(segment).replaceAll("~", "~0").replaceAll("/", "~1");
}

export function jsonPointer(segments) {
  return segments.length
    ? `/${segments.map(escapePointerSegment).join("/")}`
    : "/";
}

export function localizedSpecPath(repositoryRoot, specFile, locale) {
  return resolve(
    repositoryRoot,
    dirname(specFile),
    "locales",
    locale,
    basename(specFile)
  );
}

export function validateLocaleTag(locale) {
  if (!localePattern.test(locale)) {
    throw new Error(`${locale}: locale must use a BCP 47 language tag such as en-US`);
  }
}

const identifierMapKeywords = new Set([
  "$defs",
  "callbacks",
  "definitions",
  "headers",
  "links",
  "parameters",
  "pathItems",
  "paths",
  "patternProperties",
  "properties",
  "requestBodies",
  "responses",
  "schemas",
  "securitySchemes",
  "webhooks"
]);

function isMapEntryName(segments, index) {
  return identifierMapKeywords.has(segments[index - 1]);
}

function isLiteralBranch(segments) {
  return segments.some((segment, index) => {
    if (segment === "value" && segments[index - 2] === "examples") return true;
    if (isMapEntryName(segments, index)) return false;
    if (segment === "examples" && segments[index - 1] === "components") return false;
    return ["example", "examples", "enum", "const", "default"].includes(segment);
  });
}

function isOAuthScopeText(segments) {
  return (
    segments.length === 7 &&
    segments[0] === "components" &&
    segments[1] === "securitySchemes" &&
    segments[3] === "flows" &&
    segments[5] === "scopes"
  ) || (
    segments.length === 4 &&
    segments[0] === "securityDefinitions" &&
    segments[2] === "scopes"
  );
}

export function isTranslatableText(segments, value) {
  if (typeof value !== "string" || segments.length === 0) return false;
  const key = segments.at(-1);
  if (translatedExtensions.has(key)) return true;
  if (segments.at(-2) === "x-enum-descriptions") return true;
  if (isOAuthScopeText(segments)) return true;
  const examplesIndex = segments.lastIndexOf("examples");
  if (
    examplesIndex >= 0 &&
    examplesIndex === segments.length - 3 &&
    (key === "summary" || key === "description")
  ) {
    return true;
  }
  if (isLiteralBranch(segments)) return false;
  return textKeywords.has(key);
}

function compareLocalizedNodes(defaultNode, localizedNode, segments, errors) {
  const pointer = jsonPointer(segments);
  if (isTranslatableText(segments, defaultNode)) {
    if (typeof localizedNode !== "string" || localizedNode.trim() === "") {
      errors.push(`${pointer}: translated text must be a non-empty string`);
    }
    return;
  }

  if (Array.isArray(defaultNode)) {
    if (!Array.isArray(localizedNode)) {
      errors.push(`${pointer}: expected an array`);
      return;
    }
    if (defaultNode.length !== localizedNode.length) {
      errors.push(`${pointer}: array length differs (${defaultNode.length} !== ${localizedNode.length})`);
      return;
    }
    defaultNode.forEach((value, index) => {
      compareLocalizedNodes(value, localizedNode[index], [...segments, index], errors);
    });
    return;
  }

  if (defaultNode && typeof defaultNode === "object") {
    if (!localizedNode || typeof localizedNode !== "object" || Array.isArray(localizedNode)) {
      errors.push(`${pointer}: expected an object`);
      return;
    }
    const defaultKeys = Object.keys(defaultNode);
    const localizedKeys = Object.keys(localizedNode);
    const missing = defaultKeys.filter((key) => !localizedKeys.includes(key));
    const extra = localizedKeys.filter((key) => !defaultKeys.includes(key));
    if (missing.length) errors.push(`${pointer}: missing keys ${missing.join(", ")}`);
    if (extra.length) errors.push(`${pointer}: unexpected keys ${extra.join(", ")}`);
    for (const key of defaultKeys) {
      if (Object.hasOwn(localizedNode, key)) {
        compareLocalizedNodes(defaultNode[key], localizedNode[key], [...segments, key], errors);
      }
    }
    return;
  }

  if (!Object.is(defaultNode, localizedNode)) {
    errors.push(`${pointer}: structural value differs (${JSON.stringify(defaultNode)} !== ${JSON.stringify(localizedNode)})`);
  }
}

export function compareLocalizedDocuments(defaultDocument, localizedDocument) {
  const errors = [];
  compareLocalizedNodes(defaultDocument, localizedDocument, [], errors);
  return errors;
}

export function mergeLocalizedText(defaultNode, localizedNode, segments = []) {
  if (isTranslatableText(segments, defaultNode)) return localizedNode;
  if (Array.isArray(defaultNode)) {
    return defaultNode.map((value, index) =>
      mergeLocalizedText(value, localizedNode[index], [...segments, index])
    );
  }
  if (defaultNode && typeof defaultNode === "object") {
    return Object.fromEntries(
      Object.entries(defaultNode).map(([key, value]) => [
        key,
        mergeLocalizedText(value, localizedNode[key], [...segments, key])
      ])
    );
  }
  return defaultNode;
}

export async function readLocalizedDocument(repositoryRoot, specFile, locale) {
  validateLocaleTag(locale);
  const path = localizedSpecPath(repositoryRoot, specFile, locale);
  return JSON.parse(await readFile(path, "utf8"));
}

export function localized(zh, en) {
  return { zh: zh || en, en: en || zh };
}
