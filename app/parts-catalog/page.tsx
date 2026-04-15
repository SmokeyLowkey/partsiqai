import type { Metadata } from "next"
import Link from "next/link"
import { ArrowRight, Package, Wrench, BookOpen } from "lucide-react"
import { Button } from "@/components/ui/button"
import { BreadcrumbJsonLd } from "@/components/seo/breadcrumb-jsonld"
import { PublicFooter } from "@/components/layout/public-footer"
import { BRANDS } from "@/lib/content/brands"

export const metadata: Metadata = {
  title: "Heavy & Compact Equipment Parts Catalog",
  description:
    "Parts sourcing and management guides for heavy & compact construction equipment. Caterpillar, John Deere, Komatsu, Bobcat, Kubota, and more.",
  keywords: [
    "equipment parts catalog",
    "heavy equipment parts",
    "compact equipment parts",
    "construction equipment parts",
    "parts procurement software",
  ],
  alternates: { canonical: "/parts-catalog" },
  openGraph: {
    title: "Equipment Parts Catalog | PartsIQ",
    description:
      "Parts sourcing guides for heavy & compact construction equipment brands — OEM, aftermarket, and AI-powered procurement workflows.",
    url: "/parts-catalog",
    type: "website",
  },
}

export default function PartsCatalogIndexPage() {
  // Group brands by category — heavy first (traditional ordering for construction buyers)
  const heavyBrands = BRANDS.filter((b) => b.category === "heavy construction equipment")
  const compactBrands = BRANDS.filter((b) => b.category === "compact construction equipment")
  const agBrands = BRANDS.filter((b) => b.category === "agricultural equipment")

  return (
    <>
      <BreadcrumbJsonLd
        items={[
          { name: "Home", url: "/" },
          { name: "Parts Catalog", url: "/parts-catalog" },
        ]}
      />

      <div className="min-h-screen bg-white">
        {/* Hero */}
        <section className="relative bg-slate-950 text-white py-24">
          <div className="absolute inset-0 bg-[linear-gradient(rgba(148,163,184,0.05)_1px,transparent_1px),linear-gradient(90deg,rgba(148,163,184,0.05)_1px,transparent_1px)] bg-[size:64px_64px]" />
          <div className="relative container mx-auto px-6">
            <div className="max-w-4xl mx-auto text-center">
              <div className="inline-flex items-center gap-2 bg-emerald-500/10 border border-emerald-500/20 rounded-full px-4 py-1.5 text-emerald-400 text-sm font-medium mb-6">
                <Package className="h-4 w-4" />
                Parts Sourcing Hub
              </div>
              <h1 className="text-5xl md:text-6xl font-bold mb-6 tracking-tight">
                Equipment Parts Catalog
              </h1>
              <p className="text-xl text-slate-400 mb-8 max-w-2xl mx-auto leading-relaxed">
                Parts management and sourcing guides for heavy & compact construction equipment. OEM vs aftermarket guidance, popular models, and how PartsIQ accelerates parts procurement across your supplier network.
              </p>
              <div className="flex flex-col sm:flex-row gap-4 justify-center">
                <Link href="/signup">
                  <Button size="lg" className="bg-white text-slate-950 hover:bg-slate-100 px-8 h-14 text-lg font-medium">
                    Start Free Trial
                    <ArrowRight className="ml-2 h-5 w-5" />
                  </Button>
                </Link>
                <Link href="#brands">
                  <Button size="lg" variant="outline" className="border-slate-700 text-white hover:bg-slate-900 bg-transparent px-8 h-14 text-lg">
                    Browse brands
                  </Button>
                </Link>
              </div>
            </div>
          </div>
        </section>

        {/* Intro */}
        <section className="py-16 bg-white">
          <div className="container mx-auto px-6">
            <div className="max-w-3xl mx-auto">
              <h2 className="text-3xl font-bold text-slate-950 mb-4 tracking-tight">What you'll find here</h2>
              <p className="text-lg text-slate-700 leading-relaxed mb-4">
                Each brand page covers equipment types, popular models, common parts categories, OEM vs aftermarket guidance, and practical sourcing challenges. PartsIQ is a parts procurement platform, not a dealer — we help operations teams source parts faster across OEM and aftermarket channels.
              </p>
              <p className="text-lg text-slate-700 leading-relaxed">
                Currently covering {BRANDS.length} major manufacturers across heavy construction, compact construction, and agricultural equipment categories.
              </p>
            </div>
          </div>
        </section>

        {/* Heavy construction brands */}
        <section id="brands" className="py-20 bg-slate-50 scroll-mt-20">
          <div className="container mx-auto px-6">
            <div className="max-w-6xl mx-auto">
              <div className="mb-10">
                <div className="flex items-center gap-3 mb-3">
                  <div className="rounded-lg bg-slate-900 p-2 text-white">
                    <Wrench className="h-5 w-5" />
                  </div>
                  <h2 className="text-3xl md:text-4xl font-bold text-slate-950 tracking-tight">
                    Heavy construction equipment
                  </h2>
                </div>
                <p className="text-slate-600 max-w-2xl">
                  Excavators, wheel loaders, dozers, backhoes, and articulated trucks from the world's major heavy equipment manufacturers.
                </p>
              </div>
              <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-5">
                {heavyBrands.map((b) => (
                  <Link
                    key={b.slug}
                    href={`/parts-catalog/${b.slug}`}
                    className="group rounded-2xl bg-white border border-slate-200 p-6 hover:border-emerald-400 hover:shadow-md transition-all"
                  >
                    <h3 className="text-xl font-bold text-slate-950 mb-2 group-hover:text-emerald-700 transition-colors">
                      {b.name} Parts
                    </h3>
                    <p className="text-sm text-slate-600 mb-4 leading-relaxed">{b.tagline}</p>
                    <span className="inline-flex items-center gap-1.5 text-sm font-medium text-emerald-600 group-hover:gap-2 transition-all">
                      Explore {b.name} parts
                      <ArrowRight className="h-4 w-4" />
                    </span>
                  </Link>
                ))}
              </div>
            </div>
          </div>
        </section>

        {/* Compact construction brands */}
        <section className="py-20 bg-white">
          <div className="container mx-auto px-6">
            <div className="max-w-6xl mx-auto">
              <div className="mb-10">
                <div className="flex items-center gap-3 mb-3">
                  <div className="rounded-lg bg-emerald-600 p-2 text-white">
                    <Wrench className="h-5 w-5" />
                  </div>
                  <h2 className="text-3xl md:text-4xl font-bold text-slate-950 tracking-tight">
                    Compact construction equipment
                  </h2>
                </div>
                <p className="text-slate-600 max-w-2xl">
                  Skid-steer loaders, compact excavators, compact track loaders, and compact utility equipment for construction, landscaping, and utility work.
                </p>
              </div>
              <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-5">
                {compactBrands.map((b) => (
                  <Link
                    key={b.slug}
                    href={`/parts-catalog/${b.slug}`}
                    className="group rounded-2xl bg-white border border-slate-200 p-6 hover:border-emerald-400 hover:shadow-md transition-all"
                  >
                    <h3 className="text-xl font-bold text-slate-950 mb-2 group-hover:text-emerald-700 transition-colors">
                      {b.name} Parts
                    </h3>
                    <p className="text-sm text-slate-600 mb-4 leading-relaxed">{b.tagline}</p>
                    <span className="inline-flex items-center gap-1.5 text-sm font-medium text-emerald-600 group-hover:gap-2 transition-all">
                      Explore {b.name} parts
                      <ArrowRight className="h-4 w-4" />
                    </span>
                  </Link>
                ))}
              </div>
            </div>
          </div>
        </section>

        {/* Agricultural brands */}
        {agBrands.length > 0 && (
          <section className="py-20 bg-slate-50">
            <div className="container mx-auto px-6">
              <div className="max-w-6xl mx-auto">
                <div className="mb-10">
                  <div className="flex items-center gap-3 mb-3">
                    <div className="rounded-lg bg-amber-600 p-2 text-white">
                      <Wrench className="h-5 w-5" />
                    </div>
                    <h2 className="text-3xl md:text-4xl font-bold text-slate-950 tracking-tight">
                      Agricultural equipment
                    </h2>
                  </div>
                  <p className="text-slate-600 max-w-2xl">
                    Tractors, combines, balers, and hay tools for agricultural operations — often running alongside construction fleets in mixed-equipment operations.
                  </p>
                </div>
                <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-5">
                  {agBrands.map((b) => (
                    <Link
                      key={b.slug}
                      href={`/parts-catalog/${b.slug}`}
                      className="group rounded-2xl bg-white border border-slate-200 p-6 hover:border-emerald-400 hover:shadow-md transition-all"
                    >
                      <h3 className="text-xl font-bold text-slate-950 mb-2 group-hover:text-emerald-700 transition-colors">
                        {b.name} Parts
                      </h3>
                      <p className="text-sm text-slate-600 mb-4 leading-relaxed">{b.tagline}</p>
                      <span className="inline-flex items-center gap-1.5 text-sm font-medium text-emerald-600 group-hover:gap-2 transition-all">
                        Explore {b.name} parts
                        <ArrowRight className="h-4 w-4" />
                      </span>
                    </Link>
                  ))}
                </div>
              </div>
            </div>
          </section>
        )}

        {/* How PartsIQ complements brand catalogs */}
        <section className="py-20 bg-slate-950 text-white">
          <div className="container mx-auto px-6">
            <div className="max-w-4xl mx-auto">
              <div className="flex items-center gap-3 mb-6">
                <div className="rounded-lg bg-emerald-500/20 border border-emerald-500/30 p-2 text-emerald-400">
                  <BookOpen className="h-5 w-5" />
                </div>
                <h2 className="text-3xl md:text-4xl font-bold tracking-tight">
                  How PartsIQ complements OEM parts catalogs
                </h2>
              </div>
              <div className="grid md:grid-cols-2 gap-8 text-slate-300 leading-relaxed">
                <div>
                  <h3 className="text-lg font-bold text-white mb-2">OEM catalogs tell you what</h3>
                  <p>
                    Manufacturer parts catalogs (Deere.com, parts.cat.com, etc.) are the authoritative source for part numbers, exploded-view diagrams, and OEM pricing at a specific dealer. Use them to identify the exact part you need.
                  </p>
                </div>
                <div>
                  <h3 className="text-lg font-bold text-white mb-2">PartsIQ tells you where & how much</h3>
                  <p>
                    PartsIQ sources that part across your supplier network — OEM dealers, Reman programs, aftermarket vendors — in parallel, with an AI voice agent that calls suppliers directly and returns side-by-side quotes. We don't replace the OEM catalog; we accelerate sourcing against it.
                  </p>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* CTA */}
        <section className="py-20 bg-white">
          <div className="container mx-auto px-6">
            <div className="max-w-3xl mx-auto text-center">
              <h2 className="text-3xl md:text-4xl font-bold text-slate-950 tracking-tight mb-4">
                Ready to cut parts sourcing time?
              </h2>
              <p className="text-lg text-slate-600 mb-8">
                PartsIQ's AI voice agent calls suppliers, extracts quotes, and compares prices side-by-side — built for heavy & compact equipment operations.
              </p>
              <div className="flex flex-col sm:flex-row gap-4 justify-center">
                <Link href="/signup">
                  <Button size="lg" className="bg-slate-950 text-white hover:bg-slate-800 px-8 h-14 text-lg font-medium">
                    Start Free Trial
                    <ArrowRight className="ml-2 h-5 w-5" />
                  </Button>
                </Link>
                <Link href="/pricing">
                  <Button size="lg" variant="outline" className="border-slate-300 text-slate-950 hover:bg-slate-100 px-8 h-14 text-lg">
                    View Pricing
                  </Button>
                </Link>
              </div>
            </div>
          </div>
        </section>

        {/* Legal disclaimer */}
        <section className="py-10 bg-slate-100 border-t border-slate-200">
          <div className="container mx-auto px-6">
            <div className="max-w-3xl mx-auto">
              <p className="text-xs text-slate-500 leading-relaxed text-center">
                <strong>Disclaimer:</strong> PartsIQ is not affiliated with, sponsored by, or endorsed by any of the equipment manufacturers referenced on this site. All trademarks, logos, brand names, model designations, and part numbers are the property of their respective owners and are used here solely to describe equipment compatibility and procurement workflows under nominative fair use. PartsIQ is an independent parts procurement platform and does not sell OEM parts directly.
              </p>
            </div>
          </div>
        </section>
      </div>
      <PublicFooter />
    </>
  )
}
