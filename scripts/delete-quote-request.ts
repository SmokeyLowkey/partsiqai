import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function deleteQuoteRequest(quoteNumber: string) {
  try {
    console.log(`🔍 Looking for quote request: ${quoteNumber}...`);

    const quoteRequest = await prisma.quoteRequest.findFirst({
      where: { quoteNumber },
      include: {
        items: {
          include: {
            supplierQuotes: true,
          },
        },
        emailThreads: true,
        emailThread: true,
        editedEmails: true,
      },
    });

    if (!quoteRequest) {
      console.log(`❌ Quote request ${quoteNumber} not found`);
      return;
    }

    console.log(`📋 Found quote request: ${quoteRequest.id}`);
    console.log(`   - Items: ${quoteRequest.items.length}`);
    console.log(`   - Supplier quotes: ${quoteRequest.items.reduce((sum, item) => sum + item.supplierQuotes.length, 0)}`);
    console.log(`   - Email threads (QuoteRequestEmailThread): ${quoteRequest.emailThreads.length}`);
    console.log(`   - Email threads (direct): ${quoteRequest.emailThread.length}`);
    console.log(`   - Edited emails: ${quoteRequest.editedEmails.length}`);

    console.log(`\n🗑️  Deleting quote request ${quoteNumber}...`);
    console.log('   This will cascade delete:');
    console.log('   - QuoteRequestItem records');
    console.log('   - SupplierQuoteItem records');
    console.log('   - QuoteRequestEmailThread records');
    console.log('   - EditedEmail records');
    console.log('   - EmailThread records (if they reference this quote)');

    await prisma.quoteRequest.delete({
      where: { id: quoteRequest.id },
    });

    console.log(`\n✅ Successfully deleted quote request ${quoteNumber} and all related data`);
  } catch (error) {
    console.error('❌ Error deleting quote request:', error);
    throw error;
  } finally {
    await prisma.$disconnect();
  }
}

// Get quote number from command line arguments
const quoteNumber = process.argv[2];

if (!quoteNumber) {
  console.error('Usage: npx tsx scripts/delete-quote-request.ts <quoteNumber>');
  console.error('Example: npx tsx scripts/delete-quote-request.ts QR-01-2026-0001');
  process.exit(1);
}

deleteQuoteRequest(quoteNumber);
