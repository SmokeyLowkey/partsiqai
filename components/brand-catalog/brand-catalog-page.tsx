import Link from "next/link"
import { ArrowRight, ExternalLink, Package, Wrench, ShieldAlert, BookOpen, Search, Phone } from "lucide-react"
import { Button } from "@/components/ui/button"
import { PublicFooter } from "@/components/layout/public-footer"
import { RelatedSolutions } from "@/components/solutions/related-solutions"
import { BlogCTA } from "@/components/blog/blog-cta"
import { JsonLd } from "@/components/seo/json-ld"
import { BreadcrumbJsonLd } from "@/components/seo/breadcrumb-jsonld"
import { BRANDS, type BrandEntry } from "@/lib/content/brands"

// Maps each brand category to its primary commercial landing page so each
// brand-hub passes link equity into the matching solutions cluster.
const CATEGORY_TO_SOLUTION: Record<BrandEntry["category"], { slug: string; title: string }> = {
  "heavy construction equipment": {
    slug: "heavy-equipment-maintenance-software",
    title: "Heavy equipment maintenance software",
  },
  "compact construction equipment": {
    slug: "parts-inventory-management-software",
    title: "Parts inventory management software",
  },
  "agricultural equipment": {
    slug: "spare-parts-management-software",
    title: "Spare parts management software",
  },
  "forestry equipment": {
    slug: "spare-parts-management-software",
    title: "Spare parts management software",
  },
}

/**
 * Programmatic brand-catalog page template. Targets brand-name keyword
 * clusters (e.g. "bobcat parts") via nominative fair use — never hosts
 * OEM logos, trade dress, or copyrighted parts diagrams; always links
 * out to the OEM's official catalog; renders a disclaimer footer.
 */
