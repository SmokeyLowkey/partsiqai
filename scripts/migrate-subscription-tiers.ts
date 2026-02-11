import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  console.log('Migrating subscription tiers...');
  
  // Update BASIC to STARTER (raw query since BASIC doesn't exist in current schema)
  await prisma.$executeRaw`
    UPDATE "organizations" 
    SET "subscriptionTier" = 'STARTER'
    WHERE "subscriptionTier" = 'BASIC'
  `;
  
  // Update PROFESSIONAL to GROWTH
  await prisma.$executeRaw`
    UPDATE "organizations" 
    SET "subscriptionTier" = 'GROWTH'
    WHERE "subscriptionTier" = 'PROFESSIONAL'
  `;
  
  console.log('✅ Subscription tiers migrated successfully!');
}

main()
  .catch((e) => {
    console.error('❌ Error:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
