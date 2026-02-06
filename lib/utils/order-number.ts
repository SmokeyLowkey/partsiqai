import { prisma } from '@/lib/prisma';
import { Prisma } from '@prisma/client';

/**
 * Generates a unique order number using a row-level lock
 * to prevent duplicate numbers from concurrent requests.
 */
export async function generateOrderNumber(
  organizationId: string,
  tx?: Prisma.TransactionClient
): Promise<string> {
  const db = tx || prisma;

  // Use FOR UPDATE to lock rows and prevent concurrent reads from getting
  // the same count.
  const result = await db.$queryRaw<[{ count: bigint }]>`
    SELECT COUNT(*) as count FROM "Order"
    WHERE "organizationId" = ${organizationId}
    FOR UPDATE
  `;

  const count = Number(result[0].count);
  const orderNumber = `ORD-${new Date().getFullYear()}-${String(count + 1).padStart(4, '0')}`;
  return orderNumber;
}
