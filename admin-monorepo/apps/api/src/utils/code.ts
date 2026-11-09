import { formatDate } from '@cloudhub/utils';

import { dbClient } from '../db/index.js';

/** 编码规则：组织 ZZ + yyyymmdd + 6 位序列号；岗位 GW + yyyymmdd + 6 位序列号。 */
const CODE_CONFIG = {
  org: { table: 'sys_org', column: 'org_code', prefix: 'ZZ' },
  post: { table: 'sys_post', column: 'post_code', prefix: 'GW' },
} as const;

export type BizCodeKind = keyof typeof CODE_CONFIG;

export async function generateBizCode(kind: BizCodeKind): Promise<string> {
  const config = CODE_CONFIG[kind];
  // 规则要求 yyyymmdd 紧凑格式，formatDate 返回的是 YYYY-MM-DD
  const datePart = formatDate().replaceAll('-', '');
  const prefix = `${config.prefix}${datePart}`;
  const row = await dbClient.queryOne<{ maxCode: string | null }>(
    `SELECT MAX(${config.column}) AS maxCode FROM ${config.table} WHERE ${config.column} LIKE ?`,
    [`${prefix}%`],
  );

  const sequence = row?.maxCode ? Number(row.maxCode.slice(prefix.length)) + 1 : 1;
  const safeSequence = Number.isFinite(sequence) && sequence > 0 ? sequence : 1;
  return `${prefix}${String(safeSequence).padStart(6, '0')}`;
}
