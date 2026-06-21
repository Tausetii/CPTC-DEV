/**
 * Proxy self-enrollment client.
 *
 * On launch the portal registers itself with the AI proxy and asks to be
 * approved. It generates (and persists) its own proxy token, posts it to the
 * proxy's /enroll endpoint, and is held as "pending" until the operator clicks
 * Allow in the proxy admin console. No key needs to be copied by hand.
 *
 * Env:
 *   GEMINI_PROXY_URL      base URL of the proxy (required for live AI)
 *   GEMINI_PROXY_TOKEN    optional fixed token; if unset one is generated & saved
 *   PROXY_MACHINE_LABEL   label shown to the operator (defaults to hostname)
 *   PROXY_TOKEN_FILE      where to persist the generated token
 *                         (default: <JWT_KEY_DIR or ./keys>/.proxy-token)
 */

import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';

const PROXY_URL = (process.env.GEMINI_PROXY_URL || '').replace(/\/+$/, '');
const LABEL =
  process.env.PROXY_MACHINE_LABEL ||
  process.env.PUBLIC_APP_NAME ||
  os.hostname() ||
  'aria-portal';
const TOKEN_FILE =
  process.env.PROXY_TOKEN_FILE ||
  path.join(process.env.JWT_KEY_DIR || './keys', '.proxy-token');

let cachedToken: string | null = null;
let lastStatus = 'unknown';

/** Load a persisted token, an env-provided token, or mint and persist a new one. */
function loadOrCreateToken(): string {
  if (cachedToken) return cachedToken;

  // An explicitly provided token always wins (backwards compatible).
  if (process.env.GEMINI_PROXY_TOKEN && process.env.GEMINI_PROXY_TOKEN.length >= 24) {
    cachedToken = process.env.GEMINI_PROXY_TOKEN;
    return cachedToken;
  }

  try {
    if (fs.existsSync(TOKEN_FILE)) {
      const t = fs.readFileSync(TOKEN_FILE, 'utf8').trim();
      if (t.length >= 24) {
        cachedToken = t;
        return cachedToken;
      }
    }
  } catch {
    /* fall through to minting */
  }

  cachedToken = 'arpx_' + crypto.randomBytes(32).toString('base64url');
  try {
    fs.mkdirSync(path.dirname(TOKEN_FILE), { recursive: true });
    fs.writeFileSync(TOKEN_FILE, cachedToken, { mode: 0o600 });
  } catch {
    /* if we can't persist, keep using the in-memory token for this process */
  }
  return cachedToken;
}

/** The token this portal authenticates to the proxy with. */
export function getProxyToken(): string {
  return loadOrCreateToken();
}

/** Last enrollment status we observed (active | pending | denied | unreachable | error | unknown). */
export function getEnrollmentStatus(): string {
  return lastStatus;
}

/**
 * Idempotently (re)request approval and return the current status. Safe to call
 * repeatedly — the proxy just reports the existing machine's status, so this
 * doubles as a poll for "have I been approved yet?".
 */
export async function requestApproval(): Promise<string> {
  if (!PROXY_URL) {
    lastStatus = 'no-proxy';
    return lastStatus;
  }
  try {
    const res = await fetch(`${PROXY_URL}/enroll`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ label: LABEL, token: loadOrCreateToken() })
    });
    if (!res.ok) {
      lastStatus = 'error';
      return lastStatus;
    }
    const body = (await res.json()) as { status?: string };
    lastStatus = body.status || 'unknown';
    return lastStatus;
  } catch {
    lastStatus = 'unreachable';
    return lastStatus;
  }
}

/** Fire-and-forget enrollment at server boot (logs the outcome). */
export function enrollOnBoot(): void {
  if (!PROXY_URL) return;
  requestApproval().then((status) => {
    if (status === 'active') {
      console.log(`[enroll] proxy access active as "${LABEL}"`);
    } else if (status === 'pending') {
      console.log(`[enroll] requested approval as "${LABEL}" — awaiting Allow in the proxy admin console`);
    } else {
      console.log(`[enroll] proxy enrollment status: ${status}`);
    }
  });
}
