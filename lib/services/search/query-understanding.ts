import { OpenRouterClient } from '../llm/openrouter-client';
import { PROMPTS } from '../llm/prompt-templates';
import type { VehicleContext } from './postgres-search';

export interface ProcessedQuery {
  originalQuery: string;
  intent: 'exact_part_number' | 'part_description' | 'compatibility_check' | 'alternatives' | 'general_question';
  partNumbers: string[];
  partTypes: string[];
  expandedTerms: string[];
  attributes: string[];
  processedQuery: string;
  urgent: boolean;
  shouldSearchWeb: boolean;
}

// Common part number patterns for heavy equipment
const PART_NUMBER_PATTERNS = [
  /\b[A-Z]{1,3}[-\s]?\d{4,7}\b/gi,       // XX-NNNNNNN (e.g., AT-123456, RE-54321)
  /\b\d{3,4}[-\s]?\d{4,6}\b/g,            // NNN-NNNNNN (e.g., 123-45678)
  /\b[A-Z]{2,4}\d{4,8}\b/gi,              // XXNNNNNNN (e.g., RE54321, AT123456)
  /\b\d{1,2}[A-Z]\d{4,5}\b/gi,            // NXNNNNNorNNXNNNNN (e.g., 6Y1234)
  /\b[A-Z]\d{2,3}[A-Z]\d{3,5}\b/gi,       // XNNNXNNNNN (e.g., T10A1234)
];

// Heavy equipment part type synonyms for query expansion
const PART_SYNONYMS: Record<string, string[]> = {
  'filter': ['filter element', 'strainer', 'filtration'],
  'fuel filter': ['fuel element', 'fuel strainer', 'fuel filtration element'],
  'oil filter': ['oil element', 'lube filter', 'oil strainer'],
  'air filter': ['air element', 'air cleaner', 'air intake filter'],
  'hydraulic filter': ['hydraulic element', 'hydraulic strainer', 'hyd filter'],
  'belt': ['drive belt', 'v-belt', 'serpentine belt', 'fan belt'],
  'gasket': ['seal', 'o-ring', 'packing'],
  'bearing': ['bushing', 'roller bearing', 'ball bearing'],
  'pump': ['hydraulic pump', 'fuel pump', 'water pump'],
  'hose': ['hydraulic hose', 'coolant hose', 'rubber hose', 'line'],
  'cylinder': ['hydraulic cylinder', 'ram', 'actuator'],
  'valve': ['control valve', 'check valve', 'relief valve', 'solenoid valve'],
  'sprocket': ['drive sprocket', 'idler sprocket', 'final drive sprocket'],
  'track': ['track chain', 'track link', 'crawler track'],
  'bucket': ['bucket teeth', 'cutting edge', 'bucket pin'],
  'pin': ['bucket pin', 'track pin', 'pivot pin', 'dowel pin'],
  'starter': ['starter motor', 'starting motor'],
  'alternator': ['generator', 'charging alternator'],
  'turbo': ['turbocharger', 'turbo charger'],
  'injector': ['fuel injector', 'injection nozzle', 'nozzle'],
  'radiator': ['cooler', 'heat exchanger'],
  'muffler': ['exhaust muffler', 'silencer'],
};

// Keywords that indicate urgency
const URGENCY_KEYWORDS = ['urgent', 'asap', 'emergency', 'rush', 'critical', 'down', 'broken', 'immediately'];

// Keywords that suggest web search would help
const WEB_SEARCH_HINTS = ['price', 'cost', 'buy', 'order', 'where to find', 'supplier', 'dealer', 'catalog', 'specification', 'specs', 'datasheet'];

export class QueryUnderstandingAgent {
  /**
   * Analyze a user query to extract structured search intent.
   * Uses LLM if available, falls back to regex-based extraction.
   * Never blocks search — if analysis fails, returns raw query passthrough.
   */
  static async analyze(
    query: string,
    vehicleContext?: VehicleContext,
    llmClient?: OpenRouterClient | null,
    timeoutMs: number = 2000
  ): Promise<ProcessedQuery> {
    const fallback = this.regexFallback(query);

    if (!llmClient) {
      console.log('[QueryUnderstanding] No LLM client, using regex fallback');
      return fallback;
    }

    try {
      const result = await Promise.race([
        this.llmAnalyze(query, vehicleContext, llmClient),
        new Promise<null>((_, reject) =>
          setTimeout(() => reject(new Error('Query understanding timed out')), timeoutMs)
        ),
      ]);

      if (result) {
        console.log('[QueryUnderstanding] LLM analysis complete:', {
          intent: result.intent,
          partNumbers: result.partNumbers,
          partTypes: result.partTypes,
          shouldSearchWeb: result.shouldSearchWeb,
        });
        return result;
      }
    } catch (error: any) {
      console.warn('[QueryUnderstanding] LLM analysis failed, using fallback:', error.message);
    }

    return fallback;
  }

