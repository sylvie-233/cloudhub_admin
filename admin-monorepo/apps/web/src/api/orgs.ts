import type {
  CreateOrgInput,
  OrgDetail,
  OrgQuery,
  OrgTreeNode,
  OrgUserItem,
  PageResult,
  UpdateOrgInput,
} from '@cloudhub/types';

import { request } from './client';

export interface OrgUsersQuery {
  keyword?: string;
  postId?: number;
  includeSub?: boolean;
  page?: number;
  pageSize?: number;
}

export const orgApi = {
  /** 组织树 */
  list(query?: OrgQuery): Promise<OrgTreeNode[]> {
    return request<OrgTreeNode[]>('/orgs', { query: query });
  },

  detail(orgId: number): Promise<OrgDetail> {
    return request<OrgDetail>(`/orgs/${orgId}`);
  },

  create(input: CreateOrgInput): Promise<OrgDetail> {
    return request<OrgDetail>('/orgs', { method: 'POST', body: input });
  },

  update(orgId: number, input: UpdateOrgInput): Promise<OrgDetail> {
    return request<OrgDetail>(`/orgs/${orgId}`, { method: 'PUT', body: input });
  },

  remove(orgId: number): Promise<null> {
    return request<null>(`/orgs/${orgId}`, { method: 'DELETE' });
  },

  /** 组织在岗用户（可含下级、按岗位筛选） */
  users(orgId: number, query: OrgUsersQuery): Promise<PageResult<OrgUserItem>> {
    return request<PageResult<OrgUserItem>>(`/orgs/${orgId}/users`, {
      query: query,
    });
  },

  /** 设置/清空责任岗位 */
  setLeader(orgId: number, postId: number | null): Promise<{ leaderPostId: number | null }> {
    return request<{ leaderPostId: number | null }>(`/orgs/${orgId}/leader`, {
      method: 'PUT',
      body: { postId },
    });
  },
};
