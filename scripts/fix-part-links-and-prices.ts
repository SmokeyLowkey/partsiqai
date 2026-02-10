import { prisma } from '@/lib/prisma';
import { Decimal } from '@prisma/client/runtime/library';

/**
 * Script to link order items to parts and set manufacturer list prices
 * 
 * This will:
 * 1. Find order items without part links
 * 2. Search for matching parts by part number and organization
 * 3. Create parts if they don't exist
 * 4. Link order items to parts
 * 5. Set appropriate list prices (typically 20-30% above supplier cost as a baseline)
 * 6. Recalculate analytics
 */

interface PartPriceInput {
  partNumber: string;
  listPrice: number; // Manufacturer/dealer list price
  supplierCost: number; // What was actually paid
}

async function main() {
  const orderId = process.argv[2];

  if (!orderId) {
    console.log('Usage: npx tsx scripts/fix-part-links-and-prices.ts <orderId>');
    console.log('\nExample with manual prices (optional):');
    console.log('  Set prices in the script or pass them as JSON');
    return;
  }

  console.log(`\n🔧 Fixing part links and prices for order: ${orderId}`);
  console.log('='.repeat(80));

  // Fetch order with items
  const order = await prisma.order.findUnique({
    where: { id: orderId },
    include: {
      orderItems: {
        include: {
          part: true,
        },
      },
      organization: true,
    },
  });

  if (!order) {
    console.error('❌ Order not found!');
    return;
  }

  console.log(`Order: ${order.orderNumber}`);
  console.log(`Organization: ${order.organization.name}`);
  console.log(`Items: ${order.orderItems.length}`);

  // Manual price mapping for this specific order (you can adjust these)
  // Typically dealer/manufacturer list prices are 20-40% higher than wholesale
  const priceOverrides: Record<string, number> = {
    'KV16429': 120.00,  // Example: $80 supplier cost, $120 list price (33% markup)
    'AT171854': 65.00,  // Example: $45 supplier cost, $65 list price (44% markup)
    'MISC-COSTS': 13.75, // Misc items usually match cost
  };

  let itemsFixed = 0;
  let itemsLinked = 0;
  let partsCreated = 0;

  for (const item of order.orderItems) {
    console.log(`\n📦 Processing: ${item.partNumber}`);
    
    if (item.part) {
      console.log(`   ✅ Already linked to part ${item.part.id}`);
      
      // Check if price needs updating
      const currentPrice = Number(item.part.price);
      const suggestedPrice = priceOverrides[item.partNumber];
      
      if (suggestedPrice && currentPrice !== suggestedPrice) {
        console.log(`   💰 Updating price: $${currentPrice.toFixed(2)} → $${suggestedPrice.toFixed(2)}`);
        await prisma.part.update({
          where: { id: item.part.id },
          data: { price: new Decimal(suggestedPrice) },
        });
        itemsFixed++;
      } else if (currentPrice === 0) {
        // Set default price (30% markup over cost)
        const defaultPrice = Number(item.unitPrice) * 1.30;
        console.log(`   💰 Setting default price: $${defaultPrice.toFixed(2)} (30% markup)`);
        await prisma.part.update({
          where: { id: item.part.id },
          data: { price: new Decimal(defaultPrice) },
        });
        itemsFixed++;
      }
      continue;
    }

    // No part linked - search for existing part
    console.log(`   🔍 Part not linked - searching...`);
    
    let part = await prisma.part.findFirst({
      where: {
        partNumber: item.partNumber,
        organizationId: order.organizationId,
      },
    });

    if (!part) {
      // Skip MISC-* items - they're operational costs, not parts
      if (item.partNumber.startsWith('MISC-')) {
        console.log(`   ⏭️  Skipping MISC item (operational cost, not a part)`);
        continue;
      }

      // Create the part
      const listPrice = priceOverrides[item.partNumber] || Number(item.unitPrice) * 1.30;
      
      console.log(`   ➕ Creating new part with list price: $${listPrice.toFixed(2)}`);
      
      part = await prisma.part.create({
        data: {
          partNumber: item.partNumber,
          description: `Part ${item.partNumber}`,
          organizationId: order.organizationId,
          price: new Decimal(listPrice), // Manufacturer/dealer list price
          cost: new Decimal(item.unitPrice), // Supplier cost
          stockQuantity: 0,
          category: 'Parts',
          isActive: true,
        },
      });
      
      partsCreated++;
      console.log(`   ✅ Created part: ${part.id}`);
    } else {
      console.log(`   ✅ Found existing part: ${part.id}`);
      
      // Update price if needed
      const currentPrice = Number(part.price);
      const suggestedPrice = priceOverrides[item.partNumber];
      
      if (suggestedPrice && currentPrice !== suggestedPrice) {
        console.log(`   💰 Updating price: $${currentPrice.toFixed(2)} → $${suggestedPrice.toFixed(2)}`);
        await prisma.part.update({
          where: { id: part.id },
          data: { price: new Decimal(suggestedPrice) },
        });
      } else if (currentPrice === 0) {
        const defaultPrice = Number(item.unitPrice) * 1.30;
        console.log(`   💰 Setting default price: $${defaultPrice.toFixed(2)}`);
        await prisma.part.update({
          where: { id: part.id },
          data: { price: new Decimal(defaultPrice) },
        });
      }
    }

    // Link the order item to the part
    console.log(`   🔗 Linking order item to part...`);
    await prisma.orderItem.update({
      where: { id: item.id },
      data: { partId: part.id },
    });
    
    itemsLinked++;
    itemsFixed++;
  }

  console.log(`\n${'='.repeat(80)}`);
  console.log(`✅ Summary:`);
  console.log(`   Parts created: ${partsCreated}`);
  console.log(`   Items linked: ${itemsLinked}`);
  console.log(`   Items fixed: ${itemsFixed}`);

  // Now recalculate analytics
  console.log(`\n🔄 Recalculating analytics...`);
  
  const orderWithParts = await prisma.order.findUnique({
    where: { id: orderId },
    include: {
      orderItems: {
        include: {
          part: true,
        },
      },
    },
  });

  if (!orderWithParts) {
    console.error('❌ Could not refetch order');
    return;
  }

  let manualCost = 0;
  let platformCost = 0;

  for (const item of orderWithParts.orderItems) {
    // Skip MISC-* items (operational costs)
    if (item.partNumber.startsWith('MISC-')) {
      continue;
    }

    if (item.part) {
      const listPrice = Number(item.part.price);
      if (listPrice > 0) {
        manualCost += listPrice * item.quantity;
        platformCost += Number(item.totalPrice);
      }
    }
  }

  if (manualCost > 0) {
    const totalSavings = manualCost - platformCost;
    const savingsPercent = (totalSavings / manualCost) * 100;

    console.log(`\n📊 New Analytics:`);
    console.log(`   Manual/List Cost: $${manualCost.toFixed(2)}`);
    console.log(`   Platform Cost: $${platformCost.toFixed(2)}`);
    console.log(`   Savings: $${totalSavings.toFixed(2)} (${savingsPercent.toFixed(1)}%)`);

    // Update analytics
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
      console.log(`   ✅ Analytics updated!`);
    } else {
      console.log(`   ⚠️  No analytics record found - run analytics collection worker`);
    }
  } else {
    console.log(`\n⚠️  Still no list prices available after fixes`);
  }

  console.log(`\n${'='.repeat(80)}`);
  console.log(`🎉 Done! Run the diagnostic script again to verify:`);
  console.log(`   npx tsx scripts/diagnose-and-fix-analytics.ts ${orderId}`);
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
