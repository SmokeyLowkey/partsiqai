// Prompt templates for all workflows

export interface QuoteRequestData {
  supplier: {
    name: string;
    email: string;
  };
  items: Array<{
    partNumber: string;
    description: string;
    quantity: number;
  }>;
  vehicle: {
    make: string;
    model: string;
    year: number;
    serialNumber?: string;
  };
  organizationName?: string;
}

export interface OrderConfirmationData {
  orderNumber: string;
  supplier: {
    name: string;
  };
  items: Array<{
    partNumber: string;
    description: string;
    quantity: number;
    unitPrice: number;
  }>;
  total: number;
  vehicle?: {
    make: string;
    model: string;
  };
}

export const PROMPTS = {
  // Generate professional quote request email
  GENERATE_QUOTE_EMAIL: (data: QuoteRequestData) => `
You are a professional procurement specialist writing a quote request email to a parts supplier.

Write a professional, concise email requesting a quote for the following parts:

Supplier: ${data.supplier.name}
Vehicle: ${data.vehicle.year} ${data.vehicle.make} ${data.vehicle.model}${
    data.vehicle.serialNumber ? ` (S/N: ${data.vehicle.serialNumber})` : ''
  }

Parts Requested:
${data.items
  .map(
    (item, i) =>
      `${i + 1}. Part #${item.partNumber} - ${item.description} (Qty: ${item.quantity})`
  )
  .join('\n')}

Include:
- A friendly greeting
- Clear request for pricing, availability, and lead time
- Request for alternative parts if exact match unavailable
- Professional closing with contact information

Keep the tone professional but approachable. Do not use overly formal language.
Output only the email body (no subject line).
`,

  // Extract pricing information from supplier email
  EXTRACT_QUOTE_PRICING: (emailBody: string) => `
Extract pricing and availability information from this supplier quote email.

Email content:
${emailBody}

Extract the following information for each part mentioned:
- Part number
- Description (if provided)
- Unit price
- Total price (if different from unit price * quantity)
- Quantity
- Lead time (in days, if mentioned)
- Availability status (in_stock, backordered, special_order, or unknown)
- Any notes from the supplier

Return the data in JSON format with this structure:
{
  "items": [
    {
      "partNumber": "string",
      "description": "string",
      "unitPrice": number,
      "totalPrice": number,
      "quantity": number,
      "leadTime": number,
      "availability": "in_stock" | "backordered" | "special_order" | "unknown",
      "notes": "string"
    }
  ],
  "generalNotes": "string"
}

If pricing information is not clear or not provided, set values to null.
`,

  // Generate order confirmation email
  GENERATE_ORDER_CONFIRMATION: (data: OrderConfirmationData) => `
You are a professional procurement specialist writing an order confirmation email to a parts supplier.

Write a professional order confirmation email with the following details:

Order Number: ${data.orderNumber}
Supplier: ${data.supplier.name}
${data.vehicle ? `Vehicle: ${data.vehicle.make} ${data.vehicle.model}` : ''}

Items Ordered:
${data.items
  .map(
    (item, i) =>
      `${i + 1}. Part #${item.partNumber} - ${item.description}
   Quantity: ${item.quantity}
   Unit Price: $${item.unitPrice.toFixed(2)}
   Subtotal: $${(item.quantity * item.unitPrice).toFixed(2)}`
  )
  .join('\n\n')}

Total Order Value: $${data.total.toFixed(2)}

Include:
- Confirmation that the order has been placed
- Request for order acknowledgment
- Request for tracking information when shipped
- Professional closing

Keep the tone professional and clear.
Output only the email body (no subject line).
`,

  // Generate follow-up email for pending quotes
  GENERATE_FOLLOW_UP: (data: { thread: any; context: any[] }) => `
You are a professional procurement specialist writing a follow-up email to a supplier.

Original email thread summary:
Subject: ${data.thread.subject}
Sent to: ${data.thread.supplier?.name || 'Supplier'}
Days since sent: ${Math.floor(
    (Date.now() - new Date(data.thread.updatedAt).getTime()) / (1000 * 60 * 60 * 24)
  )}

Recent messages in thread:
${data.context
  .map(
    (msg: any) =>
      `${msg.direction === 'OUTBOUND' ? 'We wrote' : 'They wrote'}: ${msg.subject || ''}`
  )
  .join('\n')}

Write a polite follow-up email that:
- References the original request
- Politely asks for an update on the quote
- Remains professional and friendly
- Doesn't sound pushy or demanding

Keep it brief and to the point.
Output only the email body (no subject line).
`,

  // Analyze parts search query and extract intent
  ANALYZE_PARTS_QUERY: (query: string, vehicleContext?: any) => `
Analyze this parts search query and extract structured information for a heavy equipment parts search system.

Query: "${query}"
${vehicleContext ? `Vehicle: ${vehicleContext.year} ${vehicleContext.make} ${vehicleContext.model}` : ''}

