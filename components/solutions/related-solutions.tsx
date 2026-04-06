import Link from "next/link"
import { ArrowRight } from "lucide-react"

const ALL_SOLUTIONS = [
  {
    slug: "parts-inventory-management-software",
    title: "Parts Inventory Management",
    description: "All-in-one platform with AI search, voice agent, and order tracking.",
  },
  {
    slug: "parts-inventory-tracking",
    title: "Parts Inventory Tracking",
    description: "Real-time tracking with automated reorder alerts and AI forecasting.",
  },
  {
    slug: "ai-parts-search",
    title: "AI Parts Search Engine",
    description: "Semantic search across 3 databases with 95% match accuracy.",
  },
  {
    slug: "supplier-management-software",
    title: "Supplier Management",
    description: "Voice agent automation, email quoting, and price comparison.",
  },
  {
    slug: "heavy-equipment-parts-catalog",
    title: "Heavy Equipment Parts Catalog",
    description: "Digital catalog with diagram search and multi-brand support.",
  },
  {
    slug: "ai-inventory-management",
    title: "AI Inventory Management",
    description: "AI-powered demand forecasting, automated reordering, and predictive analytics.",
  },
  {
    slug: "spare-parts-management-software",
    title: "Spare Parts Management",
    description: "Criticality-based stock levels, shelf life tracking, and emergency availability.",
  },
  {
    slug: "heavy-equipment-maintenance-software",
    title: "Maintenance Software",
    description: "PDF manual parsing, predictive alerts, and parts-linked service intervals.",
  },
  {
    slug: "automated-procurement-software",
    title: "Automated Procurement",
    description: "AI voice agent, automated quoting, quote comparison, and PO tracking.",
  },
]

interface RelatedSolutionsProps {
  currentSlug: string
}

export function RelatedSolutions({ currentSlug }: RelatedSolutionsProps) {
  const related = ALL_SOLUTIONS.filter((s) => s.slug !== currentSlug).slice(0, 4)

  return (
    <section className="py-20 bg-slate-50">
      <div className="max-w-6xl mx-auto px-6">
        <h2 className="text-3xl font-bold text-center mb-4">Explore More Solutions</h2>
        <p className="text-center text-slate-600 mb-12 max-w-2xl mx-auto">
          PartsIQ offers a complete suite of tools for parts inventory management, procurement, and supplier communication.
        </p>
        <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-6">
          {related.map((solution) => (
            <Link
              key={solution.slug}
              href={`/solutions/${solution.slug}`}
              className="group bg-white rounded-xl p-6 border border-slate-200 hover:border-purple-300 hover:shadow-lg transition-all"
            >
              <h3 className="font-semibold text-lg mb-2 group-hover:text-purple-600 transition-colors">
                {solution.title}
              </h3>
              <p className="text-sm text-slate-600 mb-4">{solution.description}</p>
              <span className="inline-flex items-center text-sm font-medium text-purple-600 group-hover:gap-2 transition-all">
                Learn more <ArrowRight className="h-4 w-4 ml-1" />
              </span>
            </Link>
          ))}
        </div>
      </div>
    </section>
  )
}
