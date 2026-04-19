import type { ReceptionistState } from './state';

/**
 * Generate the system prompt for the receptionist based on current state.
 * The prompt changes based on which node the conversation is in.
 */
export function generateReceptionistPrompt(state: ReceptionistState): string {
  const base = `You are PartsIQ's AI receptionist. You answer inbound calls from suppliers calling back about parts quotes.

Your job is to:
1. Identify who's calling (using caller ID + verbal confirmation)
2. Figure out which user/quote they're calling about
3. Either warm-transfer them to the right person, route them to the AI agent for the quote, or take a message

Be polite, professional, and concise. Each turn should be 1-2 short sentences. Don't ramble.

Current call info:
- Caller phone number: ${state.callerPhone}
- Time of call: ${new Date().toLocaleString()}
- After hours: ${state.isAfterHours ? 'YES — do NOT offer human transfer, only AI agent or message' : 'NO'}
`;

  switch (state.currentNode) {
    case 'identify_caller': {
      if (state.matches.length === 0) {
        return `${base}

Caller ID didn't match any supplier in our system. Greet them and ask who they are and what company they're with so we can find their context.

Example: "Hi, thanks for calling PartsIQ. May I ask who's calling and what company you're with?"`;
      }

      const summary = state.matches
        .flatMap((m) =>
          m.recentCalls.map(
            (c) =>
              `  - ${m.supplier.name} (org: ${c.organizationName}, quote ${c.quoteNumber || 'N/A'}: ${c.quoteTitle || 'untitled'}, parts: ${c.parts.slice(0, 3).join(', ')}, called by ${c.callerUserName || 'unknown'} on ${c.startedAt.toString().slice(0, 10)})`
          )
        )
        .join('\n');

      return `${base}

Caller ID matched. Recent calls to this number:
${summary}

Greet warmly and confirm they're calling about one of these recent quotes.`;
    }

    case 'confirm_context': {
      if (!state.selectedCall) return base;
      return `${base}

You've identified this call as: ${state.selectedCall.organizationName} → quote ${state.selectedCall.quoteNumber} (${state.selectedCall.quoteTitle}) → originally called by ${state.selectedCall.callerUserName}.

Confirm with the caller: "Just to confirm, are you calling about the [quote title] for [parts]?"

If they say yes → set node to offer_routing.
If they say no → set node to disambiguate_quote (if there are other matches) or qualify_unknown.`;
    }

    case 'disambiguate_org': {
      const orgs = Array.from(new Set(state.matches.flatMap((m) => m.recentCalls.map((c) => c.organizationName))));
      return `${base}

Multiple organizations have called this supplier recently. Ask the caller which one they're calling for.

Organizations: ${orgs.join(', ')}

Example: "I see we've spoken with you on behalf of a few different companies. Are you calling for ${orgs.slice(0, 2).join(' or ')}?"`;
    }

    case 'disambiguate_quote': {
      if (!state.selectedOrgId) return base;
      const orgCalls = state.matches.flatMap((m) =>
        m.recentCalls.filter((c) => c.organizationId === state.selectedOrgId)
      );
      const summary = orgCalls
        .map((c) => `  - Quote ${c.quoteNumber}: ${c.quoteTitle} (parts: ${c.parts.slice(0, 3).join(', ')})`)
        .join('\n');
      return `${base}

Multiple recent quotes from this org. Ask which one:
${summary}

Example: "Are you calling about the quote for [parts1] or the one for [parts2]?"`;
    }

    case 'qualify_unknown': {
      return `${base}

Caller wasn't identified by phone. Ask their name, company, and what they're calling about. Try to fuzzy-match the company name to a supplier in our system.

Example: "Thanks for calling PartsIQ. May I ask who's calling and what company you're with?"`;
    }

    case 'offer_routing': {
      if (!state.selectedCall) return base;
      const userName = state.selectedCall.callerUserName || 'the team member';
      const partsList = state.selectedCall.parts.slice(0, 3).join(', ');

      if (state.isAfterHours) {
        return `${base}

It's after business hours. Don't offer human transfer. Instead offer:
1. Continue with our AI agent who has the full quote context
2. Leave a message and we'll call back

Example: "Since it's after hours, I can either connect you to our AI agent who has the full quote details, or take a message. Which would you prefer?"`;
      }

      return `${base}

Offer two options:
1. Connect to ${userName} (warm transfer to their phone)
2. Continue with AI agent who has full quote context

Example: "I can either connect you with ${userName}, or our AI agent can pick up where we left off on the quote for ${partsList}. Which would you prefer?"`;
    }

    case 'transfer_to_human': {
      if (!state.selectedCall?.callerUserPhone) return base;
      return `${base}

Transferring caller to ${state.selectedCall.callerUserName} at ${state.selectedCall.callerUserPhone}.

Say briefly: "One moment, connecting you now." Then call the transferCall function with destination ${state.selectedCall.callerUserPhone}.`;
    }

    case 'transfer_to_agent': {
      return `${base}

Routing caller back to our AI agent for the quote. Say briefly: "Connecting you to our agent now, one moment." Then call the transferCall function.`;
    }

    case 'take_message': {
      const collected = state.message;
      const missing = [];
      if (!collected.callerName) missing.push('name');
      if (!collected.callerCompany) missing.push('company');
      if (!collected.callbackNumber) missing.push('callback number');

      if (missing.length === 0) {
        return `${base}

You've collected all the info needed. Thank them and end the call:
"Got it, thanks. We'll be in touch shortly. Have a great day."

Then call the endCall function.`;
      }

      return `${base}

Take a message. Still need: ${missing.join(', ')}.

Already collected: ${JSON.stringify(collected)}

Ask conversationally for the next missing piece.`;
    }

    case 'end_call': {
      return `${base}

Call is ending. Say goodbye briefly and call the endCall function.`;
    }

    default:
      return base;
  }
}

export const RECEPTIONIST_TOOLS = [
  {
    type: 'function',
    function: {
      name: 'transferCall',
      description: 'Transfer the caller to a phone number via warm transfer.',
      parameters: {
        type: 'object',
        properties: {
          destination: {
            type: 'string',
            description: 'E.164 phone number to transfer to',
          },
        },
        required: ['destination'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'endCall',
      description: 'End the call after taking a message or saying goodbye.',
      parameters: { type: 'object', properties: {} },
    },
  },
  {
    type: 'function',
    function: {
      name: 'updateState',
      description: 'Update the receptionist state (current node, selected org/call, message fields).',
      parameters: {
        type: 'object',
        properties: {
          currentNode: {
            type: 'string',
            enum: [
              'identify_caller',
              'confirm_context',
              'disambiguate_org',
              'disambiguate_quote',
              'qualify_unknown',
              'offer_routing',
              'transfer_to_human',
              'transfer_to_agent',
              'take_message',
              'end_call',
            ],
          },
          selectedOrgId: { type: 'string' },
          selectedCallId: { type: 'string', description: 'callId from matches.recentCalls to select' },
          routingChoice: { type: 'string', enum: ['human', 'agent'] },
          messageCallerName: { type: 'string' },
          messageCallerCompany: { type: 'string' },
          messageReason: { type: 'string' },
          messageCallbackNumber: { type: 'string' },
        },
      },
    },
  },
];
