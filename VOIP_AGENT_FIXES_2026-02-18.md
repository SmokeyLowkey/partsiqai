# VoIP Agent Fixes — 2026-02-18

## Reference Call Log

**File**: `json/call-logs-2026-02-18T02-43-18-187Z.json`
**Call ID**: `019c6e94-3570-7aa6-a754-9e87ec0982be`
**Duration**: ~3 minutes 42 seconds
**Scenario**: Outbound call to ACME Construction for price quote on AT331812 (Engine Wiring Harness) for 2019 John Deere 160GLC

### Call Outcome (Before Fixes)

**Complete failure.** The supplier provided a substitute part number (AT510302) and a price ($6,158.47), but the agent:

1. Mangled the part number via TTS ("T minus" instead of "A T")
2. Repeated the part number when asked "what machine is this going on?" instead of answering
3. Re-requested the part while the supplier was looking it up
4. Sent "Are you still there?" after only 14 seconds of silence
5. Mangled the substitute part number via TTS ("eighty five" instead of "A T five")
6. Ignored the supplier's price quote entirely
7. Recapped the original rejected part number instead of the substitute
8. Abruptly ended the call with zero quote data captured

---

## Issues Fixed

### CRITICAL: Routing Priority — Verification Questions Misclassified as Repeat Requests

**File**: `lib/voip/call-graph.ts` — `routeFromQuoteRequest()`

**Problem**: `isAskingToRepeat()` was checked **before** `isVerificationQuestion()`. When the supplier asked "what machine is this going on?", the word "what" partially matched repeat-detection patterns, so the agent re-stated the part number instead of answering with the machine info.

**Fix**: Reordered checks so `isVerificationQuestion()` runs first. Verification questions (serial number, machine model, fitment) are now always routed to `conversational_response` before repeat detection is evaluated.

**Call log reference**: At 63.9s the supplier asked "Ok. And what machine is this going on?" and the agent repeated the part number phonetically instead of providing the 2019 John Deere 160GLC details.

---

### CRITICAL: Pricing Extracted But Never Persisted to State

**File**: `lib/voip/call-graph.ts` — `routeFromQuoteRequest()`

**Problem**: `routeFromQuoteRequest()` called `extractPricing()` to check if the supplier's response contained pricing, but the extracted quotes were local variables — they were discarded after routing. The function then returned `nextNodeAfterPricing(state)` which went to `confirmation`, but `confirmationNode` saw an empty `state.quotes` and ended the call.

**Fix**: Changed both pricing detection paths in `routeFromQuoteRequest()` to route to `price_extract` instead of `confirmation`/`nextNodeAfterPricing`. The `price_extract` node properly calls `extractPricing()` and persists results to state. Also added a missing `case 'price_extract':` in the routing switch that determines what node follows price extraction.

**Call log reference**: At ~194s the supplier quoted "$6,158.47" for AT510302. The agent's response at ~205s ignored this entirely and recapped the wrong part number.

---

### CRITICAL: Substitute Parts Not Tracked in State

**File**: `lib/voip/call-graph.ts` — new `mergeExtractedQuotes()` function

**Problem**: When the supplier said "the correct part number is AT510302" (a substitute for AT331812), the new part was never added to `state.parts[]`. The recap, confirmation, and pricing logic all only knew about the original AT331812.

**Fix**: Added `mergeExtractedQuotes()` helper that:
- Merges extracted quotes into `state.quotes` (deduplicating by part number)
- When a quote has `isSubstitute: true`, adds the substitute part number to `state.parts[]` (copying description/quantity from the original part)
- Updated `priceExtractNode`, `conversational_response` routing, and `quoteRequestNode` recap to use this function

**Call log reference**: The supplier provided substitute AT510302 at ~174s. The agent never tracked it and continued referring to original AT331812.

---

### HIGH: No Hold-Pattern Detection in `routeFromQuoteRequest`

**File**: `lib/voip/call-graph.ts` — `routeFromQuoteRequest()`

**Problem**: Hold patterns ("just a moment", "let me check", "one second") were only detected in `routeFromGreeting()`. When the supplier said "Okay. Just a moment." while looking up a part, `routeFromQuoteRequest()` didn't recognize it and the agent re-stated the part request ~9 seconds later.

**Fix**: Added comprehensive hold-pattern detection early in `routeFromQuoteRequest()` with patterns including: "one moment", "just a moment", "hold on", "let me check", "let me look", "bear with me", "checking on that", etc. These now route to `hold_acknowledgment`.

Also added hold-pattern detection in the `conversational_response` routing block for the same reason.

**Call log reference**: At 99.6s the supplier said "Okay. Just a moment." At 108.1s (~9 seconds later) the agent re-requested the part number.

---

