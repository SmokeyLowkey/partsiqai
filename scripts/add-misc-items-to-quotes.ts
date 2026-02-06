// Script to add MISC-COSTS items to existing quote requests
// Run with: npx tsx scripts/add-misc-items-to-quotes.ts

require('dotenv').config({ path: require('path').resolve(__dirname, '../.env') });

import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function addMiscItemsToQuotes() {
  console.log('Starting migration: Adding MISC-COSTS items to existing quote requests...\n');

  try {
    // Get all quote requests
    const quoteRequests = await prisma.quoteRequest.findMany({
      include: {
        items: true,
      },
    });

    console.log(`Found ${quoteRequests.length} quote requests to process\n`);

    let added = 0;
    let skipped = 0;

    for (const quoteRequest of quoteRequests) {
      // Check if MISC-COSTS item already exists
      const hasMiscItem = quoteRequest.items.some(
        (item) => item.partNumber === 'MISC-COSTS'
      );

      if (hasMiscItem) {
        console.log(`✓ ${quoteRequest.quoteNumber}: Already has MISC-COSTS item (skipping)`);
        skipped++;
      } else {
        // Add MISC-COSTS item
        await prisma.quoteRequestItem.create({
          data: {
            quoteRequestId: quoteRequest.id,
            partNumber: 'MISC-COSTS',
            description: 'Additional Costs & Fees',
            quantity: 1,
            unitPrice: 0,
            totalPrice: 0,
            notes: 'Miscellaneous costs such as shipping, freight, handling fees, etc.',
          },
        });

        console.log(`✓ ${quoteRequest.quoteNumber}: Added MISC-COSTS item`);
        added++;
      }
    }

    console.log('\n' + '='.repeat(60));
    console.log('Migration completed successfully!');
    console.log('='.repeat(60));
    console.log(`Total quote requests: ${quoteRequests.length}`);
    console.log(`MISC items added: ${added}`);
    console.log(`Already had MISC items: ${skipped}`);
    console.log('='.repeat(60));
  } catch (error) {
    console.error('\n❌ Migration failed:', error);
    throw error;
  } finally {
    await prisma.$disconnect();
  }
}

// Run the migration
addMiscItemsToQuotes()
  .then(() => {
    console.log('\n✅ Migration script completed');
    process.exit(0);
  })
  .catch((error) => {
    console.error('\n❌ Migration script failed:', error);
    process.exit(1);
  });
