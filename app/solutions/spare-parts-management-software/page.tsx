import type { Metadata } from "next"
import { Button } from "@/components/ui/button"
import {
  ArrowRight,
  Package,
  CheckCircle,
  AlertTriangle,
  Clock,
  ShieldAlert,
  BarChart3,
  Layers,
  GitCompare,
  ChevronDown,
} from "lucide-react"
import Link from "next/link"
import { JsonLd } from "@/components/seo/json-ld"
import { BreadcrumbJsonLd } from "@/components/seo/breadcrumb-jsonld"
import { PublicFooter } from "@/components/layout/public-footer"
import { RelatedSolutions } from "@/components/solutions/related-solutions"

export const metadata: Metadata = {
  title: "Spare Parts Management Software",
  description:
    "Spare parts management software and spare parts tracking system for heavy equipment. Manage criticality levels, shelf life, and emergency availability in one platform.",
  keywords: [
    "spare parts management software",
    "spare parts tracking system",
    "spare parts inventory management",
    "spare parts catalog software",
    "critical spare parts management",
    "equipment spare parts tracking",
    "spare parts optimization",
    "maintenance spare parts software",
  ],
  alternates: {
    canonical: "/solutions/spare-parts-management-software",
  },
  openGraph: {
    title: "Spare Parts Management Software for Heavy Equipment",
    description:
      "Manage critical spare parts with AI-powered tracking. Handle criticality levels, shelf life monitoring, and emergency availability for heavy equipment fleets.",
    url: "/solutions/spare-parts-management-software",
  },
}

const faqJsonLd = {
  "@context": "https://schema.org",
  "@type": "FAQPage",
  mainEntity: [
    {
      "@type": "Question",
      name: "What is the difference between spare parts management and regular inventory management?",
      acceptedAnswer: {
        "@type": "Answer",
        text: "Spare parts management addresses challenges unique to maintenance operations: intermittent and unpredictable demand patterns, criticality-based stocking where a missing $50 part can cause $50,000 in downtime, shelf life and storage requirements for specialized components, and cross-reference compatibility across equipment models. Regular inventory software lacks these specialized capabilities.",
      },
    },
    {
      "@type": "Question",
      name: "How does PartsIQ handle critical spare parts that must always be in stock?",
      acceptedAnswer: {
        "@type": "Answer",
        text: "PartsIQ assigns criticality levels to every spare part based on equipment impact, lead time, and failure probability. Critical spares trigger automatic reorder alerts before stock reaches minimum thresholds. The system also identifies single-source parts and flags supply chain risks so you can maintain safety stock for components where stockouts would halt operations.",
      },
    },
    {
      "@type": "Question",
      name: "Can PartsIQ track spare parts across multiple warehouse locations?",
      acceptedAnswer: {
        "@type": "Answer",
        text: "Yes. PartsIQ provides multi-location spare parts visibility so you can see available stock across all warehouses, job sites, and service trucks. When a technician needs a part urgently, the system shows the nearest available unit and facilitates inter-location transfers to minimize equipment downtime.",
      },
    },
    {
      "@type": "Question",
      name: "How does spare parts management software reduce equipment downtime?",
      acceptedAnswer: {
        "@type": "Answer",
        text: "Spare parts management software reduces downtime by ensuring the right parts are available before failures occur. PartsIQ analyzes usage patterns to predict demand, maintains criticality-based safety stock, enables rapid AI-powered part identification, and automates supplier sourcing when stock runs low. Teams using PartsIQ report up to 40% reduction in unplanned downtime caused by parts unavailability.",
      },
    },
  ],
}

