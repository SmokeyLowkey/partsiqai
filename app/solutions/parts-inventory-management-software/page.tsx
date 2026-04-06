import type { Metadata } from "next"
import { Button } from "@/components/ui/button"
import {
  ArrowRight,
  Cog,
  Search,
  Phone,
  Mail,
  ShoppingCart,
  CheckCircle,
  Puzzle,
  Timer,
  ChevronDown,
  DollarSign,
  Headphones,
  Truck,
  Wheat,
  HardHat,
} from "lucide-react"
import Link from "next/link"
import { JsonLd } from "@/components/seo/json-ld"
import { BreadcrumbJsonLd } from "@/components/seo/breadcrumb-jsonld"
import { PublicFooter } from "@/components/layout/public-footer"
import { RelatedSolutions } from "@/components/solutions/related-solutions"

export const metadata: Metadata = {
  title: "Parts Inventory Management Software",
  description:
    "All-in-one parts inventory management software with AI search, voice agent, quote management, and order tracking. Reduce sourcing time from 4 hours to 15 minutes.",
  keywords: [
    "parts inventory management software",
    "parts catalog software",
    "parts management system",
    "inventory management platform",
    "parts procurement software",
    "industrial parts management",
    "AI parts management",
    "parts sourcing automation",
  ],
  alternates: {
    canonical: "/solutions/parts-inventory-management-software",
  },
  openGraph: {
    title: "Parts Inventory Management Software — AI-Powered Platform",
    description:
      "Unified parts management with AI search, voice agent, automated quoting, and order tracking. Source parts in 15 minutes instead of 4 hours.",
    url: "/solutions/parts-inventory-management-software",
  },
}

const faqJsonLd = {
  "@context": "https://schema.org",
  "@type": "FAQPage",
  mainEntity: [
    {
      "@type": "Question",
      name: "What makes PartsIQ different from traditional parts inventory management software?",
      acceptedAnswer: {
        "@type": "Answer",
        text: "PartsIQ combines three capabilities that traditional software lacks: AI-powered multi-agent search across three databases (SQL, vector, and graph), an AI voice agent that calls suppliers on your behalf, and automated email-based quote management. This end-to-end automation reduces sourcing time from hours to minutes.",
      },
    },
    {
      "@type": "Question",
      name: "How does the AI voice agent work for parts procurement?",
      acceptedAnswer: {
        "@type": "Answer",
        text: "PartsIQ's AI voice agent places phone calls to your suppliers, describes the parts you need, negotiates pricing, and records the quoted prices — all without human intervention. The system uses conversational AI to handle the entire supplier interaction, then presents you with quotes for approval.",
      },
    },
    {
      "@type": "Question",
      name: "Can PartsIQ integrate with our existing inventory or ERP system?",
      acceptedAnswer: {
        "@type": "Answer",
        text: "PartsIQ is designed as a standalone platform with CSV data import for parts catalogs. The platform manages the complete workflow from search to order, with its own database and analytics. API integrations with major ERP systems are on the product roadmap.",
      },
    },
    {
      "@type": "Question",
      name: "How much does parts inventory management software cost?",
      acceptedAnswer: {
        "@type": "Answer",
        text: "PartsIQ offers tiered pricing starting at $199/month for small operations, with plans scaling to $1,299/month for enterprise teams. Every plan includes AI search, voice agent automation, and supplier management. Visit our pricing page for detailed plan comparisons.",
      },
    },
  ],
}

