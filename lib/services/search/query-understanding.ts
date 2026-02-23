import { OpenRouterClient } from '../llm/openrouter-client';
import { PROMPTS } from '../llm/prompt-templates';
import type { VehicleContext } from './postgres-search';

export interface PartIntent {
  label: string;           // Human-readable label, e.g. "Fuel Filter" or "AT-123456"
  queryText: string;       // Focused search text for this part
  partType?: string;       // If this intent is a part type/description
  partNumber?: string;     // If this intent is a specific part number
  expandedTerms: string[]; // Synonyms specific to THIS part only
}

export interface SpellingCorrection {
  original: string;
  corrected: string;
}

export interface ProcessedQuery {
  originalQuery: string;
  intent: 'exact_part_number' | 'part_description' | 'compatibility_check' | 'alternatives' | 'general_question' | 'troubleshooting';
  partNumbers: string[];
  partTypes: string[];
  expandedTerms: string[];
  attributes: string[];
  processedQuery: string;
  urgent: boolean;
  shouldSearchWeb: boolean;
  partIntents?: PartIntent[]; // Populated when multiple parts detected
  spellingCorrection?: SpellingCorrection; // Populated when misspellings were corrected
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
  // Filters
  'filter': ['filter element', 'strainer', 'filtration'],
  'fuel filter': ['fuel element', 'fuel strainer', 'fuel filtration element', 'fuel water separator'],
  'oil filter': ['oil element', 'lube filter', 'oil strainer', 'engine oil filter'],
  'air filter': ['air element', 'air cleaner', 'air intake filter', 'primary air filter', 'secondary air filter'],
  'hydraulic filter': ['hydraulic element', 'hydraulic strainer', 'hyd filter', 'return filter', 'suction filter'],
  'cabin filter': ['cab filter', 'ac filter', 'hvac filter', 'interior filter'],
  'transmission filter': ['trans filter', 'transmission strainer'],
  'separator': ['fuel water separator', 'oil separator', 'air oil separator'],

  // Seals & gaskets
  'gasket': ['seal', 'packing', 'gasket set'],
  'o-ring': ['oring', 'o ring', 'rubber ring', 'seal ring'],
  'seal': ['oil seal', 'shaft seal', 'lip seal', 'dust seal', 'wiper seal'],
  'seal kit': ['reseal kit', 'rebuild kit', 'repair kit', 'overhaul kit'],

  // Bearings & bushings
  'bearing': ['bushing', 'roller bearing', 'ball bearing', 'needle bearing', 'taper bearing'],
  'bushing': ['bearing bushing', 'sleeve bushing', 'rubber bushing', 'pivot bushing'],

  // Drive & power
  'belt': ['drive belt', 'v-belt', 'serpentine belt', 'fan belt', 'timing belt'],
  'pump': ['hydraulic pump', 'fuel pump', 'water pump', 'gear pump', 'piston pump'],
  'motor': ['hydraulic motor', 'drive motor', 'travel motor', 'swing motor'],

  // Hydraulics
  'hose': ['hydraulic hose', 'coolant hose', 'rubber hose', 'line', 'hose assembly'],
  'cylinder': ['hydraulic cylinder', 'ram', 'actuator', 'boom cylinder', 'bucket cylinder', 'arm cylinder'],
  'valve': ['control valve', 'check valve', 'relief valve', 'solenoid valve', 'spool valve', 'main control valve'],

  // Undercarriage
  'sprocket': ['drive sprocket', 'idler sprocket', 'final drive sprocket', 'segment sprocket'],
  'track': ['track chain', 'track link', 'crawler track', 'track assembly', 'track shoe'],
  'roller': ['track roller', 'carrier roller', 'bottom roller', 'top roller', 'lower roller', 'upper roller'],
  'idler': ['front idler', 'track idler', 'idler wheel', 'idler assembly'],
  'shoe': ['track shoe', 'grouser shoe', 'track pad', 'shoe plate'],
  'recoil spring': ['track adjuster', 'track spring', 'idler spring', 'tension spring'],

