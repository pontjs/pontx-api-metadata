import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const revision = "325f3b157f7250f2a5d228b870d77bb63fc7e54c";
const sourceUrl =
  `https://raw.githubusercontent.com/stripe/openapi/${revision}/openapi/spec3.json`;
const licenseUrl = `https://github.com/stripe/openapi/blob/${revision}/LICENSE`;
const expectedSourceSha256 =
  "3653ad45bbec54fcbe461c541c908355b715018bdf455a0e11b27bedb2cbdee5";
const expectedLicenseSha256 =
  "8c1ce883f4eee7b531e0b7872dbfc72d410ced87dfff9501305de05ca8d203e5";
const verifiedAt = "2026-08-15";
const methods = new Set(["get", "put", "post", "delete", "patch", "head", "options", "trace"]);

const zhTranslations = [
  "<p>列出所有验证报告。</p>",
  "用于关联该用户的字符串。可填写客户 ID、会话 ID 或类似标识，以便将本次验证与内部系统中的记录对应起来。",
  "仅返回在指定日期区间内创建的 VerificationReport。",
  "分页游标。`ending_before` 是用于确定列表位置的对象 ID。例如，列表请求返回 100 个对象且第一个为 `obj_bar` 时，后续请求可传入 `ending_before=obj_bar` 获取上一页。",
  "指定需要在响应中展开的字段。",
  "限制返回对象的数量。取值范围为 1 到 100，默认值为 10。",
  "分页游标。`starting_after` 是用于确定列表位置的对象 ID。例如，列表请求返回 100 个对象且最后一个为 `obj_foo` 时，后续请求可传入 `starting_after=obj_foo` 获取下一页。",
  "仅返回此类型的 VerificationReport。",
  "仅返回由此 VerificationSession ID 创建的 VerificationReport；也允许提供 VerificationIntent ID。",
  "如果此列表之后还有可获取的下一页条目，则为 true。",
  "表示对象类型的字符串。同一类型的对象具有相同值；此处始终为 `list`。",
  "可访问此列表的 URL。",
  "请求成功。",
  "错误响应。",
  "列出验证报告",
  "<p>获取已有的 VerificationReport。</p>",
  "获取验证报告",
  "<p>返回 VerificationSession 列表。</p>",
  "仅返回在指定日期区间内创建的 VerificationSession。",
  "客户 ID。",
  "代表客户的 Account ID。",
  "仅返回具有此状态的 VerificationSession。[了解会话生命周期](https://docs.stripe.com/identity/how-sessions-work)。",
  "列出验证会话",
  "<p>创建 VerificationSession 对象。</p>\n\n<p>创建 VerificationSession 后，请使用会话的 <code>client_secret</code> 显示验证弹窗，或将用户跳转到会话的 <code>url</code>。</p>\n\n<p>如果 API Key 处于测试模式，验证检查不会真正处理，但其他流程会按实时模式执行。</p>\n\n<p>相关指南：<a href=\"https://docs.stripe.com/identity/verify-identity-documents\">验证用户的身份证件</a></p>",
  "可附加到对象上的一组[键值对](https://docs.stripe.com/api/metadata)，适合以结构化形式保存对象的附加信息。提交空值可删除单个键；向 `metadata` 提交空值可删除全部键。",
  "会话验证检查的一组选项。",
  "被验证用户提供的详细信息。这些信息可能会向用户显示。",
  "引用 Person 资源及其关联账户的令牌。",
  "用户完成验证流程后将跳转到的 URL。",
  "要执行的[验证检查](https://docs.stripe.com/identity/verification-checks)类型。未传 `verification_flow` 时必须提供 `type`。",
  "Dashboard 中验证流程的 ID。参见 https://docs.stripe.com/identity/verification-flows。",
  "创建验证会话",
  "<p>获取此前创建的 VerificationSession 详情。</p>\n\n<p>当会话状态为 <code>requires_input</code> 时，可通过此接口获取有效的 <code>client_secret</code> 或 <code>url</code>，以允许用户重新提交。</p>",
  "获取验证会话",
  "<p>更新 VerificationSession 对象。</p>\n\n<p>当会话状态为 <code>requires_input</code> 时，可通过此接口更新验证检查和选项。</p>",
  "被验证用户提供的详细信息。这些信息可能会向用户显示。",
  "要执行的[验证检查](https://docs.stripe.com/identity/verification-checks)类型。",
  "更新验证会话",
  "<p>当 VerificationSession 处于 <code>requires_input</code> <a href=\"https://docs.stripe.com/identity/how-sessions-work\">状态</a>时，可以取消。</p>\n\n<p>取消后将禁止未来的提交尝试，且无法撤销。<a href=\"https://docs.stripe.com/identity/verification-sessions#cancel\">了解更多</a>。</p>",
  "取消验证会话",
  "<p>编辑 VerificationSession，以从 Stripe 删除所有已收集的信息。此操作会编辑 VerificationSession 及其所有关联对象，包括 VerificationReport、Event 和请求日志等。</p>\n\n<p>VerificationSession 处于 <code>requires_input</code> 或 <code>verified</code> <a href=\"https://docs.stripe.com/identity/how-sessions-work\">状态</a>时可以编辑；编辑处于 <code>requires_action</code> 状态的会话会自动取消该会话。</p>\n\n<p>编辑过程最长可能需要四天。处理期间，VerificationSession 的 <code>redaction.status</code> 为 <code>processing</code>；完成后将变为 <code>redacted</code>，并发出 <code>identity.verification_session.redacted</code> 事件。</p>\n\n<p>编辑操作不可逆。编辑后的对象仍可通过 Stripe API 访问，但包含个人数据的字段会替换为 <code>[redacted]</code> 或类似占位符，<code>metadata</code> 字段也会被清除。编辑后的对象不能再更新或用于任何用途。</p>\n\n<p><a href=\"https://docs.stripe.com/identity/verification-sessions#redact\">了解更多</a>。</p>",
  "编辑验证会话",
  "VerificationReport 是一次收集并验证用户数据尝试的结果。执行哪些验证检查由 `type` 和 `options` 参数决定；每项检查的结果位于对应的 `document`、`id_number`、`selfie` 子资源中。\n\n每个 VerificationReport 都包含所收集用户数据的副本，以及可通过 [FileUpload](https://docs.stripe.com/api/files) API 访问所收集图像的引用 ID。请使用 [VerificationSession](https://docs.stripe.com/api/identity/verification_sessions) API 配置并创建 VerificationReport。\n\n相关指南：[访问验证结果](https://docs.stripe.com/identity/verification-sessions#results)。",
  "对象创建时间，以 Unix 纪元起的秒数表示。",
  "对象的唯一标识符。",
  "对象存在于实时模式时为 `true`；存在于测试模式时为 `false`。",
  "表示对象类型的字符串。同一类型的对象具有相同值。",
  "报告类型。",
  "Dashboard 中验证流程的配置令牌。",
  "创建此报告的 VerificationSession ID。",
  "VerificationSession 引导你收集并验证用户身份，其中包含验证类型和要执行的[验证检查](https://docs.stripe.com/identity/verification-checks)等信息。系统中的每次验证只应创建一个 VerificationSession。\n\nVerificationSession 在验证流程中会经历[多个状态](https://docs.stripe.com/identity/how-sessions-work)。验证检查完成后，会话中包含用户的已验证数据。\n\n相关指南：[Verification Sessions API](https://docs.stripe.com/identity/verification-sessions)。",
  "Stripe.js 用于在应用内[显示验证弹窗](https://docs.stripe.com/js/identity/modal)的短期客户端密钥。该密钥 24 小时后过期且只能使用一次。不要存储或记录它，不要嵌入 URL，也不要暴露给被验证用户以外的任何人。包含该密钥的页面必须启用 TLS。参见[将客户端密钥传递到前端](https://docs.stripe.com/identity/verification-sessions#client-secret)。",
  "如果存在，表示处理验证时最后遇到的错误。",
  "最近一次 VerificationReport 的 ID。[了解如何访问详细验证结果](https://docs.stripe.com/identity/verification-sessions#results)。",
  "可附加到对象上的一组[键值对](https://docs.stripe.com/api/metadata)，适合以结构化形式保存对象的附加信息。",
  "此 VerificationSession 的编辑状态。会话未被编辑时该字段为 null。",
  "此 VerificationSession 的状态。[了解会话生命周期](https://docs.stripe.com/identity/how-sessions-work)。",
  "用于将用户重定向到 Stripe 并提交身份信息的短期 URL。该 URL 48 小时后过期且只能使用一次。不要存储或记录它，不要通过电子邮件发送，也不要暴露给被验证用户以外的任何人。参见[验证身份证件](https://docs.stripe.com/identity/verify-identity-documents?platform=web&type=redirect)。",
  "用户的已验证数据。",
  "证件检查结果。",
  "证件上显示的地址。",
  "证件上显示的出生日期。",
  "验证错误详情；当状态为 `unverified` 时存在。",
  "证件有效期。",
  "包含此证件图像的 [File](https://docs.stripe.com/api/files) ID 数组。",
  "证件上显示的名。",
  "证件签发日期。",
  "证件签发国家或地区。",
  "证件上显示的姓。",
  "证件号码。",
  "证件中人员的性别。",
  "此 `document` 检查的状态。",
  "证件类型。",
  "证件上显示的出生地。",
  "证件上显示的性别原文。",
  "电子邮件检查结果。",
  "要验证的电子邮箱。",
  "此 `email` 检查的状态。",
  "身份号码检查结果。",
  "出生日期。",
  "名。",
  "身份号码。当 `id_number_type` 为 `us_ssn` 时，仅返回末 4 位。",
  "身份号码类型。",
  "姓。",
  "此 `id_number` 检查的状态。",
  "电话号码检查结果。",
  "要验证的电话号码。",
  "此 `phone` 检查的状态。",
  "自拍检查结果。",
  "保存本次检查所用身份证件图像的 [File](https://docs.stripe.com/api/files) ID。",
  "保存本次检查所用自拍图像的 [File](https://docs.stripe.com/api/files) ID。",
  "此 `selfie` 检查的状态。",
  "显示最近一次 VerificationSession 错误。",
  "说明验证或用户会话失败原因的简短机器可读字符串。",
  "说明验证或用户会话失败原因的消息。",
  "被验证用户的电子邮箱。",
  "被验证用户的电话号码。",
  "指示此对象及其关联对象是否已被编辑。",
  "引用相关 Person 资源所关联 Account 的令牌。",
  "引用相关 Person 资源的令牌。",
  "用户已验证的地址。",
  "用户已验证的出生日期。",
  "用户已验证的电子邮箱。",
  "用户已验证的名。",
  "用户已验证的身份号码。",
  "用户已验证的身份号码类型。",
  "用户已验证的姓。",
  "用户已验证的电话号码。",
  "用户已验证的性别。",
  "用户已验证的、与证件原文一致的出生地。",
  "用户已验证的、与证件原文一致的性别。",
  "城市、行政区、郊区、城镇或村庄。",
  "两字母国家或地区代码（[ISO 3166-1 alpha-2](https://en.wikipedia.org/wiki/ISO_3166-1_alpha-2)）。",
  "地址第一行，例如街道、邮政信箱或公司名称。",
  "地址第二行，例如公寓、套房、单元或建筑。",
  "邮政编码。",
  "州、县、省或地区（[ISO 3166-2](https://en.wikipedia.org/wiki/ISO_3166-2)）。",
  "时间点。",
  "1 到 31 之间的日数值。",
  "1 到 12 之间的月数值。",
  "四位数年份。",
  "说明验证失败原因的简短机器可读字符串。",
  "说明失败原因的可读消息；这些消息可以显示给用户。",
  "允许的身份证件类型字符串数组。如果提供的证件不在允许范围内，验证检查将以 `document_type_not_allowed` 错误码失败。",
  "收集身份号码，并使用从证件提取的姓名和出生日期执行[身份号码检查](https://docs.stripe.com/identity/verification-checks?type=id-number)。",
  "禁用图像上传；身份证件图像必须使用设备摄像头拍摄。",
  "拍摄人脸图像并执行[自拍检查](https://docs.stripe.com/identity/verification-checks?type=selfie)，比较带照片的身份证件与用户面部照片。[了解更多](https://docs.stripe.com/identity/selfie)。",
  "请求对 `provided_details.email` 进行一次性密码验证。",
  "要应用的出生日期匹配策略严格程度。",
  "要应用的姓名匹配策略严格程度。",
  "请求对 `provided_details.phone` 进行一次性密码验证。"
];