Extract:
1. Part types mentioned (e.g., "filter", "belt", "gasket", "hydraulic pump")
2. Part numbers if mentioned (e.g., "123-456", "ABC789", "RE54321", "AT-123456")
3. Specific attributes (e.g., "hydraulic", "front", "left", "OEM", "aftermarket", "genuine")
4. Urgency indicators (e.g., "urgent", "asap", "emergency", "machine down")
5. Search intent: exact_part_number, part_description, compatibility_check, alternatives, general_question
6. Expanded terms — synonyms and alternative names for the part type in heavy equipment context.
   For example: "fuel filter" → ["fuel element", "fuel strainer", "fuel filtration element"]
   "belt" → ["drive belt", "v-belt", "serpentine belt", "fan belt"]
   "gasket" → ["seal", "o-ring", "packing"]
7. shouldSearchWeb — true if the query is likely about a part not in an internal parts database
   (e.g., asking about pricing, suppliers, specifications, or very specific/obscure part numbers)
8. partIntents — ONLY if multiple part types or part numbers are mentioned in the query,
   return an array where each entry represents ONE distinct part the user is looking for.
   Each entry has its own focused search text and synonyms specific to THAT part only.
   Example for "I need a fuel filter and an oil filter":
   [
     { "label": "Fuel Filter", "queryText": "fuel filter", "partType": "fuel filter", "partNumber": null, "expandedTerms": ["fuel element", "fuel strainer"] },
     { "label": "Oil Filter", "queryText": "oil filter", "partType": "oil filter", "partNumber": null, "expandedTerms": ["oil element", "lube filter"] }
   ]
   For single-part queries, omit this field entirely.

Return JSON:
{
  "partTypes": ["string"],
  "partNumbers": ["string"],
  "attributes": ["string"],
  "urgent": boolean,
  "intent": "exact_part_number" | "part_description" | "compatibility_check" | "alternatives" | "general_question",
  "processedQuery": "cleaned and standardized query string optimized for search",
  "expandedTerms": ["synonym1", "synonym2"],
  "shouldSearchWeb": boolean,
  "partIntents": [{ "label": "string", "queryText": "string", "partType": "string or null", "partNumber": "string or null", "expandedTerms": ["string"] }]
}
`,

  // Synthesize multi-agent search results (based on n8n Parallel Agent workflow)
  SYNTHESIZE_SEARCH_RESULTS: (
    chatInput: {
      originalQuery: string;
      agentResponses: {
        database: {
          answer: string;
          results: any[];
          metadata: { confidence: number; result_count: number };
        };
        graph_rag: {
          answer: string;
          related_parts: any[];
          metadata: { confidence: number; has_relationships: boolean };
        };
        hybrid_rag: {
          answer: string;
          similar_parts: any[];
          metadata: { confidence: number; result_count: number };
        };
      };
      totalPartsFound: number;
    }
  ) => `
# Parts Search Synthesis Agent

You are a parts specialist AI agent responsible for synthesizing search results from multiple data sources into a structured, actionable response.

## Input Data

**Original Query:** "${chatInput.originalQuery}"

**Agent Responses:**

**Database Agent (PostgreSQL):**
- Answer: ${chatInput.agentResponses.database.answer}
- Confidence: ${chatInput.agentResponses.database.metadata.confidence}
- Results Found: ${chatInput.agentResponses.database.metadata.result_count}
- Parts Data:
${JSON.stringify(chatInput.agentResponses.database.results, null, 2)}

**Graph RAG Agent (Neo4j):**
- Answer: ${chatInput.agentResponses.graph_rag.answer}
- Confidence: ${chatInput.agentResponses.graph_rag.metadata.confidence}
- Has Relationships: ${chatInput.agentResponses.graph_rag.metadata.has_relationships}
- Related Parts:
${JSON.stringify(chatInput.agentResponses.graph_rag.related_parts, null, 2)}

**Hybrid RAG Agent (Pinecone):**
- Answer: ${chatInput.agentResponses.hybrid_rag.answer}
- Confidence: ${chatInput.agentResponses.hybrid_rag.metadata.confidence}
- Results Found: ${chatInput.agentResponses.hybrid_rag.metadata.result_count}
- Similar Parts:
${JSON.stringify(chatInput.agentResponses.hybrid_rag.similar_parts, null, 2)}

**Total Parts Found:** ${chatInput.totalPartsFound}

## Your Task

**CRITICAL:** Evaluate whether the returned parts actually match what the user asked for in their query: "${chatInput.originalQuery}"

Analyze all agent responses and determine:
1. **Do the results match the user's intent?** (e.g., if they asked for "oil filter", do the parts include oil filters?)
2. **Calculate match confidence (0-100)** based on:
   - Exact part number match: 90-100
   - Category/type match: 70-89
   - Description similarity: 50-69
   - Weak/tangential match: 30-49
   - No match/irrelevant: 0-29
3. **Rank by relevance** - Parts found by multiple agents get higher confidence
4. **Extract useful filters** from the available data
5. **Suggest related queries** to help user refine search

## Output Format (REQUIRED)

Return valid JSON in this exact structure:

\`\`\`json
{
  "results": [
    {
      "partNumber": "string",
      "description": "string",
      "matchConfidence": 0-100,
      "price": number or null,
      "availability": "string or null",
      "compatibility": ["string"]
    }
  ],
  "suggestedFilters": [
    {
      "type": "category|brand|price|compatibility",
      "value": "string",
      "count": number
    }
  ],
  "relatedQueries": [
    "string"
  ],
  "conversationNextSteps": [
    "string"
  ]
}
\`\`\`

## Processing Guidelines

### 1. Match Confidence Calculation
- **Database match (structured data):** Base score 80-100
- **Graph relationship:** Add +15 if found via relationships
- **Semantic match:** Add +10 if semantically similar
- **Multiple sources:** Multiply by 1.2-1.5 if found in 2+ sources
- **Query relevance:** Reduce by 50% if part doesn't match user's query intent

### 2. Handle No Results Scenario
If totalPartsFound === 0 or all results are irrelevant:
- Extract any mentioned part numbers from agent answers
- Provide helpful next steps
- Suggest broader search terms

### 3. Generate Helpful Filters
Based on available data:
- Category filters (e.g., "Engine Filters")
- Brand filters (e.g., "John Deere OEM")
- Price ranges (e.g., "Under $50")
- Compatibility (e.g., "Fits 333G")

### 4. Related Queries
Suggest queries that might help the user:
- Specific part numbers found
- Alternative part types
- Broader categories
- Related parts (e.g., "air filter" if they searched for "oil filter")

### 5. Conversation Next Steps
Provide actionable next steps:
- If parts found: "View details for [part]", "Compare prices"
- If no exact match: "Try broader search", "Contact dealer"
- If partial match: "Refine search with [suggestion]"

## Important Rules

1. **Always return valid JSON** - no markdown explanations outside the JSON
2. **Evaluate relevance critically** - don't return parts that don't match the query
3. **Confidence must be 0-100** - use the scoring guidelines
4. **Be helpful even with no results** - provide actionable next steps
5. **Extract value from all agents** - consider insights from all three sources

Return only the JSON object, nothing else.
`,

  // Extract structured parts info from web search snippets
  EXTRACT_WEB_PARTS_INFO: (query: string, searchResults: Array<{ title: string; link: string; snippet: string }>) => `
You are a heavy equipment parts specialist. Extract structured parts information from these web search results.

Original search query: "${query}"

Web search results:
${searchResults.map((r, i) => `${i + 1}. Title: ${r.title}
   URL: ${r.link}
   Snippet: ${r.snippet}`).join('\n\n')}

For each result that contains relevant parts information, extract:
- partNumber: The part number mentioned (if any)
- description: A brief description of the part
- price: The price mentioned (if any, as a number without $ sign)
- sourceName: The website/supplier name
- sourceUrl: The URL
- snippet: The most relevant snippet text
- relevanceScore: 0-100 how relevant this result is to the query

Only include results that are actually about parts. Skip irrelevant results.

Return JSON:
{
  "extractedParts": [
    {
      "partNumber": "string or null",
      "description": "string",
      "price": number or null,
      "sourceName": "string",
      "sourceUrl": "string",
      "snippet": "string",
      "relevanceScore": number
    }
  ]
}
`,

  // Smart re-ranking of search results
  RERANK_RESULTS: (
    originalQuery: string,
    intent: string,
    vehicleContext: any,
    results: Array<{ partNumber: string; description: string; score: number; source: string; foundBy: string[]; isWebResult?: boolean }>
  ) => `
You are a heavy equipment parts search expert. Re-rank these search results by semantic relevance to the user's query.

Query: "${originalQuery}"
Intent: ${intent}
${vehicleContext ? `Vehicle: ${vehicleContext.year} ${vehicleContext.make} ${vehicleContext.model}` : 'No vehicle context'}

Results to re-rank (${results.length} total):
${results.map((r, i) => `${i + 1}. [${r.source}${r.isWebResult ? ' - WEB' : ''}] ${r.partNumber}: ${r.description} (score: ${r.score}, found by: ${r.foundBy.join(', ')})`).join('\n')}

For each result, evaluate:
1. How well does the part match what the user is looking for?
2. Is the part number relevant or just a coincidence?
3. Does the description match the query intent?
4. For web results: note they are unverified and may need confirmation

## Scoring Guidelines
- Exact part number match: 90-100
- Strong description + category match: 70-89
- Partial match (right category, wrong specifics): 50-69
- Weak/tangential match: 30-49
- Likely irrelevant: 0-29

Return JSON:
{
  "rankedResults": [
    {
      "partNumber": "string",
      "matchConfidence": number,
      "explanation": "Brief human-readable explanation of why this result matches or doesn't"
    }
  ],
  "suggestedFilters": ["string"],
  "relatedQueries": ["string"]
}

Rules:
- Return ALL results, re-ordered by matchConfidence (highest first)
- Every result must have an explanation
- For web results, add "Web source - may need verification" to explanation
- Be critical — don't give high scores to irrelevant results
- Return only the JSON object
`,
};
