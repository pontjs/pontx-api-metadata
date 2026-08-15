/** Verify Amazon SQS contract completeness, protocol fidelity, adapter boundary, and provenance. */
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { importSmithy, loadPontxSpec, validatePontxSpecLocale } from "@pontx/spec";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const productRoot = resolve(root, "products/amazon-sqs");
const sourcePath = resolve(productRoot, "sources/smithy.json");
const licensePath = resolve(productRoot, "sources/LICENSE.aws-sdk-js-v3");
const sourceHash = "c331594defdf5dfa77ced780ee8f90561896a822923062c0cfd21cbcd2cfc288";
const licenseHash = "edea91454b811f127fbdea3d86f378f6719bd372ed440abf82b232f6fca06c3d";
const sourceUrl = "https://raw.githubusercontent.com/aws/aws-sdk-js-v3/4efe5bc67b71dc5ec652fe77130f3bae9efe0173/codegen/sdk-codegen/aws-models/sqs.json";
const apiReference = "https://docs.aws.amazon.com/AWSSimpleQueueService/latest/APIReference/";
const safeExampleValues = new Set([
  "https://sqs.us-east-1.amazonaws.com/123456789012/pontx-example",
  "arn:aws:sqs:us-east-1:123456789012:pontx-example",
  "AQEB-example-receipt-handle",
  "Pontx example message",
]);

const sha256 = (value) => createHash("sha256").update(value).digest("hex");
const readJson = async (path) => JSON.parse(await readFile(path, "utf8"));

function collectStrings(value, values = []) {
  if (typeof value === "string") values.push(value);
  else if (Array.isArray(value)) value.forEach((item) => collectStrings(item, values));
  else if (value && typeof value === "object") Object.values(value).forEach((item) => collectStrings(item, values));
  return values;
}

const [sourceBytes, licenseBytes, zhBytes, enBytes, product, sdk, provenance] = await Promise.all([
  readFile(sourcePath),
  readFile(licensePath),
  readFile(resolve(productRoot, "spec.pontx.json")),
  readFile(resolve(productRoot, "locales/en-US/spec.pontx.json")),
  readJson(resolve(productRoot, "product.json")),
  readJson(resolve(productRoot, "sdk.json")),
  readJson(resolve(productRoot, "sources/provenance.json")),
]);

assert.equal(sha256(sourceBytes), sourceHash, "vendored Smithy hash must be immutable and approved");
assert.equal(sha256(licenseBytes), licenseHash, "vendored license hash must be immutable and approved");
assert.equal(sdk.spec.sha256, sha256(zhBytes), "SDK must bind canonical PontxSpec raw bytes");
assert.equal(sdk.package.status, "published", "SDK must be published before catalog admission");
assert.equal(sdk.package.name, "@pontx/amazon-sqs");
assert.equal(sdk.package.version, "0.1.4");
assert.deepEqual(sdk.contract?.methodNames, {
  AddPermission: "addPermission",
  CancelMessageMoveTask: "cancelMessageMoveTask",
  ChangeMessageVisibility: "changeMessageVisibility",
  ChangeMessageVisibilityBatch: "changeMessageVisibilityBatch",
  CreateQueue: "createQueue",
  DeleteMessage: "deleteMessage",
  DeleteMessageBatch: "deleteMessageBatch",
  DeleteQueue: "deleteQueue",
  GetQueueAttributes: "getQueueAttributes",
  GetQueueUrl: "getQueueUrl",
  ListDeadLetterSourceQueues: "listDeadLetterSourceQueues",
  ListMessageMoveTasks: "listMessageMoveTasks",
  ListQueues: "listQueues",
  ListQueueTags: "listQueueTags",
  PurgeQueue: "purgeQueue",
  ReceiveMessage: "receiveMessage",
  RemovePermission: "removePermission",
  SendMessage: "sendMessage",
  SendMessageBatch: "sendMessageBatch",
  SetQueueAttributes: "setQueueAttributes",
  StartMessageMoveTask: "startMessageMoveTask",
  TagQueue: "tagQueue",
  UntagQueue: "untagQueue",
});
assert.equal(sdk.quality?.testedVersion, sdk.package.version);
assert.deepEqual(sdk.quality?.unitTests, { passed: 6, total: 6, skipped: 0 });
assert.equal(sdk.quality?.e2eStatus, "passed");
assert.deepEqual(sdk.quality?.nodeVersions, ["20", "22"]);
assert.equal(sdk.quality?.sourceCommit, "5469d4b7d8154941bf292648561de57b6583d65f");
assert.equal(sdk.spec.metadataCommit, "6bb03db8f5483a098275cb2c8c3611134e2dfe4d");
assert.equal(provenance.import.sourceSha256, sourceHash);
assert.equal(provenance.license.sha256, licenseHash);
assert.equal(provenance.status, "published");
assert.deepEqual(provenance.sdk, {
  package: "@pontx/amazon-sqs",
  version: "0.1.4",
  registry: "https://registry.npmjs.org/@pontx/amazon-sqs/0.1.4",
  integrity: "sha512-9W4NWREUYT+tO5JoFzyhEuFThJME6tGdFaATlUuvlYc2a3+4stjyJHMOCzhPnDx+pig8XrcMGqidXKarHXNJOA==",
  shasum: "e2203aac75d4c7f81f450c8582477844621522b7",
  tarball: "https://registry.npmjs.org/@pontx/amazon-sqs/-/amazon-sqs-0.1.4.tgz",
  repository: "https://github.com/pontjs/amazon-sqs",
  sourceCommit: "5469d4b7d8154941bf292648561de57b6583d65f",
  mergedCommit: "5469d4b7d8154941bf292648561de57b6583d65f",
  workflowRun: "https://github.com/pontjs/amazon-sqs/actions/runs/31886381572",
  nodeVersions: ["20", "22"],
  verifiedAt: "2026-08-15",
});
assert.equal(provenance.outputs["zh-CN"].sha256, sha256(zhBytes));
assert.equal(provenance.outputs["en-US"].sha256, sha256(enBytes));

