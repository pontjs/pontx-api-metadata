import { execFile } from "node:child_process";
import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import { promisify } from "node:util";
import { validatePublishedSdkHomepage } from "./lib/sdk-homepages.mjs";

const execFileAsync = promisify(execFile);
const root = process.cwd();
const catalog = JSON.parse(await readFile(resolve(root, "catalog/products.json"), "utf8"));
const npmEnvironment = {
  ...process.env,
  NPM_CONFIG_CACHE: process.env.NPM_CONFIG_CACHE ?? "/tmp/pontx-metadata-npm-cache",
};

async function readRegistryMetadata(slug, sdk) {
  const packageSpec = `${sdk.package.name}@${sdk.package.version}`;
  let lastError;
  for (let attempt = 1; attempt <= 3; attempt += 1) {
    try {
      const { stdout } = await execFileAsync(
        "npm",
        ["view", packageSpec, "name", "version", "homepage", "readme", "--json"],
        {
          cwd: root,
          encoding: "utf8",
          env: npmEnvironment,
          maxBuffer: 10 * 1024 * 1024,
        },
      );
      return JSON.parse(stdout);
    } catch (error) {
      lastError = error;
      if (attempt < 3) {
        await new Promise((resolve) => setTimeout(resolve, attempt * 500));
      }
    }
  }
  throw new Error(
    `${slug}: npm metadata lookup failed for ${packageSpec} after 3 attempts: ${lastError.message}`,
  );
}

const results = await Promise.all(catalog.products.map(async (slug) => {
  const sdk = JSON.parse(
    await readFile(resolve(root, "products", slug, "sdk.json"), "utf8"),
  );
  if (sdk.package?.status !== "published") return [];
  try {
    const registryMetadata = await readRegistryMetadata(slug, sdk);
    return validatePublishedSdkHomepage(slug, sdk, registryMetadata);
  } catch (error) {
    return [`${slug}: failed to inspect the published npm package: ${error.message}`];
  }
}));

const errors = results.flat();
if (errors.length > 0) {
  console.error(`Published SDK homepage verification failed with ${errors.length} error(s):`);
  for (const error of errors) console.error(`- ${error}`);
  process.exitCode = 1;
} else {
  console.log(
    `Verified canonical npm homepage and README links for ${catalog.products.length} published SDKs.`,
  );
}
