import type { Metadata } from "next"
import { Button } from "@/components/ui/button"
import {
  ArrowRight,
  Brain,
  Search,
  BarChart3,
  RefreshCw,
  Wrench,
  CheckCircle,
  XCircle,
  AlertTriangle,
  ChevronDown,
  TrendingUp,
  PackageSearch,
} from "lucide-react"
import Link from "next/link"
import { JsonLd } from "@/components/seo/json-ld"
import { BreadcrumbJsonLd } from "@/components/seo/breadcrumb-jsonld"
import { PublicFooter } from "@/components/layout/public-footer"
import { RelatedSolutions } from "@/components/solutions/related-solutions"

export const metadata: Metadata = {
  title: "AI Inventory Management Software",
  description:
    "AI inventory management software that automates demand forecasting, reorder points, and parts search. AI powered inventory management for industrial operations.",
  keywords: [
    "ai inventory management",
    "ai powered inventory management",
    "ai inventory management software",
    "intelligent inventory management",
    "automated inventory management",
    "predictive inventory management",
    "ai inventory optimization",
    "smart inventory management system",
  ],
  alternates: {
    canonical: "/solutions/ai-inventory-management",
  },
  openGraph: {
    title: "AI Inventory Management Software for Industrial Operations",
    description:
      "AI powered inventory management with demand forecasting, intelligent parts search, and automated reorder management. Reduce stockouts by 85%.",
    url: "/solutions/ai-inventory-management",
  },
}

const faqJsonLd = {
  "@context": "https://schema.org",
  "@type": "FAQPage",
  mainEntity: [
    {
      "@type": "Question",
      name: "How does AI improve inventory management over traditional methods?",
      acceptedAnswer: {
        "@type": "Answer",
        text: "AI inventory management analyzes historical consumption patterns, seasonal trends, equipment utilization data, and supplier lead times to forecast demand with far greater accuracy than manual methods. Instead of relying on static reorder points or gut instinct, AI continuously learns from your actual usage data to optimize stock levels, reducing both stockouts and excess inventory.",
      },
    },
    {
      "@type": "Question",
      name: "What types of businesses benefit most from AI inventory management?",
      acceptedAnswer: {
        "@type": "Answer",
        text: "AI inventory management delivers the greatest ROI for businesses managing large catalogs of industrial parts, heavy equipment components, or MRO supplies. Operations with hundreds or thousands of SKUs, multiple warehouse locations, or complex equipment fleets see the biggest improvements because AI can process the volume and complexity that overwhelms manual inventory planning.",
      },
    },
    {
      "@type": "Question",
      name: "How long does it take to see results from AI inventory management software?",
      acceptedAnswer: {
        "@type": "Answer",
        text: "Most PartsIQ customers see measurable improvements within 30 days. The AI begins learning from your historical data immediately after import, generating demand forecasts and reorder recommendations within the first week. Stockout reductions and carrying cost savings typically become significant within the first month as the system optimizes your reorder points and safety stock levels.",
      },
    },
    {
      "@type": "Question",
      name: "Can AI inventory management integrate with existing ERP or warehouse systems?",
      acceptedAnswer: {
        "@type": "Answer",
        text: "PartsIQ supports CSV data import for parts catalogs and inventory records, making it easy to get started regardless of your current system. The platform manages the complete inventory workflow with its own AI-powered database and analytics. API integrations with major ERP and warehouse management systems are on the product roadmap for seamless data synchronization.",
      },
    },
  ],
}

