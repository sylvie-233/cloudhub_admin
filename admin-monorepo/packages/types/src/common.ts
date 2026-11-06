/** 通用状态位：0 正常，1 停用。 */
export type Status = '0' | '1';

/** 软删除标志：0 存在，2 删除。 */
export type DelFlag = '0' | '2';

/** 菜单类型：M 目录 / C 菜单 / F 动作。 */
export type MenuType = 'M' | 'C' | 'F';

/** 数据范围：1 全部 / 2 自定义 / 3 本组织 / 4 本组织及以下 / 5 仅本人。 */
export type DataScope = '1' | '2' | '3' | '4' | '5';

/** 性别：0 男 / 1 女 / 2 未知。 */
export type Sex = '0' | '1' | '2';

/** 权限来源：user=角色，post=岗位直授，org=组织直授。 */
export type GrantSource = 'user' | 'post' | 'org';

/** 统一响应结构。 */
export interface ApiResponse<T = unknown> {
  code: number;
  message: string;
  data: T;
}

/** 分页查询参数。 */
export interface PageQuery {
  page?: number;
  pageSize?: number;
}

/** 分页结果。 */
export interface PageResult<T> {
  list: T[];
  total: number;
  page: number;
  pageSize: number;
}