const source = JSON.parse(sourceBytes.toString("utf8"));
const serviceId = "com.amazonaws.sqs#AmazonSQS";
const service = source.shapes?.[serviceId];
assert.equal(source.smithy, "2.0");
assert.equal(service?.type, "service");
assert.equal(service?.operations?.length, 23);
assert.ok(service.traits?.["aws.protocols#awsJson1_0"]);
assert.ok(service.traits?.["aws.protocols#awsQueryCompatible"]);
assert.equal(service.traits?.["aws.auth#sigv4"]?.name, "sqs");
assert.ok(service.traits?.["smithy.rules#endpointRuleSet"]);

const imported = importSmithy(source, {
  serviceId,
  protocol: "aws-json-1.0",
  name: "amazon-sqs",
});
const zh = loadPontxSpec(zhBytes.toString("utf8"), { expectedName: "amazon-sqs" });
const en = loadPontxSpec(enBytes.toString("utf8"), { expectedName: "amazon-sqs" });
assert.deepEqual(validatePontxSpecLocale(zh, en), { valid: true, issues: [] }, "locale pair must differ only in approved prose");
assert.equal(zh.style, "RPC");
assert.deepEqual(zh.rpc, imported.rpc, "protocol and endpoint rules must remain source-exact");
assert.equal(zh.apis && Object.keys(zh.apis).length, 23);
assert.equal(Object.keys(zh.components.schemas).length, 114);
assert.deepEqual(zh.security, [{ awsSigV4: [] }]);
assert.equal(zh.components.securitySchemes.awsSigV4.scheme, "aws-sigv4");
assert.equal(zh.components.securitySchemes.awsSigV4.type, "http");
assert.equal(zh.servers?.[0]?.id, "aws-sqs-regional");
assert.equal(zh.servers?.[0]?.url, "https://sqs.{Region}.{PartitionResult#dnsSuffix}");

for (const [key, importedApi] of Object.entries(imported.apis)) {
  const api = zh.apis[key];
  const englishApi = en.apis[key];
  assert.ok(api, `missing imported action ${key}`);
  assert.equal(api.operationId, importedApi.operationId);
  assert.deepEqual(api.tags, [], `${api.operationId} must remain a flat SDK method`);
  assert.equal(Object.hasOwn(api, "method"), false, `${api.operationId} must not invent a REST method`);
  assert.equal(Object.hasOwn(api, "path"), false, `${api.operationId} must not invent a REST path`);
  assert.deepEqual(api.parameters, importedApi.parameters, `${api.operationId} input shape drifted`);
  assert.deepEqual(api.responses["200"].schema, importedApi.responses.success.schema, `${api.operationId} success schema drifted`);
  assert.deepEqual(api.responses.error, importedApi.responses.error, `${api.operationId} error union drifted`);
  assert.equal(api.rpc.action, importedApi.operationId);
  assert.equal(api.rpc.method, "POST");
  assert.equal(api.rpc.contentType, "application/x-amz-json-1.0");
  assert.equal(Object.hasOwn(api.metadata, "execution"), false, `${api.operationId} must not carry an endpoint execution disablement policy`);
  assert.deepEqual(api.metadata.documentation.evidence, [
    sourceUrl,
    `${apiReference}API_${api.operationId}.html`,
    "https://docs.aws.amazon.com/AWSSimpleQueueService/latest/SQSDeveloperGuide/sqs-authentication-and-access-control.html",
  ]);
  assert.equal(api.requestExamples.default.expectedStatus, "200");
  assert.ok(api.requestExamples.default.request.body && typeof api.requestExamples.default.request.body === "object");
  const requestSchemaRef = api.parameters?.[0]?.schema?.genericRef?.$ref;
  const requestSchemaName = requestSchemaRef?.split("/").at(-1);
  const required = zh.components.schemas[requestSchemaName]?.required || [];
  for (const field of required) {
    assert.ok(Object.hasOwn(api.requestExamples.default.request.body, field), `${api.operationId} example misses required input ${field}`);
  }
  assert.equal(englishApi.description, importedApi.description, `${api.operationId} English source prose drifted`);
  assert.ok(api.description.includes(importedApi.description || ""), `${api.operationId} Chinese copy must retain exact official English detail`);
}

assert.deepEqual(zh.components.schemas, imported.components.schemas, "all 114 imported schemas must remain structurally source-exact");
assert.deepEqual(en.components.schemas, imported.components.schemas, "English schemas must remain structurally source-exact");
const outputStrings = collectStrings({ product, zh, en, sdk, provenance });
for (const value of outputStrings) {
  assert.equal(/AKIA[0-9A-Z]{16}/.test(value), false, "metadata must not contain an AWS access-key value");
  assert.equal(/aws_secret_access_key\s*=\s*[^\s]+/i.test(value), false, "metadata must not contain a secret value");
}
for (const value of safeExampleValues) assert.ok(outputStrings.includes(value));

console.log("Amazon SQS product verification passed: 23/23 actions, 114/114 schemas, RPC protocol fidelity, bilingual parity, safe examples, no endpoint disablement policy, and immutable provenance.");
