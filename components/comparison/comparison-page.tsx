import Link from "next/link"
import { ArrowRight, Check, X, Minus, GitCompare } from "lucide-react"
import { Button } from "@/components/ui/button"
import { PublicFooter } from "@/components/layout/public-footer"
import { RelatedSolutions } from "@/components/solutions/related-solutions"
import { BlogCTA } from "@/components/blog/blog-cta"
import { JsonLd } from "@/components/seo/json-ld"
import { BreadcrumbJsonLd } from "@/components/seo/breadcrumb-jsonld"
import type { CompetitorEntry, FeatureSupport } from "@/lib/content/competitors"

function SupportCell({ status }: { status: FeatureSupport }) {
  if (status === "yes") {
    return (
      <span className="inline-flex items-center gap-1.5 text-emerald-600 dark:text-emerald-400 font-medium">
        <Check className="h-4 w-4" />
        Yes
      </span>
    )
  }
  if (status === "partial") {
    return (
      <span className="inline-flex items-center gap-1.5 text-amber-600 dark:text-amber-400 font-medium">
        <Minus className="h-4 w-4" />
        Partial
      </span>
    )
  }
  return (
    <span className="inline-flex items-center gap-1.5 text-slate-400 font-medium">
      <X className="h-4 w-4" />
      No
    </span>
  )
}

