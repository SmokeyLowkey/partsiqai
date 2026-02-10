import { prisma } from '@/lib/prisma';
import { Decimal } from '@prisma/client/runtime/library';

/**
 * Diagnostic script to check and fix analytics/cost savings issues
 * 
 * This script will:
 * 1. Check if parts have prices set
 * 2. Show order items and their associated part prices
 * 3. Recalculate cost savings for an order
 * 4. Update analytics if needed
 */

async function main() {
  const orderId = process.argv[2];

  if (!orderId) {
    console.log('Usage: npx tsx scripts/diagnose-and-fix-analytics.ts <orderId>');
    console.log('\nOr run without arguments to check all recent completed orders:');
    
    // Find recent completed orders with analytics
    const recentOrders = await prisma.order.findMany({
      where: {
        status: 'DELIVERED',
        orderAnalytics: {
          isNot: null,
        },
      },
      take: 10,
      orderBy: { completedAt: 'desc' },
      include: {
        orderAnalytics: true,
        organization: { select: { name: true } },
      },
    });

    console.log('\n📊 Recent completed orders with analytics:');
    console.log('='.repeat(80));
    
    for (const order of recentOrders) {
      const analytics = order.orderAnalytics!;
      console.log(`\nOrder: ${order.orderNumber || order.id}`);
      console.log(`Organization: ${order.organization.name}`);
      console.log(`Platform Cost: $${Number(analytics.platformCost).toFixed(2)}`);
      console.log(`Manual/List Cost: $${Number(analytics.manualCost).toFixed(2)}`);
      console.log(`Savings: $${Number(analytics.actualSavings).toFixed(2)} (${Number(analytics.savingsPercent).toFixed(1)}%)`);
      
      if (Number(analytics.manualCost) === 0) {
        console.log('⚠️  WARNING: Manual cost is $0 - parts may be missing prices!');
        console.log(`   Run: npx tsx scripts/diagnose-and-fix-analytics.ts ${order.id}`);
      }
    }
    
    return;
  }

  console.log(`\n🔍 Diagnosing order: ${orderId}`);
  console.log('='.repeat(80));

  // Fetch order with all data
  const order = await prisma.order.findUnique({
    where: { id: orderId },
    include: {
      orderItems: {
        include: {
          part: {
            select: {
              id: true,
              partNumber: true,
              description: true,
              price: true,
              cost: true,
            },
          },
        },
      },
      orderAnalytics: true,
      supplier: { select: { name: true } },
      organization: { select: { name: true } },
    },
  });

  if (!order) {
    console.error('❌ Order not found!');
    return;
  }

  console.log(`\n📦 Order Details:`);
  console.log(`Order Number: ${order.orderNumber || 'N/A'}`);
  console.log(`Organization: ${order.organization.name}`);
  console.log(`Supplier: ${order.supplier?.name || 'N/A'}`);
  console.log(`Status: ${order.status}`);
  console.log(`Total Amount: $${Number(order.total).toFixed(2)}`);

  console.log(`\n📋 Order Items:`);
  console.log('-'.repeat(120));
  console.log('Part Number'.padEnd(20) + 'Qty'.padEnd(10) + 'Unit Price'.padEnd(15) + 'Total Price'.padEnd(15) + 'List Price'.padEnd(15) + 'Savings/Item');
  console.log('-'.repeat(120));

  let manualCostTotal = 0;
  let platformCostTotal = 0;
  let itemsWithoutPrice = 0;

  for (const item of order.orderItems) {
    const unitPrice = Number(item.unitPrice);
    const totalPrice = Number(item.totalPrice);
    const listPrice = item.part ? Number(item.part.price) : 0;
    const costPrice = item.part ? (item.part.cost ? Number(item.part.cost) : 0) : 0;
    
    // Skip MISC-* items (operational costs like shipping, taxes)
    const isMiscItem = item.partNumber.startsWith('MISC-');
    
    // Use the same logic as cost-savings.ts
    const effectiveListPrice = listPrice > 0 ? listPrice : costPrice;
    
    if (effectiveListPrice > 0 && !isMiscItem) {
      const itemManualCost = effectiveListPrice * item.quantity;
      manualCostTotal += itemManualCost;
      platformCostTotal += totalPrice;
      
      const itemSavings = itemManualCost - totalPrice;
      const savingsPercent = itemManualCost > 0 ? (itemSavings / itemManualCost) * 100 : 0;
      
      console.log(
        `${item.partNumber.padEnd(20)} ${String(item.quantity).padEnd(10)} $${unitPrice.toFixed(2).padEnd(11)} $${totalPrice.toFixed(2).padEnd(14)} $${effectiveListPrice.toFixed(2).padEnd(14)} $${itemSavings.toFixed(2)} (${savingsPercent.toFixed(1)}%)`
      );
    } else if (isMiscItem) {
      // MISC items are operational costs, not parts
      console.log(
        `${item.partNumber.padEnd(20)} ${String(item.quantity).padEnd(10)} $${unitPrice.toFixed(2).padEnd(11)} $${totalPrice.toFixed(2).padEnd(14)} [MISC - excluded] -`
      );
    } else {
      itemsWithoutPrice++;
      console.log(
        `${item.partNumber.padEnd(20)} ${String(item.quantity).padEnd(10)} $${unitPrice.toFixed(2).padEnd(11)} $${totalPrice.toFixed(2).padEnd(14)} ⚠️ NO PRICE      -`
      );
      
      if (item.part) {
        console.log(`   Part ID: ${item.part.id} - "${item.part.description || 'No description'}"`);
      } else {
        console.log(`   ⚠️  Part not linked to order item!`);
      }
    }
  }

  console.log('-'.repeat(120));
  console.log(`TOTALS: ${order.orderItems.length} items`);
  console.log(`Platform Cost (Paid): $${platformCostTotal.toFixed(2)}`);
  console.log(`Manual/List Cost: $${manualCostTotal.toFixed(2)}`);
  
  if (manualCostTotal > 0) {
    const totalSavings = manualCostTotal - platformCostTotal;
    const savingsPercent = (totalSavings / manualCostTotal) * 100;
    console.log(`Total Savings: $${totalSavings.toFixed(2)} (${savingsPercent.toFixed(1)}%)`);
  } else {
    console.log(`Total Savings: Cannot calculate - no list prices available`);
  }

  if (itemsWithoutPrice > 0) {
    console.log(`\n⚠️  ${itemsWithoutPrice} item(s) missing list prices in Parts table!`);
  }

  // Check current analytics
  if (order.orderAnalytics) {
    const analytics = order.orderAnalytics;
    console.log(`\n📊 Current Analytics Record:`);
    console.log(`Manual Cost: $${Number(analytics.manualCost).toFixed(2)}`);
    console.log(`Platform Cost: $${Number(analytics.platformCost).toFixed(2)}`);
    console.log(`Actual Savings: $${Number(analytics.actualSavings).toFixed(2)}`);
    console.log(`Savings Percent: ${Number(analytics.savingsPercent).toFixed(1)}%`);
    
    // Compare with calculated values
    const manualCostDiff = Math.abs(Number(analytics.manualCost) - manualCostTotal);
    const platformCostDiff = Math.abs(Number(analytics.platformCost) - platformCostTotal);
    
    if (manualCostDiff > 0.01 || platformCostDiff > 0.01) {
      console.log(`\n⚠️  Analytics mismatch detected!`);
      console.log(`   Stored manual cost: $${Number(analytics.manualCost).toFixed(2)} vs Calculated: $${manualCostTotal.toFixed(2)}`);
      console.log(`   Stored platform cost: $${Number(analytics.platformCost).toFixed(2)} vs Calculated: $${platformCostTotal.toFixed(2)}`);
      
      // Offer to fix
      if (manualCostTotal > 0) {
        const totalSavings = manualCostTotal - platformCostTotal;
        const savingsPercent = (totalSavings / manualCostTotal) * 100;
        
        console.log(`\n🔧 Fixing analytics...`);
        
        await prisma.orderAnalytics.update({
          where: { id: analytics.id },
          data: {
            manualCost: new Decimal(manualCostTotal),
            platformCost: new Decimal(platformCostTotal),
            actualSavings: new Decimal(totalSavings),
            savingsPercent: new Decimal(savingsPercent),
          },
        });
        
        console.log(`✅ Analytics updated successfully!`);
        console.log(`   New Manual Cost: $${manualCostTotal.toFixed(2)}`);
        console.log(`   New Platform Cost: $${platformCostTotal.toFixed(2)}`);
        console.log(`   New Savings: $${totalSavings.toFixed(2)} (${savingsPercent.toFixed(1)}%)`);
      }
    } else {
      console.log(`\n✅ Analytics match calculated values - all good!`);
    }
  } else {
    console.log(`\n⚠️  No analytics record found for this order`);
  }

  console.log(`\n${'='.repeat(80)}`);
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
