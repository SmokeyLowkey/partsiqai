import { prisma } from '@/lib/prisma';

export interface VehicleContext {
  make: string;
  model: string;
  year: number;
  vehicleId?: string;  // Required for search mapping lookup
}

export interface PartResult {
  partNumber: string;
  description: string;
  price?: number;
  stockQuantity?: number;
  category?: string;
  compatibility?: any;
  score: number;
  source: 'postgres' | 'pinecone' | 'neo4j' | 'web';
  // Additional metadata from Pinecone (John Deere catalog)
  metadata?: {
    diagramTitle?: string;
    categoryBreadcrumb?: string;
    text?: string;
    sourceUrl?: string;
    quantity?: string;
    remarks?: string;
    partKey?: number;
    mergedEntries?: Array<{
      diagramTitle?: string;
      quantity?: string;
      remarks?: string;
      sourceUrl?: string;
      partKey?: number;
    }>;
  };
}

// Common stop words to filter from natural language queries
const STOP_WORDS = new Set([
  'i', 'me', 'my', 'we', 'our', 'you', 'your', 'it', 'its', 'they', 'them',
  'a', 'an', 'the', 'this', 'that', 'these', 'those',
  'is', 'am', 'are', 'was', 'were', 'be', 'been', 'being',
  'have', 'has', 'had', 'do', 'does', 'did', 'will', 'would', 'could', 'should',
  'can', 'may', 'might', 'shall', 'must',
  'and', 'or', 'but', 'if', 'of', 'at', 'by', 'for', 'with', 'to', 'from',
  'in', 'on', 'up', 'out', 'off', 'about', 'into', 'over', 'after',
  'not', 'no', 'nor', 'so', 'too', 'very', 'just',
  'need', 'looking', 'find', 'want', 'search', 'get', 'show', 'give',
  'please', 'help', 'think', 'know', 'sure', 'like', 'also',
  'what', 'where', 'which', 'who', 'how', 'when',
]);

/**
 * Extract meaningful search keywords from a natural language query.
 * Filters stop words, short tokens, and punctuation.
 */
function extractKeywords(query: string): string[] {
  return query
    .toLowerCase()
    .replace(/[^\w\s-]/g, ' ')  // Remove punctuation except hyphens (for part numbers)
    .split(/\s+/)
    .filter(term =>
      term.length > 1 &&
      !STOP_WORDS.has(term)
    );
}

