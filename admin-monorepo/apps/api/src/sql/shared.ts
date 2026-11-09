import { escapeLike } from '@cloudhub/utils';

/** 参数化 SQL 语句：sql 与按占位符顺序排列的参数。 */
export interface SqlStatement {
  sql: string;
  params: readonly unknown[];
}

/** SQL 片段：由调用方拼入完整语句，参数需一并保留。 */
export type SqlFragment = SqlStatement;

/** 跨领域复用的用户列，统一别名，供 JOIN 后选择。 */
export const USER_COLUMNS = `u.user_id AS userId, u.user_name AS userName, u.nick_name AS nickName,
  u.email, u.phonenumber, u.sex, u.status, u.del_flag AS delFlag,
  u.create_by AS createBy, u.create_time AS createTime,
  u.update_by AS updateBy, u.update_time AS updateTime`;

/** 统一的 LIKE 参数生成，转义通配符，避免用户输入改变匹配语义。 */
export function likePattern(keyword: string): string {
  return `%${escapeLike(keyword)}%`;
}
