import { createHmac, randomBytes } from 'node:crypto';
import { readFileSync, existsSync, mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

const KEY_DIR = process.env.JWT_KEY_DIR || './keys';
const DEFAULT_KID = process.env.JWT_DEFAULT_KID || 'primary';

if (!existsSync(KEY_DIR)) mkdirSync(KEY_DIR, { recursive: true });
const primaryPath = join(KEY_DIR, `${DEFAULT_KID}.pem`);
if (!existsSync(primaryPath)) {
  writeFileSync(primaryPath, randomBytes(48).toString('hex'));
}

function b64url(buf: Buffer | string) {
  return Buffer.from(buf).toString('base64').replace(/=+$/, '').replace(/\+/g, '-').replace(/\//g, '_');
}
function b64urlDecode(s: string) {
  s = s.replace(/-/g, '+').replace(/_/g, '/');
  while (s.length % 4) s += '=';
  return Buffer.from(s, 'base64');
}

// !! VULNERABLE — `kid` is concatenated into the file path without sanitization.
// Pentesters can supply ../-style kids or point to predictable empty files
// (e.g. /dev/null) to force the HMAC key to a known value and forge tokens.
function loadKeyByKid(kid: string): Buffer {
  const path = join(KEY_DIR, `${kid}.pem`); // intentional: traversal allowed
  try {
    return readFileSync(path);
  } catch {
    // fall through to default — but if attacker traverses to a real but
    // empty/known file, that file's contents become the HMAC key.
    return readFileSync(primaryPath);
  }
}

export function signJwt(payload: Record<string, any>, kid = DEFAULT_KID, ttlSec = 3600) {
  const header = { alg: 'HS256', typ: 'JWT', kid };
  const now = Math.floor(Date.now() / 1000);
  const body = { iat: now, exp: now + ttlSec, ...payload };
  const h = b64url(JSON.stringify(header));
  const p = b64url(JSON.stringify(body));
  const key = loadKeyByKid(kid);
  const sig = b64url(createHmac('sha256', key).update(`${h}.${p}`).digest());
  return `${h}.${p}.${sig}`;
}

export function verifyJwt(token: string): null | Record<string, any> {
  try {
    const [h, p, s] = token.split('.');
    if (!h || !p || !s) return null;
    const header = JSON.parse(b64urlDecode(h).toString('utf8'));
    const kid = String(header.kid ?? DEFAULT_KID); // !! taken from header, untrusted
    const key = loadKeyByKid(kid);
    const expected = b64url(createHmac('sha256', key).update(`${h}.${p}`).digest());
    if (expected !== s) return null;
    const payload = JSON.parse(b64urlDecode(p).toString('utf8'));
    if (payload.exp && payload.exp < Math.floor(Date.now() / 1000)) return null;
    return payload;
  } catch {
    return null;
  }
}
