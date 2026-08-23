import assert from "node:assert/strict";
import {
  expectedSdkHomepage,
  validatePublishedSdkHomepage,
} from "./lib/sdk-homepages.mjs";

const slug = "example";
const sdk = {
  package: {
    name: "@pontx/example",
    version: "1.2.3",
    status: "published",
  },
};
const expected = expectedSdkHomepage(slug);
const registry = {
  name: "@pontx/example",
  version: "1.2.3",
  homepage: expected,
  readme: `Use the [Pontx Hub SDK guide](${expected}).`,
};

assert.deepEqual(validatePublishedSdkHomepage(slug, sdk, registry), []);
assert.match(
  validatePublishedSdkHomepage(slug, sdk, { ...registry, homepage: undefined }).join("\n"),
  /npm homepage must be/,
);
assert.match(
  validatePublishedSdkHomepage(slug, sdk, {
    ...registry,
    homepage: "https://pontx-hub.vercel.app/en/sdks/example",
    readme: "https://pontx-hub.vercel.app/en/sdks/example",
  }).join("\n"),
  /retired Pontx Hub hostname/,
);
assert.match(
  validatePublishedSdkHomepage(slug, sdk, { ...registry, readme: "No Hub link." }).join("\n"),
  /published npm README must link/,
);
assert.match(
  validatePublishedSdkHomepage(slug, sdk, { ...registry, version: "1.2.2" }).join("\n"),
  /npm version 1.2.2 must match 1.2.3/,
);

console.log("SDK homepage contract unit tests passed.");
