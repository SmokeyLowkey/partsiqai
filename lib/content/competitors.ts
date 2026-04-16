/**
 * Competitor data for /vs/[competitor] comparison pages.
 *
 * Each entry drives a full SEO-optimized comparison page. Content is kept
 * honest — we acknowledge competitor strengths and differentiate on real
 * capability gaps (AI voice agent, heavy-equipment focus, parts-first
 * positioning), not marketing puffery.
 *
 * Framework for authoring: what a buyer Googling "PartsIQ vs X" actually
 * wants is a fair side-by-side that helps them decide, not a hit piece.
 */

export type FeatureSupport = "yes" | "no" | "partial"

export interface CompetitorFeatureRow {
  label: string
  partsiq: FeatureSupport
  competitor: FeatureSupport
  note?: string
}

export interface CompetitorEntry {
  slug: string
  name: string
  url: string
  /** One-line positioning statement used in meta description + hero subtitle */
  positioning: string
  /** Primary 1-sentence differentiator — appears in the hero callout */
  differentiator: string
  /** Short headline-ready claim about what the competitor does well */
  competitorCategory: string
  /** What PartsIQ is framed as, relative to this competitor */
  partsiqCategory: string
  /** Honest strengths — shown under "Choose [competitor] if you..." */
  chooseCompetitor: string[]
  /** Honest strengths — shown under "Choose PartsIQ if you..." */
  choosePartsIQ: string[]
  /** Feature comparison table rows — keep to 7-9 rows */
  features: CompetitorFeatureRow[]
  /** FAQ entries — feed the FAQPage JSON-LD + on-page section */
  faq: { question: string; answer: string }[]
}

const COMMON_FEATURES: Omit<CompetitorFeatureRow, "competitor">[] = [
  { label: "AI voice agent that calls suppliers for quotes", partsiq: "yes" },
  { label: "Multi-supplier quote comparison (side-by-side)", partsiq: "yes" },
  { label: "Multi-database AI parts search (SQL + vector + graph)", partsiq: "yes" },
  { label: "Cross-brand parts referencing (OEM alternatives)", partsiq: "yes" },
  { label: "Automated email quote requests + follow-up", partsiq: "yes" },
  { label: "Work order / CMMS management", partsiq: "partial" },
  { label: "Fleet vehicle management (telematics, driver)", partsiq: "no" },
  { label: "CSV data export (quotes, orders, parts)", partsiq: "yes" },
  { label: "Built specifically for heavy & compact equipment parts", partsiq: "yes" },
]