  // Bucket & ground engaging
  'bucket': ['bucket teeth', 'cutting edge', 'bucket pin'],
  'teeth': ['bucket teeth', 'tooth', 'ground engaging tools', 'GET', 'ripper tooth'],
  'cutting edge': ['blade edge', 'grader blade', 'bucket edge', 'wear edge', 'side cutter'],
  'pin': ['bucket pin', 'track pin', 'pivot pin', 'dowel pin', 'master pin', 'link pin'],

  // Electrical
  'starter': ['starter motor', 'starting motor', 'engine starter'],
  'alternator': ['generator', 'charging alternator'],
  'sensor': ['pressure sensor', 'temperature sensor', 'speed sensor', 'level sensor', 'position sensor'],
  'harness': ['wiring harness', 'wire harness', 'electrical harness', 'cable assembly'],
  'switch': ['pressure switch', 'toggle switch', 'ignition switch', 'safety switch'],
  'light': ['work light', 'headlight', 'tail light', 'warning light', 'LED light'],

  // Engine
  'turbo': ['turbocharger', 'turbo charger'],
  'injector': ['fuel injector', 'injection nozzle', 'nozzle', 'injector assembly'],
  'radiator': ['cooler', 'heat exchanger', 'oil cooler', 'charge air cooler', 'aftercooler'],
  'piston': ['piston ring', 'piston kit', 'piston assembly'],
  'liner': ['cylinder liner', 'sleeve', 'cylinder sleeve', 'wet liner', 'dry liner'],
  'muffler': ['exhaust muffler', 'silencer', 'exhaust pipe'],
  'thermostat': ['thermostat housing', 'coolant thermostat'],
  'water pump': ['coolant pump', 'engine water pump'],

  // Cab & operator
  'glass': ['windshield', 'window glass', 'cab glass', 'rear glass', 'door glass'],
  'seat': ['operator seat', 'cab seat', 'seat cushion', 'seat assembly', 'suspension seat'],
  'wiper': ['wiper blade', 'wiper arm', 'windshield wiper', 'wiper motor'],
  'mirror': ['side mirror', 'rear view mirror', 'rearview mirror'],
};

// Common misspellings in heavy equipment parts queries
const COMMON_MISSPELLINGS: Record<string, string> = {
  'fule': 'fuel',
  'fual': 'fuel',
  'hydralic': 'hydraulic',
  'hydraulc': 'hydraulic',
  'hydrualic': 'hydraulic',
  'bering': 'bearing',
  'bareing': 'bearing',
  'bearng': 'bearing',
  'filtre': 'filter',
  'fliter': 'filter',
  'fitler': 'filter',
  'gaskit': 'gasket',
  'gascet': 'gasket',
  'alterantor': 'alternator',
  'alternater': 'alternator',
  'injector': 'injector',
  'injecter': 'injector',
  'radaitor': 'radiator',
  'radiater': 'radiator',
  'turbocharger': 'turbo',
  'cilindr': 'cylinder',
  'cylindar': 'cylinder',
  'spocket': 'sprocket',
  'sproket': 'sprocket',
  'piston': 'piston',
  'pistion': 'piston',
  'seel': 'seal',
  'seale': 'seal',
  'bushin': 'bushing',
  'valv': 'valve',
  'valvle': 'valve',
  'mufler': 'muffler',
  'muffeler': 'muffler',
  'startor': 'starter',
  'stater': 'starter',
};

/**
 * Correct common misspellings in a query string.
 * Returns both the corrected string and whether any corrections were made.
 */
function correctMisspellings(query: string): { corrected: string; didCorrect: boolean } {
  let corrected = query;
  for (const [misspelling, correction] of Object.entries(COMMON_MISSPELLINGS)) {
    const regex = new RegExp(`\\b${misspelling}\\b`, 'gi');
    corrected = corrected.replace(regex, correction);
  }
  return { corrected, didCorrect: corrected !== query };
}

// Keywords that indicate urgency
const URGENCY_KEYWORDS = ['urgent', 'asap', 'emergency', 'rush', 'critical', 'down', 'broken', 'immediately'];

