# CLAUDE.md

本文件为 Claude Code（claude.ai/code）在本仓库中工作时提供指导。


## 权限模型（核心领域——先读 SQL 文件头）

[doc/cloudhub_admin_v1.sql](doc/cloudhub_admin_v1.sql) 顶部注释块（第 1–30 行）是模型的权威说明。修改表结构时请同步维护该注释。规则如下：

1. **组织树**最多 9 级。`sys_org.ancestors` 保存逗号分隔的祖级路径（如 `0,100,101`），子组织通过 `FIND_IN_SET` 继承权限。
2. **用户不直接绑定组织。** `sys_user_post` 为多对多且不分主次，组织归属由岗位推导；一个用户可持有跨组织的多个岗位。
3. **岗位挂在组织下**（`sys_post.org_id`），可通过 `sys_post.parent_id` 形成汇报线，汇报线可跨组织。
4. **责任岗位**：每个组织有且仅有一个 `sys_org.leader_post_id`，在岗人即该组织责任人。岗位表刻意不再冗余 `is_leader`。
5. **功能权限 = 角色 ∪ 岗位 ∪ 组织**：`sys_role_menu`（授予用户的角色）∪ `sys_post_menu`（岗位直授）∪ `sys_org_menu`（组织直授，沿组织树向下继承）。岗位与组织绝不经过角色取得权限。
6. **数据权限只来源于角色**：`sys_role.data_scope` —— `1` 全部、`2` 自定义（经 `sys_role_scope_org`）、`3` 本组织、`4` 本组织及以下、`5` 仅本人。无角色的用户兜底为「仅本人」。岗位/组织直授不携带数据范围。
7. **菜单分三级**：`M` 目录 / `C` 菜单 / `F` 动作。`F` 行的 `perms` 即后端鉴权点。
8. **授权入口统一收敛在「权限管理」页**（`system:perm:save`、`system:perm:dataScope`）。原有的 `system:post:perm` 与 `system:role:authMenu` 动作已被有意移除。

`v_user_permission` 是规则 5 的可执行定义：以 `UNION` 合并三个来源，并输出 `grant_source`（`user` / `post` / `org`）与 `source_id`。原型中的对应实现是 `userPermInfo()`，按来源拆分的实现是 `upvSources()`。两者需同步修改。

原型用于演示预期行为；SQL 才是真实后端应实现的内容。


## 约定

- 状态位：`'0'` 正常，`'1'` 停用。软删除：`del_flag` 为 `'0'` 存在、`'2'` 删除。查询与视图均按此过滤。
- 编码规则：组织 `ZZ` + `yyyymmdd` + 6 位序列号；岗位 `GW` + `yyyymmdd` + 6 位序列号。
- ID 规则：菜单根 `1000`；菜单为 `1001`–`1007`；动作为 `100xx`。`perms` 格式为 `模块:实体:动作`。
- 所有种子用户的密码均为 `admin123` 的 BCrypt 值。
- 不设外键约束，引用完整性由应用/查询逻辑保证；脚本通过 `FOREIGN_KEY_CHECKS` 开关控制。
- 界面文案、代码注释与字段注释均使用中文，请保持中文。
- SQL 文件头记录了 v4 中刻意删除的字段（如 `sys_post.is_leader`、`sys_post.is_auto`、`sys_menu.visible`、`sys_user.avatar`）。未经明确的模型变更，不要重新引入。


## 后端（admin-monorepo/apps/api）

**技术栈**：Node.js 20+、Hono 4、`@hono/zod-openapi`、Zod 4、mysql2 + Drizzle ORM、JWT（`hono/jwt`）、tsup、pnpm workspace + Turbo。API 为 ESM，相对导入必须带 `.js` 后缀。

### 分层职责

| 目录 | 职责 |
| --- | --- |
| [routes/](admin-monorepo/apps/api/src/routes/) | 用 `createRoute` 声明方法、路径、参数、响应与 `requirePerm` 中间件，只做编排 |
| [controllers/](admin-monorepo/apps/api/src/controllers/) | 解析入参（`parseJson` / `parseQuery` / `parseId`）、调用 service、用 `success()` 输出 |
| [services/](admin-monorepo/apps/api/src/services/) | 业务规则与 SQL，事务通过 `dbClient.transaction` |
| [validators/](admin-monorepo/apps/api/src/validators/) | 请求参数 Zod schema（只描述入参） |
| [openapi/models.ts](admin-monorepo/apps/api/src/openapi/models.ts) | 响应模型与 `successResponse` / `errorResponses`（只描述出参，每个模型注明使用它的接口） |
| [middleware/](admin-monorepo/apps/api/src/middleware/) | `authenticate`（JWT + 回查用户状态）、`requirePerm`（`v_user_permission`）、`errorHandler` |
| [config/env.ts](admin-monorepo/apps/api/src/config/env.ts) | 环境变量 Zod 校验，失败即退出 |
| [db/index.ts](admin-monorepo/apps/api/src/db/index.ts) | 应用级 `DatabaseClient` 实例 |

