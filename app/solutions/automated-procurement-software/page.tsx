import type { Metadata } from "next"
import { Button } from "@/components/ui/button"
import {
  ArrowRight,
  Zap,
  Phone,
  Mail,
  BarChart3,
  ClipboardList,
  CheckCircle,
  Clock,
  FileSpreadsheet,
  ShieldAlert,
  ChevronDown,
  Gauge,
  Receipt,
} from "lucide-react"
import Link from "next/link"
import { JsonLd } from "@/components/seo/json-ld"
import { BreadcrumbJsonLd } from "@/components/seo/breadcrumb-jsonld"
import { PublicFooter } from "@/components/layout/public-footer"
import { RelatedSolutions } from "@/components/solutions/related-solutions"

export const metadata: Metadata = {
  title: "Automated Procurement Software",
  description:
    "Automated procurement software for heavy equipment dealers. AI voice agent calls suppliers, compares quotes, and tracks POs end-to-end.",
  keywords: [
    "automated procurement software",
    "procurement automation",
    "automated purchasing system",
    "procurement workflow automation",
    "AI procurement software",
    "purchase order automation",
    "quote management software",
    "parts procurement automation",
  ],
  alternates: {
    canonical: "/solutions/automated-procurement-software",
  },
  openGraph: {
    title: "Automated Procurement Software | PartsIQ",
    description:
      "AI voice agent calls suppliers, auto-emails quotes, and tracks POs end-to-end. Built for heavy equipment procurement teams.",
    url: "/solutions/automated-procurement-software",
  },
}

const faqJsonLd = {
  "@context": "https://schema.org",
  "@type": "FAQPage",
  mainEntity: [
    {
      "@type": "Question",
      name: "How does the AI voice agent automate supplier calls?",
      acceptedAnswer: {
        "@type": "Answer",
        text: "PartsIQ's AI voice agent places outbound calls to your suppliers using conversational AI. It describes the parts you need, asks about pricing, availability, and lead times, handles follow-up questions naturally, and records the quoted information. Your team reviews the results and approves — no manual phone calls required.",
      },
    },
    {
      "@type": "Question",
      name: "Can the system send quote requests to multiple suppliers at once?",
      acceptedAnswer: {
        "@type": "Answer",
        text: "Yes. PartsIQ lets you send professional quote request emails to your entire supplier list with a single click. The system monitors incoming responses, uses AI to extract pricing and availability data from supplier replies, and consolidates everything into a comparison view. You can also set the system to automatically follow up with suppliers who have not responded.",
      },
    },
    {
      "@type": "Question",
      name: "How does quote comparison work?",
      acceptedAnswer: {
        "@type": "Answer",
        text: "PartsIQ automatically extracts pricing from both email responses and voice call results, then presents all quotes in a side-by-side comparison table. You can see unit price, total cost, lead time, availability, and supplier score for every option at a glance. The system highlights the best-value option based on your configured preferences for price, speed, and reliability.",
      },
    },
    {
      "@type": "Question",
      name: "Does PartsIQ track purchase orders after quotes are approved?",
      acceptedAnswer: {
        "@type": "Answer",
        text: "Yes. Once you approve a quote, PartsIQ generates a purchase order and tracks it through the entire lifecycle — from issued to acknowledged to shipped to received. The system updates your parts inventory automatically when items are received and maintains a complete audit trail linking every purchase back to the original quote request.",
      },
    },
  ],
}

