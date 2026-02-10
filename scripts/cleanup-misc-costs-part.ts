import { prisma } from '@/lib/prisma';

/**
 * Remove MISC-COSTS from Parts table and fix analytics calculation
 */

async function main() {
  console.log('🧹 Cleaning up MISC-COSTS from Parts table...\n');

  // Find all MISC-COSTS parts
  const miscParts = await prisma.part.findMany({
    where: {
      partNumber: {
        startsWith: 'MISC-',
      },
    },
  });

  console.log(`Found ${miscParts.length} MISC-COSTS part(s)`);

  for (const part of miscParts) {
    console.log(`\n  Part: ${part.partNumber}`);
    console.log(`  ID: ${part.id}`);
    
    // Unlink order items from this part
    const orderItems = await prisma.orderItem.findMany({
      where: { partId: part.id },
      include: { order: { select: { orderNumber: true } } },
    });

    console.log(`  Linked to ${orderItems.length} order item(s)`);

    for (const item of orderItems) {
      await prisma.orderItem.update({
        where: { id: item.id },
        data: { partId: null },
      });
      console.log(`    ✅ Unlinked from order ${item.order.orderNumber}`);
    }

    // Delete the part
    await prisma.part.delete({
      where: { id: part.id },
    });
    console.log(`  ✅ Deleted part ${part.partNumber}`);
  }

  console.log('\n✅ Cleanup complete!');
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
