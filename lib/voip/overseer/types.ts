// Overseer Agent Types
// The Overseer monitors each call turn asynchronously and sends coaching nudges
// to the voice agent. It controls phase transitions (GATHER → NEGOTIATE → FINALIZE).

export type OverseerPhase = 'GATHER' | 'NEGOTIATE' | 'FINALIZE';
export type NudgePriority = 'P0' | 'P1' | 'P2';

export interface OverseerNudge {
  priority: NudgePriority;
  text: string;
  turnNumber: number;
  phase: OverseerPhase;
  timestamp: number;
  source: 'overseer' | 'commander';
  phaseTransition?: OverseerPhase; // When set, voice agent routing should override to this phase
}

export interface OverseerState {
  callId: string;
  phase: OverseerPhase;
  lastAnalyzedTurn: number;

  // Dual state tracking (architecture doc §Phase 1: GATHER)
  infoWeNeed: {
    unitPrices: 'pending' | 'partial' | 'collected';
    leadTime: 'pending' | 'collected' | 'not_applicable';
    stockStatus: 'pending' | 'collected' | 'not_applicable';
    allPartsAddressed: boolean;
  };
  infoTheyWant: {
    quantity: 'not_asked' | 'asked' | 'answered';
    companyName: 'not_asked' | 'asked' | 'answered';
    accountNumber: 'not_asked' | 'asked' | 'answered';
  };

  negotiationNotes: string[];
  flaggedIssues: string[];
}

// Events emitted upward to the Procurement Commander
export type OverseerEventType =
  | 'quote_received'
  | 'quote_rejected'
  | 'negotiation_stalled'
  | 'transfer_in_progress'
  | 'supplier_wants_callback'
  | 'call_ended'
  | 'error_detected';

export interface OverseerEvent {
  callId: string;
  quoteRequestId: string;
  supplierName: string;
  eventType: OverseerEventType;
  timestamp: number;
  data: Record<string, any>;
}

// Overseer LLM structured output schema
export interface OverseerAnalysis {
  analysis: string;
  nudge: {
    priority: NudgePriority;
    text: string;
  } | null;
  phaseTransition: 'NEGOTIATE' | 'FINALIZE' | null;
  event: {
    eventType: OverseerEventType;
    data: Record<string, any>;
  } | null;
  updatedTracking: {
    unitPrices: 'pending' | 'partial' | 'collected';
    leadTime: 'pending' | 'collected' | 'not_applicable';
    stockStatus: 'pending' | 'collected' | 'not_applicable';
    allPartsAddressed: boolean;
    infoTheyWant: {
      quantity: 'not_asked' | 'asked' | 'answered';
      companyName: 'not_asked' | 'asked' | 'answered';
      accountNumber: 'not_asked' | 'asked' | 'answered';
    };
  };
  flaggedIssue: string | null;
}
