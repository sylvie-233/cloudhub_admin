-- =============================================================================
--  云枢后台管理系统 · 数据库脚本 v4（对齐当前页面原型）
--  MySQL 8.0+ / InnoDB / utf8mb4
--
--  模型基线：
--   1. 组织不直接绑定用户。用户 → 岗位 → 组织，用户只挂岗位（sys_user_post）。
--   2. 岗位挂在组织下（sys_post.org_id），支持 parent_id 形成岗位序列。
--   3. 新建组织自动生成「默认岗位」（名称即「默认岗位」，不再冗余标记）；每个组织唯一「责任岗位」，
--      由 sys_org.leader_post_id 表达，在岗人即责任人（岗位表不再冗余 is_leader）。
--   4. 功能权限三源：用户角色（sys_role_menu）∪ 岗位直授（sys_post_menu）
--      ∪ 组织直授（sys_org_menu，沿 ancestors 向下继承）；岗位与组织不经角色。
--   5. 数据权限单一来源：角色 data_scope（1全部 2自定义 3本组织 4本组织及以下 5仅本人）；
--      无角色的用户兜底「仅本人」。
--   6. 菜单三级：M 目录 / C 菜单 / F 动作，动作即后端鉴权点（perms）。
--   7. 授权入口统一在「权限管理」页：org/post 走 sys_post_menu、sys_org_menu，
--      role 走 sys_role_menu + data_scope，对应动作 system:perm:save / dataScope。
--   8. 登录日志（sys_logininfor）在「系统日志」页展示，支持账号/IP/结果/时间范围筛选。
--
--  v4 相对 v3 去掉的冗余（原型中无对应字段或已有唯一来源）：
--   · sys_post.perm_limit（无编制管控 UI）、sys_post.is_leader（责任岗位唯一来源改 org.leader_post_id）
--   · sys_post.is_auto（仅用于「系统生成」标签，无删除/统计/鉴权规则，属装饰字段）
--   · sys_post.remark、sys_org.email、sys_org.remark、sys_user.remark、sys_menu.remark（原型的表单与列表均未使用）
--   · sys_user.user_type、avatar、login_ip、login_date（原型无头像/用户类型，登录信息统一在 sys_logininfor）
--   · sys_role.menu_check_strictly（「父子联动」是授权页的临时勾选，不落库）
--   · sys_menu.visible（原型菜单只有「状态」一个开关）
--   · 视图 v_user_effective_role（只有用户一个来源，已并入 v_user_permission）
--   · 动作 10035 system:post:perm、10045 system:role:authMenu（授权已统一收敛到权限管理页）
--
--  约定：status '0'正常 '1'停用；del_flag '0'存在 '2'删除
-- =============================================================================

DROP DATABASE IF EXISTS `cloudhub_admin`;
CREATE DATABASE `cloudhub_admin` DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_general_ci;
USE `cloudhub_admin`;

SET NAMES utf8mb4;
SET FOREIGN_KEY_CHECKS = 0;

-- =============================================================================
-- 1. 组织（多级组织树，最多 9 级）
-- =============================================================================
DROP TABLE IF EXISTS `sys_org`;
CREATE TABLE `sys_org` (
  `org_id`      BIGINT(20)   NOT NULL AUTO_INCREMENT COMMENT '组织ID',
  `parent_id`   BIGINT(20)   DEFAULT 0               COMMENT '父组织ID（0为根）',
  `ancestors`   VARCHAR(500) DEFAULT ''              COMMENT '祖级路径，逗号分隔，如 0,100,101',
  `org_code`    VARCHAR(64)  NOT NULL                COMMENT '组织编码（ZZ+年月日+6位序列号）',
  `org_name`    VARCHAR(100) NOT NULL                COMMENT '组织名称',
  `org_level`   INT(4)       DEFAULT 1               COMMENT '组织层级（从1开始，默认最多9级）',
  `order_num`   INT(4)       DEFAULT 0               COMMENT '显示顺序',
  `leader_post_id` BIGINT(20) DEFAULT NULL           COMMENT '责任岗位ID（每个组织唯一，在岗人即责任人）',
  `status`      CHAR(1)      DEFAULT '0'             COMMENT '状态（0正常 1停用）',
  `del_flag`    CHAR(1)      DEFAULT '0'             COMMENT '删除标志（0存在 2删除）',
  `create_by`   VARCHAR(64)  DEFAULT ''              COMMENT '创建者',
  `create_time` DATETIME     DEFAULT CURRENT_TIMESTAMP COMMENT '创建时间',
  `update_by`   VARCHAR(64)  DEFAULT ''              COMMENT '更新者',
  `update_time` DATETIME     DEFAULT NULL ON UPDATE CURRENT_TIMESTAMP COMMENT '更新时间',
  PRIMARY KEY (`org_id`),
  UNIQUE KEY `uk_org_code` (`org_code`),
  KEY `idx_org_parent` (`parent_id`),
  KEY `idx_org_status` (`status`)
) ENGINE=InnoDB AUTO_INCREMENT=200 DEFAULT CHARSET=utf8mb4 COMMENT='组织表';

