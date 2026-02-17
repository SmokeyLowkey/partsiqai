import { CallState, ConversationMessage } from './types';
import { OpenRouterClient } from '@/lib/services/llm/openrouter-client';

/**
 * Get the last message from the supplier
 */
export function getLastSupplierResponse(state: CallState): string {
  const messages = state.conversationHistory.filter(m => m.speaker === 'supplier');
  return messages[messages.length - 1]?.text || '';
}

/**
 * Get the last message from the AI
 */
export function getLastAIMessage(state: CallState): string {
  const messages = state.conversationHistory.filter(m => m.speaker === 'ai');
  return messages[messages.length - 1]?.text || '';
}

/**
 * Add a message to the conversation history
 */
export function addMessage(
  state: CallState,
  speaker: 'ai' | 'supplier' | 'system',
  text: string
): CallState {
  return {
    ...state,
    conversationHistory: [
      ...state.conversationHistory,
      {
        speaker,
        text,
        timestamp: new Date(),
      },
    ],
  };
}

/**
 * Classify the intent of a supplier's response
 */
export async function classifyIntent(
  llmClient: OpenRouterClient,
  response: string,
  possibleIntents: string[]
): Promise<string> {
  // Provide context for better classification
  const intentDescriptions: Record<string, string> = {
    'yes_can_help': 'Person confirms they can help, they\'re the right department, they\'re ready to listen, or they greet you and ask what you need (e.g., "Yes", "Speaking", "This is parts", "Go ahead", "How can I help you?", "What do you need?")',
    'transfer_needed': 'Person says they need to transfer you or you\'re not speaking to the right person (e.g., "Let me transfer you", "Wrong department", "Hold on")',
    'not_interested': 'Person clearly declines or is not interested (e.g., "Not interested", "Don\'t call again", "No thanks")',
    'voicemail': 'You reached voicemail, answering machine, or no human answered',
    'has_info': 'Supplier is providing pricing, availability, or quote information',
    'needs_clarification': 'Supplier is confused or asking for clarification',
    'callback_request': 'Supplier wants to call back or needs time to check',
  };

  const descriptions = possibleIntents
    .map(intent => `${intent}: ${intentDescriptions[intent] || intent}`)
    .join('\n');

  const prompt = `Classify this supplier phone response into ONE of these intents:

${descriptions}

Supplier said: "${response}"

IMPORTANT: If they confirm they're the right person/department (like "Yeah this is parts", "Speaking", "Yes"), classify as yes_can_help, NOT voicemail.
Voicemail is ONLY for actual voicemail/answering machine greetings like "You've reached...", "Please leave a message", or when nobody answers.

Return ONLY the intent name (e.g., "yes_can_help"), nothing else.`;

  try {
    const result = await llmClient.generateCompletion(prompt, {
      temperature: 0,
      model: 'anthropic/claude-3.5-sonnet', // Upgrade from llama to Claude for better accuracy
      maxTokens: 30,
    });
    
    const intent = result.trim().toLowerCase().replace(/[^a-z_]/g, '');
    
    // Additional validation: Check for obvious misclassifications
    const responseLower = response.toLowerCase();
    if (intent === 'voicemail') {
      // If classified as voicemail but response has engagement words, override to yes_can_help
      const engagementWords = ['yeah', 'yes', 'speaking', 'this is', 'go ahead', 'sure', 'how can i help', 'what do you need', 'what can i do'];
      if (engagementWords.some(word => responseLower.includes(word))) {
        console.log(`Intent override: "${response}" classified as voicemail, but contains engagement words. Changing to yes_can_help.`);
        return possibleIntents.includes('yes_can_help') ? 'yes_can_help' : possibleIntents[0];
      }
    }
    
    // Find matching intent (case-insensitive)
    const match = possibleIntents.find(i => i.toLowerCase() === intent);
    return match || possibleIntents[0]; // Default to first intent (usually positive)
  } catch (error) {
    console.error('Intent classification error:', error);
    return possibleIntents[0]; // Default to first rather than last
  }
}

