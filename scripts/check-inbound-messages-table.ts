/** READ-ONLY: describe the existing `inbound_messages` table on the target DB. */
import { prisma } from '../lib/prisma';

async function main() {
  const dbUrl = (process.env.DATABASE_URL || '').replace(/:[^:@]+@/, ':****@');
  console.log(`\nConnected to: ${dbUrl}\n`);

  const cols = await prisma.$queryRawUnsafe<
    Array<{ column_name: string; data_type: string; is_nullable: string; column_default: string | null }>
  >(`
    SELECT column_name, data_type, is_nullable, column_default
    FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'inbound_messages'
    ORDER BY ordinal_position
  `);
  console.log(`Columns (${cols.length}):`);
  console.table(cols);

  const idxs = await prisma.$queryRawUnsafe<Array<{ indexname: string; indexdef: string }>>(`
    SELECT indexname, indexdef FROM pg_indexes WHERE schemaname = 'public' AND tablename = 'inbound_messages'
  `);
  console.log(`\nIndexes (${idxs.length}):`);
  console.table(idxs);

  const fks = await prisma.$queryRawUnsafe<Array<{ constraint_name: string; column: string; foreign_table: string; foreign_column: string }>>(`
    SELECT
      tc.constraint_name,
      kcu.column_name AS column,
      ccu.table_name AS foreign_table,
      ccu.column_name AS foreign_column
    FROM information_schema.table_constraints tc
    JOIN information_schema.key_column_usage kcu ON kcu.constraint_name = tc.constraint_name
    JOIN information_schema.constraint_column_usage ccu ON ccu.constraint_name = tc.constraint_name
    WHERE tc.table_name = 'inbound_messages' AND tc.constraint_type = 'FOREIGN KEY'
  `);
  console.log(`\nForeign keys (${fks.length}):`);
  console.table(fks);
}

main()
  .catch((e) => { console.error(e); process.exit(1); })
  .finally(async () => { await prisma.$disconnect(); });