### HIGH: `holdAcknowledgmentNode` Always Set `waitingForTransfer`

**File**: `lib/voip/call-graph.ts` — `holdAcknowledgmentNode()`

**Problem**: The hold node always set `waitingForTransfer: true`, which caused it to route back to `greeting` after the hold. When coming from `quote_request` (supplier is just looking something up), this was wrong — the agent should stay in the conversation, not re-greet.

**Fix**: `holdAcknowledgmentNode` now checks `state.currentNode` — only sets `waitingForTransfer` when coming from `greeting` or `transfer` nodes (actual transfers). Routing after `hold_acknowledgment` now goes to `greeting` for transfers or `conversational_response` for lookups.

---

### HIGH: TTS Mangled Part Numbers in Free-Form LLM Responses

**Files**: `lib/voip/helpers.ts` — new `formatPartNumbersInText()`, `lib/voip/call-graph.ts` — `conversationalResponseNode()`

**Problem**: The `conversationalResponseNode` uses an LLM to generate free-form text. The LLM would output raw part numbers like "AT331812" or "AT510302" which ElevenLabs TTS mispronounced as "T minus three three..." or "eighty five one zero three zero two".

The scripted nodes (`quoteRequestNode`) already used `formatPartNumberForSpeech()` to format "AT331812" → "A T, 3 3 1 8 1 2", but the conversational node did not.