export default function SparePartsManagementSoftwarePage() {
  return (
    <>
      <JsonLd data={faqJsonLd} />
      <BreadcrumbJsonLd
        items={[
          { name: "Home", url: "/" },
          { name: "Solutions", url: "/solutions" },
          { name: "Spare Parts Management Software", url: "/solutions/spare-parts-management-software" },
        ]}
      />
      <div className="min-h-screen bg-white">
        {/* Hero Section */}
        <section className="relative bg-slate-950 text-white py-24">
          <div className="absolute inset-0 bg-[linear-gradient(rgba(148,163,184,0.05)_1px,transparent_1px),linear-gradient(90deg,rgba(148,163,184,0.05)_1px,transparent_1px)] bg-[size:64px_64px]"></div>

          <div className="relative container mx-auto px-6">
            <div className="max-w-4xl mx-auto text-center">
              <div className="inline-flex items-center gap-2 bg-emerald-500/10 border border-emerald-500/20 rounded-full px-4 py-1.5 text-emerald-400 text-sm font-medium mb-6">
                <Package className="h-4 w-4" />
                Spare Parts Solution
              </div>
              <h1 className="text-5xl md:text-6xl font-bold mb-6 tracking-tight">
                Spare Parts Management Software for Heavy Equipment
              </h1>
              <p className="text-xl text-slate-400 mb-8 max-w-2xl mx-auto">
                Spare parts are not regular inventory. They have criticality levels, unpredictable demand, shelf life constraints, and complex cross-references. PartsIQ is the spare parts tracking system built for these realities.
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
                  Spare parts chaos costs more than you think
                </h2>
                <p className="text-xl text-slate-600 max-w-2xl mx-auto">
                  A missing $50 seal can idle a $500,000 excavator. Generic inventory tools were never designed for the high-stakes reality of spare parts management.
                </p>
              </div>

              <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-8">
                <div className="text-center p-6">
                  <div className="w-12 h-12 bg-red-50 rounded-lg flex items-center justify-center mx-auto mb-4">
                    <ShieldAlert className="h-6 w-6 text-red-500" />
                  </div>
                  <h3 className="text-lg font-bold text-slate-950 mb-2">No Criticality Awareness</h3>
                  <p className="text-slate-600 text-sm">Generic systems treat a critical hydraulic valve the same as a cabin air filter. When the valve is out of stock, your entire machine goes down.</p>
                </div>
                <div className="text-center p-6">
                  <div className="w-12 h-12 bg-red-50 rounded-lg flex items-center justify-center mx-auto mb-4">
                    <Clock className="h-6 w-6 text-red-500" />
                  </div>
                  <h3 className="text-lg font-bold text-slate-950 mb-2">Shelf Life Blind Spots</h3>
                  <p className="text-slate-600 text-sm">Rubber seals degrade, lubricants expire, and electronic modules have storage limits. Without shelf life tracking, you stock parts that fail on install.</p>
                </div>
                <div className="text-center p-6">
                  <div className="w-12 h-12 bg-red-50 rounded-lg flex items-center justify-center mx-auto mb-4">
                    <AlertTriangle className="h-6 w-6 text-red-500" />
                  </div>
                  <h3 className="text-lg font-bold text-slate-950 mb-2">Unpredictable Demand</h3>
                  <p className="text-slate-600 text-sm">Spare parts follow intermittent demand patterns that break traditional forecasting. You either overstock and tie up capital, or understock and face emergencies.</p>
                </div>
                <div className="text-center p-6">
                  <div className="w-12 h-12 bg-red-50 rounded-lg flex items-center justify-center mx-auto mb-4">
                    <GitCompare className="h-6 w-6 text-red-500" />
                  </div>
                  <h3 className="text-lg font-bold text-slate-950 mb-2">Cross-Reference Gaps</h3>
                  <p className="text-slate-600 text-sm">The same part has different numbers across OEMs, aftermarket brands, and internal codes. Without cross-referencing, duplicate stock and missed matches pile up.</p>
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
                  Spare parts management built for maintenance teams
                </h2>
                <p className="text-xl text-slate-600 max-w-2xl mx-auto">
                  PartsIQ understands that spare parts require specialized tracking, intelligent stocking, and rapid identification that generic inventory tools cannot provide.
                </p>
              </div>

              <div className="grid md:grid-cols-2 gap-12">
                <div className="flex gap-6">
                  <div className="flex-shrink-0">
                    <div className="w-12 h-12 bg-slate-950 rounded-lg flex items-center justify-center">
                      <Package className="h-6 w-6 text-white" />
                    </div>
                  </div>
                  <div>
                    <h3 className="text-2xl font-bold text-slate-950 mb-3">Spare Parts Catalog Organization</h3>
                    <p className="text-slate-600 mb-4 leading-relaxed">
                      Structure your entire spare parts inventory by equipment type, system, and assembly. Every part links to the machines it supports, with full specifications, images, and supplier history. AI-powered search lets technicians find the right part by description, symptom, or partial number in seconds.
                    </p>
                    <ul className="space-y-2 text-slate-600">
                      <li className="flex items-start gap-2">
                        <CheckCircle className="h-5 w-5 text-emerald-600 mt-0.5 flex-shrink-0" />
                        <span>Equipment-to-part relationship mapping</span>
                      </li>
                      <li className="flex items-start gap-2">
                        <CheckCircle className="h-5 w-5 text-emerald-600 mt-0.5 flex-shrink-0" />
                        <span>AI search by description, symptom, or part number</span>
                      </li>
                    </ul>
                  </div>
                </div>

                <div className="flex gap-6">
                  <div className="flex-shrink-0">
                    <div className="w-12 h-12 bg-slate-950 rounded-lg flex items-center justify-center">
                      <ShieldAlert className="h-6 w-6 text-white" />
                    </div>
                  </div>
                  <div>
                    <h3 className="text-2xl font-bold text-slate-950 mb-3">Criticality-Based Stock Levels</h3>
                    <p className="text-slate-600 mb-4 leading-relaxed">
                      Not every spare part deserves the same investment. PartsIQ classifies parts by criticality — factoring in equipment impact, lead time, failure frequency, and cost of downtime. Critical spares maintain safety stock with automatic reorder triggers, while low-criticality items follow lean just-in-time replenishment.
                    </p>
                    <ul className="space-y-2 text-slate-600">
                      <li className="flex items-start gap-2">
                        <CheckCircle className="h-5 w-5 text-emerald-600 mt-0.5 flex-shrink-0" />
                        <span>Automated criticality classification engine</span>
                      </li>
                      <li className="flex items-start gap-2">
                        <CheckCircle className="h-5 w-5 text-emerald-600 mt-0.5 flex-shrink-0" />
                        <span>Safety stock alerts for mission-critical spares</span>
                      </li>
                    </ul>
                  </div>
                </div>

                <div className="flex gap-6">
                  <div className="flex-shrink-0">
                    <div className="w-12 h-12 bg-slate-950 rounded-lg flex items-center justify-center">
                      <BarChart3 className="h-6 w-6 text-white" />
                    </div>
                  </div>
                  <div>
                    <h3 className="text-2xl font-bold text-slate-950 mb-3">Usage Pattern Analytics</h3>
                    <p className="text-slate-600 mb-4 leading-relaxed">
                      Spare parts demand is sporadic by nature. PartsIQ tracks consumption history across your fleet and applies intermittent demand forecasting models designed for maintenance environments. Identify seasonal patterns, correlate usage with equipment age, and spot emerging failure trends before they become fleet-wide problems.
                    </p>
                    <ul className="space-y-2 text-slate-600">
                      <li className="flex items-start gap-2">
                        <CheckCircle className="h-5 w-5 text-emerald-600 mt-0.5 flex-shrink-0" />
                        <span>Intermittent demand forecasting models</span>
                      </li>
                      <li className="flex items-start gap-2">
                        <CheckCircle className="h-5 w-5 text-emerald-600 mt-0.5 flex-shrink-0" />
                        <span>Fleet-wide failure trend detection</span>
                      </li>
                    </ul>
                  </div>
                </div>

                <div className="flex gap-6">
                  <div className="flex-shrink-0">
                    <div className="w-12 h-12 bg-slate-950 rounded-lg flex items-center justify-center">
                      <Layers className="h-6 w-6 text-white" />
                    </div>
                  </div>
                  <div>
                    <h3 className="text-2xl font-bold text-slate-950 mb-3">Cross-Reference and Compatibility</h3>
                    <p className="text-slate-600 mb-4 leading-relaxed">
                      One hydraulic pump has an OEM number, three aftermarket equivalents, and two superseded part numbers. PartsIQ&apos;s graph database maps every cross-reference and compatibility relationship, so a search for any number surfaces all valid alternatives. Eliminate duplicate stock and discover lower-cost equivalents automatically.
                    </p>
                    <ul className="space-y-2 text-slate-600">
                      <li className="flex items-start gap-2">
                        <CheckCircle className="h-5 w-5 text-emerald-600 mt-0.5 flex-shrink-0" />
                        <span>OEM-to-aftermarket cross-reference mapping</span>
                      </li>
                      <li className="flex items-start gap-2">
                        <CheckCircle className="h-5 w-5 text-emerald-600 mt-0.5 flex-shrink-0" />
                        <span>Superseded and obsolete part number tracking</span>
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
                  Fewer stockouts, less dead stock, faster repairs
                </h2>
                <p className="text-lg text-slate-400 max-w-2xl mx-auto">
                  Teams using PartsIQ spend less on spare parts inventory while maintaining higher availability for the parts that matter most.
                </p>
              </div>

              <div className="grid md:grid-cols-3 gap-8">
                <div className="text-center p-8 border border-slate-800 rounded-lg">
                  <div className="text-5xl font-bold text-emerald-400 mb-2">40%</div>
                  <div className="text-lg font-medium mb-2">Less Unplanned Downtime</div>
                  <p className="text-slate-400 text-sm">Criticality-based stocking ensures mission-critical spares are always available when equipment fails unexpectedly.</p>
                </div>
                <div className="text-center p-8 border border-slate-800 rounded-lg">
                  <div className="text-5xl font-bold text-emerald-400 mb-2">25%</div>
                  <div className="text-lg font-medium mb-2">Inventory Cost Reduction</div>
                  <p className="text-slate-400 text-sm">Eliminate overstocking of non-critical parts and duplicate stock caused by unlinked cross-references and obsolete numbers.</p>
                </div>
                <div className="text-center p-8 border border-slate-800 rounded-lg">
                  <div className="text-3xl font-bold text-emerald-400 mb-2">Seconds, Not Hours</div>
                  <div className="text-lg font-medium mb-2">Part Identification</div>
                  <p className="text-slate-400 text-sm">AI-powered search across part numbers, descriptions, and cross-references means technicians find the right spare part instantly.</p>
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
                  Common questions about spare parts management software.
                </p>
              </div>

              <div className="space-y-6">
                <div className="border border-slate-200 rounded-lg p-6">
                  <h3 className="text-lg font-bold text-slate-950 mb-3 flex items-center gap-2">
                    <ChevronDown className="h-5 w-5 text-slate-400" />
                    What is the difference between spare parts management and regular inventory management?
                  </h3>
                  <p className="text-slate-600 pl-7">
                    Spare parts management addresses challenges unique to maintenance operations: intermittent and unpredictable demand patterns, criticality-based stocking where a missing $50 part can cause $50,000 in downtime, shelf life and storage requirements for specialized components, and cross-reference compatibility across equipment models. Regular inventory software lacks these specialized capabilities.
                  </p>
                </div>

                <div className="border border-slate-200 rounded-lg p-6">
                  <h3 className="text-lg font-bold text-slate-950 mb-3 flex items-center gap-2">
                    <ChevronDown className="h-5 w-5 text-slate-400" />
                    How does PartsIQ handle critical spare parts that must always be in stock?
                  </h3>
                  <p className="text-slate-600 pl-7">
                    PartsIQ assigns criticality levels to every spare part based on equipment impact, lead time, and failure probability. Critical spares trigger automatic reorder alerts before stock reaches minimum thresholds. The system also identifies single-source parts and flags supply chain risks so you can maintain safety stock for components where stockouts would halt operations.
                  </p>
                </div>

                <div className="border border-slate-200 rounded-lg p-6">
                  <h3 className="text-lg font-bold text-slate-950 mb-3 flex items-center gap-2">
                    <ChevronDown className="h-5 w-5 text-slate-400" />
                    Can PartsIQ track spare parts across multiple warehouse locations?
                  </h3>
                  <p className="text-slate-600 pl-7">
                    Yes. PartsIQ provides multi-location spare parts visibility so you can see available stock across all warehouses, job sites, and service trucks. When a technician needs a part urgently, the system shows the nearest available unit and facilitates inter-location transfers to minimize equipment downtime.
                  </p>
                </div>

                <div className="border border-slate-200 rounded-lg p-6">
                  <h3 className="text-lg font-bold text-slate-950 mb-3 flex items-center gap-2">
                    <ChevronDown className="h-5 w-5 text-slate-400" />
                    How does spare parts management software reduce equipment downtime?
                  </h3>
                  <p className="text-slate-600 pl-7">
                    Spare parts management software reduces downtime by ensuring the right parts are available before failures occur. PartsIQ analyzes usage patterns to predict demand, maintains criticality-based safety stock, enables rapid AI-powered part identification, and automates supplier sourcing when stock runs low. Teams using PartsIQ report up to 40% reduction in unplanned downtime caused by parts unavailability.
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
                Stop treating spare parts like regular inventory
              </h2>
              <p className="text-xl text-slate-600 mb-8">
                Start your free trial and manage spare parts with the criticality awareness, cross-referencing, and demand intelligence your maintenance team needs.
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
      <RelatedSolutions currentSlug="spare-parts-management-software" />
      <PublicFooter />
    </>
  )
}
