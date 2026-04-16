"use client"

import { useState } from "react"
import Link from "next/link"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import {
  Mail,
  Download,
  Upload,
  Key,
  Bell,
  ArrowRight,
  Check,
  Clock,
  FileSpreadsheet,
  ChevronDown,
  ChevronUp,
  Send,
} from "lucide-react"

interface FAQItem {
  question: string
  answer: string
}

const liveIntegrations = [
  {
    name: "Gmail",
    description:
      "Connect your Gmail account to send and receive quote request emails directly from PartsIQ.",
    icon: Mail,
    tag: "Email",
  },
  {
    name: "Microsoft 365",
    description:
      "Connect Outlook to manage supplier communications without leaving your workflow.",
    icon: Mail,
    tag: "Email",
  },
  {
    name: "CSV / Excel Export",
    description:
      "Export quote requests, orders, and parts data as CSV. Import into your ERP, accounting system, or spreadsheet.",
    icon: Download,
    tag: "Data Exchange",
  },
  {
    name: "Parts Catalog Import",
    description:
      "Import parts catalogs via CSV or JSON. Bulk upload with automatic indexing across search, vector, and graph databases.",
    icon: Upload,
    tag: "Data Exchange",
  },
]

const comingSoonIntegrations = [
  { name: "SAP Business One", category: "ERP" },
  { name: "Oracle NetSuite", category: "ERP" },
  { name: "Infor CloudSuite", category: "ERP" },
  { name: "CDK Global", category: "DMS" },
  { name: "Fleetio", category: "Fleet/CMMS" },
  { name: "eMaint", category: "CMMS" },
]

const erpOptions = [
  "SAP Business One",
  "SAP S/4HANA",
  "Oracle NetSuite",
  "Infor CloudSuite",
  "Microsoft Dynamics 365",
  "CDK Global",
  "Fleetio",
  "eMaint",
  "Limble CMMS",
  "MaintainX",
  "Other",
]

