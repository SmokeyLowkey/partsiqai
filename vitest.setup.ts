/**
 * Vitest Setup File
 * 
 * This file runs before all tests to perform safety checks and setup.
 */

// Safety check: Prevent running tests against production database
const databaseUrl = process.env.DATABASE_URL || process.env.POSTGRES_PRISMA_URL || '';

if (databaseUrl && !databaseUrl.includes('test') && !databaseUrl.includes('localhost')) {
  console.error('\n❌ SAFETY CHECK FAILED ❌\n');
  console.error('Tests are attempting to run against a non-test database!');
  console.error('Database URL:', databaseUrl.replace(/:[^:@]+@/, ':****@')); // Hide password
  console.error('\nTo run tests safely:');
  console.error('  1. Use a dedicated test database');
  console.error('  2. Set DATABASE_URL to point to a test database (e.g., partsiq_test)');
  console.error('  3. Ensure the database URL contains "test" or "localhost"\n');
  
  // Allow override with explicit flag (use with caution!)
  if (!process.env.ALLOW_NON_TEST_DATABASE) {
    process.exit(1);
  } else {
    console.warn('⚠️  WARNING: Running tests against non-test database (ALLOW_NON_TEST_DATABASE=true)\n');
  }
}

// Log test database info
if (databaseUrl) {
  const maskedUrl = databaseUrl.replace(/:[^:@]+@/, ':****@');
  console.log(`✓ Running tests against database: ${maskedUrl}\n`);
}
