import { PrismaClient, MessageRole, MessageType, PickListStatus, ConversationContext } from '@prisma/client';

const prisma = new PrismaClient();

async function seedAIChatConversation() {
  console.log('Starting AI Chat Conversation seed...');

  // Get a user from the database
  const user = await prisma.user.findFirst({
    where: {
      organizationId: { not: '' },
    },
    select: {
      id: true,
      organizationId: true,
      name: true,
    },
  });

  if (!user || !user.organizationId) {
    console.error('No user with organization found. Please run main seed first.');
    return;
  }

  console.log(`Using user: ${user.name} (${user.id})`);

  // Get or create a vehicle for context
  const vehicle = await prisma.vehicle.findFirst({
    where: { organizationId: user.organizationId },
    select: { id: true, make: true, model: true, year: true },
  });

  const vehicleContext = vehicle ? {
    vehicleId: vehicle.id,
    make: vehicle.make,
    model: vehicle.model,
    year: vehicle.year,
  } : undefined;

  console.log(`Vehicle context:`, vehicleContext || 'No vehicle found');

  // Create a new conversation
  const conversation = await prisma.chatConversation.create({
    data: {
      userId: user.id,
      title: 'Fleet Maintenance Order - Winter Prep',
      context: ConversationContext.PARTS_SEARCH,
      organizationId: user.organizationId,
      vehicleId: vehicleContext?.vehicleId,
      lastMessageAt: new Date(),
    },
  });

  console.log(`Created conversation: ${conversation.id}`);

  // Create realistic conversation messages
  const messages = [
    {
      role: MessageRole.ASSISTANT,
      content: `Hello! I'm your AI Parts Assistant. ${vehicleContext ? `I see you're working on your ${vehicleContext.year} ${vehicleContext.make} ${vehicleContext.model}.` : 'I can help you find parts for your fleet.'} How can I help you today?`,
      messageType: MessageType.TEXT,
      conversationId: conversation.id,
    },
    {
      role: MessageRole.USER,
      content: "I need to prep our fleet for winter. Can you help me find the right oil filters and air filters?",
      messageType: MessageType.TEXT,
      conversationId: conversation.id,
    },
    {
      role: MessageRole.ASSISTANT,
      content: "Absolutely! Let me search for winter-ready filters for your fleet. One moment...",
      messageType: MessageType.TEXT,
      conversationId: conversation.id,
    },
    {
      role: MessageRole.ASSISTANT,
      content: `Great news! I found several winter-grade filters perfect for your fleet:\n\n**Oil Filters:**\n• **Part Number:** WIX-51515\n• **Description:** Premium Oil Filter - Extended Life\n• **Price:** $12.99\n• **Stock:** 45 units available\n• **Rating:** 4.8/5 ⭐\n• **Cold Weather Performance:** Excellent down to -40°F\n\n**Air Filters:**\n• **Part Number:** K&N-33-2129\n• **Description:** High-Flow Air Filter\n• **Price:** $64.99\n• **Stock:** 28 units available\n• **Rating:** 4.9/5 ⭐\n• **Features:** Washable, reusable, improved cold-start performance\n\nWould you like to add these to your pick list? I can also check for bulk discounts.`,
      messageType: MessageType.PART_RECOMMENDATION,
      conversationId: conversation.id,
      context: {
        partNumbers: ["WIX-51515", "K&N-33-2129"],
        recommendations: true,
      },
    },
    {
      role: MessageRole.USER,
      content: "Yes, add those to my list. I also need cabin air filters and wiper blades for 5 trucks",
      messageType: MessageType.TEXT,
      conversationId: conversation.id,
    },
    {
      role: MessageRole.ASSISTANT,
      content: "Perfect! I'll add those oil and air filters to your pick list. Now let me find cabin filters and wiper blades...",
      messageType: MessageType.TEXT,
      conversationId: conversation.id,
    },
    {
      role: MessageRole.ASSISTANT,
      content: `Excellent! Here are the cabin air filters and wiper blades:\n\n**Cabin Air Filters:**\n• **Part Number:** FRAM-CF10285\n• **Description:** Fresh Breeze Cabin Air Filter with ARM & HAMMER\n• **Price:** $18.49\n• **Stock:** 52 units available\n• **Features:** Eliminates odors, filters 98% of dust and allergens\n\n**Wiper Blades (Set of 2):**\n• **Part Number:** BOSCH-ICON-24OE\n• **Description:** All-Season Beam Wiper Blades - 24"\n• **Price:** $29.99 per set\n• **Stock:** 38 sets available\n• **Winter Performance:** Excellent in ice/snow conditions\n• **Fits:** Most heavy-duty trucks and vans\n\n**Bulk Order Recommendation:** For 5 trucks, you'll need:\n- 5 cabin air filters = $92.45\n- 5 wiper blade sets = $149.95\n\n💡 **Tip:** Orders over $200 get free shipping! You're at $319.88 before adding the first two items.\n\nShall I add these to your pick list as well?`,
      messageType: MessageType.PART_RECOMMENDATION,
      conversationId: conversation.id,
      context: {
        partNumbers: ["FRAM-CF10285", "BOSCH-ICON-24OE"],
        recommendations: true,
        bulkOrder: true,
      },
    },
    {
      role: MessageRole.USER,
      content: "Great! Add them. What about antifreeze and windshield washer fluid?",
      messageType: MessageType.TEXT,
      conversationId: conversation.id,
    },
    {
      role: MessageRole.ASSISTANT,
      content: `Searching for winter fluids... Found premium options:\n\n**Antifreeze/Coolant:**\n• **Part Number:** PEAK-OET-AF-5050\n• **Description:** PEAK OET Extended Life Antifreeze 50/50 Pre-Diluted\n• **Price:** $15.99 per gallon\n• **Stock:** 85 gallons available\n• **Protection:** Down to -34°F\n• **Type:** Universal - compatible with most engines\n\n**Windshield Washer Fluid:**\n• **Part Number:** RAIN-X-DE-ICER-128\n• **Description:** Rain-X De-Icer Windshield Washer Fluid\n• **Price:** $6.99 per gallon\n• **Stock:** 120 gallons available\n• **Temperature Rating:** Works down to -25°F\n• **Bonus:** Rain-X water repellent formula included\n\n**Fleet Recommendation:** For 5 trucks:\n- Antifreeze: 2-3 gallons per truck = 15 gallons = $239.85\n- Washer Fluid: 2 gallons per truck = 10 gallons = $69.90\n\n🎯 **Your Total:** $629.63 (includes all items)\n✅ **Free Shipping activated!**\n\nReady to add these fluids to your pick list?`,
      messageType: MessageType.PART_RECOMMENDATION,
      conversationId: conversation.id,
      context: {
        partNumbers: ["PEAK-OET-AF-5050", "RAIN-X-DE-ICER-128"],
        recommendations: true,
        bulkOrder: true,
        totalCalculation: true,
      },
    },
    {
      role: MessageRole.USER,
      content: "Perfect! Add them all. Can you also recommend battery maintenance items?",
      messageType: MessageType.TEXT,
      conversationId: conversation.id,
    },
    {
      role: MessageRole.ASSISTANT,
      content: `Excellent thinking! Cold weather is tough on batteries. Here are essential battery maintenance items:\n\n**Battery Terminal Cleaner:**\n• **Part Number:** CRC-05023\n• **Description:** CRC Battery Terminal Protector Spray\n• **Price:** $8.49\n• **Stock:** 42 units available\n• **Features:** Prevents corrosion, extends battery life\n\n**Battery Load Tester:**\n• **Part Number:** SCHUMACHER-BT-100\n• **Description:** 100 Amp Digital Battery Tester\n• **Price:** $34.99\n• **Stock:** 18 units available\n• **Features:** Tests 6V and 12V batteries, LED indicator\n\n**Jumper Cables (Heavy Duty):**\n• **Part Number:** ENERGIZER-1-GAUGE-25FT\n• **Description:** 1-Gauge 25ft Jumper Cables\n• **Price:** $49.99 per set\n• **Stock:** 25 sets available\n• **Rating:** 800 Amp capacity, perfect for heavy equipment\n\n**Battery Tender (Maintainer):**\n• **Part Number:** BT-PLUS-021\n• **Description:** Battery Tender Plus 1.25A Battery Charger\n• **Price:** $59.99\n• **Stock:** 15 units available\n• **Features:** Automatic, prevents overcharging, keeps batteries ready\n\n**Fleet Package Suggestion:** \n- Terminal Cleaner x5 = $42.45\n- Load Tester x2 = $69.98\n- Jumper Cables x3 = $149.97\n- Battery Tender x2 = $119.98\n\n**Updated Total with Battery Items:** $1,012.01\n💰 **Volume Discount Applied:** -$51.20 (5% off orders over $1000)\n🎉 **Final Total:** $960.81\n\nShall I add the battery maintenance items to your pick list?`,
      messageType: MessageType.PART_RECOMMENDATION,
      conversationId: conversation.id,
      context: {
        partNumbers: ["CRC-05023", "SCHUMACHER-BT-100", "ENERGIZER-1-GAUGE-25FT", "BT-PLUS-021"],
        recommendations: true,
        bulkOrder: true,
        volumeDiscount: true,
      },
    },
    {
      role: MessageRole.USER,
      content: "Yes! Add the terminal cleaner for all 5 trucks and 2 load testers. Skip the jumper cables and tenders for now.",
      messageType: MessageType.TEXT,
      conversationId: conversation.id,
    },
    {
      role: MessageRole.ASSISTANT,
      content: `Perfect! I've updated your pick list. Here's your **final order summary**:\n\n**Filters:**\n✓ WIX-51515 Oil Filters x5 = $64.95\n✓ K&N-33-2129 Air Filters x5 = $324.95\n✓ FRAM-CF10285 Cabin Filters x5 = $92.45\n✓ BOSCH-ICON-24OE Wiper Blades x5 sets = $149.95\n\n**Fluids:**\n✓ PEAK-OET-AF-5050 Antifreeze x15 gal = $239.85\n✓ RAIN-X-DE-ICER-128 Washer Fluid x10 gal = $69.90\n\n**Battery Maintenance:**\n✓ CRC-05023 Terminal Cleaner x5 = $42.45\n✓ SCHUMACHER-BT-100 Load Tester x2 = $69.98\n\n**Order Total:** $1,054.48\n**Volume Discount (5%):** -$52.72\n**Final Amount:** $1,001.76\n✅ **Free Shipping Included**\n\n📦 **Est. Delivery:** 2-3 business days\n🏢 **Ship to:** Your organization's main location\n\n**Next Steps:**\n1. Review your pick list in the sidebar →\n2. Adjust quantities if needed\n3. Convert to a quote request to get supplier pricing\n4. Or create an order directly if pricing looks good\n\nWould you like to convert this to a quote request, or do you need anything else for winter prep?`,
      messageType: MessageType.ORDER_SUMMARY,
      conversationId: conversation.id,
      context: {
        orderSummary: true,
        pickListReady: true,
        totalAmount: 1001.76,
      },
    },
    {
      role: MessageRole.USER,
      content: "This looks great! Let's convert to a quote request.",
      messageType: MessageType.TEXT,
      conversationId: conversation.id,
    },
    {
      role: MessageRole.ASSISTANT,
      content: `Excellent! I'll prepare your quote request now.\n\n🎯 **Quote Request Created:** #QR-${Date.now().toString().slice(-6)}\n\nI'm reaching out to these suppliers:\n• **Summit Auto Parts** - Oil/Air filters specialist\n• **Fleet Solutions Inc** - Fluids and maintenance items\n• **Battery Pro Supply** - Battery equipment expert\n\nYou'll receive quotes typically within:\n📧 Email responses: 2-4 hours\n📞 Phone call-backs: Same day\n\n**What happens next:**\n1. Suppliers will review your request\n2. You'll get notifications when quotes arrive\n3. Compare pricing in the Quote Requests section\n4. Select the best supplier(s) and convert to an order\n\n📊 **Track Progress:** Go to Quote Requests → [View QR-${Date.now().toString().slice(-6)}]\n\nIs there anything else I can help you with today?`,
      messageType: MessageType.SYSTEM_NOTIFICATION,
      conversationId: conversation.id,
      context: {
        quoteRequestCreated: true,
        suppliersContacted: 3,
      },
    },
  ];

  // Create all messages
  for (const message of messages) {
    await prisma.chatMessage.create({
      data: message,
    });
  }

  console.log(`Created ${messages.length} messages`);

  // Create a pick list for this conversation
  const pickList = await prisma.chatPickList.create({
    data: {
      name: 'Winter Fleet Prep - 5 Trucks',
      status: PickListStatus.ACTIVE,
      conversationId: conversation.id,
    },
  });

  console.log(`Created pick list: ${pickList.id}`);

  // Create pick list items with all parts discussed
  const pickListItems = [
    {
      partNumber: 'WIX-51515',
      description: 'Premium Oil Filter - Extended Life',
      quantity: 5,
      estimatedPrice: 12.99,
      notes: 'Cold weather performance: Excellent down to -40°F',
      pickListId: pickList.id,
      addedFromChat: true,
    },
    {
      partNumber: 'K&N-33-2129',
      description: 'High-Flow Air Filter',
      quantity: 5,
      estimatedPrice: 64.99,
      notes: 'Washable, reusable, improved cold-start performance',
      pickListId: pickList.id,
      addedFromChat: true,
    },
    {
      partNumber: 'FRAM-CF10285',
      description: 'Fresh Breeze Cabin Air Filter with ARM & HAMMER',
      quantity: 5,
      estimatedPrice: 18.49,
      notes: 'Eliminates odors, filters 98% of dust and allergens',
      pickListId: pickList.id,
      addedFromChat: true,
    },
    {
      partNumber: 'BOSCH-ICON-24OE',
      description: 'All-Season Beam Wiper Blades - 24" (Set of 2)',
      quantity: 5,
      estimatedPrice: 29.99,
      notes: 'Excellent in ice/snow conditions',
      pickListId: pickList.id,
      addedFromChat: true,
    },
    {
      partNumber: 'PEAK-OET-AF-5050',
      description: 'PEAK OET Extended Life Antifreeze 50/50 Pre-Diluted',
      quantity: 15,
      estimatedPrice: 15.99,
      notes: 'Universal - Protection down to -34°F',
      pickListId: pickList.id,
      addedFromChat: true,
    },
    {
      partNumber: 'RAIN-X-DE-ICER-128',
      description: 'Rain-X De-Icer Windshield Washer Fluid',
      quantity: 10,
      estimatedPrice: 6.99,
      notes: 'Works down to -25°F, includes Rain-X water repellent',
      pickListId: pickList.id,
      addedFromChat: true,
    },
    {
      partNumber: 'CRC-05023',
      description: 'CRC Battery Terminal Protector Spray',
      quantity: 5,
      estimatedPrice: 8.49,
      notes: 'Prevents corrosion, extends battery life',
      pickListId: pickList.id,
      addedFromChat: true,
    },
    {
      partNumber: 'SCHUMACHER-BT-100',
      description: '100 Amp Digital Battery Tester',
      quantity: 2,
      estimatedPrice: 34.99,
      notes: 'Tests 6V and 12V batteries, LED indicator',
      pickListId: pickList.id,
      addedFromChat: true,
    },
  ];

  for (const item of pickListItems) {
    await prisma.chatPickListItem.create({
      data: item,
    });
  }

  console.log(`Created ${pickListItems.length} pick list items`);

  // Update conversation timestamp
  await prisma.chatConversation.update({
    where: { id: conversation.id },
    data: { lastMessageAt: new Date() },
  });

  console.log('\n✅ AI Chat Conversation seed completed successfully!');
  console.log('\n📋 Summary:');
  console.log(`   Conversation ID: ${conversation.id}`);
  console.log(`   Messages: ${messages.length}`);
  console.log(`   Pick List ID: ${pickList.id}`);
  console.log(`   Pick List Items: ${pickListItems.length}`);
  console.log(`   Total Order Value: $1,001.76`);
  console.log('\n🚀 Go to /customer/ai-chat to view the conversation!');
}

seedAIChatConversation()
  .catch((e) => {
    console.error('Error during seeding:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
