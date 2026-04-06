import type { Metadata } from "next"
import { Button } from "@/components/ui/button"
import {
  ArrowRight,
  Brain,
  Search,
  Database,
  MessageSquare,
  Truck,
  CheckCircle,
  XCircle,
  Gauge,
  ChevronDown,
  Sparkles,
  Network,
} from "lucide-react"
import Link from "next/link"
import { JsonLd } from "@/components/seo/json-ld"
import { BreadcrumbJsonLd } from "@/components/seo/breadcrumb-jsonld"
import { PublicFooter } from "@/components/layout/public-footer"
import { RelatedSolutions } from "@/components/solutions/related-solutions"

export const metadata: Metadata = {
  title: "AI-Powered Parts Search Engine",
  description:
    "Semantic AI parts search across 3 databases simultaneously. Natural language queries, vehicle context awareness, and 95% match accuracy for industrial parts.",
  keywords: [
    "AI parts lookup",
    "semantic parts search",
    "industrial parts search engine",
    "AI parts finder",
    "intelligent parts search",
    "vector search parts",
    "natural language parts search",
    "parts number cross reference",
  ],
  alternates: {
    canonical: "/solutions/ai-parts-search",
  },
  openGraph: {
    title: "AI-Powered Industrial Parts Search Engine",
    description:
      "Multi-agent AI search across SQL, vector, and graph databases. Natural language queries with 95% accuracy for industrial parts lookup.",
    url: "/solutions/ai-parts-search",
  },
}

const faqJsonLd = {
  "@context": "https://schema.org",
  "@type": "FAQPage",
  mainEntity: [
    {
      "@type": "Question",
      name: "How does AI parts search differ from traditional keyword search?",
      acceptedAnswer: {
        "@type": "Answer",
        text: "Traditional keyword search requires exact part numbers or precise terminology. PartsIQ's AI search uses semantic understanding to interpret natural language descriptions like 'hydraulic pump seal for excavator.' It searches across vector embeddings, graph relationships, and full-text indexes simultaneously, finding parts that keyword search would miss entirely.",
      },
    },
    {
      "@type": "Question",
      name: "What databases does the multi-agent search query?",
      acceptedAnswer: {
        "@type": "Answer",
        text: "PartsIQ's multi-agent orchestrator searches three databases in parallel: PostgreSQL for structured inventory data and full-text search, Pinecone for semantic vector similarity matching, and Neo4j for graph-based relationship traversal (manufacturer-model-part connections, cross-references, and compatibility data).",
      },
    },
    {
      "@type": "Question",
      name: "Can the AI search understand vehicle context for compatibility matching?",
      acceptedAnswer: {
        "@type": "Answer",
        text: "Yes. When you specify a vehicle (e.g., 'Cat 320GC excavator'), the AI search engine uses that context to filter results by manufacturer, model, and serial number range. The Neo4j graph database maps part-to-vehicle relationships, ensuring search results are compatible with your specific equipment.",
      },
    },
    {
      "@type": "Question",
      name: "What is confidence scoring and how does it help?",
      acceptedAnswer: {
        "@type": "Answer",
        text: "Every search result includes a confidence score (0-100%) that indicates how well the part matches your query. The score is calculated from multiple signals: semantic similarity, exact text matches, graph relationship strength, and vehicle compatibility. High-confidence results appear first, helping you quickly identify the right part without manual verification.",
      },
    },
  ],
}

