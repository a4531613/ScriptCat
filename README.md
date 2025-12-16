# 权限矩阵维护油猴脚本

在任意页面注入一个“权限矩阵维护”面板，用于：

- 查询：原角色清单、目标角色清单、权限点清单、页面清单（服务端不分页，脚本前端分页 + 过滤）
- 多选：四张表均支持多选（可跨页累计）
- 绑定：
  - 合并“原角色”已绑定的权限点后，绑定到“目标角色”
  - 合并“原角色”已绑定的页面后，绑定到“目标角色”
  - 直接将选中的权限点绑定到选中的目标角色
  - 直接将选中的页面绑定到选中的目标角色
- 绑定模式：`replace`（覆盖/替换）或 `add`（追加/合并）

脚本文件：`permission_matrix_maintainer.user.js`

---

## 安装

1. 安装浏览器脚本管理器（任选其一）：
   - Tampermonkey（油猴）
   - ScriptCat（脚本猫）
2. 新建脚本并粘贴 `permission_matrix_maintainer.user.js` 内容，保存启用。
3. 打开任意页面，右下角会出现“权限矩阵维护”按钮；也可通过脚本菜单打开。

---

## 使用方式

1. 打开面板后点击“全部刷新”，加载四张表数据。
2. 勾选“原角色”（可多选），勾选“目标角色”（可多选）。
3. 选择操作：
   - “合并原角色权限点 → 绑定目标角色”
   - “合并原角色页面 → 绑定目标角色”
   - “绑定选中权限点 → 目标角色”
   - “绑定选中页面 → 目标角色”
4. 通过顶部“绑定方式”选择 `覆盖绑定(替换)` 或 `追加绑定(合并)`。

面板内每张表支持：

- 过滤：输入框为前端过滤（在已拉取的全量数据中筛选）
- 分页：前端分页（服务端不分页时避免页面卡顿）
- 多选：表头复选框可对“当前页”全选/全不选；“全选(过滤后)”对过滤结果全选

---

## 配置（必须）

面板右上角点击“配置”，或脚本菜单“权限矩阵维护：编辑配置(JSON)”。

默认配置仅为示例，需要按你们实际接口与字段进行调整。

### 1) 接口配置（`api.*`）

默认结构（节选）：

```json
{
  "api": {
    "roles": { "method": "GET", "url": "/api/roles", "dataPath": "data" },
    "permissions": { "method": "GET", "url": "/api/permissions", "dataPath": "data" },
    "pages": { "method": "GET", "url": "/api/pages", "dataPath": "data" },
    "rolePermissions": { "method": "GET", "url": "/api/roles/{roleId}/permissions", "dataPath": "data" },
    "rolePages": { "method": "GET", "url": "/api/roles/{roleId}/pages", "dataPath": "data" },
    "bindPermissions": {
      "method": "POST",
      "url": "/api/roles/bind-permissions",
      "bulk": true,
      "roleIdsKey": "roleIds",
      "itemIdsKey": "permissionIds",
      "modeKey": "mode"
    },
    "bindPages": {
      "method": "POST",
      "url": "/api/roles/bind-pages",
      "bulk": true,
      "roleIdsKey": "roleIds",
      "itemIdsKey": "pageIds",
      "modeKey": "mode"
    }
  }
}
```

说明：

- `url` 支持 `{roleId}` 占位符（仅用于 `rolePermissions/rolePages`）。
- `dataPath` 用于从响应 JSON 中取列表数据（如 `data.list`、`result.records`）。
  - 若取到的对象本身就是数组，直接使用；
  - 若取到对象包含 `list` 或 `records` 数组，也会自动识别；
  - 否则当作空数组。
- 绑定接口（`bindPermissions/bindPages`）支持两种调用方式：
  - `bulk: true`：一次请求传多个角色（默认）
  - `bulk: false`：脚本会按 `roleId` 逐个调用

默认 `bulk: true` 的请求体示例：

```json
{
  "roleIds": ["1", "2"],
  "permissionIds": ["p1", "p2"],
  "mode": "replace"
}
```

> 如果你们后端不需要 `mode` 或字段名不同，改 `modeKey/roleIdsKey/itemIdsKey` 即可。

### 2) 字段映射（`fields.*`）

用于从接口返回对象中读取列字段：

```json
{
  "fields": {
    "role": { "id": "id", "name": "name", "code": "code" },
    "permission": { "id": "id", "name": "name", "code": "code" },
    "page": { "id": "id", "name": "name", "path": "path" }
  }
}
```

> 表格中的勾选主键来自 `fields.*.id` 指向的字段值（会转成字符串保存）。

---

## 常见问题

### 1) 跨域/鉴权问题

脚本使用 `GM_xmlhttpRequest` 发请求：

- 需要在元信息中允许访问目标域名（默认 `@connect *`，你也可以收敛为指定域）
- 依赖你当前浏览器会话的登录态（Cookie/Token 等），确保在已登录的系统页面使用

### 2) 数据量很大时卡顿

服务端不分页意味着前端一次性拿全量数据。建议：

- 先通过 `api.roles/api.permissions/api.pages` 增加后端过滤参数（若后端支持）
- 或把默认每页条数调小（面板内可切换）

---

## 变更与扩展建议

- 若要进一步工程化：将脚本拆成 `src/` 模块并构建输出单文件 `dist/*.user.js`（便于测试与迭代）
- 若要提升审计与可用性：增加“预览变更摘要/二次确认/导出变更明细/操作可用态提示/进度展示”等

