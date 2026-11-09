import { sign } from 'hono/jwt';
import { describe, expect, it } from 'vitest';

import { env } from '../src/config/env.js';
import { signToken, verifyToken } from '../src/utils/jwt.js';

describe('JWT 签发与校验', () => {
  it('签发后可解析出用户、岗位与有效期', async () => {
    const { token, expiresIn } = await signToken(7, 'admin', 3);
    const payload = await verifyToken(token);

    expect(expiresIn).toBe(env.JWT_EXPIRES_IN);
    expect(payload).not.toBeNull();
    expect(payload?.userId).toBe(7);
    expect(payload?.userName).toBe('admin');
    expect(payload?.postId).toBe(3);
    expect(payload?.iat).toBeTypeOf('number');
    expect(payload?.exp).toBeTypeOf('number');
  });

  it('岗位为空时解析为 null', async () => {
    const { token } = await signToken(7, 'admin', null);
    const payload = await verifyToken(token);

    expect(payload?.postId).toBeNull();
  });

  it('被篡改的 token 返回 null', async () => {
    const { token } = await signToken(1, 'admin', null);

    await expect(verifyToken(`${token}tampered`)).resolves.toBeNull();
  });

  it('使用其他密钥签发的 token 返回 null', async () => {
    const forged = await sign(
      { userId: 1, userName: 'admin', postId: null },
      'another-secret-123456',
      'HS256',
    );

    await expect(verifyToken(forged)).resolves.toBeNull();
  });

  it('过期 token 返回 null', async () => {
    const expired = await sign(
      {
        userId: 1,
        userName: 'admin',
        postId: null,
        exp: Math.floor(Date.now() / 1000) - 60,
      },
      env.JWT_SECRET,
      'HS256',
    );

    await expect(verifyToken(expired)).resolves.toBeNull();
  });

  it('载荷字段非法时返回 null', async () => {
    const wrongUser = await sign(
      { userId: 'not-a-number', userName: 'admin' },
      env.JWT_SECRET,
      'HS256',
    );
    const missingName = await sign({ userId: 1 }, env.JWT_SECRET, 'HS256');
    const zeroUser = await sign({ userId: 0, userName: 'admin' }, env.JWT_SECRET, 'HS256');

    await expect(verifyToken(wrongUser)).resolves.toBeNull();
    await expect(verifyToken(missingName)).resolves.toBeNull();
    await expect(verifyToken(zeroUser)).resolves.toBeNull();
  });
});
