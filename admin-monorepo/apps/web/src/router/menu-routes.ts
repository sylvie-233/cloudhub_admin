import type { UserMenuNode } from '@cloudhub/types';
import { RESERVED_MENU_PATHS } from '@cloudhub/types';
import type { Component } from 'vue';
import type { RouteRecordRaw } from 'vue-router';

import { Folder } from 'lucide-vue-next';

import { normalizeMenuPath } from '@/utils/format';
import { resolveMenuIcon } from '@/utils/icons';
import { resolveViewComponent } from '@/utils/view-components';

/** 非菜单路由占用的路径，菜单中不能重复使用。 */
export const RESERVED_ROUTE_PATHS = new Set<string>(
  RESERVED_MENU_PATHS.map((path) => path.toLowerCase()),
);

export interface NavItem {
  menuId: number;
  label: string;
  path: string;
  icon: Component;
  perm?: string;
}

export interface NavGroup {
  /** 分组稳定标识，用于折叠状态；不依赖可重复的显示名称。 */
  key: string;
  label: string;
  icon?: Component;
  items: NavItem[];
  /** 菜单目录 M 生成的分组可折叠；合成分组（概览/功能）不折叠。 */
  collapsible: boolean;
}

export interface MenuRouteBuildResult {
  routes: RouteRecordRaw[];
  warnings: string[];
}

interface MenuPage {
  menu: UserMenuNode;
  path: string;
  component: () => Promise<Component>;
}

interface MenuPageCollection {
  pages: MenuPage[];
  warnings: string[];
}

/**
 * 收集可注册的菜单页面：只接受同时具备合法路由地址和真实组件文件的 C 菜单，
 * 并统一处理重复地址与内置路由冲突。路由与侧边栏共用这份结果，避免两者不一致。
 */
function collectMenuPages(
  menus: UserMenuNode[],
  reservedPaths: Set<string> = RESERVED_ROUTE_PATHS,
): MenuPageCollection {
  const pages: MenuPage[] = [];
  const warnings: string[] = [];
  const usedPaths = new Set(Array.from(reservedPaths, (path) => path.toLowerCase()));

  const walk = (nodes: UserMenuNode[]): void => {
    for (const menu of nodes) {
      if (menu.menuType === 'C') {
        const path = normalizeMenuPath(menu.path);
        if (!path) {
          warnings.push(`菜单「${menu.menuName}」缺少路由地址，已跳过`);
        } else if (usedPaths.has(path.toLowerCase())) {
          warnings.push(`菜单「${menu.menuName}」的路由地址 /${path} 重复或与内置路由冲突，已跳过`);
        } else {
          const component = resolveViewComponent(menu.component);
          if (!component) {
            warnings.push(
              `菜单「${menu.menuName}」的组件 ${menu.component ?? '(空)'} 不存在，已跳过`,
            );
          } else {
            usedPaths.add(path.toLowerCase());
            pages.push({ menu, path, component });
          }
        }
      }
      walk(menu.children);
    }
  };

  walk(menus);
  return { pages, warnings };
}

function buildRoute(page: MenuPage): RouteRecordRaw {
  return {
    path: page.path,
    name: `menu-${page.menu.menuId}`,
    component: page.component,
    meta: {
      title: page.menu.menuName,
      icon: page.menu.icon,
      menuId: page.menu.menuId,
      perm: page.menu.perms ?? undefined,
    },
  };
}

/**
 * 根据用户菜单树构建路由。
 *
 * 约定：M 只作为导航分组，不产生路由；C 的 path 是布局下的一级路由，
 * component 是 views 目录下的组件路径。F 不出现在 profile.menus 中。
 */
export function buildMenuRoutes(
  menus: UserMenuNode[],
  reservedPaths: Set<string> = RESERVED_ROUTE_PATHS,
): MenuRouteBuildResult {
  const { pages, warnings } = collectMenuPages(menus, reservedPaths);
  return { routes: pages.map(buildRoute), warnings };
}

/** 把菜单树整理成侧边栏分组；无效或重复的菜单同样不会出现。 */
export function buildNavGroups(
  menus: UserMenuNode[],
  reservedPaths: Set<string> = RESERVED_ROUTE_PATHS,
): NavGroup[] {
  const { pages } = collectMenuPages(menus, reservedPaths);
  const pageByMenuId = new Map(pages.map((page) => [page.menu.menuId, page]));
  const groups: NavGroup[] = [];
  const looseItems: NavItem[] = [];

  const toNavItem = (menu: UserMenuNode): NavItem | null => {
    const page = pageByMenuId.get(menu.menuId);
    if (!page) {
      return null;
    }
    return {
      menuId: menu.menuId,
      label: menu.menuName,
      path: `/${page.path}`,
      icon: resolveMenuIcon(menu.icon) ?? Folder,
      perm: menu.perms ?? undefined,
    };
  };

  const collectPages = (nodes: UserMenuNode[]): NavItem[] => {
    const items: NavItem[] = [];
    for (const node of nodes) {
      const item = toNavItem(node);
      if (item) {
        items.push(item);
      }
      items.push(...collectPages(node.children));
    }
    return items;
  };

  for (const menu of menus) {
    if (menu.menuType === 'M') {
      const items = collectPages(menu.children);
      if (items.length > 0) {
        groups.push({
          key: `menu-dir-${menu.menuId}`,
          label: menu.menuName,
          icon: resolveMenuIcon(menu.icon) ?? Folder,
          items,
          collapsible: true,
        });
      }
      continue;
    }
    const item = toNavItem(menu);
    if (item) {
      looseItems.push(item);
    }
  }

  if (looseItems.length > 0) {
    groups.push({
      key: 'loose-menu',
      label: '功能',
      icon: Folder,
      items: looseItems,
      collapsible: false,
    });
  }
  return groups;
}

/** 按权限标识查找用户可访问的菜单路径，供页面内跳转使用。 */
export function findMenuPathByPerm(menus: UserMenuNode[], perm: string): string | null {
  const { pages } = collectMenuPages(menus);
  const page = pages.find((item) => item.menu.perms === perm);
  return page ? `/${page.path}` : null;
}
