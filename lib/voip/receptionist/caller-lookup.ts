import { prisma } from '@/lib/prisma';

export interface CallerMatch {
  supplier: {
    id: string;
    name: string;
    phone: string | null;
    organizationId: string;
    organizationName: string;
  };
  recentCalls: Array<{
    callId: string;
    quoteRequestId: string | null;
    quoteNumber: string | null;
    quoteTitle: string | null;
    callerUserId: string;
    callerUserName: string | null;
    callerUserPhone: string | null;
    organizationId: string;
    organizationName: string;
    startedAt: Date;
    outcome: string | null;
    parts: string[];
  }>;
}

/**
 * Normalize phone number for matching: digits only, last 10 digits compared.
 * Handles various formats (+1XXX, (XXX) XXX-XXXX, XXX-XXX-XXXX, etc.).
 */
function normalizePhone(phone: string): string {
  return phone.replace(/\D/g, '').slice(-10);
}

/**
 * Find all suppliers matching a caller's phone number across all orgs.
 * Returns suppliers + their recent supplier calls (last 7 days) for context.
 */
export async function lookupCaller(callerPhone: string): Promise<CallerMatch[]> {
  const normalized = normalizePhone(callerPhone);
  if (!normalized) return [];

  const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);

  // Find suppliers across all orgs whose phone (normalized) matches the caller
  const suppliers = await prisma.supplier.findMany({
    where: {
      phone: { not: null },
    },
    select: {
      id: true,
      name: true,
      phone: true,
      organizationId: true,
      organization: { select: { name: true } },
      supplierCalls: {
        where: {
          startedAt: { gte: sevenDaysAgo },
          status: { notIn: ['INITIATED', 'CANCELLED', 'FAILED'] },
        },
        orderBy: { startedAt: 'desc' },
        take: 5,
        select: {
          id: true,
          quoteRequestId: true,
          startedAt: true,
          outcome: true,
          callerId: true,
          caller: { select: { name: true, phone: true } },
          organizationId: true,
          organization: { select: { name: true } },
          quoteRequest: {
            select: {
              quoteNumber: true,
              title: true,
              items: { select: { partNumber: true }, take: 5 },
            },
          },
        },
      },
    },
  });

  const matches: CallerMatch[] = [];
  for (const supplier of suppliers) {
    if (!supplier.phone) continue;
    if (normalizePhone(supplier.phone) !== normalized) continue;
    if (supplier.supplierCalls.length === 0) continue;

    matches.push({
      supplier: {
        id: supplier.id,
        name: supplier.name,
        phone: supplier.phone,
        organizationId: supplier.organizationId,
        organizationName: supplier.organization.name,
      },
      recentCalls: supplier.supplierCalls.map((c) => ({
        callId: c.id,
        quoteRequestId: c.quoteRequestId,
        quoteNumber: c.quoteRequest?.quoteNumber || null,
        quoteTitle: c.quoteRequest?.title || null,
        callerUserId: c.callerId,
        callerUserName: c.caller?.name || null,
        callerUserPhone: c.caller?.phone || null,
        organizationId: c.organizationId,
        organizationName: c.organization.name,
        startedAt: c.startedAt,
        outcome: c.outcome,
        parts: c.quoteRequest?.items.map((i) => i.partNumber) || [],
      })),
    });
  }

  return matches;
}

/**
 * Fuzzy search suppliers by name (used when caller doesn't match by phone).
 * Returns suppliers whose name contains the search term (case-insensitive).
 */
export async function searchSuppliersByName(query: string): Promise<CallerMatch[]> {
  if (!query || query.trim().length < 2) return [];

  const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);

  const suppliers = await prisma.supplier.findMany({
    where: {
      name: { contains: query.trim(), mode: 'insensitive' },
    },
    take: 10,
    select: {
      id: true,
      name: true,
      phone: true,
      organizationId: true,
      organization: { select: { name: true } },
      supplierCalls: {
        where: {
          startedAt: { gte: sevenDaysAgo },
          status: { notIn: ['INITIATED', 'CANCELLED', 'FAILED'] },
        },
        orderBy: { startedAt: 'desc' },
        take: 5,
        select: {
          id: true,
          quoteRequestId: true,
          startedAt: true,
          outcome: true,
          callerId: true,
          caller: { select: { name: true, phone: true } },
          organizationId: true,
          organization: { select: { name: true } },
          quoteRequest: {
            select: {
              quoteNumber: true,
              title: true,
              items: { select: { partNumber: true }, take: 5 },
            },
          },
        },
      },
    },
  });

  return suppliers
    .filter((s) => s.supplierCalls.length > 0)
    .map((s) => ({
      supplier: {
        id: s.id,
        name: s.name,
        phone: s.phone,
        organizationId: s.organizationId,
        organizationName: s.organization.name,
      },
      recentCalls: s.supplierCalls.map((c) => ({
        callId: c.id,
        quoteRequestId: c.quoteRequestId,
        quoteNumber: c.quoteRequest?.quoteNumber || null,
        quoteTitle: c.quoteRequest?.title || null,
        callerUserId: c.callerId,
        callerUserName: c.caller?.name || null,
        callerUserPhone: c.caller?.phone || null,
        organizationId: c.organizationId,
        organizationName: c.organization.name,
        startedAt: c.startedAt,
        outcome: c.outcome,
        parts: c.quoteRequest?.items.map((i) => i.partNumber) || [],
      })),
    }));
}

/**
 * Group recent calls by organization (for multi-tenant disambiguation).
 */
export function groupCallsByOrg(matches: CallerMatch[]): Map<string, CallerMatch['recentCalls']> {
  const byOrg = new Map<string, CallerMatch['recentCalls']>();
  for (const match of matches) {
    for (const call of match.recentCalls) {
      const existing = byOrg.get(call.organizationId) || [];
      existing.push(call);
      byOrg.set(call.organizationId, existing);
    }
  }
  return byOrg;
}
