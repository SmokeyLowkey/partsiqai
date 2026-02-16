import type { SearchResult, EnrichedPartResult } from './multi-agent-orchestrator';

export interface FormattedSearchResponse {
  // Main response text (for chat display)
  messageText: string;
  messageHtml: string;

  // Structured data (for UI components)
  parts: FormattedPart[];
  webParts?: FormattedPart[];
  summary: SearchSummary;
  recommendations: Recommendation[];
  filters: FilterOption[];
  relatedSearches: string[];

  // Metadata for UI
  metadata: {
    totalResults: number;
    searchTime: number;
    sourcesUsed: string[];
    hasMoreResults: boolean;
    queryIntent?: string;
  };

  // Flag indicating only web results are available (vehicle not configured)
  webSearchOnly?: boolean;
}

export interface FormattedPart {
  partNumber: string;
  description: string;
  price?: number;
  priceFormatted?: string;
  stockQuantity?: number;
  stockStatus: 'in-stock' | 'low-stock' | 'out-of-stock' | 'unknown';
  category?: string;
  confidence: number;
  confidenceLabel: 'high' | 'medium' | 'low';
  availability: string;
  compatibility?: {
    vehicles?: any[];
    relationships?: any[];
    models?: string[];
    manufacturers?: string[];
    serialRanges?: string[];
    categories?: string[];
    domains?: string[];
  };
  badges: Badge[];
  callToAction: string;
  foundBy?: string[];
  explanation?: string;
  isWebResult?: boolean;
  // Rich metadata from Pinecone
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

export interface SearchSummary {
  totalFound: number;
  topMatch?: string;
  averagePrice?: number;
  avgConfidence?: number;
  inStockCount: number;
  categoryBreakdown: Record<string, number>;
  webResultCount?: number;
}

export interface Recommendation {
  type: 'alternative' | 'upgrade' | 'bundle' | 'related';
  title: string;
  description: string;
  partNumbers: string[];
}

export interface FilterOption {
  label: string;
  value: string;
  count: number;
}

export interface Badge {
  text: string;
  variant: 'success' | 'warning' | 'info' | 'default';
  icon?: string;
}

export class ResponseFormatter {
  /**
   * Format search results for optimal UI display
   */
  formatSearchResults(
    searchResults: SearchResult,
    query: string,
    vehicleContext?: any
  ): FormattedSearchResponse {
    const formattedParts = this.formatParts(searchResults.results);
    const formattedWebParts = searchResults.webResults
      ? this.formatParts(searchResults.webResults)
      : undefined;
    const summary = this.generateSummary(searchResults.results, searchResults.webResults);
    const recommendations = this.generateRecommendations(searchResults.results);
    const filters = this.generateFilters(searchResults.results);

    // Generate natural language message
    const messageText = this.generateMessageText(
      query,
      formattedParts,
      summary,
      vehicleContext,
      formattedWebParts
    );

    const messageHtml = this.generateMessageHtml(
      query,
      formattedParts,
      summary,
      vehicleContext,
      formattedWebParts
    );

    return {
      messageText,
      messageHtml,
      parts: formattedParts,
      webParts: formattedWebParts,
      summary,
      recommendations,
      filters,
      relatedSearches: searchResults.relatedQueries,
      metadata: {
        ...searchResults.searchMetadata,
        hasMoreResults: searchResults.results.length > 10,
        queryIntent: searchResults.searchMetadata.queryIntent,
      },
    };
  }

  private formatParts(results: EnrichedPartResult[]): FormattedPart[] {
    return results.map((result) => {
      const badges = this.generateBadges(result);
      const stockStatus = this.determineStockStatus(result.stockQuantity);
      const confidenceLabel = this.getConfidenceLabel(result.confidence);

      return {
        partNumber: result.partNumber,
        description: result.description,
        price: result.price,
        priceFormatted: result.price ? `$${result.price.toFixed(2)}` : undefined,
        stockQuantity: result.stockQuantity,
        stockStatus,
        category: result.category,
        confidence: result.confidence,
        confidenceLabel,
        availability: this.getAvailabilityText(stockStatus, result.stockQuantity),
        compatibility: result.compatibility,
        badges,
        callToAction: this.getCallToAction(stockStatus, result.confidence, result.isWebResult),
        foundBy: result.foundBy,
        explanation: result.explanation,
        isWebResult: result.isWebResult,
        metadata: (result as any).metadata, // Pass through rich metadata from Pinecone
      };
    });
  }