export default function AiInventoryManagementPage() {
  return (
    <>
      <JsonLd data={faqJsonLd} />
      <BreadcrumbJsonLd
        items={[
          { name: "Home", url: "/" },
          { name: "Solutions", url: "/solutions" },
          { name: "AI Inventory Management", url: "/solutions/ai-inventory-management" },
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
                AI-Powered Solution
              </div>
              <h1 className="text-5xl md:text-6xl font-bold mb-6 tracking-tight">
                AI Inventory Management Software for Industrial Operations
              </h1>
              <p className="text-xl text-slate-400 mb-8 max-w-2xl mx-auto">
                Stop guessing what to order and when. AI powered inventory management analyzes your consumption patterns, predicts demand, and automates reordering — so the right parts are always on the shelf when your equipment needs them.
              </p>
              <div className="flex flex-col sm:flex-row gap-4 justify-center">
                <Link href="/signup">
                  <Button size="lg" className="bg-white text-slate-950 hover:bg-slate-100 px-8 h-14 text-lg font-medium">
                    Start Free Trial
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
                  Manual inventory management costs you more than you think
                </h2>
                <p className="text-xl text-slate-600 max-w-2xl mx-auto">
                  Spreadsheets and gut instinct cannot keep up with the complexity of modern industrial inventory. The result is stockouts, overstocking, and wasted capital.
                </p>
              </div>

              <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-8">
                <div className="text-center p-6">
                  <div className="w-12 h-12 bg-red-50 rounded-lg flex items-center justify-center mx-auto mb-4">
                    <XCircle className="h-6 w-6 text-red-500" />
                  </div>
                  <h3 className="text-lg font-bold text-slate-950 mb-2">Unexpected Stockouts</h3>
                  <p className="text-slate-600 text-sm">Critical parts run out without warning because static reorder points cannot account for changing demand patterns or seasonal fluctuations.</p>
                </div>
                <div className="text-center p-6">
                  <div className="w-12 h-12 bg-red-50 rounded-lg flex items-center justify-center mx-auto mb-4">
                    <PackageSearch className="h-6 w-6 text-red-500" />
                  </div>
                  <h3 className="text-lg font-bold text-slate-950 mb-2">Excess Dead Stock</h3>
                  <p className="text-slate-600 text-sm">Overstocking ties up capital in parts that sit on shelves for months. Without demand intelligence, safety stock levels are set too high across the board.</p>
                </div>
                <div className="text-center p-6">
                  <div className="w-12 h-12 bg-red-50 rounded-lg flex items-center justify-center mx-auto mb-4">
                    <AlertTriangle className="h-6 w-6 text-red-500" />
                  </div>
                  <h3 className="text-lg font-bold text-slate-950 mb-2">Reactive Reordering</h3>
                  <p className="text-slate-600 text-sm">Orders are placed after a stockout happens, not before. Every emergency order means rush shipping costs and equipment sitting idle while you wait.</p>
                </div>
                <div className="text-center p-6">
                  <div className="w-12 h-12 bg-red-50 rounded-lg flex items-center justify-center mx-auto mb-4">
                    <Search className="h-6 w-6 text-red-500" />
                  </div>
                  <h3 className="text-lg font-bold text-slate-950 mb-2">Slow Parts Identification</h3>
                  <p className="text-slate-600 text-sm">Finding the right part in a catalog of thousands takes too long. Keyword search fails when you do not know the exact part number or terminology.</p>
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
                  AI that transforms how you manage inventory
                </h2>
                <p className="text-xl text-slate-600 max-w-2xl mx-auto">
                  PartsIQ applies artificial intelligence across every stage of inventory management — from finding parts to forecasting demand to automating replenishment.
                </p>
              </div>

              <div className="grid md:grid-cols-2 gap-12">
                <div className="flex gap-6">
                  <div className="flex-shrink-0">
                    <div className="w-12 h-12 bg-slate-950 rounded-lg flex items-center justify-center">
                      <BarChart3 className="h-6 w-6 text-white" />
                    </div>
                  </div>
                  <div>
                    <h3 className="text-2xl font-bold text-slate-950 mb-3">AI-Powered Demand Forecasting</h3>
                    <p className="text-slate-600 mb-4 leading-relaxed">
                      Machine learning models analyze your historical consumption data, equipment maintenance schedules, and seasonal patterns to predict exactly which parts you will need and when. Forecasts update continuously as new data flows in, getting more accurate over time.
                    </p>
                    <ul className="space-y-2 text-slate-600">
                      <li className="flex items-start gap-2">
                        <CheckCircle className="h-5 w-5 text-emerald-600 mt-0.5 flex-shrink-0" />
                        <span>Historical pattern analysis across all SKUs</span>
                      </li>
                      <li className="flex items-start gap-2">
                        <CheckCircle className="h-5 w-5 text-emerald-600 mt-0.5 flex-shrink-0" />
                        <span>Seasonal and trend-adjusted projections</span>
                      </li>
                    </ul>
                  </div>
                </div>

                <div className="flex gap-6">
                  <div className="flex-shrink-0">
                    <div className="w-12 h-12 bg-slate-950 rounded-lg flex items-center justify-center">
                      <Brain className="h-6 w-6 text-white" />
                    </div>
                  </div>
                  <div>
                    <h3 className="text-2xl font-bold text-slate-950 mb-3">Intelligent Parts Search</h3>
                    <p className="text-slate-600 mb-4 leading-relaxed">
                      Multi-agent AI searches across SQL, vector, and graph databases simultaneously. Describe what you need in natural language — the system understands part descriptions, cross-references, and equipment compatibility to surface the right part every time.
                    </p>
                    <ul className="space-y-2 text-slate-600">
                      <li className="flex items-start gap-2">
                        <CheckCircle className="h-5 w-5 text-emerald-600 mt-0.5 flex-shrink-0" />
                        <span>Natural language and semantic search</span>
                      </li>
                      <li className="flex items-start gap-2">
                        <CheckCircle className="h-5 w-5 text-emerald-600 mt-0.5 flex-shrink-0" />
                        <span>Equipment-aware compatibility matching</span>
                      </li>
                    </ul>
                  </div>
                </div>

                <div className="flex gap-6">
                  <div className="flex-shrink-0">
                    <div className="w-12 h-12 bg-slate-950 rounded-lg flex items-center justify-center">
                      <RefreshCw className="h-6 w-6 text-white" />
                    </div>
                  </div>
                  <div>
                    <h3 className="text-2xl font-bold text-slate-950 mb-3">Automated Reorder Management</h3>
                    <p className="text-slate-600 mb-4 leading-relaxed">
                      AI calculates optimal reorder points and safety stock levels for every SKU based on actual demand patterns and supplier lead times. When stock drops below the AI-determined threshold, the system triggers procurement workflows automatically — no manual monitoring required.
                    </p>
                    <ul className="space-y-2 text-slate-600">
                      <li className="flex items-start gap-2">
                        <CheckCircle className="h-5 w-5 text-emerald-600 mt-0.5 flex-shrink-0" />
                        <span>Dynamic reorder points per SKU</span>
                      </li>
                      <li className="flex items-start gap-2">
                        <CheckCircle className="h-5 w-5 text-emerald-600 mt-0.5 flex-shrink-0" />
                        <span>Lead time-aware replenishment triggers</span>
                      </li>
                    </ul>
                  </div>
                </div>

                <div className="flex gap-6">
                  <div className="flex-shrink-0">
                    <div className="w-12 h-12 bg-slate-950 rounded-lg flex items-center justify-center">
                      <Wrench className="h-6 w-6 text-white" />
                    </div>
                  </div>
                  <div>
                    <h3 className="text-2xl font-bold text-slate-950 mb-3">Predictive Maintenance Integration</h3>
                    <p className="text-slate-600 mb-4 leading-relaxed">
                      Connect equipment maintenance schedules to your inventory system. AI correlates upcoming maintenance events with the parts they require, ensuring components are in stock before a technician needs them. Planned maintenance never gets delayed by missing parts.
                    </p>
                    <ul className="space-y-2 text-slate-600">
                      <li className="flex items-start gap-2">
                        <CheckCircle className="h-5 w-5 text-emerald-600 mt-0.5 flex-shrink-0" />
                        <span>Maintenance-driven inventory planning</span>
                      </li>
                      <li className="flex items-start gap-2">
                        <CheckCircle className="h-5 w-5 text-emerald-600 mt-0.5 flex-shrink-0" />
                        <span>Pre-staged parts for scheduled service</span>
                      </li>
                    </ul>
                  </div>
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
                  Measurable results from AI inventory optimization
                </h2>
                <p className="text-lg text-slate-400 max-w-2xl mx-auto">
                  AI powered inventory management delivers ROI that manual processes simply cannot match.
                </p>
              </div>

              <div className="grid md:grid-cols-3 gap-8">
                <div className="text-center p-8 border border-slate-800 rounded-lg">
                  <div className="text-5xl font-bold text-emerald-400 mb-2">85%</div>
                  <div className="text-lg font-medium mb-2">Fewer Stockouts</div>
                  <p className="text-slate-400 text-sm">AI demand forecasting predicts shortages before they happen, keeping critical parts available when your equipment needs them most.</p>
                </div>
                <div className="text-center p-8 border border-slate-800 rounded-lg">
                  <div className="text-5xl font-bold text-emerald-400 mb-2">30%</div>
                  <div className="text-lg font-medium mb-2">Lower Carrying Costs</div>
                  <p className="text-slate-400 text-sm">Intelligent safety stock optimization eliminates excess inventory without increasing stockout risk. Carry less, spend less, waste less.</p>
                </div>
                <div className="text-center p-8 border border-slate-800 rounded-lg">
                  <div className="flex items-center justify-center gap-2 mb-2">
                    <TrendingUp className="h-10 w-10 text-emerald-400" />
                  </div>
                  <div className="text-lg font-medium mb-2">Continuous Optimization</div>
                  <p className="text-slate-400 text-sm">AI models learn from every transaction, improving forecast accuracy and reorder precision automatically over time.</p>
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
                  Common questions about AI inventory management software.
                </p>
              </div>

              <div className="space-y-6">
                <div className="border border-slate-200 rounded-lg p-6">
                  <h3 className="text-lg font-bold text-slate-950 mb-3 flex items-center gap-2">
                    <ChevronDown className="h-5 w-5 text-slate-400" />
                    How does AI improve inventory management over traditional methods?
                  </h3>
                  <p className="text-slate-600 pl-7">
                    AI inventory management analyzes historical consumption patterns, seasonal trends, equipment utilization data, and supplier lead times to forecast demand with far greater accuracy than manual methods. Instead of relying on static reorder points or gut instinct, AI continuously learns from your actual usage data to optimize stock levels, reducing both stockouts and excess inventory.
                  </p>
                </div>

                <div className="border border-slate-200 rounded-lg p-6">
                  <h3 className="text-lg font-bold text-slate-950 mb-3 flex items-center gap-2">
                    <ChevronDown className="h-5 w-5 text-slate-400" />
                    What types of businesses benefit most from AI inventory management?
                  </h3>
                  <p className="text-slate-600 pl-7">
                    AI inventory management delivers the greatest ROI for businesses managing large catalogs of industrial parts, heavy equipment components, or MRO supplies. Operations with hundreds or thousands of SKUs, multiple warehouse locations, or complex equipment fleets see the biggest improvements because AI can process the volume and complexity that overwhelms manual inventory planning.
                  </p>
                </div>

                <div className="border border-slate-200 rounded-lg p-6">
                  <h3 className="text-lg font-bold text-slate-950 mb-3 flex items-center gap-2">
                    <ChevronDown className="h-5 w-5 text-slate-400" />
                    How long does it take to see results from AI inventory management software?
                  </h3>
                  <p className="text-slate-600 pl-7">
                    Most PartsIQ customers see measurable improvements within 30 days. The AI begins learning from your historical data immediately after import, generating demand forecasts and reorder recommendations within the first week. Stockout reductions and carrying cost savings typically become significant within the first month as the system optimizes your reorder points and safety stock levels.
                  </p>
                </div>

                <div className="border border-slate-200 rounded-lg p-6">
                  <h3 className="text-lg font-bold text-slate-950 mb-3 flex items-center gap-2">
                    <ChevronDown className="h-5 w-5 text-slate-400" />
                    Can AI inventory management integrate with existing ERP or warehouse systems?
                  </h3>
                  <p className="text-slate-600 pl-7">
                    PartsIQ supports CSV data import for parts catalogs and inventory records, making it easy to get started regardless of your current system. The platform manages the complete inventory workflow with its own AI-powered database and analytics. API integrations with major ERP and warehouse management systems are on the product roadmap for seamless data synchronization.
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
                Ready to let AI manage your inventory?
              </h2>
              <p className="text-xl text-slate-600 mb-8">
                Start your free trial and discover how AI inventory management eliminates stockouts, reduces carrying costs, and keeps your operations running without interruption.
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
      <RelatedSolutions currentSlug="ai-inventory-management" />
      <PublicFooter />
    </>
  )
}