export class PostgresSearchAgent {
  async search(
    query: string,
    organizationId: string,
    vehicleContext?: VehicleContext
  ): Promise<PartResult[]> {
    try {
      console.log('[PostgresSearchAgent] Search query:', query);
      console.log('[PostgresSearchAgent] Vehicle context:', vehicleContext);

      // Extract meaningful keywords (filter stop words and noise)
      const searchTerms = extractKeywords(query);
      console.log('[PostgresSearchAgent] Extracted keywords:', searchTerms);

      // If no meaningful keywords extracted, return empty
      if (searchTerms.length === 0) {
        console.warn('[PostgresSearchAgent] No meaningful search terms found');
        return [];
      }

      // Build a cleaned search phrase from keywords (for phrase-level matching)
      const cleanedPhrase = searchTerms.join(' ');

      // Get search mapping if vehicle context provided
      let mapping = null;
      if (vehicleContext?.vehicleId) {
        mapping = await prisma.vehicleSearchMapping.findUnique({
          where: { vehicleId: vehicleContext.vehicleId },
        });

        if (mapping) {
          console.log('[PostgresSearchAgent] Using search mapping for vehicle:', vehicleContext.vehicleId);
        } else {
          console.warn('[PostgresSearchAgent] No search mapping found');
        }
      }

      // Build WHERE conditions - search text matches using cleaned keywords
      const textSearchConditions: any[] = [
        // Cleaned phrase in part number (highest priority)
        {
          partNumber: {
            contains: cleanedPhrase,
            mode: 'insensitive' as const,
          },
        },
        // Cleaned phrase in description (high priority)
        {
          description: {
            contains: cleanedPhrase,
            mode: 'insensitive' as const,
          },
        },
        // Cleaned phrase in category
        {
          category: {
            contains: cleanedPhrase,
            mode: 'insensitive' as const,
          },
        },
        // Cleaned phrase in subcategory
        {
          subcategory: {
            contains: cleanedPhrase,
            mode: 'insensitive' as const,
          },
        },
        // Individual keyword matches in description
        ...searchTerms.map((term) => ({
          description: {
            contains: term,
            mode: 'insensitive' as const,
          },
        })),
        // Individual keyword matches in category
        ...searchTerms.map((term) => ({
          category: {
            contains: term,
            mode: 'insensitive' as const,
          },
        })),
        // Individual keyword matches in subcategory
        ...searchTerms.map((term) => ({
          subcategory: {
            contains: term,
            mode: 'insensitive' as const,
          },
        })),
        // Also try each keyword against part number (for partial part number searches)
        ...searchTerms.filter(t => t.length >= 3).map((term) => ({
          partNumber: {
            contains: term,
            mode: 'insensitive' as const,
          },
        })),
      ];

      // Base conditions - must match organization and be active
      const whereConditions: any = {
        organizationId,
        isActive: true,
        OR: textSearchConditions,
      };

      // Add mapping-based filters as AND conditions (must match vehicle context)
      if (mapping) {
        console.log('[PostgresSearchAgent] Applying vehicle mapping filters:', {
          postgresMake: mapping.postgresMake,
          postgresModel: mapping.postgresModel,
          postgresCategory: mapping.postgresCategory,
        });

        // Add category filters from mapping as AND conditions
        if (mapping.postgresCategory) {
          whereConditions.category = {
            contains: mapping.postgresCategory,
            mode: 'insensitive' as const,
          };
        }

        if (mapping.postgresSubcategory) {
          whereConditions.subcategory = {
            contains: mapping.postgresSubcategory,
            mode: 'insensitive' as const,
          };
        }

        // Use compatibility matching with standardized names as AND conditions
        // Parts MUST be compatible with the selected vehicle
        if (mapping.postgresMake || mapping.postgresModel) {
          const compatibilityConditions: any[] = [];

          if (mapping.postgresMake) {
            compatibilityConditions.push({
              compatibility: {
                path: ['makes'],
                array_contains: mapping.postgresMake,
              },
            });
          }

          if (mapping.postgresModel) {
            compatibilityConditions.push({
              compatibility: {
                path: ['models'],
                array_contains: mapping.postgresModel,
              },
            });
          }

          // Add as AND condition - parts must match at least one compatibility filter
          if (compatibilityConditions.length > 0) {
            // Wrap existing conditions with AND to add compatibility requirement
            whereConditions.AND = [
              { OR: textSearchConditions },
              { OR: compatibilityConditions },
            ];
            // Remove the top-level OR since it's now inside AND
            delete whereConditions.OR;
          }
        }
      }

      console.log('[PostgresSearchAgent] Where conditions:', JSON.stringify(whereConditions, null, 2));

      // PostgreSQL full-text search
      const parts = await prisma.part.findMany({
        where: whereConditions,
        take: 100, // Get more results for better scoring
        orderBy: [
          { partNumber: 'asc' },
          { description: 'asc' },
        ],
      });

      console.log('[PostgresSearchAgent] Raw results count:', parts.length);

      // Calculate relevance scores using cleaned keywords (not raw query)
      const results: PartResult[] = parts.map((part) => {
        let score = 0;
        const descLower = part.description.toLowerCase();
        const cleanedLower = cleanedPhrase.toLowerCase();

        // Exact part number match = highest score
        if (part.partNumber.toLowerCase() === cleanedLower) {
          score = 100;
        } else if (part.partNumber.toLowerCase().includes(cleanedLower)) {
          score = 80;
        }
        // Full cleaned phrase in description
        else if (descLower.includes(cleanedLower)) {
          score = 70;

          // Extra boost if it's at the beginning
          if (descLower.startsWith(cleanedLower)) {
            score += 10;
          }
        }
        // Category or subcategory match with cleaned phrase
        else if (
          part.category?.toLowerCase().includes(cleanedLower) ||
          part.subcategory?.toLowerCase().includes(cleanedLower)
        ) {
          score = 50;
        }
        // Count how many keywords match in description/category/subcategory
        else {
          const matchedTerms = searchTerms.filter((term) =>
            descLower.includes(term) ||
            part.category?.toLowerCase().includes(term) ||
            part.subcategory?.toLowerCase().includes(term)
          );

          if (matchedTerms.length === searchTerms.length) {
            // All terms matched - decent score
            score = 40;
          } else if (matchedTerms.length > 0) {
            // Partial match - proportional score
            score = (matchedTerms.length / searchTerms.length) * 30;
          }
        }

        // Boost score if vehicle compatibility matches
        if (vehicleContext && part.compatibility) {
          const compatibility = part.compatibility as any;
          if (
            compatibility.makes?.includes(vehicleContext.make) ||
            compatibility.models?.includes(vehicleContext.model) ||
            compatibility.years?.includes(vehicleContext.year)
          ) {
            score += 20;
          }
        }

        // Boost if in stock
        if (part.stockQuantity > 0) {
          score += 5;
        }

        return {
          partNumber: part.partNumber,
          description: part.description,
          price: part.price ? parseFloat(part.price.toString()) : undefined,
          stockQuantity: part.stockQuantity,
          category: part.category || undefined,
          compatibility: part.compatibility,
          score,
          source: 'postgres' as const,
        };
      });

      // Sort by score descending
      const sortedResults = results.sort((a, b) => b.score - a.score).slice(0, 20);

      console.log('[PostgresSearchAgent] Top 5 scored results:',
        sortedResults.slice(0, 5).map(r => ({
          partNumber: r.partNumber,
          description: r.description,
          score: r.score,
          category: r.category
        }))
      );

      return sortedResults;
    } catch (error: any) {
      console.error('PostgreSQL search error:', error);
      throw new Error(`PostgreSQL search failed: ${error.message}`);
    }
  }
}
