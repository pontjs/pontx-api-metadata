import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const specRoot = path.join(root, "specs/ecb-data-portal");
const verifiedAt = "2026-08-14";

const evidence = [
  "https://data.ecb.europa.eu/help/api/data",
  "https://data.ecb.europa.eu/help/api/metadata",
  "https://data.ecb.europa.eu/help/api/schemas",
  "https://data.ecb.europa.eu/help/api/content-negotiation",
  "https://data.ecb.europa.eu/help/api/status-codes"
];

const prose = {
  zh: {
    title: "ECB Data Portal SDMX API",
    description: "欧洲中央银行 Data Portal 的匿名只读 SDMX 2.1 REST 服务。契约覆盖统计数据、结构元数据和结构特定 XML Schema 三类官方资源，并展开官方允许省略版本或标识符的路径变体。数据响应支持 SDMX-JSON、CSV、ECB 透视表 CSV，以及 SDMX-ML 2.1 Generic Data 和 Structure Specific Data。",
    dataTag: "统计数据查询接口",
    metadataTag: "SDMX 结构元数据查询接口",
    schemaTag: "结构特定数据 XML Schema 查询接口",
    dataByKeySummary: "按数据流和 Series key 获取数据",
    dataByKeyDescription: "返回指定数据流中与 Series key 匹配的时间序列。key 按 DSD 维度顺序以点号连接；空段表示通配，`+` 表示 OR。请使用日期或 Observation 数量参数限制响应规模。",
    dataByFlowSummary: "按数据流获取数据",
    dataByFlowDescription: "返回数据流中的数据。该变体省略 Series key，因此可能匹配大量时间序列；调用方应使用日期、detail 或 Observation 数量参数限制响应。",
    listMetadataSummary: "列出一类结构元数据",
    listMetadataDescription: "返回指定 SDMX artefact 类型的所有可用结构元数据。",
    agencyMetadataSummary: "按维护机构列出结构元数据",
    agencyMetadataDescription: "返回由指定 SDMX agency 维护的某类结构元数据。",
    artefactMetadataSummary: "获取结构元数据 artefact",
    artefactMetadataDescription: "返回指定维护机构和资源标识符对应的最新结构元数据版本。",
    versionedMetadataSummary: "获取指定版本的结构元数据 artefact",
    versionedMetadataDescription: "返回指定维护机构、资源标识符和版本对应的结构元数据。",
    latestSchemaSummary: "获取最新结构特定数据 XML Schema",
    latestSchemaDescription: "按 context、维护机构和资源标识符生成最新版本的 Structure Specific Data XML Schema。",
    versionedSchemaSummary: "获取指定版本的结构特定数据 XML Schema",
    versionedSchemaDescription: "按 context、维护机构、资源标识符和版本生成 Structure Specific Data XML Schema。",
    response200Data: "请求成功；响应表示由 format 查询参数或 Accept header 选择。",
    response200Metadata: "结构元数据 XML。",
    response200Schema: "用于验证 Structure Specific Data 消息的 XML Schema。",
    noChanges: "自 If-Modified-Since 指定时间起没有变化；响应没有 body。",
    badRequest: "查询参数存在语法或语义错误。",
    notFound: "没有匹配结果。",
    notAcceptable: "请求的响应表示不受支持。",
    internalError: "ECB 服务内部错误。",
    notImplemented: "请求使用了 ECB 尚未实现的 SDMX REST 功能。",
    unavailable: "ECB 服务暂时不可用。",
    disabled: "公共匿名 ECB Endpoint 由 SDK 与 CLI 直接调用；Hub 有意不代理。",
    period: "ISO 8601 或 SDMX reporting period：年、半年、季度、月、周或日。",
    updatedAfter: "只返回该 ISO 8601 时间戳之后新增、修订或删除的最新值。",
    firstN: "每个匹配时间序列从第一条开始最多返回的 Observation 数量。",
    lastN: "每个匹配时间序列从最近一条向前最多返回的 Observation 数量。",
    dataDetail: "返回的数据细节级别。",
    includeHistory: "是否包含匹配数据的历史版本。",
    format: "响应格式；也可通过 Accept header 选择。",
    ifModifiedSince: "HTTP 条件请求时间。若数据没有变化，服务返回 304。",
    accept: "选择响应表示。ECB 建议使用带版本的专用 media type。",
    acceptEncoding: "请求压缩响应，例如 gzip。",
    flowRef: "数据流引用：flow ID，或以逗号分隔的 agency ID、flow ID 和 version。",
    key: "按 DSD 维度顺序排列的 Series key；点号分隔，空段通配，`+` 表示 OR。",
    resource: "SDMX 结构元数据 artefact 类型。",
    agencyID: "维护该 artefact 的 SDMX agency 标识符。",
    resourceID: "SDMX artefact 标识符。",
    version: "SDMX artefact 版本。",
    metadataDetail: "结构元数据细节级别。",
    references: "返回或排除关联 artefact；也可传具体资源类型。",
    context: "生成 XML Schema 时使用的 SDMX 约束上下文。",
    sdmxMessage: "SDMX-JSON 1.0.0-wd 数据消息。Schema 建模 ECB 实测且由官方内容协商声明的顶层、结构、维度、属性、Series 和 Observation 关系；动态 Series key 和 Observation 索引使用 map 表达。",
    header: "SDMX 消息头。",
    sender: "消息发送方。",
    link: "相关 SDMX 资源链接。",
    structure: "描述维度、属性及其值字典的 SDMX 数据结构。",
    component: "SDMX 维度或属性定义。",
    componentValue: "SDMX 维度或属性的值字典项。",
    dataSet: "SDMX 数据集；Series key 是动态 map key。",
    series: "一个匹配的时间序列及其 Observation。",
    tuple: "Observation 值及其属性索引组成的 tuple。",
    errorBody: "ECB 未声明稳定的错误 body Schema；SDK 将错误 body 保留为字符串。",
    titles: ["SDMX 数据消息", "SDMX 消息头", "SDMX 发送方", "SDMX 资源链接", "SDMX 数据结构", "SDMX 组件分组", "SDMX 维度或属性", "SDMX 组件值", "SDMX 数据集", "SDMX 时间序列", "SDMX Observation tuple", "ECB 错误响应"]
  },
  en: {
    title: "ECB Data Portal SDMX API",
    description: "The anonymous, read-only SDMX 2.1 REST service for the European Central Bank Data Portal. The contract covers the three official resource families for statistical data, structural metadata, and structure-specific XML schemas, with separate path variants where the service permits omitted identifiers or versions. Data responses support SDMX-JSON, CSV, ECB pivot-table CSV, SDMX-ML 2.1 Generic Data, and Structure Specific Data.",
    dataTag: "Statistical data query endpoints",
    metadataTag: "SDMX structural metadata query endpoints",
    schemaTag: "Structure-specific data XML Schema query endpoints",
    dataByKeySummary: "Get data by dataflow and Series key",
    dataByKeyDescription: "Returns time series matching a Series key within a dataflow. The key follows DSD dimension order with dot separators; an empty segment is a wildcard and `+` is OR. Bound response size with date or observation-count parameters.",
    dataByFlowSummary: "Get data by dataflow",
    dataByFlowDescription: "Returns data from a dataflow. This variant omits the Series key and can therefore match many time series; callers should bound the response with date, detail, or observation-count parameters.",
    listMetadataSummary: "List a structural metadata type",
    listMetadataDescription: "Returns all available structural metadata for an SDMX artefact type.",
    agencyMetadataSummary: "List structural metadata by maintainer",
    agencyMetadataDescription: "Returns structural metadata of one type maintained by a specified SDMX agency.",
    artefactMetadataSummary: "Get a structural metadata artefact",
    artefactMetadataDescription: "Returns the latest structural metadata version for a maintainer and resource identifier.",
    versionedMetadataSummary: "Get a versioned structural metadata artefact",
    versionedMetadataDescription: "Returns structural metadata for a maintainer, resource identifier, and version.",
    latestSchemaSummary: "Get the latest structure-specific data XML Schema",
    latestSchemaDescription: "Generates the latest Structure Specific Data XML Schema for a context, maintainer, and resource identifier.",
    versionedSchemaSummary: "Get a versioned structure-specific data XML Schema",
    versionedSchemaDescription: "Generates a Structure Specific Data XML Schema for a context, maintainer, resource identifier, and version.",
    response200Data: "Successful request; the representation is selected by the format query parameter or Accept header.",
    response200Metadata: "Structural metadata XML.",
    response200Schema: "XML Schema for validating Structure Specific Data messages.",
    noChanges: "No change since the If-Modified-Since value; the response has no body.",
    badRequest: "The query parameters contain a syntax or semantic error.",
    notFound: "No result matched the query.",
    notAcceptable: "The requested representation is not supported.",
    internalError: "An internal ECB service error occurred.",
    notImplemented: "The request uses SDMX REST functionality not implemented by the ECB service.",
    unavailable: "The ECB service is temporarily unavailable.",
    disabled: "The public anonymous ECB endpoint is called directly by the SDK and CLI; Hub proxying is intentionally disabled.",
    period: "An ISO 8601 or SDMX reporting period: annual, semi-annual, quarterly, monthly, weekly, or daily.",
    updatedAfter: "Return the latest values added, revised, or deleted after this ISO 8601 timestamp.",
    firstN: "Maximum observations returned per matching time series, starting at the first observation.",
    lastN: "Maximum observations returned per matching time series, counting backward from the latest observation.",
    dataDetail: "Amount of data detail returned.",
    includeHistory: "Whether to include historical versions of matching data.",
    format: "Response format; it can also be selected through the Accept header.",
    ifModifiedSince: "HTTP conditional-request timestamp. The service returns 304 when data has not changed.",
    accept: "Selects the response representation. The ECB recommends versioned, specific media types.",
    acceptEncoding: "Requests a compressed response, for example gzip.",
    flowRef: "Dataflow reference: a flow ID, or comma-separated agency ID, flow ID, and version.",
    key: "Series key in DSD dimension order; dot-separated, with empty wildcard segments and `+` for OR.",
    resource: "SDMX structural-metadata artefact type.",
    agencyID: "Identifier of the SDMX agency maintaining the artefact.",
    resourceID: "SDMX artefact identifier.",
    version: "SDMX artefact version.",
    metadataDetail: "Structural metadata detail level.",
    references: "Includes or excludes related artefacts; a concrete resource type is also accepted.",
    context: "SDMX constraint context used to generate the XML Schema.",
    sdmxMessage: "An SDMX-JSON 1.0.0-wd data message. The schema models the top-level, structure, dimension, attribute, series, and observation relationships declared by ECB content negotiation and verified in a bounded live response; dynamic Series keys and observation indexes are represented as maps.",
    header: "SDMX message header.",
    sender: "Message sender.",
    link: "Link to a related SDMX resource.",
    structure: "SDMX data structure describing dimensions, attributes, and their value dictionaries.",
    component: "An SDMX dimension or attribute definition.",
    componentValue: "A value-dictionary entry for an SDMX dimension or attribute.",
    dataSet: "An SDMX dataset whose Series keys are dynamic map keys.",
    series: "One matching time series and its observations.",
    tuple: "Tuple containing an observation value and attribute indexes.",
    errorBody: "ECB does not declare a stable error-body schema; the SDK preserves an error body as a string.",
    titles: ["SDMX data message", "SDMX message header", "SDMX sender", "SDMX resource link", "SDMX data structure", "SDMX component groups", "SDMX dimension or attribute", "SDMX component value", "SDMX dataset", "SDMX time series", "SDMX observation tuple", "ECB error response"]
  }
};

