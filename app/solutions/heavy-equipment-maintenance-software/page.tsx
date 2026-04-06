import type { Metadata } from "next"
import { Button } from "@/components/ui/button"
import {
  ArrowRight,
  Wrench,
  FileText,
  Bell,
  Clock,
  DollarSign,
  CheckCircle,
  AlertTriangle,
  BookOpen,
  CalendarX,
  ChevronDown,
  Timer,
  TrendingDown,
} from "lucide-react"
import Link from "next/link"
import { JsonLd } from "@/components/seo/json-ld"
import { BreadcrumbJsonLd } from "@/components/seo/breadcrumb-jsonld"
import { PublicFooter } from "@/components/layout/public-footer"
import { RelatedSolutions } from "@/components/solutions/related-solutions"

export const metadata: Metadata = {
  title: "Heavy Equipment Maintenance Software",
  description:
    "Connect maintenance schedules to parts inventory with AI-powered PDF manual parsing, predictive alerts, and service interval tracking for heavy equipment fleets.",
  keywords: [
    "heavy equipment maintenance software",
    "equipment maintenance tracking",
    "preventive maintenance software",
    "heavy machinery maintenance",
    "fleet maintenance management",
    "maintenance parts inventory",
    "equipment service scheduling",
    "maintenance cost tracking software",
  ],
  alternates: {
    canonical: "/solutions/heavy-equipment-maintenance-software",
  },
  openGraph: {
    title: "Heavy Equipment Maintenance Software | PartsIQ",
    description:
      "AI-powered maintenance scheduling linked to parts inventory. Parse PDF manuals, get predictive alerts, and track service costs across your entire fleet.",
    url: "/solutions/heavy-equipment-maintenance-software",
  },
}

const faqJsonLd = {
  "@context": "https://schema.org",
  "@type": "FAQPage",
  mainEntity: [
    {
      "@type": "Question",
      name: "How does PartsIQ parse PDF maintenance manuals?",
      acceptedAnswer: {
        "@type": "Answer",
        text: "PartsIQ uses AI-powered document processing to extract maintenance schedules, service intervals, recommended parts, and fluid specifications from manufacturer PDF manuals. Upload any OEM manual and the system automatically maps each service task to the correct parts in your inventory, creating linked maintenance schedules you can act on immediately.",
      },
    },
    {
      "@type": "Question",
      name: "Can the software predict when equipment will need maintenance?",
      acceptedAnswer: {
        "@type": "Answer",
        text: "Yes. PartsIQ tracks equipment usage hours, service history, and manufacturer intervals to generate predictive maintenance alerts. The system notifies you before a service window opens, checks that the required parts are in stock, and flags any inventory shortages so you can order ahead of time. This prevents both missed maintenance and unnecessary downtime.",
      },
    },
    {
      "@type": "Question",
      name: "Does the maintenance schedule automatically link to parts inventory?",
      acceptedAnswer: {
        "@type": "Answer",
        text: "Yes. Every maintenance task in PartsIQ is linked to the specific parts required to complete it. When a service interval approaches, the system checks your current inventory levels for filters, fluids, belts, and other consumables. If stock is low, it can trigger a reorder or send a quote request to your suppliers automatically.",
      },
    },
    {
      "@type": "Question",
      name: "How does maintenance cost tracking work?",
      acceptedAnswer: {
        "@type": "Answer",
        text: "PartsIQ records every maintenance event along with the parts consumed, labor hours, and supplier costs. You get per-asset cost breakdowns, fleet-wide maintenance spend reports, and cost-per-hour calculations. This data helps you identify machines that are becoming too expensive to maintain and make informed repair-versus-replace decisions.",
      },
    },
  ],
}

