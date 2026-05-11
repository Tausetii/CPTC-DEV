import { PrismaClient } from '@prisma/client';
import pg from 'pg';

declare global {
  // eslint-disable-next-line no-var
  var __prisma: PrismaClient | undefined;
  // eslint-disable-next-line no-var
  var __pgpool: pg.Pool | undefined;
}

export const prisma = globalThis.__prisma ?? new PrismaClient();
if (process.env.NODE_ENV !== 'production') globalThis.__prisma = prisma;

// Raw pg pool — used by deliberately vulnerable raw-SQL endpoints.
export const pgPool =
  globalThis.__pgpool ??
  new pg.Pool({ connectionString: process.env.DATABASE_URL });
if (process.env.NODE_ENV !== 'production') globalThis.__pgpool = pgPool;
