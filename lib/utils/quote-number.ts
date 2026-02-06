import { prisma } from '@/lib/prisma';
import { Prisma } from '@prisma/client';

/**
 * Generates a unique quote number using Prisma's type-safe queries.
 * Uses a serializable transaction when called within one to prevent
 * duplicate numbers from concurrent requests.
 */
export async function generateQuoteNumber(
  organizationId: string,
  tx?: Prisma.TransactionClient
): Promise<string> {
  const db = tx || prisma;
  const now = new Date();
  const month = String(now.getMonth() + 1).padStart(2, '0');
  const year = now.getFullYear();
  const startOfMonth = new Date(year, now.getMonth(), 1);
  const startOfNextMonth = new Date(year, now.getMonth() + 1, 1);

  // Use Prisma's type-safe count query instead of raw SQL
  const count = await db.quoteRequest.count({
    where: {
      organizationId,
      createdAt: {
        gte: startOfMonth,
        lt: startOfNextMonth,
      },
    },
  });

  const sequence = String(count + 1).padStart(4, '0');
  return `QR-${month}-${year}-${sequence}`;
}