/**
 * Extract pricing information from a supplier's response
 */
export async function extractPricing(
  llmClient: OpenRouterClient,
  supplierResponse: string,
  partsContext: CallState['parts'],
  recentHistory?: Array<{ speaker: string; text: string }>
): Promise<Array<{
  partNumber: string;
  price?: number;
  availability: 'in_stock' | 'backorder' | 'unavailable';
  leadTimeDays?: number;
  notes?: string;
}>> {
  const partsDescription = partsContext
    .map(p => `- ${p.partNumber}: ${p.description}`)
    .join('\n');

  // Include recent conversation history for context (availability may have been
  // mentioned in an earlier turn, e.g., "we have a couple in stock" then later "$130 each")
  let conversationContext = '';
  if (recentHistory && recentHistory.length > 0) {
    conversationContext = '\nRecent conversation for context:\n' +
      recentHistory
        .slice(-6)
        .map(m => `${m.speaker === 'ai' ? 'You' : 'Supplier'}: ${m.text}`)
        .join('\n') +
      '\n';
  }

  const prompt = `Extract pricing from this supplier response. Return ONLY valid JSON, no markdown, no explanation.
${conversationContext}
Supplier's latest response: "${supplierResponse}"

Parts requested:
${partsDescription}

Return JSON array:
[
  {
    "partNumber": "exact part number (use substitute number if supplier offered one)",
    "price": number or null,
    "availability": "in_stock" or "backorder" or "unavailable",
    "leadTimeDays": number or null,
    "notes": "string or null",
    "isSubstitute": true if this is a substitute/superseded/replacement part (false otherwise),
    "originalPartNumber": "the originally requested part number if this is a substitute, or null"
  }
]

If no pricing mentioned, return []. Match part numbers carefully (e.g., "a t five one four seven nine nine" = "AT514799").
If supplier said "in stock", "have them", "on hand", "couple in stock" etc. in ANY recent message, availability MUST be "in_stock".
If supplier says a part has been superseded or replaced, set isSubstitute=true and originalPartNumber to the requested part.`;

  try {
    const result = await llmClient.generateCompletion(prompt, {
      temperature: 0,
      model: 'anthropic/claude-3.5-sonnet', // Upgrade for better structured extraction
      maxTokens: 1000,
    });
    
    // Extract JSON from potential markdown code blocks or text
    let jsonStr = result.trim();
    const codeBlockMatch = jsonStr.match(/```(?:json)?\s*([\s\S]*?)```/);
    if (codeBlockMatch) {
      jsonStr = codeBlockMatch[1].trim();
    }
    const jsonMatch = jsonStr.match(/\[[\s\S]*\]/);
    if (jsonMatch) {
      jsonStr = jsonMatch[0];
    }
    
    return JSON.parse(jsonStr);
  } catch (error) {
    console.error('Price extraction error:', error);
    return [];
  }
}

// ============================================================================
// BOT SCREENING DETECTION & RESPONSE
// ============================================================================

export type ScreeningType = 'call_screen' | 'captcha' | 'urgency_check' | 'spam_rejection';

const CALL_SCREEN_PATTERNS = [
  'screening service',
  'screen your call',
  'screening your call',
  'say your name and why',
  'who is calling',
  'state your name and the reason',
  'google assistant',
  'the person you are calling',
  "the person you're calling",
  'go ahead and say your name',
  'please say your name',
];

const CAPTCHA_PATTERNS = [
  /what is \d+\s*(?:plus|minus|times|multiplied by|divided by|added to|\+|-|\*|x)\s*\d+/i,
  'solve this',
  'to connect your call',
  'verify you are human',
  "verify you're human",
  'are you a real person',
  'prove you are not a robot',
];

const URGENCY_PATTERNS = [
  'is this urgent',
  'do you need to get a hold of them urgently',
  'is it urgent',
  'is this an emergency',
  'can this wait',
];