const resourceValues = [
  "datastructure", "metadatastructure", "categoryscheme", "Conceptscheme", "codelist",
  "hierarchicalcodelist", "organisationscheme", "agencyscheme", "dataproviderscheme",
  "dataconsumerscheme", "organisationunitscheme", "dataflow", "metadataflow",
  "reportingtaxonomy", "provisionagreement", "structureset", "process", "categorisation",
  "contentconstraint", "attachmentconstraint", "structure"
];

const dataMediaTypes = [
  "application/vnd.sdmx.genericdata+xml;version=2.1",
  "application/vnd.sdmx.structurespecificdata+xml;version=2.1",
  "application/vnd.sdmx.data+json;version=1.0.0-wd",
  "text/csv",
  "application/vnd.ecb.data+csv;version=1.0.0",
  "application/json",
  "application/xml"
];

function ref(name) {
  return { $ref: `#/components/parameters/${name}` };
}

function operationExtensions(p, request, unresolved = []) {
  return {
    "x-pontx-documentation-status": "official",
    "x-pontx-evidence": evidence,
    "x-pontx-verified-at": verifiedAt,
    "x-pontx-proxy-enabled": false,
    "x-pontx-proxy-disabled-reason": p.disabled,
    "x-pontx-request-examples": {
      default: {
        request,
        expectedStatus: "200",
        ...(unresolved.length ? { unresolved } : {})
      }
    }
  };
}

