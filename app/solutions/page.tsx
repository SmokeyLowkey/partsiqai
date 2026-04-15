import type { Metadata } from "next"
import Link from "next/link"
import { ArrowRight, Search, Package, Phone, BookOpen, Brain, Wrench, Zap, Shield } from "lucide-react"
import { BreadcrumbJsonLd } from "@/components/seo/breadcrumb-jsonld"
import { PublicFooter } from "@/components/layout/public-footer"
import { Button } from "@/components/ui/button"

export const metadata: Metadata = {
  title: "Parts Procurement Solutions",
  description:
    "PartsIQ solutions for parts inventory management, tracking, AI search, supplier management, and procurement automation for heavy equipment operations.",
  alternates: {
    canonical: "/solutions",
  },
  openGraph: {
    title: "PartsIQ Solutions",
    description:
      "Complete suite of AI-powered tools for parts inventory, procurement, and supplier management.",
    url: "/solutions",
  },
}

const solutions = [
  {
    slug: "parts-inventory-management-software",
    title: "Parts Inventory Management",
    description: "All-in-one platform with AI search, voice agent automation, quote management, and order tracking.",
    icon: Package,
    keywords: ["Parts catalog", "Order tracking", "AI search"],
  },
  {
    slug: "parts-inventory-tracking",
    title: "Parts Inventory Tracking",
    description: "Real-time stock visibility with automated reorder alerts, multi-location support, and AI-powered demand forecasting.",
    icon: Search,
    keywords: ["Real-time tracking", "Reorder alerts", "Multi-location"],
  },
  {
    slug: "ai-parts-search",
    title: "AI Parts Search Engine",
    description: "Semantic search across 3 databases simultaneously. Natural language queries with 95% match accuracy.",
    icon: Brain,
    keywords: ["Semantic search", "Cross-referencing", "Natural language"],
  },
  {
    slug: "supplier-management-software",
    title: "Supplier Management",
    description: "AI voice agent calls suppliers, automated email quoting, side-by-side price comparison, and supplier scoring.",
    icon: Phone,
    keywords: ["Voice agent", "Quote comparison", "Supplier scoring"],
  },
  {
    slug: "heavy-equipment-parts-catalog",
    title: "Heavy Equipment Parts Catalog",
    description: "Digital parts catalog with diagram search, cross-brand referencing, and multi-manufacturer support.",
    icon: BookOpen,
    keywords: ["CAT", "Deere", "Komatsu", "Multi-brand"],
  },
  {
    slug: "ai-inventory-management",
    title: "AI Inventory Management",
    description: "AI-powered demand forecasting, automated reordering, and predictive analytics for parts inventory.",
    icon: Brain,
    keywords: ["Demand forecasting", "Auto-reorder", "Predictive analytics"],
  },
  {
    slug: "spare-parts-management-software",
    title: "Spare Parts Management",
    description: "Criticality-based stock levels, shelf life tracking, and emergency availability for spare parts.",
    icon: Shield,
    keywords: ["Criticality levels", "Shelf life", "Emergency stock"],
  },
  {
    slug: "heavy-equipment-maintenance-software",
    title: "Maintenance Software",
    description: "PDF maintenance manual parsing, predictive alerts, and parts-linked service intervals.",
    icon: Wrench,
    keywords: ["PDF parsing", "Predictive alerts", "Service intervals"],
  },
  {
    slug: "automated-procurement-software",
    title: "Automated Procurement",
    description: "End-to-end procurement automation with AI voice agent, email quoting, quote comparison, and PO tracking.",
    icon: Zap,
    keywords: ["Voice agent", "Email quoting", "PO tracking"],
  },
]

