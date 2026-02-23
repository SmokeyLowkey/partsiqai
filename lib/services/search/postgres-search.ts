import { prisma } from '@/lib/prisma';
import { apiLogger } from '@/lib/logger';
const log = apiLogger.child({ service: 'postgres-search' });

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

// Raw FTS result shape from $queryRaw
interface FtsRow {
  id: string;
  partNumber: string;
  description: string;
  category: string | null;
  subcategory: string | null;
  price: string | null;       // Decimal comes back as string
  stockQuantity: number;
  compatibility: any;
  rank: number;
}

export class PostgresSearchAgent {
  /**
   * Full-text search using PostgreSQL tsvector + GIN index.
   * Returns scored PartResult[] or null if FTS is unavailable / returns 0 results.
   */
  private async ftsSearch(
    cleanedPhrase: string,
    organizationId: string,
    vehicleContext?: VehicleContext,
    mapping?: any
  ): Promise<PartResult[] | null> {
    try {
      // Build the tsquery string — plainto_tsquery handles multi-word input safely
      // For single tokens that look like part numbers, also try prefix matching
      let rows: FtsRow[];

      if (mapping?.postgresCategory && mapping?.postgresSubcategory) {
        rows = await prisma.$queryRaw<FtsRow[]>`
          SELECT "id", "partNumber", "description", "category", "subcategory",
                 "price"::text, "stockQuantity", "compatibility",
                 ts_rank("searchVector", plainto_tsquery('english', ${cleanedPhrase})) AS rank
          FROM "parts"
          WHERE "organizationId" = ${organizationId}
            AND "isActive" = true
            AND "searchVector" @@ plainto_tsquery('english', ${cleanedPhrase})
            AND "category" ILIKE ${'%' + mapping.postgresCategory + '%'}
            AND "subcategory" ILIKE ${'%' + mapping.postgresSubcategory + '%'}
          ORDER BY rank DESC
          LIMIT 20
        `;
      } else if (mapping?.postgresCategory) {
        rows = await prisma.$queryRaw<FtsRow[]>`
          SELECT "id", "partNumber", "description", "category", "subcategory",
                 "price"::text, "stockQuantity", "compatibility",
                 ts_rank("searchVector", plainto_tsquery('english', ${cleanedPhrase})) AS rank
          FROM "parts"
          WHERE "organizationId" = ${organizationId}
            AND "isActive" = true
            AND "searchVector" @@ plainto_tsquery('english', ${cleanedPhrase})
            AND "category" ILIKE ${'%' + mapping.postgresCategory + '%'}
          ORDER BY rank DESC
          LIMIT 20
        `;
      } else {
        rows = await prisma.$queryRaw<FtsRow[]>`
          SELECT "id", "partNumber", "description", "category", "subcategory",
                 "price"::text, "stockQuantity", "compatibility",
                 ts_rank("searchVector", plainto_tsquery('english', ${cleanedPhrase})) AS rank
          FROM "parts"
          WHERE "organizationId" = ${organizationId}
            AND "isActive" = true
            AND "searchVector" @@ plainto_tsquery('english', ${cleanedPhrase})
          ORDER BY rank DESC
          LIMIT 20
        `;
      }

      if (rows.length === 0) {
        log.info('FTS returned 0 results');
        return null; // Signal caller to try ILIKE fallback
      }

      log.info({ count: rows.length }, 'FTS results returned');

      // Convert to PartResult with scores derived from ts_rank
      const maxRank = Math.max(...rows.map(r => r.rank), 0.001);

      return rows.map(row => {
        // Normalize ts_rank to 0-100 scale, with a floor of 40 for any FTS match
        let score = Math.round((row.rank / maxRank) * 60) + 40;

        // Boost for vehicle compatibility
        if (vehicleContext && row.compatibility) {
          const compat = row.compatibility as any;
          if (
            compat.makes?.includes(vehicleContext.make) ||
            compat.models?.includes(vehicleContext.model) ||
            compat.years?.includes(vehicleContext.year)
          ) {
            score += 20;
          }
        }

        // Boost if in stock
        if (row.stockQuantity > 0) {
          score += 5;
        }

        // Cap at 100
        score = Math.min(score, 100);

        return {
          partNumber: row.partNumber,
          description: row.description,
          price: row.price ? parseFloat(row.price) : undefined,
          stockQuantity: row.stockQuantity,
          category: row.category || undefined,
          compatibility: row.compatibility,
          score,
          source: 'postgres' as const,
        };
      });
    } catch (error: any) {
      // FTS may fail if the searchVector column doesn't exist yet (migration not run)
      log.warn({ err: error }, 'FTS search failed, will fall back to ILIKE');
      return null;
    }
  }