function fail(message) {
  throw new Error(message);
}

function sha256(file) {
  return crypto.createHash("sha256").update(fs.readFileSync(file)).digest("hex");
}

function valueAfter(flag) {
  const index = process.argv.indexOf(flag);
  return index >= 0 ? process.argv[index + 1] : undefined;
}

function clone(value) {
  return structuredClone(value);
}

function normalizeDocLinks(value) {
  if (typeof value !== "string") return value;
  return value
    .replaceAll('href="/docs/', 'href="https://docs.stripe.com/')
    .replaceAll("](/docs/", "](https://docs.stripe.com/");
}

function walk(value, visitor, segments = []) {
  if (Array.isArray(value)) {
    value.forEach((item, index) => walk(item, visitor, [...segments, index]));
    return;
  }
  if (!value || typeof value !== "object") return;
  for (const [key, child] of Object.entries(value)) {
    visitor(value, key, child, [...segments, key]);
    walk(child, visitor, [...segments, key]);
  }
}

function stripEmptyProseAndNormalizeLinks(value) {
  walk(value, (parent, key, child) => {
    if (["description", "summary"].includes(key) && typeof child === "string") {
      if (!child.trim()) delete parent[key];
      else parent[key] = normalizeDocLinks(child);
    }
  });
  return value;
}