-- =============================================================================
-- 2. 岗位（挂在组织下，支持上级岗位形成岗位序列）
-- =============================================================================
DROP TABLE IF EXISTS `sys_post`;
CREATE TABLE `sys_post` (
  `post_id`     BIGINT(20)  NOT NULL AUTO_INCREMENT COMMENT '岗位ID',
  `org_id`      BIGINT(20)  NOT NULL                COMMENT '所属组织ID',
  `parent_id`   BIGINT(20)  DEFAULT 0               COMMENT '上级岗位ID（0为岗位序列起点）',
  `post_code`   VARCHAR(64) NOT NULL                COMMENT '岗位编码（GW+年月日+6位序列号）',
  `post_name`   VARCHAR(64) NOT NULL                COMMENT '岗位名称',
  `post_sort`   INT(4)      DEFAULT 0               COMMENT '显示顺序',
  `status`      CHAR(1)     DEFAULT '0'             COMMENT '状态（0正常 1停用）',
  `del_flag`    CHAR(1)     DEFAULT '0'             COMMENT '删除标志（0存在 2删除）',
  `create_by`   VARCHAR(64) DEFAULT ''              COMMENT '创建者',
  `create_time` DATETIME    DEFAULT CURRENT_TIMESTAMP COMMENT '创建时间',
  `update_by`   VARCHAR(64) DEFAULT ''              COMMENT '更新者',
  `update_time` DATETIME    DEFAULT NULL ON UPDATE CURRENT_TIMESTAMP COMMENT '更新时间',
  PRIMARY KEY (`post_id`),
  UNIQUE KEY `uk_post_code` (`post_code`),
  KEY `idx_post_org` (`org_id`),
  KEY `idx_post_parent` (`parent_id`)
) ENGINE=InnoDB AUTO_INCREMENT=100 DEFAULT CHARSET=utf8mb4 COMMENT='岗位表（责任岗位见 sys_org.leader_post_id）';

-- =============================================================================
-- 3. 用户（不直接归属组织，通过岗位关联）
-- =============================================================================
DROP TABLE IF EXISTS `sys_user`;
CREATE TABLE `sys_user` (
  `user_id`      BIGINT(20)   NOT NULL AUTO_INCREMENT COMMENT '用户ID',
  `user_name`    VARCHAR(30)  NOT NULL                COMMENT '登录账号',
  `nick_name`    VARCHAR(30)  NOT NULL                COMMENT '用户昵称',
  `email`        VARCHAR(50)  DEFAULT ''              COMMENT '邮箱',
  `phonenumber`  VARCHAR(11)  DEFAULT ''              COMMENT '手机号码',
  `sex`          CHAR(1)      DEFAULT '0'             COMMENT '性别（0男 1女 2未知）',
  `password`     VARCHAR(100) DEFAULT ''              COMMENT '密码（BCrypt）',
  `status`       CHAR(1)      DEFAULT '0'             COMMENT '账号状态（0正常 1停用）',
  `del_flag`     CHAR(1)      DEFAULT '0'             COMMENT '删除标志（0存在 2删除）',
  `create_by`    VARCHAR(64)  DEFAULT ''              COMMENT '创建者',
  `create_time`  DATETIME     DEFAULT CURRENT_TIMESTAMP COMMENT '创建时间',
  `update_by`    VARCHAR(64)  DEFAULT ''              COMMENT '更新者',
  `update_time`  DATETIME     DEFAULT NULL ON UPDATE CURRENT_TIMESTAMP COMMENT '更新时间',
  PRIMARY KEY (`user_id`),
  UNIQUE KEY `uk_user_name` (`user_name`),
  KEY `idx_user_phone` (`phonenumber`),
  KEY `idx_user_status` (`status`)
) ENGINE=InnoDB AUTO_INCREMENT=100 DEFAULT CHARSET=utf8mb4 COMMENT='用户表';