  /**
   * Trigram fuzzy search using pg_trgm for typo-tolerant matching.
   * Returns scored PartResult[] or null if pg_trgm is unavailable / returns 0 results.
   */
  private async trigramSearch(
    cleanedPhrase: string,
    organizationId: string,
    vehicleContext?: VehicleContext,
    mapping?: any
  ): Promise<PartResult[] | null> {
    try {
      let rows: FtsRow[];

      if (mapping?.postgresCategory && mapping?.postgresSubcategory) {
        rows = await prisma.$queryRaw<FtsRow[]>`
          SELECT "id", "partNumber", "description", "category", "subcategory",
                 "price"::text, "stockQuantity", "compatibility",
                 GREATEST(
                   similarity("description", ${cleanedPhrase}),
                   similarity("partNumber", ${cleanedPhrase}),
                   word_similarity(${cleanedPhrase}, "description")
                 ) AS rank
          FROM "parts"
          WHERE "organizationId" = ${organizationId}
            AND "isActive" = true
            AND "category" ILIKE ${'%' + mapping.postgresCategory + '%'}
            AND "subcategory" ILIKE ${'%' + mapping.postgresSubcategory + '%'}
            AND (
              similarity("description", ${cleanedPhrase}) > 0.3
              OR similarity("partNumber", ${cleanedPhrase}) > 0.3
              OR word_similarity(${cleanedPhrase}, "description") > 0.3
            )
          ORDER BY rank DESC
          LIMIT 20
        `;
      } else if (mapping?.postgresCategory) {
        rows = await prisma.$queryRaw<FtsRow[]>`
          SELECT "id", "partNumber", "description", "category", "subcategory",
                 "price"::text, "stockQuantity", "compatibility",
                 GREATEST(
                   similarity("description", ${cleanedPhrase}),
                   similarity("partNumber", ${cleanedPhrase}),
                   word_similarity(${cleanedPhrase}, "description")
                 ) AS rank
          FROM "parts"
          WHERE "organizationId" = ${organizationId}
            AND "isActive" = true
            AND "category" ILIKE ${'%' + mapping.postgresCategory + '%'}
            AND (
              similarity("description", ${cleanedPhrase}) > 0.3
              OR similarity("partNumber", ${cleanedPhrase}) > 0.3
              OR word_similarity(${cleanedPhrase}, "description") > 0.3
            )
          ORDER BY rank DESC
          LIMIT 20
        `;
      } else {
        rows = await prisma.$queryRaw<FtsRow[]>`
          SELECT "id", "partNumber", "description", "category", "subcategory",
                 "price"::text, "stockQuantity", "compatibility",
                 GREATEST(
                   similarity("description", ${cleanedPhrase}),
                   similarity("partNumber", ${cleanedPhrase}),
                   word_similarity(${cleanedPhrase}, "description")
                 ) AS rank
          FROM "parts"
          WHERE "organizationId" = ${organizationId}
            AND "isActive" = true
            AND (
              similarity("description", ${cleanedPhrase}) > 0.3
              OR similarity("partNumber", ${cleanedPhrase}) > 0.3
              OR word_similarity(${cleanedPhrase}, "description") > 0.3
            )
          ORDER BY rank DESC
          LIMIT 20
        `;
      }

      if (rows.length === 0) {
        log.info('Trigram returned 0 results');
        return null;
      }

      log.info({ count: rows.length }, 'Trigram results returned');

      const maxRank = Math.max(...rows.map(r => r.rank), 0.001);

      return rows.map(row => {
        // Score range 30-85 (lower than FTS since fuzzy matches are less precise)
        let score = Math.round((row.rank / maxRank) * 55) + 30;

        if (vehicleContext && row.compatibility) {
          const compat = row.compatibility as any;
          if (
            compat.makes?.includes(vehicleContext.make) ||
            compat.models?.includes(vehicleContext.model) ||
            compat.years?.includes(vehicleContext.year)
          ) {
            score += 15;
          }
        }

        if (row.stockQuantity > 0) {
          score += 5;
        }

        score = Math.min(score, 85);

        return {
          partNumber: row.partNumber,
          description: row.description,
          price: row.price ? parseFloat(row.price) : undefined,
          stockQuantity: row.stockQuantity,
          category: row.category || undefined,
          compatibility: row.compatibility,
          score,
          source: 'postgres' as const,
        };
      });
    } catch (error: any) {
      log.warn({ err: error }, 'Trigram search failed (pg_trgm may not be installed)');
      return null;
    }
  }

