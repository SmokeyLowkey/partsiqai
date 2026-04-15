import type { Metadata } from "next"
import { notFound } from "next/navigation"
import { BrandCatalogPage } from "@/components/brand-catalog/brand-catalog-page"
import { getBrand, getAllBrandSlugs } from "@/lib/content/brands"

interface Props {
  params: Promise<{ brand: string }>
}

export function generateStaticParams() {
  return getAllBrandSlugs().map((brand) => ({ brand }))
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { brand } = await params
  const entry = getBrand(brand)
  if (!entry) return {}

  // Target primary keyword in title; keep under 60 chars incl. " | PartsIQ" suffix.
  const title = `${entry.name} Parts Management & Sourcing Guide`
  // Meta description hits brand-name + parts keywords naturally, under 155 chars.
  const description = `${entry.tagline} OEM and aftermarket sourcing guidance, popular models, and parts category breakdown.`

  return {
    title,
    description,
    keywords: [entry.primaryKeyword, ...entry.secondaryKeywords, "parts procurement", "parts sourcing"],
    alternates: { canonical: `/parts-catalog/${entry.slug}` },
    openGraph: {
      title: `${entry.name} Parts Sourcing Guide | PartsIQ`,
      description: entry.tagline,
      url: `/parts-catalog/${entry.slug}`,
      type: "article",
    },
  }
}

export default async function BrandCatalogRoute({ params }: Props) {
  const { brand } = await params
  const entry = getBrand(brand)
  if (!entry) notFound()

  return <BrandCatalogPage brand={entry} />
}