const SPAM_REJECTION_PATTERNS = [
  'remove this number',
  'do not call',
  'stop calling',
  'mailing list',
  'this call has been rejected',
  'this call has been declined',
  'does not wish to speak',
  'not accepting calls',
];

/**
 * Detect if a response is from a bot screening system
 * Pattern-based (no LLM cost)
 */
export function detectBotScreening(response: string): ScreeningType | null {
  const lower = response.toLowerCase();

  // Check spam rejection first (highest priority — should end call)
  for (const pattern of SPAM_REJECTION_PATTERNS) {
    if (lower.includes(pattern)) return 'spam_rejection';
  }

  // Check CAPTCHA patterns (mix of string and regex)
  for (const pattern of CAPTCHA_PATTERNS) {
    if (pattern instanceof RegExp) {
      if (pattern.test(lower)) return 'captcha';
    } else {
      if (lower.includes(pattern)) return 'captcha';
    }
  }

  // Check urgency patterns
  for (const pattern of URGENCY_PATTERNS) {
    if (lower.includes(pattern)) return 'urgency_check';
  }

  // Check call screen patterns
  for (const pattern of CALL_SCREEN_PATTERNS) {
    if (lower.includes(pattern)) return 'call_screen';
  }

  return null;
}

/**
 * Solve simple math CAPTCHAs from bot screening
 * Handles "what is X plus/minus/times Y" style questions
 */
export function solveCaptcha(response: string): string | null {
  const match = response.match(
    /what is (\d+)\s*(?:plus|added to|\+)\s*(\d+)/i
  );
  if (match) return String(Number(match[1]) + Number(match[2]));

  const subMatch = response.match(
    /what is (\d+)\s*(?:minus|-)\s*(\d+)/i
  );
  if (subMatch) return String(Number(subMatch[1]) - Number(subMatch[2]));

  const mulMatch = response.match(
    /what is (\d+)\s*(?:times|multiplied by|\*|x)\s*(\d+)/i
  );
  if (mulMatch) return String(Number(mulMatch[1]) * Number(mulMatch[2]));

  const divMatch = response.match(
    /what is (\d+)\s*(?:divided by|\/)\s*(\d+)/i
  );
  if (divMatch && Number(divMatch[2]) !== 0) {
    return String(Math.round(Number(divMatch[1]) / Number(divMatch[2])));
  }

  return null;
}

/**
 * Generate a deterministic response for bot screening scenarios
 */
export function generateScreeningResponse(
  type: ScreeningType,
  state: CallState
): string {
  switch (type) {
    case 'call_screen':
      return `Hi, this is ${state.organizationName} calling about a parts inquiry. We're looking to get pricing on some equipment parts.`;
    case 'captcha': {
      const lastResponse = getLastSupplierResponse(state);
      const answer = solveCaptcha(lastResponse);
      if (answer) return answer;
      // Fallback if we can't solve it
      return `Hi, this is ${state.organizationName} calling about a parts inquiry.`;
    }
    case 'urgency_check':
      return "It's not urgent, but we would appreciate speaking with someone in the parts department when they're available.";
    case 'spam_rejection':
      return 'I understand, thank you for your time. Goodbye.';
  }
}

/**
 * Check if we have pricing for all requested parts
 * Accounts for substitute parts (matched via originalPartNumber)
 */
export function hasPricingForAllParts(state: CallState): boolean {
  if (state.parts.length === 0) return false;
  return state.parts.every(part =>
    state.quotes.some(q =>
      (q.partNumber === part.partNumber || q.originalPartNumber === part.partNumber)
      && q.price != null
    )
  );
}

/**
 * Detect if a supplier response mentions a substitute or superseded part
 */
export function detectSubstitute(response: string): boolean {
  const patterns = [
    'substitute', 'supersed', 'replaced by', 'replacement',
    'alternate', 'alternative', 'equivalent', 'updated part',
    'new number', 'new part number', 'changed to',
  ];
  const lower = response.toLowerCase();
  return patterns.some(p => lower.includes(p));
}

