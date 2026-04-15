import type { Metadata } from "next"
import { notFound } from "next/navigation"
import { ComparisonPage } from "@/components/comparison/comparison-page"
import { getCompetitor, getAllCompetitorSlugs } from "@/lib/content/competitors"

interface Props {
  params: Promise<{ competitor: string }>
}

export function generateStaticParams() {
  return getAllCompetitorSlugs().map((competitor) => ({ competitor }))
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { competitor } = await params
  const entry = getCompetitor(competitor)
  if (!entry) return {}

  // Title under 60 chars incl. " | PartsIQ" (10 chars added by template).
  // "PartsIQ vs {Name}: A Heavy Equipment Parts Alternative" → ~50 + suffix = ~60.
  const title = `PartsIQ vs ${entry.name}: Parts-First Alternative`
  // Description under 155 chars.
  const description = `${entry.positioning} See full feature comparison + which fits your workflow.`

  return {
    title,
    description,
    keywords: [
      `PartsIQ vs ${entry.name}`,
      `${entry.name} alternative`,
      `alternatives to ${entry.name}`,
      "parts inventory software",
      "parts procurement platform",
      "heavy equipment parts",
    ],
    alternates: { canonical: `/vs/${entry.slug}` },
    openGraph: {
      title: `PartsIQ vs ${entry.name}: ${entry.differentiator}`,
      description,
      url: `/vs/${entry.slug}`,
      type: "article",
    },
  }
}

export default async function VsCompetitorPage({ params }: Props) {
  const { competitor } = await params
  const entry = getCompetitor(competitor)
  if (!entry) notFound()

  return <ComparisonPage competitor={entry} />
}
