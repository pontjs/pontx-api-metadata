import assert from "node:assert/strict";
import {
  compareLocalizedDocuments,
  mergeLocalizedText,
  validateLocaleTag
} from "./lib/localization.mjs";

assert.doesNotThrow(() => validateLocaleTag("en"));
assert.doesNotThrow(() => validateLocaleTag("en-US"));
assert.throws(() => validateLocaleTag("en_US"), /BCP 47/);

const baseline = {
  openapi: "3.1.0",
  info: { title: "中文标题", description: "中文说明", version: "1.0.0" },
  paths: {
    "/items": {
      get: {
        operationId: "listItems",
        summary: "查询条目",
        parameters: [
          {
            name: "limit",
            in: "query",
            description: "返回数量",
            schema: { type: "integer", default: 10 }
          }
        ],
        responses: {
          "200": {
            description: "成功",
            content: {
              "application/json": {
                schema: {
                  type: "object",
                  properties: {
                    description: { type: "string" }
                  }
                },
                example: { description: "业务数据，不是 OAS 文案" }
              }
            }
          }
        }
      }
    }
  }
};

const english = structuredClone(baseline);
english.info.title = "English title";
english.info.description = "English description";
english.paths["/items"].get.summary = "List items";
english.paths["/items"].get.parameters[0].description = "Number of items";
english.paths["/items"].get.responses["200"].description = "Success";

assert.deepEqual(compareLocalizedDocuments(baseline, english), []);

const structuralChange = structuredClone(english);
structuralChange.paths["/items"].get.parameters[0].schema.default = 20;
assert.match(
  compareLocalizedDocuments(baseline, structuralChange).join("\n"),
  /structural value differs/
);

const exampleChange = structuredClone(english);
exampleChange.paths["/items"].get.responses["200"].content["application/json"].example.description = "Changed data";
assert.match(
  compareLocalizedDocuments(baseline, exampleChange).join("\n"),
  /structural value differs/
);

const withNamedExample = structuredClone(baseline);
withNamedExample.paths["/items"].get.responses["200"].content["application/json"].examples = {
  success: { summary: "成功示例", value: { description: "业务数据" } }
};
const translatedNamedExample = structuredClone(withNamedExample);
translatedNamedExample.paths["/items"].get.responses["200"].content["application/json"].examples.success.summary = "Successful example";
assert.deepEqual(compareLocalizedDocuments(withNamedExample, translatedNamedExample), []);

const missingNode = structuredClone(english);
delete missingNode.paths["/items"].get.operationId;
assert.match(compareLocalizedDocuments(baseline, missingNode).join("\n"), /missing keys/);

const scopePropertyBaseline = {
  openapi: "3.1.0",
  info: { title: "中文", version: "1.0.0" },
  paths: {},
  components: {
    securitySchemes: {
      OAuth2: {
        type: "oauth2",
        flows: {
          authorizationCode: {
            authorizationUrl: "https://example.com/authorize",
            tokenUrl: "https://example.com/token",
            scopes: { read: "读取数据" }
          }
        }
      }
    },
    schemas: {
      Demo: {
        type: "object",
        properties: {
          scopes: {
            type: "array",
            description: "业务 scopes 字段",
            items: { $ref: "#/components/schemas/Safe" }
          },
          default: { type: "string", description: "业务 default 字段" },
          example: { type: "string", description: "业务 example 字段" }
        }
      },
      Safe: { type: "string" }
    }
  }
};
const scopePropertyEnglish = structuredClone(scopePropertyBaseline);
scopePropertyEnglish.components.securitySchemes.OAuth2.flows.authorizationCode.scopes.read = "Read data";
scopePropertyEnglish.components.schemas.Demo.properties.scopes.description = "Business scopes field";
scopePropertyEnglish.components.schemas.Demo.properties.default.description = "Business default field";
scopePropertyEnglish.components.schemas.Demo.properties.example.description = "Business example field";
assert.deepEqual(compareLocalizedDocuments(scopePropertyBaseline, scopePropertyEnglish), []);

const scopeBypass = structuredClone(scopePropertyEnglish);
scopeBypass.components.schemas.Demo.properties.scopes.items.$ref = "#/components/schemas/Evil";
assert.match(compareLocalizedDocuments(scopePropertyBaseline, scopeBypass).join("\n"), /structural value differs/);

const enumDescriptionBypass = structuredClone(scopePropertyEnglish);
enumDescriptionBypass.components.schemas.Demo.properties.scopes["x-enum-descriptions"] = {
  safe: { type: "string" }
};
const localizedEnumDescriptionBypass = structuredClone(enumDescriptionBypass);
localizedEnumDescriptionBypass.components.schemas.Demo.properties.scopes["x-enum-descriptions"].safe.type = "integer";
assert.match(
  compareLocalizedDocuments(enumDescriptionBypass, localizedEnumDescriptionBypass).join("\n"),
  /structural value differs/
);

const mergedScopeText = mergeLocalizedText(scopePropertyBaseline, scopePropertyEnglish);
assert.equal(
  mergedScopeText.components.securitySchemes.OAuth2.flows.authorizationCode.scopes.read,
  "Read data"
);
assert.equal(
  mergedScopeText.components.schemas.Demo.properties.scopes.items.$ref,
  "#/components/schemas/Safe"
);

const keywordComponentBaseline = {
  openapi: "3.1.0",
  info: { title: "中文", version: "1.0.0" },
  paths: {},
  components: {
    schemas: {
      example: { type: "object", description: "名为 example 的数据结构" },
      default: { type: "object", description: "名为 default 的数据结构" }
    },
    examples: {
      example: {
        summary: "示例摘要",
        value: { description: "示例业务数据" }
      }
    }
  }
};
const keywordComponentEnglish = structuredClone(keywordComponentBaseline);
keywordComponentEnglish.components.schemas.example.description = "Schema named example";
keywordComponentEnglish.components.schemas.default.description = "Schema named default";
keywordComponentEnglish.components.examples.example.summary = "Example summary";
assert.deepEqual(compareLocalizedDocuments(keywordComponentBaseline, keywordComponentEnglish), []);
keywordComponentEnglish.components.examples.example.value.description = "Changed example data";
assert.match(
  compareLocalizedDocuments(keywordComponentBaseline, keywordComponentEnglish).join("\n"),
  /structural value differs/
);

console.log("Locale lint unit tests passed.");