function errorResponses(p) {
  const response = (description) => ({
    description,
    content: {
      "text/plain": { schema: { $ref: "#/components/schemas/ErrorBody" } },
      "application/xml": { schema: { $ref: "#/components/schemas/ErrorBody" } },
      "application/json": { schema: { $ref: "#/components/schemas/ErrorBody" } }
    }
  });
  return {
    "400": response(p.badRequest),
    "404": response(p.notFound),
    "406": response(p.notAcceptable),
    "500": response(p.internalError),
    "501": response(p.notImplemented),
    "503": response(p.unavailable)
  };
}

function dataResponses(p) {
  return {
    "200": {
      description: p.response200Data,
      content: {
        "application/vnd.sdmx.data+json;version=1.0.0-wd": {
          schema: { $ref: "#/components/schemas/SdmxDataMessage" }
        },
        "application/json": { schema: { $ref: "#/components/schemas/SdmxDataMessage" } },
        "text/csv": { schema: { type: "string" } },
        "application/vnd.ecb.data+csv;version=1.0.0": { schema: { type: "string" } },
        "application/vnd.sdmx.genericdata+xml;version=2.1": { schema: { type: "string" } },
        "application/vnd.sdmx.structurespecificdata+xml;version=2.1": { schema: { type: "string" } },
        "application/xml": { schema: { type: "string" } }
      }
    },
    "304": { description: p.noChanges },
    ...errorResponses(p)
  };
}