export default function SolutionsPage() {
  return (
    <>
      <BreadcrumbJsonLd
        items={[
          { name: "Home", url: "/" },
          { name: "Solutions", url: "/solutions" },
        ]}
      />
      <div className="min-h-screen bg-white">
        <section className="relative bg-slate-950 text-white py-24">
          <div className="absolute inset-0 bg-[linear-gradient(rgba(148,163,184,0.05)_1px,transparent_1px),linear-gradient(90deg,rgba(148,163,184,0.05)_1px,transparent_1px)] bg-[size:64px_64px]"></div>
          <div className="relative container mx-auto px-6">
            <div className="max-w-4xl mx-auto text-center">
              <h1 className="text-5xl md:text-6xl font-bold mb-6 tracking-tight">
                Parts Management Solutions
              </h1>
              <p className="text-xl text-slate-400 mb-8 max-w-2xl mx-auto">
                AI-powered tools for every stage of parts inventory management — from search and tracking to procurement and supplier communication.
              </p>
              <Link href="/signup">
                <Button size="lg" className="bg-white text-slate-950 hover:bg-slate-100 px-8 h-14 text-lg font-medium">
                  Start Free Trial
                  <ArrowRight className="ml-2 h-5 w-5" />
                </Button>
              </Link>
            </div>
          </div>
        </section>

        <section className="py-24">
          <div className="container mx-auto px-6">
            <div className="max-w-6xl mx-auto grid md:grid-cols-2 lg:grid-cols-3 gap-8">
              {solutions.map((solution) => {
                const Icon = solution.icon
                return (
                  <Link
                    key={solution.slug}
                    href={`/solutions/${solution.slug}`}
                    className="group border border-slate-200 rounded-xl p-8 hover:border-purple-300 hover:shadow-lg transition-all"
                  >
                    <div className="w-12 h-12 bg-slate-950 rounded-lg flex items-center justify-center mb-5">
                      <Icon className="h-6 w-6 text-white" />
                    </div>
                    <h2 className="text-xl font-bold text-slate-950 mb-3 group-hover:text-purple-600 transition-colors">
                      {solution.title}
                    </h2>
                    <p className="text-slate-600 text-sm mb-4 leading-relaxed">
                      {solution.description}
                    </p>
                    <div className="flex flex-wrap gap-2 mb-4">
                      {solution.keywords.map((kw) => (
                        <span key={kw} className="text-xs bg-slate-100 text-slate-600 px-2 py-1 rounded">
                          {kw}
                        </span>
                      ))}
                    </div>
                    <span className="inline-flex items-center text-sm font-medium text-purple-600 group-hover:gap-2 transition-all">
                      Learn more <ArrowRight className="h-4 w-4 ml-1" />
                    </span>
                  </Link>
                )
              })}
            </div>
          </div>
        </section>

        {/* Cross-cluster link to /parts-catalog — gives the SEO cluster a bridge between generic solutions and brand-specific pages */}
        <section className="py-16 bg-slate-50">
          <div className="container mx-auto px-6">
            <div className="max-w-4xl mx-auto text-center">
              <div className="inline-flex items-center gap-2 bg-emerald-500/10 border border-emerald-500/20 rounded-full px-4 py-1.5 text-emerald-700 text-sm font-medium mb-5">
                <Package className="h-4 w-4" />
                Browse parts by brand
              </div>
              <h2 className="text-3xl md:text-4xl font-bold text-slate-950 tracking-tight mb-4">
                Need brand-specific parts sourcing guidance?
              </h2>
              <p className="text-lg text-slate-600 mb-8 max-w-2xl mx-auto">
                We publish parts management and sourcing playbooks for every major heavy and compact equipment brand — Caterpillar, Komatsu, John Deere, Bobcat, Kubota, and more.
              </p>
              <Link href="/parts-catalog">
                <Button size="lg" className="bg-slate-950 text-white hover:bg-slate-800 px-8 h-12">
                  Explore parts catalog by brand
                  <ArrowRight className="ml-2 h-5 w-5" />
                </Button>
              </Link>
            </div>
          </div>
        </section>
      </div>
      <PublicFooter />
    </>
  )
}
