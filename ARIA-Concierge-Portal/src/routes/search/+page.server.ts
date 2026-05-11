import type { PageServerLoad } from './$types';
import { pgPool } from '$lib/server/db';

export const load: PageServerLoad = async ({ url }) => {
  const q = url.searchParams.get('q') ?? '';
  if (!q) return { q, rows: [], error: null, columns: [] };

  // !! INTENTIONAL UNION-BASED SQL INJECTION
  // The query string is concatenated directly into a UNION-shaped SQL
  // statement. Rooms + Restaurants are unioned to make a 4-column shape
  // pentesters can attack with `' UNION SELECT 1,2,3,4-- -` style payloads.
  const sql = `
    SELECT 'room' AS kind, id, name, description FROM "Room"
      WHERE name ILIKE '%${q}%' OR description ILIKE '%${q}%'
    UNION
    SELECT 'restaurant' AS kind, id, name, description FROM "Restaurant"
      WHERE name ILIKE '%${q}%' OR description ILIKE '%${q}%'
  `;

  try {
    const res = await pgPool.query(sql);
    return { q, rows: res.rows, error: null, columns: res.fields.map((f) => f.name) };
  } catch (e: any) {
    return { q, rows: [], error: e?.message ?? 'query failed', columns: [] };
  }
};
