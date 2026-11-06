import { compare, hash } from 'bcryptjs';

/** 种子数据与新建用户的默认密码。 */
export const DEFAULT_PASSWORD = 'admin123';

const SALT_ROUNDS = 10;

export async function hashPassword(plain: string): Promise<string> {
  return hash(plain, SALT_ROUNDS);
}

export async function verifyPassword(plain: string, hashed: string): Promise<boolean> {
  if (!hashed) {
    return false;
  }
  return compare(plain, hashed);
}
