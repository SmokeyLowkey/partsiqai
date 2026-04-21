/**
 * Release the Prisma migration advisory lock (72707369) by terminating any
 * session that holds it or is waiting on it. Only targets the specific lock
 * id; does not touch unrelated connections.
 */
import { prisma } from '../lib/prisma';

const LOCK_OBJID = '72707369';

async function main() {
  const dbUrl = (process.env.DATABASE_URL || '').replace(/:[^:@]+@/, ':****@');
  console.log(`\nConnected to: ${dbUrl}\n`);

  const sessions = await prisma.$queryRawUnsafe<Array<{ pid: number; granted: boolean; state: string | null; query: string | null }>>(`
    SELECT l.pid, l.granted, a.state, substring(a.query, 1, 80) AS query
    FROM pg_locks l
    LEFT JOIN pg_stat_activity a ON a.pid = l.pid
    WHERE l.locktype = 'advisory' AND l.objid = ${LOCK_OBJID}
  `);

  console.log(`Sessions touching lock ${LOCK_OBJID}:`);
  console.table(sessions);

  for (const s of sessions) {
    const res = await prisma.$queryRawUnsafe<Array<{ pg_terminate_backend: boolean }>>(
      `SELECT pg_terminate_backend(${s.pid})`
    );
    console.log(`Terminated PID ${s.pid} (${s.granted ? 'HELD' : 'WAITING'}, ${s.state}): ${res[0]?.pg_terminate_backend}`);
  }

  // Small grace period for Postgres to clean up.
  await new Promise((r) => setTimeout(r, 2000));

  const remaining = await prisma.$queryRawUnsafe<Array<{ count: bigint }>>(
    `SELECT count(*)::bigint AS count FROM pg_locks WHERE locktype = 'advisory' AND objid = ${LOCK_OBJID}`
  );
  console.log(`\nRemaining sessions on lock ${LOCK_OBJID}: ${remaining[0]?.count ?? 0}`);
}

main()
  .catch((e) => { console.error(e); process.exit(1); })
  .finally(async () => { await prisma.$disconnect(); });
