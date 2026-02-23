import { describe, it, expect, vi } from 'vitest';
import { QueryUnderstandingAgent } from '../query-understanding';
import type { ProcessedQuery } from '../query-understanding';

describe('QueryUnderstandingAgent', () => {
  describe('regexFallback', () => {
    it('should detect exact part numbers in various formats', () => {
      // Format: XX-NNNNNNN
      const result1 = QueryUnderstandingAgent.regexFallback('I need part AT-123456');
      expect(result1.partNumbers).toContain('AT-123456');
      expect(result1.intent).toBe('exact_part_number');

      // Format: NNN-NNNNNN
      const result2 = QueryUnderstandingAgent.regexFallback('Looking for 123-45678');
      expect(result2.partNumbers).toContain('123-45678');
      expect(result2.intent).toBe('exact_part_number');

      // Format: XXNNNNNNN (no dash)
      const result3 = QueryUnderstandingAgent.regexFallback('Find RE54321 please');
      expect(result3.partNumbers).toContain('RE54321');
      expect(result3.intent).toBe('exact_part_number');
    });

    it('should detect multiple part numbers in a single query', () => {
      const result = QueryUnderstandingAgent.regexFallback('Compare AT-123456 and RE54321');
      expect(result.partNumbers).toContain('AT-123456');
      expect(result.partNumbers).toContain('RE54321');
      expect(result.intent).toBe('exact_part_number');
    });

    it('should detect part types and generate expanded terms', () => {
      const result = QueryUnderstandingAgent.regexFallback('I need a fuel filter for my excavator');
      expect(result.partTypes).toContain('fuel filter');
      expect(result.intent).toBe('part_description');
      expect(result.expandedTerms.length).toBeGreaterThan(0);
      expect(result.expandedTerms).toContain('fuel element');
      expect(result.expandedTerms).toContain('fuel strainer');
    });

    it('should detect filter as a general part type', () => {
      const result = QueryUnderstandingAgent.regexFallback('I need a filter');
      expect(result.partTypes).toContain('filter');
      expect(result.expandedTerms).toContain('filter element');
    });

    it('should detect hydraulic filter specifically', () => {
      const result = QueryUnderstandingAgent.regexFallback('hydraulic filter replacement');
      expect(result.partTypes).toContain('hydraulic filter');
      expect(result.expandedTerms).toContain('hydraulic element');
      expect(result.expandedTerms).toContain('hyd filter');
    });

    it('should detect part type from synonyms in query', () => {
      const result = QueryUnderstandingAgent.regexFallback('I need a fuel strainer');
      expect(result.partTypes).toContain('fuel filter');
      // Expanded terms should include other synonyms but not the one already in the query
      expect(result.expandedTerms).toContain('fuel element');
    });

    it('should detect attributes', () => {
      const result = QueryUnderstandingAgent.regexFallback('OEM front hydraulic pump');
      expect(result.attributes).toContain('oem');
      expect(result.attributes).toContain('front');
    });

    it('should detect urgency', () => {
      const urgentResult = QueryUnderstandingAgent.regexFallback('I need a belt URGENT machine down');
      expect(urgentResult.urgent).toBe(true);

      const normalResult = QueryUnderstandingAgent.regexFallback('I need a belt');
      expect(normalResult.urgent).toBe(false);
    });

    it('should detect compatibility_check intent', () => {
      const result = QueryUnderstandingAgent.regexFallback('Will this fit my 310G loader?');
      expect(result.intent).toBe('compatibility_check');
    });

    it('should detect alternatives intent', () => {
      // Use a query without a recognized part type, so alternatives keywords take precedence
      const result = QueryUnderstandingAgent.regexFallback('What is an alternative to this component?');
      expect(result.intent).toBe('alternatives');
    });

    it('should detect general_question intent for vague queries', () => {
      const result = QueryUnderstandingAgent.regexFallback('How do I maintain my excavator?');
      expect(result.intent).toBe('general_question');
    });

    it('should set shouldSearchWeb for price-related queries', () => {
      const result = QueryUnderstandingAgent.regexFallback('What is the price of AT-123456?');
      expect(result.shouldSearchWeb).toBe(true);
    });

    it('should set shouldSearchWeb for supplier queries', () => {
      const result = QueryUnderstandingAgent.regexFallback('Where to find a dealer for this part?');
      expect(result.shouldSearchWeb).toBe(true);
    });

    it('should set shouldSearchWeb when only part number detected (might not be in DB)', () => {
      const result = QueryUnderstandingAgent.regexFallback('RE54321');
      expect(result.shouldSearchWeb).toBe(true);
      expect(result.partNumbers).toContain('RE54321');
    });

    it('should preserve the original query', () => {
      const query = 'I need a fuel filter for my 310G';
      const result = QueryUnderstandingAgent.regexFallback(query);
      expect(result.originalQuery).toBe(query);
    });

    it('should handle empty query gracefully', () => {
      const result = QueryUnderstandingAgent.regexFallback('');
      expect(result.intent).toBe('general_question');
      expect(result.partNumbers).toEqual([]);
      expect(result.partTypes).toEqual([]);
      expect(result.expandedTerms).toEqual([]);
    });

    it('should build processedQuery from detected part numbers', () => {
      const result = QueryUnderstandingAgent.regexFallback('I need AT-123456 fuel filter');
      expect(result.processedQuery).toContain('AT-123456');
      expect(result.processedQuery).toContain('fuel filter');
    });

    it('should deduplicate part numbers', () => {
      const result = QueryUnderstandingAgent.regexFallback('AT-123456 vs AT-123456');
      const uniquePartNumbers = [...new Set(result.partNumbers)];
      expect(result.partNumbers.length).toBe(uniquePartNumbers.length);
    });

    it('should deduplicate expanded terms', () => {
      // "oil filter" and "filter" both expand; should not have duplicates
      const result = QueryUnderstandingAgent.regexFallback('oil filter');
      const uniqueTerms = [...new Set(result.expandedTerms)];
      expect(result.expandedTerms.length).toBe(uniqueTerms.length);
    });
  });

  describe('analyze (with LLM timeout/fallback)', () => {
    it('should fall back to regex when no LLM client provided', async () => {
      const result = await QueryUnderstandingAgent.analyze('fuel filter', undefined, null);
      expect(result.partTypes).toContain('fuel filter');
      expect(result.intent).toBe('part_description');
    });

    it('should fall back to regex when LLM times out', async () => {
      // Create a mock LLM client that takes too long
      const slowLlmClient = {
        generateStructuredOutput: vi.fn().mockImplementation(() =>
          new Promise(resolve => setTimeout(resolve, 5000))
        ),
      } as any;

      const result = await QueryUnderstandingAgent.analyze(
        'fuel filter',
        undefined,
        slowLlmClient,
        100 // 100ms timeout — LLM will not respond in time
      );

      // Should still get regex fallback results
      expect(result.partTypes).toContain('fuel filter');
      expect(result.intent).toBe('part_description');
    });

    it('should fall back to regex when LLM throws', async () => {
      const failingLlmClient = {
        generateStructuredOutput: vi.fn().mockRejectedValue(new Error('LLM error')),
      } as any;

      const result = await QueryUnderstandingAgent.analyze(
        'fuel filter',
        undefined,
        failingLlmClient
      );

      expect(result.partTypes).toContain('fuel filter');
    });

    it('should use LLM results when available', async () => {
      const mockLlmClient = {
        generateStructuredOutput: vi.fn().mockResolvedValue({
          partTypes: ['hydraulic pump'],
          partNumbers: [],
          attributes: ['high pressure'],
          urgent: false,
          intent: 'part_description',
          processedQuery: 'hydraulic pump high pressure',
          expandedTerms: ['hyd pump', 'hydraulic motor'],
          shouldSearchWeb: false,
        }),
      } as any;

      const result = await QueryUnderstandingAgent.analyze(
        'I need a high pressure hydraulic pump',
        undefined,
        mockLlmClient
      );

      expect(result.partTypes).toContain('hydraulic pump');
      expect(result.expandedTerms).toContain('hyd pump');
      expect(result.intent).toBe('part_description');
    });

    it('should build partIntents from LLM response when multiple parts detected', async () => {
      const mockLlmClient = {
        generateStructuredOutput: vi.fn().mockResolvedValue({
          partTypes: ['fuel filter', 'oil filter'],
          partNumbers: [],
          attributes: [],
          urgent: false,
          intent: 'part_description',
          processedQuery: 'fuel filter oil filter',
          expandedTerms: ['fuel element', 'oil element'],
          shouldSearchWeb: false,
        }),
      } as any;

      const result = await QueryUnderstandingAgent.analyze(
        'I need a fuel filter and an oil filter',
        undefined,
        mockLlmClient
      );

      expect(result.partIntents).toBeDefined();
      expect(result.partIntents!.length).toBe(2);
      expect(result.partIntents![0].label).toBe('Fuel Filter');
      expect(result.partIntents![0].queryText).toBe('fuel filter');
      expect(result.partIntents![0].partType).toBe('fuel filter');
      expect(result.partIntents![1].label).toBe('Oil Filter');
      expect(result.partIntents![1].queryText).toBe('oil filter');
    });

    it('should use LLM-provided partIntents directly when present', async () => {
      const mockLlmClient = {
        generateStructuredOutput: vi.fn().mockResolvedValue({
          partTypes: ['fuel filter', 'belt'],
          partNumbers: [],
          attributes: [],
          urgent: false,
          intent: 'part_description',
          processedQuery: 'fuel filter and belt',
          expandedTerms: ['fuel element', 'drive belt'],
          shouldSearchWeb: false,
          partIntents: [
            { label: 'Fuel Filter', queryText: 'fuel filter', partType: 'fuel filter', expandedTerms: ['fuel element', 'fuel strainer'] },
            { label: 'Drive Belt', queryText: 'belt', partType: 'belt', expandedTerms: ['drive belt', 'v-belt'] },
          ],
        }),
      } as any;

      const result = await QueryUnderstandingAgent.analyze(
        'I need a fuel filter and a belt',
        undefined,
        mockLlmClient
      );

      expect(result.partIntents).toBeDefined();
      expect(result.partIntents!.length).toBe(2);
      expect(result.partIntents![0].label).toBe('Fuel Filter');
      expect(result.partIntents![0].expandedTerms).toContain('fuel element');
      expect(result.partIntents![0].expandedTerms).toContain('fuel strainer');
      expect(result.partIntents![1].label).toBe('Drive Belt');
      expect(result.partIntents![1].expandedTerms).toContain('v-belt');
    });

    it('should not set partIntents for single-part LLM response', async () => {
      const mockLlmClient = {
        generateStructuredOutput: vi.fn().mockResolvedValue({
          partTypes: ['fuel filter'],
          partNumbers: [],
          attributes: [],
          urgent: false,
          intent: 'part_description',
          processedQuery: 'fuel filter',
          expandedTerms: ['fuel element'],
          shouldSearchWeb: false,
        }),
      } as any;

      const result = await QueryUnderstandingAgent.analyze(
        'I need a fuel filter',
        undefined,
        mockLlmClient
      );

      expect(result.partIntents).toBeUndefined();
    });
  });

  describe('buildPartIntents', () => {
    it('should return undefined for single part type', () => {
      const result = QueryUnderstandingAgent.buildPartIntents(['fuel filter'], []);
      expect(result).toBeUndefined();
    });

    it('should return undefined for single part number', () => {
      const result = QueryUnderstandingAgent.buildPartIntents([], ['AT-123456']);
      expect(result).toBeUndefined();
    });

    it('should return undefined for no parts at all', () => {
      const result = QueryUnderstandingAgent.buildPartIntents([], []);
      expect(result).toBeUndefined();
    });

    it('should build intents for multiple part types', () => {
      const result = QueryUnderstandingAgent.buildPartIntents(['fuel filter', 'oil filter'], []);

      expect(result).toBeDefined();
      expect(result!.length).toBe(2);

      expect(result![0].label).toBe('Fuel Filter');
      expect(result![0].queryText).toBe('fuel filter');
      expect(result![0].partType).toBe('fuel filter');
      expect(result![0].partNumber).toBeUndefined();
      expect(result![0].expandedTerms).toContain('fuel element');
      expect(result![0].expandedTerms).toContain('fuel strainer');

      expect(result![1].label).toBe('Oil Filter');
      expect(result![1].queryText).toBe('oil filter');
      expect(result![1].expandedTerms).toContain('oil element');
      expect(result![1].expandedTerms).toContain('lube filter');
    });

    it('should build intents for multiple part numbers', () => {
      const result = QueryUnderstandingAgent.buildPartIntents([], ['AT-123456', 'RE54321']);

      expect(result).toBeDefined();
      expect(result!.length).toBe(2);

      expect(result![0].label).toBe('AT-123456');
      expect(result![0].queryText).toBe('AT-123456');
      expect(result![0].partNumber).toBe('AT-123456');
      expect(result![0].partType).toBeUndefined();
      expect(result![0].expandedTerms).toEqual([]);

      expect(result![1].label).toBe('RE54321');
      expect(result![1].partNumber).toBe('RE54321');
    });

    it('should build intents for mixed part types and part numbers', () => {
      const result = QueryUnderstandingAgent.buildPartIntents(['fuel filter'], ['RE54321']);

      expect(result).toBeDefined();
      expect(result!.length).toBe(2);

      // First intent: part type
      expect(result![0].partType).toBe('fuel filter');
      expect(result![0].expandedTerms.length).toBeGreaterThan(0);

      // Second intent: part number
      expect(result![1].partNumber).toBe('RE54321');
      expect(result![1].expandedTerms).toEqual([]);
    });

    it('should title-case labels for part types', () => {
      const result = QueryUnderstandingAgent.buildPartIntents(['hydraulic filter', 'air filter'], []);

      expect(result![0].label).toBe('Hydraulic Filter');
      expect(result![1].label).toBe('Air Filter');
    });
  });

  describe('regexFallback with partIntents', () => {
    it('should generate partIntents for multi-part type query', () => {
      const result = QueryUnderstandingAgent.regexFallback('I need a fuel filter and an oil filter');

      expect(result.partIntents).toBeDefined();
      expect(result.partIntents!.length).toBeGreaterThanOrEqual(2);
      expect(result.partIntents!.some(pi => pi.partType === 'fuel filter')).toBe(true);
      expect(result.partIntents!.some(pi => pi.partType === 'oil filter')).toBe(true);
    });

    it('should generate partIntents for multi-part-number query', () => {
      const result = QueryUnderstandingAgent.regexFallback('Compare AT-123456 and RE54321');

      expect(result.partIntents).toBeDefined();
      expect(result.partIntents!.some(pi => pi.partNumber === 'AT-123456')).toBe(true);
      expect(result.partIntents!.some(pi => pi.partNumber === 'RE54321')).toBe(true);
    });

    it('should NOT generate partIntents for truly single-part query', () => {
      // "belt" matches only one entry in PART_SYNONYMS
      const result = QueryUnderstandingAgent.regexFallback('belt');
      expect(result.partIntents).toBeUndefined();
    });

    it('should give each partIntent its own expanded terms', () => {
      const result = QueryUnderstandingAgent.regexFallback('I need a fuel filter and a belt');

      expect(result.partIntents).toBeDefined();
      const fuelIntent = result.partIntents!.find(pi => pi.partType === 'fuel filter');
      const beltIntent = result.partIntents!.find(pi => pi.partType === 'belt');

      expect(fuelIntent).toBeDefined();
      expect(fuelIntent!.expandedTerms).toContain('fuel element');
      expect(fuelIntent!.expandedTerms).not.toContain('drive belt');

      expect(beltIntent).toBeDefined();
      expect(beltIntent!.expandedTerms).toContain('drive belt');
      expect(beltIntent!.expandedTerms).not.toContain('fuel element');
    });
  });

  describe('troubleshooting intent detection', () => {
    it('should detect troubleshooting intent for diagnostic keywords', () => {
      const result = QueryUnderstandingAgent.regexFallback('the machine is having trouble lifting a load');
      expect(result.intent).toBe('troubleshooting');
    });

    it('should detect troubleshooting for "not working" queries', () => {
      const result = QueryUnderstandingAgent.regexFallback('engine not working properly');
      expect(result.intent).toBe('troubleshooting');
    });

    it('should detect troubleshooting for overheating', () => {
      const result = QueryUnderstandingAgent.regexFallback('my excavator is overheating');
      expect(result.intent).toBe('troubleshooting');
    });

    it('should detect troubleshooting for error codes', () => {
      const result = QueryUnderstandingAgent.regexFallback('getting error code on the display');
      expect(result.intent).toBe('troubleshooting');
    });

    it('should detect troubleshooting for "what\'s wrong"', () => {
      const result = QueryUnderstandingAgent.regexFallback("what's wrong with my loader?");
      expect(result.intent).toBe('troubleshooting');
    });

    it('should detect troubleshooting for leak problems', () => {
      const result = QueryUnderstandingAgent.regexFallback('hydraulic system is leaking');
      expect(result.intent).toBe('troubleshooting');
    });

    it('should detect troubleshooting for noise issues', () => {
      const result = QueryUnderstandingAgent.regexFallback('strange noise coming from the engine');
      expect(result.intent).toBe('troubleshooting');
    });

    it('should prioritize part_description over troubleshooting when part type is detected', () => {
      const result = QueryUnderstandingAgent.regexFallback('I need a fuel filter, the engine is overheating');
      expect(result.intent).toBe('part_description');
      expect(result.partTypes).toContain('fuel filter');
    });

    it('should prioritize exact_part_number over troubleshooting', () => {
      const result = QueryUnderstandingAgent.regexFallback('AT-123456 is broken');
      expect(result.intent).toBe('exact_part_number');
      expect(result.partNumbers).toContain('AT-123456');
    });

    it('should keep general_question for vague queries without diagnostic keywords', () => {
      const result = QueryUnderstandingAgent.regexFallback('How do I maintain my excavator?');
      expect(result.intent).toBe('general_question');
    });

    it('should detect troubleshooting for "how to fix"', () => {
      const result = QueryUnderstandingAgent.regexFallback('how to fix the hydraulic system');
      expect(result.intent).toBe('troubleshooting');
    });

    it('should detect troubleshooting for malfunction', () => {
      const result = QueryUnderstandingAgent.regexFallback('the bucket is malfunctioning');
      // "bucket" is a part type, so part_description takes priority
      expect(result.intent).toBe('part_description');
    });

    it('should detect part_description when "light" synonym is present', () => {
      // "light" now matches part synonym, so part_description takes priority
      const result = QueryUnderstandingAgent.regexFallback('warning light on the dashboard');
      expect(result.partTypes).toContain('light');
      expect(result.intent).toBe('part_description');
    });
  });

  describe('expanded synonym coverage', () => {
    it('should recognize cabin filter', () => {
      const result = QueryUnderstandingAgent.regexFallback('cabin filter for my loader');
      expect(result.partTypes).toContain('cabin filter');
      expect(result.expandedTerms).toContain('cab filter');
      expect(result.expandedTerms).toContain('hvac filter');
    });

    it('should recognize seal kit / rebuild kit', () => {
      const result = QueryUnderstandingAgent.regexFallback('seal kit for hydraulic cylinder');
      expect(result.partTypes).toContain('seal kit');
      expect(result.expandedTerms).toContain('rebuild kit');
      expect(result.expandedTerms).toContain('repair kit');
    });

    it('should recognize cutting edge', () => {
      const result = QueryUnderstandingAgent.regexFallback('cutting edge for bucket');
      expect(result.partTypes).toContain('cutting edge');
      expect(result.expandedTerms).toContain('blade edge');
    });

    it('should recognize turbo from synonym turbocharger', () => {
      const result = QueryUnderstandingAgent.regexFallback('turbocharger replacement');
      expect(result.partTypes).toContain('turbo');
    });

    it('should recognize roller (undercarriage)', () => {
      const result = QueryUnderstandingAgent.regexFallback('track roller for dozer');
      expect(result.partTypes).toContain('roller');
      expect(result.expandedTerms).toContain('bottom roller');
    });

    it('should recognize sensor', () => {
      const result = QueryUnderstandingAgent.regexFallback('pressure sensor');
      expect(result.partTypes).toContain('sensor');
      expect(result.expandedTerms).toContain('temperature sensor');
    });

    it('should recognize wiper', () => {
      const result = QueryUnderstandingAgent.regexFallback('wiper blade for cab');
      expect(result.partTypes).toContain('wiper');
      expect(result.expandedTerms).toContain('wiper arm');
    });

    it('should recognize liner / cylinder sleeve', () => {
      const result = QueryUnderstandingAgent.regexFallback('cylinder liner');
      expect(result.partTypes).toContain('liner');
      expect(result.expandedTerms).toContain('sleeve');
    });
  });

  describe('misspelling correction', () => {
    it('should correct "fule filter" to "fuel filter"', () => {
      const result = QueryUnderstandingAgent.regexFallback('fule filter for excavator');
      expect(result.partTypes).toContain('fuel filter');
      expect(result.intent).toBe('part_description');
    });

    it('should correct "hydralic" to "hydraulic"', () => {
      const result = QueryUnderstandingAgent.regexFallback('hydralic filter replacement');
      expect(result.partTypes).toContain('hydraulic filter');
    });

    it('should correct "bering" to "bearing"', () => {
      const result = QueryUnderstandingAgent.regexFallback('bering for final drive');
      expect(result.partTypes).toContain('bearing');
    });

    it('should correct "alternater" to "alternator"', () => {
      const result = QueryUnderstandingAgent.regexFallback('alternater not charging');
      expect(result.partTypes).toContain('alternator');
    });

    it('should correct "fliter" to "filter"', () => {
      const result = QueryUnderstandingAgent.regexFallback('oil fliter');
      expect(result.partTypes).toContain('oil filter');
    });

    it('should correct "sproket" to "sprocket"', () => {
      const result = QueryUnderstandingAgent.regexFallback('drive sproket worn out');
      expect(result.partTypes).toContain('sprocket');
    });

    it('should handle multiple misspellings in one query', () => {
      const result = QueryUnderstandingAgent.regexFallback('hydralic fliter');
      expect(result.partTypes).toContain('hydraulic filter');
    });
  });
});