function collectUniqueProse(value) {
  const texts = [];
  const seen = new Set();
  walk(value, (_parent, key, child) => {
    if (!["description", "summary"].includes(key) || typeof child !== "string") return;
    if (!seen.has(child)) {
      seen.add(child);
      texts.push(child);
    }
  });
  return texts;
}

function translateOriginalProse(value, englishTexts) {
  const translations = new Map(englishTexts.map((text, index) => [text, zhTranslations[index]]));
  walk(value, (parent, key, child) => {
    if (!["description", "summary"].includes(key) || typeof child !== "string") return;
    const translated = translations.get(child);
    if (!translated) fail(`missing zh-CN translation for ${child}`);
    parent[key] = translated;
  });
}

function collectSchemaClosure(source, selectedPaths) {
  const names = new Set();
  const pending = [];
  const collectRefs = (value) => {
    walk(value, (_parent, key, child) => {
      if (key !== "$ref" || typeof child !== "string") return;
      if (!child.startsWith("#/components/schemas/")) {
        fail(`unsupported non-schema reference in Stripe Identity boundary: ${child}`);
      }
      const name = decodeURIComponent(child.slice("#/components/schemas/".length));
      if (name !== "error") pending.push(name);
    });
  };
  collectRefs(selectedPaths);
  for (let index = 0; index < pending.length; index += 1) {
    const name = pending[index];
    if (names.has(name)) continue;
    const schema = source.components?.schemas?.[name];
    if (!schema) fail(`missing upstream schema ${name}`);
    names.add(name);
    collectRefs(schema);
  }
  return Object.fromEntries([...names].map((name) => [name, clone(source.components.schemas[name])]));
}

