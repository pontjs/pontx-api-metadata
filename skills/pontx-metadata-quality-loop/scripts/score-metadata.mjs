#!/usr/bin/env node

import fs from "node:fs/promises";
import path from "node:path";
import { pathToFileURL } from "node:url";

function parseArgs(argv) {
  const result = {};
  for (let index = 0; index < argv.length; index += 1) {
    const key = argv[index];
    if (!key.startsWith("--")) throw new Error(`Unexpected argument: ${key}`);
    const value = argv[index + 1];
    if (!value || value.startsWith("--")) throw new Error(`${key} requires a value`);
    result[key.slice(2)] = value;
    index += 1;
  }
  return result;
}

function round(value) {
  return Math.round(value * 100) / 100;
}

function grade(score, hasCritical) {
  let value = score >= 90 ? "A" : score >= 80 ? "B" : score >= 70 ? "C" : score >= 60 ? "D" : "E";
  if (hasCritical && ["A", "B", "C"].includes(value)) value = "D";
  return value;
}

async function isFile(filePath) {
  try {
    return (await fs.stat(filePath)).isFile();
  } catch (error) {
    if (error?.code === "ENOENT") return false;
    throw error;
  }
}

async function discoverSpecModule(metadataRepo) {
  const candidates = [
    process.env.PONTX_SPEC_MODULE,
    path.resolve(metadataRepo, "../pontx/packages/spec/lib/index.js"),
    path.resolve(metadataRepo, "../../../pontx/packages/spec/lib/index.js"),
  ].filter(Boolean);
  for (const candidate of candidates) {
    if (await isFile(candidate)) return candidate;
  }
  throw new Error("Cannot find built @pontx/spec. Pass --spec-module after running its build.");
}

async function loadLocales(collectionDir, parseOAS3, slug) {
  const localesDir = path.join(collectionDir, "locales");
  const locales = {};
  let entries = [];
  try {
    entries = await fs.readdir(localesDir, { withFileTypes: true });
  } catch (error) {
    if (error?.code !== "ENOENT") throw error;
  }
  for (const entry of entries) {
    if (!entry.isDirectory()) continue;
    const filePath = path.join(localesDir, entry.name, "openapi.json");
    if (!await isFile(filePath)) continue;
    locales[entry.name] = parseOAS3(JSON.parse(await fs.readFile(filePath, "utf8")), slug);
  }
  return locales;
}

async function scoreCollections(metadataRepo, specModule) {
  const { evaluatePontxQuality, parseOAS3 } = await import(pathToFileURL(specModule).href);
  if (typeof evaluatePontxQuality !== "function" || typeof parseOAS3 !== "function") {
    throw new Error("The spec module must export evaluatePontxQuality and parseOAS3");
  }
  const specsDir = path.join(metadataRepo, "specs");
  const entries = (await fs.readdir(specsDir, { withFileTypes: true }))
    .filter((entry) => entry.isDirectory())
    .sort((left, right) => left.name.localeCompare(right.name));
  const collections = [];
  for (const entry of entries) {
    const sourcePath = path.join(specsDir, entry.name, "openapi.json");
    if (!await isFile(sourcePath)) continue;
    const source = parseOAS3(JSON.parse(await fs.readFile(sourcePath, "utf8")), entry.name);
    const locales = await loadLocales(path.dirname(sourcePath), parseOAS3, entry.name);
    const report = evaluatePontxQuality({ spec: source, defaultLocale: "zh-CN", locales });
    collections.push({ slug: entry.name, report });
  }
  return collections;
}

function aggregate(collections) {
  const apiCount = collections.reduce((sum, item) => sum + item.report.metadata.apiCount, 0);
  if (!apiCount) throw new Error("No APIs found in metadata repository");
  const dimensions = new Map();
  const findings = [];
  const criticals = [];
  for (const { slug, report } of collections) {
    const weight = report.metadata.apiCount;
    for (const dimension of report.dimensions) {
      const current = dimensions.get(dimension.id) || {
        id: dimension.id,
        title: dimension.title,
        weight: dimension.weight,
        weightedScore: 0,
        checked: 0,
        passed: 0,
      };
      current.weightedScore += dimension.score * weight;
      current.checked += dimension.checked;
      current.passed += dimension.passed;
      dimensions.set(dimension.id, current);
    }
    for (const finding of report.findings) findings.push({ collection: slug, ...finding });
    for (const finding of report.criticals) criticals.push({ collection: slug, ...finding });
  }
  const dimensionReports = Array.from(dimensions.values()).map((dimension) => {
    const score = round(dimension.weightedScore / apiCount);
    return {
      id: dimension.id,
      title: dimension.title,
      weight: dimension.weight,
      score,
      coverage: dimension.weight ? round(score / dimension.weight) : 1,
      checked: dimension.checked,
      passed: dimension.passed,
    };
  });
  const staticScore = round(dimensionReports.reduce((sum, item) => sum + item.score, 0));
  const projectedScore = round(staticScore * 2);
  return {
    score: projectedScore,
    grade: grade(projectedScore, criticals.length > 0),
    staticScore,
    dynamicScore: null,
    provisional: true,
    dimensions: dimensionReports,
    criticals,
    findings,
    metadata: {
      collectionCount: collections.length,
      apiCount,
      schemaCount: collections.reduce((sum, item) => sum + item.report.metadata.schemaCount, 0),
      generatedAt: new Date().toISOString(),
    },
    collections: collections.map(({ slug, report }) => ({
      slug,
      staticScore: report.staticScore,
      projectedScore: report.score,
      grade: report.grade,
      apiCount: report.metadata.apiCount,
      findingCount: report.findings.length,
      criticalCount: report.criticals.length,
      dimensions: report.dimensions,
    })),
  };
}

const args = parseArgs(process.argv.slice(2));
const metadataRepo = path.resolve(args["metadata-repo"] || process.cwd());
const specModule = path.resolve(args["spec-module"] || await discoverSpecModule(metadataRepo));
const report = aggregate(await scoreCollections(metadataRepo, specModule));
const output = `${JSON.stringify(report, null, 2)}\n`;
if (args.output) await fs.writeFile(path.resolve(args.output), output);
process.stdout.write(output);