export default function PartsInventoryManagementSoftwarePage() {
  return (
    <>
      <JsonLd data={faqJsonLd} />
      <BreadcrumbJsonLd
        items={[
          { name: "Home", url: "/" },
          { name: "Solutions", url: "/solutions" },
          { name: "Parts Inventory Management Software", url: "/solutions/parts-inventory-management-software" },
        ]}
      />
      <div className="min-h-screen bg-white">
        {/* Hero Section */}
        <section className="relative bg-slate-950 text-white py-24">
          <div className="absolute inset-0 bg-[linear-gradient(rgba(148,163,184,0.05)_1px,transparent_1px),linear-gradient(90deg,rgba(148,163,184,0.05)_1px,transparent_1px)] bg-[size:64px_64px]"></div>

          <div className="relative container mx-auto px-6">
            <div className="max-w-4xl mx-auto text-center">
              <div className="inline-flex items-center gap-2 bg-emerald-500/10 border border-emerald-500/20 rounded-full px-4 py-1.5 text-emerald-400 text-sm font-medium mb-6">
                <Cog className="h-4 w-4" />
                Complete Management Platform
              </div>
              <h1 className="text-5xl md:text-6xl font-bold mb-6 tracking-tight">
                Parts Inventory Management Software — AI-Powered Platform
              </h1>
              <p className="text-xl text-slate-400 mb-8 max-w-2xl mx-auto">
                The only parts management platform where AI searches your catalog, calls your suppliers, compares quotes, and tracks orders — so your team can focus on keeping equipment running.
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
                  Parts management is broken
                </h2>
                <p className="text-xl text-slate-600 max-w-2xl mx-auto">
                  Your team juggles spreadsheets, phone calls, emails, and guesswork. Every sourcing request is a manual marathon.
                </p>
              </div>

              <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-8">
                <div className="text-center p-6">
                  <div className="w-12 h-12 bg-red-50 rounded-lg flex items-center justify-center mx-auto mb-4">
                    <Puzzle className="h-6 w-6 text-red-500" />
                  </div>
                  <h3 className="text-lg font-bold text-slate-950 mb-2">Fragmented Tools</h3>
                  <p className="text-slate-600 text-sm">Catalog in one system, suppliers in another, orders in a third. Nothing talks to anything else.</p>
                </div>
                <div className="text-center p-6">
                  <div className="w-12 h-12 bg-red-50 rounded-lg flex items-center justify-center mx-auto mb-4">
                    <Timer className="h-6 w-6 text-red-500" />
                  </div>
                  <h3 className="text-lg font-bold text-slate-950 mb-2">Manual Processes</h3>
                  <p className="text-slate-600 text-sm">Finding a part, calling suppliers, comparing quotes, and placing orders takes hours of manual work per request.</p>
                </div>
                <div className="text-center p-6">
                  <div className="w-12 h-12 bg-red-50 rounded-lg flex items-center justify-center mx-auto mb-4">
                    <Phone className="h-6 w-6 text-red-500" />
                  </div>
                  <h3 className="text-lg font-bold text-slate-950 mb-2">No Supplier Coordination</h3>
                  <p className="text-slate-600 text-sm">Phone tag with suppliers, lost emails, and no systematic way to compare quotes across vendors.</p>
                </div>
                <div className="text-center p-6">
                  <div className="w-12 h-12 bg-red-50 rounded-lg flex items-center justify-center mx-auto mb-4">
                    <ShoppingCart className="h-6 w-6 text-red-500" />
                  </div>
                  <h3 className="text-lg font-bold text-slate-950 mb-2">Slow Procurement</h3>
                  <p className="text-slate-600 text-sm">By the time you get quotes and place an order, equipment has been down for days. Urgency is lost in the process.</p>
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
                  One platform from search to order
                </h2>
                <p className="text-xl text-slate-600 max-w-2xl mx-auto">
                  PartsIQ replaces your entire parts workflow with a single AI-powered platform.
                </p>
              </div>

              <div className="grid md:grid-cols-2 gap-12">
                <div className="flex gap-6">
                  <div className="flex-shrink-0">
                    <div className="w-12 h-12 bg-slate-950 rounded-lg flex items-center justify-center">
                      <Search className="h-6 w-6 text-white" />
                    </div>
                  </div>
                  <div>
                    <h3 className="text-2xl font-bold text-slate-950 mb-3">AI-Powered Parts Search</h3>
                    <p className="text-slate-600 mb-4 leading-relaxed">
                      Multi-agent AI searches across PostgreSQL, Pinecone vector, and Neo4j graph databases simultaneously. Describe what you need in plain English and get results with confidence scores.
                    </p>
                    <ul className="space-y-2 text-slate-600">
                      <li className="flex items-start gap-2">
                        <CheckCircle className="h-5 w-5 text-emerald-600 mt-0.5 flex-shrink-0" />
                        <span>Natural language and part number search</span>
                      </li>
                      <li className="flex items-start gap-2">
                        <CheckCircle className="h-5 w-5 text-emerald-600 mt-0.5 flex-shrink-0" />
                        <span>Vehicle-aware compatibility matching</span>
                      </li>
                    </ul>
                  </div>
                </div>

                <div className="flex gap-6">
                  <div className="flex-shrink-0">
                    <div className="w-12 h-12 bg-slate-950 rounded-lg flex items-center justify-center">
                      <Headphones className="h-6 w-6 text-white" />
                    </div>
                  </div>
                  <div>
                    <h3 className="text-2xl font-bold text-slate-950 mb-3">AI Voice Agent</h3>
                    <p className="text-slate-600 mb-4 leading-relaxed">
                      PartsIQ calls your suppliers autonomously. The AI voice agent describes the parts, asks for pricing and availability, and records the responses — completely hands-free.
                    </p>
                    <ul className="space-y-2 text-slate-600">
                      <li className="flex items-start gap-2">
                        <CheckCircle className="h-5 w-5 text-emerald-600 mt-0.5 flex-shrink-0" />
                        <span>Automated outbound supplier calls</span>
                      </li>
                      <li className="flex items-start gap-2">
                        <CheckCircle className="h-5 w-5 text-emerald-600 mt-0.5 flex-shrink-0" />
                        <span>Price and availability extraction</span>
                      </li>
                    </ul>
                  </div>
                </div>

                <div className="flex gap-6">
                  <div className="flex-shrink-0">
                    <div className="w-12 h-12 bg-slate-950 rounded-lg flex items-center justify-center">
                      <Mail className="h-6 w-6 text-white" />
                    </div>
                  </div>
                  <div>
                    <h3 className="text-2xl font-bold text-slate-950 mb-3">Quote Automation</h3>
                    <p className="text-slate-600 mb-4 leading-relaxed">
                      Send quote requests to multiple suppliers via email with a single click. AI extracts prices from responses and presents them in a side-by-side comparison dashboard.
                    </p>
                    <ul className="space-y-2 text-slate-600">
                      <li className="flex items-start gap-2">
                        <CheckCircle className="h-5 w-5 text-emerald-600 mt-0.5 flex-shrink-0" />
                        <span>One-click multi-supplier quoting</span>
                      </li>
                      <li className="flex items-start gap-2">
                        <CheckCircle className="h-5 w-5 text-emerald-600 mt-0.5 flex-shrink-0" />
                        <span>AI price extraction from email replies</span>
                      </li>
                    </ul>
                  </div>
                </div>

                <div className="flex gap-6">
                  <div className="flex-shrink-0">
                    <div className="w-12 h-12 bg-slate-950 rounded-lg flex items-center justify-center">
                      <ShoppingCart className="h-6 w-6 text-white" />
                    </div>
                  </div>
                  <div>
                    <h3 className="text-2xl font-bold text-slate-950 mb-3">Order Tracking</h3>
                    <p className="text-slate-600 mb-4 leading-relaxed">
                      Convert approved quotes to orders with one click. Track every order from placement through delivery with a complete audit trail and status notifications.
                    </p>
                    <ul className="space-y-2 text-slate-600">
                      <li className="flex items-start gap-2">
                        <CheckCircle className="h-5 w-5 text-emerald-600 mt-0.5 flex-shrink-0" />
                        <span>Quote-to-order conversion workflow</span>
                      </li>
                      <li className="flex items-start gap-2">
                        <CheckCircle className="h-5 w-5 text-emerald-600 mt-0.5 flex-shrink-0" />
                        <span>Delivery tracking and confirmation</span>
                      </li>
                    </ul>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* How It Works */}
        <section className="py-24 bg-white">
          <div className="container mx-auto px-6">
            <div className="max-w-4xl mx-auto">
              <div className="mb-16 text-center">
                <h2 className="text-4xl font-bold mb-4 text-slate-950 tracking-tight">
                  How our parts inventory management software works
                </h2>
                <p className="text-xl text-slate-600 max-w-2xl mx-auto">
                  Go from scattered spreadsheets to a fully operational parts management system in four straightforward steps.
                </p>
              </div>

              <div className="space-y-12">
                <div className="flex gap-6">
                  <div className="flex-shrink-0">
                    <div className="w-10 h-10 bg-slate-950 rounded-full flex items-center justify-center text-white font-bold text-sm">
                      1
                    </div>
                  </div>
                  <div>
                    <h3 className="text-xl font-bold text-slate-950 mb-2">Upload your parts catalog</h3>
                    <p className="text-slate-600 leading-relaxed">
                      Import your existing parts data via CSV or enter it manually. Our parts inventory software accepts part numbers, descriptions, manufacturer details, cross-references, and pricing data. Whether you have 500 parts or 500,000, the platform ingests your catalog in minutes and structures it for lightning-fast retrieval.
                    </p>
                  </div>
                </div>

                <div className="flex gap-6">
                  <div className="flex-shrink-0">
                    <div className="w-10 h-10 bg-slate-950 rounded-full flex items-center justify-center text-white font-bold text-sm">
                      2
                    </div>
                  </div>
                  <div>
                    <h3 className="text-xl font-bold text-slate-950 mb-2">AI indexes and organizes</h3>
                    <p className="text-slate-600 leading-relaxed">
                      Once uploaded, PartsIQ&apos;s AI engine indexes every part across three databases: SQL for structured queries, vector for semantic search, and graph for relationship mapping. This triple-index approach is what makes our parts inventory control system dramatically more accurate than keyword-only search tools.
                    </p>
                  </div>
                </div>

                <div className="flex gap-6">
                  <div className="flex-shrink-0">
                    <div className="w-10 h-10 bg-slate-950 rounded-full flex items-center justify-center text-white font-bold text-sm">
                      3
                    </div>
                  </div>
                  <div>
                    <h3 className="text-xl font-bold text-slate-950 mb-2">Search and request quotes</h3>
                    <p className="text-slate-600 leading-relaxed">
                      Describe the part you need in plain English or enter a part number. The parts management system returns ranked results with confidence scores. From there, request quotes from multiple suppliers with a single click -- by email or through the AI voice agent that calls vendors on your behalf.
                    </p>
                  </div>
                </div>

                <div className="flex gap-6">
                  <div className="flex-shrink-0">
                    <div className="w-10 h-10 bg-slate-950 rounded-full flex items-center justify-center text-white font-bold text-sm">
                      4
                    </div>
                  </div>
                  <div>
                    <h3 className="text-xl font-bold text-slate-950 mb-2">Review, approve, and order</h3>
                    <p className="text-slate-600 leading-relaxed">
                      Quotes arrive in a unified dashboard where AI extracts pricing and availability automatically. Compare suppliers side by side, approve the best option, and convert the quote to a purchase order -- all without leaving the parts inventory management software. Every step is logged for a complete audit trail.
                    </p>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* Who It's For */}
        <section className="py-24 bg-slate-50">
          <div className="container mx-auto px-6">
            <div className="max-w-6xl mx-auto">
              <div className="mb-16 text-center">
                <h2 className="text-4xl font-bold mb-4 text-slate-950 tracking-tight">
                  Built for teams that keep heavy equipment running
                </h2>
                <p className="text-xl text-slate-600 max-w-2xl mx-auto">
                  Our parts inventory software serves operations teams across industries where equipment uptime is everything.
                </p>
              </div>

              <div className="grid md:grid-cols-3 gap-8">
                <div className="bg-white border border-slate-200 rounded-lg p-8">
                  <div className="w-12 h-12 bg-slate-950 rounded-lg flex items-center justify-center mb-5">
                    <Truck className="h-6 w-6 text-white" />
                  </div>
                  <h3 className="text-xl font-bold text-slate-950 mb-3">Construction Fleets</h3>
                  <p className="text-slate-600 leading-relaxed mb-4">
                    Construction companies manage hundreds of machines across job sites, each with unique parts requirements. PartsIQ&apos;s parts inventory management software centralizes catalogs for excavators, loaders, dozers, and more -- so procurement teams find the right part the first time instead of halting a project while they chase down a supplier.
                  </p>
                  <ul className="space-y-2 text-slate-600">
                    <li className="flex items-start gap-2">
                      <CheckCircle className="h-5 w-5 text-emerald-600 mt-0.5 flex-shrink-0" />
                      <span>Multi-site catalog with equipment compatibility</span>
                    </li>
                    <li className="flex items-start gap-2">
                      <CheckCircle className="h-5 w-5 text-emerald-600 mt-0.5 flex-shrink-0" />
                      <span>Reduced project downtime from faster sourcing</span>
                    </li>
                  </ul>
                </div>

                <div className="bg-white border border-slate-200 rounded-lg p-8">
                  <div className="w-12 h-12 bg-slate-950 rounded-lg flex items-center justify-center mb-5">
                    <Wheat className="h-6 w-6 text-white" />
                  </div>
                  <h3 className="text-xl font-bold text-slate-950 mb-3">Agriculture Operations</h3>
                  <p className="text-slate-600 leading-relaxed mb-4">
                    During planting and harvest seasons, a single broken combine can cost thousands of dollars per day. Agriculture operations use our parts management system to pre-stock critical wear parts, automate reordering, and get quotes from multiple dealers simultaneously -- keeping machines in the field when it matters most.
                  </p>
                  <ul className="space-y-2 text-slate-600">
                    <li className="flex items-start gap-2">
                      <CheckCircle className="h-5 w-5 text-emerald-600 mt-0.5 flex-shrink-0" />
                      <span>Seasonal demand planning and pre-stocking</span>
                    </li>
                    <li className="flex items-start gap-2">
                      <CheckCircle className="h-5 w-5 text-emerald-600 mt-0.5 flex-shrink-0" />
                      <span>Multi-dealer quote comparison in minutes</span>
                    </li>
                  </ul>
                </div>

                <div className="bg-white border border-slate-200 rounded-lg p-8">
                  <div className="w-12 h-12 bg-slate-950 rounded-lg flex items-center justify-center mb-5">
                    <HardHat className="h-6 w-6 text-white" />
                  </div>
                  <h3 className="text-xl font-bold text-slate-950 mb-3">Mining &amp; Industrial</h3>
                  <p className="text-slate-600 leading-relaxed mb-4">
                    Mining and industrial operations depend on specialized, high-value components with long lead times. A robust parts inventory control system is essential for tracking expensive consumables, managing reorder points, and ensuring that the right replacement part is on-site before a scheduled maintenance window arrives.
                  </p>
                  <ul className="space-y-2 text-slate-600">
                    <li className="flex items-start gap-2">
                      <CheckCircle className="h-5 w-5 text-emerald-600 mt-0.5 flex-shrink-0" />
                      <span>High-value component tracking with audit trails</span>
                    </li>
                    <li className="flex items-start gap-2">
                      <CheckCircle className="h-5 w-5 text-emerald-600 mt-0.5 flex-shrink-0" />
                      <span>Lead-time-aware reorder automation</span>
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
                  Measurable impact on your bottom line
                </h2>
                <p className="text-lg text-slate-400 max-w-2xl mx-auto">
                  PartsIQ transforms procurement from a cost center into a competitive advantage.
                </p>
              </div>

              <div className="grid md:grid-cols-3 gap-8">
                <div className="text-center p-8 border border-slate-800 rounded-lg">
                  <div className="text-3xl font-bold text-emerald-400 mb-2">4hrs → 15min</div>
                  <div className="text-lg font-medium mb-2">Sourcing Time</div>
                  <p className="text-slate-400 text-sm">What used to take half a day of phone calls and emails now happens in minutes with AI automation.</p>
                </div>
                <div className="text-center p-8 border border-slate-800 rounded-lg">
                  <div className="text-5xl font-bold text-emerald-400 mb-2">30%</div>
                  <div className="text-lg font-medium mb-2">Cost Savings</div>
                  <p className="text-slate-400 text-sm">Automated price comparison across multiple suppliers ensures you always get the best available price.</p>
                </div>
                <div className="text-center p-8 border border-slate-800 rounded-lg">
                  <div className="text-5xl font-bold text-emerald-400 mb-2">100%</div>
                  <div className="text-lg font-medium mb-2">Hands-Free Quoting</div>
                  <p className="text-slate-400 text-sm">The AI voice agent and email automation handle supplier communication entirely without human intervention.</p>
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
                  Common questions about parts inventory management software.
                </p>
              </div>

              <div className="space-y-6">
                <div className="border border-slate-200 rounded-lg p-6">
                  <h3 className="text-lg font-bold text-slate-950 mb-3 flex items-center gap-2">
                    <ChevronDown className="h-5 w-5 text-slate-400" />
                    What makes PartsIQ different from traditional parts inventory management software?
                  </h3>
                  <p className="text-slate-600 pl-7">
                    PartsIQ combines three capabilities that traditional software lacks: AI-powered multi-agent search across three databases (SQL, vector, and graph), an AI voice agent that calls suppliers on your behalf, and automated email-based quote management. This end-to-end automation reduces sourcing time from hours to minutes.
                  </p>
                </div>

                <div className="border border-slate-200 rounded-lg p-6">
                  <h3 className="text-lg font-bold text-slate-950 mb-3 flex items-center gap-2">
                    <ChevronDown className="h-5 w-5 text-slate-400" />
                    How does the AI voice agent work for parts procurement?
                  </h3>
                  <p className="text-slate-600 pl-7">
                    PartsIQ&apos;s AI voice agent places phone calls to your suppliers, describes the parts you need, negotiates pricing, and records the quoted prices — all without human intervention. The system uses conversational AI to handle the entire supplier interaction, then presents you with quotes for approval.
                  </p>
                </div>

                <div className="border border-slate-200 rounded-lg p-6">
                  <h3 className="text-lg font-bold text-slate-950 mb-3 flex items-center gap-2">
                    <ChevronDown className="h-5 w-5 text-slate-400" />
                    Can PartsIQ integrate with our existing inventory or ERP system?
                  </h3>
                  <p className="text-slate-600 pl-7">
                    PartsIQ is designed as a standalone platform with CSV data import for parts catalogs. The platform manages the complete workflow from search to order, with its own database and analytics. API integrations with major ERP systems are on the product roadmap.
                  </p>
                </div>

                <div className="border border-slate-200 rounded-lg p-6">
                  <h3 className="text-lg font-bold text-slate-950 mb-3 flex items-center gap-2">
                    <ChevronDown className="h-5 w-5 text-slate-400" />
                    How much does parts inventory management software cost?
                  </h3>
                  <p className="text-slate-600 pl-7">
                    PartsIQ offers tiered pricing starting at $199/month for small operations, with plans scaling to $1,299/month for enterprise teams. Every plan includes AI search, voice agent automation, and supplier management. Visit our pricing page for detailed plan comparisons.
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
                Ready to modernize your parts management?
              </h2>
              <p className="text-xl text-slate-600 mb-8">
                Start your free trial and see why operations teams are switching to AI-powered parts management.
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
      <RelatedSolutions currentSlug="parts-inventory-management-software" />
      <PublicFooter />
    </>
  )
}
