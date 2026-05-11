import { readFileSync } from 'node:fs';

/**
 * Intentionally vulnerable XML parser supporting external entities (XXE).
 * Real-world equivalent: libxml with `noent: true` / `LOAD_DTD`.
 *
 * Handles:
 *   <!DOCTYPE root [
 *     <!ENTITY local "literal value">
 *     <!ENTITY ext SYSTEM "file:///etc/passwd">
 *   ]>
 *   ... &local; ... &ext; ...
 *
 * Element extraction is a deliberately simple regex parser — fine for the
 * structured booking XML the import endpoint expects.
 */

export interface ParsedBooking {
  email?: string;
  room?: string;
  checkIn?: string;
  checkOut?: string;
  guests?: number;
  notes?: string;
  _rawAfterEntities: string;
}

function resolveExternal(uri: string): string {
  try {
    if (uri.startsWith('file://')) return readFileSync(uri.replace('file://', ''), 'utf8');
    if (uri.startsWith('http://') || uri.startsWith('https://')) {
      // Synchronous fetch isn't available; pentesters mostly care about file://.
      return `[external:${uri}]`;
    }
    return readFileSync(uri, 'utf8');
  } catch (e: any) {
    return `[error:${e?.message ?? 'unknown'}]`;
  }
}

export function parseVulnerableXml(xml: string): ParsedBooking {
  const entities = new Map<string, string>();

  const dtMatch = xml.match(/<!DOCTYPE[^\[]*\[([\s\S]*?)\]\s*>/);
  if (dtMatch) {
    const decl = dtMatch[1];
    const re = /<!ENTITY\s+(\S+)\s+(SYSTEM\s+"([^"]+)"|"([^"]*)")\s*>/g;
    let m: RegExpExecArray | null;
    while ((m = re.exec(decl))) {
      const name = m[1];
      if (m[3]) entities.set(name, resolveExternal(m[3]));
      else if (m[4] !== undefined) entities.set(name, m[4]);
    }
  }

  // Substitute &name; references (multiple passes for nested entities)
  let body = xml;
  for (let i = 0; i < 5; i++) {
    body = body.replace(/&([A-Za-z_][\w.-]*);/g, (full, n) =>
      entities.has(n) ? (entities.get(n) as string) : full
    );
  }

  const pick = (tag: string) => {
    const r = new RegExp(`<${tag}>([\\s\\S]*?)</${tag}>`, 'i').exec(body);
    return r ? r[1].trim() : undefined;
  };

  return {
    email: pick('email'),
    room: pick('room'),
    checkIn: pick('checkIn'),
    checkOut: pick('checkOut'),
    guests: pick('guests') ? Number(pick('guests')) : undefined,
    notes: pick('notes'),
    _rawAfterEntities: body
  };
}
