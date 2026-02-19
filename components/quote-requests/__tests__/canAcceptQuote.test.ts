import { describe, it, expect } from 'vitest';
import { QuoteStatus, ItemAvailability, UserRole } from '@prisma/client';

/**
 * Tests for the canAcceptQuote logic from SupplierPriceComparisonTable.
 * Extracted as a pure function to test role-based and status-based gating.
 */

interface CanAcceptResult {
  enabled: boolean;
  reason?: string;
  warning?: string;
}

interface EmailThread {
  supplierId: string;
  status: string;
}

interface SupplierQuote {
  supplierId: string;
  unitPrice: number;
  totalPrice: number;
}

interface Item {
  id: string;
  partNumber: string;
  supplierQuotes?: SupplierQuote[];
}

// Extracted logic matching SupplierPriceComparisonTable.canAcceptQuote
function canAcceptQuote(
  supplierId: string,
  opts: {
    userRole?: UserRole;
    quoteStatus: QuoteStatus;
    createdByRole?: UserRole;
    requiresApproval?: boolean;
    selectedSupplierId?: string | null;
    emailThreads: EmailThread[];
    items: Item[];
  }
): CanAcceptResult {
  const {
    userRole,
    quoteStatus,
    createdByRole,
    requiresApproval,
    selectedSupplierId,
    emailThreads,
    items,
  } = opts;

  const isManager =
    userRole === 'MANAGER' || userRole === 'ADMIN' || userRole === 'MASTER_ADMIN';

  // Technicians cannot convert
  if (userRole === 'TECHNICIAN') {
    return { enabled: false, reason: 'Only managers can convert quotes to orders' };
  }

  // Block on terminal/non-actionable statuses
  if (
    ['SENT', 'DRAFT', 'CONVERTED_TO_ORDER', 'REJECTED', 'EXPIRED'].includes(quoteStatus)
  ) {
    return {
      enabled: false,
      reason:
        quoteStatus === 'SENT'
          ? 'Waiting for supplier responses'
          : `Cannot accept quote with status ${quoteStatus}`,
    };
  }

  // For technician-created quotes requiring approval
  const quoteCreatedByTechnician = createdByRole === 'TECHNICIAN';
  if (quoteCreatedByTechnician && requiresApproval && quoteStatus === 'UNDER_REVIEW') {
    if (!isManager) {
      return { enabled: false, reason: 'Quote requires manager approval' };
    }
  }

  // Enforce manager-selected supplier
  if (selectedSupplierId && supplierId !== selectedSupplierId) {
    return { enabled: false, reason: 'Manager approved a different supplier' };
  }

  // Check supplier responded
  const supplierThread = emailThreads.find((et) => et.supplierId === supplierId);
  if (supplierThread?.status !== 'RESPONDED') {
    return { enabled: false, reason: 'Supplier has not responded yet' };
  }

  // Check has pricing data
  const supplierItems = items.flatMap(
    (item) => item.supplierQuotes?.filter((sq) => sq.supplierId === supplierId) || []
  );
  if (supplierItems.length === 0) {
    return { enabled: false, reason: 'No pricing received from this supplier' };
  }

  // Check coverage
  const quotedCount = supplierItems.length;
  const totalCount = items.filter((i) => i.partNumber !== 'MISC-COSTS').length;
  if (quotedCount < totalCount) {
    return {
      enabled: true,
      warning: `Supplier quoted ${quotedCount} of ${totalCount} items`,
    };
  }

  return { enabled: true };
}

// --- Test data factories ---

const defaultItems: Item[] = [
  {
    id: 'item_1',
    partNumber: 'PART-001',
    supplierQuotes: [{ supplierId: 'sup_1', unitPrice: 50, totalPrice: 50 }],
  },
  {
    id: 'item_2',
    partNumber: 'PART-002',
    supplierQuotes: [{ supplierId: 'sup_1', unitPrice: 75, totalPrice: 75 }],
  },
];

const defaultThreads: EmailThread[] = [{ supplierId: 'sup_1', status: 'RESPONDED' }];

const defaults = {
  emailThreads: defaultThreads,
  items: defaultItems,
  selectedSupplierId: null,
  requiresApproval: false,
  createdByRole: 'TECHNICIAN' as UserRole,
};

// --- Tests ---