function replaceErrorReferences(value) {
  walk(value, (parent, key, child) => {
    if (key === "$ref" && child === "#/components/schemas/error") {
      parent[key] = "#/components/schemas/stripe_error";
    }
  });
}

function normalizeSchemaIdentifiers(schemas, value) {
  const renames = new Map([
    ["identity.verification_report", "stripe_identity_verification_report"],
    ["identity.verification_session", "stripe_identity_verification_session"]
  ]);
  for (const [upstreamName, generatedName] of renames) {
    if (!schemas[upstreamName]) fail(`missing upstream schema requiring identifier normalization: ${upstreamName}`);
    if (schemas[generatedName]) fail(`normalized schema identifier collides with upstream schema: ${generatedName}`);
    schemas[generatedName] = schemas[upstreamName];
    delete schemas[upstreamName];
  }
  walk(value, (parent, key, child) => {
    if (key !== "$ref" || typeof child !== "string") return;
    const prefix = "#/components/schemas/";
    if (!child.startsWith(prefix)) return;
    const renamed = renames.get(child.slice(prefix.length));
    if (renamed) parent[key] = `${prefix}${renamed}`;
  });
}

function normalizeOptionalInlineRequiredSchema(value) {
  const operation = value.paths?.["/v1/identity/verification_sessions"]?.post;
  const bodySchema = operation?.requestBody?.content?.["application/x-www-form-urlencoded"]?.schema;
  const relatedPerson = bodySchema?.properties?.related_person;
  if (relatedPerson?.type !== "object" ||
    JSON.stringify(relatedPerson.required) !== JSON.stringify(["account", "person"]) ||
    bodySchema.required?.includes("related_person")) {
    fail("Stripe optional related_person request shape drifted");
  }
  const name = "stripe_identity_related_person_param";
  if (value.schemas[name]) fail(`normalized request schema identifier collides: ${name}`);
  value.schemas[name] = relatedPerson;
  bodySchema.properties.related_person = { $ref: `#/components/schemas/${name}` };
}

