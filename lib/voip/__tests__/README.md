# LangGraph Integration Tests

This directory contains comprehensive tests for the LangGraph VOIP integration.

## Test Files

### 1. **LangGraph Handler API Tests**
`app/api/voip/langgraph-handler/__tests__/route.test.ts`

Tests the custom LLM endpoint that Vapi calls during conversations:
- ✅ Processing supplier responses through LangGraph
- ✅ State machine progression
- ✅ Call completion and escalation handling
- ✅ Authentication and authorization
- ✅ Error handling and graceful degradation

### 2. **Calls API Tests**
`app/api/quote-requests/[id]/calls/__tests__/route.test.ts`

Tests the data transformation layer:
- ✅ LangGraph format → UI format transformation
- ✅ `conversationHistory` → `conversationLog` conversion
- ✅ LangGraph state extraction
- ✅ Backward compatibility with old formats
- ✅ Access control and authentication

### 3. **LangGraph Integration Tests**
`lib/voip/__tests__/langgraph-integration.test.ts`

Tests the state machine logic end-to-end:
- ✅ State initialization with custom context
- ✅ Conversation flow (greeting → quote_request → confirmation)
- ✅ Negotiation logic
- ✅ Escalation triggers
- ✅ Voicemail handling
- ✅ Custom context usage in greeting node

### 4. **Worker Tests (Extended)**
`workers/__tests__/voip-call-initiation-worker.test.ts`

Tests the worker's LangGraph configuration:
- ✅ Custom LLM provider configuration
- ✅ LangGraph handler URL setup
- ✅ Fallback model configuration
- ✅ Custom context passing to job data
- ✅ Custom instructions handling

## Running Tests

### Run All Tests
```bash
pnpm test
```

### Run Specific Test Suite
```bash
# LangGraph handler tests
pnpm test langgraph-handler

# Calls API tests
pnpm test calls/route.test

# Integration tests
pnpm test langgraph-integration

# Worker tests
pnpm test voip-call-initiation-worker
```

### Run with Coverage
```bash
pnpm test --coverage
```

### Watch Mode (for development)
```bash
pnpm test --watch
```

## Test Coverage

The tests cover the complete LangGraph integration flow:

```
1. Worker initiates call
   └─ Configures Vapi with custom-llm provider ✅
   └─ Passes custom context/instructions ✅
   └─ Points to langgraph-handler endpoint ✅

2. Vapi calls langgraph-handler
   └─ Authentication verified ✅
   └─ State retrieved from Redis ✅
   └─ Supplier message processed ✅
   └─ LangGraph state machine executed ✅
   └─ AI response generated ✅
   └─ State saved back to Redis ✅
   └─ Response returned to Vapi ✅

3. Webhook receives call events
   └─ Call started → Initialize state ✅
   └─ Custom context extracted ✅
   └─ State saved to Redis ✅

4. Call completes
   └─ Webhook processes end event ✅
   └─ Extracts quotes and conversation ✅
   └─ Saves to database ✅

5. UI fetches call data
   └─ API transforms data format ✅
   └─ LangGraph state extracted ✅
   └─ Returns formatted response ✅

6. UI displays results
   └─ Shows transcript with speakers ✅
   └─ Shows escalation flags ✅
   └─ Shows state flow path ✅
   └─ Shows negotiation history ✅
```

## Key Test Scenarios

### Successful Quote Flow
- Greeting → Quote Request → Quote Received → Confirmation
- Verifies: State transitions, quote extraction, conversation history

### Negotiation Flow
- Initial quote too high → Counter-offer → Negotiation (up to 2 attempts)
- Verifies: Negotiation attempts tracked, budget comparison logic

### Escalation Flow
- Complex request → Multiple clarification attempts → Human escalation
- Verifies: Escalation flags set, nextAction = 'human_followup'

### Voicemail Flow
- Call goes to voicemail → Leave message → Schedule email fallback
- Verifies: Voicemail detection, outcome tracking, nextAction = 'email_fallback'

### Custom Context Flow
- User provides custom greeting → Used in first message
- Verifies: Custom context overrides default, passed through state

## Mock Data Examples

### LangGraph State
```typescript
{
  callId: 'call_123',
  currentNode: 'confirmation',
  conversationHistory: [
    { speaker: 'ai', text: '...', timestamp: Date },
    { speaker: 'supplier', text: '...', timestamp: Date }
  ],
  quotes: [
    { partNumber: 'ABC123', price: 450, availability: 'in_stock' }
  ],
  needsHumanEscalation: false,
  negotiationAttempts: 1,
  status: 'completed'
}
```

### Transformed Call Data
```typescript
{
  conversationLog: [
    { role: 'assistant', content: '...', timestamp: '...' },
    { role: 'user', content: '...', timestamp: '...' }
  ],
  langGraphState: {
    currentNode: 'confirmation',
    needsHumanEscalation: false,
    negotiationAttempts: 1
  },
  extractedQuotes: [...],
  nextAction: 'none'
}
```

## Environment Variables for Tests

```bash
# Required
VOIP_WEBHOOK_SECRET=test-webhook-secret
CREDENTIALS_ENCRYPTION_KEY=test-secret-key-must-be-at-least-32-characters-long

# Optional
VAPI_PRIVATE_KEY=sk_test_...
VAPI_PHONE_NUMBER_ID=ph_test_...
NEXT_PUBLIC_APP_URL=http://localhost:3000
```

## Continuous Integration

These tests should run in CI/CD pipeline before deployment:

```yaml
# .github/workflows/test.yml
- name: Run LangGraph Tests
  run: |
    pnpm test langgraph-handler
    pnpm test calls/route.test
    pnpm test langgraph-integration
    pnpm test voip-call-initiation-worker
```

## Troubleshooting

### Redis Connection Errors
- Tests mock Redis using `ioredis` mock
- No actual Redis connection needed
- Check mock implementation if tests fail

### Auth Errors
- Tests mock `getServerSession` 
- Ensure mock returns expected user object
- Check organizationId matches test data

### Import Errors
- Use `await import()` for dynamic imports in tests
- Clear mocks between tests with `vi.clearAllMocks()`
- Mock all external dependencies

## Adding New Tests

When adding new LangGraph features:

1. **Add unit test** in appropriate file
2. **Add integration test** in `langgraph-integration.test.ts`
3. **Update this README** with new test scenario
4. **Verify coverage** remains above 80%

Example:
```typescript
it('should handle new feature', async () => {
  // Arrange
  const state = {...};
  
  // Act
  const result = await newFeature(state);
  
  // Assert
  expect(result).toBeDefined();
});
```

## Related Documentation

- [VOIP_FLOW_GAPS_AND_EDGE_CASES.md](../../../docs/VOIP_FLOW_GAPS_AND_EDGE_CASES.md)
- [lib/voip/call-graph.ts](../../../lib/voip/call-graph.ts) - State machine logic
- [lib/voip/types.ts](../../../lib/voip/types.ts) - Type definitions
- [app/api/voip/langgraph-handler/route.ts](../../../app/api/voip/langgraph-handler/route.ts) - Handler implementation
