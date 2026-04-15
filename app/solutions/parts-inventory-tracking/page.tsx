import type { Metadata } from "next"
import { Button } from "@/components/ui/button"
import {
  ArrowRight,
  Package,
  BarChart3,
  Bell,
  MapPin,
  Brain,
  CheckCircle,
  AlertTriangle,
  TrendingUp,
  ChevronDown,
  Building2,
  Truck,
  Wheat,
} from "lucide-react"
import Link from "next/link"
import { JsonLd } from "@/components/seo/json-ld"
import { BreadcrumbJsonLd } from "@/components/seo/breadcrumb-jsonld"
import { PublicFooter } from "@/components/layout/public-footer"
import { RelatedSolutions } from "@/components/solutions/related-solutions"

export const metadata: Metadata = {
  title: "Parts Inventory Tracking Software",
  description:
    "Real-time parts inventory tracking with automated reorder alerts and AI forecasting. Cut stockouts 40%. Built for heavy equipment fleets.",
  keywords: [
    "parts inventory tracking",
    "parts inventory system",
    "parts inventory optimization",
    "heavy equipment inventory tracking",
    "inventory tracking software",
    "parts stock management",
    "real-time inventory tracking",
    "automated reorder alerts",
  ],
  alternates: {
    canonical: "/solutions/parts-inventory-tracking",
  },
  openGraph: {
    title: "Parts Inventory Tracking Software for Heavy Equipment",
    description:
      "Real-time parts tracking with automated reorder alerts and AI forecasting. Cut stockouts 40% and reduce overstock across multi-location fleets.",
    url: "/solutions/parts-inventory-tracking",
  },
}

const faqJsonLd = {
  "@context": "https://schema.org",
  "@type": "FAQPage",
  mainEntity: [
    {
      "@type": "Question",
      name: "How does PartsIQ track parts inventory in real time?",
      acceptedAnswer: {
        "@type": "Answer",
        text: "PartsIQ maintains a centralized parts database synchronized across all locations. Every transaction — incoming shipments, outgoing orders, and internal transfers — is recorded instantly, giving you a live view of stock levels across your entire operation.",
      },
    },
    {
      "@type": "Question",
      name: "Can I set up automated reorder alerts for critical parts?",
      acceptedAnswer: {
        "@type": "Answer",
        text: "Yes. PartsIQ lets you configure minimum stock thresholds for every part number. When inventory drops below the threshold, the system automatically triggers alerts and can initiate quote requests to your preferred suppliers.",
      },
    },
    {
      "@type": "Question",
      name: "Does parts inventory tracking work across multiple warehouse locations?",
      acceptedAnswer: {
        "@type": "Answer",
        text: "Absolutely. PartsIQ supports unlimited warehouse and yard locations under a single organization. You can view consolidated inventory or drill down to individual locations, and transfer parts between sites with full audit trails.",
      },
    },
    {
      "@type": "Question",
      name: "How does AI-powered forecasting reduce overstocking?",
      acceptedAnswer: {
        "@type": "Answer",
        text: "PartsIQ analyzes historical consumption patterns, equipment maintenance schedules, and seasonal trends to predict future parts demand. This helps you order the right quantities at the right time, reducing carrying costs and preventing dead stock.",
      },
    },
  ],
}

