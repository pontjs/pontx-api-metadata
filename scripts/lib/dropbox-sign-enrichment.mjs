const compositionKeywords = ["allOf", "oneOf", "anyOf"];
const sensitiveLeafNames = new Set([
  "client_secret", "refresh_token", "access_token", "password", "authorization", "secret", "pin",
  "code", "state"
]);

function titleWords(value) {
  return String(value)
    .replace(/([a-z0-9])([A-Z])/g, "$1 $2")
    .replace(/[_./-]+/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .replace(/\b\w/g, (letter) => letter.toUpperCase());
}

function derivedTitle(label, kind, locale) {
  const readable = titleWords(label || "inline schema");
  if (locale === "zh-CN") {
    const prefix = {
      component: "数据结构",
      property: "字段",
      item: "数组项",
      variant: "组合结构",
      value: "映射值",
      inline: "内联结构"
    }[kind];
    return `${prefix}：${readable}`;
  }
  if (kind === "item") return `${readable} item`;
  if (kind === "variant") return `${readable} variant`;
  if (kind === "value") return `${readable} value`;
  return readable;
}

function isSensitiveOrBinary(schema, path) {
  if (schema.format === "binary") return "binary";
  const identifier = String(path.at(-1)).toLowerCase();
  if (sensitiveLeafNames.has(identifier)) {
    return "credential-or-secret";
  }
  return undefined;
}

function boundedNumber(schema) {
  let value = schema.minimum ?? 0;
  if (schema.exclusiveMinimum === true) value += schema.multipleOf ?? 1;
  if (typeof schema.exclusiveMinimum === "number") value = schema.exclusiveMinimum + (schema.multipleOf ?? 1);
  if (schema.multipleOf) value = Math.ceil(value / schema.multipleOf) * schema.multipleOf;
  const maximum = typeof schema.exclusiveMaximum === "number"
    ? schema.exclusiveMaximum - (schema.multipleOf ?? 1)
    : schema.maximum;
  if (maximum !== undefined && value > maximum) value = maximum;
  return schema.type === "integer" ? Math.trunc(value) : value;
}

function stringExample(schema, label) {
  const lower = String(label).toLowerCase();
  let value;
  if (schema.format === "email" || lower.includes("email")) value = "developer@example.com";
  else if (lower.includes("url") || lower.includes("uri")) value = "https://example.com/resource";
  else if (lower.includes("phone") || lower.includes("fax_number")) value = "+12025550123";
  else if (lower.includes("color")) value = "#000000";
  else if (lower.includes("country")) value = "US";
  else if (lower.includes("state")) value = "CA";
  else if (lower.includes("postal") || lower.includes("zip")) value = "00000";
  else if (lower.includes("date") || lower.endsWith("_at")) value = "2026-08-14T00:00:00Z";
  else if (lower.includes("filename") || lower === "file") value = "example.pdf";
  else if (lower.includes("name")) value = "Example Name";
  else if (lower.includes("message")) value = "Example message";
  else if (lower.includes("subject") || lower.includes("title")) value = "Example document";
  else if (lower.endsWith("id") || lower.endsWith("_id")) value = `example-${lower.replace(/[^a-z0-9]+/g, "-")}`;

  if (value === undefined) return undefined;

  const minimum = schema.minLength ?? 0;
  if (value.length < minimum) value = value.padEnd(minimum, "x");
  if (schema.maxLength !== undefined && value.length > schema.maxLength) {
    value = value.slice(0, schema.maxLength);
  }
  return value;
}

function exampleFor(schema, label) {
  if (Object.hasOwn(schema, "const")) return { value: schema.const, source: "const" };
  if (Object.hasOwn(schema, "default")) return { value: schema.default, source: "default" };
  if (Array.isArray(schema.enum) && schema.enum.length) {
    return { value: schema.enum[0], source: "enum" };
  }
  if (schema.type === "boolean") return { value: false, source: "constraint-placeholder" };
  if (schema.type === "integer" || schema.type === "number") {
    return { value: boundedNumber(schema), source: "constraint-placeholder" };
  }
  if (schema.type === "string") {
    const value = stringExample(schema, label);
    return value === undefined
      ? undefined
      : { value, source: "constraint-placeholder" };
  }
  return undefined;
}

function enumDescriptions(schema, locale) {
  return schema.enum.map((value) => locale === "zh-CN"
    ? `枚举值 \`${String(value)}\`。`
    : `Value \`${String(value)}\`.`);
}

function schemaChildren(schema) {
  return Boolean(
    schema.properties || schema.items || schema.additionalProperties ||
    compositionKeywords.some((keyword) => schema[keyword])
  );
}

function visitSchema(schema, context, locale, stats) {
  if (!schema || typeof schema !== "object" || Array.isArray(schema) || schema.$ref) return;

  if (context.kind === "component" && !schema.title) {
    schema.title = derivedTitle(context.label, context.kind, locale);
    stats.componentTitles += 1;
  } else if (!schema.title && !schema.description) {
    schema.title = derivedTitle(context.label, context.kind, locale);
    stats.schemaTitles += 1;
  }

  if (Array.isArray(schema.enum) && schema.enum.length &&
    (!Array.isArray(schema["x-enum-descriptions"]) ||
      schema["x-enum-descriptions"].length !== schema.enum.length)) {
    schema["x-enum-descriptions"] = enumDescriptions(schema, locale);
    stats.enumSchemas += 1;
    stats.enumValues += schema.enum.length;
  }

  if (!schemaChildren(schema) && !Object.hasOwn(schema, "example") && !Array.isArray(schema.examples)) {
    const omission = isSensitiveOrBinary(schema, context.path);
    if (omission) {
      stats.omittedExamples[omission] += 1;
    } else {
      const derived = exampleFor(schema, context.label);
      if (derived) {
        schema.example = derived.value;
        stats.leafExamples[derived.source] += 1;
      } else {
        const category = schema.type === "string"
          ? "unmappedGenericString"
          : "unsupportedSchema";
        stats.omittedExamples[category] += 1;
      }
    }
  }

  for (const [name, child] of Object.entries(schema.properties ?? {})) {
    visitSchema(child, {
      kind: "property",
      label: name,
      path: [...context.path, "properties", name]
    }, locale, stats);
  }
  if (schema.items) {
    visitSchema(schema.items, {
      kind: "item",
      label: context.label,
      path: [...context.path, "items"]
    }, locale, stats);
  }
  for (const keyword of compositionKeywords) {
    schema[keyword]?.forEach((child, index) => visitSchema(child, {
      kind: "variant",
      label: context.label,
      path: [...context.path, keyword, index]
    }, locale, stats));
  }
  if (schema.additionalProperties && typeof schema.additionalProperties === "object") {
    visitSchema(schema.additionalProperties, {
      kind: "value",
      label: context.label,
      path: [...context.path, "additionalProperties"]
    }, locale, stats);
  }
}

function visitInlineSchemas(value, segments, locale, stats) {
  if (Array.isArray(value)) {
    value.forEach((item, index) => visitInlineSchemas(item, [...segments, index], locale, stats));
    return;
  }
  if (!value || typeof value !== "object") return;
  for (const [key, item] of Object.entries(value)) {
    if (key === "schemas" && segments.at(-1) === "components") continue;
    if (key === "schema") {
      const label = typeof value.name === "string" ? value.name : segments.at(-1) || "inline schema";
      visitSchema(item, { kind: "inline", label, path: [...segments, key] }, locale, stats);
      continue;
    }
    visitInlineSchemas(item, [...segments, key], locale, stats);
  }
}

export function enrichDropboxSignDocument(document, locale) {
  const stats = {
    componentTitles: 0,
    schemaTitles: 0,
    enumSchemas: 0,
    enumValues: 0,
    leafExamples: { const: 0, default: 0, enum: 0, "constraint-placeholder": 0 },
    omittedExamples: {
      binary: 0,
      "credential-or-secret": 0,
      unmappedGenericString: 0,
      unsupportedSchema: 0
    },
    addedTags: 0,
    typeCorrections: 0,
    constraintCorrections: 0
  };

  const bulkSendVariant = document.components.schemas
    .BulkSendJobGetResponseSignatureRequests.allOf[1];
  if (!bulkSendVariant.type) {
    bulkSendVariant.type = "object";
    stats.typeCorrections += 1;
  }
  const reportTypeItem = document.components.schemas.ReportResponse.properties.report_type.items;
  if (!reportTypeItem.type) {
    reportTypeItem.type = "string";
    stats.typeCorrections += 1;
  }
  const textVariant = document.components.schemas.SubFormFieldsPerDocumentText.allOf[1];
  if (textVariant.required?.includes("options") && !textVariant.properties?.options) {
    textVariant.required = textVariant.required.filter((name) => name !== "options");
    stats.constraintCorrections += 1;
  }

  for (const [name, schema] of Object.entries(document.components.schemas)) {
    visitSchema(schema, {
      kind: "component",
      label: name,
      path: ["components", "schemas", name]
    }, locale, stats);
  }
  visitInlineSchemas(document.paths, ["paths"], locale, stats);

  if (!document.tags.some((tag) => tag.name === "Fax")) {
    document.tags.push({
      name: "Fax",
      description: locale === "zh-CN" ? "传真 API 接口。" : "Fax API endpoints."
    });
    stats.addedTags += 1;
  }

  return stats;
}

export function isConstraintValidExample(schema, value) {
  if (schema.type === "string" && typeof value !== "string") return false;
  if (schema.type === "boolean" && typeof value !== "boolean") return false;
  if (schema.type === "integer" && (!Number.isInteger(value))) return false;
  if (schema.type === "number" && typeof value !== "number") return false;
  if (Array.isArray(schema.enum) && !schema.enum.some((item) => Object.is(item, value))) return false;
  if (Object.hasOwn(schema, "const") && !Object.is(schema.const, value)) return false;
  if (typeof value === "string") {
    if (schema.minLength !== undefined && value.length < schema.minLength) return false;
    if (schema.maxLength !== undefined && value.length > schema.maxLength) return false;
    if (schema.pattern && !(new RegExp(schema.pattern).test(value))) return false;
  }
  if (typeof value === "number") {
    if (schema.minimum !== undefined && value < schema.minimum) return false;
    if (schema.maximum !== undefined && value > schema.maximum) return false;
    if (typeof schema.exclusiveMinimum === "number" && value <= schema.exclusiveMinimum) return false;
    if (typeof schema.exclusiveMaximum === "number" && value >= schema.exclusiveMaximum) return false;
    if (schema.exclusiveMinimum === true && schema.minimum !== undefined && value <= schema.minimum) return false;
    if (schema.exclusiveMaximum === true && schema.maximum !== undefined && value >= schema.maximum) return false;
  }
  return true;
}
