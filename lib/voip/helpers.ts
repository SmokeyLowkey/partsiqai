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
    'yes_can_help': 'Person confirms they can help, they\'re the right department, or they\'re ready to listen (e.g., "Yes", "Speaking", "This is parts", "Go ahead")',
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
      const engagementWords = ['yeah', 'yes', 'speaking', 'this is', 'go ahead', 'sure'];
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
  partsContext: CallState['parts']
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

  const prompt = `Extract pricing from this supplier response. Return ONLY valid JSON, no markdown, no explanation.

Supplier: "${supplierResponse}"

Parts requested:
${partsDescription}

Return JSON array:
[
  {
    "partNumber": "exact part number",
    "price": number or null,
    "availability": "in_stock" or "backorder" or "unavailable",
    "leadTimeDays": number or null,
    "notes": "string or null"
  }
]

If no pricing mentioned, return []. Match part numbers carefully (e.g., "a t five one four seven nine nine" = "AT514799").`;

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
 * Format part numbers for better TTS pronunciation using SSML
 * Splits alphanumeric codes into letter and number segments
 * Example: "MIA883029" → "<say-as interpret-as='characters'>MIA</say-as>-<say-as interpret-as='digits'>883029</say-as>"
 */
export function formatPartNumberForSpeech(partNumber: string): string {
  // Check if part number has mix of letters and numbers
  const hasLetters = /[A-Za-z]/.test(partNumber);
  const hasNumbers = /[0-9]/.test(partNumber);
  
  if (hasLetters && hasNumbers) {
    // Split into letter prefix and number suffix
    const match = partNumber.match(/^([A-Za-z]+)([0-9]+)$/);
    if (match) {
      const [, letters, numbers] = match;
      // Use SSML to spell out letters, then say numbers as digits
      return `<say-as interpret-as="characters">${letters}</say-as>-<say-as interpret-as="digits">${numbers}</say-as>`;
    }
  }
  
  // Fallback: for part numbers with complex patterns, add hyphens between letters
  if (hasLetters && !hasNumbers) {
    return partNumber.split('').join('-');
  }
  
  // Just numbers or complex pattern - return as-is
  return partNumber;
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