function metadataResponses(p) {
  return {
    "200": {
      description: p.response200Metadata,
      content: {
        "application/vnd.sdmx.structure+xml;version=2.1": { schema: { type: "string" } },
        "application/xml": { schema: { type: "string" } }
      }
    },
    ...errorResponses(p)
  };
}

function schemaResponses(p) {
  return {
    "200": {
      description: p.response200Schema,
      content: {
        "application/vnd.sdmx.schema+xml;version=2.1": { schema: { type: "string" } },
        "application/xml": { schema: { type: "string" } },
        "text/xml": { schema: { type: "string" } }
      }
    },
    ...errorResponses(p)
  };
}

function dataOperation(p, withKey) {
  const operationId = withKey ? "getDataBySeriesKey" : "getDataByFlow";
  const pathValues = withKey
    ? { flowRef: "EXR", key: "M.USD.EUR.SP00.A" }
    : { flowRef: "EXR" };
  return {
    tags: ["Data"],
    operationId,
    summary: withKey ? p.dataByKeySummary : p.dataByFlowSummary,
    description: withKey ? p.dataByKeyDescription : p.dataByFlowDescription,
    parameters: [
      ref("flowRef"), ...(withKey ? [ref("key")] : []), ref("startPeriod"), ref("endPeriod"),
      ref("updatedAfter"), ref("firstNObservations"), ref("lastNObservations"),
      ref("dataDetail"), ref("includeHistory"), ref("format"), ref("ifModifiedSince"),
      ref("dataAccept"), ref("acceptEncoding")
    ],
    responses: dataResponses(p),
    ...operationExtensions(p, {
      path: pathValues,
      query: withKey
        ? { startPeriod: "2024-01", endPeriod: "2024-01", format: "jsondata" }
        : { lastNObservations: 1, detail: "serieskeysonly", format: "jsondata" },
      headers: {}
    })
  };
}