  private generateBadges(result: EnrichedPartResult): Badge[] {
    const badges: Badge[] = [];

    // Web result badge
    if (result.isWebResult) {
      badges.push({
        text: 'From Web',
        variant: 'info',
        icon: '🌐',
      });
      // Web results get fewer badges — skip the multi-source and stock badges
      return badges;
    }

    // Multi-source badge
    if (result.foundBy.length > 1) {
      badges.push({
        text: 'Verified Match',
        variant: 'success',
        icon: '✓',
      });
    }

    // Confidence badge
    if (result.confidence >= 90) {
      badges.push({
        text: 'Exact Match',
        variant: 'success',
        icon: '⭐',
      });
    }

    // Stock badge
    if (result.stockQuantity && result.stockQuantity > 0) {
      badges.push({
        text: 'In Stock',
        variant: 'success',
        icon: '📦',
      });
    } else if (result.stockQuantity === 0) {
      badges.push({
        text: 'Out of Stock',
        variant: 'warning',
        icon: '⚠️',
      });
    }

    // Relationship badges (from Neo4j)
    if (result.compatibility?.relationships?.length > 0) {
      badges.push({
        text: `${result.compatibility.relationships.length} Compatible Parts`,
        variant: 'info',
        icon: '🔗',
      });
    }

    return badges;
  }

  private determineStockStatus(
    stockQuantity?: number
  ): 'in-stock' | 'low-stock' | 'out-of-stock' | 'unknown' {
    if (stockQuantity === undefined) return 'unknown';
    if (stockQuantity === 0) return 'out-of-stock';
    if (stockQuantity <= 5) return 'low-stock';
    return 'in-stock';
  }

  private getConfidenceLabel(confidence: number): 'high' | 'medium' | 'low' {
    if (confidence >= 80) return 'high';
    if (confidence >= 50) return 'medium';
    return 'low';
  }

  private getAvailabilityText(
    stockStatus: string,
    stockQuantity?: number
  ): string {
    switch (stockStatus) {
      case 'in-stock':
        return `${stockQuantity} units available`;
      case 'low-stock':
        return `Only ${stockQuantity} left in stock`;
      case 'out-of-stock':
        return 'Currently out of stock';
      default:
        return 'Availability unknown';
    }
  }

  private getCallToAction(stockStatus: string, confidence: number, isWebResult?: boolean): string {
    if (isWebResult) {
      return 'View Source';
    }
    if (stockStatus === 'in-stock' && confidence >= 80) {
      return 'Add to Quote Request';
    }
    if (stockStatus === 'in-stock') {
      return 'View Details';
    }
    if (stockStatus === 'out-of-stock') {
      return 'Request Quote';
    }
    return 'Check Availability';
  }

  private generateSummary(results: EnrichedPartResult[], webResults?: EnrichedPartResult[]): SearchSummary {
    const inStockCount = results.filter(
      (r) => r.stockQuantity && r.stockQuantity > 0
    ).length;

    const prices = results.map((r) => r.price).filter((p): p is number => p !== undefined);
    const averagePrice = prices.length > 0
      ? prices.reduce((a, b) => a + b, 0) / prices.length
      : undefined;

    // Calculate average confidence
    const avgConfidence = results.length > 0
      ? Math.round(results.reduce((sum, r) => sum + r.confidence, 0) / results.length)
      : undefined;

    const categoryBreakdown: Record<string, number> = {};
    results.forEach((r) => {
      if (r.category) {
        categoryBreakdown[r.category] = (categoryBreakdown[r.category] || 0) + 1;
      }
    });

    return {
      totalFound: results.length,
      topMatch: results[0]?.partNumber,
      averagePrice,
      avgConfidence,
      inStockCount,
      categoryBreakdown,
      webResultCount: webResults?.length,
    };
  }