describe('canAcceptQuote logic', () => {
  describe('Role-based gating', () => {
    it('should block TECHNICIAN from accepting any quote', () => {
      const result = canAcceptQuote('sup_1', {
        ...defaults,
        userRole: 'TECHNICIAN',
        quoteStatus: 'RECEIVED',
      });
      expect(result.enabled).toBe(false);
      expect(result.reason).toContain('managers');
    });

    it('should allow MANAGER to accept', () => {
      const result = canAcceptQuote('sup_1', {
        ...defaults,
        userRole: 'MANAGER',
        quoteStatus: 'RECEIVED',
      });
      expect(result.enabled).toBe(true);
    });

    it('should allow ADMIN to accept', () => {
      const result = canAcceptQuote('sup_1', {
        ...defaults,
        userRole: 'ADMIN',
        quoteStatus: 'RECEIVED',
      });
      expect(result.enabled).toBe(true);
    });

    it('should allow MASTER_ADMIN to accept', () => {
      const result = canAcceptQuote('sup_1', {
        ...defaults,
        userRole: 'MASTER_ADMIN',
        quoteStatus: 'RECEIVED',
      });
      expect(result.enabled).toBe(true);
    });
  });

  describe('Status-based gating', () => {
    const blockedStatuses: QuoteStatus[] = [
      'SENT',
      'DRAFT',
      'CONVERTED_TO_ORDER',
      'REJECTED',
      'EXPIRED',
    ];

    blockedStatuses.forEach((status) => {
      it(`should block acceptance in ${status} status`, () => {
        const result = canAcceptQuote('sup_1', {
          ...defaults,
          userRole: 'MANAGER',
          quoteStatus: status,
        });
        expect(result.enabled).toBe(false);
      });
    });

    const allowedStatuses: QuoteStatus[] = ['RECEIVED', 'UNDER_REVIEW', 'APPROVED'];

    allowedStatuses.forEach((status) => {
      it(`should allow acceptance in ${status} status for manager`, () => {
        const result = canAcceptQuote('sup_1', {
          ...defaults,
          userRole: 'MANAGER',
          quoteStatus: status,
        });
        expect(result.enabled).toBe(true);
      });
    });
  });

  describe('Technician-created quotes with approval requirement', () => {
    it('should allow manager to accept UNDER_REVIEW quote (implicit approval)', () => {
      const result = canAcceptQuote('sup_1', {
        ...defaults,
        userRole: 'MANAGER',
        quoteStatus: 'UNDER_REVIEW',
        createdByRole: 'TECHNICIAN',
        requiresApproval: true,
      });
      expect(result.enabled).toBe(true);
    });

    it('should allow manager to accept APPROVED technician quote', () => {
      const result = canAcceptQuote('sup_1', {
        ...defaults,
        userRole: 'MANAGER',
        quoteStatus: 'APPROVED',
        createdByRole: 'TECHNICIAN',
        requiresApproval: true,
      });
      expect(result.enabled).toBe(true);
    });

    it('should allow manager to accept RECEIVED technician quote (no approval requested yet)', () => {
      const result = canAcceptQuote('sup_1', {
        ...defaults,
        userRole: 'MANAGER',
        quoteStatus: 'RECEIVED',
        createdByRole: 'TECHNICIAN',
        requiresApproval: false,
      });
      expect(result.enabled).toBe(true);
    });
  });

  describe('Selected supplier enforcement', () => {
    it('should block non-selected supplier after manager approval', () => {
      const result = canAcceptQuote('sup_1', {
        ...defaults,
        userRole: 'MANAGER',
        quoteStatus: 'APPROVED',
        selectedSupplierId: 'sup_2',
      });
      expect(result.enabled).toBe(false);
      expect(result.reason).toContain('different supplier');
    });

    it('should allow the selected supplier', () => {
      const result = canAcceptQuote('sup_1', {
        ...defaults,
        userRole: 'MANAGER',
        quoteStatus: 'APPROVED',
        selectedSupplierId: 'sup_1',
      });
      expect(result.enabled).toBe(true);
    });

    it('should allow any supplier when no selection made', () => {
      const result = canAcceptQuote('sup_1', {
        ...defaults,
        userRole: 'MANAGER',
        quoteStatus: 'APPROVED',
        selectedSupplierId: null,
      });
      expect(result.enabled).toBe(true);
    });
  });

  describe('Supplier response validation', () => {
    it('should block if supplier has not responded', () => {
      const result = canAcceptQuote('sup_1', {
        ...defaults,
        userRole: 'MANAGER',
        quoteStatus: 'RECEIVED',
        emailThreads: [{ supplierId: 'sup_1', status: 'SENT' }],
      });
      expect(result.enabled).toBe(false);
      expect(result.reason).toContain('not responded');
    });

    it('should block if no email thread exists for supplier', () => {
      const result = canAcceptQuote('sup_1', {
        ...defaults,
        userRole: 'MANAGER',
        quoteStatus: 'RECEIVED',
        emailThreads: [],
      });
      expect(result.enabled).toBe(false);
      expect(result.reason).toContain('not responded');
    });
  });

  describe('Pricing data validation', () => {
    it('should block if no supplier quotes exist', () => {
      const result = canAcceptQuote('sup_1', {
        ...defaults,
        userRole: 'MANAGER',
        quoteStatus: 'RECEIVED',
        items: [
          { id: 'item_1', partNumber: 'PART-001', supplierQuotes: [] },
        ],
      });
      expect(result.enabled).toBe(false);
      expect(result.reason).toContain('No pricing');
    });

    it('should warn on partial coverage', () => {
      const result = canAcceptQuote('sup_1', {
        ...defaults,
        userRole: 'MANAGER',
        quoteStatus: 'RECEIVED',
        items: [
          {
            id: 'item_1',
            partNumber: 'PART-001',
            supplierQuotes: [{ supplierId: 'sup_1', unitPrice: 50, totalPrice: 50 }],
          },
          {
            id: 'item_2',
            partNumber: 'PART-002',
            supplierQuotes: [], // No quote for this item
          },
        ],
      });
      expect(result.enabled).toBe(true);
      expect(result.warning).toContain('1 of 2');
    });

    it('should exclude MISC-COSTS from coverage calculation', () => {
      const result = canAcceptQuote('sup_1', {
        ...defaults,
        userRole: 'MANAGER',
        quoteStatus: 'RECEIVED',
        items: [
          {
            id: 'item_1',
            partNumber: 'PART-001',
            supplierQuotes: [{ supplierId: 'sup_1', unitPrice: 50, totalPrice: 50 }],
          },
          {
            id: 'item_misc',
            partNumber: 'MISC-COSTS',
            supplierQuotes: [], // No quote, but it's MISC
          },
        ],
      });
      // 1 quoted out of 1 non-MISC item = full coverage
      expect(result.enabled).toBe(true);
      expect(result.warning).toBeUndefined();
    });
  });
});