function metadataOperation(p, variant) {
  const definitions = {
    list: ["listMetadata", p.listMetadataSummary, p.listMetadataDescription, [ref("resource")],
      { resource: "dataflow" }],
    agency: ["listMetadataByAgency", p.agencyMetadataSummary, p.agencyMetadataDescription,
      [ref("resource"), ref("agencyID")], { resource: "dataflow", agencyID: "ECB" }],
    artefact: ["getMetadataArtefact", p.artefactMetadataSummary, p.artefactMetadataDescription,
      [ref("resource"), ref("agencyID"), ref("resourceID")],
      { resource: "dataflow", agencyID: "ECB", resourceID: "EXR" }],
    versioned: ["getVersionedMetadataArtefact", p.versionedMetadataSummary,
      p.versionedMetadataDescription,
      [ref("resource"), ref("agencyID"), ref("resourceID"), ref("version")],
      { resource: "dataflow", agencyID: "ECB", resourceID: "EXR", version: "1.0" }]
  };
  const [operationId, summary, description, pathParameters, pathValues] = definitions[variant];
  return {
    tags: ["Metadata"], operationId, summary, description,
    parameters: [
      ...pathParameters, ref("metadataDetail"), ref("references"), ref("metadataAccept"),
      ref("acceptEncoding")
    ],
    responses: metadataResponses(p),
    ...operationExtensions(p, {
      path: pathValues,
      query: { detail: "allstubs", references: "none" },
      headers: {}
    })
  };
}

function xmlSchemaOperation(p, versioned) {
  return {
    tags: ["Validation"],
    operationId: versioned ? "getVersionedStructureSpecificSchema" : "getStructureSpecificSchema",
    summary: versioned ? p.versionedSchemaSummary : p.latestSchemaSummary,
    description: versioned ? p.versionedSchemaDescription : p.latestSchemaDescription,
    parameters: [
      ref("context"), ref("agencyID"), ref("resourceID"), ...(versioned ? [ref("version")] : []),
      ref("acceptEncoding")
    ],
    responses: schemaResponses(p),
    ...operationExtensions(p, {
      path: {
        context: "datastructure", agencyID: "ECB", resourceID: "ECB_EXR1",
        ...(versioned ? { version: "1.0" } : {})
      },
      query: {}, headers: {}
    })
  };
}

function parameters(p) {
  const requiredPath = (name, description, schema) => ({
    name, in: "path", required: true, description, schema
  });
  return {
    flowRef: requiredPath("flowRef", p.flowRef, {
      type: "string", pattern: "^[^/,]+(?:,[^/,]+(?:,[^/,]+)?)?$", example: "EXR"
    }),
    key: requiredPath("key", p.key, {
      type: "string", pattern: "^[A-Za-z0-9_+-]*(?:\\.[A-Za-z0-9_+-]*)*$",
      example: "M.USD.EUR.SP00.A"
    }),
    startPeriod: {
      name: "startPeriod", in: "query", required: false, description: p.period,
      schema: { type: "string", pattern: "^\\d{4}(?:-S[1-2]|-Q[1-4]|-\\d{2}(?:-\\d{2})?|-[Ww]\\d{2})?$", example: "2024-01" }
    },
    endPeriod: {
      name: "endPeriod", in: "query", required: false, description: p.period,
      schema: { type: "string", pattern: "^\\d{4}(?:-S[1-2]|-Q[1-4]|-\\d{2}(?:-\\d{2})?|-[Ww]\\d{2})?$", example: "2024-01" }
    },
    updatedAfter: {
      name: "updatedAfter", in: "query", required: false, description: p.updatedAfter,
      schema: { type: "string", format: "date-time", example: "2024-01-01T00:00:00Z" }
    },
    firstNObservations: {
      name: "firstNObservations", in: "query", required: false, description: p.firstN,
      schema: { type: "integer", minimum: 1, example: 1 }
    },
    lastNObservations: {
      name: "lastNObservations", in: "query", required: false, description: p.lastN,
      schema: { type: "integer", minimum: 1, example: 1 }
    },
    dataDetail: {
      name: "detail", in: "query", required: false, description: p.dataDetail,
      schema: {
        type: "string", enum: ["full", "dataonly", "serieskeysonly", "nodata"],
        default: "full", example: "full"
      }
    },
    includeHistory: {
      name: "includeHistory", in: "query", required: false, description: p.includeHistory,
      schema: { type: "boolean", default: false, example: false }
    },
    format: {
      name: "format", in: "query", required: false, description: p.format,
      schema: {
        type: "string", enum: ["csvdata", "jsondata", "structurespecificdata", "genericdata"],
        default: "genericdata", example: "jsondata"
      }
    },
    ifModifiedSince: {
      name: "If-Modified-Since", in: "header", required: false, description: p.ifModifiedSince,
      schema: { type: "string", format: "http-date", example: "Mon, 01 Jan 2024 00:00:00 GMT" }
    },
    dataAccept: {
      name: "Accept", in: "header", required: false, description: p.accept,
      schema: { type: "string", enum: dataMediaTypes,
        example: "application/vnd.sdmx.data+json;version=1.0.0-wd" }
    },
    metadataAccept: {
      name: "Accept", in: "header", required: false, description: p.accept,
      schema: { type: "string", enum: [
        "application/vnd.sdmx.structure+xml;version=2.1", "application/xml"
      ], example: "application/vnd.sdmx.structure+xml;version=2.1" }
    },
    acceptEncoding: {
      name: "Accept-Encoding", in: "header", required: false, description: p.acceptEncoding,
      schema: { type: "string", example: "gzip" }
    },
    resource: requiredPath("resource", p.resource, {
      type: "string", enum: resourceValues, example: "dataflow"
    }),
    agencyID: requiredPath("agencyID", p.agencyID, { type: "string", example: "ECB" }),
    resourceID: requiredPath("resourceID", p.resourceID, { type: "string", example: "EXR" }),
    version: requiredPath("version", p.version, { type: "string", example: "1.0" }),
    metadataDetail: {
      name: "detail", in: "query", required: false, description: p.metadataDetail,
      schema: {
        type: "string", enum: ["full", "allstubs", "referencestubs"],
        default: "full", example: "allstubs"
      }
    },
    references: {
      name: "references", in: "query", required: false, description: p.references,
      schema: { type: "string", default: "none", example: "none" }
    },
    context: requiredPath("context", p.context, {
      type: "string", enum: ["datastructure", "dataflow", "provisionagreement"],
      example: "datastructure"
    })
  };
}