  private generateRecommendations(results: EnrichedPartResult[]): Recommendation[] {
    const recommendations: Recommendation[] = [];

    // Find alternatives (parts with similar descriptions)
    const alternatives = results
      .filter((r) => r.compatibility?.relationships)
      .slice(0, 3);

    if (alternatives.length > 0) {
      recommendations.push({
        type: 'alternative',
        title: 'Compatible Alternatives',
        description: 'These parts may also work for your application',
        partNumbers: alternatives.map((r) => r.partNumber),
      });
    }

    // Find parts commonly ordered together (if available in compatibility data)
    // This would come from Neo4j relationships
    const bundleParts = results.filter(
      (r) => r.compatibility?.relationships?.some((rel: any) => rel.type === 'BUNDLED_WITH')
    );

    if (bundleParts.length > 0) {
      recommendations.push({
        type: 'bundle',
        title: 'Frequently Bought Together',
        description: 'Customers also purchased these items',
        partNumbers: bundleParts.map((r) => r.partNumber).slice(0, 3),
      });
    }

    return recommendations;
  }

  private generateFilters(results: EnrichedPartResult[]): FilterOption[] {
    const filters: FilterOption[] = [];

    // Category filters
    const categories = new Map<string, number>();
    results.forEach((r) => {
      if (r.category) {
        categories.set(r.category, (categories.get(r.category) || 0) + 1);
      }
    });

    categories.forEach((count, category) => {
      filters.push({
        label: category,
        value: `category:${category}`,
        count,
      });
    });

    // Stock status filters
    const inStockCount = results.filter((r) => r.stockQuantity && r.stockQuantity > 0).length;
    if (inStockCount > 0) {
      filters.push({
        label: 'In Stock',
        value: 'stock:available',
        count: inStockCount,
      });
    }

    // Price range filters
    const prices = results.map((r) => r.price).filter((p): p is number => p !== undefined);
    if (prices.length > 0) {
      const minPrice = Math.min(...prices);
      const maxPrice = Math.max(...prices);
      const range = maxPrice - minPrice;

      if (range > 50) {
        filters.push(
          {
            label: 'Under $50',
            value: 'price:0-50',
            count: prices.filter((p) => p < 50).length,
          },
          {
            label: '$50-$100',
            value: 'price:50-100',
            count: prices.filter((p) => p >= 50 && p < 100).length,
          },
          {
            label: 'Over $100',
            value: 'price:100+',
            count: prices.filter((p) => p >= 100).length,
          }
        );
      }
    }

    return filters;
  }

  private generateMessageText(
    query: string,
    parts: FormattedPart[],
    summary: SearchSummary,
    vehicleContext?: any,
    webParts?: FormattedPart[]
  ): string {
    const lines: string[] = [];

    // Opening line
    if (parts.length === 0 && (!webParts || webParts.length === 0)) {
      lines.push(`I couldn't find any parts matching "${query}".`);
      lines.push('');
      lines.push('Try:');
      lines.push('• Checking the part number spelling');
      lines.push('• Using a more general description');
      lines.push('• Browsing by category');
      return lines.join('\n');
    }

    // Success message
    const vehicle = vehicleContext
      ? `for your ${vehicleContext.year} ${vehicleContext.make} ${vehicleContext.model}`
      : '';

    lines.push(`I found ${summary.totalFound} part${summary.totalFound === 1 ? '' : 's'} matching "${query}" ${vehicle}.`);
    lines.push('');

    // Stock availability
    if (summary.inStockCount > 0) {
      lines.push(`✓ ${summary.inStockCount} ${summary.inStockCount === 1 ? 'is' : 'are'} currently in stock`);
    }

    // Price info
    if (summary.averagePrice) {
      lines.push(`💰 Average price: $${summary.averagePrice.toFixed(2)}`);
    }

    lines.push('');

    // Top matches
    lines.push('**Top Matches:**');
    parts.slice(0, 3).forEach((part, i) => {
      lines.push(`${i + 1}. **${part.partNumber}** - ${part.description}`);
      if (part.explanation) {
        lines.push(`   ${part.explanation}`);
      }
      if (part.priceFormatted) {
        lines.push(`   Price: ${part.priceFormatted} | ${part.availability}`);
      }
      lines.push('');
    });

    // Web results section
    if (webParts && webParts.length > 0) {
      lines.push('');
      lines.push('**From the Web** (unverified):');
      webParts.slice(0, 3).forEach((part, i) => {
        lines.push(`${i + 1}. **${part.partNumber}** - ${part.description}`);
        if (part.metadata?.sourceUrl) {
          lines.push(`   Source: ${part.metadata.sourceUrl}`);
        }
        if (part.priceFormatted) {
          lines.push(`   Price: ${part.priceFormatted}`);
        }
        lines.push('');
      });
    }

    // Call to action
    if (summary.inStockCount > 0) {
      lines.push('Would you like to add any of these to your quote request?');
    }

    return lines.join('\n');
  }

