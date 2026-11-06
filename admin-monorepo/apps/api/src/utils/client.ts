import { getConnInfo } from '@hono/node-server/conninfo';
import type { Context } from 'hono';

import { parseUserAgent } from '@cloudhub/utils';

export interface ClientInfo {
  ipaddr: string;
  loginLocation: string;
  browser: string;
  os: string;
}

function isPrivateIp(ip: string): boolean {
  return (
    ip === '::1' ||
    ip === '127.0.0.1' ||
    /^10\./.test(ip) ||
    /^192\.168\./.test(ip) ||
    /^172\.(1[6-9]|2\d|3[01])\./.test(ip)
  );
}

/** 采集登录日志所需的客户端信息；内网 IP 标记为「内网」，未接入 IP 地库。 */
export function getClientInfo(c: Context): ClientInfo {
  const forwarded = c.req.header('x-forwarded-for')?.split(',')[0]?.trim();
  const realIp = c.req.header('x-real-ip');
  let ipaddr = forwarded || realIp || '';
  if (!ipaddr) {
    try {
      ipaddr = getConnInfo(c).remote.address ?? '';
    } catch {
      ipaddr = '';
    }
  }

  const { browser, os } = parseUserAgent(c.req.header('user-agent') ?? '');
  const loginLocation = ipaddr && isPrivateIp(ipaddr) ? '内网' : '未知';

  return { ipaddr: ipaddr || '未知', loginLocation, browser, os };
}
