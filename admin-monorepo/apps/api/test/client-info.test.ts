import { Hono } from 'hono';
import { describe, expect, it } from 'vitest';

import type { ClientInfo } from '../src/utils/client.js';
import { getClientInfo } from '../src/utils/client.js';

const CHROME_WINDOWS_UA =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36';
const EDGE_UA =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36 Edg/120.0.0.0';
const IPHONE_UA =
  'Mozilla/5.0 (iPhone; CPU iPhone OS 17_1 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.1 Mobile/15E148 Safari/604.1';

const app = new Hono();
app.get('/info', (c) => c.json(getClientInfo(c)));

async function call(headers?: Record<string, string>): Promise<ClientInfo> {
  const res = await app.request('/info', { headers });
  return (await res.json()) as ClientInfo;
}

describe('登录客户端信息采集', () => {
  it('内网 IP 标记为内网，并解析浏览器与系统', async () => {
    const info = await call({
      'x-forwarded-for': '10.0.0.5, 8.8.8.8',
      'user-agent': CHROME_WINDOWS_UA,
    });

    expect(info.ipaddr).toBe('10.0.0.5');
    expect(info.loginLocation).toBe('内网');
    expect(info.browser).toBe('Chrome 120');
    expect(info.os).toBe('Windows 10/11');
  });

  it('公网 IP 的归属地暂记为未知', async () => {
    const info = await call({ 'x-forwarded-for': '8.8.8.8' });

    expect(info.ipaddr).toBe('8.8.8.8');
    expect(info.loginLocation).toBe('未知');
  });

  it('优先使用 x-forwarded-for，缺失时回退 x-real-ip', async () => {
    const info = await call({ 'x-real-ip': '192.168.1.10' });

    expect(info.ipaddr).toBe('192.168.1.10');
    expect(info.loginLocation).toBe('内网');
  });

  it('无法获取 IP 时统一记为未知', async () => {
    const info = await call();

    expect(info.ipaddr).toBe('未知');
    expect(info.loginLocation).toBe('未知');
    expect(info.browser).toBe('未知');
    expect(info.os).toBe('未知');
  });

  it('Edge 优先于同 UA 中的 Chrome 标识', async () => {
    const info = await call({ 'user-agent': EDGE_UA });

    expect(info.browser).toBe('Edge 120');
  });

  it('可识别 iPhone 的浏览器与系统版本', async () => {
    const info = await call({ 'user-agent': IPHONE_UA });

    expect(info.browser).toBe('Safari 17');
    expect(info.os).toBe('iOS 17.1');
  });
});
