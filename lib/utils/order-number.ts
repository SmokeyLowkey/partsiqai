import { prisma } from '@/lib/prisma';
import { Prisma } from '@prisma/client';

/**
 * Generates a unique order number within a transaction.
 * Uses Prisma's type-safe count method instead of raw queries.
 */
export async function generateOrderNumber(
  organizationId: string,
  tx?: Prisma.TransactionClient
): Promise<string> {
  const db = tx || prisma;

  // Count existing orders for this organization using Prisma's type-safe method
  // The transaction isolation level ensures consistency
  const count = await db.order.count({
    where: {
      organizationId: organizationId,
    },
  });

  const orderNumber = `ORD-${new Date().getFullYear()}-${String(count + 1).padStart(4, '0')}`;
  return orderNumber;
}