**Fix**: Added `formatPartNumbersInText()` helper that:
- Replaces known part numbers with TTS-safe formatted versions
- Catches spaced-out variations ("A T 3 3 1 8 1 2")
- Catches unknown part-number-like patterns (letters + digits, e.g., substitute part numbers the LLM mentions that aren't in `state.parts` yet)

The `conversationalResponseNode` now runs all LLM output through this function before adding to state.

**Call log reference**: At ~39s the agent said "one T minus three three one eight one two" instead of "A T, 3 3 1 8 1 2". At ~181s the agent said "eighty five one zero three zero two" instead of "A T, 5 1 0 3 0 2".

---

### MEDIUM: `confirmationNode` Abruptly Ended Call With No Quotes

**File**: `lib/voip/call-graph.ts` — `confirmationNode()`

**Problem**: When `state.quotes` was empty (because pricing was never persisted — see above), the confirmation node immediately said "Thank you for your time. We'll follow up via email" and set `status: 'completed'`, ending the call. This happened even when the supplier had been actively engaged and providing information.

**Fix**: Added a check for conversation depth — if there have been more than 3 supplier messages (indicating an engaged conversation), the agent now asks the supplier to send a formal quote via email instead of abruptly hanging up. Also added TTS-safe formatting for part numbers in the quote summary, and substitute part annotations (e.g., "A T, 5 1 0 3 0 2 (replacing A T, 3 3 1 8 1 2)").

**Call log reference**: At ~215s the agent said "Thank you for your time. We'll follow up via email with the details." and hung up, despite the supplier having just given a $6,158.47 quote.

---

### MEDIUM: Quote Request Recap Used Original Part Numbers After Substitution

**File**: `lib/voip/call-graph.ts` — `quoteRequestNode()`

**Problem**: When recapping all parts ("So those were: ..."), the node listed all entries from `state.parts` including original part numbers that had been superseded by substitutes. This confused the supplier.

**Fix**: The recap now filters out original part numbers that have been replaced by substitutes (tracked via `state.quotes[].isSubstitute` and `originalPartNumber`). Only the active/current part numbers are included in the recap.

---

### MEDIUM: Substitute Part Detection Routes to Price Extract

**File**: `lib/voip/call-graph.ts` — `routeFromQuoteRequest()`

**Problem**: When the supplier mentioned a substitute part ("the updated part number is AT510302"), there was no special handling in `routeFromQuoteRequest()`.

**Fix**: Added `detectSubstitute()` check in `routeFromQuoteRequest()`. When a substitute is detected, routes to `price_extract` which uses the enhanced `extractPricing()` prompt (already supports `isSubstitute` and `originalPartNumber` fields) and `mergeExtractedQuotes()` to persist both the substitute part and any associated pricing.

---

### HIGH: ElevenLabs Misreads Single-Letter Spelling — NATO Phonetic Words

**File**: `lib/voip/helpers.ts` — `formatPartNumberForSpeech()`

**Problem**: The original TTS formatting spelled letters individually: "AT331812" → "A T, 3 3 1 8 1 2". ElevenLabs consistently misread "A T" as "eighty" across 5 out of 7 calls analyzed. Other letter combinations were similarly garbled ("eighty three", "eighty facial months").

**Fix**: Changed `formatPartNumberForSpeech()` to use NATO phonetic words instead of single letters. "AT331812" now becomes "Alpha Tango, 3 3 1 8 1 2". The `TTS_LETTER_NAMES` constant is shared with `formatPartNumberPhonetic()` to avoid duplication.

**Cross-call reference**: Calls at 09:23:11, 09:59:03, 10:26:50, 11:19:15, and 14:32:02 all exhibited TTS mangling of single-letter part number prefixes.

---

## Files Changed

| File | Changes |
|------|---------|
| `lib/voip/call-graph.ts` | Reordered routing checks, added hold detection, substitute tracking, TTS formatting, pricing persistence, confirmationNode improvements, greeting deduplication |
| `lib/voip/helpers.ts` | Added `formatPartNumbersInText()`, `stripSSML()`, NATO phonetic TTS, availability post-validation, deduplicated constants |

## Summary of Behavioral Changes

| Before | After |
|--------|-------|
| "What machine?" → repeats part number | "What machine?" → answers with vehicle info |
| "Just a moment" → re-requests part | "Just a moment" → "Sure, no problem! Take your time." |
| Substitute part numbers ignored | Substitute parts tracked in state, used in recap/confirmation |
| LLM responses have raw part numbers TTS mangles | All part numbers in LLM output formatted for TTS clarity |
| Pricing extracted but discarded in routing | Pricing always routed through `price_extract` for persistence |
| Empty quotes → abrupt hangup | Empty quotes with engaged supplier → asks for email quote |
| Recap includes superseded part numbers | Recap shows only current/active part numbers |
| "A T" read as "eighty" by ElevenLabs | "Alpha Tango" — unambiguous NATO phonetic words |

---

## Cross-Call Validation (7 Previous Calls)

All 7 previous call logs were analyzed to verify the fixes address real failures observed across the call corpus.

| Call Time | Outcome | Issues Observed | Fixes Validated |
|-----------|---------|-----------------|-----------------|
| 07:50:38 | FAILED | Agent ended call after supplier confirmed "This is parts" | #6 (abrupt ending) |
| 07:52:34 | FAILED | Voicemail not detected, wasted 80s talking to machine | #6 (ending logic) |
| 09:23:11 | FAILED | TTS mangled "AT" as "eighty three", ended when asked for serial number | #1, #4, #6 |
| 09:59:03 | PARTIAL | $197.76 captured but SSML tags vocalized, unnecessary recap | #4, #5 |
| 10:26:50 | FAILED | Parts dept asked 3x, talked during holds, ended on account question, $890.90 lost | #1, #2, #4, #6 |
| 11:19:15 | FAILED | Price acknowledged but marked "unavailable" when in stock, ended while supplier corrected | #2, #5, #6 |
| 14:32:02 | FAILED | 7+ min call, rejected substitutes 3x, TTS "eighty facial months", ended during pricing | #3, #4, #5, #6 |

### Fix Coverage

| Fix | Description | Calls Affected |
|-----|-------------|---------------|
| #1 | Routing priority (verification before repeat) | 3/7 |
| #2 | Hold-pattern detection | 3/7 |
| #3 | Substitute part tracking | 1/7 |
| #4 | TTS formatting (NATO phonetic) | **5/7** |
| #5 | Pricing persistence | 3/7 |
| #6 | Abrupt call ending | **6/7** |

### Previously Remaining Issues — Now Fixed

#### Fix #7: SSML Tag Vocalization Safety Net

**File**: `lib/voip/helpers.ts` — `addMessage()`, new `stripSSML()`

**Problem**: The pre-fix code used `<break time="300ms"/>` SSML tags for pauses. ElevenLabs read these as literal words: "break time three tonacious" / "break time three hundred minutes." While the main fix (replacing `<break>` with `...` in node messages) was already applied, the LLM in `conversationalResponseNode` could still potentially generate SSML.

**Fix**: Added `stripSSML()` function that strips all XML/SSML tags from text, replacing `<break>` with commas (natural pauses). Applied automatically in `addMessage()` for all AI speaker messages — a catch-all safety net.

#### Fix #8: Repeated Greeting After Transfer/Hold

**File**: `lib/voip/call-graph.ts` — `greetingNode()`

**Problem**: After hold/transfer cycles, the agent could loop back to `greeting` and ask "Could I speak to someone in your parts department?" multiple times — even after the supplier already confirmed they were in parts.

**Fix**: Added an `alreadyInQuoteFlow` check in `greetingNode()`. If the conversation history shows the agent has already progressed to the quote request stage (said "I'm looking for..." or "part number is..."), the greeting node always uses the brief re-intro ("Hi there! Thanks for taking my call.") instead of re-asking for the parts department.

**Cross-call reference**: Call at 10:26:50 — agent asked for parts department 3 times despite already speaking to it.

#### Fix #9: Incorrect Availability Marking

**File**: `lib/voip/helpers.ts` — `extractPricing()`

**Problem**: The supplier said "looks like we do have a couple on stock here" and quoted $130.58, but the LLM marked availability as "unavailable." The prompt listed "in stock" and "couple in stock" but missed variations like "on stock", "we do have", etc.

**Fix**: Two-layer defense:
1. **Stronger prompt**: Expanded availability rules with comprehensive phrase lists for each category. Added explicit rule: "NEVER mark as unavailable if the supplier gave a price."
2. **Post-extraction validation**: After LLM returns quotes, keyword-scans the supplier's text and recent history. If "in stock"/"on stock"/"have them"/etc. appear but LLM marked "unavailable", overrides to "in_stock". If a price exists but availability is "unavailable", overrides to "backorder."

**Cross-call reference**: Call at 11:19:15 — supplier said "couple on stock" with $130.58 price, agent said "unavailable" in confirmation.

---

## Post-Deploy Fix: Substitute Part Numbers Without Pricing (2026-02-18 Call)

**Reference Call**: `json/call-logs-2026-02-18T04-05-48-697Z.json`
**Call ID**: `019c6ee7-5802-7556-8478-7a12b654b972`
**Scenario**: Agent requested 101-24109 (alternator for 2022 Peterbilt 367). Supplier verified via serial number, determined part doesn't match, offered substitute D27-1016-0160P. Agent ignored it 4 times and re-asked about the original.

### Root Cause: No Mechanism to Record Substitutes Without Pricing

The only way to record a substitute was through `extractPricing()`, which returns `[]` when no price is mentioned. Suppliers typically give the part number first, THEN the price — so the substitute was never recorded, and the `conversationalResponseNode` LLM kept falling back to "verify 101-24109."

### Fix #10: `extractSubstituteInfo()` — Capture Part Numbers Without Pricing

**File**: `lib/voip/helpers.ts` — new `extractSubstituteInfo()`

Added a lightweight LLM function that extracts substitute part numbers even when no pricing is given. It parses NATO phonetic alphabet from speech ("Delta two seven" → "D27", "Papa" → "P") and returns the substitute/original mapping.

### Fix #11: `priceExtractNode` Fallback to Substitute Extraction

**File**: `lib/voip/call-graph.ts` — `priceExtractNode()`

When `extractPricing()` returns nothing and the supplier's response contains substitute/fitment signals, the node now falls back to `extractSubstituteInfo()`. The extracted substitute is recorded in `state.quotes[]` and `state.parts[]` via `mergeExtractedQuotes()`, even without a price.

### Fix #12: Substitute-Aware `conversationalResponseNode`

**File**: `lib/voip/call-graph.ts` — `conversationalResponseNode()`

The LLM prompt now includes a "SUBSTITUTE PARTS ALREADY IDENTIFIED" section listing any substitutes from `state.quotes[]`. It explicitly tells the LLM: "Do NOT ask about the original part numbers — they have been superseded. Ask for pricing on the substitute." Also added rule: "NEVER ask the supplier to write down or email a part number."

### Fix #13: Smarter `hold_acknowledgment` Routing

**File**: `lib/voip/call-graph.ts` — `hold_acknowledgment` routing

Previously routed blindly to `conversational_response` after hold. Now checks the supplier's return message for substitute/fitment/pricing signals and routes to `price_extract` when appropriate — ensuring substitutes and prices aren't missed when the supplier returns from looking something up.

### Fix #14: Expanded `detectSubstitute()` Patterns

**File**: `lib/voip/helpers.ts` — `detectSubstitute()`

Added patterns for:
- Deepgram transcription errors: "new park number" (→ "new part number")
- Fitment-adjacent phrases: "doesn't match", "correct part", "current number"
- Combined fitment rejection + substitute detection in routing (both trigger `price_extract`)

### Fix #15: Unpriced Substitute Routing Edge Case

**File**: `lib/voip/call-graph.ts` — `price_extract` routing (line ~1035)

**Problem**: After recording a substitute without pricing, if `allPartsRequested` was false, the router would send the agent to `quote_request`. The `quote_request` node would then try to "give" the substitute part number back to the supplier — nonsensical since the supplier just provided it.

**Fix**: Added an `hasUnpricedSubstitute` check before the `allPartsRequested` branch. When there's a substitute awaiting pricing, route to `conversational_response` instead of `quote_request`, so the agent naturally asks "And what's the pricing on that?" rather than re-stating the part number.

```typescript
const hasUnpricedSubstitute = newState.quotes.some(q => q.isSubstitute && q.price == null);
if (hasUnpricedSubstitute) {
  nextNode = 'conversational_response';
} else {
  nextNode = newState.allPartsRequested ? 'conversational_response' : 'quote_request';
}
```
