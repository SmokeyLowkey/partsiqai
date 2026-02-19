// VOIP Call State Types for LangGraph

export interface CallState {
  // Context
  callId: string;
  quoteRequestId: string;
  quoteReference: string; // Human-readable like "QR-02-2026-0009"
  supplierId: string;
  supplierName: string;
  supplierPhone: string;
  organizationId: string;
  organizationName: string; // Human-readable company name
  callerId: string;
  
  // Parts being quoted
  parts: Array<{
    partNumber: string;
    description: string;
    quantity: number;
    budgetMax?: number;
    source?: 'CATALOG' | 'WEB_SEARCH' | 'MANUAL';
  }>;
  
  // Background facts for the AI (vehicle info, parts details, etc.) - NOT spoken directly
  customContext?: string;
  // Behavioral instructions for how the AI should conduct the call
  customInstructions?: string;
  
  // Conversation tracking
  currentNode: string;
  conversationHistory: Array<{
    speaker: 'ai' | 'supplier' | 'system';
    text: string;
    timestamp: Date;
  }>;
  
  // Supplier info (detected during call)
  contactName?: string;
  contactRole?: 'gatekeeper' | 'buyer' | 'owner';
  
  // Extracted quotes
  quotes: Array<ExtractedQuote>;
  
  // Decision variables
  needsTransfer: boolean;
  needsHumanEscalation: boolean;
  negotiationAttempts: number;
  maxNegotiationAttempts: number;
  negotiatedParts: string[]; // partNumbers already negotiated (prevents re-negotiating)
  clarificationAttempts: number;

  // Bot screening
  botScreeningDetected: boolean;
  botScreeningAttempts: number;
  botScreeningMaxAttempts: number;

  // Part delivery tracking
  allPartsRequested: boolean;

  // Misc costs tracking
  hasMiscCosts: boolean;
  miscCostsAsked: boolean;

  // Transfer/hold tracking
  waitingForTransfer: boolean;

  // Follow-up call tracking
  isFollowUp: boolean;

  // Turn counter (incremented on each supplier message, used by Overseer for stale nudge detection)
  turnNumber: number;

  // Call outcome
  status: 'in_progress' | 'completed' | 'failed' | 'needs_callback' | 'escalated';
  outcome?: string;
  nextAction?: 'retry' | 'email_fallback' | 'human_followup' | 'callback_scheduled';
}

export type ConversationMessage = {
  speaker: 'ai' | 'supplier' | 'system';
  text: string;
  timestamp: Date;
};

export type ExtractedQuote = {
  partNumber: string;
  price?: number;
  availability: 'in_stock' | 'backorder' | 'unavailable';
  leadTimeDays?: number;
  notes?: string;
  isSubstitute?: boolean;
  originalPartNumber?: string;
};
