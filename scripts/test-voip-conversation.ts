/**
 * Interactive VOIP Conversation Tester
 * 
 * Run this script to manually test the call flow without making actual calls.
 * Simulates a conversation where you type supplier responses.
 * 
 * Usage: npx tsx scripts/test-voip-conversation.ts
 */

import { initializeCallState, processCallTurn } from '@/lib/voip/call-graph';
import { addMessage } from '@/lib/voip/helpers';
import { CallState } from '@/lib/voip/types';
import { OpenRouterClient } from '@/lib/services/llm/openrouter-client';
import * as readline from 'readline';

// ANSI color codes for terminal
const colors = {
  reset: '\x1b[0m',
  bright: '\x1b[1m',
  dim: '\x1b[2m',
  red: '\x1b[31m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  magenta: '\x1b[35m',
  cyan: '\x1b[36m',
};

function formatMessage(speaker: string, text: string, color: string): string {
  return `${color}${colors.bright}[${speaker.toUpperCase()}]${colors.reset}${color} ${text}${colors.reset}`;
}

function logAI(text: string) {
  console.log(formatMessage('AI Agent', text, colors.cyan));
}

function logSupplier(text: string) {
  console.log(formatMessage('Supplier', text, colors.green));
}

function logSystem(text: string) {
  console.log(`${colors.dim}[SYSTEM] ${text}${colors.reset}`);
}

function logState(state: CallState) {
  console.log(`\n${colors.yellow}═══ Current State ═══${colors.reset}`);
  console.log(`${colors.dim}Node: ${state.currentNode}`);
  console.log(`Status: ${state.status}`);
  console.log(`Quotes Collected: ${state.quotes.length}`);
  console.log(`Negotiation Attempts: ${state.negotiationAttempts}/${state.maxNegotiationAttempts}`);
  console.log(`Needs Transfer: ${state.needsTransfer}`);
  console.log(`Needs Escalation: ${state.needsHumanEscalation}${colors.reset}`);
  
  if (state.quotes.length > 0) {
    console.log(`\n${colors.magenta}Extracted Quotes:${colors.reset}`);
    state.quotes.forEach((q, i) => {
      console.log(`  ${i + 1}. ${q.partNumber}: $${q.price || 'N/A'} - ${q.availability}`);
      if (q.leadTimeDays) console.log(`     Lead time: ${q.leadTimeDays} days`);
      if (q.notes) console.log(`     Notes: ${q.notes}`);
    });
  }
  console.log(`${colors.yellow}═════════════════════${colors.reset}\n`);
}

async function runConversation() {
  console.log(`\n${colors.bright}${colors.blue}╔═══════════════════════════════════════════════════════╗`);
  console.log(`║        VOIP Call Flow Interactive Tester             ║`);
  console.log(`╚═══════════════════════════════════════════════════════╝${colors.reset}\n`);

  // Initialize test call
  const state = initializeCallState({
    callId: 'test-' + Date.now(),
    quoteRequestId: 'QR-TEST-001',
    supplierId: 'SUP-TEST',
    supplierName: 'Test Parts Supplier Inc.',
    supplierPhone: '+15555551234',
    organizationId: 'ORG-TEST',
    callerId: 'USER-TEST',
    parts: [
      {
        partNumber: 'T478319',
        description: 'Cab door window pane',
        quantity: 1,
        budgetMax: 300,
      },
      {
        partNumber: 'RE506428',
        description: 'Engine oil filter',
        quantity: 3,
        budgetMax: 75,
      },
    ],
    customContext: `Company: ACME Construction
Quote Request: #REQ-001
Vehicle: 2015 John Deere 160GLC (Serial: 1FF160GXAFD056160)

Parts Needed (2 parts):
1. T478319 - Cab door window pane (Qty: 1)
2. RE506428 - Engine oil filter (Qty: 3)`,
    customInstructions: `Be natural and friendly. Always start by asking for parts department.
Go through each part slowly. Don't rush the conversation.`,
  });

  logSystem('Call initialized');
  console.log(`${colors.dim}Calling: ${state.supplierName} (${state.supplierPhone})${colors.reset}\n`);
  
  logState(state);

  // Check for OpenRouter API key
  if (!process.env.OPENROUTER_API_KEY) {
    console.error(`${colors.red}ERROR: OPENROUTER_API_KEY not found in environment variables.${colors.reset}`);
    console.log(`${colors.yellow}This test requires a real LLM to route conversation flow.`);
    console.log(`Set OPENROUTER_API_KEY in your .env file to run this test.${colors.reset}\n`);
    process.exit(1);
  }

  const llmClient = await OpenRouterClient.fromOrganization(state.organizationId);

  let currentState = state;
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
  });

  async function conversationLoop() {
    // AI takes turn
    logSystem(`Processing AI turn in node: ${currentState.currentNode}`);
    currentState = await processCallTurn(llmClient, currentState);
    
    const lastAIMessage = currentState.conversationHistory
      .filter(m => m.speaker === 'ai')
      .pop();
    
    if (lastAIMessage) {
      logAI(lastAIMessage.text);
    }

    logState(currentState);

    // Check if call should end
    if (
      currentState.currentNode === 'end' ||
      currentState.status === 'completed' ||
      currentState.status === 'failed' ||
      currentState.status === 'escalated'
    ) {
      console.log(`\n${colors.bright}${colors.green}═══ CALL ENDED ═══${colors.reset}`);
      console.log(`${colors.dim}Final Status: ${currentState.status}${colors.reset}`);
      console.log(`${colors.dim}Outcome: ${currentState.outcome || 'Not specified'}${colors.reset}`);
      
      if (currentState.quotes.length > 0) {
        console.log(`\n${colors.magenta}Final Quotes Collected:${colors.reset}`);
        currentState.quotes.forEach((q, i) => {
          console.log(`  ${i + 1}. ${q.partNumber}: $${q.price || 'N/A'} (${q.availability})`);
        });
      }
      
      console.log();
      rl.close();
      return;
    }

    // Prompt for supplier response
    rl.question(`${colors.green}${colors.bright}[You as Supplier]${colors.reset} Type response (or 'quit' to exit): `, async (answer) => {
      if (answer.toLowerCase() === 'quit') {
        logSystem('Test ended by user');
        rl.close();
        return;
      }

      if (!answer.trim()) {
        console.log(`${colors.red}Please enter a response.${colors.reset}\n`);
        return conversationLoop();
      }

      logSupplier(answer);
      
      // Add supplier message to history
      currentState = addMessage(currentState, 'supplier', answer);
      
      console.log(); // Blank line for readability
      
      // Continue conversation
      await conversationLoop();
    });
  }

  // Start the conversation loop
  await conversationLoop();
}

