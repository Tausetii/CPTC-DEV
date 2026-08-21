import { prisma } from './db';
import { randomBytes, createHash } from 'node:crypto';
import bcrypt from 'bcryptjs';
import type { Cookies } from '@sveltejs/kit';

const sessions = new Map<string, { userId: number; createdAt: number }>();

export async function createSession(userId: number, cookies: Cookies) {
  const sid = randomBytes(24).toString('hex');
  sessions.set(sid, { userId, createdAt: Date.now() });
  cookies.set('aria_sid', sid, {
    path: '/',
    httpOnly: true,
    sameSite: 'lax',
    maxAge: 60 * 60 * 24 * 7
  });
  return sid;
}

export async function getUserFromCookies(cookies: Cookies) {
  const sid = cookies.get('aria_sid');
  if (!sid) return null;
  const s = sessions.get(sid);
  if (!s) return null;
  const u = await prisma.user.findUnique({ where: { id: s.userId } });
  if (!u) return null;
  return {
    id: u.id, email: u.email, fullName: u.fullName, role: u.role,
    rewardsTier: u.rewardsTier, quantumPoints: u.quantumPoints
  };
}

export function destroySession(cookies: Cookies) {
  const sid = cookies.get('aria_sid');
  if (sid) sessions.delete(sid);
  cookies.delete('aria_sid', { path: '/' });
}

export function hashPassword(p: string) { return bcrypt.hashSync(p, 10); }
export function verifyPassword(p: string, hash: string) {
  try { return bcrypt.compareSync(p, hash); }
  catch { return false; }
}
export function genResetToken() { return randomBytes(24).toString('hex'); }
export function sha256(s: string) { return createHash('sha256').update(s).digest('hex'); }
