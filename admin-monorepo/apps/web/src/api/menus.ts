import type {
  CreateMenuInput,
  Menu,
  MenuQuery,
  MenuRow,
  MenuTreeNode,
  UpdateMenuInput,
} from '@cloudhub/types';

import { request } from './client';

export const menuApi = {
  /** 扁平菜单行（默认按树展开，筛选时平铺） */
  list(query?: MenuQuery): Promise<MenuRow[]> {
    return request<MenuRow[]>('/menus', {
      query: query,
    });
  },

  /** 完整菜单树（含动作节点） */
  tree(): Promise<MenuTreeNode[]> {
    return request<MenuTreeNode[]>('/menus/tree');
  },

  detail(menuId: number): Promise<Menu> {
    return request<Menu>(`/menus/${menuId}`);
  },

  create(input: CreateMenuInput): Promise<Menu> {
    return request<Menu>('/menus', { method: 'POST', body: input });
  },

  update(menuId: number, input: UpdateMenuInput): Promise<Menu> {
    return request<Menu>(`/menus/${menuId}`, { method: 'PUT', body: input });
  },

  remove(menuId: number): Promise<null> {
    return request<null>(`/menus/${menuId}`, { method: 'DELETE' });
  },
};