  private generateMessageHtml(
    query: string,
    parts: FormattedPart[],
    summary: SearchSummary,
    vehicleContext?: any,
    webParts?: FormattedPart[]
  ): string {
    if (parts.length === 0 && (!webParts || webParts.length === 0)) {
      return `
        <div class="search-results empty">
          <p>I couldn't find any parts matching <strong>"${query}"</strong>.</p>
          <p><strong>Try:</strong></p>
          <ul>
            <li>Checking the part number spelling</li>
            <li>Using a more general description</li>
            <li>Browsing by category</li>
          </ul>
        </div>
      `;
    }

    const vehicle = vehicleContext
      ? `for your ${vehicleContext.year} ${vehicleContext.make} ${vehicleContext.model}`
      : '';

    let html = `
      <div class="search-results success">
        <p>I found <strong>${summary.totalFound}</strong> part${summary.totalFound === 1 ? '' : 's'} matching <strong>"${query}"</strong> ${vehicle}.</p>

        <div class="search-summary">
          ${summary.inStockCount > 0 ? `<div class="summary-item success">✓ ${summary.inStockCount} in stock</div>` : ''}
          ${summary.averagePrice ? `<div class="summary-item">💰 Avg: $${summary.averagePrice.toFixed(2)}</div>` : ''}
        </div>

        <div class="top-matches">
          <h4>Top Matches:</h4>
          ${parts
            .slice(0, 3)
            .map(
              (part, i) => `
            <div class="part-match">
              <div class="part-header">
                <span class="part-rank">${i + 1}</span>
                <strong>${part.partNumber}</strong>
                ${part.badges.map((badge) => `<span class="badge badge-${badge.variant}">${badge.icon} ${badge.text}</span>`).join('')}
              </div>
              <p class="part-description">${part.description}</p>
              ${part.explanation ? `<p class="part-explanation">${part.explanation}</p>` : ''}
              <div class="part-meta">
                ${part.priceFormatted ? `<span class="price">${part.priceFormatted}</span>` : ''}
                <span class="availability ${part.stockStatus}">${part.availability}</span>
              </div>
            </div>
          `
            )
            .join('')}
        </div>`;

    // Web results section
    if (webParts && webParts.length > 0) {
      html += `
        <div class="web-results">
          <h4>From the Web <span class="badge badge-info">🌐 Unverified</span></h4>
          ${webParts
            .slice(0, 3)
            .map(
              (part, i) => `
            <div class="part-match web-match">
              <div class="part-header">
                <span class="part-rank">${i + 1}</span>
                <strong>${part.partNumber}</strong>
                ${part.badges.map((badge) => `<span class="badge badge-${badge.variant}">${badge.icon} ${badge.text}</span>`).join('')}
              </div>
              <p class="part-description">${part.description}</p>
              <div class="part-meta">
                ${part.priceFormatted ? `<span class="price">${part.priceFormatted}</span>` : ''}
                ${part.metadata?.sourceUrl ? `<a href="${part.metadata.sourceUrl}" target="_blank" class="source-link">View Source</a>` : ''}
              </div>
            </div>
          `
            )
            .join('')}
        </div>`;
    }

    html += `
        ${summary.inStockCount > 0 ? '<p class="cta">Would you like to add any of these to your quote request?</p>' : ''}
      </div>
    `;

    return html;
  }
}