export default function AiPartsSearchPage() {
  return (
    <>
      <JsonLd data={faqJsonLd} />
      <BreadcrumbJsonLd
        items={[
          { name: "Home", url: "/" },
          { name: "Solutions", url: "/solutions" },
          { name: "AI Parts Search", url: "/solutions/ai-parts-search" },
        ]}
      />
      <div className="min-h-screen bg-white">
        {/* Hero Section */}
        <section className="relative bg-slate-950 text-white py-24">
          <div className="absolute inset-0 bg-[linear-gradient(rgba(148,163,184,0.05)_1px,transparent_1px),linear-gradient(90deg,rgba(148,163,184,0.05)_1px,transparent_1px)] bg-[size:64px_64px]"></div>

          <div className="relative container mx-auto px-6">
            <div className="max-w-4xl mx-auto text-center">
              <div className="inline-flex items-center gap-2 bg-emerald-500/10 border border-emerald-500/20 rounded-full px-4 py-1.5 text-emerald-400 text-sm font-medium mb-6">
                <Brain className="h-4 w-4" />
                AI Search Technology
              </div>
              <h1 className="text-5xl md:text-6xl font-bold mb-6 tracking-tight">
                AI-Powered Industrial Parts Search Engine
              </h1>
              <p className="text-xl text-slate-400 mb-8 max-w-2xl mx-auto">
                Stop searching with keywords. Describe what you need in plain English and let multi-agent AI search three databases simultaneously to find the exact part — with confidence scoring on every result.
              </p>
              <div className="flex flex-col sm:flex-row gap-4 justify-center">
                <Link href="/signup">
                  <Button size="lg" className="bg-white text-slate-950 hover:bg-slate-100 px-8 h-14 text-lg font-medium">
                    Try AI Search Free
                    <ArrowRight className="ml-2 h-5 w-5" />
                  </Button>
                </Link>
                <Link href="/pricing">
                  <Button size="lg" variant="outline" className="border-slate-700 text-white hover:bg-slate-900 bg-transparent px-8 h-14 text-lg">
                    View Pricing
                  </Button>
                </Link>
              </div>
            </div>
          </div>
        </section>

        {/* Problem Section */}
        <section className="py-24 bg-white">
          <div className="container mx-auto px-6">
            <div className="max-w-6xl mx-auto">
              <div className="mb-16 text-center">
                <h2 className="text-4xl md:text-5xl font-bold mb-4 text-slate-950 tracking-tight">
                  Keyword search fails for industrial parts
                </h2>
                <p className="text-xl text-slate-600 max-w-2xl mx-auto">
                  Traditional search only works when you already know the exact part number. That is rarely the case.
                </p>
              </div>

              <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-8">
                <div className="text-center p-6">
                  <div className="w-12 h-12 bg-red-50 rounded-lg flex items-center justify-center mx-auto mb-4">
                    <XCircle className="h-6 w-6 text-red-500" />
                  </div>
                  <h3 className="text-lg font-bold text-slate-950 mb-2">Missed Results</h3>
                  <p className="text-slate-600 text-sm">Keyword search misses parts when descriptions do not match exactly. Different terminology for the same part returns zero results.</p>
                </div>
                <div className="text-center p-6">
                  <div className="w-12 h-12 bg-red-50 rounded-lg flex items-center justify-center mx-auto mb-4">
                    <Search className="h-6 w-6 text-red-500" />
                  </div>
                  <h3 className="text-lg font-bold text-slate-950 mb-2">Manual Cross-Referencing</h3>
                  <p className="text-slate-600 text-sm">Finding equivalent parts across manufacturers requires checking multiple catalogs and reference documents by hand.</p>
                </div>
                <div className="text-center p-6">
                  <div className="w-12 h-12 bg-red-50 rounded-lg flex items-center justify-center mx-auto mb-4">
                    <Truck className="h-6 w-6 text-red-500" />
                  </div>
                  <h3 className="text-lg font-bold text-slate-950 mb-2">No Context Awareness</h3>
                  <p className="text-slate-600 text-sm">Traditional search does not understand that a &quot;filter&quot; for a Cat 320 is different from a &quot;filter&quot; for a Komatsu PC200.</p>
                </div>
                <div className="text-center p-6">
                  <div className="w-12 h-12 bg-red-50 rounded-lg flex items-center justify-center mx-auto mb-4">
                    <Gauge className="h-6 w-6 text-red-500" />
                  </div>
                  <h3 className="text-lg font-bold text-slate-950 mb-2">No Confidence Scoring</h3>
                  <p className="text-slate-600 text-sm">Keyword results give no indication of match quality. You have to manually verify every result before ordering.</p>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* Solution Features */}
        <section className="py-24 bg-slate-50">
          <div className="container mx-auto px-6">
            <div className="max-w-6xl mx-auto">
              <div className="mb-16 text-center">
                <h2 className="text-4xl font-bold mb-4 text-slate-950 tracking-tight">
                  Multi-agent AI that understands parts
                </h2>
                <p className="text-xl text-slate-600 max-w-2xl mx-auto">
                  Three specialized search agents work in parallel, combining their results for maximum accuracy.
                </p>
              </div>

              <div className="grid md:grid-cols-2 gap-12">
                <div className="flex gap-6">
                  <div className="flex-shrink-0">
                    <div className="w-12 h-12 bg-slate-950 rounded-lg flex items-center justify-center">
                      <Sparkles className="h-6 w-6 text-white" />
                    </div>
                  </div>
                  <div>
                    <h3 className="text-2xl font-bold text-slate-950 mb-3">Semantic Vector Search</h3>
                    <p className="text-slate-600 mb-4 leading-relaxed">
                      Powered by 1024-dimensional vector embeddings, the semantic search agent understands the meaning behind your query. &quot;Hydraulic cylinder seal kit&quot; matches parts described as &quot;cylinder repair kit&quot; or &quot;hydraulic rod seal set.&quot;
                    </p>
                    <ul className="space-y-2 text-slate-600">
                      <li className="flex items-start gap-2">
                        <CheckCircle className="h-5 w-5 text-emerald-600 mt-0.5 flex-shrink-0" />
                        <span>Understands synonyms and related terms</span>
                      </li>
                      <li className="flex items-start gap-2">
                        <CheckCircle className="h-5 w-5 text-emerald-600 mt-0.5 flex-shrink-0" />
                        <span>Dense + sparse hybrid retrieval</span>
                      </li>
                    </ul>
                  </div>
                </div>

                <div className="flex gap-6">
                  <div className="flex-shrink-0">
                    <div className="w-12 h-12 bg-slate-950 rounded-lg flex items-center justify-center">
                      <Network className="h-6 w-6 text-white" />
                    </div>
                  </div>
                  <div>
                    <h3 className="text-2xl font-bold text-slate-950 mb-3">Graph Relationship Search</h3>
                    <p className="text-slate-600 mb-4 leading-relaxed">
                      The Neo4j graph agent traverses manufacturer-model-part relationships to find parts connected to your equipment. It discovers cross-references and compatibility matches that flat search cannot.
                    </p>
                    <ul className="space-y-2 text-slate-600">
                      <li className="flex items-start gap-2">
                        <CheckCircle className="h-5 w-5 text-emerald-600 mt-0.5 flex-shrink-0" />
                        <span>Relationship-based part discovery</span>
                      </li>
                      <li className="flex items-start gap-2">
                        <CheckCircle className="h-5 w-5 text-emerald-600 mt-0.5 flex-shrink-0" />
                        <span>Cross-manufacturer compatibility mapping</span>
                      </li>
                    </ul>
                  </div>
                </div>

                <div className="flex gap-6">
                  <div className="flex-shrink-0">
                    <div className="w-12 h-12 bg-slate-950 rounded-lg flex items-center justify-center">
                      <MessageSquare className="h-6 w-6 text-white" />
                    </div>
                  </div>
                  <div>
                    <h3 className="text-2xl font-bold text-slate-950 mb-3">Natural Language Queries</h3>
                    <p className="text-slate-600 mb-4 leading-relaxed">
                      Ask for parts the way you would describe them to a colleague. The query understanding engine parses your intent, extracts equipment context, and routes the search to the right agents.
                    </p>
                    <ul className="space-y-2 text-slate-600">
                      <li className="flex items-start gap-2">
                        <CheckCircle className="h-5 w-5 text-emerald-600 mt-0.5 flex-shrink-0" />
                        <span>&quot;I need a fuel filter for a 2019 Cat 320GC&quot;</span>
                      </li>
                      <li className="flex items-start gap-2">
                        <CheckCircle className="h-5 w-5 text-emerald-600 mt-0.5 flex-shrink-0" />
                        <span>&quot;Track roller for Komatsu PC200-8&quot;</span>
                      </li>
                    </ul>
                  </div>
                </div>

                <div className="flex gap-6">
                  <div className="flex-shrink-0">
                    <div className="w-12 h-12 bg-slate-950 rounded-lg flex items-center justify-center">
                      <Truck className="h-6 w-6 text-white" />
                    </div>
                  </div>
                  <div>
                    <h3 className="text-2xl font-bold text-slate-950 mb-3">Vehicle Context Awareness</h3>
                    <p className="text-slate-600 mb-4 leading-relaxed">
                      Specify your equipment and the search automatically filters for compatible parts. Serial number ranges, model years, and configuration variants are all considered.
                    </p>
                    <ul className="space-y-2 text-slate-600">
                      <li className="flex items-start gap-2">
                        <CheckCircle className="h-5 w-5 text-emerald-600 mt-0.5 flex-shrink-0" />
                        <span>Serial number range validation</span>
                      </li>
                      <li className="flex items-start gap-2">
                        <CheckCircle className="h-5 w-5 text-emerald-600 mt-0.5 flex-shrink-0" />
                        <span>Equipment-specific part filtering</span>
                      </li>
                    </ul>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* How It Works Section */}
        <section className="py-24 bg-white">
          <div className="container mx-auto px-6">
            <div className="max-w-6xl mx-auto">
              <div className="mb-16 text-center">
                <h2 className="text-4xl font-bold mb-4 text-slate-950 tracking-tight">
                  How AI parts search works
                </h2>
                <p className="text-xl text-slate-600 max-w-2xl mx-auto">
                  From natural language query to supplier quote in four simple steps. Our AI parts lookup engine handles the complexity so you do not have to.
                </p>
              </div>

              <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-8">
                <div className="text-center p-6">
                  <div className="w-12 h-12 bg-slate-950 rounded-full flex items-center justify-center mx-auto mb-4 text-white font-bold text-lg">
                    1
                  </div>
                  <h3 className="text-lg font-bold text-slate-950 mb-2">Describe What You Need</h3>
                  <p className="text-slate-600 text-sm">
                    Type a plain English description of the part you are looking for. No part numbers required. Our semantic parts search understands phrases like &quot;hydraulic cylinder seal for a 2018 Cat 336&quot; just as well as an exact OEM number.
                  </p>
                </div>
                <div className="text-center p-6">
                  <div className="w-12 h-12 bg-slate-950 rounded-full flex items-center justify-center mx-auto mb-4 text-white font-bold text-lg">
                    2
                  </div>
                  <h3 className="text-lg font-bold text-slate-950 mb-2">AI Searches 3 Databases</h3>
                  <p className="text-slate-600 text-sm">
                    The parts search engine dispatches your query to three specialized agents simultaneously: PostgreSQL for structured data, Pinecone for vector similarity, and Neo4j for graph-based relationship matching. All three return results in parallel.
                  </p>
                </div>
                <div className="text-center p-6">
                  <div className="w-12 h-12 bg-slate-950 rounded-full flex items-center justify-center mx-auto mb-4 text-white font-bold text-lg">
                    3
                  </div>
                  <h3 className="text-lg font-bold text-slate-950 mb-2">Results Ranked by Confidence</h3>
                  <p className="text-slate-600 text-sm">
                    Every result is assigned a confidence score based on semantic similarity, text match strength, graph relationships, and equipment compatibility. The AI parts search algorithm surfaces the best matches first so you can make decisions quickly.
                  </p>
                </div>
                <div className="text-center p-6">
                  <div className="w-12 h-12 bg-slate-950 rounded-full flex items-center justify-center mx-auto mb-4 text-white font-bold text-lg">
                    4
                  </div>
                  <h3 className="text-lg font-bold text-slate-950 mb-2">One-Click Quote Request</h3>
                  <p className="text-slate-600 text-sm">
                    Found the right part? Send a quote request to your suppliers with a single click. PartsIQ connects your ai parts lookup results directly to the procurement workflow, eliminating copy-paste between systems.
                  </p>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* Built for Heavy Equipment Section */}
        <section className="py-24 bg-slate-50">
          <div className="container mx-auto px-6">
            <div className="max-w-6xl mx-auto">
              <div className="mb-16 text-center">
                <h2 className="text-4xl font-bold mb-4 text-slate-950 tracking-tight">
                  Built for heavy equipment parts sourcing
                </h2>
                <p className="text-xl text-slate-600 max-w-2xl mx-auto">
                  Generic search tools were not designed for industrial parts. PartsIQ&apos;s AI inventory management understands the unique challenges of heavy equipment procurement.
                </p>
              </div>

              <div className="grid md:grid-cols-3 gap-10">
                <div className="bg-white rounded-lg p-8 border border-slate-200">
                  <h3 className="text-xl font-bold text-slate-950 mb-4">Cross-Reference Across Brands</h3>
                  <p className="text-slate-600 mb-4 leading-relaxed">
                    Need a Caterpillar part but want to check Komatsu equivalents? The AI parts search engine traverses cross-reference graphs to find compatible alternatives from other manufacturers. Stop paying OEM prices when aftermarket or cross-brand options exist.
                  </p>
                  <ul className="space-y-2 text-slate-600">
                    <li className="flex items-start gap-2">
                      <CheckCircle className="h-5 w-5 text-emerald-600 mt-0.5 flex-shrink-0" />
                      <span>CAT to Komatsu equivalent lookups</span>
                    </li>
                    <li className="flex items-start gap-2">
                      <CheckCircle className="h-5 w-5 text-emerald-600 mt-0.5 flex-shrink-0" />
                      <span>OEM to aftermarket cross-referencing</span>
                    </li>
                  </ul>
                </div>

                <div className="bg-white rounded-lg p-8 border border-slate-200">
                  <h3 className="text-xl font-bold text-slate-950 mb-4">Maintenance Manual Part Lookups</h3>
                  <p className="text-slate-600 mb-4 leading-relaxed">
                    Technicians often describe parts using service manual terminology that does not match catalog listings. Our semantic parts search bridges that gap, interpreting maintenance language and mapping it to the correct inventory items in your ai inventory management system.
                  </p>
                  <ul className="space-y-2 text-slate-600">
                    <li className="flex items-start gap-2">
                      <CheckCircle className="h-5 w-5 text-emerald-600 mt-0.5 flex-shrink-0" />
                      <span>Service manual terminology understood</span>
                    </li>
                    <li className="flex items-start gap-2">
                      <CheckCircle className="h-5 w-5 text-emerald-600 mt-0.5 flex-shrink-0" />
                      <span>Technician-friendly natural language input</span>
                    </li>
                  </ul>
                </div>

                <div className="bg-white rounded-lg p-8 border border-slate-200">
                  <h3 className="text-xl font-bold text-slate-950 mb-4">Legacy Equipment Support</h3>
                  <p className="text-slate-600 mb-4 leading-relaxed">
                    Discontinued part numbers are a constant headache for fleets running older equipment. The ai parts lookup engine uses graph relationships and semantic matching to find current replacements, superseded numbers, and compatible substitutes for legacy parts.
                  </p>
                  <ul className="space-y-2 text-slate-600">
                    <li className="flex items-start gap-2">
                      <CheckCircle className="h-5 w-5 text-emerald-600 mt-0.5 flex-shrink-0" />
                      <span>Superseded part number resolution</span>
                    </li>
                    <li className="flex items-start gap-2">
                      <CheckCircle className="h-5 w-5 text-emerald-600 mt-0.5 flex-shrink-0" />
                      <span>Compatible substitute identification</span>
                    </li>
                  </ul>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* Metrics Section */}
        <section className="py-24 bg-slate-950 text-white">
          <div className="container mx-auto px-6">
            <div className="max-w-6xl mx-auto">
              <div className="mb-16 text-center">
                <h2 className="text-4xl font-bold mb-4 tracking-tight">
                  Search accuracy that outperforms keyword lookups
                </h2>
                <p className="text-lg text-slate-400 max-w-2xl mx-auto">
                  Multi-agent AI delivers results that traditional search cannot match.
                </p>
              </div>

              <div className="grid md:grid-cols-3 gap-8">
                <div className="text-center p-8 border border-slate-800 rounded-lg">
                  <div className="text-5xl font-bold text-emerald-400 mb-2">95%</div>
                  <div className="text-lg font-medium mb-2">Match Accuracy</div>
                  <p className="text-slate-400 text-sm">Confidence-scored results with multi-signal verification across semantic, structural, and graph-based matching.</p>
                </div>
                <div className="text-center p-8 border border-slate-800 rounded-lg">
                  <div className="text-5xl font-bold text-emerald-400 mb-2">3</div>
                  <div className="text-lg font-medium mb-2">Databases Searched</div>
                  <p className="text-slate-400 text-sm">PostgreSQL, Pinecone, and Neo4j searched in parallel by specialized agents for comprehensive coverage.</p>
                </div>
                <div className="text-center p-8 border border-slate-800 rounded-lg">
                  <div className="flex items-center justify-center gap-2 mb-2">
                    <MessageSquare className="h-10 w-10 text-emerald-400" />
                  </div>
                  <div className="text-lg font-medium mb-2">Natural Language</div>
                  <p className="text-slate-400 text-sm">Describe parts in your own words. No need to memorize part numbers or use specific catalog terminology.</p>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* FAQ Section */}
        <section className="py-24 bg-white">
          <div className="container mx-auto px-6">
            <div className="max-w-3xl mx-auto">
              <div className="mb-16 text-center">
                <h2 className="text-4xl font-bold mb-4 text-slate-950 tracking-tight">
                  Frequently asked questions
                </h2>
                <p className="text-xl text-slate-600">
                  Common questions about AI-powered parts search.
                </p>
              </div>

              <div className="space-y-6">
                <div className="border border-slate-200 rounded-lg p-6">
                  <h3 className="text-lg font-bold text-slate-950 mb-3 flex items-center gap-2">
                    <ChevronDown className="h-5 w-5 text-slate-400" />
                    How does AI parts search differ from traditional keyword search?
                  </h3>
                  <p className="text-slate-600 pl-7">
                    Traditional keyword search requires exact part numbers or precise terminology. PartsIQ&apos;s AI search uses semantic understanding to interpret natural language descriptions like &quot;hydraulic pump seal for excavator.&quot; It searches across vector embeddings, graph relationships, and full-text indexes simultaneously, finding parts that keyword search would miss entirely.
                  </p>
                </div>

                <div className="border border-slate-200 rounded-lg p-6">
                  <h3 className="text-lg font-bold text-slate-950 mb-3 flex items-center gap-2">
                    <ChevronDown className="h-5 w-5 text-slate-400" />
                    What databases does the multi-agent search query?
                  </h3>
                  <p className="text-slate-600 pl-7">
                    PartsIQ&apos;s multi-agent orchestrator searches three databases in parallel: PostgreSQL for structured inventory data and full-text search, Pinecone for semantic vector similarity matching, and Neo4j for graph-based relationship traversal (manufacturer-model-part connections, cross-references, and compatibility data).
                  </p>
                </div>

                <div className="border border-slate-200 rounded-lg p-6">
                  <h3 className="text-lg font-bold text-slate-950 mb-3 flex items-center gap-2">
                    <ChevronDown className="h-5 w-5 text-slate-400" />
                    Can the AI search understand vehicle context for compatibility matching?
                  </h3>
                  <p className="text-slate-600 pl-7">
                    Yes. When you specify a vehicle (e.g., &quot;Cat 320GC excavator&quot;), the AI search engine uses that context to filter results by manufacturer, model, and serial number range. The Neo4j graph database maps part-to-vehicle relationships, ensuring search results are compatible with your specific equipment.
                  </p>
                </div>

                <div className="border border-slate-200 rounded-lg p-6">
                  <h3 className="text-lg font-bold text-slate-950 mb-3 flex items-center gap-2">
                    <ChevronDown className="h-5 w-5 text-slate-400" />
                    What is confidence scoring and how does it help?
                  </h3>
                  <p className="text-slate-600 pl-7">
                    Every search result includes a confidence score (0-100%) that indicates how well the part matches your query. The score is calculated from multiple signals: semantic similarity, exact text matches, graph relationship strength, and vehicle compatibility. High-confidence results appear first, helping you quickly identify the right part without manual verification.
                  </p>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* CTA Section */}
        <section className="py-24 bg-slate-50">
          <div className="container mx-auto px-6">
            <div className="max-w-4xl mx-auto text-center">
              <h2 className="text-4xl md:text-5xl font-bold mb-6 text-slate-950 tracking-tight">
                Experience the future of parts search
              </h2>
              <p className="text-xl text-slate-600 mb-8">
                Try AI-powered search on your own parts catalog. Find parts in seconds that keyword search would never surface.
              </p>
              <div className="flex flex-col sm:flex-row gap-4 justify-center">
                <Link href="/signup">
                  <Button size="lg" className="bg-slate-950 text-white hover:bg-slate-800 px-8 h-14 text-lg font-medium">
                    Start Free Trial
                    <ArrowRight className="ml-2 h-5 w-5" />
                  </Button>
                </Link>
                <Link href="/pricing">
                  <Button size="lg" variant="outline" className="border-slate-300 text-slate-950 hover:bg-slate-100 hover:text-slate-950 bg-transparent px-8 h-14 text-lg">
                    View Pricing
                  </Button>
                </Link>
              </div>
            </div>
          </div>
        </section>
      </div>
      <RelatedSolutions currentSlug="ai-parts-search" />
      <PublicFooter />
    </>
  )
}