function makeErrorSchemas(locale) {
  const zh = locale === "zh-CN";
  return {
    stripe_error: {
      type: "object",
      required: ["error"],
      description: zh ? "Stripe API 错误响应。" : "An error response from the Stripe API.",
      properties: {
        error: { $ref: "#/components/schemas/stripe_api_error" }
      }
    },
    stripe_api_error: {
      type: "object",
      required: ["type"],
      additionalProperties: true,
      description: zh
        ? "Stripe Identity 请求的通用错误详情；保留 Identity 相关公共字段，并允许 Stripe 返回其他附加字段。"
        : "Common Stripe Identity error details. Identity-relevant public fields are modeled while additional Stripe fields remain allowed.",
      properties: {
        code: {
          type: "string",
          maxLength: 5000,
          description: zh ? "可供程序处理的 Stripe 错误码。" : "A Stripe error code that can be handled programmatically."
        },
        doc_url: {
          type: "string",
          maxLength: 5000,
          description: zh ? "与错误码相关的官方文档 URL。" : "An official documentation URL for the reported error code."
        },
        message: {
          type: "string",
          maxLength: 40000,
          description: zh ? "说明错误详情的可读消息。" : "A human-readable message with more details about the error."
        },
        param: {
          type: "string",
          maxLength: 5000,
          description: zh ? "发生参数错误时，与错误相关的参数名。" : "For a parameter-specific error, the related parameter name."
        },
        request_log_url: {
          type: "string",
          maxLength: 5000,
          description: zh ? "Stripe Dashboard 中对应请求日志的 URL。" : "A URL to the request log entry in the Stripe Dashboard."
        },
        type: {
          type: "string",
          enum: ["api_error", "card_error", "idempotency_error", "invalid_request_error"],
          description: zh ? "Stripe 返回的错误类型。" : "The type of error returned by Stripe."
        }
      }
    }
  };
}

const examples = {
  getIdentityVerificationReports: {
    request: { path: {}, query: { limit: 10 }, headers: {} },
    expectedStatus: "200"
  },
  getIdentityVerificationReportsReport: {
    request: { path: {}, query: {}, headers: {} },
    expectedStatus: "200",
    unresolved: [{
      in: "path",
      name: "report",
      source: { kind: "operation", operationId: "getIdentityVerificationReports" }
    }]
  },
  getIdentityVerificationSessions: {
    request: { path: {}, query: { limit: 10 }, headers: {} },
    expectedStatus: "200"
  },
  postIdentityVerificationSessions: {
    request: { path: {}, query: {}, headers: {}, body: { type: "document" } },
    expectedStatus: "200"
  },
  getIdentityVerificationSessionsSession: {
    request: { path: {}, query: {}, headers: {} },
    expectedStatus: "200",
    unresolved: [{
      in: "path",
      name: "session",
      source: { kind: "operation", operationId: "postIdentityVerificationSessions" }
    }]
  },
  postIdentityVerificationSessionsSession: {
    request: { path: {}, query: {}, headers: {}, body: { type: "document" } },
    expectedStatus: "200",
    unresolved: [{
      in: "path",
      name: "session",
      source: { kind: "operation", operationId: "postIdentityVerificationSessions" }
    }]
  },
  postIdentityVerificationSessionsSessionCancel: {
    request: { path: {}, query: {}, headers: {}, body: {} },
    expectedStatus: "200",
    unresolved: [{
      in: "path",
      name: "session",
      source: { kind: "operation", operationId: "postIdentityVerificationSessions" }
    }]
  },
  postIdentityVerificationSessionsSessionRedact: {
    request: { path: {}, query: {}, headers: {}, body: {} },
    expectedStatus: "200",
    unresolved: [{
      in: "path",
      name: "session",
      source: { kind: "operation", operationId: "postIdentityVerificationSessions" }
    }]
  }
};