function schemas(p) {
  const stringOrNull = { type: ["string", "null"] };
  const scalarOrNull = { type: ["number", "string", "boolean", "null"] };
  const [messageTitle, headerTitle, senderTitle, linkTitle, structureTitle, groupsTitle,
    componentTitle, valueTitle, dataSetTitle, seriesTitle, tupleTitle, errorTitle] = p.titles;
  return {
    SdmxDataMessage: {
      type: "object", title: messageTitle, description: p.sdmxMessage,
      required: ["header", "dataSets", "structure"],
      properties: {
        header: { $ref: "#/components/schemas/SdmxHeader" },
        dataSets: { type: "array", items: { $ref: "#/components/schemas/SdmxDataSet" } },
        structure: { $ref: "#/components/schemas/SdmxStructure" }
      }
    },
    SdmxHeader: {
      type: "object", title: headerTitle, description: p.header,
      required: ["id", "test", "prepared", "sender"],
      properties: {
        id: { type: "string", format: "uuid", example: "b8cdb8e9-3de8-41f7-a83e-c6e475a6e7ab" },
        test: { type: "boolean", example: false },
        prepared: { type: "string", format: "date-time", example: "2026-08-14T16:23:35.250+02:00" },
        sender: { $ref: "#/components/schemas/SdmxSender" }
      }
    },
    SdmxSender: {
      type: "object", title: senderTitle, description: p.sender,
      required: ["id"], properties: { id: { type: "string", example: "ECB" } }
    },
    SdmxLink: {
      type: "object", title: linkTitle, description: p.link,
      required: ["rel", "href"], properties: {
        title: { ...stringOrNull, example: "Exchange Rates" },
        rel: { type: "string", example: "dataflow" },
        href: { type: "string", format: "uri", example: "https://data-api.ecb.europa.eu/service/dataflow/ECB/EXR/1.0" }
      }
    },
    SdmxStructure: {
      type: "object", title: structureTitle, description: p.structure,
      required: ["dimensions", "attributes"], properties: {
        links: { type: "array", items: { $ref: "#/components/schemas/SdmxLink" } },
        name: { type: "string", example: "Exchange Rates" },
        dimensions: { $ref: "#/components/schemas/SdmxComponentGroups" },
        attributes: { $ref: "#/components/schemas/SdmxComponentGroups" }
      }
    },
    SdmxComponentGroups: {
      type: "object", title: groupsTitle, required: ["series", "observation"],
      properties: {
        series: { type: "array", items: { $ref: "#/components/schemas/SdmxComponent" } },
        observation: { type: "array", items: { $ref: "#/components/schemas/SdmxComponent" } }
      }
    },
    SdmxComponent: {
      type: "object", title: componentTitle, description: p.component,
      required: ["id", "name", "values"], properties: {
        id: { type: "string", example: "FREQ" },
        name: { type: "string", example: "Frequency" },
        role: { ...stringOrNull, example: "time" },
        values: { type: "array", items: { $ref: "#/components/schemas/SdmxComponentValue" } }
      }
    },
    SdmxComponentValue: {
      type: "object", title: valueTitle, description: p.componentValue,
      properties: {
        id: { ...stringOrNull, example: "M" },
        name: { ...stringOrNull, example: "Monthly" },
        start: { type: ["string", "null"], format: "date-time", example: "2024-01-01T00:00:00.000+01:00" },
        end: { type: ["string", "null"], format: "date-time", example: "2024-01-31T23:59:59.999+01:00" }
      }
    },
    SdmxDataSet: {
      type: "object", title: dataSetTitle, description: p.dataSet,
      required: ["action", "series"], properties: {
        action: { type: "string", example: "Replace" },
        validFrom: { type: ["string", "null"], format: "date-time", example: "2026-08-14T16:23:35.250+02:00" },
        series: { type: "object", additionalProperties: { $ref: "#/components/schemas/SdmxSeries" } }
      }
    },
    SdmxSeries: {
      type: "object", title: seriesTitle, description: p.series,
      properties: {
        attributes: { type: "array", items: scalarOrNull },
        observations: {
          type: "object", additionalProperties: { $ref: "#/components/schemas/SdmxObservationTuple" }
        }
      }
    },
    SdmxObservationTuple: {
      type: "array", title: tupleTitle, description: p.tuple,
      minItems: 1, items: scalarOrNull, example: [1.0905136363636, 0, 0, null, null]
    },
    ErrorBody: { type: "string", title: errorTitle, description: p.errorBody }
  };
}