/**
 * Detect hold music, automated hold messages, or ads heard during a transfer
 * These should be ignored — the agent should stay silent and wait
 */
export function isHoldAudio(response: string): boolean {
  const lower = response.toLowerCase();

  // Common automated hold messages
  const holdPatterns = [
    'your call is important',
    'please continue to hold',
    'please hold',
    'thank you for holding',
    'thanks for holding',
    'thank you for waiting',
    'thanks for waiting',
    'please stay on the line',
    'someone will be with you',
    'you are caller number',
    'estimated wait time',
    'your call will be answered',
    'in the order it was received',
    'all of our representatives',
    'all of our agents',
    'currently assisting other',
    'high call volume',
    'next available',
    'for quality assurance',
    'this call may be recorded',
    'this call may be monitored',
    'press one', 'press two', 'press zero',
    'para español',
    'visit us at', 'visit our website',
    'did you know',
    'check out our',
  ];

  if (holdPatterns.some(p => lower.includes(p))) return true;

  // Very short responses during hold (garbled music transcription)
  // Single words or fragments that aren't meaningful engagement
  if (response.trim().length < 4) return true;

  return false;
}

/**
 * Check if supplier is asking to repeat part numbers
 */
export function isAskingToRepeat(response: string): boolean {
  const patterns = [
    'repeat', 'say that again', 'one more time', 'spell that',
    'say again', 'didn\'t catch', 'didn\'t get that', 'come again',
    'what was that', 'say those again', 'those numbers again',
    'part number again', 'can you spell', 'read that back',
  ];
  const lower = response.toLowerCase();
  return patterns.some(p => lower.includes(p));
}

/**
 * Check if supplier is asking a verification/fitment question
 * (serial number, machine model, year, application)
 */
export function isVerificationQuestion(response: string): boolean {
  const patterns = [
    'serial number', 'serial #', 'vin', 'model number',
    'what year', 'what model', 'what machine', 'what equipment',
    'what unit', 'which machine', 'which model', 'which unit',
    'fit on', 'fits on', 'fit for', 'fit the', 'fits the',
    'application', 'what\'s it for', 'what is it for',
    'what\'s it going on', 'what is it going on',
    'going in', 'going on', 'does it go on',
    'compatible', 'work with', 'work for',
  ];
  const lower = response.toLowerCase();
  return patterns.some(p => lower.includes(p));
}

/**
 * Check if response contains a question
 */
export async function detectQuestion(response: string): Promise<boolean> {
  const questionMarkers = ['?', 'which', 'what', 'how', 'when', 'where', 'can you', 'could you'];
  const lowerResponse = response.toLowerCase();
  
  return questionMarkers.some(marker => lowerResponse.includes(marker));
}

/**
 * Check if response contains a refusal/rejection
 */
export function containsRefusal(response: string): boolean {
  const refusalMarkers = [
    'no', 'cannot', "can't", 'unable', 'impossible', 
    'not possible', "won't", 'will not', 'best price'
  ];
  const lowerResponse = response.toLowerCase();
  
  return refusalMarkers.some(marker => lowerResponse.includes(marker));
}

/**
 * Generate a clarification message based on confused supplier response
 */
/**
 * Format part numbers for clear TTS pronunciation (plain text, no SSML)
 * Spells out letters individually and reads digits one by one
 * Example: "AT535106" → "A T, 5 3 5 1 0 6"
 */
export function formatPartNumberForSpeech(partNumber: string): string {
  // Split into segments: letters, digits, hyphens, and other chars
  const segments = partNumber.match(/[A-Za-z]+|[0-9]+|-|[^A-Za-z0-9-]+/g);
  if (!segments) return partNumber;

  return segments
    .map(seg => {
      if (seg === '-') {
        return 'dash';
      }
      if (/^[A-Za-z]+$/.test(seg)) {
        // Spell out each letter: "AT" → "A T"
        return seg.toUpperCase().split('').join(' ');
      }
      if (/^[0-9]+$/.test(seg)) {
        // Read each digit individually: "535106" → "5 3 5 1 0 6"
        return seg.split('').join(' ');
      }
      return seg;
    })
    .join(', ');
}

