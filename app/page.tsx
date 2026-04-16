import type { Metadata } from "next"
import HomePageContent from "@/components/home/home-page-content"
import { JsonLd } from "@/components/seo/json-ld"
import { BreadcrumbJsonLd } from "@/components/seo/breadcrumb-jsonld"

export const metadata: Metadata = {
  title: { absolute: "PartsIQ - Parts Inventory Software | AI-Powered" },
  description:
    "AI-powered parts inventory software with voice agent that calls suppliers and brings back quotes. Reduce sourcing time from hours to minutes.",
  keywords: [
    "parts ordering system",
    "AI parts lookup",
    "AI parts assistant",
    "voice-activated parts search",
    "conversational AI parts lookup",
    "semantic parts search",
    "parts inventory management software",
  ],
  alternates: {
    canonical: "/",
  },
  openGraph: {
    title: "AI Parts Ordering System & Voice Agent | PartsIQ",
    description:
      "Your AI calls suppliers and brings back quotes. Reduce parts sourcing time from hours to minutes with AI voice automation.",
    url: "/",
  },
}

const softwareJsonLd = {
  "@context": "https://schema.org",
  "@type": "SoftwareApplication",
  name: "PartsIQ",
  applicationCategory: "BusinessApplication",
  operatingSystem: "Web",
  description:
    "AI-powered parts ordering system with voice agent automation, multi-agent search, and supplier management for industrial operations.",
  offers: {
    "@type": "AggregateOffer",
    lowPrice: "199",
    highPrice: "1299",
    priceCurrency: "USD",
    offerCount: 3,
  },
  featureList: [
    "AI Voice Agent for Supplier Calls",
    "Multi-Agent AI Parts Search",
    "Automated Email Quote Requests",
    "Price Comparison Dashboard",
    "Equipment & Fleet Tracking",
    "Predictive Maintenance Scheduling",
    "Parts Number Cross Reference",
    "Order Management & Delivery Tracking",
  ],
}

// Homepage FAQ schema — surfaces as "People Also Ask" rich results in SERPs.
// Answers are concise and factual; don't claim capabilities the app doesn't have.
const faqJsonLd = {
  "@context": "https://schema.org",
  "@type": "FAQPage",
  mainEntity: [
    {
      "@type": "Question",
      name: "How does the PartsIQ AI voice agent work?",
      acceptedAnswer: {
        "@type": "Answer",
        text: "PartsIQ's AI voice agent places outbound phone calls to your suppliers to request pricing and availability on parts you specify. It identifies itself as an AI at the start of each call, conducts a natural conversation to collect quote details, and returns structured pricing data to you for side-by-side comparison. You review and approve before any purchase order is placed.",
      },
    },
    {
      "@type": "Question",
      name: "Which equipment brands does PartsIQ support?",
      acceptedAnswer: {
        "@type": "Answer",
        text: "PartsIQ supports parts sourcing for all major heavy and compact equipment manufacturers including Caterpillar, Komatsu, John Deere, Volvo CE, Hitachi, Case CE, New Holland, JCB, Bobcat, Kubota, Takeuchi, Wacker Neuson, Yanmar, and Vermeer. Our AI parts search covers OEM and aftermarket channels across construction, agricultural, forestry, and mining equipment.",
      },
    },
    {
      "@type": "Question",
      name: "How long does PartsIQ take to set up?",
      acceptedAnswer: {
        "@type": "Answer",
        text: "Initial setup typically takes 15-30 minutes — create an account, connect your email (Gmail or Microsoft 365) for supplier correspondence, and import your existing supplier list. AI voice agent configuration requires a brief verification of the outbound phone number. Most teams are placing their first AI-assisted quote request on day one.",
      },
    },
    {
      "@type": "Question",
      name: "Does PartsIQ integrate with my existing CMMS or ERP?",
      acceptedAnswer: {
        "@type": "Answer",
        text: "PartsIQ integrates with Gmail and Microsoft 365 via OAuth for supplier email communication. You can export quote requests and orders as CSV to import into your ERP or accounting system. Enterprise customers can bring their own API keys (BYOK) for voice and AI services. Native ERP/DMS connectors are on the roadmap — visit partsiqai.com/integrations for details and to request your ERP.",
      },
    },
    {
      "@type": "Question",
      name: "Is there a free trial?",
      acceptedAnswer: {
        "@type": "Answer",
        text: "Yes — PartsIQ offers a 14-day free trial with no credit card required. You can sign up, connect your email, and start placing AI-assisted quote requests immediately. Paid plans start at $199/month for the Starter tier.",
      },
    },
    {
      "@type": "Question",
      name: "How much can PartsIQ reduce parts sourcing time?",
      acceptedAnswer: {
        "@type": "Answer",
        text: "Operations that previously spent 3-4 hours per day on manual parts sourcing — calling suppliers, collecting quotes, comparing pricing — typically reduce that to 15-30 minutes of review time when using PartsIQ's AI voice agent and quote comparison workflows. Actual savings depend on quote volume and supplier complexity.",
      },
    },
  ],
}

export default function HomePage() {
  return (
    <>
      <JsonLd data={softwareJsonLd} />
      <JsonLd data={faqJsonLd} />
      <BreadcrumbJsonLd items={[{ name: "Home", url: "/" }]} />
      <HomePageContent />
    </>
  )
}
