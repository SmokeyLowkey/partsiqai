import type { Metadata } from "next"
import { Button } from "@/components/ui/button"
import {
  ArrowRight,
  BookOpen,
  Search,
  Layers,
  Globe,
  Zap,
  CheckCircle,
  FileX,
  Clock,
  ChevronDown,
  Target,
} from "lucide-react"
import Link from "next/link"
import { JsonLd } from "@/components/seo/json-ld"
import { BreadcrumbJsonLd } from "@/components/seo/breadcrumb-jsonld"
import { PublicFooter } from "@/components/layout/public-footer"
import { RelatedSolutions } from "@/components/solutions/related-solutions"

export const metadata: Metadata = {
  title: "Heavy Equipment Parts Catalog",
  description:
    "AI-powered digital parts catalog for CAT, Komatsu, Deere & more. Diagram search with 95% accuracy. Built for heavy equipment dealers.",
  keywords: [
    "heavy equipment parts catalog",
    "digital parts catalog",
    "heavy equipment dealer software",
    "parts diagram search",
    "equipment parts lookup",
    "online parts catalog software",
    "heavy machinery parts catalog",
    "parts cross reference tool",
  ],
  alternates: {
    canonical: "/solutions/heavy-equipment-parts-catalog",
  },
  openGraph: {
    title: "Digital Heavy Equipment Parts Catalog Software",
    description:
      "AI-powered digital parts catalog with diagram search and cross-brand referencing. 95% accuracy for CAT, Komatsu, Deere, and more.",
    url: "/solutions/heavy-equipment-parts-catalog",
  },
}

const faqJsonLd = {
  "@context": "https://schema.org",
  "@type": "FAQPage",
  mainEntity: [
    {
      "@type": "Question",
      name: "What equipment brands does the digital parts catalog support?",
      acceptedAnswer: {
        "@type": "Answer",
        text: "PartsIQ supports parts catalogs from all major heavy equipment manufacturers including Caterpillar, Komatsu, John Deere, Volvo, Hitachi, Liebherr, and more. The platform is brand-agnostic — you can ingest catalogs from any manufacturer and search across all of them simultaneously.",
      },
    },
    {
      "@type": "Question",
      name: "Can I search for parts using a description instead of a part number?",
      acceptedAnswer: {
        "@type": "Answer",
        text: "Yes. PartsIQ uses semantic AI search that understands natural language descriptions. You can search for 'hydraulic filter for Cat 320' or 'undercarriage track link' and the system will find the correct parts even without knowing the exact part number.",
      },
    },
    {
      "@type": "Question",
      name: "How do I import my existing parts data into the digital catalog?",
      acceptedAnswer: {
        "@type": "Answer",
        text: "PartsIQ provides a streamlined CSV import tool. Upload your parts data with columns for part number, title, quantity, category, and diagram references. The system automatically indexes everything for search across PostgreSQL, Pinecone vector, and Neo4j graph databases.",
      },
    },
    {
      "@type": "Question",
      name: "Does the catalog include parts diagrams and exploded views?",
      acceptedAnswer: {
        "@type": "Answer",
        text: "Yes. PartsIQ indexes diagram titles and category breadcrumbs from your parts data, allowing technicians to browse parts in context. Search results include diagram references so you can verify you have the correct part for the specific assembly.",
      },
    },
  ],
}