export default function PartsInventoryTrackingPage() {
  return (
    <>
      <JsonLd data={faqJsonLd} />
      <BreadcrumbJsonLd
        items={[
          { name: "Home", url: "/" },
          { name: "Solutions", url: "/solutions" },
          { name: "Parts Inventory Tracking", url: "/solutions/parts-inventory-tracking" },
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
                Parts Inventory Solution
              </div>
              <h1 className="text-5xl md:text-6xl font-bold mb-6 tracking-tight">
                Parts Inventory Tracking Software for Heavy Equipment
              </h1>
              <p className="text-xl text-slate-400 mb-8 max-w-2xl mx-auto">
                Stop losing money to stockouts and overstocking. PartsIQ gives you real-time visibility into every part across every location, with AI-powered alerts that keep your fleet running.
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
                  Spreadsheet tracking is costing you thousands
                </h2>
                <p className="text-xl text-slate-600 max-w-2xl mx-auto">
                  Manual inventory methods create blind spots that lead to equipment downtime and wasted capital.
                </p>
              </div>

              <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-8">
                <div className="text-center p-6">
                  <div className="w-12 h-12 bg-red-50 rounded-lg flex items-center justify-center mx-auto mb-4">
                    <AlertTriangle className="h-6 w-6 text-red-500" />
                  </div>
                  <h3 className="text-lg font-bold text-slate-950 mb-2">Unexpected Stockouts</h3>
                  <p className="text-slate-600 text-sm">Critical parts missing when equipment breaks down, causing days of costly downtime.</p>
                </div>
                <div className="text-center p-6">
                  <div className="w-12 h-12 bg-red-50 rounded-lg flex items-center justify-center mx-auto mb-4">
                    <Package className="h-6 w-6 text-red-500" />
                  </div>
                  <h3 className="text-lg font-bold text-slate-950 mb-2">Excess Inventory</h3>
                  <p className="text-slate-600 text-sm">Over-ordering ties up capital in parts sitting on shelves collecting dust for months.</p>
                </div>
                <div className="text-center p-6">
                  <div className="w-12 h-12 bg-red-50 rounded-lg flex items-center justify-center mx-auto mb-4">
                    <MapPin className="h-6 w-6 text-red-500" />
                  </div>
                  <h3 className="text-lg font-bold text-slate-950 mb-2">No Visibility</h3>
                  <p className="text-slate-600 text-sm">Parts scattered across yards and warehouses with no centralized view of what you actually have.</p>
                </div>
                <div className="text-center p-6">
                  <div className="w-12 h-12 bg-red-50 rounded-lg flex items-center justify-center mx-auto mb-4">
                    <BarChart3 className="h-6 w-6 text-red-500" />
                  </div>
                  <h3 className="text-lg font-bold text-slate-950 mb-2">No Usage Data</h3>
                  <p className="text-slate-600 text-sm">Without consumption analytics, every reorder is a guess that leads to waste or shortage.</p>
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
                  Real-time inventory tracking built for heavy equipment
                </h2>
                <p className="text-xl text-slate-600 max-w-2xl mx-auto">
                  Purpose-built parts inventory system with the intelligence to keep your fleet running and your costs down.
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
                    <h3 className="text-2xl font-bold text-slate-950 mb-3">Real-Time Stock Levels</h3>
                    <p className="text-slate-600 mb-4 leading-relaxed">
                      See exactly what you have, where it is, and when it was last used. Every part movement is tracked automatically across your entire operation.
                    </p>
                    <ul className="space-y-2 text-slate-600">
                      <li className="flex items-start gap-2">
                        <CheckCircle className="h-5 w-5 text-emerald-600 mt-0.5 flex-shrink-0" />
                        <span>Live inventory dashboard with search and filters</span>
                      </li>
                      <li className="flex items-start gap-2">
                        <CheckCircle className="h-5 w-5 text-emerald-600 mt-0.5 flex-shrink-0" />
                        <span>Part number, description, and cross-reference lookup</span>
                      </li>
                    </ul>
                  </div>
                </div>

                <div className="flex gap-6">
                  <div className="flex-shrink-0">
                    <div className="w-12 h-12 bg-slate-950 rounded-lg flex items-center justify-center">
                      <Bell className="h-6 w-6 text-white" />
                    </div>
                  </div>
                  <div>
                    <h3 className="text-2xl font-bold text-slate-950 mb-3">Automated Reorder Alerts</h3>
                    <p className="text-slate-600 mb-4 leading-relaxed">
                      Set minimum stock thresholds and let PartsIQ handle the rest. When levels drop, the system alerts your team and can trigger supplier quote requests automatically.
                    </p>
                    <ul className="space-y-2 text-slate-600">
                      <li className="flex items-start gap-2">
                        <CheckCircle className="h-5 w-5 text-emerald-600 mt-0.5 flex-shrink-0" />
                        <span>Configurable min/max thresholds per part</span>
                      </li>
                      <li className="flex items-start gap-2">
                        <CheckCircle className="h-5 w-5 text-emerald-600 mt-0.5 flex-shrink-0" />
                        <span>Auto-triggered quote requests to preferred suppliers</span>
                      </li>
                    </ul>
                  </div>
                </div>

                <div className="flex gap-6">
                  <div className="flex-shrink-0">
                    <div className="w-12 h-12 bg-slate-950 rounded-lg flex items-center justify-center">
                      <MapPin className="h-6 w-6 text-white" />
                    </div>
                  </div>
                  <div>
                    <h3 className="text-2xl font-bold text-slate-950 mb-3">Multi-Location Support</h3>
                    <p className="text-slate-600 mb-4 leading-relaxed">
                      Track inventory across multiple warehouses, yards, and job sites from a single dashboard. Transfer parts between locations with full audit trails.
                    </p>
                    <ul className="space-y-2 text-slate-600">
                      <li className="flex items-start gap-2">
                        <CheckCircle className="h-5 w-5 text-emerald-600 mt-0.5 flex-shrink-0" />
                        <span>Unlimited locations per organization</span>
                      </li>
                      <li className="flex items-start gap-2">
                        <CheckCircle className="h-5 w-5 text-emerald-600 mt-0.5 flex-shrink-0" />
                        <span>Consolidated and per-site inventory views</span>
                      </li>
                    </ul>
                  </div>
                </div>

                <div className="flex gap-6">
                  <div className="flex-shrink-0">
                    <div className="w-12 h-12 bg-slate-950 rounded-lg flex items-center justify-center">
                      <Brain className="h-6 w-6 text-white" />
                    </div>
                  </div>
                  <div>
                    <h3 className="text-2xl font-bold text-slate-950 mb-3">AI-Powered Forecasting</h3>
                    <p className="text-slate-600 mb-4 leading-relaxed">
                      Machine learning analyzes your consumption patterns, maintenance schedules, and seasonal trends to predict exactly what you will need and when.
                    </p>
                    <ul className="space-y-2 text-slate-600">
                      <li className="flex items-start gap-2">
                        <CheckCircle className="h-5 w-5 text-emerald-600 mt-0.5 flex-shrink-0" />
                        <span>Demand forecasting based on historical data</span>
                      </li>
                      <li className="flex items-start gap-2">
                        <CheckCircle className="h-5 w-5 text-emerald-600 mt-0.5 flex-shrink-0" />
                        <span>Maintenance-driven parts prediction</span>
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
                  How our parts inventory tracking works
                </h2>
                <p className="text-xl text-slate-600 max-w-2xl mx-auto">
                  Set up real-time inventory tracking in four steps and never be surprised by a stockout again.
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
                    <h3 className="text-xl font-bold text-slate-950 mb-2">Connect your inventory sources</h3>
                    <p className="text-slate-600 leading-relaxed">
                      Import your parts data from CSV exports, spreadsheets, or manual entry. PartsIQ&apos;s inventory tracking software consolidates every part number, location, and quantity into a single centralized database -- giving you one source of truth no matter how many warehouses, yards, or job sites you operate.
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
                    <h3 className="text-xl font-bold text-slate-950 mb-2">Set thresholds and alerts</h3>
                    <p className="text-slate-600 leading-relaxed">
                      Configure minimum and maximum stock levels for every part in your parts inventory system. When quantities drop below your defined thresholds, the platform automatically triggers notifications and can initiate quote requests to your preferred suppliers -- eliminating the manual checks that let critical parts slip through the cracks.
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
                    <h3 className="text-xl font-bold text-slate-950 mb-2">Monitor real-time dashboards</h3>
                    <p className="text-slate-600 leading-relaxed">
                      Access live dashboards that show stock levels, recent transactions, and pending orders across every location. Real-time inventory tracking means every shipment received, every part issued, and every transfer between sites is reflected instantly -- so the numbers you see are always the numbers you have.
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
                    <h3 className="text-xl font-bold text-slate-950 mb-2">AI predicts and reorders</h3>
                    <p className="text-slate-600 leading-relaxed">
                      PartsIQ&apos;s AI analyzes your consumption history, maintenance schedules, and seasonal patterns to forecast future demand. The parts inventory tracking platform recommends optimal reorder quantities and timing, turning reactive purchasing into a proactive strategy that keeps costs low and availability high.
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
                  Who uses parts inventory tracking
                </h2>
                <p className="text-xl text-slate-600 max-w-2xl mx-auto">
                  Our inventory tracking software is built for operations teams that cannot afford equipment downtime.
                </p>
              </div>

              <div className="grid md:grid-cols-3 gap-8">
                <div className="bg-white border border-slate-200 rounded-lg p-8">
                  <div className="w-12 h-12 bg-slate-950 rounded-lg flex items-center justify-center mb-5">
                    <Building2 className="h-6 w-6 text-white" />
                  </div>
                  <h3 className="text-xl font-bold text-slate-950 mb-3">Multi-Site Construction Companies</h3>
                  <p className="text-slate-600 leading-relaxed mb-4">
                    Construction firms running multiple active job sites need to know exactly which parts are available and where. PartsIQ&apos;s parts inventory tracking gives project managers a consolidated view across every yard and warehouse, so they can transfer stock between sites or trigger reorders before a machine sits idle waiting on a filter or hydraulic hose.
                  </p>
                  <ul className="space-y-2 text-slate-600">
                    <li className="flex items-start gap-2">
                      <CheckCircle className="h-5 w-5 text-emerald-600 mt-0.5 flex-shrink-0" />
                      <span>Cross-site inventory visibility and transfers</span>
                    </li>
                    <li className="flex items-start gap-2">
                      <CheckCircle className="h-5 w-5 text-emerald-600 mt-0.5 flex-shrink-0" />
                      <span>Project-level parts consumption tracking</span>
                    </li>
                  </ul>
                </div>

                <div className="bg-white border border-slate-200 rounded-lg p-8">
                  <div className="w-12 h-12 bg-slate-950 rounded-lg flex items-center justify-center mb-5">
                    <Truck className="h-6 w-6 text-white" />
                  </div>
                  <h3 className="text-xl font-bold text-slate-950 mb-3">Equipment Rental Fleets</h3>
                  <p className="text-slate-600 leading-relaxed mb-4">
                    Rental companies must turn around equipment fast to maximize utilization. Real-time inventory tracking ensures maintenance teams always have the wear parts, filters, and fluids they need to service machines between rentals. PartsIQ&apos;s parts inventory system ties stock levels to fleet maintenance schedules, cutting turnaround time and preventing revenue loss.
                  </p>
                  <ul className="space-y-2 text-slate-600">
                    <li className="flex items-start gap-2">
                      <CheckCircle className="h-5 w-5 text-emerald-600 mt-0.5 flex-shrink-0" />
                      <span>Maintenance-driven stock planning</span>
                    </li>
                    <li className="flex items-start gap-2">
                      <CheckCircle className="h-5 w-5 text-emerald-600 mt-0.5 flex-shrink-0" />
                      <span>Faster equipment turnaround between rentals</span>
                    </li>
                  </ul>
                </div>

                <div className="bg-white border border-slate-200 rounded-lg p-8">
                  <div className="w-12 h-12 bg-slate-950 rounded-lg flex items-center justify-center mb-5">
                    <Wheat className="h-6 w-6 text-white" />
                  </div>
                  <h3 className="text-xl font-bold text-slate-950 mb-3">Agricultural Cooperatives</h3>
                  <p className="text-slate-600 leading-relaxed mb-4">
                    Agricultural cooperatives manage parts for diverse equipment across many member operations. Inventory tracking software from PartsIQ lets co-ops maintain a shared parts pool with real-time visibility into what is available, what is committed, and what needs reordering -- ensuring no single member&apos;s harvest is delayed because a critical component was unavailable.
                  </p>
                  <ul className="space-y-2 text-slate-600">
                    <li className="flex items-start gap-2">
                      <CheckCircle className="h-5 w-5 text-emerald-600 mt-0.5 flex-shrink-0" />
                      <span>Shared inventory pool across member operations</span>
                    </li>
                    <li className="flex items-start gap-2">
                      <CheckCircle className="h-5 w-5 text-emerald-600 mt-0.5 flex-shrink-0" />
                      <span>Seasonal forecasting for planting and harvest</span>
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
                  The impact of intelligent inventory tracking
                </h2>
                <p className="text-lg text-slate-400 max-w-2xl mx-auto">
                  PartsIQ customers see measurable improvements from day one.
                </p>
              </div>

              <div className="grid md:grid-cols-3 gap-8">
                <div className="text-center p-8 border border-slate-800 rounded-lg">
                  <div className="text-5xl font-bold text-emerald-400 mb-2">90%</div>
                  <div className="text-lg font-medium mb-2">Reduction in Stockouts</div>
                  <p className="text-slate-400 text-sm">Automated alerts and forecasting ensure critical parts are always on hand when equipment goes down.</p>
                </div>
                <div className="text-center p-8 border border-slate-800 rounded-lg">
                  <div className="text-5xl font-bold text-emerald-400 mb-2">40%</div>
                  <div className="text-lg font-medium mb-2">Less Overstock</div>
                  <p className="text-slate-400 text-sm">AI-driven demand prediction eliminates guesswork and frees up capital tied to excess inventory.</p>
                </div>
                <div className="text-center p-8 border border-slate-800 rounded-lg">
                  <div className="flex items-center justify-center gap-2 mb-2">
                    <TrendingUp className="h-10 w-10 text-emerald-400" />
                  </div>
                  <div className="text-lg font-medium mb-2">Real-Time Visibility</div>
                  <p className="text-slate-400 text-sm">Every part, every location, every transaction — visible in a single dashboard, updated instantly.</p>
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
                  Common questions about parts inventory tracking with PartsIQ.
                </p>
              </div>

              <div className="space-y-6">
                <div className="border border-slate-200 rounded-lg p-6">
                  <h3 className="text-lg font-bold text-slate-950 mb-3 flex items-center gap-2">
                    <ChevronDown className="h-5 w-5 text-slate-400" />
                    How does PartsIQ track parts inventory in real time?
                  </h3>
                  <p className="text-slate-600 pl-7">
                    PartsIQ maintains a centralized parts database synchronized across all locations. Every transaction — incoming shipments, outgoing orders, and internal transfers — is recorded instantly, giving you a live view of stock levels across your entire operation.
                  </p>
                </div>

                <div className="border border-slate-200 rounded-lg p-6">
                  <h3 className="text-lg font-bold text-slate-950 mb-3 flex items-center gap-2">
                    <ChevronDown className="h-5 w-5 text-slate-400" />
                    Can I set up automated reorder alerts for critical parts?
                  </h3>
                  <p className="text-slate-600 pl-7">
                    Yes. PartsIQ lets you configure minimum stock thresholds for every part number. When inventory drops below the threshold, the system automatically triggers alerts and can initiate quote requests to your preferred suppliers.
                  </p>
                </div>

                <div className="border border-slate-200 rounded-lg p-6">
                  <h3 className="text-lg font-bold text-slate-950 mb-3 flex items-center gap-2">
                    <ChevronDown className="h-5 w-5 text-slate-400" />
                    Does parts inventory tracking work across multiple warehouse locations?
                  </h3>
                  <p className="text-slate-600 pl-7">
                    Absolutely. PartsIQ supports unlimited warehouse and yard locations under a single organization. You can view consolidated inventory or drill down to individual locations, and transfer parts between sites with full audit trails.
                  </p>
                </div>

                <div className="border border-slate-200 rounded-lg p-6">
                  <h3 className="text-lg font-bold text-slate-950 mb-3 flex items-center gap-2">
                    <ChevronDown className="h-5 w-5 text-slate-400" />
                    How does AI-powered forecasting reduce overstocking?
                  </h3>
                  <p className="text-slate-600 pl-7">
                    PartsIQ analyzes historical consumption patterns, equipment maintenance schedules, and seasonal trends to predict future parts demand. This helps you order the right quantities at the right time, reducing carrying costs and preventing dead stock.
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
                Take control of your parts inventory today
              </h2>
              <p className="text-xl text-slate-600 mb-8">
                Join operations teams that have eliminated stockouts and reduced carrying costs with PartsIQ.
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
      <RelatedSolutions currentSlug="parts-inventory-tracking" />
      <PublicFooter />
    </>
  )
}
