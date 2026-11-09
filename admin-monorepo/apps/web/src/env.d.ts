/// <reference types="vite/client" />

import 'vue-router';

declare module 'vue-router' {
  interface RouteMeta {
    /** 页面标题，用于侧边导航与面包屑 */
    title: string;
    /** 页面所需的功能权限，缺省表示无需鉴权（如工作台） */
    perm?: string;
    /** 是否允许未登录访问 */
    public?: boolean;
    /** 动态菜单路由对应的菜单图标标识 */
    icon?: string;
    /** 动态菜单路由对应的菜单 ID */
    menuId?: number;
  }
}
