/**
 * Vitest Setup File
 *
 * Runs before any test file imports. Its job is to prevent integration tests
 * from ever touching a non-test database.
 *
 * Incident 2026-04-19: the previous version read `process.env.DATABASE_URL`
 * before any dotenv call, so the value was empty at check time and the first
 * `if (databaseUrl && ...)` clause short-circuited. Prisma then lazy-loaded
 * .env when the first test imported `prisma`, and integration tests ran
 * against the production Render database, wiping `IntegrationCredential` rows.
 *
 * Fix:
 *   1. Explicitly load .env.test first, then .env, so the check sees the
 *      URL Prisma will use.
 *   2. Strict allowlist: require an explicit `_test` suffix on the DB name,
 *      `localhost`, a `neondb` branch, or explicit `TEST_DB_CONFIRMED=true`.
 *      No loose `includes('test')` matching against the full URL (the old
 *      check could be satisfied by a random 'test' substring in a password).
 *   3. Empty URL fails — never silently skips.
 *   4. `ALLOW_NON_TEST_DATABASE=true` still permits override, but it's now
 *      the only way past the check (not a fallthrough).
 */
import { config as loadEnv } from 'dotenv';
import path from 'path';

// Order matters: files loaded earlier win (dotenv's default is not to override
// already-set keys). Shell env vars beat every file. Files:
//   1. .env.test.local — per-developer secrets (gitignored, see Next.js convention)
//   2. .env.test       — shared test config, if you want to commit one
//   3. .env            — everyday dev config (fallback only — do NOT put prod creds here
//                        without gating the safety check below)
loadEnv({ path: path.resolve(process.cwd(), '.env.test.local') });
loadEnv({ path: path.resolve(process.cwd(), '.env.test') });
loadEnv({ path: path.resolve(process.cwd(), '.env') });

const databaseUrl = process.env.DATABASE_URL || process.env.POSTGRES_PRISMA_URL || '';
const maskedUrl = databaseUrl.replace(/:[^:@]+@/, ':****@');

function fail(message: string): never {
  console.error('\n❌ TEST DATABASE SAFETY CHECK FAILED ❌\n');
  console.error(message);
  console.error(`\nCurrent DATABASE_URL: ${maskedUrl || '(empty)'}`);
  console.error('\nHow to run tests safely:');
  console.error('  • Create a .env.test with a dedicated test database URL, OR');
  console.error('  • Use a DB name ending in _test (e.g. partsiq_test), OR');
  console.error('  • Use localhost, OR');
  console.error('  • Set TEST_DB_CONFIRMED=true if you have verified the DB is disposable.');
  console.error('\nOverride (NOT recommended): ALLOW_NON_TEST_DATABASE=true\n');
  process.exit(1);
}

if (process.env.ALLOW_NON_TEST_DATABASE === 'true') {
  console.warn(`⚠️  ALLOW_NON_TEST_DATABASE=true — skipping safety check. DB: ${maskedUrl}\n`);
} else {
  if (!databaseUrl) {
    fail('DATABASE_URL is empty. Integration tests require a database URL.');
  }

  // Parse the DB name from the end of the URL (after the last `/`, before any `?`).
  const dbName = databaseUrl.split('/').pop()?.split('?')[0]?.toLowerCase() ?? '';
  const hostname = (() => {
    try {
      return new URL(databaseUrl).hostname.toLowerCase();
    } catch {
      return '';
    }
  })();

  const isLocalhost = hostname === 'localhost' || hostname === '127.0.0.1';
  const isTestDbName = dbName.endsWith('_test') || dbName === 'partsiq_test' || dbName === 'test';
  const isConfirmed = process.env.TEST_DB_CONFIRMED === 'true';

  if (!isLocalhost && !isTestDbName && !isConfirmed) {
    fail(
      `DB host "${hostname}" / name "${dbName}" is not recognised as a test target.\n` +
        'Refusing to run integration tests against a possibly-real database.'
    );
  }

  console.log(`✓ Test DB safety check passed. DB: ${maskedUrl}`);
  console.log(
    `  host=${hostname}, db=${dbName}, localhost=${isLocalhost}, testName=${isTestDbName}, confirmed=${isConfirmed}\n`
  );
}
