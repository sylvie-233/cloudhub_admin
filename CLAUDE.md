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