export function BrandCatalogPage({ brand }: { brand: BrandEntry }) {
  const { name, legalName, slug, tagline, description, equipmentTypes, popularModels, popularPartsCategories, oemCatalogUrl, sourcingChallenges, oemVsAftermarket, faq, category } = brand

  // Sibling brands in the same equipment category — drives cross-cluster
  // internal linking so each brand page passes authority to its peers.
  const siblingBrands = BRANDS.filter((b) => b.category === category && b.slug !== slug).slice(0, 3)
  const matchingSolution = CATEGORY_TO_SOLUTION[category]

  const faqJsonLd = {
    "@context": "https://schema.org",
    "@type": "FAQPage",
    mainEntity: faq.map((f) => ({
      "@type": "Question",
      name: f.question,
      acceptedAnswer: { "@type": "Answer", text: f.answer },
    })),
  }

  return (
    <>
      <JsonLd data={faqJsonLd} />
      <BreadcrumbJsonLd
        items={[
          { name: "Home", url: "/" },
          { name: "Parts Catalog", url: "/parts-catalog" },
          { name: `${name} Parts`, url: `/parts-catalog/${slug}` },
        ]}
      />

      <div className="min-h-screen bg-white">
        {/* Hero — "Parts management for [Brand] equipment" framing, not "Official" */}
        <section className="relative bg-slate-950 text-white py-24">
          <div className="absolute inset-0 bg-[linear-gradient(rgba(148,163,184,0.05)_1px,transparent_1px),linear-gradient(90deg,rgba(148,163,184,0.05)_1px,transparent_1px)] bg-[size:64px_64px]" />
          <div className="relative container mx-auto px-6">
            <div className="max-w-4xl mx-auto text-center">
              <div className="inline-flex items-center gap-2 bg-emerald-500/10 border border-emerald-500/20 rounded-full px-4 py-1.5 text-emerald-400 text-sm font-medium mb-6">
                <Package className="h-4 w-4" />
                Parts Sourcing Guide
              </div>
              <h1 className="text-5xl md:text-6xl font-bold mb-6 tracking-tight">
                {name} Parts Management
              </h1>
              <p className="text-xl text-slate-400 mb-8 max-w-2xl mx-auto leading-relaxed">
                {tagline}
              </p>
              <div className="flex flex-col sm:flex-row gap-4 justify-center">
                <Link href="/signup">
                  <Button size="lg" className="bg-white text-slate-950 hover:bg-slate-100 px-8 h-14 text-lg font-medium">
                    Start Free Trial
                    <ArrowRight className="ml-2 h-5 w-5" />
                  </Button>
                </Link>
                <Link href="#popular-parts">
                  <Button size="lg" variant="outline" className="border-slate-700 text-white hover:bg-slate-900 bg-transparent px-8 h-14 text-lg">
                    Explore {name} parts
                  </Button>
                </Link>
              </div>
            </div>
          </div>
        </section>

        {/* About the brand — factual intro */}
        <section className="py-16 bg-white">
          <div className="container mx-auto px-6">
            <div className="max-w-3xl mx-auto">
              <h2 className="text-3xl md:text-4xl font-bold text-slate-950 mb-6 tracking-tight">
                About {name} equipment
              </h2>
              <p className="text-lg text-slate-700 leading-relaxed mb-6">{description}</p>
              <div>
                <p className="text-sm font-semibold text-slate-900 mb-3 uppercase tracking-wider">Equipment types</p>
                <div className="flex flex-wrap gap-2">
                  {equipmentTypes.map((t) => (
                    <span key={t} className="inline-block rounded-full border border-slate-200 bg-slate-50 px-3 py-1 text-sm text-slate-700">
                      {t}
                    </span>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* Popular models — captures long-tail model keywords naturally */}
        <section className="py-16 bg-slate-50">
          <div className="container mx-auto px-6">
            <div className="max-w-5xl mx-auto">
              <h2 className="text-3xl md:text-4xl font-bold text-slate-950 mb-3 tracking-tight">
                Common {name} models
              </h2>
              <p className="text-slate-600 mb-10">Parts sourcing guidance applies across {name}'s active product lineup. These are the models we see most often in customer fleets.</p>
              <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
                {popularModels.map((m) => (
                  <div key={m.model} className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
                    <p className="font-bold text-slate-900 text-lg">{m.model}</p>
                    <p className="text-sm text-slate-600 mt-1">{m.type}</p>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </section>

        {/* Popular parts categories */}
        <section id="popular-parts" className="py-20 bg-white scroll-mt-20">
          <div className="container mx-auto px-6">
            <div className="max-w-5xl mx-auto">
              <h2 className="text-3xl md:text-4xl font-bold text-slate-950 mb-3 tracking-tight">
                Common {name} parts categories
              </h2>
              <p className="text-slate-600 mb-10">What operations teams typically source for {name} equipment. PartsIQ covers every category across your supplier network.</p>
              <div className="grid md:grid-cols-2 gap-4">
                {popularPartsCategories.map((c) => (
                  <div key={c.name} className="rounded-xl border border-slate-200 bg-white p-6">
                    <div className="flex items-start gap-3">
                      <div className="shrink-0 rounded-lg bg-emerald-100 p-2 text-emerald-700">
                        <Wrench className="h-5 w-5" />
                      </div>
                      <div>
                        <h3 className="font-bold text-slate-900 mb-1">{c.name}</h3>
                        <p className="text-sm text-slate-600 leading-relaxed">{c.examples}</p>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </section>

        {/* Official catalog callout — link-out, no scraped content */}
        <section className="py-14 bg-gradient-to-br from-slate-50 to-white">
          <div className="container mx-auto px-6">
            <div className="max-w-3xl mx-auto rounded-2xl border border-slate-200 bg-white p-8 shadow-sm">
              <div className="flex flex-col md:flex-row md:items-center gap-6">
                <div className="shrink-0 rounded-xl bg-slate-900 p-4 text-white">
                  <BookOpen className="h-6 w-6" />
                </div>
                <div className="flex-1">
                  <h3 className="text-xl font-bold text-slate-900 mb-2">
                    Official {name} parts catalog &amp; diagrams
                  </h3>
                  <p className="text-slate-600 leading-relaxed">
                    For authoritative OEM part numbers and exploded-view diagrams, refer to {name}'s official parts catalog. PartsIQ sources parts across your supplier network — we don't replace the OEM catalog, we help you source against it.
                  </p>
                </div>
                <a
                  href={oemCatalogUrl}
                  target="_blank"
                  rel="noopener noreferrer nofollow"
                  className="shrink-0 inline-flex items-center gap-2 rounded-lg bg-slate-900 text-white px-5 py-3 font-semibold hover:bg-slate-800 transition-colors"
                >
                  Open {name} catalog
                  <ExternalLink className="h-4 w-4" />
                </a>
              </div>
            </div>
          </div>
        </section>

        {/* OEM vs Aftermarket guidance */}
        <section className="py-20 bg-slate-50">
          <div className="container mx-auto px-6">
            <div className="max-w-5xl mx-auto">
              <div className="text-center mb-12">
                <h2 className="text-3xl md:text-4xl font-bold text-slate-950 tracking-tight mb-3">
                  OEM vs aftermarket for {name} parts
                </h2>
                <p className="text-slate-600">Honest guidance. Both channels have a place — the question is which fits which part.</p>
              </div>
              <div className="grid md:grid-cols-2 gap-6">
                <div className="rounded-2xl border-2 border-slate-200 bg-white p-8">
                  <h3 className="text-xl font-bold text-slate-950 mb-3">Prefer OEM for…</h3>
                  <p className="text-slate-700 leading-relaxed">{oemVsAftermarket.preferOem}</p>
                </div>
                <div className="rounded-2xl border-2 border-emerald-500 bg-gradient-to-br from-white to-emerald-50/40 p-8 shadow-sm">
                  <h3 className="text-xl font-bold text-slate-950 mb-3">Aftermarket is commonly used for…</h3>
                  <p className="text-slate-700 leading-relaxed">{oemVsAftermarket.aftermarketOk}</p>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* Sourcing challenges */}
        <section className="py-20 bg-white">
          <div className="container mx-auto px-6">
            <div className="max-w-3xl mx-auto">
              <div className="flex items-center gap-3 mb-6">
                <div className="rounded-lg bg-amber-100 p-2 text-amber-700">
                  <ShieldAlert className="h-5 w-5" />
                </div>
                <h2 className="text-3xl md:text-4xl font-bold text-slate-950 tracking-tight">
                  Sourcing challenges for {name}
                </h2>
              </div>
              <p className="text-slate-600 mb-8">Patterns we see across teams running {name} equipment.</p>
              <ul className="space-y-4">
                {sourcingChallenges.map((c, i) => (
                  <li key={i} className="flex items-start gap-3 text-slate-700">
                    <span className="shrink-0 mt-2 w-1.5 h-1.5 rounded-full bg-amber-500" />
                    <span className="leading-relaxed">{c}</span>
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </section>

        {/* How PartsIQ helps */}
        <section className="py-20 bg-slate-950 text-white">
          <div className="container mx-auto px-6">
            <div className="max-w-4xl mx-auto">
              <h2 className="text-3xl md:text-4xl font-bold mb-4 tracking-tight">
                How PartsIQ helps source {name} parts
              </h2>
              <p className="text-slate-400 mb-10 leading-relaxed">
                PartsIQ is a parts procurement platform — not a {name} dealer. We source across your verified supplier network and use AI to collect quotes faster.
              </p>
              <div className="grid md:grid-cols-3 gap-6">
                <div className="rounded-xl bg-slate-900 border border-slate-800 p-6">
                  <Phone className="h-6 w-6 text-emerald-400 mb-3" />
                  <h3 className="font-bold text-lg mb-2">AI voice agent</h3>
                  <p className="text-sm text-slate-400 leading-relaxed">Calls {name} dealers and aftermarket suppliers in parallel to collect quotes.</p>
                </div>
                <div className="rounded-xl bg-slate-900 border border-slate-800 p-6">
                  <Search className="h-6 w-6 text-emerald-400 mb-3" />
                  <h3 className="font-bold text-lg mb-2">AI parts search</h3>
                  <p className="text-sm text-slate-400 leading-relaxed">Find parts by description, part number, or equipment model across multiple databases.</p>
                </div>
                <div className="rounded-xl bg-slate-900 border border-slate-800 p-6">
                  <Package className="h-6 w-6 text-emerald-400 mb-3" />
                  <h3 className="font-bold text-lg mb-2">Quote comparison</h3>
                  <p className="text-sm text-slate-400 leading-relaxed">Side-by-side quotes from multiple suppliers with pricing, lead time, and availability.</p>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* FAQ */}
        <section className="py-20 bg-white">
          <div className="container mx-auto px-6">
            <div className="max-w-3xl mx-auto">
              <h2 className="text-3xl md:text-4xl font-bold text-slate-950 tracking-tight mb-10 text-center">
                Frequently asked questions about {name} parts
              </h2>
              <div className="space-y-8">
                {faq.map((item, i) => (
                  <div key={i}>
                    <h3 className="text-lg font-bold text-slate-950 mb-2">{item.question}</h3>
                    <p className="text-slate-600 leading-relaxed">{item.answer}</p>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </section>

        {/* Related guides — cross-cluster internal linking to blog pillar,
            sibling brand pages, and the matching commercial solution.
            Passes authority across the content graph instead of leaving each
            brand page as an island. */}
        <section className="py-20 bg-slate-50 border-t border-slate-200">
          <div className="container mx-auto px-6">
            <div className="max-w-6xl mx-auto">
              <div className="mb-12">
                <h2 className="text-3xl md:text-4xl font-bold text-slate-950 tracking-tight mb-3">
                  Continue your {name} parts research
                </h2>
                <p className="text-slate-600">
                  Guides, sibling brands, and the procurement platform built for {category}.
                </p>
              </div>

              {/* Row 1 — sibling brand pages */}
              {siblingBrands.length > 0 && (
                <div className="mb-10">
                  <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-4">
                    Other {category} brands
                  </p>
                  <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
                    {siblingBrands.map((b) => (
                      <Link
                        key={b.slug}
                        href={`/parts-catalog/${b.slug}`}
                        className="group rounded-xl bg-white border border-slate-200 p-5 hover:border-emerald-400 hover:shadow-md transition-all"
                      >
                        <h3 className="text-lg font-bold text-slate-950 mb-1.5 group-hover:text-emerald-700 transition-colors">
                          {b.name} Parts
                        </h3>
                        <p className="text-sm text-slate-600 leading-relaxed mb-3">{b.tagline}</p>
                        <span className="inline-flex items-center gap-1.5 text-sm font-medium text-emerald-600 group-hover:gap-2 transition-all">
                          View {b.name} guide
                          <ArrowRight className="h-4 w-4" />
                        </span>
                      </Link>
                    ))}
                  </div>
                </div>
              )}

              {/* Row 2 — pillar guide + page-1 blog posts + commercial solution */}
              <div>
                <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-4">
                  Parts management guides
                </p>
                <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-4">
                  <Link
                    href="/blog/parts-inventory-management-complete-guide"
                    className="group rounded-xl bg-white border border-slate-200 p-5 hover:border-emerald-400 hover:shadow-md transition-all"
                  >
                    <div className="rounded-lg bg-slate-900 p-2 text-white w-fit mb-3">
                      <BookOpen className="h-4 w-4" />
                    </div>
                    <h3 className="font-bold text-slate-950 mb-1.5 group-hover:text-emerald-700 transition-colors">
                      Parts Inventory Management: Complete Guide
                    </h3>
                    <p className="text-sm text-slate-600 leading-relaxed">
                      End-to-end pillar: forecasting, stock levels, KPIs, supplier networks.
                    </p>
                  </Link>

                  <Link
                    href="/blog/mro-parts-inventory-cut-carrying-costs"
                    className="group rounded-xl bg-white border border-slate-200 p-5 hover:border-emerald-400 hover:shadow-md transition-all"
                  >
                    <div className="rounded-lg bg-emerald-600 p-2 text-white w-fit mb-3">
                      <BookOpen className="h-4 w-4" />
                    </div>
                    <h3 className="font-bold text-slate-950 mb-1.5 group-hover:text-emerald-700 transition-colors">
                      Cut MRO Carrying Costs by 30%
                    </h3>
                    <p className="text-sm text-slate-600 leading-relaxed">
                      5-step playbook — ABC classify, audit dead stock, automate replenishment.
                    </p>
                  </Link>

                  <Link
                    href="/blog/automate-parts-reorder-never-run-out"
                    className="group rounded-xl bg-white border border-slate-200 p-5 hover:border-emerald-400 hover:shadow-md transition-all"
                  >
                    <div className="rounded-lg bg-emerald-600 p-2 text-white w-fit mb-3">
                      <BookOpen className="h-4 w-4" />
                    </div>
                    <h3 className="font-bold text-slate-950 mb-1.5 group-hover:text-emerald-700 transition-colors">
                      Automate Reorder Points
                    </h3>
                    <p className="text-sm text-slate-600 leading-relaxed">
                      The formula that stops 60% of stockouts before they happen.
                    </p>
                  </Link>

                  <Link
                    href={`/solutions/${matchingSolution.slug}`}
                    className="group rounded-xl bg-slate-950 text-white border border-slate-800 p-5 hover:border-emerald-400 hover:shadow-md transition-all"
                  >
                    <div className="rounded-lg bg-emerald-500/20 border border-emerald-500/30 p-2 text-emerald-400 w-fit mb-3">
                      <Search className="h-4 w-4" />
                    </div>
                    <h3 className="font-bold text-white mb-1.5 group-hover:text-emerald-400 transition-colors">
                      {matchingSolution.title}
                    </h3>
                    <p className="text-sm text-slate-400 leading-relaxed">
                      The PartsIQ solution built for {category} operations.
                    </p>
                  </Link>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* Related solutions */}
        <RelatedSolutions currentSlug="" />

        {/* Lead capture footer */}
        <section className="py-20 bg-white">
          <div className="container mx-auto px-6">
            <div className="max-w-3xl mx-auto">
              <BlogCTA
                variant="footer"
                source={`parts-catalog-${slug}`}
                title={`Ready to streamline ${name} parts sourcing?`}
                description={`See how PartsIQ's AI voice agent calls your ${name} suppliers, compares quotes side-by-side, and cuts sourcing time from hours to minutes. 15-minute walkthrough.`}
                ctaText="Request demo"
              />
            </div>
          </div>
        </section>

        {/* Legal disclaimer — nominative fair use notice */}
        <section className="py-10 bg-slate-100 border-t border-slate-200">
          <div className="container mx-auto px-6">
            <div className="max-w-3xl mx-auto">
              <p className="text-xs text-slate-500 leading-relaxed text-center">
                <strong>Disclaimer:</strong> PartsIQ is not affiliated with, sponsored by, or endorsed by {legalName}. All trademarks, logos, brand names, model designations, and part numbers referenced on this page are the property of their respective owners and are used here solely to describe equipment compatibility and procurement workflows under nominative fair use. PartsIQ is an independent parts procurement platform and does not sell OEM parts directly.
              </p>
            </div>
          </div>
        </section>
      </div>
      <PublicFooter />
    </>
  )
}
