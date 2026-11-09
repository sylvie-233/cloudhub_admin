import type {
  CreatePostInput,
  PostDetail,
  PostTreeNode,
  UpdatePostInput,
} from '@cloudhub/types';

import { request } from './client';

export const postApi = {
  /** 某组织的岗位树 */
  list(orgId: number): Promise<PostTreeNode[]> {
    return request<PostTreeNode[]>('/posts', { query: { orgId } });
  },

  detail(postId: number): Promise<PostDetail> {
    return request<PostDetail>(`/posts/${postId}`);
  },

  create(input: CreatePostInput): Promise<PostDetail> {
    return request<PostDetail>('/posts', { method: 'POST', body: input });
  },

  update(postId: number, input: UpdatePostInput): Promise<PostDetail> {
    return request<PostDetail>(`/posts/${postId}`, { method: 'PUT', body: input });
  },

  remove(postId: number): Promise<null> {
    return request<null>(`/posts/${postId}`, { method: 'DELETE' });
  },
};