  async search(
    query: string,
    organizationId: string,
    vehicleContext?: VehicleContext
  ): Promise<PartResult[]> {
    try {
      log.info({ query, vehicleContext }, 'Search initiated');

      // Extract meaningful keywords (filter stop words and noise)
      const searchTerms = extractKeywords(query);
      log.debug({ keywords: searchTerms }, 'Extracted keywords');

      // If no meaningful keywords extracted, return empty
      if (searchTerms.length === 0) {
        log.warn('No meaningful search terms found');
        return [];
      }

      // Build a cleaned search phrase from keywords (for phrase-level matching)
      const cleanedPhrase = searchTerms.join(' ');

      // Get search mapping if vehicle context provided
      let mapping: any = null;
      if (vehicleContext?.vehicleId) {
        mapping = await prisma.vehicleSearchMapping.findFirst({
          where: { vehicleId: vehicleContext.vehicleId, organizationId },
        });

        if (mapping) {
          log.info({ vehicleId: vehicleContext.vehicleId }, 'Using search mapping for vehicle');
        } else {
          log.warn('No search mapping found');
        }
      }

      // Try FTS first (fast, uses GIN index). Falls back to ILIKE if FTS returns null.
      const ftsResults = await this.ftsSearch(cleanedPhrase, organizationId, vehicleContext, mapping);
      if (ftsResults !== null) {
        log.info({ count: ftsResults.length }, 'Using FTS results');
        return ftsResults;
      }

      log.info('FTS returned no results, falling back to ILIKE');

      // ILIKE fallback — handles partial matches, fragments, and cases FTS misses
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
        log.debug({
          postgresMake: mapping.postgresMake,
          postgresModel: mapping.postgresModel,
          postgresCategory: mapping.postgresCategory,
        }, 'Applying vehicle mapping filters');

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

      log.debug({ whereConditions }, 'ILIKE where conditions');

      // PostgreSQL full-text search
      const parts = await prisma.part.findMany({
        where: whereConditions,
        take: 100, // Get more results for better scoring
        orderBy: [
          { partNumber: 'asc' },
          { description: 'asc' },
        ],
      });

      log.info({ count: parts.length }, 'ILIKE raw results count');

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

      log.debug({
        top5: sortedResults.slice(0, 5).map(r => ({
          partNumber: r.partNumber,
          description: r.description,
          score: r.score,
          category: r.category,
        })),
      }, 'Top 5 scored results');

      // If ILIKE returned 0 results, try trigram fuzzy search as last resort
      if (sortedResults.length === 0) {
        log.info('ILIKE returned 0 results, trying trigram fuzzy search');
        const trigramResults = await this.trigramSearch(cleanedPhrase, organizationId, vehicleContext, mapping);
        if (trigramResults !== null) {
          log.info({ count: trigramResults.length }, 'Trigram fuzzy results');
          return trigramResults;
        }
      }

      return sortedResults;
    } catch (error: any) {
      log.error({ err: error }, 'PostgreSQL search error');
      throw new Error(`PostgreSQL search failed: ${error.message}`);
    }
  }
}
