/**
 * READ-ONLY: see who's holding the Prisma migration advisory lock (72707369)
 * and what other connections are active. Helps decide whether to wait or to
 * terminate a stuck session.
 */
import { prisma } from '../lib/prisma';

async function main() {
  const dbUrl = (process.env.DATABASE_URL || '').replace(/:[^:@]+@/, ':****@');
  console.log(`\nConnected to: ${dbUrl}\n`);

  const locks = await prisma.$queryRawUnsafe<
    Array<{
      pid: number;
      locktype: string;
      mode: string;
      granted: boolean;
      objid: string | null;
      query: string | null;
      state: string | null;
      application_name: string | null;
      client_addr: string | null;
      query_start: Date | null;
    }>
  >(`
    SELECT
      l.pid,
      l.locktype,
      l.mode,
      l.granted,
      CAST((l.classid::bigint << 32 | l.objid::bigint) AS TEXT) AS objid,
      a.query,
      a.state,
      a.application_name,
      a.client_addr::text AS client_addr,
      a.query_start
    FROM pg_locks l
    LEFT JOIN pg_stat_activity a ON a.pid = l.pid
    WHERE l.locktype = 'advisory'
    ORDER BY l.granted DESC, l.pid
  `);

  console.log(`Advisory locks: ${locks.length}`);
  if (locks.length) console.table(locks);

  const activity = await prisma.$queryRawUnsafe<
    Array<{
      pid: number;
      state: string | null;
      application_name: string | null;
      query: string | null;
      query_start: Date | null;
      state_change: Date | null;
    }>
  >(`
    SELECT pid, state, application_name, query_start, state_change, substring(query, 1, 100) AS query
    FROM pg_stat_activity
    WHERE datname = current_database() AND pid <> pg_backend_pid()
    ORDER BY state_change DESC NULLS LAST
  `);

  console.log(`\nAll active sessions on this DB (besides my own): ${activity.length}`);
  if (activity.length) console.table(activity);
}

main()
  .catch((e) => { console.error(e); process.exit(1); })
  .finally(async () => { await prisma.$disconnect(); });
