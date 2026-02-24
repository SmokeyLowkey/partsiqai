import type { Metadata } from "next"
import HomePageContent from "@/components/home/home-page-content"
import { JsonLd } from "@/components/seo/json-ld"
import { BreadcrumbJsonLd } from "@/components/seo/breadcrumb-jsonld"

export const metadata: Metadata = {
  title: "AI Parts Ordering System & Voice Agent | PartsIQ",
  description:
    "PartsIQ's AI voice agent calls your suppliers, negotiates pricing, and brings back structured quotes automatically. The AI-powered parts ordering system that reduces sourcing time from hours to minutes.",
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

export default function HomePage() {
  return (
    <>
      <JsonLd data={softwareJsonLd} />
      <BreadcrumbJsonLd items={[{ name: "Home", url: "/" }]} />
      <HomePageContent />
    </>
  )
}