export function IntegrationsPageContent({ faqItems }: { faqItems: FAQItem[] }) {
  const [notifiedIntegrations, setNotifiedIntegrations] = useState<Set<string>>(new Set())
  const [notifyEmail, setNotifyEmail] = useState("")
  const [notifyLoading, setNotifyLoading] = useState<string | null>(null)
  const [requestEmail, setRequestEmail] = useState("")
  const [requestErp, setRequestErp] = useState("")
  const [requestSubmitted, setRequestSubmitted] = useState(false)
  const [requestLoading, setRequestLoading] = useState(false)
  const [openFaq, setOpenFaq] = useState<number | null>(null)

  const handleNotify = async (integrationName: string) => {
    if (!notifyEmail || notifyLoading) return
    setNotifyLoading(integrationName)
    try {
      const res = await fetch("/api/leads", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email: notifyEmail,
          source: "integration-waitlist",
          leadMagnet: `erp-${integrationName.toLowerCase().replace(/\s+/g, "-")}`,
        }),
      })
      if (res.ok) {
        setNotifiedIntegrations((prev) => new Set(prev).add(integrationName))
      }
    } catch {
      // silently fail
    } finally {
      setNotifyLoading(null)
    }
  }

  const handleRequestSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!requestEmail || !requestErp || requestLoading) return
    setRequestLoading(true)
    try {
      const res = await fetch("/api/leads", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email: requestEmail,
          source: "integration-request",
          leadMagnet: `erp-request-${requestErp.toLowerCase().replace(/\s+/g, "-")}`,
        }),
      })
      if (res.ok) {
        setRequestSubmitted(true)
      }
    } catch {
      // silently fail
    } finally {
      setRequestLoading(false)
    }
  }

  return (
    <div className="bg-white">
      {/* Hero */}
      <section className="bg-gradient-to-b from-slate-950 to-slate-900 text-white py-20">
        <div className="container mx-auto px-6 max-w-5xl text-center">
          <h1 className="text-4xl md:text-5xl font-bold mb-6">
            Connect PartsIQ to Your Operations Stack
          </h1>
          <p className="text-xl text-slate-300 max-w-3xl mx-auto">
            Export your procurement data, connect your email for supplier
            communication, and bring your own API keys to minimize costs. Native
            ERP/DMS connectors coming soon.
          </p>
        </div>
      </section>

      {/* Data Exchange */}
      <section className="py-20">
        <div className="container mx-auto px-6 max-w-5xl">
          <div className="text-center mb-12">
            <div className="inline-flex items-center gap-2 bg-emerald-50 text-emerald-700 px-4 py-2 rounded-full text-sm font-medium mb-4">
              <FileSpreadsheet className="h-4 w-4" />
              Available Now
            </div>
            <h2 className="text-3xl font-bold text-slate-900 mb-4">
              Data Exchange &amp; Email
            </h2>
            <p className="text-lg text-slate-600 max-w-2xl mx-auto">
              Get your data in and out of PartsIQ. Export to your ERP, import
              parts catalogs, and manage supplier emails — all from one platform.
            </p>
          </div>

          <div className="grid md:grid-cols-2 gap-6">
            {liveIntegrations.map((integration) => (
              <div
                key={integration.name}
                className="border border-slate-200 rounded-xl p-6 hover:border-slate-300 transition-colors"
              >
                <div className="flex items-start gap-4">
                  <div className="bg-slate-100 p-3 rounded-lg">
                    <integration.icon className="h-6 w-6 text-slate-700" />
                  </div>
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-1">
                      <h3 className="font-semibold text-slate-900">
                        {integration.name}
                      </h3>
                      <span className="inline-flex items-center gap-1 text-xs font-medium text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-full">
                        <Check className="h-3 w-3" />
                        Available
                      </span>
                    </div>
                    <span className="text-xs text-slate-500 mb-2 block">
                      {integration.tag}
                    </span>
                    <p className="text-sm text-slate-600">
                      {integration.description}
                    </p>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Enterprise BYOK */}
      <section className="py-20 bg-slate-50">
        <div className="container mx-auto px-6 max-w-5xl">
          <div className="flex flex-col md:flex-row gap-12 items-start">
            <div className="flex-1">
              <div className="inline-flex items-center gap-2 bg-amber-50 text-amber-700 px-4 py-2 rounded-full text-sm font-medium mb-4">
                <Key className="h-4 w-4" />
                Enterprise
              </div>
              <h2 className="text-3xl font-bold text-slate-900 mb-4">
                Bring Your Own Keys
              </h2>
              <p className="text-lg text-slate-600 mb-6">
                Enterprise customers can connect their own API keys for voice,
                AI, and speech services — giving you direct control over usage
                and costs, with dedicated support for setup and optimization.
              </p>
              <ul className="space-y-3">
                {[
                  {
                    label: "Vapi",
                    desc: "Voice agent calls to suppliers",
                  },
                  {
                    label: "OpenRouter",
                    desc: "LLM-powered search and email generation",
                  },
                  {
                    label: "ElevenLabs",
                    desc: "Text-to-speech for voice workflows",
                  },
                ].map((key) => (
                  <li key={key.label} className="flex items-start gap-3">
                    <Check className="h-5 w-5 text-emerald-600 mt-0.5 flex-shrink-0" />
                    <div>
                      <span className="font-medium text-slate-900">
                        {key.label}
                      </span>
                      <span className="text-slate-600"> — {key.desc}</span>
                    </div>
                  </li>
                ))}
              </ul>
            </div>
            <div className="md:w-80 bg-white rounded-xl border border-slate-200 p-6">
              <h3 className="font-semibold text-slate-900 mb-2">
                Included with Enterprise
              </h3>
              <ul className="space-y-2 text-sm text-slate-600 mb-4">
                <li className="flex items-center gap-2">
                  <Check className="h-4 w-4 text-emerald-600" />
                  White-glove onboarding
                </li>
                <li className="flex items-center gap-2">
                  <Check className="h-4 w-4 text-emerald-600" />
                  Dedicated support for key setup
                </li>
                <li className="flex items-center gap-2">
                  <Check className="h-4 w-4 text-emerald-600" />
                  Cost optimization guidance
                </li>
                <li className="flex items-center gap-2">
                  <Check className="h-4 w-4 text-emerald-600" />
                  Encrypted key storage
                </li>
              </ul>
              <Link href="/pricing">
                <Button className="w-full" variant="outline">
                  View Enterprise Plan
                  <ArrowRight className="h-4 w-4 ml-2" />
                </Button>
              </Link>
            </div>
          </div>
        </div>
      </section>

      {/* Coming Soon */}
      <section className="py-20">
        <div className="container mx-auto px-6 max-w-5xl">
          <div className="text-center mb-12">
            <div className="inline-flex items-center gap-2 bg-blue-50 text-blue-700 px-4 py-2 rounded-full text-sm font-medium mb-4">
              <Clock className="h-4 w-4" />
              Coming Soon
            </div>
            <h2 className="text-3xl font-bold text-slate-900 mb-4">
              Native ERP &amp; DMS Connectors
            </h2>
            <p className="text-lg text-slate-600 max-w-2xl mx-auto">
              We&apos;re building native connectors for the platforms our
              customers use most. Join the waitlist to get notified when your
              system is supported.
            </p>
          </div>

          {/* Email input for notifications */}
          <div className="max-w-md mx-auto mb-8">
            <label
              htmlFor="notify-email"
              className="block text-sm font-medium text-slate-700 mb-2"
            >
              Your email (to receive notifications)
            </label>
            <Input
              id="notify-email"
              type="email"
              placeholder="you@company.com"
              value={notifyEmail}
              onChange={(e) => setNotifyEmail(e.target.value)}
            />
          </div>

          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4 max-w-3xl mx-auto">
            {comingSoonIntegrations.map((integration) => {
              const isNotified = notifiedIntegrations.has(integration.name)
              const isLoading = notifyLoading === integration.name

              return (
                <div
                  key={integration.name}
                  className="border border-slate-200 rounded-xl p-5 flex flex-col items-center text-center"
                >
                  <h3 className="font-semibold text-slate-900 mb-1">
                    {integration.name}
                  </h3>
                  <span className="text-xs text-slate-500 mb-3">
                    {integration.category}
                  </span>
                  {isNotified ? (
                    <span className="inline-flex items-center gap-1 text-sm text-emerald-700">
                      <Check className="h-4 w-4" />
                      Subscribed
                    </span>
                  ) : (
                    <Button
                      size="sm"
                      variant="outline"
                      disabled={!notifyEmail || isLoading}
                      onClick={() => handleNotify(integration.name)}
                    >
                      {isLoading ? (
                        "Subscribing..."
                      ) : (
                        <>
                          <Bell className="h-3.5 w-3.5 mr-1.5" />
                          Notify Me
                        </>
                      )}
                    </Button>
                  )}
                </div>
              )
            })}
          </div>
        </div>
      </section>

      {/* Integration Request Form */}
      <section className="py-20 bg-slate-50">
        <div className="container mx-auto px-6 max-w-xl">
          <div className="text-center mb-8">
            <h2 className="text-2xl font-bold text-slate-900 mb-3">
              Don&apos;t See Your ERP?
            </h2>
            <p className="text-slate-600">
              Tell us which system you use. We prioritize connectors based on
              customer demand.
            </p>
          </div>

          {requestSubmitted ? (
            <div className="bg-white rounded-xl border border-emerald-200 p-8 text-center">
              <Check className="h-12 w-12 text-emerald-600 mx-auto mb-4" />
              <h3 className="text-lg font-semibold text-slate-900 mb-2">
                Request Received
              </h3>
              <p className="text-slate-600">
                We&apos;ll notify you when we add support for {requestErp}.
              </p>
            </div>
          ) : (
            <form
              onSubmit={handleRequestSubmit}
              className="bg-white rounded-xl border border-slate-200 p-8 space-y-4"
            >
              <div>
                <label
                  htmlFor="request-erp"
                  className="block text-sm font-medium text-slate-700 mb-1.5"
                >
                  Which ERP/DMS/CMMS does your team use?
                </label>
                <Select value={requestErp} onValueChange={setRequestErp}>
                  <SelectTrigger id="request-erp">
                    <SelectValue placeholder="Select your system" />
                  </SelectTrigger>
                  <SelectContent>
                    {erpOptions.map((option) => (
                      <SelectItem key={option} value={option}>
                        {option}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <label
                  htmlFor="request-email"
                  className="block text-sm font-medium text-slate-700 mb-1.5"
                >
                  Your work email
                </label>
                <Input
                  id="request-email"
                  type="email"
                  placeholder="you@company.com"
                  value={requestEmail}
                  onChange={(e) => setRequestEmail(e.target.value)}
                  required
                />
              </div>
              <Button
                type="submit"
                className="w-full"
                disabled={!requestEmail || !requestErp || requestLoading}
              >
                {requestLoading ? (
                  "Submitting..."
                ) : (
                  <>
                    <Send className="h-4 w-4 mr-2" />
                    Request Integration
                  </>
                )}
              </Button>
            </form>
          )}
        </div>
      </section>

      {/* FAQ */}
      <section className="py-20">
        <div className="container mx-auto px-6 max-w-3xl">
          <h2 className="text-3xl font-bold text-slate-900 text-center mb-12">
            Frequently Asked Questions
          </h2>
          <div className="space-y-3">
            {faqItems.map((item, index) => (
              <div
                key={index}
                className="border border-slate-200 rounded-xl overflow-hidden"
              >
                <button
                  onClick={() =>
                    setOpenFaq(openFaq === index ? null : index)
                  }
                  className="w-full flex items-center justify-between p-5 text-left hover:bg-slate-50 transition-colors"
                >
                  <span className="font-medium text-slate-900">
                    {item.question}
                  </span>
                  {openFaq === index ? (
                    <ChevronUp className="h-5 w-5 text-slate-500 flex-shrink-0" />
                  ) : (
                    <ChevronDown className="h-5 w-5 text-slate-500 flex-shrink-0" />
                  )}
                </button>
                {openFaq === index && (
                  <div className="px-5 pb-5">
                    <p className="text-slate-600">{item.answer}</p>
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Bottom CTA */}
      <section className="py-16 bg-slate-950 text-white">
        <div className="container mx-auto px-6 max-w-3xl text-center">
          <h2 className="text-2xl font-bold mb-4">
            Ready to streamline your parts procurement?
          </h2>
          <p className="text-slate-400 mb-8">
            Start with a free trial. Export your data anytime. No lock-in.
          </p>
          <div className="flex items-center justify-center gap-4">
            <Link href="/signup">
              <Button size="lg" className="bg-white text-slate-950 hover:bg-slate-100">
                Start Free Trial
                <ArrowRight className="h-4 w-4 ml-2" />
              </Button>
            </Link>
            <Link href="/contact">
              <Button size="lg" variant="outline" className="border-slate-700 text-slate-300 hover:bg-slate-900">
                Talk to Sales
              </Button>
            </Link>
          </div>
        </div>
      </section>
    </div>
  )
}
