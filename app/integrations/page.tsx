import type { Metadata } from "next"
import { BreadcrumbJsonLd } from "@/components/seo/breadcrumb-jsonld"
import { PublicFooter } from "@/components/layout/public-footer"
import { IntegrationsPageContent } from "@/components/integrations/integrations-page"

export const metadata: Metadata = {
  title: "Integrations — Connect PartsIQ to Your Operations Stack",
  description:
    "Export procurement data as CSV, connect Gmail and Outlook for supplier emails, and bring your own API keys. Native ERP/DMS connectors coming soon.",
  alternates: {
    canonical: "/integrations",
  },
  openGraph: {
    title: "PartsIQ Integrations",
    description:
      "Export procurement data, connect email, and bridge your ERP with CSV data exchange.",
    url: "/integrations",
  },
}

const faqItems = [
  {
    question: "Does PartsIQ replace my ERP?",
    answer:
      "No. PartsIQ is purpose-built for parts procurement — sourcing, quoting, and ordering. Your ERP continues to handle financials, approvals, and budget tracking. Most customers run both systems, with CSV export bridging the data between them.",
  },
  {
    question: "Can I get my data out of PartsIQ?",
    answer:
      "Yes. You can export quote requests and orders as CSV files at any time from your dashboard. The exports include all line items, supplier details, pricing, and status information — ready to import into your ERP, accounting system, or spreadsheet.",
  },
  {
    question: "What is BYOK (Bring Your Own Keys)?",
    answer:
      "Enterprise customers can connect their own API keys for voice (Vapi), AI (OpenRouter), and text-to-speech (ElevenLabs) services. This gives you direct control over costs and usage, with dedicated support for setup and optimization.",
  },
  {
    question: "When are native ERP connectors coming?",
    answer:
      "Native connectors for major ERP and DMS platforms are on our roadmap. Join the waitlist below to tell us which system you use — we prioritize based on customer demand.",
  },
]

export default function IntegrationsPage() {
  const faqJsonLd = {
    "@context": "https://schema.org",
    "@type": "FAQPage",
    mainEntity: faqItems.map((item) => ({
      "@type": "Question",
      name: item.question,
      acceptedAnswer: {
        "@type": "Answer",
        text: item.answer,
      },
    })),
  }

  return (
    <>
      <BreadcrumbJsonLd
        items={[
          { name: "Home", url: "/" },
          { name: "Integrations", url: "/integrations" },
        ]}
      />
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(faqJsonLd) }}
      />
      <IntegrationsPageContent faqItems={faqItems} />
      <PublicFooter />
    </>
  )
}
