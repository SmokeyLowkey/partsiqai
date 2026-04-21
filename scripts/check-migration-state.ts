/**
 * READ-ONLY: enumerate the _prisma_migrations table on the configured DB
 * so we can see which migrations recorded as applied, which are pending,
 * and whether any failed mid-apply.
 */
import { prisma } from '../lib/prisma';

async function main() {
  const dbUrl = (process.env.DATABASE_URL || '').replace(/:[^:@]+@/, ':****@');
  console.log(`\nConnected to: ${dbUrl}\n`);

  const rows = await prisma.$queryRawUnsafe<
    Array<{
      id: string;
      migration_name: string;
      started_at: Date | null;
      finished_at: Date | null;
      logs: string | null;
      rolled_back_at: Date | null;
      applied_steps_count: number;
    }>
  >(`
    SELECT id, migration_name, started_at, finished_at, logs, rolled_back_at, applied_steps_count
    FROM _prisma_migrations
    ORDER BY started_at ASC NULLS LAST
  `);

  console.log(`_prisma_migrations row count: ${rows.length}\n`);

  const pending = rows.filter((r) => !r.finished_at && !r.rolled_back_at);
  const failed = rows.filter((r) => r.logs && !r.finished_at);

  console.log(`Failed or pending rows: ${pending.length}\n`);
  if (pending.length) {
    console.table(
      pending.map((r) => ({
        migration: r.migration_name,
        started_at: r.started_at,
        finished_at: r.finished_at,
        rolled_back_at: r.rolled_back_at,
        applied_steps: r.applied_steps_count,
        has_logs: !!r.logs,
      }))
    );
  }

  if (failed.length && failed[0]?.logs) {
    console.log('\nFailed migration log preview (first 500 chars):');
    console.log(failed[0].logs.slice(0, 500));
  }

  console.log('\nAll recorded migrations:');
  console.table(
    rows.map((r) => ({
      migration: r.migration_name,
      finished: r.finished_at ? 'OK' : r.rolled_back_at ? 'ROLLED_BACK' : 'PENDING/FAILED',
    }))
  );
}

main()
  .catch((err) => {
    console.error(err);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