function build(locale) {
  const p = prose[locale];
  return {
    openapi: "3.1.2",
    info: {
      title: p.title,
      description: p.description,
      version: "2026-08-14",
      termsOfService: "https://www.ecb.europa.eu/services/using-our-site/disclaimer/html/index.en.html",
      license: {
        name: "ECB website information reuse terms",
        url: "https://www.ecb.europa.eu/services/using-our-site/disclaimer/html/index.en.html"
      },
      contact: { url: "https://data.ecb.europa.eu/help/contact-us" }
    },
    servers: [{ url: "https://data-api.ecb.europa.eu/service" }],
    tags: [
      { name: "Data", description: p.dataTag },
      { name: "Metadata", description: p.metadataTag },
      { name: "Validation", description: p.schemaTag }
    ],
    paths: {
      "/data/{flowRef}": { get: dataOperation(p, false) },
      "/data/{flowRef}/{key}": { get: dataOperation(p, true) },
      "/{resource}": { get: metadataOperation(p, "list") },
      "/{resource}/{agencyID}": { get: metadataOperation(p, "agency") },
      "/{resource}/{agencyID}/{resourceID}": { get: metadataOperation(p, "artefact") },
      "/{resource}/{agencyID}/{resourceID}/{version}": {
        get: metadataOperation(p, "versioned")
      },
      "/schema/{context}/{agencyID}/{resourceID}": { get: xmlSchemaOperation(p, false) },
      "/schema/{context}/{agencyID}/{resourceID}/{version}": {
        get: xmlSchemaOperation(p, true)
      }
    },
    components: { parameters: parameters(p), schemas: schemas(p) }
  };
}

function writeJson(file, value) {
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, `${JSON.stringify(value, null, 2)}\n`);
}

function sha256(file) {
  return crypto.createHash("sha256").update(fs.readFileSync(file)).digest("hex");
}

const zhPath = path.join(specRoot, "openapi.json");
const enPath = path.join(specRoot, "locales/en-US/openapi.json");
writeJson(zhPath, build("zh"));
writeJson(enPath, build("en"));

