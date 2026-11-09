import { getDashboardStats as loadStats } from '../services/dashboard.service.js';
import type { AppContext } from '../types/context.js';
import { success } from '../utils/http.js';

/** GET /api/dashboard/stats */
export async function getDashboardStats(c: AppContext): Promise<Response> {
  const { userId } = c.get('currentUser');
  return success(c, await loadStats(userId));
}