共享包：

- [@cloudhub/db](admin-monorepo/packages/db/)：Drizzle schema + `DatabaseClient`。优先用 `db` 查询构建器；复杂聚合可退回 `query` / `queryOne` / `execute` 参数化 SQL；写多表时用 `transaction`。
- [@cloudhub/types](admin-monorepo/packages/types/)：DTO、实体、枚举与 `PERMS` 常量。权限字符串只从这里引用，不要散落字面量。
- [@cloudhub/utils](admin-monorepo/packages/utils/)：分页归一化、日期、CSV、SQL 占位符、UA 解析等无副作用纯函数。

### 请求链路与错误

`route → authenticate → requirePerm → controller → service → dbClient`。业务代码主动抛 `HttpError(status, message)`；`errorHandler` 把 `HttpError`、`ZodError`、MySQL 错误统一成 `{ code, message, data }`：

- `code` 与 HTTP 状态码一致，成功为 `200`，失败时 `data` 为 `null`，`message` 为中文。
- 重复键 `ER_DUP_ENTRY` → `409`；表缺失 → `500`；数据库连接失败 → `503`。
- 未捕获异常不向客户端泄露 SQL 或堆栈，仅在服务端日志打印。

### 接口约定

- 前缀 `/api`；`GET /health` 同时探测数据库；文档 `/api/docs`，OpenAPI 3.1 JSON `/api/openapi.json`。
- 文档页已开启 Scalar 的 `persistAuth`：在 Authentication 中填入 Bearer Token 后会保存在浏览器 localStorage，刷新不丢失；登录接口返回的 Token 不会自动写入，需要复制到 Authentication 面板。
- 除 `POST /api/auth/login` 外均需 `Authorization: Bearer <token>`。JWT 每次请求回查 `sys_user`，停用或删除后立即失效。
- 分页统一返回 `{ list, total, page, pageSize }`；`pageSize` 默认 10、上限 100。
- 功能权限只经 `requirePerm(PERMS.X)` 校验，内部查询 `v_user_permission`；多个权限为「满足任意一个」。
- 数据范围由 service 调 `resolveDataScope(userId)` 解析，多角色取最宽的一档，无角色兜底「仅本人」。
- 软删除与状态过滤必须显式写入每条查询（`del_flag = '0'`、`status = '0'`），没有外键兜底。
- 时间字段以字符串返回（连接池 `dateStrings: true`），格式 `YYYY-MM-DD HH:mm:ss`；操作人取自 `c.get('currentUser')`，写入 `create_by` / `update_by`。

### 新增接口

1. `validators/` 增加入参 schema；2. `services/` 实现业务；3. `openapi/models.ts` 增加响应模型并注明使用接口；4. `routes/` 用 `createRoute` + `routeHandler` 注册；5. 若新增鉴权点，同步 SQL 的 `sys_menu` 与 `PERMS`，并更新 `v_user_permission` 相关说明。

### 本地开发

```bash
# 仓库根目录：启动 MySQL
pwsh ./manage.ps1 up -Target mysql

cd admin-monorepo
pnpm install
cp apps/api/.env.example apps/api/.env

pnpm --filter @cloudhub/api dev        # tsx watch，默认 http://localhost:3000
pnpm --filter @cloudhub/api typecheck
pnpm --filter @cloudhub/api lint
pnpm --filter @cloudhub/api test       # Vitest（当前无测试用例）
pnpm --filter @cloudhub/api build && pnpm --filter @cloudhub/api start
pnpm build                             # turbo 构建全部 workspace（含共享包）
```

首次启动前需初始化数据库：MySQL 容器首次创建数据卷时会自动执行 `doc/cloudhub_admin_v1.sql`；已有库用 `pwsh ./manage.ps1 init`（会 DROP 并重建，需确认）。

### 容器与运维

- 镜像：[apps/api/Dockerfile](admin-monorepo/apps/api/Dockerfile)，多阶段构建，`pnpm --filter @cloudhub/api --prod deploy --legacy` 产出仅含生产依赖的部署目录。
- 编排：[scripts/docker-compose.yml](scripts/docker-compose.yml) 的 `api` 服务（容器 `cloudhub-api`），等待 MySQL 健康后启动，健康检查请求 `/health`。
- 运维：`pwsh ./manage.ps1 up|down|restart|reset|build|logs|status|pull [-Target mysql|api|all]`；`up -Target api` 会先重建镜像。
- 环境变量：Compose 见 [scripts/.env.example](scripts/.env.example)，本地运行见 [apps/api/.env.example](admin-monorepo/apps/api/.env.example)；生产环境必须替换 `JWT_SECRET`。
