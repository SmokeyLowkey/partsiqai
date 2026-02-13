# LangGraph Endpoint Testing

## Problem
VAPI is not calling the LangGraph custom LLM endpoint - no requests appear in Vercel logs.

## Diagnostic Steps

### 1. Test Endpoint Accessibility
```bash
# Test the endpoint directly
curl https://partsiqai.com/api/voip/langgraph-handler/chat/completions

# Expected: JSON response with status: "ok"
```

### 2. Verify VAPI Assistant Configuration
Go to VAPI Dashboard → Assistants → `8da0b27e-c6fe-4c60-9204-e6eea6164343`

**Model Settings Must Be:**
```
Provider: Custom llm
Custom LLM URL: https://partsiqai.com/api/voip/langgraph-handler
Model: (any name, e.g., "langgraph-v1")

Authorization Header:
Key: Authorization
Value: Bearer <your-VOIP_WEBHOOK_SECRET>
```

**Server Settings:**
```
Server URL: https://partsiqai.com/api/voip/webhooks
```

### 3. Check Vercel Logs During Next Call
After making a test call, check these logs:
1. Look for: `⚡ LangGraph handler endpoint hit - request received from VAPI`
2. If present: Endpoint is working, VAPI is calling it
3. If absent: VAPI is not calling the endpoint (configuration issue)

### 4. Common Issues

**Issue A: Custom LLM URL not configured**
- Assistant has no "Model" settings
- Or Model Provider is not "Custom llm"
- Solution: Configure custom LLM in VAPI dashboard

**Issue B: Wrong URL**
- URL missing `/api/voip/langgraph-handler`
- URL has extra `/chat/completions` (VAPI adds this automatically)
- Solution: Use exactly `https://partsiqai.com/api/voip/langgraph-handler`

**Issue C: Authorization failing**
- VAPI sends wrong auth header
- `VOIP_WEBHOOK_SECRET` not set in Vercel env vars
- Solution: Check auth header in VAPI matches env var

**Issue D: Assistant using built-in model instead**
- Assistant falls back to OpenAI/Anthropic when custom LLM fails
- This is why call works but doesn't use LangGraph
- Solution: Fix custom LLM configuration

### 5. What to Check in VAPI Dashboard

1. **Assistant → Model tab**:
   - ✅ Provider: "Custom llm"
   - ✅ URL: `https://partsiqai.com/api/voip/langgraph-handler`
   - ✅ Headers: Authorization header configured
   
2. **Assistant → Advanced tab**:
   - ✅ Server URL: `https://partsiqai.com/api/voip/webhooks`
   
3. **Test the assistant**:
   - Make a test call
   - Check if VAPI tries to call your custom LLM
   - Look for errors in VAPI's "Logs" tab

## Next Steps

1. Run the curl command to verify endpoint is accessible
2. Check VAPI assistant configuration (especially Model settings)
3. Make a test call and watch Vercel logs in real-time
4. If still no logs appear, the assistant isn't configured to use custom LLM