// Keywords that indicate a diagnostic/troubleshooting question (not a parts search)
const DIAGNOSTIC_KEYWORDS = [
  'trouble', 'problem', 'issue', 'not working', 'broken', 'failed', 'failure',
  'overheating', 'leak', 'leaking', 'noise', 'vibration', "won't start",
  'stalling', 'slow', 'weak', 'error code', 'fault code', 'warning light',
  'diagnos', 'troubleshoot', "what's wrong", 'whats wrong', 'how to fix',
  'how do i fix', 'malfunction',
];

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
      'troubleshooting': 'troubleshooting',
    };

    const extractedPartTypes = result.partTypes || [];
    const extractedPartNumbers = result.partNumbers || [];

    // Build per-part intents from LLM response or fall back to PART_SYNONYMS
    let partIntents: PartIntent[] | undefined;
    if ((result as any).partIntents && Array.isArray((result as any).partIntents) && (result as any).partIntents.length > 1) {
      // LLM returned per-part intents directly
      partIntents = (result as any).partIntents.map((pi: any) => ({
        label: pi.label || pi.queryText || '',
        queryText: pi.queryText || '',
        partType: pi.partType || undefined,
        partNumber: pi.partNumber || undefined,
        expandedTerms: pi.expandedTerms || [],
      }));
    } else {
      // Fall back to building from partTypes/partNumbers + PART_SYNONYMS
      partIntents = this.buildPartIntents(extractedPartTypes, extractedPartNumbers);
    }

    return {
      originalQuery: query,
      intent: intentMap[result.intent] || 'general_question',
      partNumbers: extractedPartNumbers,
      partTypes: extractedPartTypes,
      expandedTerms: result.expandedTerms || [],
      attributes: result.attributes || [],
      processedQuery: result.processedQuery || query,
      urgent: result.urgent || false,
      shouldSearchWeb: result.shouldSearchWeb || false,
      partIntents,
    };
  }

  /**
   * Regex-based fallback when LLM is unavailable.
   * Extracts part numbers, detects part types, and expands synonyms.
   */
  static regexFallback(query: string): ProcessedQuery {
    // Correct common misspellings before processing
    const { corrected: correctedQuery, didCorrect } = correctMisspellings(query);
    const lowerQuery = correctedQuery.toLowerCase();

    // Extract part numbers
    const partNumbers: string[] = [];
    for (const pattern of PART_NUMBER_PATTERNS) {
      const matches = correctedQuery.match(pattern);
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

    // Determine intent (priority: part numbers > part types > troubleshooting > compatibility > alternatives > general)
    const hasDiagnosticKeywords = DIAGNOSTIC_KEYWORDS.some(keyword => lowerQuery.includes(keyword));
    let intent: ProcessedQuery['intent'] = 'general_question';
    if (uniquePartNumbers.length > 0) {
      intent = 'exact_part_number';
    } else if (partTypes.length > 0) {
      intent = 'part_description';
    } else if (hasDiagnosticKeywords) {
      intent = 'troubleshooting';
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

    // Build per-part intents when multiple parts detected
    const partIntents = this.buildPartIntents(partTypes, uniquePartNumbers);

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
      partIntents,
      ...(didCorrect ? { spellingCorrection: { original: query, corrected: correctedQuery } } : {}),
    };
  }

  /**
   * Build per-part intents when multiple parts are detected.
   * Each intent gets its own focused query and synonyms.
   */
  static buildPartIntents(partTypes: string[], partNumbers: string[]): PartIntent[] | undefined {
    const totalParts = partTypes.length + partNumbers.length;
    if (totalParts <= 1) return undefined;

    const intents: PartIntent[] = [];

    for (const pt of partTypes) {
      intents.push({
        label: pt.split(' ').map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(' '),
        queryText: pt,
        partType: pt,
        expandedTerms: PART_SYNONYMS[pt] || [],
      });
    }

    for (const pn of partNumbers) {
      intents.push({
        label: pn,
        queryText: pn,
        partNumber: pn,
        expandedTerms: [],
      });
    }

    return intents;
  }
}