const provenance = {
  version: 1,
  status: "approved",
  slug: "ecb-data-portal",
  verifiedAt,
  scope: {
    product: "ECB Data Portal SDMX 2.1 REST service",
    routeFamilies: ["data", "structural metadata", "structure-specific XML schemas"],
    openapiPaths: 8,
    operations: 8,
    schemas: 12,
    authentication: "none",
    transport: "HTTPS read-only"
  },
  evidence: evidence.map((url) => ({ status: "official", url })),
  license: {
    url: "https://www.ecb.europa.eu/services/using-our-site/disclaimer/html/index.en.html",
    status: "reviewed",
    requirements: [
      "Reproduced information must be accurate and cite the ECB as source.",
      "Pontx modifications must be stated explicitly."
    ]
  },
  derivation: {
    method: "Independent reconstruction from current ECB Data Portal help pages; the unlicensed sdmx-twg OpenAPI baseline is not copied.",
    liveChecks: [
      {
        method: "GET",
        target: "/data/EXR/M.USD.EUR.SP00.A",
        boundedQuery: "startPeriod=2024-01&endPeriod=2024-01&format=jsondata",
        status: 200,
        contentType: "application/vnd.sdmx.data+json;version=1.0.0-wd"
      },
      {
        method: "GET",
        target: "/dataflow/ECB/EXR/latest",
        boundedQuery: "detail=allstubs&references=none",
        status: 200,
        contentType: "application/vnd.sdmx.structure+xml;version=2.1"
      },
      {
        method: "GET",
        target: "/schema/datastructure/ECB/ECB_EXR1/1.0",
        boundedQuery: "none; response limited to 2 MiB during verification",
        status: 200,
        contentType: "application/vnd.sdmx.schema+xml;version=2.1"
      }
    ],
    limitations: [
      "The ECB pages do not declare a stable error-body schema, so error bodies remain strings.",
      "XML payloads remain typed strings because OpenAPI JSON Schema does not encode the externally generated SDMX XML vocabulary."
    ]
  },
  localization: {
    structuralSource: "zh-CN",
    locale: "en-US",
    structuralParity: "required"
  },
  sdkProbe: {
    status: "operator-published",
    packageName: "@pontx/ecb-data-portal",
    cliName: "pontx-ecb-data-portal",
    generator: "pontx@1.0.0-beta.11",
    runtime: "@pontx/sdk@1.0.0-beta.4",
    generatedOperations: 8,
    generatedSchemas: 12,
    typeCheck: "passed",
    esmCjsDeclarationsBuild: "passed",
    cliBuild: "passed",
    unitTests: { status: "passed", passed: 3, total: 3, skipped: 0 },
    e2eTests: { status: "passed", passed: 3, total: 3, skipped: 0 },
    npmPackDryRun: { status: "passed", files: 9 },
    sdkLiveChecks: ["bounded SDMX-JSON data request", "bounded structural-metadata XML request"],
    cliChecks: ["help", "catalog list", "endpoint show", "request dry-run", "bounded live data call"],
    publicationReady: true,
    limitation: "The published package intentionally calls the ECB public anonymous read-only service directly; Hub proxying remains disabled."
  },
  publication: {
    packageName: "@pontx/ecb-data-portal",
    version: "0.1.0",
    cliName: "pontx-ecb-data-portal",
    sourceCommit: "533ef4716cca0b66b50bb7a810f84504a4008f46",
    repositoryUrl: "https://github.com/pontjs/ecb-data-portal",
    workflowRunUrl: "https://github.com/pontjs/ecb-data-portal/actions/runs/31814621599",
    registryTarball: "https://registry.npmjs.org/@pontx/ecb-data-portal/-/ecb-data-portal-0.1.0.tgz",
    registryIntegrity: "sha512-/gMbs7GGkIPZzQinMYww3oW6i/iIqRCva6AzdUNZHfXYxUzwcg1B417WV6rQiFqLlu69k1ReRax4brfmZ/QDfA=="
  },
  outputs: {
    "zh-CN": { file: "specs/ecb-data-portal/openapi.json", sha256: sha256(zhPath) },
    "en-US": { file: "specs/ecb-data-portal/locales/en-US/openapi.json", sha256: sha256(enPath) }
  }
};
writeJson(path.join(specRoot, "provenance.json"), provenance);

console.log(`Built ECB candidate: ${provenance.scope.operations} operations, ${provenance.scope.schemas} schemas`);