function buildDocument(source, locale) {
  const selectedPaths = Object.fromEntries(
    Object.entries(source.paths ?? {})
      .filter(([pathname]) => pathname.startsWith("/v1/identity/"))
      .map(([pathname, pathItem]) => [pathname, clone(pathItem)])
  );
  const schemas = collectSchemaClosure(source, selectedPaths);
  const original = stripEmptyProseAndNormalizeLinks({ paths: selectedPaths, schemas });
  const englishTexts = collectUniqueProse(original);
  if (englishTexts.length !== 131 || zhTranslations.length !== englishTexts.length) {
    fail(`Stripe Identity prose inventory drifted: ${englishTexts.length} English / ${zhTranslations.length} Chinese`);
  }
  if (locale === "zh-CN") translateOriginalProse(original, englishTexts);
  replaceErrorReferences(original);
  normalizeSchemaIdentifiers(original.schemas, original);
  normalizeOptionalInlineRequiredSchema(original);

  const zh = locale === "zh-CN";
  const document = {
    openapi: "3.0.0",
    info: {
      title: zh ? "Stripe Identity 身份验证 API" : "Stripe Identity API",
      description: zh
        ? "创建、查询、更新、取消和编辑 Stripe Identity 验证会话，并查询验证报告。所有请求均由本地 SDK/CLI 直接发送到 Stripe；Pontx Hub 不代理或保存身份数据。"
        : "Create, retrieve, update, cancel, and redact Stripe Identity verification sessions, and retrieve verification reports. Requests are sent directly to Stripe by the local SDK/CLI; Pontx Hub does not proxy or store identity data.",
      version: source.info.version,
      termsOfService: source.info.termsOfService,
      contact: clone(source.info.contact),
      license: { name: "MIT", url: licenseUrl }
    },
    externalDocs: {
      description: zh ? "Stripe Identity 官方文档" : "Official Stripe Identity documentation",
      url: "https://docs.stripe.com/identity"
    },
    servers: [{ url: "https://api.stripe.com", description: zh ? "Stripe 官方 API 入口" : "Official Stripe API endpoint" }],
    security: clone(source.security),
    paths: original.paths,
    components: {
      securitySchemes: clone(source.components.securitySchemes),
      schemas: { ...original.schemas, ...makeErrorSchemas(locale) }
    }
  };

  const disabledReason = zh
    ? "包含身份证件、自拍、身份号码、电子邮箱、电话号码和验证结果等高敏感个人数据；Hub 禁止代理，请仅在受控本地环境中使用自己的 Stripe 密钥调用。"
    : "Contains highly sensitive personal data including identity documents, selfies, ID numbers, email addresses, phone numbers, and verification results. Hub proxying is disabled; call only from a controlled local environment with your own Stripe key.";
  const evidence = [
    sourceUrl,
    "https://docs.stripe.com/identity",
    "https://docs.stripe.com/api/identity",
    licenseUrl
  ];
  let operationCount = 0;
  for (const [pathname, pathItem] of Object.entries(document.paths)) {
    for (const [method, operation] of Object.entries(pathItem)) {
      if (!methods.has(method)) continue;
      operationCount += 1;
      const upstreamOperationId = operation.operationId;
      operation.operationId = `${upstreamOperationId[0].toLowerCase()}${upstreamOperationId.slice(1)}`;
      operation["x-pontx-upstream-operation-id"] = upstreamOperationId;
      if (method === "get") {
        const emptyBody = operation.requestBody?.content?.["application/x-www-form-urlencoded"]?.schema;
        if (emptyBody?.type !== "object" || emptyBody.additionalProperties !== false ||
          Object.keys(emptyBody.properties ?? {}).length !== 0) {
          fail(`${upstreamOperationId} no longer has the expected empty upstream GET request body`);
        }
        delete operation.requestBody;
      }
      if (!examples[operation.operationId]) fail(`missing request example for ${operation.operationId}`);
      if (operation.tags?.length) fail(`${operation.operationId} unexpectedly acquired a synthetic tag`);
      operation["x-pontx-documentation-status"] = "official";
      operation["x-pontx-evidence"] = evidence;
      operation["x-pontx-verified-at"] = verifiedAt;
      operation["x-pontx-proxy-enabled"] = false;
      operation["x-pontx-proxy-disabled-reason"] = disabledReason;
      operation["x-pontx-request-examples"] = {
        default: {
          summary: "Reviewed local SDK/CLI request",
          ...clone(examples[operation.operationId])
        }
      };
      for (const parameter of operation.parameters ?? []) {
        if (parameter.in === "path") parameter.required = true;
      }
      if (pathname.includes("{session}") && !operation.parameters?.some(({ name, in: location }) =>
        name === "session" && location === "path")) {
        fail(`${operation.operationId} lost its required session path parameter`);
      }
    }
  }
  if (Object.keys(document.paths).length !== 6 || operationCount !== 8) {
    fail(`Stripe Identity boundary drifted: ${Object.keys(document.paths).length} paths / ${operationCount} operations`);
  }
  if (Object.keys(document.components.schemas).length !== 35) {
    fail(`Stripe Identity schema closure drifted: ${Object.keys(document.components.schemas).length}`);
  }
  return document;
}