export default function HeavyEquipmentPartsCatalogPage() {
  return (
    <>
      <JsonLd data={faqJsonLd} />
      <BreadcrumbJsonLd
        items={[
          { name: "Home", url: "/" },
          { name: "Solutions", url: "/solutions" },
          { name: "Heavy Equipment Parts Catalog", url: "/solutions/heavy-equipment-parts-catalog" },
        ]}
      />
      <div className="min-h-screen bg-white">
        {/* Hero Section */}
        <section className="relative bg-slate-950 text-white py-24">
          <div className="absolute inset-0 bg-[linear-gradient(rgba(148,163,184,0.05)_1px,transparent_1px),linear-gradient(90deg,rgba(148,163,184,0.05)_1px,transparent_1px)] bg-[size:64px_64px]"></div>

          <div className="relative container mx-auto px-6">
            <div className="max-w-4xl mx-auto text-center">
              <div className="inline-flex items-center gap-2 bg-emerald-500/10 border border-emerald-500/20 rounded-full px-4 py-1.5 text-emerald-400 text-sm font-medium mb-6">
                <BookOpen className="h-4 w-4" />
                Digital Catalog Solution
              </div>
              <h1 className="text-5xl md:text-6xl font-bold mb-6 tracking-tight">
                Digital Heavy Equipment Parts Catalog Software
              </h1>
              <p className="text-xl text-slate-400 mb-8 max-w-2xl mx-auto">
                Replace paper catalogs and outdated PDFs with an AI-powered digital parts catalog. Search by description, part number, or diagram — and find the right part in seconds, not hours.
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
                  Paper catalogs are holding your team back
                </h2>
                <p className="text-xl text-slate-600 max-w-2xl mx-auto">
                  Technicians waste hours flipping through binders and PDFs while equipment sits idle.
                </p>
              </div>

              <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-8">
                <div className="text-center p-6">
                  <div className="w-12 h-12 bg-red-50 rounded-lg flex items-center justify-center mx-auto mb-4">
                    <FileX className="h-6 w-6 text-red-500" />
                  </div>
                  <h3 className="text-lg font-bold text-slate-950 mb-2">Outdated Information</h3>
                  <p className="text-slate-600 text-sm">Paper catalogs are obsolete the day they are printed. Superseded part numbers lead to wrong orders and returns.</p>
                </div>
                <div className="text-center p-6">
                  <div className="w-12 h-12 bg-red-50 rounded-lg flex items-center justify-center mx-auto mb-4">
                    <Search className="h-6 w-6 text-red-500" />
                  </div>
                  <h3 className="text-lg font-bold text-slate-950 mb-2">No Description Search</h3>
                  <p className="text-slate-600 text-sm">Traditional catalogs require exact part numbers. If a technician only knows the description, they are stuck.</p>
                </div>
                <div className="text-center p-6">
                  <div className="w-12 h-12 bg-red-50 rounded-lg flex items-center justify-center mx-auto mb-4">
                    <Layers className="h-6 w-6 text-red-500" />
                  </div>
                  <h3 className="text-lg font-bold text-slate-950 mb-2">No Cross-Referencing</h3>
                  <p className="text-slate-600 text-sm">Finding equivalent parts across brands requires separate lookups in multiple catalogs and reference sheets.</p>
                </div>
                <div className="text-center p-6">
                  <div className="w-12 h-12 bg-red-50 rounded-lg flex items-center justify-center mx-auto mb-4">
                    <Clock className="h-6 w-6 text-red-500" />
                  </div>
                  <h3 className="text-lg font-bold text-slate-950 mb-2">Slow Lookups</h3>
                  <p className="text-slate-600 text-sm">Searching through hundreds of pages for a single part wastes technician time and delays repairs.</p>
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
                  An intelligent catalog that works the way you do
                </h2>
                <p className="text-xl text-slate-600 max-w-2xl mx-auto">
                  AI-powered search across every brand, every model, every part — from a single interface.
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
                      Search using natural language descriptions, part numbers, model numbers, or diagram references. The AI understands what you mean, even with typos or partial information.
                    </p>
                    <ul className="space-y-2 text-slate-600">
                      <li className="flex items-start gap-2">
                        <CheckCircle className="h-5 w-5 text-emerald-600 mt-0.5 flex-shrink-0" />
                        <span>Semantic search understands descriptions</span>
                      </li>
                      <li className="flex items-start gap-2">
                        <CheckCircle className="h-5 w-5 text-emerald-600 mt-0.5 flex-shrink-0" />
                        <span>Fuzzy matching handles typos and abbreviations</span>
                      </li>
                    </ul>
                  </div>
                </div>

                <div className="flex gap-6">
                  <div className="flex-shrink-0">
                    <div className="w-12 h-12 bg-slate-950 rounded-lg flex items-center justify-center">
                      <BookOpen className="h-6 w-6 text-white" />
                    </div>
                  </div>
                  <div>
                    <h3 className="text-2xl font-bold text-slate-950 mb-3">Diagram Integration</h3>
                    <p className="text-slate-600 mb-4 leading-relaxed">
                      Browse parts in the context of their assembly diagrams. See exactly where a part fits and quickly identify related components from the same diagram.
                    </p>
                    <ul className="space-y-2 text-slate-600">
                      <li className="flex items-start gap-2">
                        <CheckCircle className="h-5 w-5 text-emerald-600 mt-0.5 flex-shrink-0" />
                        <span>Diagram-linked search results</span>
                      </li>
                      <li className="flex items-start gap-2">
                        <CheckCircle className="h-5 w-5 text-emerald-600 mt-0.5 flex-shrink-0" />
                        <span>Category breadcrumb navigation</span>
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
                    <h3 className="text-2xl font-bold text-slate-950 mb-3">Cross-Reference Engine</h3>
                    <p className="text-slate-600 mb-4 leading-relaxed">
                      Automatically find equivalent parts across manufacturers. The knowledge graph maps relationships between OEM parts, aftermarket alternatives, and superseded numbers.
                    </p>
                    <ul className="space-y-2 text-slate-600">
                      <li className="flex items-start gap-2">
                        <CheckCircle className="h-5 w-5 text-emerald-600 mt-0.5 flex-shrink-0" />
                        <span>OEM to aftermarket cross-references</span>
                      </li>
                      <li className="flex items-start gap-2">
                        <CheckCircle className="h-5 w-5 text-emerald-600 mt-0.5 flex-shrink-0" />
                        <span>Superseded part number tracking</span>
                      </li>
                    </ul>
                  </div>
                </div>

                <div className="flex gap-6">
                  <div className="flex-shrink-0">
                    <div className="w-12 h-12 bg-slate-950 rounded-lg flex items-center justify-center">
                      <Globe className="h-6 w-6 text-white" />
                    </div>
                  </div>
                  <div>
                    <h3 className="text-2xl font-bold text-slate-950 mb-3">Multi-Brand Support</h3>
                    <p className="text-slate-600 mb-4 leading-relaxed">
                      Manage catalogs from every equipment manufacturer in one place. Whether you deal in Caterpillar, Komatsu, John Deere, or all of them — PartsIQ handles it.
                    </p>
                    <ul className="space-y-2 text-slate-600">
                      <li className="flex items-start gap-2">
                        <CheckCircle className="h-5 w-5 text-emerald-600 mt-0.5 flex-shrink-0" />
                        <span>Unlimited manufacturers and models</span>
                      </li>
                      <li className="flex items-start gap-2">
                        <CheckCircle className="h-5 w-5 text-emerald-600 mt-0.5 flex-shrink-0" />
                        <span>Unified search across all brands</span>
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
                  How the digital parts catalog works
                </h2>
                <p className="text-xl text-slate-600 max-w-2xl mx-auto">
                  Go from scattered PDFs to a fully searchable equipment parts database in four simple steps. Our parts catalog software handles the heavy lifting so your team can focus on finding the right part.
                </p>
              </div>

              <div className="grid md:grid-cols-2 gap-x-12 gap-y-10 max-w-4xl mx-auto">
                <div className="flex gap-5">
                  <div className="flex-shrink-0">
                    <div className="w-10 h-10 rounded-full bg-slate-950 text-white flex items-center justify-center text-lg font-bold">
                      1
                    </div>
                  </div>
                  <div>
                    <h3 className="text-xl font-bold text-slate-950 mb-2">Upload your parts catalogs</h3>
                    <p className="text-slate-600 leading-relaxed">
                      Import your existing heavy equipment parts catalog data via PDF, CSV, or manual entry. Whether you have a single brand or dozens of manufacturer catalogs, the platform ingests them all into one unified equipment parts database.
                    </p>
                  </div>
                </div>

                <div className="flex gap-5">
                  <div className="flex-shrink-0">
                    <div className="w-10 h-10 rounded-full bg-slate-950 text-white flex items-center justify-center text-lg font-bold">
                      2
                    </div>
                  </div>
                  <div>
                    <h3 className="text-xl font-bold text-slate-950 mb-2">AI indexes every part with semantic understanding</h3>
                    <p className="text-slate-600 leading-relaxed">
                      PartsIQ&apos;s AI engine processes each record, building semantic embeddings, graph relationships, and full-text indexes. The result is a digital parts catalog that understands what each part is, not just its number.
                    </p>
                  </div>
                </div>

                <div className="flex gap-5">
                  <div className="flex-shrink-0">
                    <div className="w-10 h-10 rounded-full bg-slate-950 text-white flex items-center justify-center text-lg font-bold">
                      3
                    </div>
                  </div>
                  <div>
                    <h3 className="text-xl font-bold text-slate-950 mb-2">Search by description, part number, or diagram reference</h3>
                    <p className="text-slate-600 leading-relaxed">
                      Your technicians can search however they think. Type a natural language description like &quot;hydraulic pump seal kit for 320D&quot;, enter a part number, or browse by diagram. The parts catalog software returns ranked results with confidence scores in under a second.
                    </p>
                  </div>
                </div>

                <div className="flex gap-5">
                  <div className="flex-shrink-0">
                    <div className="w-10 h-10 rounded-full bg-slate-950 text-white flex items-center justify-center text-lg font-bold">
                      4
                    </div>
                  </div>
                  <div>
                    <h3 className="text-xl font-bold text-slate-950 mb-2">Find cross-brand equivalents and compatible alternatives</h3>
                    <p className="text-slate-600 leading-relaxed">
                      Once you find a part, PartsIQ&apos;s knowledge graph shows compatible alternatives across manufacturers. If the OEM part is out of stock, you will instantly see aftermarket equivalents and superseded numbers — reducing downtime and saving money.
                    </p>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* Brands We Support Section */}
        <section className="py-24 bg-slate-50">
          <div className="container mx-auto px-6">
            <div className="max-w-6xl mx-auto">
              <div className="mb-16 text-center">
                <h2 className="text-4xl font-bold mb-4 text-slate-950 tracking-tight">
                  Heavy equipment brands we support
                </h2>
                <p className="text-xl text-slate-600 max-w-2xl mx-auto">
                  PartsIQ&apos;s heavy equipment dealer software works with every major manufacturer. Import catalogs from any brand and search across all of them from a single digital parts catalog.
                </p>
              </div>

              <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-8">
                <div className="bg-white border border-slate-200 rounded-lg p-6">
                  <h3 className="text-xl font-bold text-slate-950 mb-2">Caterpillar / CAT</h3>
                  <p className="text-slate-600 text-sm mb-3">
                    Full parts catalog indexing for all CAT equipment models. Search across excavators, dozers, loaders, and every machine in the Caterpillar lineup.
                  </p>
                  <div className="flex items-start gap-2 text-slate-600 text-sm">
                    <CheckCircle className="h-5 w-5 text-emerald-600 mt-0.5 flex-shrink-0" />
                    <span>All CAT model series supported</span>
                  </div>
                </div>

                <div className="bg-white border border-slate-200 rounded-lg p-6">
                  <h3 className="text-xl font-bold text-slate-950 mb-2">John Deere</h3>
                  <p className="text-slate-600 text-sm mb-3">
                    Complete indexing for John Deere construction and forestry equipment parts. From compact excavators to large production-class machines.
                  </p>
                  <div className="flex items-start gap-2 text-slate-600 text-sm">
                    <CheckCircle className="h-5 w-5 text-emerald-600 mt-0.5 flex-shrink-0" />
                    <span>Construction and forestry catalogs</span>
                  </div>
                </div>

                <div className="bg-white border border-slate-200 rounded-lg p-6">
                  <h3 className="text-xl font-bold text-slate-950 mb-2">Komatsu</h3>
                  <p className="text-slate-600 text-sm mb-3">
                    Index and search Komatsu parts catalogs with full cross-reference support. Covers excavators, wheel loaders, dump trucks, and more.
                  </p>
                  <div className="flex items-start gap-2 text-slate-600 text-sm">
                    <CheckCircle className="h-5 w-5 text-emerald-600 mt-0.5 flex-shrink-0" />
                    <span>Full Komatsu parts database coverage</span>
                  </div>
                </div>

                <div className="bg-white border border-slate-200 rounded-lg p-6">
                  <h3 className="text-xl font-bold text-slate-950 mb-2">Volvo CE</h3>
                  <p className="text-slate-600 text-sm mb-3">
                    Volvo Construction Equipment parts catalog support including articulated haulers, excavators, wheel loaders, and compact equipment.
                  </p>
                  <div className="flex items-start gap-2 text-slate-600 text-sm">
                    <CheckCircle className="h-5 w-5 text-emerald-600 mt-0.5 flex-shrink-0" />
                    <span>Volvo CE full equipment range</span>
                  </div>
                </div>

                <div className="bg-white border border-slate-200 rounded-lg p-6">
                  <h3 className="text-xl font-bold text-slate-950 mb-2">Hitachi</h3>
                  <p className="text-slate-600 text-sm mb-3">
                    Hitachi construction machinery parts indexed with AI-powered search. Includes Zaxis excavators, wheel loaders, and mining equipment parts.
                  </p>
                  <div className="flex items-start gap-2 text-slate-600 text-sm">
                    <CheckCircle className="h-5 w-5 text-emerald-600 mt-0.5 flex-shrink-0" />
                    <span>Zaxis and mining series included</span>
                  </div>
                </div>

                <div className="bg-white border border-slate-200 rounded-lg p-6">
                  <h3 className="text-xl font-bold text-slate-950 mb-2">Case / CNH</h3>
                  <p className="text-slate-600 text-sm mb-3">
                    Case Construction and CNH Industrial parts catalog support. Covers backhoe loaders, excavators, skid steers, and all Case equipment models.
                  </p>
                  <div className="flex items-start gap-2 text-slate-600 text-sm">
                    <CheckCircle className="h-5 w-5 text-emerald-600 mt-0.5 flex-shrink-0" />
                    <span>Full CNH Industrial parts coverage</span>
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
                  Your parts catalog, supercharged by AI
                </h2>
                <p className="text-lg text-slate-400 max-w-2xl mx-auto">
                  Results that speak for themselves.
                </p>
              </div>

              <div className="grid md:grid-cols-3 gap-8">
                <div className="text-center p-8 border border-slate-800 rounded-lg">
                  <div className="text-5xl font-bold text-emerald-400 mb-2">95%</div>
                  <div className="text-lg font-medium mb-2">Search Accuracy</div>
                  <p className="text-slate-400 text-sm">Multi-agent AI search across three databases delivers the right part with confidence scoring on every result.</p>
                </div>
                <div className="text-center p-8 border border-slate-800 rounded-lg">
                  <div className="flex items-center justify-center gap-2 mb-2">
                    <Zap className="h-10 w-10 text-emerald-400" />
                  </div>
                  <div className="text-lg font-medium mb-2">Instant Lookup</div>
                  <p className="text-slate-400 text-sm">Sub-second search results replace the minutes spent flipping through paper catalogs and PDF manuals.</p>
                </div>
                <div className="text-center p-8 border border-slate-800 rounded-lg">
                  <div className="text-5xl font-bold text-emerald-400 mb-2">50K+</div>
                  <div className="text-lg font-medium mb-2">Parts Indexed</div>
                  <p className="text-slate-400 text-sm">Import and index tens of thousands of parts with full metadata, diagrams, and cross-references.</p>
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
                  Common questions about the digital heavy equipment parts catalog.
                </p>
              </div>

              <div className="space-y-6">
                <div className="border border-slate-200 rounded-lg p-6">
                  <h3 className="text-lg font-bold text-slate-950 mb-3 flex items-center gap-2">
                    <ChevronDown className="h-5 w-5 text-slate-400" />
                    What equipment brands does the digital parts catalog support?
                  </h3>
                  <p className="text-slate-600 pl-7">
                    PartsIQ supports parts catalogs from all major heavy equipment manufacturers including Caterpillar, Komatsu, John Deere, Volvo, Hitachi, Liebherr, and more. The platform is brand-agnostic — you can ingest catalogs from any manufacturer and search across all of them simultaneously.
                  </p>
                </div>

                <div className="border border-slate-200 rounded-lg p-6">
                  <h3 className="text-lg font-bold text-slate-950 mb-3 flex items-center gap-2">
                    <ChevronDown className="h-5 w-5 text-slate-400" />
                    Can I search for parts using a description instead of a part number?
                  </h3>
                  <p className="text-slate-600 pl-7">
                    Yes. PartsIQ uses semantic AI search that understands natural language descriptions. You can search for &quot;hydraulic filter for Cat 320&quot; or &quot;undercarriage track link&quot; and the system will find the correct parts even without knowing the exact part number.
                  </p>
                </div>

                <div className="border border-slate-200 rounded-lg p-6">
                  <h3 className="text-lg font-bold text-slate-950 mb-3 flex items-center gap-2">
                    <ChevronDown className="h-5 w-5 text-slate-400" />
                    How do I import my existing parts data into the digital catalog?
                  </h3>
                  <p className="text-slate-600 pl-7">
                    PartsIQ provides a streamlined CSV import tool. Upload your parts data with columns for part number, title, quantity, category, and diagram references. The system automatically indexes everything for search across PostgreSQL, Pinecone vector, and Neo4j graph databases.
                  </p>
                </div>

                <div className="border border-slate-200 rounded-lg p-6">
                  <h3 className="text-lg font-bold text-slate-950 mb-3 flex items-center gap-2">
                    <ChevronDown className="h-5 w-5 text-slate-400" />
                    Does the catalog include parts diagrams and exploded views?
                  </h3>
                  <p className="text-slate-600 pl-7">
                    Yes. PartsIQ indexes diagram titles and category breadcrumbs from your parts data, allowing technicians to browse parts in context. Search results include diagram references so you can verify you have the correct part for the specific assembly.
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
                Digitize your parts catalog today
              </h2>
              <p className="text-xl text-slate-600 mb-8">
                Give your technicians the search tool they deserve. Import your catalog and start finding parts in seconds.
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
      <RelatedSolutions currentSlug="heavy-equipment-parts-catalog" />
      <PublicFooter />
    </>
  )
}