export default function HeavyEquipmentMaintenanceSoftwarePage() {
  return (
    <>
      <JsonLd data={faqJsonLd} />
      <BreadcrumbJsonLd
        items={[
          { name: "Home", url: "/" },
          { name: "Solutions", url: "/solutions" },
          { name: "Heavy Equipment Maintenance Software", url: "/solutions/heavy-equipment-maintenance-software" },
        ]}
      />
      <div className="min-h-screen bg-white">
        {/* Hero Section */}
        <section className="relative bg-slate-950 text-white py-24">
          <div className="absolute inset-0 bg-[linear-gradient(rgba(148,163,184,0.05)_1px,transparent_1px),linear-gradient(90deg,rgba(148,163,184,0.05)_1px,transparent_1px)] bg-[size:64px_64px]"></div>

          <div className="relative container mx-auto px-6">
            <div className="max-w-4xl mx-auto text-center">
              <div className="inline-flex items-center gap-2 bg-emerald-500/10 border border-emerald-500/20 rounded-full px-4 py-1.5 text-emerald-400 text-sm font-medium mb-6">
                <Wrench className="h-4 w-4" />
                Maintenance Solution
              </div>
              <h1 className="text-5xl md:text-6xl font-bold mb-6 tracking-tight">
                Heavy Equipment Maintenance Software
              </h1>
              <p className="text-xl text-slate-400 mb-8 max-w-2xl mx-auto">
                Connect your maintenance schedules directly to your parts inventory. PartsIQ parses OEM maintenance manuals, predicts upcoming service needs, and ensures the right parts are in stock before a wrench ever turns.
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
                  Missed maintenance costs more than the repair itself
                </h2>
                <p className="text-xl text-slate-600 max-w-2xl mx-auto">
                  When maintenance schedules live in binders and parts inventory lives in spreadsheets, things fall through the cracks.
                </p>
              </div>

              <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-8">
                <div className="text-center p-6">
                  <div className="w-12 h-12 bg-red-50 rounded-lg flex items-center justify-center mx-auto mb-4">
                    <BookOpen className="h-6 w-6 text-red-500" />
                  </div>
                  <h3 className="text-lg font-bold text-slate-950 mb-2">Paper-Based Manuals</h3>
                  <p className="text-slate-600 text-sm">Maintenance intervals buried in 500-page PDF manuals that nobody reads. Critical service tasks get overlooked because the information is inaccessible when it matters most.</p>
                </div>
                <div className="text-center p-6">
                  <div className="w-12 h-12 bg-red-50 rounded-lg flex items-center justify-center mx-auto mb-4">
                    <CalendarX className="h-6 w-6 text-red-500" />
                  </div>
                  <h3 className="text-lg font-bold text-slate-950 mb-2">Missed Service Windows</h3>
                  <p className="text-slate-600 text-sm">Without automated reminders tied to equipment hours, preventive maintenance gets pushed back until something breaks. Reactive repairs cost three to five times more than scheduled service.</p>
                </div>
                <div className="text-center p-6">
                  <div className="w-12 h-12 bg-red-50 rounded-lg flex items-center justify-center mx-auto mb-4">
                    <AlertTriangle className="h-6 w-6 text-red-500" />
                  </div>
                  <h3 className="text-lg font-bold text-slate-950 mb-2">Parts Not in Stock</h3>
                  <p className="text-slate-600 text-sm">Maintenance is scheduled but the filters, belts, or fluids are not on the shelf. The machine sits idle while you rush-order parts at premium prices with expedited shipping.</p>
                </div>
                <div className="text-center p-6">
                  <div className="w-12 h-12 bg-red-50 rounded-lg flex items-center justify-center mx-auto mb-4">
                    <DollarSign className="h-6 w-6 text-red-500" />
                  </div>
                  <h3 className="text-lg font-bold text-slate-950 mb-2">Hidden Maintenance Costs</h3>
                  <p className="text-slate-600 text-sm">No visibility into per-asset maintenance spend. You cannot tell which machines are money pits or when it makes more sense to replace equipment than keep repairing it.</p>
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
                  Maintenance schedules that know what parts you need
                </h2>
                <p className="text-xl text-slate-600 max-w-2xl mx-auto">
                  PartsIQ bridges the gap between your service schedule and your parts room, so every maintenance task is backed by the inventory to complete it.
                </p>
              </div>

              <div className="grid md:grid-cols-2 gap-12">
                <div className="flex gap-6">
                  <div className="flex-shrink-0">
                    <div className="w-12 h-12 bg-slate-950 rounded-lg flex items-center justify-center">
                      <FileText className="h-6 w-6 text-white" />
                    </div>
                  </div>
                  <div>
                    <h3 className="text-2xl font-bold text-slate-950 mb-3">PDF Maintenance Manual Parsing</h3>
                    <p className="text-slate-600 mb-4 leading-relaxed">
                      Upload any OEM maintenance manual and PartsIQ&apos;s AI extracts every service interval, recommended part, fluid specification, and torque value. The system builds a structured maintenance schedule automatically, mapping each task to parts in your inventory. No more flipping through hundreds of pages to find the 500-hour service checklist.
                    </p>
                    <ul className="space-y-2 text-slate-600">
                      <li className="flex items-start gap-2">
                        <CheckCircle className="h-5 w-5 text-emerald-600 mt-0.5 flex-shrink-0" />
                        <span>Automatic extraction of service intervals and part numbers</span>
                      </li>
                      <li className="flex items-start gap-2">
                        <CheckCircle className="h-5 w-5 text-emerald-600 mt-0.5 flex-shrink-0" />
                        <span>Supports Caterpillar, John Deere, Komatsu, Volvo, and all major OEMs</span>
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
                    <h3 className="text-2xl font-bold text-slate-950 mb-3">Predictive Maintenance Alerts</h3>
                    <p className="text-slate-600 mb-4 leading-relaxed">
                      PartsIQ monitors equipment hours and service history to predict when each machine will hit its next maintenance window. The system sends alerts to your maintenance team days or weeks in advance and cross-references your parts inventory to confirm everything needed is available. If a part is running low, it triggers a reorder before you need it.
                    </p>
                    <ul className="space-y-2 text-slate-600">
                      <li className="flex items-start gap-2">
                        <CheckCircle className="h-5 w-5 text-emerald-600 mt-0.5 flex-shrink-0" />
                        <span>Hour-based and calendar-based service reminders</span>
                      </li>
                      <li className="flex items-start gap-2">
                        <CheckCircle className="h-5 w-5 text-emerald-600 mt-0.5 flex-shrink-0" />
                        <span>Automatic inventory check before each service event</span>
                      </li>
                    </ul>
                  </div>
                </div>

                <div className="flex gap-6">
                  <div className="flex-shrink-0">
                    <div className="w-12 h-12 bg-slate-950 rounded-lg flex items-center justify-center">
                      <Clock className="h-6 w-6 text-white" />
                    </div>
                  </div>
                  <div>
                    <h3 className="text-2xl font-bold text-slate-950 mb-3">Parts-Linked Service Intervals</h3>
                    <p className="text-slate-600 mb-4 leading-relaxed">
                      Every service interval in PartsIQ is directly connected to the parts required to complete it. When a 250-hour oil change is due, the system knows exactly which oil filter, engine oil quantity, and drain plug gasket are needed. It pulls from your inventory, updates stock levels, and logs the consumption against that specific machine and service event.
                    </p>
                    <ul className="space-y-2 text-slate-600">
                      <li className="flex items-start gap-2">
                        <CheckCircle className="h-5 w-5 text-emerald-600 mt-0.5 flex-shrink-0" />
                        <span>Bill of materials for every maintenance task</span>
                      </li>
                      <li className="flex items-start gap-2">
                        <CheckCircle className="h-5 w-5 text-emerald-600 mt-0.5 flex-shrink-0" />
                        <span>Automatic stock deduction when service is completed</span>
                      </li>
                    </ul>
                  </div>
                </div>

                <div className="flex gap-6">
                  <div className="flex-shrink-0">
                    <div className="w-12 h-12 bg-slate-950 rounded-lg flex items-center justify-center">
                      <DollarSign className="h-6 w-6 text-white" />
                    </div>
                  </div>
                  <div>
                    <h3 className="text-2xl font-bold text-slate-950 mb-3">Maintenance Cost Tracking</h3>
                    <p className="text-slate-600 mb-4 leading-relaxed">
                      Track every dollar spent on maintenance across your entire fleet. PartsIQ records parts consumed, labor hours, and supplier costs for each service event. Get per-asset cost breakdowns, fleet-wide maintenance spend dashboards, and cost-per-operating-hour calculations that inform repair-versus-replace decisions and budget forecasting.
                    </p>
                    <ul className="space-y-2 text-slate-600">
                      <li className="flex items-start gap-2">
                        <CheckCircle className="h-5 w-5 text-emerald-600 mt-0.5 flex-shrink-0" />
                        <span>Per-machine lifetime maintenance cost reports</span>
                      </li>
                      <li className="flex items-start gap-2">
                        <CheckCircle className="h-5 w-5 text-emerald-600 mt-0.5 flex-shrink-0" />
                        <span>Repair vs. replace analysis with historical data</span>
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
                  Keep your fleet running and your costs under control
                </h2>
                <p className="text-lg text-slate-400 max-w-2xl mx-auto">
                  Proactive maintenance backed by real-time parts inventory eliminates surprise downtime and emergency orders.
                </p>
              </div>

              <div className="grid md:grid-cols-3 gap-8">
                <div className="text-center p-8 border border-slate-800 rounded-lg">
                  <div className="text-5xl font-bold text-emerald-400 mb-2">40%</div>
                  <div className="text-lg font-medium mb-2">Less Unplanned Downtime</div>
                  <p className="text-slate-400 text-sm">Predictive maintenance alerts and parts-linked service intervals catch issues before they become breakdowns, keeping your equipment on the job.</p>
                </div>
                <div className="text-center p-8 border border-slate-800 rounded-lg">
                  <div className="flex items-center justify-center gap-2 mb-2">
                    <Timer className="h-10 w-10 text-emerald-400" />
                  </div>
                  <div className="text-lg font-medium mb-2">Minutes, Not Hours</div>
                  <p className="text-slate-400 text-sm">AI manual parsing builds complete maintenance schedules in minutes. No more manually transcribing service intervals from 500-page PDF documents.</p>
                </div>
                <div className="text-center p-8 border border-slate-800 rounded-lg">
                  <div className="flex items-center justify-center gap-2 mb-2">
                    <TrendingDown className="h-10 w-10 text-emerald-400" />
                  </div>
                  <div className="text-lg font-medium mb-2">Lower Parts Costs</div>
                  <p className="text-slate-400 text-sm">Knowing what parts you need in advance eliminates rush orders and expedited shipping. Plan purchases around scheduled maintenance, not emergencies.</p>
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
                  Common questions about heavy equipment maintenance software.
                </p>
              </div>

              <div className="space-y-6">
                <div className="border border-slate-200 rounded-lg p-6">
                  <h3 className="text-lg font-bold text-slate-950 mb-3 flex items-center gap-2">
                    <ChevronDown className="h-5 w-5 text-slate-400" />
                    How does PartsIQ parse PDF maintenance manuals?
                  </h3>
                  <p className="text-slate-600 pl-7">
                    PartsIQ uses AI-powered document processing to extract maintenance schedules, service intervals, recommended parts, and fluid specifications from manufacturer PDF manuals. Upload any OEM manual and the system automatically maps each service task to the correct parts in your inventory, creating linked maintenance schedules you can act on immediately.
                  </p>
                </div>

                <div className="border border-slate-200 rounded-lg p-6">
                  <h3 className="text-lg font-bold text-slate-950 mb-3 flex items-center gap-2">
                    <ChevronDown className="h-5 w-5 text-slate-400" />
                    Can the software predict when equipment will need maintenance?
                  </h3>
                  <p className="text-slate-600 pl-7">
                    Yes. PartsIQ tracks equipment usage hours, service history, and manufacturer intervals to generate predictive maintenance alerts. The system notifies you before a service window opens, checks that the required parts are in stock, and flags any inventory shortages so you can order ahead of time. This prevents both missed maintenance and unnecessary downtime.
                  </p>
                </div>

                <div className="border border-slate-200 rounded-lg p-6">
                  <h3 className="text-lg font-bold text-slate-950 mb-3 flex items-center gap-2">
                    <ChevronDown className="h-5 w-5 text-slate-400" />
                    Does the maintenance schedule automatically link to parts inventory?
                  </h3>
                  <p className="text-slate-600 pl-7">
                    Yes. Every maintenance task in PartsIQ is linked to the specific parts required to complete it. When a service interval approaches, the system checks your current inventory levels for filters, fluids, belts, and other consumables. If stock is low, it can trigger a reorder or send a quote request to your suppliers automatically.
                  </p>
                </div>

                <div className="border border-slate-200 rounded-lg p-6">
                  <h3 className="text-lg font-bold text-slate-950 mb-3 flex items-center gap-2">
                    <ChevronDown className="h-5 w-5 text-slate-400" />
                    How does maintenance cost tracking work?
                  </h3>
                  <p className="text-slate-600 pl-7">
                    PartsIQ records every maintenance event along with the parts consumed, labor hours, and supplier costs. You get per-asset cost breakdowns, fleet-wide maintenance spend reports, and cost-per-hour calculations. This data helps you identify machines that are becoming too expensive to maintain and make informed repair-versus-replace decisions.
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
                Stop losing money to missed maintenance
              </h2>
              <p className="text-xl text-slate-600 mb-8">
                Start your free trial and connect your maintenance schedules to your parts inventory today.
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
      <RelatedSolutions currentSlug="heavy-equipment-maintenance-software" />
      <PublicFooter />
    </>
  )
}
