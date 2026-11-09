import type { MenuTreeNode, OrgTreeNode, PostTreeNode, Sex } from '@cloudhub/types';

export interface FlatOrgNode {
  org: OrgTreeNode;
  level: number;
  hasChildren: boolean;
  path: string;
}

export interface FlatPostNode {
  post: PostTreeNode;
  level: number;
  hasChildren: boolean;
}

export interface FlatMenuNode {
  menu: MenuTreeNode;
  level: number;
  hasChildren: boolean;
}

/** 组织树拍平；collapsed 中的节点不展开下级。 */
export function flattenOrgTree(
  nodes: OrgTreeNode[],
  collapsed?: Set<number>,
  level = 0,
  parentPath = '',
): FlatOrgNode[] {
  const result: FlatOrgNode[] = [];
  for (const org of nodes) {
    const path = parentPath ? `${parentPath} / ${org.orgName}` : org.orgName;
    result.push({
      org,
      level,
      hasChildren: org.children.length > 0,
      path,
    });
    if (org.children.length > 0 && !collapsed?.has(org.orgId)) {
      result.push(...flattenOrgTree(org.children, collapsed, level + 1, path));
    }
  }
  return result;
}

/** 岗位树拍平；collapsed 中的节点不展开下级。 */
export function flattenPostTree(
  nodes: PostTreeNode[],
  collapsed?: Set<number>,
  level = 0,
): FlatPostNode[] {
  const result: FlatPostNode[] = [];
  for (const post of nodes) {
    result.push({
      post,
      level,
      hasChildren: post.children.length > 0,
    });
    if (post.children.length > 0 && !collapsed?.has(post.postId)) {
      result.push(...flattenPostTree(post.children, collapsed, level + 1));
    }
  }
  return result;
}

/** 菜单树拍平；collapsed 中的节点不展开下级。 */
export function flattenMenuTree(
  nodes: MenuTreeNode[],
  collapsed?: Set<number>,
  level = 0,
): FlatMenuNode[] {
  const result: FlatMenuNode[] = [];
  for (const menu of nodes) {
    result.push({
      menu,
      level,
      hasChildren: menu.children.length > 0,
    });
    if (menu.children.length > 0 && !collapsed?.has(menu.menuId)) {
      result.push(...flattenMenuTree(menu.children, collapsed, level + 1));
    }
  }
  return result;
}

/** 收集菜单节点及其全部后代 ID。 */
export function collectMenuIds(node: MenuTreeNode): number[] {
  const ids = [node.menuId];
  for (const child of node.children) {
    ids.push(...collectMenuIds(child));
  }
  return ids;
}

/** 收集岗位节点及其全部后代 ID。 */
export function collectPostIds(node: PostTreeNode): number[] {
  const ids = [node.postId];
  for (const child of node.children) {
    ids.push(...collectPostIds(child));
  }
  return ids;
}

export function sexLabel(sex: Sex | string): string {
  if (sex === '0') {
    return '男';
  }
  if (sex === '1') {
    return '女';
  }
  return '未知';
}

/** 后端的日期字符串原样返回，空值显示为破折号。 */
export function formatDateTime(value: string | null | undefined): string {
  return value || '—';
}

/** 把表单内的空字符串转换为 undefined，避免提交空值覆盖。 */
export function trimToUndefined(value: string): string | undefined {
  const trimmed = value.trim();
  return trimmed ? trimmed : undefined;
}

export function parseOptionalNumber(value: string | number): number | undefined {
  if (value === '') {
    return undefined;
  }
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : undefined;
}