// Example supplier responses to help user
function showExamples() {
  console.log(`\n${colors.bright}Example Supplier Responses:${colors.reset}`);
  console.log(`${colors.dim}───────────────────────────────────────────────────────${colors.reset}`);
  console.log(`${colors.green}Helpful:${colors.reset} "Yes, you're speaking to parts. How can I help you?"`);
  console.log(`${colors.green}Price Quote:${colors.reset} "Part T478319 is $245.50, in stock. Ships today."`);
  console.log(`${colors.green}Backorder:${colors.reset} "That part is on backorder. 2-3 week lead time."`);
  console.log(`${colors.yellow}Transfer:${colors.reset} "Hold on, let me transfer you to our parts department."`);
  console.log(`${colors.yellow}Question:${colors.reset} "What's the serial number on that machine?"`);
  console.log(`${colors.red}Not Interested:${colors.reset} "Sorry, we don't do phone quotes. Email only."`);
  console.log(`${colors.red}Voicemail:${colors.reset} "You've reached the voicemail of..."`);
  console.log(`${colors.dim}───────────────────────────────────────────────────────${colors.reset}\n`);
}

// Main
showExamples();
runConversation().catch((error) => {
  console.error(`${colors.red}Error:${colors.reset}`, error.message);
  process.exit(1);
});