const upstream = valueAfter("--upstream");
const write = process.argv.includes("--write");
if (!upstream || process.argv.includes("--help")) {
  console.error("Usage: node scripts/import-stripe-identity.mjs --upstream /path/to/stripe-openapi [--check|--write]");
  process.exit(upstream ? 0 : 2);
}

const sourcePath = path.resolve(upstream, "openapi/spec3.json");
const licensePath = path.resolve(upstream, "LICENSE");
if (!fs.existsSync(sourcePath) || !fs.existsSync(licensePath)) fail("pinned Stripe source or LICENSE is missing");
if (sha256(sourcePath) !== expectedSourceSha256) fail("pinned Stripe OpenAPI hash drifted");
if (sha256(licensePath) !== expectedLicenseSha256) fail("pinned Stripe LICENSE hash drifted");
const git = spawnSync("git", ["-C", upstream, "rev-parse", "HEAD"], { encoding: "utf8" });
if (git.status !== 0 || git.stdout.trim() !== revision) fail(`Stripe checkout must be pinned to ${revision}`);

const source = JSON.parse(fs.readFileSync(sourcePath, "utf8"));
if (source.openapi !== "3.0.0" || source.info?.version !== "2026-07-29.dahlia") {
  fail("unexpected Stripe API contract version");
}
const outputs = {
  "zh-CN": {
    path: path.join(root, "specs/stripe-identity/openapi.json"),
    document: buildDocument(source, "zh-CN")
  },
  "en-US": {
    path: path.join(root, "specs/stripe-identity/locales/en-US/openapi.json"),
    document: buildDocument(source, "en-US")
  }
};

for (const [locale, output] of Object.entries(outputs)) {
  const serialized = `${JSON.stringify(output.document, null, 2)}\n`;
  if (write) {
    fs.mkdirSync(path.dirname(output.path), { recursive: true });
    fs.writeFileSync(output.path, serialized);
  } else {
    if (!fs.existsSync(output.path) || fs.readFileSync(output.path, "utf8") !== serialized) {
      fail(`${locale} Stripe Identity output is stale; rerun importer with --write`);
    }
  }
  console.log(`${locale}: ${crypto.createHash("sha256").update(serialized).digest("hex")}`);
}

console.log(`Verified Stripe Identity ${revision}: 6 paths, 8 Endpoints, 35 Schemas, zero Hub proxy operations.`);