DROP TABLE IF EXISTS `sys_user_post`;
CREATE TABLE `sys_user_post` (
  `user_id`  BIGINT(20) NOT NULL COMMENT '用户ID',
  `post_id`  BIGINT(20) NOT NULL COMMENT '岗位ID',
  PRIMARY KEY (`user_id`,`post_id`),
  KEY `idx_up_post` (`post_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='用户与岗位关联表（一人可多岗，岗位不分主次）';

-- =============================================================================
-- 4. 角色（仅授予用户；岗位与组织不走角色，直接分配菜单权限）
-- =============================================================================
DROP TABLE IF EXISTS `sys_role`;
CREATE TABLE `sys_role` (
  `role_id`     BIGINT(20)  NOT NULL AUTO_INCREMENT COMMENT '角色ID',
  `role_name`   VARCHAR(30) NOT NULL                COMMENT '角色名称',
  `role_key`    VARCHAR(100) NOT NULL               COMMENT '权限字符（如 manager）',
  `role_sort`   INT(4)      NOT NULL DEFAULT 0      COMMENT '显示顺序',
  `data_scope`  CHAR(1)     DEFAULT '1'             COMMENT '数据范围（1全部 2自定义 3本组织 4本组织及以下 5仅本人）',
  `status`      CHAR(1)     DEFAULT '0'             COMMENT '角色状态（0正常 1停用）',
  `del_flag`    CHAR(1)     DEFAULT '0'             COMMENT '删除标志（0存在 2删除）',
  `create_by`   VARCHAR(64) DEFAULT ''              COMMENT '创建者',
  `create_time` DATETIME    DEFAULT CURRENT_TIMESTAMP COMMENT '创建时间',
  `update_by`   VARCHAR(64) DEFAULT ''              COMMENT '更新者',
  `update_time` DATETIME    DEFAULT NULL ON UPDATE CURRENT_TIMESTAMP COMMENT '更新时间',
  `remark`      VARCHAR(500) DEFAULT NULL           COMMENT '备注',
  PRIMARY KEY (`role_id`),
  UNIQUE KEY `uk_role_key` (`role_key`)
) ENGINE=InnoDB AUTO_INCREMENT=10 DEFAULT CHARSET=utf8mb4 COMMENT='角色表';

DROP TABLE IF EXISTS `sys_user_role`;
CREATE TABLE `sys_user_role` (
  `user_id` BIGINT(20) NOT NULL COMMENT '用户ID',
  `role_id` BIGINT(20) NOT NULL COMMENT '角色ID',
  PRIMARY KEY (`user_id`,`role_id`),
  KEY `idx_ur_role` (`role_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='用户角色表（角色只授予用户）';

-- 岗位权限：岗位直接分配菜单/动作权限，对该岗位全部任职人生效，不经角色
DROP TABLE IF EXISTS `sys_post_menu`;
CREATE TABLE `sys_post_menu` (
  `post_id`     BIGINT(20) NOT NULL COMMENT '岗位ID',
  `menu_id`     BIGINT(20) NOT NULL COMMENT '菜单ID',
  `create_by`   VARCHAR(64) DEFAULT '' COMMENT '授权人',
  `create_time` DATETIME DEFAULT CURRENT_TIMESTAMP COMMENT '授权时间',
  PRIMARY KEY (`post_id`,`menu_id`),
  KEY `idx_pm_menu` (`menu_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='岗位权限表（岗位直授菜单/动作）';

-- 组织权限：组织节点直接分配菜单/动作权限，沿组织树向下继承到所有子组织
DROP TABLE IF EXISTS `sys_org_menu`;
CREATE TABLE `sys_org_menu` (
  `org_id`      BIGINT(20) NOT NULL COMMENT '组织ID',
  `menu_id`     BIGINT(20) NOT NULL COMMENT '菜单ID',
  `create_by`   VARCHAR(64) DEFAULT '' COMMENT '授权人',
  `create_time` DATETIME DEFAULT CURRENT_TIMESTAMP COMMENT '授权时间',
  PRIMARY KEY (`org_id`,`menu_id`),
  KEY `idx_om_menu` (`menu_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='组织权限表（组织直授，向下继承）';

-- 数据权限：自定义范围时角色可见的组织集合（data_scope='2' 时生效）
DROP TABLE IF EXISTS `sys_role_scope_org`;
CREATE TABLE `sys_role_scope_org` (
  `role_id` BIGINT(20) NOT NULL COMMENT '角色ID',
  `org_id`  BIGINT(20) NOT NULL COMMENT '组织ID',
  PRIMARY KEY (`role_id`,`org_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='角色数据范围自定义组织表';

-- =============================================================================
-- 5. 菜单与动作权限
-- =============================================================================
DROP TABLE IF EXISTS `sys_menu`;
CREATE TABLE `sys_menu` (
  `menu_id`     BIGINT(20)  NOT NULL AUTO_INCREMENT COMMENT '菜单ID',
  `menu_name`   VARCHAR(50) NOT NULL                COMMENT '菜单名称',
  `parent_id`   BIGINT(20)  DEFAULT 0               COMMENT '父菜单ID',
  `order_num`   INT(4)      DEFAULT 0               COMMENT '显示顺序',
  `path`        VARCHAR(200) DEFAULT ''             COMMENT '路由地址',
  `component`   VARCHAR(255) DEFAULT NULL           COMMENT '组件路径',
  `menu_type`   CHAR(1)     DEFAULT ''              COMMENT '菜单类型（M目录 C菜单 F动作）',
  `status`      CHAR(1)     DEFAULT '0'             COMMENT '菜单状态（0正常 1停用）',
  `perms`       VARCHAR(100) DEFAULT NULL           COMMENT '权限标识（如 system:post:list）',
  `icon`        VARCHAR(100) DEFAULT ''             COMMENT '菜单图标（对应前端图标库 key）',
  `create_by`   VARCHAR(64) DEFAULT ''              COMMENT '创建者',
  `create_time` DATETIME    DEFAULT CURRENT_TIMESTAMP COMMENT '创建时间',
  `update_by`   VARCHAR(64) DEFAULT ''              COMMENT '更新者',
  `update_time` DATETIME    DEFAULT NULL ON UPDATE CURRENT_TIMESTAMP COMMENT '更新时间',
  PRIMARY KEY (`menu_id`),
  KEY `idx_menu_parent` (`parent_id`),
  KEY `idx_menu_perms` (`perms`)
) ENGINE=InnoDB AUTO_INCREMENT=1100 DEFAULT CHARSET=utf8mb4 COMMENT='菜单权限表';

DROP TABLE IF EXISTS `sys_role_menu`;
CREATE TABLE `sys_role_menu` (
  `role_id` BIGINT(20) NOT NULL COMMENT '角色ID',
  `menu_id` BIGINT(20) NOT NULL COMMENT '菜单ID',
  PRIMARY KEY (`role_id`,`menu_id`),
  KEY `idx_rm_menu` (`menu_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='角色菜单表';

-- =============================================================================
-- 6. 登录日志
-- =============================================================================
DROP TABLE IF EXISTS `sys_logininfor`;
CREATE TABLE `sys_logininfor` (
  `info_id`     BIGINT(20)   NOT NULL AUTO_INCREMENT COMMENT '访问ID',
  `user_name`   VARCHAR(50)  DEFAULT ''   COMMENT '登录账号',
  `post_name`   VARCHAR(100) DEFAULT ''   COMMENT '登录时选择的岗位（多岗用户）',
  `ipaddr`      VARCHAR(128) DEFAULT ''   COMMENT '登录IP',
  `login_location` VARCHAR(255) DEFAULT '' COMMENT '登录地点',
  `browser`     VARCHAR(50)  DEFAULT ''   COMMENT '浏览器',
  `os`          VARCHAR(50)  DEFAULT ''   COMMENT '操作系统',
  `status`      CHAR(1)      DEFAULT '0'  COMMENT '登录状态（0成功 1失败）',
  `msg`         VARCHAR(255) DEFAULT ''   COMMENT '提示消息',
  `login_time`  DATETIME     DEFAULT CURRENT_TIMESTAMP COMMENT '登录时间',
  PRIMARY KEY (`info_id`),
  KEY `idx_login_user` (`user_name`),
  KEY `idx_login_time` (`login_time`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='系统访问记录';

-- =============================================================================
-- 7. 初始化数据：组织
-- =============================================================================
INSERT INTO `sys_org` (`org_id`,`parent_id`,`ancestors`,`org_code`,`org_name`,`org_level`,`order_num`,`leader_post_id`,`status`) VALUES
(100, 0,   '0',         'ZZ20251102001','云枢科技集团',  1, 1, 1,  '0'),
(101, 100, '0,100',     'ZZ20251102002','深圳总部',      2, 1, 2,  '0'),
(102, 100, '0,100',     'ZZ20251102003','长沙分公司',    2, 2, 13, '0'),
(103, 101, '0,100,101', 'ZZ20251103001','研发中心',      3, 1, 3,  '0'),
(104, 101, '0,100,101', 'ZZ20251103002','产品设计部',    3, 2, 5,  '0'),
(105, 101, '0,100,101', 'ZZ20251103003','质量保障部',    3, 3, 7,  '0'),
(106, 101, '0,100,101', 'ZZ20251103004','财务部',        3, 4, 8,  '0'),
(107, 101, '0,100,101', 'ZZ20251103005','运维部',        3, 5, 9,  '0'),
(108, 101, '0,100,101', 'ZZ20251103006','人力资源部',    3, 6, 10, '0'),
(109, 102, '0,100,102', 'ZZ20251104001','市场部',        3, 1, 11, '0'),
(110, 102, '0,100,102', 'ZZ20251104002','财务部',        3, 2, 12, '1');

-- =============================================================================
-- 8. 初始化数据：岗位
--    新建组织时自动生成默认岗位；责任岗位由 sys_org.leader_post_id 指向
-- =============================================================================
INSERT INTO `sys_post` (`post_id`,`org_id`,`parent_id`,`post_code`,`post_name`,`post_sort`,`status`,`create_by`,`create_time`) VALUES
(1,100,0,'GW20251102001','董事长', 1,  '0', 'admin', NOW()),
(2,101,1,'GW20251102002','总经理', 2,  '0', 'admin', NOW()),
(3,103,2,'GW20251103001','项目经理', 3,  '0', 'admin', NOW()),
(4,103,3,'GW20251103002','研发工程师', 4,  '0', 'admin', NOW()),
(5,104,2,'GW20251103003','产品经理', 5,  '0', 'admin', NOW()),
(6,104,5,'GW20251103004','视觉设计师', 6,  '0', 'admin', NOW()),
(7,105,2,'GW20251103005','测试工程师', 7,  '0', 'admin', NOW()),
(8,106,2,'GW20251103006','财务专员', 8,  '0', 'admin', NOW()),
(9,107,2,'GW20251103007','运维工程师', 9,  '0', 'admin', NOW()),
(10,108,2,'GW20251103008','人事专员', 10, '0', 'admin', NOW()),
(11,109,13,'GW20251104001','市场专员', 11, '0', 'admin', NOW()),
(12,110,13,'GW20251104002','会计', 12, '0', 'admin', NOW()),
(13,102,2,'GW20251102003','分公司综合岗', 13, '0', 'admin', NOW());

-- =============================================================================
-- 9. 初始化数据：角色
-- =============================================================================
INSERT INTO `sys_role` (`role_id`,`role_name`,`role_key`,`role_sort`,`data_scope`,`status`,`create_by`,`create_time`,`remark`) VALUES
(1, '超级管理员', 'admin',   1, '1', '0', 'admin', NOW(), '拥有全部权限，不受数据范围限制'),
(2, '普通员工',   'common',  2, '5', '0', 'admin', NOW(), '通用角色，仅本人数据'),
(3, '部门经理',   'manager', 3, '4', '0', 'admin', NOW(), '管理岗角色，本组织及以下'),
(4, '财务专员',   'finance', 4, '3', '0', 'admin', NOW(), '财务条线角色，本组织数据'),
(5, '人事专员',   'hr',      5, '2', '0', 'admin', NOW(), '人事条线角色，自定义范围'),
(6, '系统审计员', 'auditor', 6, '1', '0', 'admin', NOW(), '只读全量数据');

-- =============================================================================
-- 10. 初始化数据：菜单与动作权限
--     顺序按页面实际菜单：系统管理 → 用户 / 组织 / 角色 / 菜单 / 权限 / 日志
-- =============================================================================
INSERT INTO `sys_menu` (`menu_id`,`menu_name`,`parent_id`,`order_num`,`path`,`component`,`menu_type`,`status`,`perms`,`icon`,`create_by`) VALUES
(1000, '系统管理', 0,    1, 'system', NULL,                'M', '0', NULL,                       'settings','admin'),
(1001, '用户管理', 1000, 1, 'user',   'system/user/index',  'C', '0', 'system:user:list',         'users',   'admin'),
(1002, '组织管理', 1000, 2, 'org',    'system/org/index',   'C', '0', 'system:org:list',          'building','admin'),
(1004, '角色管理', 1000, 3, 'role',   'system/role/index',  'C', '0', 'system:role:list',         'shield',  'admin'),
(1005, '菜单管理', 1000, 4, 'menu',   'system/menu/index',  'C', '0', 'system:menu:list',         'menu',    'admin'),
(1006, '权限管理', 1000, 5, 'perm',   'system/perm/index',  'C', '0', 'system:perm:list',         'key',     'admin'),
(1007, '系统日志', 1000, 6, 'log',    'monitor/logininfor/index', 'C', '0', 'system:logininfor:list', 'log', 'admin'),
-- 用户管理动作
(10011,'用户查询', 1001, 1, '', NULL, 'F', '0', 'system:user:query',    '', 'admin'),
(10012,'用户新增', 1001, 2, '', NULL, 'F', '0', 'system:user:add',      '', 'admin'),
(10013,'用户修改', 1001, 3, '', NULL, 'F', '0', 'system:user:edit',     '', 'admin'),
(10014,'用户删除', 1001, 4, '', NULL, 'F', '0', 'system:user:remove',   '', 'admin'),
(10015,'重置密码', 1001, 5, '', NULL, 'F', '0', 'system:user:resetPwd', '', 'admin'),
(10016,'分配角色', 1001, 6, '', NULL, 'F', '0', 'system:user:authRole', '', 'admin'),
(10017,'查看权限', 1001, 7, '', NULL, 'F', '0', 'system:user:view',     '', 'admin'),
-- 组织管理 · 组织动作
(10021,'组织查询', 1002, 1, '', NULL, 'F', '0', 'system:org:query',      '', 'admin'),
(10022,'组织新增', 1002, 2, '', NULL, 'F', '0', 'system:org:add',        '', 'admin'),
(10023,'组织修改', 1002, 3, '', NULL, 'F', '0', 'system:org:edit',       '', 'admin'),
(10024,'组织删除', 1002, 4, '', NULL, 'F', '0', 'system:org:remove',     '', 'admin'),
(10025,'设置责任岗位',1002,5,'', NULL, 'F', '0', 'system:org:setLeader',  '', 'admin'),
-- 组织管理 · 岗位动作（权限分配已收敛到权限管理页，不再单列 post:perm）
(10031,'岗位查询', 1002, 6, '', NULL, 'F', '0', 'system:post:query',      '', 'admin'),
(10032,'岗位新增', 1002, 7, '', NULL, 'F', '0', 'system:post:add',        '', 'admin'),
(10033,'岗位修改', 1002, 8, '', NULL, 'F', '0', 'system:post:edit',       '', 'admin'),
(10034,'岗位删除', 1002, 9, '', NULL, 'F', '0', 'system:post:remove',     '', 'admin'),
-- 角色管理动作（分配权限走权限管理页，角色页只保留用户维护）
(10041,'角色查询', 1004, 1, '', NULL, 'F', '0', 'system:role:query',    '', 'admin'),
(10042,'角色新增', 1004, 2, '', NULL, 'F', '0', 'system:role:add',      '', 'admin'),
(10043,'角色修改', 1004, 3, '', NULL, 'F', '0', 'system:role:edit',     '', 'admin'),
(10044,'角色删除', 1004, 4, '', NULL, 'F', '0', 'system:role:remove',   '', 'admin'),
(10046,'分配用户', 1004, 5, '', NULL, 'F', '0', 'system:role:authUser', '', 'admin'),
-- 菜单管理动作
(10051,'菜单查询', 1005, 1, '', NULL, 'F', '0', 'system:menu:query',  '', 'admin'),
(10052,'菜单新增', 1005, 2, '', NULL, 'F', '0', 'system:menu:add',    '', 'admin'),
(10053,'菜单修改', 1005, 3, '', NULL, 'F', '0', 'system:menu:edit',   '', 'admin'),
(10054,'菜单删除', 1005, 4, '', NULL, 'F', '0', 'system:menu:remove', '', 'admin'),
-- 权限管理动作
(10061,'权限查询', 1006, 1, '', NULL, 'F', '0', 'system:perm:query',     '', 'admin'),
(10062,'权限保存', 1006, 2, '', NULL, 'F', '0', 'system:perm:save',      '', 'admin'),
(10063,'数据权限', 1006, 3, '', NULL, 'F', '0', 'system:perm:dataScope', '', 'admin'),
-- 系统日志动作（登录日志）
(10071,'日志查询', 1007, 1, '', NULL, 'F', '0', 'system:logininfor:query',  '', 'admin'),
(10072,'日志导出', 1007, 2, '', NULL, 'F', '0', 'system:logininfor:export', '', 'admin'),
(10073,'日志删除', 1007, 3, '', NULL, 'F', '0', 'system:logininfor:remove', '', 'admin'),
(10074,'清空日志', 1007, 4, '', NULL, 'F', '0', 'system:logininfor:clean',  '', 'admin');

-- =============================================================================
-- 11. 初始化数据：登录日志（「系统日志」页数据源）
-- =============================================================================
INSERT INTO `sys_logininfor` (`info_id`,`user_name`,`post_name`,`ipaddr`,`login_location`,`browser`,`os`,`status`,`msg`,`login_time`) VALUES
(1,  'admin',  '云枢科技集团/董事长',      '192.168.1.24',  '深圳 · 内网', 'Chrome 128', 'macOS 15',   '0', '登录成功',     '2026-11-05 12:41:08'),
(2,  'liyan',  '研发中心/项目经理',        '192.168.1.87',  '深圳 · 内网', 'Chrome 128', 'Windows 11', '0', '登录成功',     '2026-11-05 12:26:33'),
(3,  'wangtao','产品设计部/产品经理',      '10.20.33.18',   '深圳 · 内网', 'Edge 127',   'Windows 11', '0', '登录成功',     '2026-11-05 11:58:47'),
(4,  'sunqi',  '市场部/市场专员',          '58.60.12.190',  '广东 · 深圳', 'Chrome 127', 'Android 14', '0', '登录成功',     '2026-11-05 11:32:12'),
(5,  'guest',  '',                         '203.0.113.45',  '境外 · 未知', 'Chrome 122', 'Linux',      '1', '账号不存在',   '2026-11-05 11:15:02'),
(6,  'wujun',  '市场部/市场专员',          '58.60.12.190',  '广东 · 深圳', 'Safari 17',  'iOS 18',     '1', '账号已停用',   '2026-11-05 10:47:55'),
(7,  'zhangqy','深圳总部/总经理',          '192.168.1.52',  '深圳 · 内网', 'Chrome 128', 'macOS 15',   '0', '登录成功',     '2026-11-05 09:58:20'),
(8,  'chenxi', '人力资源部/人事专员',      '10.20.33.6',    '深圳 · 内网', 'Edge 127',   'Windows 11', '0', '登录成功',     '2026-11-05 09:31:44'),
(9,  'admin',  '',                         '192.168.1.24',  '深圳 · 内网', 'Chrome 128', 'macOS 15',   '1', '验证码错误',   '2026-11-05 09:12:07'),
(10, 'guoyang','长沙分公司/分公司综合岗',  '221.9.44.31',   '湖南 · 长沙', 'Edge 126',   'Windows 10', '0', '登录成功',     '2026-11-05 08:56:31'),
(11, 'zhaomin','质量保障部/测试工程师',    '10.20.33.22',   '深圳 · 内网', 'Chrome 128', 'Windows 11', '0', '登录成功',     '2026-11-04 19:42:16'),
(12, 'hanmei', '财务部/财务专员',          '10.20.33.9',    '深圳 · 内网', 'Chrome 127', 'Windows 11', '0', '登录成功',     '2026-11-04 18:30:05'),
(13, 'xulei',  '财务部/会计',              '221.9.44.58',   '湖南 · 长沙', 'Safari 16',  'macOS 14',   '0', '登录成功',     '2026-11-04 17:20:41'),
(14, 'zhangqy','深圳总部/总经理',          '192.168.1.52',  '深圳 · 内网', 'Chrome 128', 'macOS 15',   '0', '切换身份登录', '2026-11-04 15:06:12'),
(15, 'zhoulin','运维部/运维工程师',        '10.20.33.30',   '深圳 · 内网', 'Edge 127',   'Windows 11', '1', '密码错误',     '2026-11-04 14:22:38'),
(16, 'liyan',  '研发中心/项目经理',        '192.168.1.87',  '深圳 · 内网', 'Chrome 128', 'Windows 11', '0', '登录成功',     '2026-11-04 09:03:27'),
(17, 'chenxi', '人力资源部/人事专员',      '10.20.33.6',    '深圳 · 内网', 'Edge 127',   'Windows 11', '0', '登录成功',     '2026-11-03 20:15:44'),
(18, 'admin',  '云枢科技集团/董事长',      '192.168.1.24',  '深圳 · 内网', 'Chrome 128', 'macOS 15',   '0', '登录成功',     '2026-11-03 08:44:09'),
(19, 'sunqi',  '市场部/市场专员',          '58.60.12.190',  '广东 · 深圳', 'Chrome 127', 'Android 14', '1', '密码错误',     '2026-11-03 08:12:33'),
(20, 'guoyang','长沙分公司/分公司综合岗',  '221.9.44.31',   '湖南 · 长沙', 'Edge 126',   'Windows 10', '0', '登录成功',     '2026-11-02 18:04:47'),
(21, 'hanmei', '财务部/财务专员',          '10.20.33.9',    '深圳 · 内网', 'Chrome 127', 'Windows 11', '0', '登录成功',     '2026-10-31 16:38:52'),
(22, 'wangtao','',                         '113.87.20.61',  '广东 · 广州', 'Chrome 126', 'Windows 11', '1', '密码错误',     '2026-10-27 10:02:19');

-- =============================================================================
-- 12. 初始化数据：用户（密码统一 admin123 的 BCrypt 值）
-- =============================================================================
INSERT INTO `sys_user` (`user_id`,`user_name`,`nick_name`,`email`,`phonenumber`,`sex`,`password`,`status`,`create_by`,`create_time`) VALUES
(1,  'admin',  '超级管理员', 'admin@cloudhub.cn',  '13800000001', '0', '$2a$10$7JB720yubVSZvUI0rEqK/.VqGOZTH.ulu33dHOiBE8ByOhJIrdAu2', '0', 'admin', NOW()),
(2,  'zhangqy','张启元',     'zhangqy@cloudhub.cn','13800000012', '0', '$2a$10$7JB720yubVSZvUI0rEqK/.VqGOZTH.ulu33dHOiBE8ByOhJIrdAu2', '0', 'admin', NOW()),
(3,  'liyan',  '李妍',       'liyan@cloudhub.cn',  '13800000013', '1', '$2a$10$7JB720yubVSZvUI0rEqK/.VqGOZTH.ulu33dHOiBE8ByOhJIrdAu2', '0', 'admin', NOW()),
(4,  'wangtao','王涛',       'wangtao@cloudhub.cn','13800000014', '0', '$2a$10$7JB720yubVSZvUI0rEqK/.VqGOZTH.ulu33dHOiBE8ByOhJIrdAu2', '0', 'admin', NOW()),
(5,  'zhaomin','赵敏',       'zhaomin@cloudhub.cn','13800000015', '1', '$2a$10$7JB720yubVSZvUI0rEqK/.VqGOZTH.ulu33dHOiBE8ByOhJIrdAu2', '0', 'admin', NOW()),
(6,  'hanmei', '韩梅',       'hanmei@cloudhub.cn', '13800000016', '1', '$2a$10$7JB720yubVSZvUI0rEqK/.VqGOZTH.ulu33dHOiBE8ByOhJIrdAu2', '0', 'admin', NOW()),
(7,  'zhoulin','周琳',       'zhoulin@cloudhub.cn','13800000017', '1', '$2a$10$7JB720yubVSZvUI0rEqK/.VqGOZTH.ulu33dHOiBE8ByOhJIrdAu2', '0', 'admin', NOW()),
(8,  'chenxi', '陈曦',       'chenxi@cloudhub.cn', '13800000018', '1', '$2a$10$7JB720yubVSZvUI0rEqK/.VqGOZTH.ulu33dHOiBE8ByOhJIrdAu2', '0', 'admin', NOW()),
(9,  'sunqi',  '孙琦',       'sunqi@cloudhub.cn',  '13800000019', '0', '$2a$10$7JB720yubVSZvUI0rEqK/.VqGOZTH.ulu33dHOiBE8ByOhJIrdAu2', '0', 'admin', NOW()),
(10, 'xulei',  '徐磊',       'xulei@cloudhub.cn',  '13800000020', '0', '$2a$10$7JB720yubVSZvUI0rEqK/.VqGOZTH.ulu33dHOiBE8ByOhJIrdAu2', '0', 'admin', NOW()),
(11, 'guoyang','郭洋',       'guoyang@cloudhub.cn','13800000021', '0', '$2a$10$7JB720yubVSZvUI0rEqK/.VqGOZTH.ulu33dHOiBE8ByOhJIrdAu2', '0', 'admin', NOW()),
(12, 'wujun',  '吴俊',       'wujun@cloudhub.cn',  '13800000022', '0', '$2a$10$7JB720yubVSZvUI0rEqK/.VqGOZTH.ulu33dHOiBE8ByOhJIrdAu2', '1', 'admin', NOW());

-- 用户岗位：一人可多岗，岗位之间不分主次（张启元任董事长与总经理；李妍任项目经理与研发工程师）
INSERT INTO `sys_user_post` (`user_id`,`post_id`) VALUES
(1,1),
(2,1),(2,2),
(3,3),(3,4),
(4,5),(5,7),(6,8),(7,9),(8,10),(9,11),(10,12),(11,13),(12,11);

-- 岗位权限：菜单/动作直接授予岗位（不经角色），对该岗位全部任职人生效
-- 董事长：全部菜单
INSERT INTO `sys_post_menu` (`post_id`,`menu_id`,`create_by`) SELECT 1, menu_id, 'admin' FROM `sys_menu`;
-- 管理岗（总经理/项目经理/产品经理/测试工程师）：用户维护 + 组织管理查看 + 角色查看 + 权限管理
INSERT INTO `sys_post_menu` (`post_id`,`menu_id`,`create_by`)
SELECT p.post_id, m.menu_id, 'admin'
  FROM `sys_post` p
  JOIN `sys_menu` m ON m.menu_id IN (1000,1001,10011,10013,10016,10017,1002,10021,10031,1004,10041,1006,10061)
 WHERE p.post_id IN (2,3,5,7);
-- 普通岗（研发工程师/视觉设计师/运维工程师/市场专员/分公司综合岗）：基础查询
INSERT INTO `sys_post_menu` (`post_id`,`menu_id`,`create_by`)
SELECT p.post_id, m.menu_id, 'admin'
  FROM `sys_post` p
  JOIN `sys_menu` m ON m.menu_id IN (1000,1001,10011)
 WHERE p.post_id IN (4,6,9,11,13);
-- 财务岗（财务专员/会计）：用户查询 + 权限查看
INSERT INTO `sys_post_menu` (`post_id`,`menu_id`,`create_by`)
SELECT p.post_id, m.menu_id, 'admin'
  FROM `sys_post` p
  JOIN `sys_menu` m ON m.menu_id IN (1000,1001,10011,10017)
 WHERE p.post_id IN (8,12);
-- 人事专员岗：用户与组织全功能
INSERT INTO `sys_post_menu` (`post_id`,`menu_id`,`create_by`)
SELECT p.post_id, m.menu_id, 'admin'
  FROM `sys_post` p
  JOIN `sys_menu` m ON m.menu_id IN (1000,1001,10011,10012,10013,10015,10017,1002,10021,10022,10023,10025)
 WHERE p.post_id IN (10);

-- 组织权限：组织节点直接授权，沿组织树向下继承到所有子组织
-- 研发中心
INSERT INTO `sys_org_menu` (`org_id`,`menu_id`,`create_by`)
SELECT 103, m.menu_id, 'admin' FROM `sys_menu` m
 WHERE m.menu_id IN (1000,1001,10011,10013,10016,10017,1002,10021,10031,1004,10041);
-- 财务部
INSERT INTO `sys_org_menu` (`org_id`,`menu_id`,`create_by`)
SELECT 106, m.menu_id, 'admin' FROM `sys_menu` m
 WHERE m.menu_id IN (1000,1001,10011,10017);
-- 人力资源部
INSERT INTO `sys_org_menu` (`org_id`,`menu_id`,`create_by`)
SELECT 108, m.menu_id, 'admin' FROM `sys_menu` m
 WHERE m.menu_id IN (1000,1001,10011,10012,10013,10015,10017,1002,10021,10022,10023,10025);

-- 用户角色：少量直接授权（陈曦直授系统审计员角色）
INSERT INTO `sys_user_role` (`user_id`,`role_id`) VALUES
(1,1),(8,6);

-- 角色菜单：超级管理员全量
INSERT INTO `sys_role_menu` (`role_id`,`menu_id`) SELECT 1, menu_id FROM `sys_menu`;
-- 系统审计员：只读全部模块（含系统日志的查询与导出）
INSERT INTO `sys_role_menu` (`role_id`,`menu_id`) VALUES
(6,1000),(6,1001),(6,10011),(6,10017),(6,1002),(6,10021),(6,10031),(6,1004),(6,10041),(6,1006),(6,10061),(6,1007),(6,10071),(6,10072);
-- 部门经理：用户查询/修改 + 分配角色 + 组织管理查看
INSERT INTO `sys_role_menu` (`role_id`,`menu_id`) VALUES
(3,1000),(3,1001),(3,10011),(3,10013),(3,10016),(3,10017),(3,1002),(3,10021),(3,10031),(3,1004),(3,10041);
-- 普通员工：仅本人相关查询
INSERT INTO `sys_role_menu` (`role_id`,`menu_id`) VALUES
(2,1000),(2,1001),(2,10011);
-- 财务专员：用户查询 + 权限查看
INSERT INTO `sys_role_menu` (`role_id`,`menu_id`) VALUES
(4,1000),(4,1001),(4,10011),(4,10017),(4,1006),(4,10061);
-- 人事专员：用户与组织全功能
INSERT INTO `sys_role_menu` (`role_id`,`menu_id`) VALUES
(5,1000),(5,1001),(5,10011),(5,10012),(5,10013),(5,10015),(5,10017),(5,1002),(5,10021),(5,10022),(5,10023),(5,10025);

-- 数据范围自定义：人事专员可见深圳总部与长沙分公司
INSERT INTO `sys_role_scope_org` (`role_id`,`org_id`) VALUES (5,101),(5,102);

SET FOREIGN_KEY_CHECKS = 1;

-- =============================================================================
-- 13. 视图：用户最终菜单/动作权限
--     = 用户角色权限 ∪ 任职岗位权限 ∪ 所属组织权限（组织权限沿 ancestors 向下继承）
--     同一 menu_id 可能来自多个渠道，grant_source 区分来源
-- =============================================================================
CREATE OR REPLACE VIEW `v_user_permission` AS
SELECT DISTINCT
       u.user_id,
       u.user_name,
       r.role_id    AS source_id,
       'user'       AS grant_source,
       r.data_scope,
       m.menu_id,
       m.perms
FROM `sys_user` u
JOIN `sys_user_role` ur ON ur.user_id = u.user_id
JOIN `sys_role` r ON r.role_id = ur.role_id AND r.status = '0' AND r.del_flag = '0'
JOIN `sys_role_menu` rm ON rm.role_id = r.role_id
JOIN `sys_menu` m ON m.menu_id = rm.menu_id AND m.status = '0'
WHERE u.del_flag = '0' AND u.status = '0'
UNION
SELECT DISTINCT
       u.user_id,
       u.user_name,
       pm.post_id   AS source_id,
       'post'       AS grant_source,
       NULL         AS data_scope,
       m.menu_id,
       m.perms
FROM `sys_user` u
JOIN `sys_user_post` up ON up.user_id = u.user_id
JOIN `sys_post` p ON p.post_id = up.post_id AND p.status = '0' AND p.del_flag = '0'
JOIN `sys_post_menu` pm ON pm.post_id = p.post_id
JOIN `sys_menu` m ON m.menu_id = pm.menu_id AND m.status = '0'
WHERE u.del_flag = '0' AND u.status = '0'
UNION
SELECT DISTINCT
       u.user_id,
       u.user_name,
       om.org_id    AS source_id,
       'org'        AS grant_source,
       NULL         AS data_scope,
       m.menu_id,
       m.perms
FROM `sys_user` u
JOIN `sys_user_post` up ON up.user_id = u.user_id
JOIN `sys_post` p ON p.post_id = up.post_id AND p.status = '0' AND p.del_flag = '0'
JOIN `sys_org` o ON o.org_id = p.org_id
JOIN `sys_org_menu` om
  ON om.org_id = o.org_id OR FIND_IN_SET(om.org_id, o.ancestors)
JOIN `sys_menu` m ON m.menu_id = om.menu_id AND m.status = '0'
WHERE u.del_flag = '0' AND u.status = '0';

-- =============================================================================
-- 14. 常用校验 SQL
-- =============================================================================
-- 1) 某用户的权限来自哪些渠道（user=角色 post=岗位直授 org=组织直授）
-- SELECT grant_source, COUNT(DISTINCT menu_id) AS menus FROM v_user_permission
--   WHERE user_name = 'liyan' GROUP BY grant_source;

-- 2) 组织下的岗位与在岗人数（含子组织），责任岗位取 org.leader_post_id
-- SELECT o.org_name, p.post_name, (o.leader_post_id = p.post_id) AS is_leader,
--        COUNT(up.user_id) AS headcount
--   FROM sys_org o
--   LEFT JOIN sys_post p ON p.org_id = o.org_id AND p.del_flag = '0'
--   LEFT JOIN sys_user_post up ON up.post_id = p.post_id
--  WHERE o.org_id = 101 OR FIND_IN_SET(101, o.ancestors)
--  GROUP BY o.org_name, p.post_id ORDER BY o.org_id, p.post_sort;

-- 3) 无角色用户的数据权限兜底为「仅本人」，功能权限仍可由岗位/组织获得
-- SELECT u.user_name, COUNT(DISTINCT ur.role_id) AS roles FROM sys_user u
--   LEFT JOIN sys_user_role ur ON ur.user_id = u.user_id GROUP BY u.user_id HAVING roles = 0;

-- 4) 责任岗位唯一性巡检：同一组织出现多个 leader_post_id 指向的岗位即异常
-- SELECT o.org_id, COUNT(*) FROM sys_org o JOIN sys_post p ON p.post_id = o.leader_post_id
--  GROUP BY o.org_id HAVING COUNT(*) > 1;
