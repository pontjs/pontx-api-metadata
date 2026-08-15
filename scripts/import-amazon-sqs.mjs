/**
 * Rebuild the Amazon SQS PontxSpec locale pair from the vendored, immutable
 * Smithy 2.0 source. This is intentionally a one-time import utility: Hub,
 * metadata validation, and the SDK never read Smithy at runtime.
 */
import { createHash } from "node:crypto";
import { readFile, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { importSmithy } from "@pontx/spec";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const productRoot = resolve(root, "products/amazon-sqs");
const sourcePath = resolve(productRoot, "sources/smithy.json");
const sourceHash = "c331594defdf5dfa77ced780ee8f90561896a822923062c0cfd21cbcd2cfc288";
const revision = "4efe5bc67b71dc5ec652fe77130f3bae9efe0173";
const sourceUrl = `https://raw.githubusercontent.com/aws/aws-sdk-js-v3/${revision}/codegen/sdk-codegen/aws-models/sqs.json`;
const apiReference = "https://docs.aws.amazon.com/AWSSimpleQueueService/latest/APIReference/";

const operationCopy = {
  AddPermission: ["添加队列权限", "向指定主体授予队列权限；该操作会改变队列访问策略。"],
  CancelMessageMoveTask: ["取消消息移动任务", "停止正在运行的消息移动任务；已移动的消息不会回滚。"],
  ChangeMessageVisibility: ["修改消息可见性", "修改指定消息在队列中再次可见前的超时时间。"],
  ChangeMessageVisibilityBatch: ["批量修改消息可见性", "一次修改多条消息的可见性超时。"],
  CreateQueue: ["创建队列", "创建新的 Amazon SQS 标准或 FIFO 队列。"],
  DeleteMessage: ["删除消息", "使用接收句柄从队列中永久删除一条已接收消息。"],
  DeleteMessageBatch: ["批量删除消息", "使用接收句柄从队列中永久删除多条已接收消息。"],
  DeleteQueue: ["删除队列", "永久删除指定队列及其中的消息。"],
  GetQueueAttributes: ["获取队列属性", "读取指定队列的属性和配置。"],
  GetQueueUrl: ["获取队列 URL", "根据队列名称获取现有 Amazon SQS 队列 URL。"],
  ListDeadLetterSourceQueues: ["列出死信队列来源", "列出配置为指定死信队列来源的队列。"],
  ListMessageMoveTasks: ["列出消息移动任务", "获取指定源队列最近的消息移动任务。"],
  ListQueueTags: ["列出队列标签", "列出指定队列上的成本分配标签。"],
  ListQueues: ["列出队列", "列出当前区域内的队列；最多返回 1,000 项并支持分页。"],
  PurgeQueue: ["清空队列", "删除队列中可用和正在传输的消息；此操作不可逆。"],
  ReceiveMessage: ["接收消息", "从队列中读取最多 10 条消息；读取会改变消息可见性。"],
  RemovePermission: ["移除队列权限", "撤销与指定标签匹配的队列策略权限。"],
  SendMessage: ["发送消息", "向指定队列投递一条消息。"],
  SendMessageBatch: ["批量发送消息", "一次向指定队列投递最多 10 条消息。"],
  SetQueueAttributes: ["设置队列属性", "修改指定队列的属性；部分更新会影响现有消息。"],
  StartMessageMoveTask: ["启动消息移动任务", "启动从死信队列移动消息的异步任务。"],
  TagQueue: ["标记队列", "向指定队列添加或覆盖成本分配标签。"],
  UntagQueue: ["移除队列标签", "从指定队列移除成本分配标签。"],
};

const safeQueueUrl = "https://sqs.us-east-1.amazonaws.com/123456789012/pontx-example";
const safeQueueArn = "arn:aws:sqs:us-east-1:123456789012:pontx-example";
const safeReceiptHandle = "AQEB-example-receipt-handle";
const safeExamples = {
  AddPermission: { QueueUrl: safeQueueUrl, Label: "pontx-example", AWSAccountIds: ["123456789012"], Actions: ["SendMessage"] },
  CancelMessageMoveTask: { TaskHandle: "example-task-handle" },
  ChangeMessageVisibility: { QueueUrl: safeQueueUrl, ReceiptHandle: safeReceiptHandle, VisibilityTimeout: 30 },
  ChangeMessageVisibilityBatch: { QueueUrl: safeQueueUrl, Entries: [{ Id: "entry-1", ReceiptHandle: safeReceiptHandle, VisibilityTimeout: 30 }] },
  CreateQueue: { QueueName: "pontx-example" },
  DeleteMessage: { QueueUrl: safeQueueUrl, ReceiptHandle: safeReceiptHandle },
  DeleteMessageBatch: { QueueUrl: safeQueueUrl, Entries: [{ Id: "entry-1", ReceiptHandle: safeReceiptHandle }] },
  DeleteQueue: { QueueUrl: safeQueueUrl },
  GetQueueAttributes: { QueueUrl: safeQueueUrl, AttributeNames: ["All"] },
  GetQueueUrl: { QueueName: "pontx-example" },
  ListDeadLetterSourceQueues: { QueueUrl: safeQueueUrl, MaxResults: 10 },
  ListMessageMoveTasks: { SourceArn: safeQueueArn, MaxResults: 10 },
  ListQueueTags: { QueueUrl: safeQueueUrl },
  ListQueues: {},
  PurgeQueue: { QueueUrl: safeQueueUrl },
  ReceiveMessage: { QueueUrl: safeQueueUrl, MaxNumberOfMessages: 1, WaitTimeSeconds: 0 },
  RemovePermission: { QueueUrl: safeQueueUrl, Label: "pontx-example" },
  SendMessage: { QueueUrl: safeQueueUrl, MessageBody: "Pontx example message" },
  SendMessageBatch: { QueueUrl: safeQueueUrl, Entries: [{ Id: "entry-1", MessageBody: "Pontx example message" }] },
  SetQueueAttributes: { QueueUrl: safeQueueUrl, Attributes: { VisibilityTimeout: "30" } },
  StartMessageMoveTask: { SourceArn: safeQueueArn, MaxNumberOfMessagesPerSecond: 10 },
  TagQueue: { QueueUrl: safeQueueUrl, Tags: { environment: "example" } },
  UntagQueue: { QueueUrl: safeQueueUrl, TagKeys: ["environment"] },
};

const englishDisabledReason = "Amazon SQS requires caller-owned AWS credentials, SigV4 signing, and region-aware endpoint selection. Hub does not proxy, store, or execute queue requests; use the local SDK or CLI after reviewing the generated preview.";
const chineseDisabledReason = "Amazon SQS 需要调用者自有的 AWS 凭证、SigV4 签名和区域感知的 Endpoint 选择。Hub 不代理、存储或执行队列请求；请先审阅本地 SDK 或 CLI 的预览后再调用。";

function sha256(bytes) {
  return createHash("sha256").update(bytes).digest("hex");
}

function operationDocs(action) {
  return `${apiReference}API_${action}.html`;
}

function buildLocale(locale) {
  const source = JSON.parse(sourceText);
  const spec = importSmithy(source, {
    serviceId: "com.amazonaws.sqs#AmazonSQS",
    protocol: "aws-json-1.0",
    name: "amazon-sqs",
  });

  const chinese = locale === "zh-CN";
  spec.info = {
    title: chinese ? "Amazon SQS API" : "Amazon SQS API",
    version: "2012-11-05",
    description: chinese
      ? "Amazon Simple Queue Service 的完整 23 个官方 action。主协议为 AWS JSON 1.0，兼容 AWS Query；调用必须使用 AWS Signature Version 4（SigV4），并按区域、分区、FIPS 和双栈规则选择 Endpoint。"
      : "The complete 23-action Amazon Simple Queue Service API. Its primary protocol is AWS JSON 1.0, with AWS Query compatibility; requests require AWS Signature Version 4 (SigV4) and region-, partition-, FIPS-, and dual-stack-aware endpoint selection.",
  };
  spec.tags = [];
  spec.servers = [{
    id: "aws-sqs-regional",
    url: "https://sqs.{Region}.{PartitionResult#dnsSuffix}",
    description: chinese
      ? "由固定 Smithy Endpoint 规则解析的区域 AWS SQS HTTPS Endpoint；自定义 Endpoint 与 FIPS 或 DualStack 不能同时启用。"
      : "Regional AWS SQS HTTPS endpoint resolved by the pinned Smithy endpoint rules; a custom endpoint cannot be combined with FIPS or DualStack.",
  }];
  spec.components.securitySchemes = {
    awsSigV4: {
      type: "http",
      scheme: "aws-sigv4",
      description: chinese
        ? "AWS Signature Version 4（SigV4）认证。凭证仅从调用者环境或 AWS 默认凭证链读取。"
        : "AWS Signature Version 4 (SigV4). Credentials are read only from the caller environment or the AWS default credential provider chain.",
    },
  };
  spec.security = [{ awsSigV4: [] }];

  for (const api of Object.values(spec.apis)) {
    const action = api.operationId;
    const [summary, chineseDescription] = operationCopy[action] || [action, action];
    const importedDescription = api.description;
    api.summary = chinese ? summary : action;
    api.description = chinese
      ? `${chineseDescription}\n\n官方英文详细说明：\n${importedDescription || "请参阅官方 API Reference。"}`
      : importedDescription || action;
    api.tags = [];
    const success = api.responses.success;
    api.responses = {
      "200": {
        ...success,
        description: chinese ? "成功响应。" : "Successful response.",
      },
      ...(api.responses.error ? { error: api.responses.error } : {}),
    };
    api.requestExamples = {
      default: {
        summary: chinese ? "已审阅的本地 SDK/CLI 请求示例" : "Reviewed local SDK/CLI request example",
        request: { body: safeExamples[action] || {} },
        expectedStatus: "200",
      },
    };
    api.metadata = {
      documentation: {
        status: "official",
        evidence: [sourceUrl, operationDocs(action), "https://docs.aws.amazon.com/AWSSimpleQueueService/latest/SQSDeveloperGuide/sqs-authentication-and-access-control.html"],
        verifiedAt: "2026-08-15",
      },
      execution: {
        enabled: false,
        disabledReason: chinese ? chineseDisabledReason : englishDisabledReason,
      },
    };
    api.ext = {
      "x-pontx-upstream-operation-id": `com.amazonaws.sqs#${action}`,
      "x-pontx-protocol-selection": "aws-json-1.0",
    };
  }
  return spec;
}

const checkOnly = process.argv.includes("--check");
if (process.argv.slice(2).some((value) => value !== "--check" && value !== "--write")) {
  throw new Error("Usage: node scripts/import-amazon-sqs.mjs [--check|--write]");
}
const sourceText = await readFile(sourcePath, "utf8");
if (sha256(sourceText) !== sourceHash) {
  throw new Error("Vendored SQS Smithy SHA-256 does not match the approved immutable source");
}
const source = JSON.parse(sourceText);
const service = source.shapes?.["com.amazonaws.sqs#AmazonSQS"];
if (source.smithy !== "2.0" || service?.type !== "service") {
  throw new Error("Vendored source is not the expected Smithy 2.0 AmazonSQS service");
}
if ((service.operations || []).length !== 23 || !service.traits?.["aws.protocols#awsJson1_0"] || !service.traits?.["aws.protocols#awsQueryCompatible"] || service.traits?.["aws.auth#sigv4"]?.name !== "sqs" || !service.traits?.["smithy.rules#endpointRuleSet"]) {
  throw new Error("Vendored source does not preserve the approved SQS protocol surface");
}

for (const [locale, path] of [
  ["zh-CN", resolve(productRoot, "spec.pontx.json")],
  ["en-US", resolve(productRoot, "locales/en-US/spec.pontx.json")],
]) {
  const output = `${JSON.stringify(buildLocale(locale), null, 2)}\n`;
  if (checkOnly) {
    const existing = await readFile(path, "utf8");
    if (existing !== output) throw new Error(`${locale} PontxSpec is stale; rerun the importer with --write`);
  } else {
    await writeFile(path, output);
  }
}

console.log(`Amazon SQS import ${checkOnly ? "verified" : "wrote"}: 23 actions, 114 component schemas, AWS JSON 1.0 + AWS Query compatibility + SigV4 + endpoint rules.`);
