// Script to backfill order items for existing orders that were created from quote requests
// Run with: npx tsx scripts/backfill-order-items.ts

require('dotenv').config({ path: require('path').resolve(__dirname, '../.env') });

import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function backfillOrderItems() {
  try {
    console.log('Starting order items backfill...\n');

    // Find all orders that have a quote reference but no order items
    const ordersWithoutItems = await prisma.order.findMany({
      where: {
        quoteReference: { not: null },
        orderItems: {
          none: {},
        },
      },
      include: {
        orderItems: true,
        supplier: true,
      },
    });

    console.log(`Found ${ordersWithoutItems.length} orders without items\n`);

    if (ordersWithoutItems.length === 0) {
      console.log('✅ All orders already have items!');
      return;
    }

    let successCount = 0;
    let errorCount = 0;

    for (const order of ordersWithoutItems) {
      try {
        console.log(`\nProcessing Order: ${order.orderNumber}`);
        console.log(`  - Supplier: ${order.supplier.name}`);
        console.log(`  - Quote Reference: ${order.quoteReference}`);

        // Get the quote request items with supplier quotes
        const quoteRequest = await prisma.quoteRequest.findUnique({
          where: { id: order.quoteReference! },
          include: {
            items: {
              include: {
                supplierQuotes: {
                  where: {
                    supplierId: order.supplierId,
                  },
                },
              },
            },
          },
        });

        if (!quoteRequest) {
          console.log(`  ❌ Quote request not found`);
          errorCount++;
          continue;
        }

        // Get items that have supplier quotes (partId can be null for MISC items)
        const itemsWithQuotes = quoteRequest.items.filter(
          item => item.supplierQuotes.length > 0
        );

        console.log(`  - Found ${itemsWithQuotes.length} items with supplier quotes`);
        
        // Debug: show all items and their quotes
        console.log(`  - Total quote request items: ${quoteRequest.items.length}`);
        quoteRequest.items.forEach(item => {
          console.log(`    • ${item.partNumber}: ${item.supplierQuotes.length} quotes from this supplier, partId: ${item.partId}`);
        });

        if (itemsWithQuotes.length === 0) {
          console.log(`  ⚠️  No items with supplier quotes found`);
          errorCount++;
          continue;
        }

        // Create order items
        const orderItemsData = itemsWithQuotes.map(item => {
          const quote = item.supplierQuotes[0];
          return {
            order: {
              connect: { id: order.id }
            },
            partNumber: item.partNumber,
            ...(item.partId && { 
              part: {
                connect: { id: item.partId }
              }
            }), // Only include part if partId exists
            quantity: item.quantity,
            unitPrice: quote.unitPrice,
            totalPrice: quote.totalPrice,
            availability: quote.availability,
            supplierNotes: quote.notes,
            quantityReceived: 0,
            isReceived: false,
          };
        });

        // Create all order items in a transaction
        await prisma.$transaction(
          orderItemsData.map(data => prisma.orderItem.create({ data }))
        );

        console.log(`  ✅ Created ${orderItemsData.length} order items`);
        successCount++;
      } catch (error: any) {
        console.log(`  ❌ Error: ${error.message}`);
        errorCount++;
      }
    }

    console.log('\n' + '='.repeat(60));
    console.log('Backfill Summary:');
    console.log(`  ✅ Success: ${successCount} orders`);
    console.log(`  ❌ Errors: ${errorCount} orders`);
    console.log('='.repeat(60));
  } catch (error) {
    console.error('Fatal error:', error);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

backfillOrderItems()
  .then(() => {
    console.log('\n✅ Backfill complete!');
    process.exit(0);
  })
  .catch((error) => {
    console.error('Backfill failed:', error);
    process.exit(1);
  });