  /**
   * LLM-powered query analysis using the enhanced ANALYZE_PARTS_QUERY prompt
   */
  private static async llmAnalyze(
    query: string,
    vehicleContext: VehicleContext | undefined,
    llmClient: OpenRouterClient
  ): Promise<ProcessedQuery> {
    const prompt = PROMPTS.ANALYZE_PARTS_QUERY(query, vehicleContext);

    const result = await llmClient.generateStructuredOutput<{
      partTypes: string[];
      partNumbers: string[];
      attributes: string[];
      urgent: boolean;
      intent: string;
      processedQuery: string;
      expandedTerms: string[];
      shouldSearchWeb: boolean;
    }>(prompt, {
      partTypes: ['string'],
      partNumbers: ['string'],
      attributes: ['string'],
      urgent: false,
      intent: 'string',
      processedQuery: 'string',
      expandedTerms: ['string'],
      shouldSearchWeb: false,
    }, {
      temperature: 0.1,
      maxTokens: 500,
    });

    // Map LLM intent to our enum
    const intentMap: Record<string, ProcessedQuery['intent']> = {
      'exact_part_number': 'exact_part_number',
      'part_type': 'part_description',
      'part_description': 'part_description',
      'compatibility': 'compatibility_check',
      'compatibility_check': 'compatibility_check',
      'alternatives': 'alternatives',
      'general_question': 'general_question',
    };

    return {
      originalQuery: query,
      intent: intentMap[result.intent] || 'general_question',
      partNumbers: result.partNumbers || [],
      partTypes: result.partTypes || [],
      expandedTerms: result.expandedTerms || [],
      attributes: result.attributes || [],
      processedQuery: result.processedQuery || query,
      urgent: result.urgent || false,
      shouldSearchWeb: result.shouldSearchWeb || false,
    };
  }

  /**
   * Regex-based fallback when LLM is unavailable.
   * Extracts part numbers, detects part types, and expands synonyms.
   */
  static regexFallback(query: string): ProcessedQuery {
    const lowerQuery = query.toLowerCase();

    // Extract part numbers
    const partNumbers: string[] = [];
    for (const pattern of PART_NUMBER_PATTERNS) {
      const matches = query.match(pattern);
      if (matches) {
        partNumbers.push(...matches.map(m => m.replace(/\s/g, '')));
      }
    }
    const uniquePartNumbers = [...new Set(partNumbers)];

    // Detect part types and build expanded terms
    const partTypes: string[] = [];
    const expandedTerms: string[] = [];
    for (const [partType, synonyms] of Object.entries(PART_SYNONYMS)) {
      if (lowerQuery.includes(partType)) {
        partTypes.push(partType);
        expandedTerms.push(...synonyms);
      }
      // Also check if any synonym is in the query
      for (const synonym of synonyms) {
        if (lowerQuery.includes(synonym) && !partTypes.includes(partType)) {
          partTypes.push(partType);
          expandedTerms.push(...synonyms.filter(s => s !== synonym));
          break;
        }
      }
    }

    // Detect attributes
    const attributeKeywords = ['oem', 'aftermarket', 'genuine', 'front', 'rear', 'left', 'right', 'upper', 'lower', 'inner', 'outer', 'new', 'remanufactured', 'reman'];
    const attributes = attributeKeywords.filter(attr => lowerQuery.includes(attr));

    // Detect urgency
    const urgent = URGENCY_KEYWORDS.some(keyword => lowerQuery.includes(keyword));

    // Determine intent
    let intent: ProcessedQuery['intent'] = 'general_question';
    if (uniquePartNumbers.length > 0) {
      intent = 'exact_part_number';
    } else if (partTypes.length > 0) {
      intent = 'part_description';
    } else if (lowerQuery.includes('compatible') || lowerQuery.includes('fit') || lowerQuery.includes('work with') || lowerQuery.includes('replace')) {
      intent = 'compatibility_check';
    } else if (lowerQuery.includes('alternative') || lowerQuery.includes('substitute') || lowerQuery.includes('instead of') || lowerQuery.includes('equivalent')) {
      intent = 'alternatives';
    }

    // Determine if web search would help
    const shouldSearchWeb = WEB_SEARCH_HINTS.some(hint => lowerQuery.includes(hint)) ||
      (uniquePartNumbers.length > 0 && partTypes.length === 0); // Has a part number but nothing else — might need web

    // Build processed query (clean up natural language)
    let processedQuery = query;
    // If we detected part numbers, emphasize them in the query
    if (uniquePartNumbers.length > 0) {
      processedQuery = uniquePartNumbers.join(' ') + ' ' + partTypes.join(' ');
      processedQuery = processedQuery.trim();
      if (!processedQuery) processedQuery = query;
    }

    return {
      originalQuery: query,
      intent,
      partNumbers: uniquePartNumbers,
      partTypes,
      expandedTerms: [...new Set(expandedTerms)],
      attributes,
      processedQuery,
      urgent,
      shouldSearchWeb,
    };
  }
}