export function ComparisonPage({ competitor }: { competitor: CompetitorEntry }) {
  const { name, slug, positioning, differentiator, features, chooseCompetitor, choosePartsIQ, faq } = competitor

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
          { name: "Compare", url: "/vs" },
          { name: `PartsIQ vs ${name}`, url: `/vs/${slug}` },
        ]}
      />

      <div className="min-h-screen bg-white">
        {/* Hero */}
        <section className="relative bg-slate-950 text-white py-24">
          <div className="absolute inset-0 bg-[linear-gradient(rgba(148,163,184,0.05)_1px,transparent_1px),linear-gradient(90deg,rgba(148,163,184,0.05)_1px,transparent_1px)] bg-[size:64px_64px]" />
          <div className="relative container mx-auto px-6">
            <div className="max-w-4xl mx-auto text-center">
              <div className="inline-flex items-center gap-2 bg-emerald-500/10 border border-emerald-500/20 rounded-full px-4 py-1.5 text-emerald-400 text-sm font-medium mb-6">
                <GitCompare className="h-4 w-4" />
                Platform Comparison
              </div>
              <h1 className="text-5xl md:text-6xl font-bold mb-6 tracking-tight">
                PartsIQ vs {name}
              </h1>
              <p className="text-xl text-slate-400 mb-8 max-w-2xl mx-auto leading-relaxed">
                {positioning}
              </p>
              <div className="flex flex-col sm:flex-row gap-4 justify-center">
                <Link href="/signup">
                  <Button size="lg" className="bg-white text-slate-950 hover:bg-slate-100 px-8 h-14 text-lg font-medium">
                    Start Free Trial
                    <ArrowRight className="ml-2 h-5 w-5" />
                  </Button>
                </Link>
                <Link href="#feature-comparison">
                  <Button size="lg" variant="outline" className="border-slate-700 text-white hover:bg-slate-900 bg-transparent px-8 h-14 text-lg">
                    Jump to comparison
                  </Button>
                </Link>
              </div>
            </div>
          </div>
        </section>

        {/* Differentiator callout */}
        <section className="py-16 bg-gradient-to-br from-emerald-50 via-white to-emerald-50/40">
          <div className="container mx-auto px-6">
            <div className="max-w-3xl mx-auto text-center">
              <p className="text-2xl md:text-3xl font-semibold text-slate-900 leading-snug">
                {differentiator}
              </p>
            </div>
          </div>
        </section>

        {/* Choose which */}
        <section className="py-20 bg-white">
          <div className="container mx-auto px-6">
            <div className="max-w-5xl mx-auto">
              <div className="text-center mb-12">
                <h2 className="text-3xl md:text-4xl font-bold text-slate-950 tracking-tight mb-3">
                  Which one is right for you?
                </h2>
                <p className="text-slate-600">Both platforms are well-built. The right choice depends on your primary workflow.</p>
              </div>

              <div className="grid md:grid-cols-2 gap-6">
                <div className="rounded-2xl border-2 border-slate-200 bg-white p-8">
                  <h3 className="text-xl font-bold text-slate-950 mb-1">Choose {name} if you…</h3>
                  <p className="text-sm text-slate-500 mb-5">They'll serve you better for these workflows.</p>
                  <ul className="space-y-3">
                    {chooseCompetitor.map((item, i) => (
                      <li key={i} className="flex items-start gap-3 text-slate-700">
                        <Check className="h-5 w-5 text-slate-400 shrink-0 mt-0.5" />
                        <span>{item}</span>
                      </li>
                    ))}
                  </ul>
                </div>

                <div className="rounded-2xl border-2 border-emerald-500 bg-gradient-to-br from-white to-emerald-50/40 p-8 shadow-sm">
                  <h3 className="text-xl font-bold text-slate-950 mb-1">Choose PartsIQ if you…</h3>
                  <p className="text-sm text-emerald-700 mb-5">We'll serve you better for these workflows.</p>
                  <ul className="space-y-3">
                    {choosePartsIQ.map((item, i) => (
                      <li key={i} className="flex items-start gap-3 text-slate-700">
                        <Check className="h-5 w-5 text-emerald-600 shrink-0 mt-0.5" />
                        <span className="font-medium">{item}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* Feature comparison table */}
        <section id="feature-comparison" className="py-20 bg-slate-50 scroll-mt-20">
          <div className="container mx-auto px-6">
            <div className="max-w-5xl mx-auto">
              <div className="text-center mb-12">
                <h2 className="text-3xl md:text-4xl font-bold text-slate-950 tracking-tight mb-3">
                  Feature comparison
                </h2>
                <p className="text-slate-600">Honest side-by-side of capabilities.</p>
              </div>

              <div className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
                <table className="w-full">
                  <thead className="bg-slate-900 text-white">
                    <tr>
                      <th className="text-left py-4 px-6 font-semibold text-sm">Capability</th>
                      <th className="text-center py-4 px-6 font-semibold text-sm">PartsIQ</th>
                      <th className="text-center py-4 px-6 font-semibold text-sm">{name}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {features.map((row, i) => (
                      <tr key={i} className={i % 2 === 0 ? "bg-white" : "bg-slate-50"}>
                        <td className="py-4 px-6 text-slate-900 text-sm">{row.label}</td>
                        <td className="py-4 px-6 text-center"><SupportCell status={row.partsiq} /></td>
                        <td className="py-4 px-6 text-center"><SupportCell status={row.competitor} /></td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              <p className="text-xs text-slate-500 text-center mt-4">
                Based on publicly available information about {name} as of 2026. Features evolve; verify with the vendor for your use case.
              </p>
            </div>
          </div>
        </section>

        {/* FAQ */}
        <section className="py-20 bg-white">
          <div className="container mx-auto px-6">
            <div className="max-w-3xl mx-auto">
              <h2 className="text-3xl md:text-4xl font-bold text-slate-950 tracking-tight mb-10 text-center">
                Frequently asked questions
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

        {/* Related solutions — component provides its own section wrapper */}
        <RelatedSolutions currentSlug="" />

        {/* Lead capture footer */}
        <section className="py-20 bg-white">
          <div className="container mx-auto px-6">
            <div className="max-w-3xl mx-auto">
              <BlogCTA
                variant="footer"
                source={`vs-${slug}`}
                title={`Ready to see PartsIQ vs ${name} in action?`}
                description="15-minute walkthrough of the AI voice agent calling suppliers, quote comparison, and multi-brand parts search. Built for heavy and compact construction equipment operations."
                ctaText="Request demo"
              />
            </div>
          </div>
        </section>
      </div>
      <PublicFooter />
    </>
  )
}