export default function AutomatedProcurementSoftwarePage() {
  return (
    <>
      <JsonLd data={faqJsonLd} />
      <BreadcrumbJsonLd
        items={[
          { name: "Home", url: "/" },
          { name: "Solutions", url: "/solutions" },
          { name: "Automated Procurement Software", url: "/solutions/automated-procurement-software" },
        ]}
      />
      <div className="min-h-screen bg-white">
        {/* Hero Section */}
        <section className="relative bg-slate-950 text-white py-24">
          <div className="absolute inset-0 bg-[linear-gradient(rgba(148,163,184,0.05)_1px,transparent_1px),linear-gradient(90deg,rgba(148,163,184,0.05)_1px,transparent_1px)] bg-[size:64px_64px]"></div>

          <div className="relative container mx-auto px-6">
            <div className="max-w-4xl mx-auto text-center">
              <div className="inline-flex items-center gap-2 bg-emerald-500/10 border border-emerald-500/20 rounded-full px-4 py-1.5 text-emerald-400 text-sm font-medium mb-6">
                <Zap className="h-4 w-4" />
                Procurement Automation
              </div>
              <h1 className="text-5xl md:text-6xl font-bold mb-6 tracking-tight">
                Automated Procurement Software for Parts
              </h1>
              <p className="text-xl text-slate-400 mb-8 max-w-2xl mx-auto">
                Automate your entire procurement workflow from quote request to purchase order. PartsIQ&apos;s AI voice agent calls suppliers, automated email sends and parses quotes, and side-by-side comparison helps you buy smarter every time.
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
                  Manual procurement is slow, expensive, and error-prone
                </h2>
                <p className="text-xl text-slate-600 max-w-2xl mx-auto">
                  Every hour your team spends on phone calls and email follow-ups is an hour not spent on higher-value work.
                </p>
              </div>

              <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-8">
                <div className="text-center p-6">
                  <div className="w-12 h-12 bg-red-50 rounded-lg flex items-center justify-center mx-auto mb-4">
                    <Clock className="h-6 w-6 text-red-500" />
                  </div>
                  <h3 className="text-lg font-bold text-slate-950 mb-2">Time-Consuming Quoting</h3>
                  <p className="text-slate-600 text-sm">Each quote request requires calling or emailing multiple suppliers, then waiting days for responses. A single parts order can consume an entire afternoon of back-and-forth communication.</p>
                </div>
                <div className="text-center p-6">
                  <div className="w-12 h-12 bg-red-50 rounded-lg flex items-center justify-center mx-auto mb-4">
                    <FileSpreadsheet className="h-6 w-6 text-red-500" />
                  </div>
                  <h3 className="text-lg font-bold text-slate-950 mb-2">Spreadsheet Comparisons</h3>
                  <p className="text-slate-600 text-sm">Comparing supplier quotes means manually copying prices into a spreadsheet. Data entry errors lead to wrong decisions, and the process has to be repeated for every order.</p>
                </div>
                <div className="text-center p-6">
                  <div className="w-12 h-12 bg-red-50 rounded-lg flex items-center justify-center mx-auto mb-4">
                    <ShieldAlert className="h-6 w-6 text-red-500" />
                  </div>
                  <h3 className="text-lg font-bold text-slate-950 mb-2">No Audit Trail</h3>
                  <p className="text-slate-600 text-sm">Purchase decisions live in email threads and phone notes. When you need to justify a purchase or resolve a dispute, there is no centralized record of quotes, approvals, or order history.</p>
                </div>
                <div className="text-center p-6">
                  <div className="w-12 h-12 bg-red-50 rounded-lg flex items-center justify-center mx-auto mb-4">
                    <Mail className="h-6 w-6 text-red-500" />
                  </div>
                  <h3 className="text-lg font-bold text-slate-950 mb-2">Dropped Follow-Ups</h3>
                  <p className="text-slate-600 text-sm">Suppliers who do not respond get forgotten. Without systematic tracking, your team misses better pricing because follow-ups fall through the cracks.</p>
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
                  End-to-end procurement automation powered by AI
                </h2>
                <p className="text-xl text-slate-600 max-w-2xl mx-auto">
                  From the moment you need a part to the moment it arrives on your shelf, PartsIQ automates every step of the procurement workflow.
                </p>
              </div>

              <div className="grid md:grid-cols-2 gap-12">
                <div className="flex gap-6">
                  <div className="flex-shrink-0">
                    <div className="w-12 h-12 bg-slate-950 rounded-lg flex items-center justify-center">
                      <Phone className="h-6 w-6 text-white" />
                    </div>
                  </div>
                  <div>
                    <h3 className="text-2xl font-bold text-slate-950 mb-3">AI Voice Agent for Supplier Calls</h3>
                    <p className="text-slate-600 mb-4 leading-relaxed">
                      PartsIQ&apos;s conversational AI picks up the phone and calls your suppliers directly. It describes the parts you need, asks about pricing and availability, handles the natural back-and-forth of a procurement call, and records every detail. Your team reviews the results and approves — eliminating hours of phone tag from every order cycle.
                    </p>
                    <ul className="space-y-2 text-slate-600">
                      <li className="flex items-start gap-2">
                        <CheckCircle className="h-5 w-5 text-emerald-600 mt-0.5 flex-shrink-0" />
                        <span>Fully autonomous outbound supplier calls</span>
                      </li>
                      <li className="flex items-start gap-2">
                        <CheckCircle className="h-5 w-5 text-emerald-600 mt-0.5 flex-shrink-0" />
                        <span>Automatic price, lead time, and availability extraction</span>
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
                    <h3 className="text-2xl font-bold text-slate-950 mb-3">Automated Email Quoting</h3>
                    <p className="text-slate-600 mb-4 leading-relaxed">
                      Send professional, detailed quote request emails to your entire supplier list with a single click. PartsIQ monitors your inbox for responses, uses AI to extract pricing and availability data from supplier replies regardless of format, and consolidates everything into your procurement dashboard. Automatic follow-ups ensure no quote request goes unanswered.
                    </p>
                    <ul className="space-y-2 text-slate-600">
                      <li className="flex items-start gap-2">
                        <CheckCircle className="h-5 w-5 text-emerald-600 mt-0.5 flex-shrink-0" />
                        <span>One-click multi-supplier quote requests</span>
                      </li>
                      <li className="flex items-start gap-2">
                        <CheckCircle className="h-5 w-5 text-emerald-600 mt-0.5 flex-shrink-0" />
                        <span>AI parsing of supplier email responses in any format</span>
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
                    <h3 className="text-2xl font-bold text-slate-950 mb-3">Side-by-Side Quote Comparison</h3>
                    <p className="text-slate-600 mb-4 leading-relaxed">
                      Every supplier quote — whether collected by phone or email — is automatically extracted and presented in a unified comparison table. See unit price, total cost, lead time, availability, and supplier reliability score at a glance. The system highlights the best-value option based on your preferences, making it easy to select the right supplier without any manual data entry.
                    </p>
                    <ul className="space-y-2 text-slate-600">
                      <li className="flex items-start gap-2">
                        <CheckCircle className="h-5 w-5 text-emerald-600 mt-0.5 flex-shrink-0" />
                        <span>Automatic best-value highlighting</span>
                      </li>
                      <li className="flex items-start gap-2">
                        <CheckCircle className="h-5 w-5 text-emerald-600 mt-0.5 flex-shrink-0" />
                        <span>Historical pricing trends for smarter negotiations</span>
                      </li>
                    </ul>
                  </div>
                </div>

                <div className="flex gap-6">
                  <div className="flex-shrink-0">
                    <div className="w-12 h-12 bg-slate-950 rounded-lg flex items-center justify-center">
                      <ClipboardList className="h-6 w-6 text-white" />
                    </div>
                  </div>
                  <div>
                    <h3 className="text-2xl font-bold text-slate-950 mb-3">Purchase Order Tracking</h3>
                    <p className="text-slate-600 mb-4 leading-relaxed">
                      Once you approve a quote, PartsIQ generates a purchase order and tracks it through the full lifecycle — from issued to acknowledged, shipped to received. When parts arrive, the system updates your inventory automatically and closes the loop. Every purchase is linked back to the original quote request, giving you a complete audit trail for compliance and cost analysis.
                    </p>
                    <ul className="space-y-2 text-slate-600">
                      <li className="flex items-start gap-2">
                        <CheckCircle className="h-5 w-5 text-emerald-600 mt-0.5 flex-shrink-0" />
                        <span>Full PO lifecycle tracking from issue to receipt</span>
                      </li>
                      <li className="flex items-start gap-2">
                        <CheckCircle className="h-5 w-5 text-emerald-600 mt-0.5 flex-shrink-0" />
                        <span>Automatic inventory update on goods received</span>
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
                  Procurement results you can measure
                </h2>
                <p className="text-lg text-slate-400 max-w-2xl mx-auto">
                  AI-driven automation delivers faster quotes, lower costs, and complete visibility into every purchase.
                </p>
              </div>

              <div className="grid md:grid-cols-3 gap-8">
                <div className="text-center p-8 border border-slate-800 rounded-lg">
                  <div className="text-5xl font-bold text-emerald-400 mb-2">75%</div>
                  <div className="text-lg font-medium mb-2">Less Time on Procurement</div>
                  <p className="text-slate-400 text-sm">AI voice calls and automated email quoting eliminate the manual effort of contacting suppliers, extracting quotes, and following up on non-responses.</p>
                </div>
                <div className="text-center p-8 border border-slate-800 rounded-lg">
                  <div className="flex items-center justify-center gap-2 mb-2">
                    <Gauge className="h-10 w-10 text-emerald-400" />
                  </div>
                  <div className="text-lg font-medium mb-2">Quotes in Hours, Not Days</div>
                  <p className="text-slate-400 text-sm">Simultaneous outreach via phone and email means you receive supplier quotes the same day instead of waiting through days of back-and-forth communication.</p>
                </div>
                <div className="text-center p-8 border border-slate-800 rounded-lg">
                  <div className="flex items-center justify-center gap-2 mb-2">
                    <Receipt className="h-10 w-10 text-emerald-400" />
                  </div>
                  <div className="text-lg font-medium mb-2">Complete Audit Trail</div>
                  <p className="text-slate-400 text-sm">Every quote request, supplier response, price comparison, approval, and purchase order is linked and searchable. Full procurement transparency from request to receipt.</p>
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
                  Common questions about automated procurement software.
                </p>
              </div>

              <div className="space-y-6">
                <div className="border border-slate-200 rounded-lg p-6">
                  <h3 className="text-lg font-bold text-slate-950 mb-3 flex items-center gap-2">
                    <ChevronDown className="h-5 w-5 text-slate-400" />
                    How does the AI voice agent automate supplier calls?
                  </h3>
                  <p className="text-slate-600 pl-7">
                    PartsIQ&apos;s AI voice agent places outbound calls to your suppliers using conversational AI. It describes the parts you need, asks about pricing, availability, and lead times, handles follow-up questions naturally, and records the quoted information. Your team reviews the results and approves — no manual phone calls required.
                  </p>
                </div>

                <div className="border border-slate-200 rounded-lg p-6">
                  <h3 className="text-lg font-bold text-slate-950 mb-3 flex items-center gap-2">
                    <ChevronDown className="h-5 w-5 text-slate-400" />
                    Can the system send quote requests to multiple suppliers at once?
                  </h3>
                  <p className="text-slate-600 pl-7">
                    Yes. PartsIQ lets you send professional quote request emails to your entire supplier list with a single click. The system monitors incoming responses, uses AI to extract pricing and availability data from supplier replies, and consolidates everything into a comparison view. You can also set the system to automatically follow up with suppliers who have not responded.
                  </p>
                </div>

                <div className="border border-slate-200 rounded-lg p-6">
                  <h3 className="text-lg font-bold text-slate-950 mb-3 flex items-center gap-2">
                    <ChevronDown className="h-5 w-5 text-slate-400" />
                    How does quote comparison work?
                  </h3>
                  <p className="text-slate-600 pl-7">
                    PartsIQ automatically extracts pricing from both email responses and voice call results, then presents all quotes in a side-by-side comparison table. You can see unit price, total cost, lead time, availability, and supplier score for every option at a glance. The system highlights the best-value option based on your configured preferences for price, speed, and reliability.
                  </p>
                </div>

                <div className="border border-slate-200 rounded-lg p-6">
                  <h3 className="text-lg font-bold text-slate-950 mb-3 flex items-center gap-2">
                    <ChevronDown className="h-5 w-5 text-slate-400" />
                    Does PartsIQ track purchase orders after quotes are approved?
                  </h3>
                  <p className="text-slate-600 pl-7">
                    Yes. Once you approve a quote, PartsIQ generates a purchase order and tracks it through the entire lifecycle — from issued to acknowledged to shipped to received. The system updates your parts inventory automatically when items are received and maintains a complete audit trail linking every purchase back to the original quote request.
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
                Automate your procurement. Buy parts smarter.
              </h2>
              <p className="text-xl text-slate-600 mb-8">
                Start your free trial and let AI handle supplier calls, quote collection, and purchase order tracking.
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
      <RelatedSolutions currentSlug="automated-procurement-software" />
      <PublicFooter />
    </>
  )
}