export const COMPETITORS: CompetitorEntry[] = [
  {
    slug: "maintainx",
    name: "MaintainX",
    url: "https://www.getmaintainx.com",
    positioning: "MaintainX is a full-featured CMMS with parts tracking as one of many modules. PartsIQ is purpose-built for parts sourcing and procurement.",
    differentiator: "MaintainX is a CMMS with parts as a feature. PartsIQ is built from the parts side up.",
    competitorCategory: "general-purpose CMMS",
    partsiqCategory: "parts procurement platform",
    chooseCompetitor: [
      "You need work order management as your primary workflow",
      "Your team runs scheduled preventive maintenance across many asset classes",
      "You want a mobile-first CMMS with a large existing user community",
      "Parts inventory is a secondary concern, not your biggest bottleneck",
    ],
    choosePartsIQ: [
      "Your team spends hours per day chasing parts quotes from suppliers",
      "You run heavy & compact equipment and need brand-aware parts intelligence",
      "You want AI to call suppliers and return structured quotes automatically",
      "You need cross-brand part referencing (OEM alternatives, aftermarket options)",
    ],
    features: COMMON_FEATURES.map((f) => {
      const map: Record<string, FeatureSupport> = {
        "AI voice agent that calls suppliers for quotes": "no",
        "Multi-supplier quote comparison (side-by-side)": "no",
        "Multi-database AI parts search (SQL + vector + graph)": "no",
        "Cross-brand parts referencing (OEM alternatives)": "no",
        "Automated email quote requests + follow-up": "partial",
        "Work order / CMMS management": "yes",
        "Fleet vehicle management (telematics, driver)": "no",
        "Built specifically for heavy & compact equipment parts": "no",
      }
      return { ...f, competitor: map[f.label] }
    }),
    faq: [
      {
        question: "Is MaintainX a direct alternative to PartsIQ?",
        answer: "Not exactly — they serve different primary workflows. MaintainX is a CMMS for work order and maintenance management, with parts inventory as a supporting feature. PartsIQ is built around parts sourcing and procurement, with AI that calls suppliers and extracts quotes. Many teams run both: MaintainX for the maintenance plan, PartsIQ for the parts that maintenance plan needs."
      },
      {
        question: "Can MaintainX do automated supplier quoting?",
        answer: "MaintainX can store supplier records and link parts to suppliers, but it does not have an AI voice agent that calls suppliers or a multi-supplier quote comparison workflow. Procurement in MaintainX is typically a manual PO creation step after someone has already sourced the part elsewhere."
      },
      {
        question: "Which is better for heavy & compact equipment operations?",
        answer: "MaintainX is industry-agnostic — it serves facilities maintenance, manufacturing, and fleet alongside heavy & compact equipment. PartsIQ is purpose-built for heavy & compact equipment parts, with native support for CAT, Komatsu, Deere, and other heavy-equipment manufacturers, plus cross-brand part referencing that generic CMMS tools don't offer."
      }
    ]
  },
  {
    slug: "fleetio",
    name: "Fleetio",
    url: "https://www.fleetio.com",
    positioning: "Fleetio manages fleet operations — vehicles, drivers, telematics. PartsIQ manages the parts supply chain behind them.",
    differentiator: "Fleetio runs your fleet. PartsIQ runs your parts operation.",
    competitorCategory: "fleet management platform",
    partsiqCategory: "parts procurement platform",
    chooseCompetitor: [
      "Your primary workflow is managing vehicles, drivers, and routes",
      "You need telematics, GPS tracking, and fuel / driver-behavior data",
      "Your parts needs are fleet-vehicle-focused (tires, oil, filters)",
      "You already have a parts-sourcing process that works",
    ],
    choosePartsIQ: [
      "You operate heavy & compact equipment — excavators, loaders, dozers — not just trucks",
      "Parts sourcing is where your operations team loses the most time",
      "You need AI to call suppliers and bring back comparable quotes",
      "You want deep parts intelligence, not telematics",
    ],
    features: COMMON_FEATURES.map((f) => {
      const map: Record<string, FeatureSupport> = {
        "AI voice agent that calls suppliers for quotes": "no",
        "Multi-supplier quote comparison (side-by-side)": "no",
        "Multi-database AI parts search (SQL + vector + graph)": "no",
        "Cross-brand parts referencing (OEM alternatives)": "partial",
        "Automated email quote requests + follow-up": "no",
        "Work order / CMMS management": "yes",
        "Fleet vehicle management (telematics, driver)": "yes",
        "Built specifically for heavy & compact equipment parts": "no",
      }
      return { ...f, competitor: map[f.label] }
    }),
    faq: [
      {
        question: "Does Fleetio handle parts procurement?",
        answer: "Fleetio tracks parts usage and inventory as part of its fleet maintenance module, but procurement itself — getting quotes, comparing suppliers, placing POs — is a manual step outside the core Fleetio workflow. Fleetio is optimized for fleet operations, not parts sourcing."
      },
      {
        question: "Can I use Fleetio and PartsIQ together?",
        answer: "Yes, and it's a common pattern. Fleetio runs fleet operations end-to-end. PartsIQ feeds the parts-sourcing side — our AI voice agent sources quotes, and you can push the selected parts + POs into Fleetio's inventory module. They solve different problems."
      },
      {
        question: "I run heavy & compact equipment, not vehicles. Does Fleetio still fit?",
        answer: "Fleetio supports heavy & compact equipment alongside its fleet focus, but the product is built around vehicle workflows (fuel logs, driver telematics, DVIRs). PartsIQ is purpose-built for heavy & compact equipment parts — brand-aware search, cross-brand referencing, and supplier workflows specific to construction, agriculture, and mining equipment."
      }
    ]
  },
  {
    slug: "fiix",
    name: "Fiix",
    url: "https://www.fiixsoftware.com",
    positioning: "Fiix is an enterprise CMMS by Rockwell Automation. PartsIQ is a heavy-equipment-native parts procurement platform.",
    differentiator: "Fiix: enterprise-grade CMMS. PartsIQ: heavy-equipment-specialized parts platform.",
    competitorCategory: "enterprise CMMS",
    partsiqCategory: "parts procurement platform",
    chooseCompetitor: [
      "You're a large manufacturer needing deep Rockwell / industrial integrations",
      "You need reliability metrics (RUL, MTBF, MTTF) across thousands of assets",
      "You have an existing asset management framework you need to extend",
      "Procurement is handled upstream in a separate ERP (SAP, Oracle)",
    ],
    choosePartsIQ: [
      "You run heavy & compact equipment in construction, agriculture, or mining",
      "You need an AI voice agent to actively source parts quotes from suppliers",
      "You don't want enterprise-CMMS complexity for a parts-focused workflow",
      "Your team wants to source parts in minutes, not hours",
    ],
    features: COMMON_FEATURES.map((f) => {
      const map: Record<string, FeatureSupport> = {
        "AI voice agent that calls suppliers for quotes": "no",
        "Multi-supplier quote comparison (side-by-side)": "no",
        "Multi-database AI parts search (SQL + vector + graph)": "partial",
        "Cross-brand parts referencing (OEM alternatives)": "no",
        "Automated email quote requests + follow-up": "partial",
        "Work order / CMMS management": "yes",
        "Fleet vehicle management (telematics, driver)": "no",
        "Built specifically for heavy & compact equipment parts": "no",
      }
      return { ...f, competitor: map[f.label] }
    }),
    faq: [
      {
        question: "How is Fiix different from PartsIQ?",
        answer: "Fiix is an enterprise CMMS designed for large industrial operations that need deep reliability and asset management. PartsIQ is a parts procurement platform for heavy & compact equipment teams that spend too much time chasing supplier quotes. Fiix manages assets; PartsIQ manages the parts supply chain behind those assets."
      },
      {
        question: "Does Fiix have an AI parts sourcing feature?",
        answer: "Fiix has parts inventory tracking and integrates with procurement systems, but it does not have an AI voice agent for supplier calling or automated multi-supplier quote comparison. Parts procurement in Fiix is typically handled by an integrated ERP, not Fiix itself."
      },
      {
        question: "Is PartsIQ enterprise-ready?",
        answer: "PartsIQ is built for mid-market and enterprise heavy & compact equipment operations — multi-location support, role-based access, audit logs, and custom supplier scoring. It's not a Rockwell-scale platform, but for heavy & compact equipment parts specifically, it's a purpose-built alternative that most Fiix customers don't need the full CMMS weight for."
      }
    ]
  },
  {
    slug: "upkeep",
    name: "UpKeep",
    url: "https://www.onupkeep.com",
    positioning: "UpKeep is a popular mobile-first CMMS for SMB maintenance teams. PartsIQ is a parts procurement platform for heavy & compact equipment operations.",
    differentiator: "UpKeep: maintenance management for small teams. PartsIQ: parts procurement for heavy & compact equipment.",
    competitorCategory: "SMB CMMS",
    partsiqCategory: "parts procurement platform",
    chooseCompetitor: [
      "You're a small-to-mid maintenance team needing a mobile-first CMMS",
      "Work orders and technician scheduling are your core daily workflows",
      "You service facilities, buildings, or general industrial equipment",
      "Parts procurement is not your primary operational pain",
    ],
    choosePartsIQ: [
      "Parts sourcing is costing your team hours per day",
      "You run heavy & compact equipment — CAT, Komatsu, Deere, Volvo",
      "You need AI to contact suppliers directly, not just track inventory",
      "You want supplier quote comparison as a first-class workflow",
    ],
    features: COMMON_FEATURES.map((f) => {
      const map: Record<string, FeatureSupport> = {
        "AI voice agent that calls suppliers for quotes": "no",
        "Multi-supplier quote comparison (side-by-side)": "no",
        "Multi-database AI parts search (SQL + vector + graph)": "no",
        "Cross-brand parts referencing (OEM alternatives)": "no",
        "Automated email quote requests + follow-up": "no",
        "Work order / CMMS management": "yes",
        "Fleet vehicle management (telematics, driver)": "no",
        "Built specifically for heavy & compact equipment parts": "no",
      }
      return { ...f, competitor: map[f.label] }
    }),
    faq: [
      {
        question: "Is UpKeep a direct competitor to PartsIQ?",
        answer: "They're complementary more than competitive. UpKeep is a CMMS focused on work orders and preventive maintenance scheduling for SMB teams. PartsIQ is a parts procurement platform focused on sourcing, supplier quoting, and order tracking for heavy & compact equipment. Many teams use a CMMS for maintenance operations and a separate parts platform for sourcing."
      },
      {
        question: "Can UpKeep replace my parts sourcing workflow?",
        answer: "UpKeep includes basic parts inventory tracking, but it does not have an AI voice agent for supplier calls, multi-supplier quote comparison, or cross-brand parts referencing. If your biggest time sink is chasing parts quotes, UpKeep alone won't solve it."
      },
      {
        question: "Which is better for heavy & compact equipment teams?",
        answer: "UpKeep is industry-agnostic and optimized for SMB maintenance workflows. PartsIQ is purpose-built for heavy & compact equipment operations — native brand support, parts-specific AI search, and supplier workflows tuned for construction, mining, and agriculture."
      }
    ]
  },
  {
    slug: "limble",
    name: "Limble CMMS",
    url: "https://limblecmms.com",
    positioning: "Limble CMMS is a general-purpose maintenance management tool. PartsIQ is a parts-first procurement platform.",
    differentiator: "Limble handles maintenance workflows. PartsIQ handles parts-sourcing workflows.",
    competitorCategory: "general CMMS",
    partsiqCategory: "parts procurement platform",
    chooseCompetitor: [
      "You need a broadly-used, easy-to-configure CMMS for general maintenance",
      "Your team's primary workflow is work orders and preventive maintenance",
      "You manage facilities or general industrial equipment, not heavy & compact equipment",
      "You already have a separate, working parts procurement process",
    ],
    choosePartsIQ: [
      "Parts sourcing is your team's biggest operational bottleneck",
      "You run heavy & compact equipment with thousands of parts across multiple brands",
      "You want AI to call suppliers for quotes instead of your team doing it manually",
      "You need cross-brand part referencing (OEM vs aftermarket)",
    ],
    features: COMMON_FEATURES.map((f) => {
      const map: Record<string, FeatureSupport> = {
        "AI voice agent that calls suppliers for quotes": "no",
        "Multi-supplier quote comparison (side-by-side)": "no",
        "Multi-database AI parts search (SQL + vector + graph)": "no",
        "Cross-brand parts referencing (OEM alternatives)": "no",
        "Automated email quote requests + follow-up": "no",
        "Work order / CMMS management": "yes",
        "Fleet vehicle management (telematics, driver)": "no",
        "Built specifically for heavy & compact equipment parts": "no",
      }
      return { ...f, competitor: map[f.label] }
    }),
    faq: [
      {
        question: "What does Limble CMMS do that PartsIQ doesn't?",
        answer: "Limble provides complete CMMS functionality — work orders, preventive maintenance scheduling, asset hierarchies, and technician management. PartsIQ has lighter work-order capabilities because it's focused on the parts procurement half of the operation, not the maintenance execution half."
      },
      {
        question: "Can I use Limble and PartsIQ together?",
        answer: "Yes — it's a natural pairing. Limble runs your maintenance plan and generates the parts demand. PartsIQ sources those parts via AI voice agent, compares supplier quotes, and pushes selected parts back into your inventory flow."
      },
      {
        question: "Which is better for sourcing parts for heavy & compact equipment?",
        answer: "PartsIQ, clearly. Limble tracks parts inventory but doesn't source parts — no supplier calling, no quote comparison, no cross-brand referencing. For heavy & compact equipment operations where parts sourcing itself is the biggest time sink, PartsIQ is built for that specific problem."
      }
    ]
  },
  {
    slug: "emaint",
    name: "eMaint",
    url: "https://www.emaint.com",
    positioning: "eMaint is a mature enterprise CMMS by Fluke. PartsIQ is a modern parts procurement platform for heavy & compact equipment.",
    differentiator: "eMaint: legacy enterprise CMMS. PartsIQ: AI-native parts platform.",
    competitorCategory: "enterprise CMMS",
    partsiqCategory: "parts procurement platform",
    chooseCompetitor: [
      "You're a large manufacturer with existing Fluke calibration / instrumentation",
      "You need deep compliance reporting and audit trails across thousands of assets",
      "You have dedicated procurement and maintenance teams with separate systems",
      "You're not specifically in heavy & compact equipment",
    ],
    choosePartsIQ: [
      "You run heavy & compact equipment and want a parts-first, AI-native platform",
      "Your team wants to source parts in minutes, not navigate an enterprise CMMS",
      "You need an AI voice agent that calls suppliers for quotes",
      "You want modern UX without years of CMMS customization overhead",
    ],
    features: COMMON_FEATURES.map((f) => {
      const map: Record<string, FeatureSupport> = {
        "AI voice agent that calls suppliers for quotes": "no",
        "Multi-supplier quote comparison (side-by-side)": "no",
        "Multi-database AI parts search (SQL + vector + graph)": "no",
        "Cross-brand parts referencing (OEM alternatives)": "no",
        "Automated email quote requests + follow-up": "partial",
        "Work order / CMMS management": "yes",
        "Fleet vehicle management (telematics, driver)": "no",
        "Built specifically for heavy & compact equipment parts": "no",
      }
      return { ...f, competitor: map[f.label] }
    }),
    faq: [
      {
        question: "Is eMaint a good fit for heavy & compact equipment operations?",
        answer: "eMaint supports heavy & compact equipment among many other industries, but it's not specialized for it. PartsIQ is built specifically for heavy & compact equipment — cross-brand parts referencing for CAT / Komatsu / Deere, AI parts search tuned for construction and agricultural equipment, and supplier workflows that match how heavy & compact equipment parts are actually sourced."
      },
      {
        question: "Does eMaint have AI-powered parts sourcing?",
        answer: "eMaint has parts inventory tracking and basic vendor management, but it does not have an AI voice agent that calls suppliers, nor automated multi-supplier quote comparison. eMaint is a mature CMMS with deep features; parts procurement is typically handled in a separate ERP."
      },
      {
        question: "I have eMaint — can I add PartsIQ for parts procurement?",
        answer: "Yes, that's a common setup. Keep eMaint for maintenance management, calibration, and asset reliability reporting. Use PartsIQ to source parts that eMaint identifies as needed — AI voice agent gets supplier quotes, PartsIQ compares them, you approve, and the selected POs feed back into eMaint's inventory."
      }
    ]
  },
  {
    slug: "hcss",
    name: "HCSS",
    url: "https://www.hcss.com",
    positioning: "HCSS is a construction-operations suite (bidding, safety, telematics). PartsIQ handles the parts supply chain for construction equipment.",
    differentiator: "HCSS manages your construction operations. PartsIQ manages your parts supply chain.",
    competitorCategory: "construction operations software",
    partsiqCategory: "parts procurement platform",
    chooseCompetitor: [
      "You're a construction contractor needing bidding, estimating, and jobsite tools",
      "Safety management, DOT compliance, and telematics are core to your operations",
      "You already have a working parts procurement process",
      "You want a single vendor across construction operations — not parts-specific",
    ],
    choosePartsIQ: [
      "Parts procurement is where your operations team loses the most time",
      "You need AI to actively source parts quotes, not just track operations",
      "You want a parts platform that works alongside your existing HCSS stack",
      "You need cross-brand parts referencing and multi-supplier comparison",
    ],
    features: COMMON_FEATURES.map((f) => {
      const map: Record<string, FeatureSupport> = {
        "AI voice agent that calls suppliers for quotes": "no",
        "Multi-supplier quote comparison (side-by-side)": "no",
        "Multi-database AI parts search (SQL + vector + graph)": "no",
        "Cross-brand parts referencing (OEM alternatives)": "no",
        "Automated email quote requests + follow-up": "no",
        "Work order / CMMS management": "partial",
        "Fleet vehicle management (telematics, driver)": "yes",
        "Built specifically for heavy & compact equipment parts": "partial",
      }
      return { ...f, competitor: map[f.label] }
    }),
    faq: [
      {
        question: "Does HCSS do parts procurement?",
        answer: "HCSS is focused on construction operations — bidding, estimating, safety, telematics, and equipment tracking. It does not have native parts procurement. HCSS notably partnered with a third party to 'digitize parts procurement' because it wasn't a core HCSS capability. PartsIQ fills that gap directly with AI-powered supplier sourcing."
      },
      {
        question: "Is PartsIQ a replacement for HCSS?",
        answer: "No — they're complementary. HCSS runs your construction operations end-to-end. PartsIQ plugs in on the parts supply chain side: AI voice agent calls suppliers for quotes, compares prices across vendors, and feeds selected parts into your procurement workflow. Many construction teams run both."
      },
      {
        question: "How does PartsIQ integrate with construction workflows?",
        answer: "PartsIQ is built for heavy & compact equipment in construction, agriculture, and mining. It handles brand-specific parts intelligence (CAT, Komatsu, Deere, Volvo), cross-brand OEM alternatives, and supplier quote automation — the exact workflow construction parts buyers run daily."
      }
    ]
  },
  {
    slug: "gearflow",
    name: "Gearflow",
    url: "https://www.gearflow.com",
    positioning: "Gearflow is a fleet-wide procurement marketplace. PartsIQ is a heavy-equipment-specialized parts procurement platform with AI voice agent.",
    differentiator: "Gearflow: generic fleet procurement marketplace. PartsIQ: heavy & compact equipment parts procurement with AI voice agent.",
    competitorCategory: "fleet procurement marketplace",
    partsiqCategory: "parts procurement platform",
    chooseCompetitor: [
      "You run a mixed fleet and want a procurement marketplace across categories",
      "You're comfortable with a vendor network managed by the platform",
      "You need broad parts and consumables, not heavy-equipment-specific depth",
      "AI voice agent calling suppliers isn't essential to your workflow",
    ],
    choosePartsIQ: [
      "You operate heavy & compact equipment specifically — excavators, loaders, dozers",
      "You want an AI voice agent that calls your own suppliers directly",
      "You need deep cross-brand parts referencing (CAT ↔ Komatsu ↔ Deere)",
      "You prefer owning supplier relationships, not buying through a marketplace",
    ],
    features: COMMON_FEATURES.map((f) => {
      const map: Record<string, FeatureSupport> = {
        "AI voice agent that calls suppliers for quotes": "no",
        "Multi-supplier quote comparison (side-by-side)": "partial",
        "Multi-database AI parts search (SQL + vector + graph)": "partial",
        "Cross-brand parts referencing (OEM alternatives)": "partial",
        "Automated email quote requests + follow-up": "yes",
        "Work order / CMMS management": "no",
        "Fleet vehicle management (telematics, driver)": "no",
        "Built specifically for heavy & compact equipment parts": "partial",
      }
      return { ...f, competitor: map[f.label] }
    }),
    faq: [
      {
        question: "How is PartsIQ different from Gearflow?",
        answer: "Gearflow operates as a procurement marketplace where buyers request quotes and vendors in Gearflow's network respond. PartsIQ is a parts procurement platform that works with your own supplier relationships — our AI voice agent calls the suppliers you already buy from, extracts quotes, and compares them side-by-side. Different models for different buyer preferences."
      },
      {
        question: "Does Gearflow specialize in heavy & compact equipment?",
        answer: "Gearflow serves fleet teams broadly — heavy & compact equipment, trucking, construction, and general fleet parts. PartsIQ specializes specifically in heavy & compact equipment parts, with native brand support, cross-brand part referencing, and workflows tuned for construction, mining, and agriculture equipment buyers."
      },
      {
        question: "Which is better if I already have strong supplier relationships?",
        answer: "PartsIQ. Our AI voice agent calls your own suppliers, which means you keep your existing vendor relationships, negotiated pricing, and credit terms. Gearflow routes RFQs through their marketplace vendor network, which can be useful for broadening sourcing but changes where your supplier relationships live."
      }
    ]
  }
]

export function getCompetitor(slug: string): CompetitorEntry | undefined {
  return COMPETITORS.find((c) => c.slug === slug)
}

export function getAllCompetitorSlugs(): string[] {
  return COMPETITORS.map((c) => c.slug)
}
