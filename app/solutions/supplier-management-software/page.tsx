import type { Metadata } from "next"
import { Button } from "@/components/ui/button"
import {
  ArrowRight,
  Users,
  Phone,
  Mail,
  BarChart3,
  Star,
  CheckCircle,
  PhoneOff,
  Inbox,
  ChevronDown,
  Zap,
  Scale,
  BellRing,
} from "lucide-react"
import Link from "next/link"
import { JsonLd } from "@/components/seo/json-ld"
import { BreadcrumbJsonLd } from "@/components/seo/breadcrumb-jsonld"
import { PublicFooter } from "@/components/layout/public-footer"

export const metadata: Metadata = {
  title: "Supplier Management Software for Industrial Parts Procurement | PartsIQ",
  description:
    "AI-powered supplier management software with voice agent automation, automated email quoting, side-by-side price comparison, and supplier scoring for industrial parts procurement.",
  keywords: [
    "supplier management software",
    "parts procurement software",
    "supplier quote management",
    "supplier price comparison",
    "vendor management system",
    "procurement automation",
    "supplier relationship management",
    "industrial parts procurement",
  ],
  alternates: {
    canonical: "/solutions/supplier-management-software",
  },
  openGraph: {
    title: "Supplier Management Software for Industrial Parts Procurement",
    description:
      "AI voice agent calls suppliers, automated email quoting, side-by-side price comparison, and supplier scoring. Get quotes 2x faster.",
    url: "/solutions/supplier-management-software",
  },
}

const faqJsonLd = {
  "@context": "https://schema.org",
  "@type": "FAQPage",
  mainEntity: [
    {
      "@type": "Question",
      name: "How does the AI voice agent contact suppliers?",
      acceptedAnswer: {
        "@type": "Answer",
        text: "PartsIQ's AI voice agent places outbound phone calls to your suppliers using conversational AI. It describes the parts you need, asks for pricing and availability, handles the back-and-forth conversation naturally, and records the quoted prices. You review the results and approve — no phone calls required from your team.",
      },
    },
    {
      "@type": "Question",
      name: "Can I compare quotes from multiple suppliers side by side?",
      acceptedAnswer: {
        "@type": "Answer",
        text: "Yes. PartsIQ automatically extracts pricing from supplier email responses and phone call results, then presents all quotes in a side-by-side comparison table. You can see unit price, total cost, lead time, and availability from every supplier at a glance, making it easy to select the best option.",
      },
    },
    {
      "@type": "Question",
      name: "Does the system automatically follow up with suppliers who haven't responded?",
      acceptedAnswer: {
        "@type": "Answer",
        text: "Yes. PartsIQ tracks response times for every quote request and automatically sends follow-up reminders to suppliers who haven't responded within your configured timeframe. The system can also escalate to phone calls via the AI voice agent if email follow-ups go unanswered.",
      },
    },
    {
      "@type": "Question",
      name: "How does supplier scoring work?",
      acceptedAnswer: {
        "@type": "Answer",
        text: "PartsIQ tracks supplier performance metrics including response time, quote accuracy, delivery reliability, and pricing competitiveness. These metrics are combined into an overall supplier score that helps you identify your most reliable vendors and make data-driven sourcing decisions.",
      },
    },
  ],
}

