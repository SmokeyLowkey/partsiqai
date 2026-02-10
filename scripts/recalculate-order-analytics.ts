import { prisma } from '@/lib/prisma';
import { Decimal } from '@prisma/client/runtime/library';

/**
 * Recalculate analytics for an order with correct MISC-COSTS exclusion
 */

async function main() {
  const orderId = process.argv[2];

  if (!orderId) {
    console.log('Usage: npx tsx scripts/recalculate-order-analytics.ts <orderId>');
    return;
  }

  const order = await prisma.order.findUnique({
    where: { id: orderId },
    include: {
      orderItems: {
        include: {
          part: true,
        },
      },
    },
  });

  if (!order) {
    console.error('❌ Order not found!');
    return;
  }

  console.log(`\n🔄 Recalculating analytics for order: ${order.orderNumber}\n`);

  let manualCost = 0;
  let platformCost = 0;
  let itemsIncluded = 0;
  let miscItemsExcluded = 0;

  for (const item of order.orderItems) {
    // Skip MISC-* items (operational costs)
    if (item.partNumber.startsWith('MISC-')) {
      console.log(`  ⏭️  ${item.partNumber}: $${Number(item.totalPrice).toFixed(2)} (excluded - operational cost)`);
      miscItemsExcluded++;
      continue;
    }

    if (item.part) {
      const listPrice = Number(item.part.price);
      if (listPrice > 0) {
        const itemManualCost = listPrice * item.quantity;
        const itemPlatformCost = Number(item.totalPrice);
        manualCost += itemManualCost;
        platformCost += itemPlatformCost;
        itemsIncluded++;
        
        const savings = itemManualCost - itemPlatformCost;
        console.log(`  ✅ ${item.partNumber}: List $${listPrice.toFixed(2)} × ${item.quantity} = $${itemManualCost.toFixed(2)} | Paid $${itemPlatformCost.toFixed(2)} | Saved $${savings.toFixed(2)}`);
      }
    }
  }

  console.log(`\n📊 Calculation:`);
  console.log(`  Items included in savings: ${itemsIncluded}`);
  console.log(`  MISC items excluded: ${miscItemsExcluded}`);
  console.log(`  Manual/List Cost: $${manualCost.toFixed(2)}`);
  console.log(`  Platform Cost: $${platformCost.toFixed(2)}`);

  if (manualCost > 0) {
    const totalSavings = manualCost - platformCost;
    const savingsPercent = (totalSavings / manualCost) * 100;

    console.log(`  Total Savings: $${totalSavings.toFixed(2)} (${savingsPercent.toFixed(1)}%)\n`);

    const analytics = await prisma.orderAnalytics.findUnique({
      where: { orderId: orderId },
    });

    if (analytics) {
      await prisma.orderAnalytics.update({
        where: { id: analytics.id },
        data: {
          manualCost: new Decimal(manualCost),
          platformCost: new Decimal(platformCost),
          actualSavings: new Decimal(totalSavings),
          savingsPercent: new Decimal(savingsPercent),
        },
      });
      console.log('✅ Analytics updated successfully!\n');
    } else {
      console.log('⚠️  No analytics record found\n');
    }
  } else {
    console.log('  ⚠️  No list prices available\n');
  }
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