/**
 * Format a part number using NATO phonetic alphabet for maximum clarity
 * Used when supplier asks to repeat or has trouble hearing
 * Example: "AT308568" → "Alpha Tango ... 3, 0, 8, 5, 6, 8"
 */
const NATO_ALPHABET: Record<string, string> = {
  A: 'Alpha', B: 'Bravo', C: 'Charlie', D: 'Delta', E: 'Echo',
  F: 'Foxtrot', G: 'Golf', H: 'Hotel', I: 'India', J: 'Juliet',
  K: 'Kilo', L: 'Lima', M: 'Mike', N: 'November', O: 'Oscar',
  P: 'Papa', Q: 'Quebec', R: 'Romeo', S: 'Sierra', T: 'Tango',
  U: 'Uniform', V: 'Victor', W: 'Whiskey', X: 'X-ray', Y: 'Yankee',
  Z: 'Zulu',
};

export function formatPartNumberPhonetic(partNumber: string): string {
  const segments = partNumber.match(/[A-Za-z]+|[0-9]+|-|[^A-Za-z0-9-]+/g);
  if (!segments) return partNumber;

  return segments
    .map(seg => {
      if (seg === '-') {
        return 'dash';
      }
      if (/^[A-Za-z]+$/.test(seg)) {
        // Spell out each letter using NATO alphabet
        return seg
          .toUpperCase()
          .split('')
          .map(ch => NATO_ALPHABET[ch] || ch)
          .join(', ');
      }
      if (/^[0-9]+$/.test(seg)) {
        // Read each digit clearly
        return seg.split('').join(', ');
      }
      return seg;
    })
    .join(' ... ');
}

export async function generateClarification(
  llmClient: OpenRouterClient,
  supplierResponse: string,
  parts: CallState['parts']
): Promise<string> {
  const partsList = parts
    .map(p => `${formatPartNumberForSpeech(p.partNumber)} (${p.description}) - qty ${p.quantity}`)
    .join(', ');

  const prompt = `You're on a phone call. The supplier's response wasn't clear. Restate what you need in one clear sentence.

Supplier said: "${supplierResponse}"

You need: ${partsList}

Respond naturally, don't add preambles like "Here's my clarification" - just say it directly.`;

  try {
    let result = await llmClient.generateCompletion(prompt, {
      temperature: 0.3,
      model: 'anthropic/claude-3.5-sonnet', // Upgrade for better natural responses
      maxTokens: 150,
    });
    
    // Clean meta-commentary aggressively
    result = result
      .replace(/^(here'?s? (?:a |my |the )?(?:clear and concise |clarification |response|message):?|let me clarify:?)\s*/i, '')
      .trim();
    
    return result;
  } catch (error) {
    console.error('Clarification generation error:', error);
    return `Let me clarify - we need pricing for ${formatPartNumberForSpeech(parts[0].partNumber)}, ${parts[0].description}, quantity ${parts[0].quantity}.`;
  }
}

/**
 * Determine the final outcome of a call
 */
export function determineOutcome(state: CallState): string {
  if (state.quotes.length > 0 && state.quotes.some(q => q.price)) {
    return 'QUOTE_RECEIVED';
  }
  
  if (state.quotes.length > 0) {
    return 'PARTIAL_QUOTE';
  }
  
  if (state.needsHumanEscalation) {
    return 'TOO_COMPLEX';
  }
  
  if (state.status === 'needs_callback') {
    return 'CALLBACK_REQUESTED';
  }
  
  if (state.status === 'failed') {
    return 'NO_ANSWER';
  }
  
  return 'NO_ANSWER';
}
