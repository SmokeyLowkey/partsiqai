// Procurement Commander Types
// The Commander sits above all active calls for a procurement request,
// compares quotes across suppliers, and issues directives to Overseers.

export type DirectiveType =
  | 'leverage_update'   // Share competitive intelligence across calls
  | 'deprioritize'      // A part is well-covered, shift focus
  | 'wrap_up'           // Supplier not competitive, end call
  | 'escalate'          // Beyond agent authority, hand to human
  | 'award';            // Best package found, confirm terms

export interface CommanderDirective {
  directiveType: DirectiveType;
  targetCallId: string;
  message: string;
  timestamp: number;
}

export interface CommanderState {
  quoteRequestId: string;
  organizationId: string;

  // Master parts list with best quotes across all suppliers
  bestQuotes: Record<string, {
    bestPrice: number | null;
    bestSupplier: string | null;
    bestLeadTimeDays: number | null;
    bestLeadTimeSupplier: string | null;
    quotesReceived: number;
  }>;

  // Active calls tracked
  activeCalls: Record<string, {
    supplierId: string;
    supplierName: string;
    status: 'active' | 'ended';
    phase: 'GATHER' | 'NEGOTIATE' | 'FINALIZE';
  }>;

  // Budget constraints per part
  budgets: Record<string, {
    budgetCeiling: number | null;
    targetPrice: number | null;
  }>;

  eventsProcessed: number;
  lastEventTimestamp: number;
}

// Commander LLM structured output schema
export interface CommanderAnalysis {
  analysis: string;
  directives: Array<{
    directiveType: DirectiveType;
    targetCallId: string;
    message: string;
  }>;
}
