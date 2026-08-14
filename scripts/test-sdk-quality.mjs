import assert from "node:assert/strict";
import { validateSdkQuality } from "./lib/sdk-quality.mjs";

const entry = {
  slug: "example",
  sdkStatus: "published",
  sdkVersion: "1.2.3",
  sdkQuality: {
    testedVersion: "1.2.3",
    unitTests: { passed: 4, total: 4, skipped: 0 },
    e2eStatus: "passed",
    nodeVersions: ["18", "20", "22"],
    sourceCommit: "a".repeat(40),
    testedAt: "2026-08-14",
    repositoryUrl: "https://github.com/pontjs/example",
    workflowRunUrl: "https://github.com/pontjs/example/actions/runs/1",
  },
};

assert.doesNotThrow(() => validateSdkQuality(entry));
assert.throws(
  () => validateSdkQuality({ ...entry, sdkQuality: undefined }),
  /requires sdkQuality evidence/,
);
assert.throws(
  () => validateSdkQuality({
    ...entry,
    sdkQuality: { ...entry.sdkQuality, testedVersion: "1.2.2" },
  }),
  /must match sdkVersion/,
);
assert.throws(
  () => validateSdkQuality({
    ...entry,
    sdkQuality: {
      ...entry.sdkQuality,
      unitTests: { passed: 3, total: 4, skipped: 1 },
    },
  }),
  /100% unit-test pass rate/,
);
assert.throws(
  () => validateSdkQuality({
    ...entry,
    sdkQuality: { ...entry.sdkQuality, e2eStatus: "failed" },
  }),
  /E2E status must be passed/,
);
assert.throws(
  () => validateSdkQuality({
    ...entry,
    sdkQuality: {
      ...entry.sdkQuality,
      workflowRunUrl: "https://github.com/pontjs/other/actions/runs/1",
    },
  }),
  /must belong to the SDK repository/,
);

console.log("SDK quality evidence unit tests passed.");