export default function SupplierManagementSoftwarePage() {
  return (
    <>
      <JsonLd data={faqJsonLd} />
      <BreadcrumbJsonLd
        items={[
          { name: "Home", url: "/" },
          { name: "Solutions", url: "/solutions" },
          { name: "Supplier Management Software", url: "/solutions/supplier-management-software" },
        ]}
      />
      <div className="min-h-screen bg-white">
        {/* Hero Section */}
        <section className="relative bg-slate-950 text-white py-24">
          <div className="absolute inset-0 bg-[linear-gradient(rgba(148,163,184,0.05)_1px,transparent_1px),linear-gradient(90deg,rgba(148,163,184,0.05)_1px,transparent_1px)] bg-[size:64px_64px]"></div>

          <div className="relative container mx-auto px-6">
            <div className="max-w-4xl mx-auto text-center">
              <div className="inline-flex items-center gap-2 bg-emerald-500/10 border border-emerald-500/20 rounded-full px-4 py-1.5 text-emerald-400 text-sm font-medium mb-6">
                <Users className="h-4 w-4" />
                Supplier Management Solution
              </div>
              <h1 className="text-5xl md:text-6xl font-bold mb-6 tracking-tight">
                Supplier Management Software for Industrial Parts Procurement
              </h1>
              <p className="text-xl text-slate-400 mb-8 max-w-2xl mx-auto">
                Let AI handle your supplier communication. PartsIQ calls suppliers, sends quote requests, compares prices, and follows up automatically — so you get the best deal without the legwork.
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
                  Supplier communication is your biggest bottleneck
                </h2>
                <p className="text-xl text-slate-600 max-w-2xl mx-auto">
                  Your procurement team spends more time chasing suppliers than sourcing parts.
                </p>
              </div>

              <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-8">
                <div className="text-center p-6">
                  <div className="w-12 h-12 bg-red-50 rounded-lg flex items-center justify-center mx-auto mb-4">
                    <PhoneOff className="h-6 w-6 text-red-500" />
                  </div>
                  <h3 className="text-lg font-bold text-slate-950 mb-2">Phone Tag</h3>
                  <p className="text-slate-600 text-sm">Hours spent calling suppliers, leaving voicemails, and waiting for callbacks. Each quote request becomes a multi-day ordeal.</p>
                </div>
                <div className="text-center p-6">
                  <div className="w-12 h-12 bg-red-50 rounded-lg flex items-center justify-center mx-auto mb-4">
                    <Inbox className="h-6 w-6 text-red-500" />
                  </div>
                  <h3 className="text-lg font-bold text-slate-950 mb-2">Email Chaos</h3>
                  <p className="text-slate-600 text-sm">Supplier quotes buried in inbox threads. No centralized view of who responded, who did not, and what prices were offered.</p>
                </div>
                <div className="text-center p-6">
                  <div className="w-12 h-12 bg-red-50 rounded-lg flex items-center justify-center mx-auto mb-4">
                    <Scale className="h-6 w-6 text-red-500" />
                  </div>
                  <h3 className="text-lg font-bold text-slate-950 mb-2">No Price Comparison</h3>
                  <p className="text-slate-600 text-sm">Comparing quotes means copying numbers into a spreadsheet. Without side-by-side comparison, you often overpay.</p>
                </div>
                <div className="text-center p-6">
                  <div className="w-12 h-12 bg-red-50 rounded-lg flex items-center justify-center mx-auto mb-4">
                    <Mail className="h-6 w-6 text-red-500" />
                  </div>
                  <h3 className="text-lg font-bold text-slate-950 mb-2">Lost Quotes</h3>
                  <p className="text-slate-600 text-sm">Supplier responses arrive days later and get missed. By the time you find them, pricing may have changed.</p>
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
                  AI-powered supplier management from quote to order
                </h2>
                <p className="text-xl text-slate-600 max-w-2xl mx-auto">
                  Automate every step of supplier communication and make data-driven sourcing decisions.
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
                    <h3 className="text-2xl font-bold text-slate-950 mb-3">AI Voice Agent</h3>
                    <p className="text-slate-600 mb-4 leading-relaxed">
                      PartsIQ&apos;s conversational AI calls your suppliers, describes the parts you need, negotiates pricing, and records quotes — all without human intervention. No more phone tag.
                    </p>
                    <ul className="space-y-2 text-slate-600">
                      <li className="flex items-start gap-2">
                        <CheckCircle className="h-5 w-5 text-emerald-600 mt-0.5 flex-shrink-0" />
                        <span>Autonomous outbound supplier calls</span>
                      </li>
                      <li className="flex items-start gap-2">
                        <CheckCircle className="h-5 w-5 text-emerald-600 mt-0.5 flex-shrink-0" />
                        <span>Natural conversation with price extraction</span>
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
                      Send professional quote requests to multiple suppliers with a single click. The system monitors incoming emails, extracts pricing data using AI, and centralizes all responses.
                    </p>
                    <ul className="space-y-2 text-slate-600">
                      <li className="flex items-start gap-2">
                        <CheckCircle className="h-5 w-5 text-emerald-600 mt-0.5 flex-shrink-0" />
                        <span>One-click multi-supplier email blasts</span>
                      </li>
                      <li className="flex items-start gap-2">
                        <CheckCircle className="h-5 w-5 text-emerald-600 mt-0.5 flex-shrink-0" />
                        <span>AI-powered price extraction from replies</span>
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
                    <h3 className="text-2xl font-bold text-slate-950 mb-3">Side-by-Side Price Comparison</h3>
                    <p className="text-slate-600 mb-4 leading-relaxed">
                      All supplier quotes displayed in a comparison table with unit price, total cost, lead time, and availability. Identify the best deal instantly without spreadsheet gymnastics.
                    </p>
                    <ul className="space-y-2 text-slate-600">
                      <li className="flex items-start gap-2">
                        <CheckCircle className="h-5 w-5 text-emerald-600 mt-0.5 flex-shrink-0" />
                        <span>Automatic best-price highlighting</span>
                      </li>
                      <li className="flex items-start gap-2">
                        <CheckCircle className="h-5 w-5 text-emerald-600 mt-0.5 flex-shrink-0" />
                        <span>Historical pricing trend analysis</span>
                      </li>
                    </ul>
                  </div>
                </div>

                <div className="flex gap-6">
                  <div className="flex-shrink-0">
                    <div className="w-12 h-12 bg-slate-950 rounded-lg flex items-center justify-center">
                      <Star className="h-6 w-6 text-white" />
                    </div>
                  </div>
                  <div>
                    <h3 className="text-2xl font-bold text-slate-950 mb-3">Supplier Scoring</h3>
                    <p className="text-slate-600 mb-4 leading-relaxed">
                      Track response time, quote accuracy, delivery reliability, and pricing competitiveness for every supplier. Data-driven scores help you build a network of trusted vendors.
                    </p>
                    <ul className="space-y-2 text-slate-600">
                      <li className="flex items-start gap-2">
                        <CheckCircle className="h-5 w-5 text-emerald-600 mt-0.5 flex-shrink-0" />
                        <span>Performance metrics per supplier</span>
                      </li>
                      <li className="flex items-start gap-2">
                        <CheckCircle className="h-5 w-5 text-emerald-600 mt-0.5 flex-shrink-0" />
                        <span>Preferred vendor ranking</span>
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
                  Transform your supplier relationships with data
                </h2>
                <p className="text-lg text-slate-400 max-w-2xl mx-auto">
                  AI automation delivers faster quotes, better prices, and stronger vendor partnerships.
                </p>
              </div>

              <div className="grid md:grid-cols-3 gap-8">
                <div className="text-center p-8 border border-slate-800 rounded-lg">
                  <div className="text-5xl font-bold text-emerald-400 mb-2">2x</div>
                  <div className="text-lg font-medium mb-2">Faster Quotes</div>
                  <p className="text-slate-400 text-sm">AI voice agent and automated email eliminate the back-and-forth, getting you supplier quotes in hours instead of days.</p>
                </div>
                <div className="text-center p-8 border border-slate-800 rounded-lg">
                  <div className="flex items-center justify-center gap-2 mb-2">
                    <Scale className="h-10 w-10 text-emerald-400" />
                  </div>
                  <div className="text-lg font-medium mb-2">Side-by-Side Comparison</div>
                  <p className="text-slate-400 text-sm">Every quote automatically extracted and organized for instant comparison. No more copying prices into spreadsheets.</p>
                </div>
                <div className="text-center p-8 border border-slate-800 rounded-lg">
                  <div className="flex items-center justify-center gap-2 mb-2">
                    <BellRing className="h-10 w-10 text-emerald-400" />
                  </div>
                  <div className="text-lg font-medium mb-2">Automated Follow-Ups</div>
                  <p className="text-slate-400 text-sm">The system tracks non-responsive suppliers and automatically follows up via email or escalates to a phone call.</p>
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
                  Common questions about supplier management software.
                </p>
              </div>

              <div className="space-y-6">
                <div className="border border-slate-200 rounded-lg p-6">
                  <h3 className="text-lg font-bold text-slate-950 mb-3 flex items-center gap-2">
                    <ChevronDown className="h-5 w-5 text-slate-400" />
                    How does the AI voice agent contact suppliers?
                  </h3>
                  <p className="text-slate-600 pl-7">
                    PartsIQ&apos;s AI voice agent places outbound phone calls to your suppliers using conversational AI. It describes the parts you need, asks for pricing and availability, handles the back-and-forth conversation naturally, and records the quoted prices. You review the results and approve — no phone calls required from your team.
                  </p>
                </div>

                <div className="border border-slate-200 rounded-lg p-6">
                  <h3 className="text-lg font-bold text-slate-950 mb-3 flex items-center gap-2">
                    <ChevronDown className="h-5 w-5 text-slate-400" />
                    Can I compare quotes from multiple suppliers side by side?
                  </h3>
                  <p className="text-slate-600 pl-7">
                    Yes. PartsIQ automatically extracts pricing from supplier email responses and phone call results, then presents all quotes in a side-by-side comparison table. You can see unit price, total cost, lead time, and availability from every supplier at a glance, making it easy to select the best option.
                  </p>
                </div>

                <div className="border border-slate-200 rounded-lg p-6">
                  <h3 className="text-lg font-bold text-slate-950 mb-3 flex items-center gap-2">
                    <ChevronDown className="h-5 w-5 text-slate-400" />
                    Does the system automatically follow up with suppliers who have not responded?
                  </h3>
                  <p className="text-slate-600 pl-7">
                    Yes. PartsIQ tracks response times for every quote request and automatically sends follow-up reminders to suppliers who have not responded within your configured timeframe. The system can also escalate to phone calls via the AI voice agent if email follow-ups go unanswered.
                  </p>
                </div>

                <div className="border border-slate-200 rounded-lg p-6">
                  <h3 className="text-lg font-bold text-slate-950 mb-3 flex items-center gap-2">
                    <ChevronDown className="h-5 w-5 text-slate-400" />
                    How does supplier scoring work?
                  </h3>
                  <p className="text-slate-600 pl-7">
                    PartsIQ tracks supplier performance metrics including response time, quote accuracy, delivery reliability, and pricing competitiveness. These metrics are combined into an overall supplier score that helps you identify your most reliable vendors and make data-driven sourcing decisions.
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
                Stop chasing suppliers. Let AI do it for you.
              </h2>
              <p className="text-xl text-slate-600 mb-8">
                Start your free trial and experience fully automated supplier communication and quote management.
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
      <PublicFooter />
    </>
  )
}
