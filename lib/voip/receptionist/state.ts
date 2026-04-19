import { redisConnection } from '@/lib/queue/connection';
import type { CallerMatch } from './caller-lookup';

export type ReceptionistNode =
  | 'identify_caller'
  | 'confirm_context'
  | 'disambiguate_org'
  | 'disambiguate_quote'
  | 'qualify_unknown'
  | 'offer_routing'
  | 'transfer_to_human'
  | 'transfer_to_agent'
  | 'take_message'
  | 'end_call';

export interface ReceptionistMessage {
  role: 'system' | 'assistant' | 'user';
  content: string;
  timestamp: string;
}

export interface ReceptionistState {
  callId: string;
  vapiCallId: string | null;
  callerPhone: string;
  startedAt: string;
  currentNode: ReceptionistNode;
  conversationHistory: ReceptionistMessage[];

  // Caller identification
  matches: CallerMatch[]; // All possible matches from caller-lookup
  selectedOrgId: string | null; // Selected after disambiguation
  selectedCall: CallerMatch['recentCalls'][number] | null; // The specific quote/call

  // Routing decision
  routingChoice: 'human' | 'agent' | null;

  // Message capture (if take_message path)
  message: {
    callerName?: string;
    callerCompany?: string;
    reason?: string;
    callbackNumber?: string;
  };

  // Flags
  isAfterHours: boolean;
  rateLimitExceeded: boolean;
  identificationDeadline: string; // ISO timestamp — after this, force take_message
  callDeadline: string; // ISO timestamp — after this, force end
}

const RECEPTIONIST_STATE_TTL = 600; // 10 minutes

function stateKey(callId: string): string {
  return `receptionist:call:${callId}`;
}

const inMemoryStore = new Map<string, { state: ReceptionistState; expires: number }>();

function getRedisClient() {
  return redisConnection || null;
}

export async function saveReceptionistState(callId: string, state: ReceptionistState): Promise<void> {
  const client = getRedisClient();
  if (!client) {
    inMemoryStore.set(stateKey(callId), {
      state,
      expires: Date.now() + RECEPTIONIST_STATE_TTL * 1000,
    });
    return;
  }
  await client.set(stateKey(callId), JSON.stringify(state), 'EX', RECEPTIONIST_STATE_TTL);
}

export async function getReceptionistState(callId: string): Promise<ReceptionistState | null> {
  const client = getRedisClient();
  if (!client) {
    const entry = inMemoryStore.get(stateKey(callId));
    if (!entry || entry.expires < Date.now()) {
      inMemoryStore.delete(stateKey(callId));
      return null;
    }
    return entry.state;
  }
  const raw = await client.get(stateKey(callId));
  if (!raw) return null;
  try {
    return JSON.parse(raw) as ReceptionistState;
  } catch {
    return null;
  }
}

export async function deleteReceptionistState(callId: string): Promise<void> {
  const client = getRedisClient();
  if (!client) {
    inMemoryStore.delete(stateKey(callId));
    return;
  }
  await client.del(stateKey(callId));
}

export function initReceptionistState(opts: {
  callId: string;
  vapiCallId: string | null;
  callerPhone: string;
  matches: CallerMatch[];
  isAfterHours: boolean;
  rateLimitExceeded: boolean;
  maxCallDurationSec: number;
  identificationTimeoutSec: number;
}): ReceptionistState {
  const now = Date.now();
  return {
    callId: opts.callId,
    vapiCallId: opts.vapiCallId,
    callerPhone: opts.callerPhone,
    startedAt: new Date(now).toISOString(),
    currentNode: 'identify_caller',
    conversationHistory: [],
    matches: opts.matches,
    selectedOrgId: null,
    selectedCall: null,
    routingChoice: null,
    message: {},
    isAfterHours: opts.isAfterHours,
    rateLimitExceeded: opts.rateLimitExceeded,
    identificationDeadline: new Date(now + opts.identificationTimeoutSec * 1000).toISOString(),
    callDeadline: new Date(now + opts.maxCallDurationSec * 1000).toISOString(),
  };
}
