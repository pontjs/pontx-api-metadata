import { createHash } from "node:crypto";
import { mkdir, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import {
  importOpenAPI,
  loadPontxSpec,
  PontxSpec,
  validatePontxSpec,
  validatePontxSpecLocale,
  evaluatePontxQuality,
} from "@pontx/spec";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const outputRoot = resolve(root, "candidates/notion");
const sourceUrl = "https://developers.notion.com/openapi.json";
// Official docs-site OpenAPI 3.1 snapshot observed 2026-08-16. The document is
// mutable and carries no file-level license, so it is imported once and never
// retained or redistributed; the pinned SHA makes drift fail the build.
const sourceSha256 = "c90a4587bc951a7357419af4126c5ce6924a600255ef2b460dc6834938ea36dc";
const verifiedAt = "2026-08-16";
const latestApiVersion = "2026-03-11";

const methods = new Set(["get", "put", "post", "delete", "patch", "head", "options", "trace"]);

// Tag -> canonical key prefix (SDK Controller path) and bilingual tag text.
const tagSlug = {
  "Databases": "databases",
  "Data sources": "dataSources",
  "Pages": "pages",
  "Async tasks": "asyncTasks",
  "Blocks": "blocks",
  "Comments": "comments",
  "File uploads": "fileUploads",
  "OAuth": "oAuth",
  "Users": "users",
  "Search": "search",
  "Views": "views",
  "Custom emojis": "customEmojis",
  "Meeting notes": "meetingNotes",
};

const tagText = {
  databases: { zh: "数据库与数据源模式管理。", en: "Database and data source schema management." },
  dataSources: { zh: "数据源（数据库的新名称）与查询。", en: "Data sources (the current name for databases) and queries." },
  pages: { zh: "页面、页面属性与 Markdown 内容。", en: "Pages, page properties, and Markdown content." },
  asyncTasks: { zh: "异步任务状态与结果。", en: "Async task status and results." },
  blocks: { zh: "块对象与子块内容。", en: "Block objects and child block content." },
  comments: { zh: "评论对象与评论附件。", en: "Comment objects and comment attachments." },
  fileUploads: { zh: "文件上传生命周期（分片上传与完成）。", en: "File upload lifecycle (part upload and completion)." },
  oAuth: { zh: "OAuth 令牌的创建、撤销与检查。", en: "OAuth token creation, revocation, and introspection." },
  users: { zh: "工作区用户与连接身份。", en: "Workspace users and connection identity." },
  search: { zh: "按标题搜索页面与数据源。", en: "Search pages and data sources by title." },
  views: { zh: "数据源视图与视图查询。", en: "Data source views and view queries." },
  customEmojis: { zh: "工作区自定义表情符号。", en: "Workspace custom emojis." },
  meetingNotes: { zh: "会议记录块。", en: "Meeting note blocks." },
};
const endpointText = {
  "get-self": { zh: ["查询当前连接身份", "返回当前访问令牌对应的连接（机器人或用户）资料；个人访问令牌返回创建该令牌的用户。", "Get current connection identity", "Returns the connection (bot or user) that owns the current access token; personal access tokens resolve to the user who created them."] },
  "get-user": { zh: ["查询用户", "按用户 ID 返回工作区成员、访客或连接的用户对象。", "Retrieve a user", "Returns a user object for a workspace member, guest, or connection by user ID."] },
  "get-users": { zh: ["列出用户", "分页返回工作区中连接可见的用户列表。", "List all users", "Paginates over the users a connection can see in the workspace."] },
  "post-page": { zh: ["创建页面", "在指定父级下创建新页面，并可携带属性与子块内容。", "Create a page", "Creates a new page under a parent, optionally with property values and child blocks."] },
  "retrieve-a-page": { zh: ["查询页面", "按页面 ID 返回页面对象及其属性值。", "Retrieve a page", "Returns a page object and its property values by page ID."] },
  "patch-page": { zh: ["更新页面属性", "更新现有页面的属性值；未提供的属性保持不变。", "Update page properties", "Updates property values on an existing page; omitted properties are left unchanged."] },
  "move-page": { zh: ["移动页面", "把页面移动到新的父级或新位置，可用于调整页面层级。", "Move a page", "Moves a page to a new parent or position, which can restructure the page tree."] },
  "retrieve-a-page-property": { zh: ["查询页面属性项", "分页返回页面属性的所有值项，用于多值或超大属性。", "Retrieve a page property item", "Paginates over the value items of a page property, for multi-valued or very large properties."] },
  "retrieve-page-markdown": { zh: ["获取页面 Markdown", "把页面内容渲染为 Notion 风格的 Markdown 并返回。", "Retrieve page markdown", "Renders page content as Notion-flavored Markdown."] },
  "update-page-markdown": { zh: ["更新页面 Markdown", "用 Markdown 内容替换页面主体，可保留或替换附件。", "Update page markdown", "Replaces the page body with Markdown content, optionally preserving attachments."] },
  "retrieve-async-task": { zh: ["查询异步任务", "返回异步任务的状态、错误与结果。", "Retrieve an async task", "Returns the status, errors, and result of an asynchronous task."] },
  "retrieve-a-block": { zh: ["查询块", "按块 ID 返回块对象。", "Retrieve a block", "Returns a block object by block ID."] },
  "update-a-block": { zh: ["更新块", "更新现有块的内容或属性。", "Update a block", "Updates the content or properties of an existing block."] },
  "delete-a-block": { zh: ["删除块", "删除块及其子块；已删除的块可通过工作区恢复。", "Delete a block", "Deletes a block and its children; deleted blocks can be restored from the workspace."] },
  "get-block-children": { zh: ["查询块子内容", "分页返回块下的直接子块列表。", "Get block children", "Paginates over the direct child blocks of a block."] },
  "patch-block-children": { zh: ["追加块子内容", "在块的末尾追加新的子块。", "Append block children", "Appends new child blocks to the end of a block's children."] },
  "retrieve-a-data-source": { zh: ["查询数据源", "按 ID 返回数据源对象及其模式信息。", "Retrieve a data source", "Returns a data source object and its schema by ID."] },
  "update-a-data-source": { zh: ["更新数据源", "更新数据源的标题、说明、图标或模式。", "Update a data source", "Updates a data source title, description, icon, or schema."] },
  "post-database-query": { zh: ["查询数据源内容", "按过滤、排序与分页条件查询数据源中的条目（页面）。", "Query a data source", "Queries entries (pages) in a data source with filters, sorts, and pagination."] },
  "create-a-database": { zh: ["创建数据源（数据库）", "在父级下创建新的数据源，并定义其属性模式。", "Create a data source (database)", "Creates a new data source under a parent with a defined property schema."] },
  "list-data-source-templates": { zh: ["列出数据源模板", "分页返回数据源可用的模板。", "List data source templates", "Paginates over the templates available for a data source."] },
  "retrieve-database": { zh: ["查询数据库", "按 ID 返回数据库对象及其属性模式（旧版数据库资源）。", "Retrieve a database", "Returns a database object and its property schema by ID (legacy database resource)."] },
  "update-database": { zh: ["更新数据库", "更新数据库的标题、说明、图标或属性模式。", "Update a database", "Updates a database title, description, icon, or property schema."] },
  "create-database": { zh: ["创建数据库", "在父级下创建新的数据库对象。", "Create a database", "Creates a new database object under a parent."] },
  "post-search": { zh: ["搜索", "按查询词、对象类型过滤与排序搜索连接可见的页面和数据源。", "Search", "Searches pages and data sources visible to the connection with query, filter, and sort."] },
  "list-comments": { zh: ["列出评论", "按块或页面返回评论列表。", "List comments", "Lists comments on a block or page."] },
  "create-a-comment": { zh: ["创建评论", "在页面或块下创建文本评论，可附带附件。", "Create a comment", "Creates a text comment on a page or block, optionally with attachments."] },
  "retrieve-comment": { zh: ["查询评论", "按 ID 返回评论对象。", "Retrieve a comment", "Returns a comment object by ID."] },
  "update-a-comment": { zh: ["更新评论", "更新评论的文本内容或附件。", "Update a comment", "Updates a comment's text content or attachments."] },
  "delete-a-comment": { zh: ["删除评论", "删除一条评论。", "Delete a comment", "Deletes a comment."] },
  "list-file-uploads": { zh: ["列出文件上传", "按状态分页返回连接的文件上传记录。", "List file uploads", "Paginates over a connection's file upload records by status."] },
  "create-file": { zh: ["创建文件上传", "为不超过 20MB 的小文件创建文件上传记录并返回上传 URL 或直接数据。", "Create a file upload", "Creates a file upload record for small files up to 20 MB and returns an upload URL or inline data."] },
  "upload-file": { zh: ["上传文件分片", "以 multipart 表单上传大文件的一个分片（绑定文件上传记录 ID）。", "Upload a file part", "Uploads one part of a large file as a multipart form tied to the file upload record."] },
  "complete-file-upload": { zh: ["完成文件上传", "标记分片上传完成并返回最终的文件对象。", "Complete a file upload", "Marks a multipart upload complete and returns the final file object."] },
  "retrieve-file-upload": { zh: ["查询文件上传", "按 ID 返回文件上传记录及其状态。", "Retrieve a file upload", "Returns a file upload record and its status by ID."] },
  "list-custom-emojis": { zh: ["列出自定义表情", "分页返回工作区可用的自定义表情符号。", "List custom emojis", "Paginates over the custom emojis available in the workspace."] },
  "list-views": { zh: ["列出视图", "按数据库或数据源列出视图。", "List views", "Lists views for a database or data source."] },
  "create-view": { zh: ["创建视图", "在数据源下创建新视图。", "Create a view", "Creates a new view under a data source."] },
  "retrieve-a-view": { zh: ["查询视图", "按 ID 返回视图对象。", "Retrieve a view", "Returns a view object by ID."] },
  "update-a-view": { zh: ["更新视图", "更新视图的配置。", "Update a view", "Updates a view configuration."] },
  "delete-view": { zh: ["删除视图", "删除一个视图。", "Delete a view", "Deletes a view."] },
  "create-view-query": { zh: ["创建视图查询", "创建视图查询并返回首个结果页。", "Create a view query", "Creates a view query and returns the first page of results."] },
  "get-view-query-results": { zh: ["获取视图查询结果", "分页获取已创建视图查询的结果。", "Get view query results", "Paginates over the results of a created view query."] },
  "delete-view-query": { zh: ["删除视图查询", "删除一个视图查询。", "Delete a view query", "Deletes a view query."] },
  "create-meeting-note": { zh: ["创建会议记录", "创建会议记录块。", "Create a meeting note", "Creates a meeting note block."] },
  "query-meeting-notes": { zh: ["查询会议记录", "按条件查询会议记录。", "Query meeting notes", "Queries meeting notes with the supplied conditions."] },
  "create-a-token": { zh: ["OAuth 换取访问令牌", "用授权码或刷新令牌换取 OAuth 访问令牌（HTTP Basic 客户端凭据）。", "Exchange an OAuth access token", "Exchanges an authorization code or refresh token for an OAuth access token (HTTP Basic client credentials)."] },
  "revoke-token": { zh: ["撤销 OAuth 令牌", "撤销 OAuth 访问令牌或刷新令牌。", "Revoke an OAuth token", "Revokes an OAuth access token or refresh token."] },
  "introspect-token": { zh: ["检查 OAuth 令牌", "返回 OAuth 令牌的元数据（激活状态、类型、关联工作区）。", "Introspect an OAuth token", "Returns OAuth token metadata such as active state, type, and associated workspace."] },
};
// Official kebab-case operationId -> code-generation-suitable stable operationId.
// The repo contract requires operationIds that are safe TypeScript identifiers
// (G2), so the curated PontxSpec uses these normalized IDs; the official IDs
// remain the stable reference in evidence URLs and provenance.
const operationIdNormalization = {
  "get-self": "getSelf",
  "get-user": "getUser",
  "get-users": "getUsers",
  "post-page": "postPage",
  "retrieve-a-page": "retrievePage",
  "patch-page": "patchPage",
  "move-page": "movePage",
  "retrieve-a-page-property": "retrievePageProperty",
  "retrieve-page-markdown": "retrievePageMarkdown",
  "update-page-markdown": "updatePageMarkdown",
  "retrieve-async-task": "retrieveAsyncTask",
  "retrieve-a-block": "retrieveBlock",
  "update-a-block": "updateBlock",
  "delete-a-block": "deleteBlock",
  "get-block-children": "getBlockChildren",
  "patch-block-children": "patchBlockChildren",
  "retrieve-a-data-source": "retrieveDataSource",
  "update-a-data-source": "updateDataSource",
  "post-database-query": "queryDataSource",
  "create-a-database": "createDataSource",
  "list-data-source-templates": "listDataSourceTemplates",
  "retrieve-database": "retrieveDatabase",
  "update-database": "updateDatabase",
  "create-database": "createDatabase",
  "post-search": "search",
  "list-comments": "listComments",
  "create-a-comment": "createComment",
  "retrieve-comment": "retrieveComment",
  "update-a-comment": "updateComment",
  "delete-a-comment": "deleteComment",
  "list-file-uploads": "listFileUploads",
  "create-file": "createFileUpload",
  "upload-file": "uploadFilePart",
  "complete-file-upload": "completeFileUpload",
  "retrieve-file-upload": "retrieveFileUpload",
  "list-custom-emojis": "listCustomEmojis",
  "list-views": "listViews",
  "create-view": "createView",
  "retrieve-a-view": "retrieveView",
  "update-a-view": "updateView",
  "delete-view": "deleteView",
  "create-view-query": "createViewQuery",
  "get-view-query-results": "getViewQueryResults",
  "delete-view-query": "deleteViewQuery",
  "create-meeting-note": "createMeetingNote",
  "query-meeting-notes": "queryMeetingNotes",
  "create-a-token": "createToken",
  "revoke-token": "revokeToken",
  "introspect-token": "introspectToken",
};

const schemaText = {
  pageObjectResponse: { zh: "页面对象响应。", en: "Page object response." },
  partialPageObjectResponse: { zh: "部分页面对象响应（仅含基础字段）。", en: "Partial page object response (base fields only)." },
  databaseObjectResponse: { zh: "数据库对象响应。", en: "Database object response." },
  partialDatabaseObjectResponse: { zh: "部分数据库对象响应。", en: "Partial database object response." },
  dataSourceObjectResponse: { zh: "数据源对象响应。", en: "Data source object response." },
  partialDataSourceObjectResponse: { zh: "部分数据源对象响应。", en: "Partial data source object response." },
  blockObjectResponse: { zh: "块对象响应。", en: "Block object response." },
  partialBlockObjectResponse: { zh: "部分块对象响应。", en: "Partial block object response." },
  userObjectResponse: { zh: "用户对象响应。", en: "User object response." },
  partialUserObjectResponse: { zh: "部分用户对象响应。", en: "Partial user object response." },
  commentObjectResponse: { zh: "评论对象响应。", en: "Comment object response." },
  commentAttachmentObjectResponse: { zh: "评论附件对象响应。", en: "Comment attachment object response." },
  richTextItemResponse: { zh: "富文本项响应。", en: "Rich text item response." },
  richTextItemRequest: { zh: "富文本项请求。", en: "Rich text item request." },
  parentObjectResponse: { zh: "父级对象响应。", en: "Parent object response." },
  parentObjectRequest: { zh: "父级对象请求。", en: "Parent object request." },
  fileObjectResponse: { zh: "文件对象响应。", en: "File object response." },
  fileObjectRequest: { zh: "文件对象请求。", en: "File object request." },
  fileUploadObjectResponse: { zh: "文件上传对象响应。", en: "File upload object response." },
  viewObjectResponse: { zh: "视图对象响应。", en: "View object response." },
  asyncTaskObjectResponse: { zh: "异步任务对象响应。", en: "Async task object response." },
  propertyItemObjectResponse: { zh: "页面属性项响应。", en: "Page property item response." },
  propertyObject: { zh: "数据源属性对象。", en: "Data source property object." },
  propertyObjectResponse: { zh: "数据源属性响应。", en: "Data source property response." },
  propertyValueObject: { zh: "页面属性值对象。", en: "Page property value object." },
  publicApiCommonErrorResponse: { zh: "公共 API 通用错误响应。", en: "Common public API error response." },
  error_api_400: { zh: "请求参数无效（400）。", en: "Invalid request parameters (400)." },
  error_api_401: { zh: "未认证或令牌无效（401）。", en: "Unauthenticated or invalid token (401)." },
  error_api_403: { zh: "无权限访问（403）。", en: "Forbidden (403)." },
  error_api_404: { zh: "资源不存在（404）。", en: "Resource not found (404)." },
  error_api_406: { zh: "请求无法按要求表示（406）。", en: "Not acceptable (406)." },
  error_api_409: { zh: "请求与当前状态冲突（409）。", en: "Conflict (409)." },
  error_api_429: { zh: "请求超限（429），请遵循 Retry-After。", en: "Rate limited (429); respect Retry-After." },
  error_api_500: { zh: "上游内部错误（500）。", en: "Upstream internal error (500)." },
  error_api_503: { zh: "上游服务暂不可用（503）。", en: "Service temporarily unavailable (503)." },
  error_api_504: { zh: "上游网关超时（504）。", en: "Upstream gateway timeout (504)." },
  error_api_529: { zh: "上游过载（529），请与 429 相同方式重试。", en: "Upstream overloaded (529); retry like a 429." },
  error_oauth_400: { zh: "OAuth 请求无效（400）。", en: "Invalid OAuth request (400)." },
  error_oauth_401: { zh: "OAuth 客户端凭据无效（401）。", en: "Invalid OAuth client credentials (401)." },
  error_oauth_403: { zh: "OAuth 操作被拒绝（403）。", en: "OAuth operation denied (403)." },
  error_oauth_500: { zh: "OAuth 上游内部错误（500）。", en: "OAuth upstream internal error (500)." },
  idResponse: { zh: "对象 ID 响应。", en: "Object ID response." },
  idRequest: { zh: "对象 ID 请求。", en: "Object ID request." },
  searchResponse: { zh: "搜索结果响应。", en: "Search response." },
  listUsersResponse: { zh: "用户列表响应。", en: "User list response." },
  listBlockChildrenResponse: { zh: "子块列表响应。", en: "Block children list response." },
  listCommentsResponse: { zh: "评论列表响应。", en: "Comment list response." },
  listViewsResponse: { zh: "视图列表响应。", en: "View list response." },
  listFileUploadsResponse: { zh: "文件上传列表响应。", en: "File upload list response." },
  listCustomEmojisResponse: { zh: "自定义表情列表响应。", en: "Custom emoji list response." },
  listDataSourcesResponse: { zh: "数据源列表响应。", en: "Data source list response." },
  listDataSourceTemplatesResponse: { zh: "数据源模板列表响应。", en: "Data source template list response." },
  listViewQueryResultsResponse: { zh: "视图查询结果响应。", en: "View query results response." },
  createPageRequest: { zh: "创建页面请求。", en: "Create page request." },
  updatePageRequest: { zh: "更新页面请求。", en: "Update page request." },
  createDatabaseRequest: { zh: "创建数据库请求。", en: "Create database request." },
  updateDatabaseRequest: { zh: "更新数据库请求。", en: "Update database request." },
  createDataSourceRequest: { zh: "创建数据源请求。", en: "Create data source request." },
  updateDataSourceRequest: { zh: "更新数据源请求。", en: "Update data source request." },
  queryRequest: { zh: "数据源查询请求。", en: "Data source query request." },
  searchRequest: { zh: "搜索请求。", en: "Search request." },
  createCommentRequest: { zh: "创建评论请求。", en: "Create comment request." },
  appendBlockChildrenRequest: { zh: "追加子块请求。", en: "Append block children request." },
  updateBlockRequest: { zh: "更新块请求。", en: "Update block request." },
  createFileUploadRequest: { zh: "创建文件上传请求。", en: "Create file upload request." },
  uploadFileRequest: { zh: "上传文件分片请求。", en: "Upload file part request." },
  createViewRequest: { zh: "创建视图请求。", en: "Create view request." },
  updateViewRequest: { zh: "更新视图请求。", en: "Update view request." },
  createViewQueryRequest: { zh: "创建视图查询请求。", en: "Create view query request." },
  createMeetingNoteRequest: { zh: "创建会议记录请求。", en: "Create meeting note request." },
  queryMeetingNotesRequest: { zh: "查询会议记录请求。", en: "Query meeting notes request." },
  createTokenRequest: { zh: "OAuth 换令牌请求。", en: "OAuth token exchange request." },
  createTokenResponse: { zh: "OAuth 令牌响应。", en: "OAuth token response." },
  introspectTokenRequest: { zh: "OAuth 令牌检查请求。", en: "OAuth token introspection request." },
  introspectTokenResponse: { zh: "OAuth 令牌检查响应。", en: "OAuth token introspection response." },
  revokeTokenRequest: { zh: "OAuth 令牌撤销请求。", en: "OAuth token revocation request." },
  revokeTokenResponse: { zh: "OAuth 令牌撤销响应。", en: "OAuth token revocation response." },
};
const fieldText = {
  object: { zh: "资源对象类型。", en: "Resource object type." },
  id: { zh: "资源的 UUID v4 标识符。", en: "UUID v4 identifier of the resource." },
  title: { zh: "资源标题。", en: "Resource title." },
  description: { zh: "资源说明。", en: "Resource description." },
  parent: { zh: "父级对象。", en: "Parent object." },
  properties: { zh: "页面属性值或数据源属性模式。", en: "Page property values or data source property schema." },
  children: { zh: "子块列表。", en: "Child block list." },
  icon: { zh: "资源图标。", en: "Resource icon." },
  cover: { zh: "资源封面。", en: "Resource cover." },
  created_time: { zh: "创建时间（ISO 8601）。", en: "Creation time (ISO 8601)." },
  last_edited_time: { zh: "最后编辑时间（ISO 8601）。", en: "Last edited time (ISO 8601)." },
  created_by: { zh: "创建者。", en: "Creator." },
  last_edited_by: { zh: "最后编辑者。", en: "Last editor." },
  archived: { zh: "资源是否已归档。", en: "Whether the resource is archived." },
  in_trash: { zh: "资源是否在回收站。", en: "Whether the resource is in the trash." },
  url: { zh: "资源在 Notion 中的打开链接。", en: "Link for opening the resource in Notion." },
  public_url: { zh: "公开访问链接。", en: "Public access link." },
  request_id: { zh: "请求 ID。", en: "Request ID." },
  message: { zh: "错误消息。", en: "Error message." },
  code: { zh: "错误代码。", en: "Error code." },
  status: { zh: "HTTP 状态码。", en: "HTTP status code." },
  has_more: { zh: "是否还有更多结果。", en: "Whether more results remain." },
  next_cursor: { zh: "下一页游标（不透明，应原样回传）。", en: "Next page cursor (opaque; pass back verbatim)." },
  page_size: { zh: "每页返回条数。", en: "Number of results per page." },
  start_cursor: { zh: "分页起始游标（不透明）。", en: "Pagination start cursor (opaque)." },
  type: { zh: "对象或块类型。", en: "Object or block type." },
  name: { zh: "名称。", en: "Name." },
  email: { zh: "电子邮件地址。", en: "Email address." },
  person: { zh: "人员用户资料。", en: "Person user profile." },
  bot: { zh: "连接（机器人）资料。", en: "Connection (bot) profile." },
  owner: { zh: "连接所有者。", en: "Connection owner." },
  workspace: { zh: "工作区信息。", en: "Workspace information." },
  value: { zh: "属性值。", en: "Property value." },
  query: { zh: "搜索查询词。", en: "Search query text." },
  filter: { zh: "过滤条件。", en: "Filter conditions." },
  sort: { zh: "排序条件。", en: "Sort conditions." },
  text: { zh: "纯文本内容。", en: "Plain text content." },
  content: { zh: "文本内容。", en: "Text content." },
  link: { zh: "文本链接。", en: "Text link." },
  href: { zh: "链接地址。", en: "Link URL." },
  annotations: { zh: "文本样式标注。", en: "Text style annotations." },
  plain_text: { zh: "去样式后的纯文本。", en: "Plain text without styling." },
  mention: { zh: "提及对象。", en: "Mention object." },
  equation: { zh: "行内公式。", en: "Inline equation." },
  start: { zh: "时间范围开始。", en: "Time range start." },
  end: { zh: "时间范围结束。", en: "Time range end." },
  time_zone: { zh: "时区。", en: "Time zone." },
  format: { zh: "值格式。", en: "Value format." },
  number: { zh: "数值。", en: "Number." },
  date: { zh: "日期或时间。", en: "Date or datetime." },
  rich_text: { zh: "富文本项列表。", en: "Rich text item list." },
  select: { zh: "单选选项。", en: "Select option." },
  multi_select: { zh: "多选选项。", en: "Multi-select options." },
  checkbox: { zh: "复选框值。", en: "Checkbox value." },
  formula: { zh: "公式。", en: "Formula." },
  rollup: { zh: "汇总值。", en: "Rollup value." },
  relation: { zh: "关系引用。", en: "Relation reference." },
  people: { zh: "人员引用。", en: "People reference." },
  files: { zh: "文件列表。", en: "File list." },
  unique_id: { zh: "唯一编号。", en: "Unique ID." },
  options: { zh: "选项列表。", en: "Option list." },
  color: { zh: "颜色。", en: "Color." },
  accent: { zh: "强调色。", en: "Accent color." },
  access_level: { zh: "访问级别。", en: "Access level." },
  total: { zh: "总数。", en: "Total count." },
  additional_data: { zh: "附加数据。", en: "Additional data." },
  headers: { zh: "响应头。", en: "Response headers." },
  grant_type: { zh: "OAuth 授权类型。", en: "OAuth grant type." },
  redirect_uri: { zh: "OAuth 回调地址。", en: "OAuth redirect URI." },
  access_token: { zh: "OAuth 访问令牌。", en: "OAuth access token." },
  refresh_token: { zh: "OAuth 刷新令牌。", en: "OAuth refresh token." },
  expires_in: { zh: "令牌有效期（秒）。", en: "Token lifetime in seconds." },
  bot_id: { zh: "连接（机器人）ID。", en: "Connection (bot) ID." },
  workspace_id: { zh: "工作区 ID。", en: "Workspace ID." },
  workspace_name: { zh: "工作区名称。", en: "Workspace name." },
  active: { zh: "令牌是否激活。", en: "Whether the token is active." },
  token_type: { zh: "令牌类型。", en: "Token type." },
  workspace_icon: { zh: "工作区图标。", en: "Workspace icon." },
  workspace_owner: { zh: "工作区所有者。", en: "Workspace owner." },
  duplicated_template_id: { zh: "复制的模板 ID。", en: "Duplicated template ID." },
  source: { zh: "来源。", en: "Source." },
  destination: { zh: "目标。", en: "Destination." },
  file_upload_id: { zh: "文件上传记录 ID。", en: "File upload record ID." },
  part_number: { zh: "分片序号（1–1000）。", en: "Part number (1–1000)." },
  file: { zh: "文件二进制内容。", en: "Raw binary file content." },
  view_id: { zh: "视图 ID。", en: "View ID." },
  query_id: { zh: "视图查询 ID。", en: "View query ID." },
  data_source_id: { zh: "数据源 ID。", en: "Data source ID." },
  database_id: { zh: "数据库 ID。", en: "Database ID." },
  page_id: { zh: "页面 ID。", en: "Page ID." },
  block_id: { zh: "块 ID。", en: "Block ID." },
  comment_id: { zh: "评论 ID。", en: "Comment ID." },
  user_id: { zh: "用户 ID。", en: "User ID." },
  task_id: { zh: "异步任务 ID。", en: "Async task ID." },
  property_id: { zh: "属性 ID。", en: "Property ID." },
  include_transcript: { zh: "是否包含转录内容。", en: "Whether to include transcripts." },
  filter_properties: { zh: "仅返回指定属性的值。", en: "Return values only for the listed properties." },
  "Notion-Version": { zh: "请求使用的 API 版本日期；当前最新版本为 2026-03-11。", en: "API version date for the request; the current latest version is 2026-03-11." },
};

const structuralSchemaKeys = new Set([
  "$ref", "type", "format", "enum", "const", "default", "readOnly", "writeOnly", "nullable",
  "multipleOf", "maximum", "exclusiveMaximum", "minimum", "exclusiveMinimum", "maxLength",
  "minLength", "pattern", "contentMediaType", "contentEncoding", "maxItems", "minItems",
  "uniqueItems", "maxProperties", "minProperties", "required", "additionalProperties", "items",
  "properties", "allOf", "anyOf", "oneOf", "not",
]);

function sha256(value) {
  return createHash("sha256").update(value).digest("hex");
}

function words(name) {
  return String(name)
    .replace(/([a-z])([A-Z])/g, "$1 $2")
    .replace(/[-_./]+/g, " ")
    .trim();
}

function proseForField(name, language) {
  const curated = fieldText[name]?.[language];
  if (curated) return curated;
  return language === "zh" ? words(name) + " 字段。" : words(name) + " field.";
}

function leafExample(name, schema) {
  if (Array.isArray(schema.enum) && schema.enum.length) return schema.enum[0];
  if (schema.const !== undefined) return schema.const;
  if (schema.type === "boolean") return true;
  if (schema.type === "integer") return typeof schema.minimum === "number" ? Math.max(schema.minimum, 1) : 1;
  if (schema.type === "number") {
    if (typeof schema.exclusiveMaximum === "number") {
      const minimum = typeof schema.minimum === "number" ? schema.minimum : 0;
      return minimum + (schema.exclusiveMaximum - minimum) / 2;
    }
    if (typeof schema.maximum === "number") {
      return typeof schema.minimum === "number" ? (schema.minimum + schema.maximum) / 2 : schema.maximum;
    }
    return typeof schema.minimum === "number" ? schema.minimum : 1;
  }
  const format = schema.format;
  if (format === "uuid" || /id$/.test(name)) return "0ab51e95-9373-4d42-97f8-1b5b0a5c0b52";
  if (format === "date-time" || /time/.test(name)) return "2026-03-11T00:00:00.000Z";
  if (format === "date" || /date/.test(name)) return "2026-03-11";
  if (format === "email" || name === "email") return "member@example.com";
  if (format === "uri" || format === "url" || /url|link|href|avatar|icon|cover|image/.test(name)) return "https://example.com";
  if (name === "title" || name === "name" || name === "plain_text" || name === "content") return "Example title";
  if (name === "query") return "meeting notes";
  if (name === "color") return "default";
  if (schema.type === "string") return "example content";
  return undefined;
}

function copySchema(input, language, context) {
  if (!input || typeof input !== "object") return input;
  if (input.$ref) return { $ref: input.$ref };
  const output = {};
  for (const [key, value] of Object.entries(input)) {
    if (!structuralSchemaKeys.has(key)) continue;
    if (key === "properties") {
      output.properties = Object.fromEntries(Object.entries(value ?? {}).map(([name, child]) => [
        name,
        copySchema(child, language, { kind: "field", name, parent: context.name }),
      ]));
    } else if (["items", "additionalProperties", "not"].includes(key)) {
      output[key] = value && typeof value === "object"
        ? copySchema(value, language, { kind: "field", name: context.name, parent: context.parent })
        : value;
    } else if (["allOf", "anyOf", "oneOf"].includes(key)) {
      output[key] = value.map((entry) => copySchema(entry, language, context));
    } else {
      output[key] = value;
    }
  }
  if (!output.type && output.enum?.length) {
    output.type = output.enum.every((item) => typeof item === "string") ? "string" : "number";
  }
  if (!output.type && output.const !== undefined) {
    if (typeof output.const === "boolean") output.type = "boolean";
    else if (typeof output.const === "number") output.type = Number.isInteger(output.const) ? "integer" : "number";
    else if (typeof output.const === "string") output.type = "string";
  }
  output.title = context.kind === "schema"
    ? (language === "zh" ? context.name + " 数据结构" : context.name + " data structure")
    : (language === "zh" ? words(context.name) + " 值" : words(context.name) + " value");
  output.description = context.kind === "schema"
    ? (schemaText[context.name]?.[language] ?? proseForField(context.name, language))
    : proseForField(context.name, language);
  if (output.enum?.length) {
    output.enumValueTitles = Object.fromEntries(output.enum.map((value) => [
      String(value),
      language === "zh" ? "枚举值：" + value + "。" : "Enum value: " + value + ".",
    ]));
  }
  const compound = output.type === "object" || output.type === "array" || output.properties || output.items
    || output.additionalProperties || output.allOf || output.anyOf || output.oneOf || output.not;
  if (output.type === "null") {
    output.nullable = true;
    output.examples = [null];
  } else if (!compound) {
    const example = leafExample(context.name, output);
    if (example !== undefined) output.examples = [example];
  }
  // Normalize the OAS nullability encoding: oneOf [X, {type:"null"}] -> X with nullable: true.
  // This keeps the nullable semantics while avoiding untyped {type:"null"} branches that
  // the generator and evaluator cannot express cleanly.
  if (output.oneOf && output.oneOf.length === 2) {
    const [first, second] = output.oneOf;
    const firstNull = first && first.type === "null";
    const secondNull = second && second.type === "null";
    if (firstNull && !secondNull && second && typeof second === "object" && !second.$ref) {
      const merged = { ...second, nullable: true, title: output.title, description: output.description };
      return merged;
    }
    if (secondNull && !firstNull && first && typeof first === "object" && !first.$ref) {
      const merged = { ...first, nullable: true, title: output.title, description: output.description };
      return merged;
    }
  }
  return output;
}
function responseDescription(status, language) {
  const numeric = Number(status);
  const map = {
    200: language === "zh" ? "请求成功。" : "Request succeeded.",
    202: language === "zh" ? "已接受，任务正在异步处理。" : "Accepted; the task is being processed asynchronously.",
    400: language === "zh" ? "请求参数无效。" : "Request parameters are invalid.",
    401: language === "zh" ? "未认证或令牌无效。" : "Unauthenticated or the token is invalid.",
    403: language === "zh" ? "无权限访问该资源。" : "Access to the resource is forbidden.",
    404: language === "zh" ? "未找到指定资源。" : "The requested resource was not found.",
    406: language === "zh" ? "请求无法按要求表示。" : "The request cannot be represented as requested.",
    409: language === "zh" ? "请求与资源当前状态冲突。" : "The request conflicts with the current state of the resource.",
    429: language === "zh" ? "请求频率超限，请遵循 Retry-After 后重试。" : "Rate limited; retry after Retry-After.",
    500: language === "zh" ? "上游服务内部错误。" : "Upstream internal error.",
    503: language === "zh" ? "上游服务暂时不可用。" : "Upstream service temporarily unavailable.",
    504: language === "zh" ? "上游网关超时。" : "Upstream gateway timeout.",
    529: language === "zh" ? "上游服务过载，请按 429 相同方式重试。" : "Upstream overloaded; retry like a 429.",
  };
  if (map[numeric]) return map[numeric];
  return language === "zh" ? "上游服务返回该状态。" : "The upstream service returned this status.";
}

const SAMPLE_UUID = "0ab51e95-9373-4d42-97f8-1b5b0a5c0b52";

function sampleForSchema(schema, schemas, seen, depth) {
  if (!schema || typeof schema !== "object") return undefined;
  if (depth > 8) return undefined;
  if (schema.$ref) {
    const name = schema.$ref.split("/").pop();
    const target = schemas[name];
    if (!target || seen.has(name)) return undefined;
    const next = new Set(seen).add(name);
    return sampleForSchema(target, schemas, next, depth + 1);
  }
  if (Array.isArray(schema.oneOf) && schema.oneOf.length) {
    for (const branch of schema.oneOf) {
      const value = sampleForSchema(branch, schemas, seen, depth + 1);
      if (value !== undefined) return value;
    }
    return undefined;
  }
  if (Array.isArray(schema.anyOf) && schema.anyOf.length) {
    for (const branch of schema.anyOf) {
      const value = sampleForSchema(branch, schemas, seen, depth + 1);
      if (value !== undefined) return value;
    }
    return undefined;
  }
  if (Array.isArray(schema.allOf) && schema.allOf.length) {
    let merged = {};
    for (const branch of schema.allOf) {
      const value = sampleForSchema(branch, schemas, seen, depth + 1);
      if (value && typeof value === "object" && !Array.isArray(value)) merged = Object.assign(merged, value);
    }
    return merged;
  }
  if (schema.const !== undefined) return schema.const;
  if (Array.isArray(schema.enum) && schema.enum.length) return schema.enum[0];
  if (schema.type === "object" || schema.properties) {
    const obj = {};
    for (const name of schema.required || []) {
      const child = schema.properties?.[name];
      if (child === undefined) continue;
      const value = sampleForSchema(child, schemas, seen, depth + 1);
      if (value !== undefined) obj[name] = value;
    }
    for (const [name, child] of Object.entries(schema.properties || {})) {
      if (obj[name] !== undefined) continue;
      if (child?.const !== undefined || (Array.isArray(child?.enum) && child.enum.length)) {
        const value = sampleForSchema(child, schemas, seen, depth + 1);
        if (value !== undefined) obj[name] = value;
      }
    }
    return obj;
  }
  if (schema.type === "array" || schema.items) {
    const item = sampleForSchema(schema.items, schemas, seen, depth + 1);
    return item !== undefined ? [item] : [];
  }
  const format = schema.format;
  if (format === "uuid") return SAMPLE_UUID;
  if (format === "date-time") return "2026-03-11T00:00:00.000Z";
  if (format === "date") return "2026-03-11";
  if (format === "email") return "member@example.com";
  if (format === "uri" || format === "url") return "https://example.com";
  if (schema.type === "boolean") return true;
  if (schema.type === "integer") return typeof schema.minimum === "number" ? Math.max(schema.minimum, 1) : 1;
  if (schema.type === "number") return typeof schema.minimum === "number" ? schema.minimum : 1;
  if (schema.type === "string") return "example";
  return undefined;
}

function richText(text) {
  return [{ text: { content: text } }];
}

function bodyForOp(operationId, schema, schemas) {
  const sample = sampleForSchema(schema, schemas, new Set(), 0);
  if (operationId === "post-search") {
    return { query: "meeting notes", filter: { property: "object", value: "page" }, page_size: 10 };
  }
  if (operationId === "post-page") {
    return {
      parent: { database_id: SAMPLE_UUID },
      properties: { Name: { title: richText("Example page") } },
      children: [{ object: "block", type: "paragraph", paragraph: { rich_text: richText("Example content") } }],
    };
  }
  if (operationId === "update-a-comment") {
    return { rich_text: richText("Updated comment") };
  }
  if (operationId === "create-a-comment") {
    return { parent: { page_id: SAMPLE_UUID }, rich_text: richText("Example comment") };
  }
  if (operationId === "patch-block-children") {
    return { children: [{ object: "block", type: "paragraph", paragraph: { rich_text: richText("Appended content") } }] };
  }
  if (operationId === "create-a-database") {
    return {
      parent: { database_id: SAMPLE_UUID },
      title: richText("Example database"),
      properties: { Name: { type: "title", title: {} } },
    };
  }
  if (operationId === "create-database") {
    return {
      parent: { type: "page_id", page_id: SAMPLE_UUID },
      title: richText("Example database"),
      properties: { Name: { type: "title", title: {} } },
    };
  }
  if (operationId === "create-a-token") {
    return { grant_type: "authorization_code", code: "example_oauth_code", redirect_uri: "https://example.com/callback" };
  }
  if (operationId === "revoke-token") {
    return { token: "example_access_token" };
  }
  if (operationId === "introspect-token") {
    return { token: "example_access_token" };
  }
  if (operationId === "create-view-query") {
    return { filter: { property: "Name", value: { type: "text", text: { contains: "example" } } } };
  }
  if (operationId === "post-database-query") {
    return { page_size: 10 };
  }
  if (operationId === "create-meeting-note") {
    return { title: "Example meeting note", parent: { type: "page_id", page_id: SAMPLE_UUID }, source: { type: "file_upload", file_upload_id: SAMPLE_UUID } };
  }
  if (operationId === "query-meeting-notes") {
    return {};
  }
  if (operationId === "move-page") {
    return { parent: { page_id: SAMPLE_UUID } };
  }
  if (operationId === "create-file") {
    return { file_name: "example.txt", file_size: 1024 };
  }
  if (operationId === "upload-file") {
    return { part_number: "1", file: {} };
  }
  return sample;
}

function pathValue(name) {
  if (name === "part_number") return "1";
  return SAMPLE_UUID;
}

function queryValue(name) {
  if (name === "page_size") return 10;
  if (name === "include_transcript") return true;
  if (name === "block_id") return SAMPLE_UUID;
  if (name === "database_id") return SAMPLE_UUID;
  if (name === "data_source_id") return SAMPLE_UUID;
  return "example";
}

function requestPathValues(api) {
  const result = {};
  for (const parameter of api.parameters || []) {
    if (parameter.in === "path") result[parameter.name] = pathValue(parameter.name);
  }
  return result;
}
function disabledReason(language) {
  return language === "zh"
    ? "Notion 工作区数据属于最终用户私有内容，且 Developer Terms 对集成方施加数据使用与隐私义务；Pontx Hub 不代理、缓存或聚合 Notion 工作区数据。请由调用方使用本地 SDK/CLI 直连，并自行承担与 Notion 之间的条款与数据合规责任。"
    : "Notion workspace data is private End User content and the Developer Terms impose data-handling and privacy obligations on integrators; Pontx Hub does not proxy, cache, or aggregate Notion workspace data. Use the local SDK/CLI to call upstream directly and own your own terms and data-compliance obligations with Notion.";
}

function curateApi(key, api, language, schemas) {
  const text = endpointText[api.operationId];
  if (!text) throw new Error("Missing curated endpoint text: " + api.operationId);
  const [summary, description] = language === "zh" ? [text.zh[0], text.zh[1]] : [text.zh[2], text.zh[3]];
  const parameters = (api.parameters ?? []).map((parameter) => ({
    in: parameter.in,
    name: parameter.name,
    required: Boolean(parameter.required),
    schema: parameter.schema ? copySchema(parameter.schema, language, { kind: "field", name: parameter.name }) : undefined,
  }));
  const responses = Object.fromEntries(Object.entries(api.responses ?? {}).map(([status, response]) => [
    status,
    {
      description: responseDescription(status, language),
      ...(response.schema ? { schema: copySchema(response.schema, language, { kind: "schema", name: api.operationId + "Response" }) } : {}),
      ...(response.content ? {
        content: Object.fromEntries(Object.entries(response.content).map(([mediaType, media]) => [
          mediaType,
          media.schema ? { schema: copySchema(media.schema, language, { kind: "schema", name: api.operationId + "Response" }) } : {},
        ])),
      } : {}),
    },
  ]));
  const isOAuth = (api.tags && api.tags[0] === "OAuth");
  const request = { path: requestPathValues(api), query: {}, headers: { "Notion-Version": latestApiVersion } };
  for (const parameter of parameters) {
    if (parameter.in === "query" && parameter.required) request.query[parameter.name] = queryValue(parameter.name);
  }
  const bodyParameter = parameters.find((parameter) => parameter.in === "body");
  if (bodyParameter && bodyParameter.schema) {
    request.body = bodyForOp(api.operationId, bodyParameter.schema, schemas);
  }
  const evidence = [sourceUrl, "https://developers.notion.com/reference/" + api.operationId];
  return {
    summary,
    description,
    operationId: operationIdNormalization[api.operationId],
    tags: [tagSlug[api.tags[0]]],
    method: api.method,
    path: api.path,
    consumes: api.consumes ?? [],
    produces: api.produces ?? ["application/json"],
    parameters,
    responses,
    security: isOAuth ? [{ basicAuth: [] }] : [{ bearerAuth: [] }],
    requestExamples: {
      default: {
        summary: language === "zh" ? "可复现的请求示例（不含凭证）" : "Reproducible request example (no credentials)",
        request,
        expectedStatus: "200",
        serverUrl: "https://api.notion.com",
        verifiedAt,
      },
    },
    metadata: {
      documentation: {
        status: "official",
        evidence,
        verifiedAt,
      },
      execution: { enabled: false, disabledReason: disabledReason(language) },
    },
  };
}

function buildSpec(imported, language) {
  const schemas = imported.components.schemas;
  const apis = Object.fromEntries(Object.entries(imported.apis).map(([key, api]) => {
    const tag = api.tags && api.tags[0] ? api.tags[0] : "untagged";
    const prefix = tagSlug[tag];
    if (!prefix) throw new Error("Unexpected tag " + tag + " on " + api.operationId);
    const normalizedId = operationIdNormalization[api.operationId];
    if (!normalizedId) throw new Error("Missing operationId normalization for " + api.operationId);
    const newKey = prefix + "/" + normalizedId;
    return [newKey, curateApi(key, api, language, schemas)];
  }));
  const usedTags = [...new Set(Object.values(apis).flatMap((api) => api.tags))];
  const bareRefTargets = (name) => {
    let schema = schemas[name];
    const seen = new Set();
    while (schema && typeof schema === "object" && Object.keys(schema).length === 1 && schema.$ref) {
      if (seen.has(name)) return schema;
      seen.add(name);
      const target = String(schema.$ref).split("/").pop();
      if (!schemas[target]) return schema;
      schema = schemas[target];
      name = target;
    }
    return schema;
  };
  const localizedSchemas = Object.fromEntries(Object.entries(schemas).map(([name, schema]) => [
    name,
    (schema && typeof schema === "object" && Object.keys(schema).length === 1 && schema.$ref)
      ? copySchema(bareRefTargets(name), language, { kind: "schema", name })
      : copySchema(schema, language, { kind: "schema", name }),
  ]));
  return loadPontxSpec({
    pontx: "2.1",
    style: "RESTFul",
    name: "notion",
    info: language === "zh"
      ? { title: "Notion API", version: latestApiVersion, description: "Notion 官方版本化公共 API：页面、块、数据源/数据库、评论、文件上传、视图、用户、搜索、异步任务与 OAuth。完整边界为官方文档站 OpenAPI 快照中的 49 个 Endpoint；Undocumented 内部 API 与独立 Admin API 不在此集合内。工作区数据为私有用户内容，Pontx 不代理、缓存或聚合，调用方使用本地 SDK/CLI 直连。" }
      : { title: "Notion API", version: latestApiVersion, description: "The official versioned Notion public API: pages, blocks, data sources/databases, comments, file uploads, views, users, search, async tasks, and OAuth. The complete boundary is the 49 endpoints in the official docs-site OpenAPI snapshot; the undocumented internal API and the separate Admin API are not part of this collection. Workspace data is private user content; Pontx does not proxy, cache, or aggregate it, and callers use the local SDK/CLI to connect directly." },
    servers: [{
      id: "notion-production",
      url: "https://api.notion.com",
      description: language === "zh" ? "Notion API 生产 HTTPS 服务（路径前缀 /v1）。" : "Notion API production HTTPS service (path prefix /v1).",
    }],
    security: [{ bearerAuth: [] }],
    externalDocs: {
      url: "https://developers.notion.com/reference/intro",
      description: language === "zh" ? "供应商 Notion API 官方参考。" : "Supplier Notion API official reference.",
    },
    components: {
      schemas: localizedSchemas,
      securitySchemes: {
        bearerAuth: {
          type: "http",
          scheme: "bearer",
          description: language === "zh" ? "Bearer 令牌：内部连接令牌或个人访问令牌，通过 Authorization: Bearer 头提供；请通过 NOTION_ACCESS_TOKEN 环境变量注入，不要写入日志或仓库。" : "Bearer token (internal connection token or personal access token) sent as Authorization: Bearer; inject via the NOTION_ACCESS_TOKEN environment variable and never log or commit it.",
        },
        basicAuth: {
          type: "http",
          scheme: "basic",
          description: language === "zh" ? "OAuth 端点使用 HTTP Basic 客户端凭据（OAuth client id/secret）；请通过环境变量注入。" : "OAuth endpoints use HTTP Basic client credentials (OAuth client id/secret); inject via environment variables.",
        },
      },
    },
    tags: usedTags.map((name) => ({ name, description: tagText[name]?.[language] ?? name })),
    apis,
  }, { expectedName: "notion" });
}
const expectedOperations = {
  "get-self": "users", "get-user": "users", "get-users": "users",
  "post-page": "pages", "retrieve-a-page": "pages", "patch-page": "pages", "move-page": "pages",
  "retrieve-a-page-property": "pages", "retrieve-page-markdown": "pages", "update-page-markdown": "pages",
  "retrieve-async-task": "asyncTasks",
  "retrieve-a-block": "blocks", "update-a-block": "blocks", "delete-a-block": "blocks",
  "get-block-children": "blocks", "patch-block-children": "blocks",
  "retrieve-a-data-source": "dataSources", "update-a-data-source": "dataSources",
  "post-database-query": "dataSources", "create-a-database": "dataSources", "list-data-source-templates": "dataSources",
  "retrieve-database": "databases", "update-database": "databases", "create-database": "databases",
  "post-search": "search",
  "list-comments": "comments", "create-a-comment": "comments", "retrieve-comment": "comments",
  "update-a-comment": "comments", "delete-a-comment": "comments",
  "list-file-uploads": "fileUploads", "create-file": "fileUploads", "upload-file": "fileUploads",
  "complete-file-upload": "fileUploads", "retrieve-file-upload": "fileUploads",
  "list-custom-emojis": "customEmojis",
  "list-views": "views", "create-view": "views", "retrieve-a-view": "views", "update-a-view": "views",
  "delete-view": "views", "create-view-query": "views", "get-view-query-results": "views", "delete-view-query": "views",
  "create-meeting-note": "meetingNotes", "query-meeting-notes": "meetingNotes",
  "create-a-token": "oAuth", "revoke-token": "oAuth", "introspect-token": "oAuth",
};

const sourceResponse = await fetch(sourceUrl);
if (!sourceResponse.ok) throw new Error("Unable to fetch official Notion API contract: HTTP " + sourceResponse.status);
const sourceBytes = Buffer.from(await sourceResponse.arrayBuffer());
if (sha256(sourceBytes) !== sourceSha256) {
  throw new Error("Official Notion API contract changed: expected " + sourceSha256 + ", received " + sha256(sourceBytes));
}
const imported = importOpenAPI(JSON.parse(sourceBytes.toString("utf8")), { name: "notion" });
const upstream = Object.entries(imported.apis).filter(([, api]) => methods.has(api.method.toLowerCase()));
const upstreamIds = upstream.map(([, api]) => api.operationId).sort();
const expectedIds = Object.keys(expectedOperations).sort();
if (JSON.stringify(upstreamIds) !== JSON.stringify(expectedIds)) {
  throw new Error("Notion API boundary mismatch: expected " + expectedIds.length + " endpoints, received " + upstreamIds.length + "\nMissing: " + expectedIds.filter((id) => !upstreamIds.includes(id)).join(", ") + "\nExtra: " + upstreamIds.filter((id) => !expectedIds.includes(id)).join(", "));
}
for (const [, api] of upstream) {
  const tag = api.tags && api.tags[0] ? api.tags[0] : null;
  if (!tag || tagSlug[tag] !== expectedOperations[api.operationId]) {
    throw new Error("Notion endpoint tag mismatch: " + api.operationId + " tag=" + tag);
  }
}

const zh = buildSpec(imported, "zh");
const en = buildSpec(imported, "en");
const zhBytes = Buffer.from(JSON.stringify(PontxSpec.reOrder(zh), null, 2) + "\n");
const enBytes = Buffer.from(JSON.stringify(PontxSpec.reOrder(en), null, 2) + "\n");

// Structural validation and locale isomorphism
const zhValidation = validatePontxSpec(zh);
if (!zhValidation.valid) {
  throw new Error("zh PontxSpec invalid: " + zhValidation.issues.map((issue) => issue.message).join(" | "));
}
const localeValidation = validatePontxSpecLocale(zh, en);
if (localeValidation.issues.length) {
  throw new Error("en-US locale not isomorphic: " + localeValidation.issues.map((issue) => issue.message).join(" | "));
}
const zhEndpointCount = Object.keys(zh.apis).length;
const zhSchemaCount = Object.keys(zh.components.schemas).length;
if (zhEndpointCount !== 49) throw new Error("Expected 49 Endpoints, got " + zhEndpointCount);

const quality = evaluatePontxQuality({
  spec: zh,
  defaultLocale: "zh-CN",
  locales: { "en-US": en },
});

const product = {
  formatVersion: 1,
  slug: "notion",
  name: "Notion API",
  provider: "Notion",
  category: "Productivity",
  display: {
    title: "Notion 协作工作区 API",
    summary: "通过官方版本化 Notion API 管理页面、块、数据源/数据库、评论、文件上传、视图、用户与搜索，并支持 OAuth 与异步任务。完整边界为官方 OpenAPI 快照中的 49 个 Endpoint；工作区数据为私有用户内容，Pontx 不代理、缓存或聚合，调用方使用本地 SDK/CLI 直连。",
    accent: "#FFFFFF",
  },
  legal: {
    license: "Notion Developer Terms; official SDK MIT (Notion Labs, Inc.)",
    attributionUrl: "https://notion.notion.site/Developer-Terms-ba4131408d0844e08330da2cbb225c20",
  },
  documentation: {
    status: "official",
    evidence: [
      sourceUrl,
      "https://developers.notion.com/reference/intro",
      "https://developers.notion.com/reference/versioning",
      "https://developers.notion.com/reference/request-limits",
      "https://github.com/makenotion/notion-sdk-js",
      "https://notion.notion.site/Developer-Terms-ba4131408d0844e08330da2cbb225c20",
    ],
    verifiedAt,
    contentUpdatedAt: verifiedAt,
    stabilityNote: "完整边界为官方文档站 openapi.json 快照（OpenAPI 3.1，Notion-Version 2026-03-11）中的 49 个 Endpoint；Undocumented 内部 API（tag=Internal）与独立 Admin API（独立 server /admin）不在本集合内。官方 OAS 为可变文档且无文件级许可证，因此仅一次性导入并保留 SHA 证据，不随仓库再分发。工作区数据是最终用户私有内容，Developer Terms 对集成方施加数据使用与隐私义务；Pontx Hub 不代理、缓存或聚合任何 Notion 工作区数据，调用方应自行确认条款与数据合规后通过本地 SDK/CLI 直连。",
  },
  pricing: {
    status: "free",
    summary: "API 使用随 Notion 订阅提供；每个连接平均每秒 3 个请求，并受工作区套餐共享配额限制（429 返回 rate_limited，遵循 Retry-After）。无独立 API 计费，但工作区套餐本身可能收费。",
    officialUrl: "https://developers.notion.com/reference/request-limits",
    verifiedAt,
  },
  credentials: [
    {
      schemeId: "bearerAuth",
      envVar: "NOTION_ACCESS_TOKEN",
      description: "内部连接令牌或个人访问令牌（Notion-Version 2026-03-11）；凭据仅保留在调用者当前浏览器会话或本地环境变量中。",
    },
    {
      schemeId: "basicAuth",
      usernameEnvVar: "NOTION_OAUTH_CLIENT_ID",
      passwordEnvVar: "NOTION_OAUTH_CLIENT_SECRET",
      description: "OAuth 公共连接客户端凭据，用于 /v1/oauth 端点；凭据仅保留在调用者当前浏览器会话或本地环境变量中。",
    },
  ],
  quickStart: { operationId: "getSelf", requestExampleId: "default" },
};
const productEn = {
  display: {
    title: "Notion collaborative workspace API",
    summary: "Manage pages, blocks, data sources/databases, comments, file uploads, views, users, and search through the official versioned Notion API, with OAuth and async tasks. The complete boundary is the 49 endpoints in the official OpenAPI snapshot; workspace data is private user content, so Pontx does not proxy, cache, or aggregate it and callers use the local SDK/CLI directly.",
    accent: "#FFFFFF",
  },
  documentation: {
    status: "official",
    evidence: product.documentation.evidence,
    verifiedAt,
    contentUpdatedAt: verifiedAt,
    stabilityNote: "The complete boundary is the 49 endpoints in the official docs-site openapi.json snapshot (OpenAPI 3.1, Notion-Version 2026-03-11); the undocumented internal API (tag=Internal) and the separate Admin API (separate /admin server) are not part of this collection. The official OAS is a mutable document with no file-level license, so it is imported once and its SHA is retained as evidence without redistributing the document. Workspace data is private End User content and the Developer Terms impose data-handling and privacy obligations on integrators; Pontx Hub does not proxy, cache, or aggregate any Notion workspace data, and callers must confirm their own terms and data-compliance posture before connecting directly via the local SDK/CLI.",
  },
  pricing: {
    status: "free",
    summary: "API access is included with Notion subscriptions; each connection averages three requests per second and is also subject to the workspace plan shared quota (429 rate_limited responses carry Retry-After). There is no separate API billing, although the workspace plan itself may be paid.",
    officialUrl: "https://developers.notion.com/reference/request-limits",
    verifiedAt,
  },
  credentials: [
    {
      schemeId: "bearerAuth",
      description: "Internal connection token or personal access token (Notion-Version 2026-03-11); credentials live only in the caller’s current browser session or local environment.",
    },
    {
      schemeId: "basicAuth",
      description: "OAuth public-connection client credentials for the /v1/oauth endpoints; credentials live only in the caller’s current browser session or local environment.",
    },
  ],
};

const sdkTsExample = "import { createNotionClient } from "
  + JSON.stringify("@pontx/notion") + ";" + "\n\n"
  + "const client = createNotionClient({ auth: process.env.NOTION_ACCESS_TOKEN });" + "\n"
  + "const me = await client.users.getSelf();";
const sdkCliExample = "pnpm add --global @pontx/notion" + "\n\n"
  + "pontx-notion call users get-self --dry-run";

const sdk = {
  formatVersion: 1,
  package: {
    name: "@pontx/notion",
    version: "0.1.0",
    status: "planned",
    repository: "https://github.com/pontjs/notion",
  },
  cli: { name: "pontx-notion" },
  contract: {
    client: { kind: "factory", factory: "createNotionClient", identifier: "client", options: { auth: "NOTION_ACCESS_TOKEN" } },
    controllers: {
      databases: "databases",
      dataSources: "dataSources",
      pages: "pages",
      asyncTasks: "asyncTasks",
      blocks: "blocks",
      comments: "comments",
      fileUploads: "fileUploads",
      oAuth: "oAuth",
      users: "users",
      search: "search",
      views: "views",
      customEmojis: "customEmojis",
      meetingNotes: "meetingNotes",
    },
  },
  examples: {
    typescript: sdkTsExample,
    cli: sdkCliExample,
  },
  coverage: { mode: "full" },
  spec: { path: "candidates/notion/spec.pontx.json", sha256: sha256(zhBytes) },
};
const provenance = {
  formatVersion: 1,
  status: "candidate-contract-staged",
  canonicalSpec: "candidates/notion/spec.pontx.json",
  import: {
    format: "OpenAPI 3.1.0",
    importer: "@pontx/spec importOpenAPI",
    sourceUrl,
    sourceSha256,
    observedAt: verifiedAt,
    retained: "The official OpenAPI document is mutable, carries no file-level license, and Notion Developer Terms section 3.1(a) prohibits copying, modifying, displaying, or distributing the API and its materials for third-party use. It is therefore imported once and never stored or redistributed in this repository; the pinned SHA-256 is the reproducibility evidence.",
  },
  license: {
    status: "reviewed",
    sourceRepository: "https://github.com/makenotion/notion-sdk-js",
    spdx: "MIT (official SDK @notionhq/client 5.25.2, commit 4ce79c7bc6862b9900582ae7190e945c20f984fd)",
    url: "https://github.com/makenotion/notion-sdk-js/blob/main/LICENSE",
    termsUrl: "https://notion.notion.site/Developer-Terms-ba4131408d0844e08330da2cbb225c20",
    analysis: "Notion Labs publishes the official JavaScript SDK under MIT, which licenses the SDK source (including the API contract types) for use, copy, modification, and distribution. The Developer Terms (2.1) license using the API to develop and implement Integrations that communicate with the Service, which is the intended purpose for a generated client SDK. Section 3.1(a) restricts copying or distributing the API and its accompanying materials (the OpenAPI document, docs, SDK) for third-party use, so the OAS is not retained or redistributed and all Hub copy is independently authored. Sections 3.1(c)/(h) prohibit replicating or competing with the Services; an SDK/CLI client does not replicate Notion. Section 5.9 requires complying with the Notion Brand Guidelines and avoiding implied endorsement, certification, or affiliation. Sections 4.2/4.4 impose direct End User terms and data-subject obligations on integrators, which supports caller-direct execution instead of a shared Hub proxy.",
    verdict: "An independently authored bilingual PontxSpec and a generated @pontx/notion SDK/CLI can be published with these boundaries: no redistribution of Notion API materials (OAS/docs/SDK code), descriptive trademark use only, no implied official endorsement, no Hub proxying/caching/aggregation of workspace data, and no reuse of Notion SDK source in the generated client.",
  },
  terms: {
    url: "https://notion.notion.site/Developer-Terms-ba4131408d0844e08330da2cbb225c20",
    verifiedAt,
    apiVersion: "Notion-Version 2026-03-11 (latest per versioning reference)",
    rateLimits: "Per connection: average 3 requests/second with bursts; per workspace: shared across connections and scaled to plan. 429 returns rate_limited and Retry-After; 529 means service_overload. Official guidance: retry 429/529 always, retry 5xx only for idempotent GET/DELETE.",
    hubPolicy: "Hub proxying, caching, aggregation, and workspace-data display are disabled for every endpoint. The local SDK/CLI connects directly only at the caller’s direction with the caller’s own session credentials, and callers remain responsible for Notion terms and data compliance.",
  },
  derivation: {
    boundary: "All 49 endpoints in the official docs-site openapi.json (Notion API v1.0.0, Notion-Version 2026-03-11). The undocumented internal API (71 endpoints, tag=Internal) and the separate Admin API (29 endpoints, server https://api.notion.com/admin) are explicitly excluded from this product boundary.",
    method: "one-time @pontx/spec importOpenAPI conversion followed by a source-free, bilingual PontxSpec curation; methods, paths, required Notion-Version header, parameters, response statuses, media types, schemas, nullable fields, enums, and constraints are retained. The OAS is not retained in the repository.",
    paths: 34,
    endpoints: 49,
    schemas: zhSchemaCount,
    methods: { GET: 24, POST: 16, PATCH: 7, DELETE: 2 },
    responseMediaTypes: ["application/json", "multipart/form-data"],
  },
  riskReview: {
    classification: "private-workspace-content-with-integration-terms",
    mutations: 25,
    credentials: "Bearer tokens (internal connection / PAT) and OAuth client credentials; modeled as environment variables only.",
    execution: "All Hub execution is disabled because workspace content is private End User data and the Developer Terms impose integrator data-handling obligations. The package exposes caller-direct reads and writes; mutations require preview-first and exact confirmation, and no production mutation is used for validation.",
  },
  webhooks: {
    events: ["commentCreated", "commentDeleted", "commentUpdated", "dataSourceContentUpdated", "dataSourceCreated", "dataSourceDeleted", "dataSourceMoved", "dataSourceSchemaUpdated", "dataSourceUndeleted", "databaseContentUpdated", "databaseCreated", "databaseDeleted", "databaseMoved", "databaseSchemaUpdated", "databaseUndeleted", "fileUploadCompleted", "fileUploadCreated", "fileUploadExpired", "fileUploadUploadFailed", "pageContentUpdated", "pageCreated", "pageDeleted", "pageLocked", "pageMoved", "pagePropertiesUpdated", "pageTranscriptionBlockTranscriptDeleted", "pageUndeleted", "pageUnlocked", "viewCreated", "viewDeleted", "viewUpdated"],
    note: "Webhooks are provider-to-caller HTTP callbacks (Notion POSTs signed events to the caller’s endpoint). They are documented in the official OpenAPI webhooks section and the SDK provides signature verification, but they are not callable Pontx Endpoints and are not modeled as such.",
  },
  outputs: {
    "zh-CN": { path: "candidates/notion/spec.pontx.json", sha256: sha256(zhBytes), endpoints: zhEndpointCount, schemas: zhSchemaCount },
    "en-US": { path: "candidates/notion/locales/en-US/spec.pontx.json", sha256: sha256(enBytes), endpoints: zhEndpointCount, schemas: zhSchemaCount },
  },
  quality: {
    staticScore50: quality.staticScore,
    summary: quality.summary ?? "",
  },
};
const attribution = "# Notion attribution\n"
  + "\n"
  + "This directory stages the Notion API candidate contract. The official OpenAPI document from [" + sourceUrl + "](" + sourceUrl + ") was observed on " + verifiedAt + " and is imported once; the document itself is not redistributed here (Notion Developer Terms section 3.1(a)).\n"
  + "\n"
  + "The official JavaScript SDK [makenotion/notion-sdk-js](https://github.com/makenotion/notion-sdk-js) is MIT-licensed by Notion Labs, Inc. and is referenced for contract reconciliation; no SDK source is copied into the PontxSpec or the generated client.\n"
  + "\n"
  + "Use of the Notion API is governed by the [Notion Developer Terms](https://notion.notion.site/Developer-Terms-ba4131408d0844e08330da2cbb225c20). The Notion name is used descriptively; this project is not affiliated with or endorsed by Notion.\n";

await mkdir(resolve(outputRoot, "locales/en-US"), { recursive: true });
await mkdir(resolve(outputRoot, "sources"), { recursive: true });
await writeFile(resolve(outputRoot, "product.json"), JSON.stringify(product, null, 2) + "\n");
await writeFile(resolve(outputRoot, "locales/en-US/product.json"), JSON.stringify(productEn, null, 2) + "\n");
await writeFile(resolve(outputRoot, "spec.pontx.json"), zhBytes);
await writeFile(resolve(outputRoot, "locales/en-US/spec.pontx.json"), enBytes);
await writeFile(resolve(outputRoot, "sdk.json"), JSON.stringify(sdk, null, 2) + "\n");
await writeFile(resolve(outputRoot, "sources/provenance.json"), JSON.stringify(provenance, null, 2) + "\n");
await writeFile(resolve(outputRoot, "sources/ATTRIBUTION.md"), attribution);

const findings = quality.report?.findings ?? [];
const criticals = findings.filter((item) => item.severity === "Critical");
const majors = findings.filter((item) => item.severity === "Major");
const minors = findings.filter((item) => item.severity === "Minor");
console.log("Built Notion API candidate: " + zhEndpointCount + " Endpoints, " + zhSchemaCount + " Schemas, zh SHA-256 " + sha256(zhBytes) + ".");
console.log("Static quality score: " + quality.staticScore + "/50; findings: " + criticals.length + " Critical, " + majors.length + " Major, " + minors.length + " Minor.");
for (const item of criticals.slice(0, 20)) console.log("CRITICAL: " + (item.message ?? item.ruleId));
for (const item of majors.slice(0, 30)) console.log("MAJOR: " + (item.message ?? item.ruleId));
