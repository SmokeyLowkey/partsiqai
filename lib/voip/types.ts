// VOIP Call State Types for LangGraph

export interface CallState {
  // Context
  callId: string;
  quoteRequestId: string;
  supplierId: string;
  supplierName: string;
  supplierPhone: string;
  organizationId: string;
  callerId: string;
  
  // Parts being quoted
  parts: Array<{
    partNumber: string;
    description: string;
    quantity: number;
    budgetMax?: number;
  }>;
  
  // User-provided custom context for AI agent
  voiceAgentContext?: string;
  
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
  quotes: Array<{
    partNumber: string;
    price?: number;
    availability: 'in_stock' | 'backorder' | 'unavailable';
    leadTimeDays?: number;
    notes?: string;
  }>;
  
  // Decision variables
  needsTransfer: boolean;
  needsHumanEscalation: boolean;
  negotiationAttempts: number;
  maxNegotiationAttempts: number;
  clarificationAttempts: number;
  
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
};
