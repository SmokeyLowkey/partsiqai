/**
 * Equipment brand data for /parts-catalog/[brand] programmatic pages.
 *
 * Each entry drives an SEO-optimized content hub targeting brand-name
 * keyword clusters (e.g. "bobcat parts", "kubota parts catalog").
 *
 * Legal safeguards — every page built from these entries must:
 *   - Use "compatible with [Brand]" or "for [Brand] equipment" framing (not "Official [Brand]")
 *   - Never host OEM logos, parts diagrams, or trade-dress imagery
 *   - Link out to the OEM's official catalog via `oemCatalogUrl`
 *   - Render the nominative-use disclaimer in the page footer
 *
 * Content truthfulness — model names and categories are drawn from each
 * manufacturer's current public product lineup as of 2026-04-15. Review
 * before expanding to new brands.
 */

export type EquipmentCategory =
  | "compact construction equipment"
  | "heavy construction equipment"
  | "agricultural equipment"
  | "forestry equipment"

export interface BrandModel {
  /** Model identifier as commonly searched, e.g. "S650" */
  model: string
  /** Short product category, e.g. "Skid-steer loader" */
  type: string
}

export interface PartsCategory {
  name: string
  examples: string
}

export interface BrandFAQ {
  question: string
  answer: string
}

export interface BrandEntry {
  slug: string
  name: string
  /** Full legal name — used in disclaimers. */
  legalName: string
  /** Primary search keyword this page targets, e.g. "bobcat parts" */
  primaryKeyword: string
  /** Secondary keywords (for meta + body sprinkling) */
  secondaryKeywords: string[]
  /** One-line positioning used in hero subtitle + meta description */
  tagline: string
  /** 2–3 sentences describing the manufacturer (factual, public info only) */
  description: string
  category: EquipmentCategory
  /** Equipment type headings the brand is known for */
  equipmentTypes: string[]
  /** Well-known models — used in body copy for long-tail keyword inclusion */
  popularModels: BrandModel[]
  /** Common parts categories buyers search within this brand */
  popularPartsCategories: PartsCategory[]
  /** Official OEM parts catalog URL — MUST link out, do not copy content */
  oemCatalogUrl: string
  /** Common sourcing/operational challenges — honest, no smear */
  sourcingChallenges: string[]
  /** Guidance on OEM vs aftermarket for this brand's ecosystem */
  oemVsAftermarket: { preferOem: string; aftermarketOk: string }
  faq: BrandFAQ[]
}

export const BRANDS: BrandEntry[] = [
  {
    slug: "bobcat",
    name: "Bobcat",
    legalName: "Bobcat Company (a Doosan subsidiary)",
    primaryKeyword: "bobcat parts",
    secondaryKeywords: ["bobcat parts catalog", "bobcat parts online", "bobcat skid steer parts", "oem bobcat parts"],
    tagline: "Parts management and sourcing for Bobcat compact construction equipment.",
    description: "Bobcat is a leading manufacturer of compact construction equipment best known for skid-steer loaders, compact track loaders, and compact excavators. Their equipment is widely used across construction, landscaping, agriculture, and utility operations in North America.",
    category: "compact construction equipment",
    equipmentTypes: ["Skid-steer loaders", "Compact track loaders", "Compact excavators", "Compact wheel loaders", "Utility work machines", "Attachments"],
    popularModels: [
      { model: "S650", type: "Skid-steer loader" },
      { model: "S750", type: "Skid-steer loader" },
      { model: "T770", type: "Compact track loader" },
      { model: "T590", type: "Compact track loader" },
      { model: "E35", type: "Compact excavator" },
      { model: "E85", type: "Compact excavator" },
      { model: "5600 Toolcat", type: "Utility work machine" },
    ],
    popularPartsCategories: [
      { name: "Filters", examples: "Hydraulic, oil, fuel, air, cab" },
      { name: "Hydraulic system", examples: "Pumps, cylinders, hoses, couplers" },
      { name: "Undercarriage", examples: "Tracks, rollers, sprockets, idlers" },
      { name: "Drive & powertrain", examples: "Drive motors, axles, bearings" },
      { name: "Engine components", examples: "Belts, gaskets, sensors, starters" },
      { name: "Wear parts", examples: "Bucket teeth, cutting edges, tips" },
      { name: "Electrical", examples: "Alternators, solenoids, wiring harnesses" },
      { name: "Attachments", examples: "Buckets, forks, grapples, augers" },
    ],
    oemCatalogUrl: "https://www.bobcat.com/na/en/service-parts/parts",
    sourcingChallenges: [
      "Dealer network lead times vary widely by region and part availability",
      "Older pre-2010 machines often have long sourcing cycles for specialty parts",
      "Aftermarket quality varies significantly — especially for hydraulic components",
      "Part number cross-referencing to Case or Doosan equivalents is sometimes needed",
    ],
    oemVsAftermarket: {
      preferOem: "Safety-critical systems (hydraulics, brakes, steering), warranty-period machines, and parts with complex tolerances.",
      aftermarketOk: "Filters, belts, hoses, wear parts like bucket teeth and cutting edges, and common consumables on older machines.",
    },
    faq: [
      {
        question: "Where can I find the official Bobcat parts catalog?",
        answer: "The official Bobcat parts catalog is available at bobcat.com. You can search by model number to find OEM parts, exploded-view diagrams, and local dealer pricing. PartsIQ is not affiliated with Bobcat — we help source parts across multiple supplier channels (OEM dealers and verified aftermarket vendors)."
      },
      {
        question: "Are aftermarket parts compatible with Bobcat equipment?",
        answer: "Many aftermarket parts fit Bobcat equipment correctly and are 30-50% cheaper than OEM. For safety-critical systems (hydraulics, brakes, steering) or machines still under warranty, OEM parts are typically the safer choice. For wear parts, filters, and consumables on older machines, aftermarket is commonly accepted. Always verify the part number cross-reference before ordering."
      },
      {
        question: "How do I identify the right part number for my Bobcat machine?",
        answer: "Start with your machine's model number and serial number — both are on the VIN plate. Look up the specific part in the Bobcat parts catalog or your operator's manual. For older or aftermarket-sourced parts, cross-reference the OEM part number against the supplier's listed equivalents. PartsIQ's AI search can help identify parts by description when a part number isn't available."
      },
      {
        question: "How does PartsIQ help source Bobcat parts?",
        answer: "PartsIQ is a parts procurement platform — not a Bobcat dealer. We use AI to search across your verified supplier network, contact multiple vendors automatically (including an AI voice agent that calls suppliers for quotes), and compare pricing side-by-side. For Bobcat equipment, that means faster quote turnaround across OEM dealers and aftermarket suppliers in one workflow."
      }
    ]
  },

  {
    slug: "kubota",
    name: "Kubota",
    legalName: "Kubota Corporation",
    primaryKeyword: "kubota parts",
    secondaryKeywords: ["kubota parts catalog", "kubota parts diagram", "kubota parts online"],
    tagline: "Parts management and sourcing for Kubota compact equipment, tractors, and construction machinery.",
    description: "Kubota is a Japanese manufacturer of compact tractors, construction equipment, and agricultural machinery. Their lineup spans compact excavators, skid-steer loaders, utility tractors, and compact track loaders widely deployed in construction, agriculture, and landscaping operations.",
    category: "compact construction equipment",
    equipmentTypes: ["Compact tractors", "Compact excavators", "Skid-steer loaders", "Compact track loaders", "Utility vehicles", "Utility tractors", "Zero-turn mowers"],
    popularModels: [
      { model: "SVL75", type: "Compact track loader" },
      { model: "SVL95", type: "Compact track loader" },
      { model: "KX040", type: "Compact excavator" },
      { model: "KX080", type: "Compact excavator" },
      { model: "U35", type: "Compact excavator" },
      { model: "U55", type: "Compact excavator" },
      { model: "B2601", type: "Compact tractor" },
      { model: "L3560", type: "Compact tractor" },
    ],
    popularPartsCategories: [
      { name: "Filters", examples: "Oil, fuel, hydraulic, cab air" },
      { name: "Engine components", examples: "Injectors, pumps, gaskets, belts" },
      { name: "Hydraulic system", examples: "Cylinders, pumps, valves, hoses" },
      { name: "Undercarriage & tracks", examples: "Rubber tracks, idlers, sprockets" },
      { name: "Drivetrain", examples: "Final drives, clutches, PTOs" },
      { name: "Tractor implements", examples: "3-point hitch components, loaders, mid-mount mower parts" },
      { name: "Electrical", examples: "Starters, alternators, sensors" },
      { name: "Cooling system", examples: "Radiators, thermostats, water pumps" },
    ],
    oemCatalogUrl: "https://www.kubotausa.com/parts",
    sourcingChallenges: [
      "Kubota-specific part numbers rarely cross-reference to Western brands, so fewer aftermarket options exist",
      "Tier 4 emissions components (DPF, DEF systems) are OEM-only in most cases",
      "Compact tractor parts often have long tail — older B-series machines can be hard to source for",
      "Kubota diesel engines are shared across many equipment categories, creating part overlap",
    ],
    oemVsAftermarket: {
      preferOem: "Tier 4 emissions parts (DPF, DEF systems), fuel injection components, and warranty-period machines.",
      aftermarketOk: "Filters, belts, tracks, and general wear parts — the aftermarket ecosystem for Kubota rubber tracks is especially mature.",
    },
    faq: [
      {
        question: "Where can I find the official Kubota parts catalog and diagrams?",
        answer: "Kubota's official parts catalog with exploded-view diagrams is available through the Kubota dealer portal and the Kubota USA website. Parts diagrams searchable by model and serial number are the authoritative reference. PartsIQ is not affiliated with Kubota — we source parts across verified supplier networks."
      },
      {
        question: "How do I read a Kubota parts diagram?",
        answer: "Kubota parts diagrams organize parts by assembly group — engine, hydraulics, drivetrain, etc. Each component is numbered with a callout that corresponds to a part number in the parts list. Start with the assembly group closest to your repair, then trace the callout number to the part number. For non-dealer sources, cross-reference the OEM part number to aftermarket equivalents before ordering."
      },
      {
        question: "Are Kubota aftermarket parts reliable?",
        answer: "Quality varies by category. Rubber tracks, filters, and belts have mature aftermarket options with good track records. Hydraulic and emissions components are higher risk outside OEM — Tier 4 emissions parts especially should come from the OEM or a dealer-authorized channel. Always verify cross-references and supplier reputation."
      },
      {
        question: "How does PartsIQ source Kubota parts?",
        answer: "PartsIQ is a parts procurement platform. We use AI to search supplier networks for Kubota parts — OEM dealers and aftermarket vendors — and our AI voice agent calls suppliers to collect quotes. For teams running mixed fleets (Kubota + Bobcat + other brands), that means one sourcing workflow instead of separate phone calls to each brand's dealer network."
      }
    ]
  },

  {
    slug: "wacker-neuson",
    name: "Wacker Neuson",
    legalName: "Wacker Neuson SE",
    primaryKeyword: "wacker neuson parts",
    secondaryKeywords: ["wacker neuson parts catalog", "wacker neuson excavator parts"],
    tagline: "Parts management and sourcing for Wacker Neuson compact construction and light equipment.",
    description: "Wacker Neuson is a German manufacturer of compact and light construction equipment — compact excavators, wheel loaders, dumpers, and an extensive line of light equipment including rammers, plates, and rollers. Their equipment is common in European-focused construction operations and North American specialty contractors.",
    category: "compact construction equipment",
    equipmentTypes: ["Compact excavators", "Compact wheel loaders", "Skid-steer loaders", "Track dumpers", "Light equipment (rammers, plates, rollers)", "Telehandlers"],
    popularModels: [
      { model: "EZ17", type: "Compact excavator (zero tail)" },
      { model: "EZ26", type: "Compact excavator" },
      { model: "EZ38", type: "Compact excavator" },
      { model: "ET65", type: "Compact excavator" },
      { model: "ET90", type: "Compact excavator" },
      { model: "DW100", type: "Wheel dumper" },
      { model: "DT15", type: "Track dumper" },
    ],
    popularPartsCategories: [
      { name: "Filters", examples: "Hydraulic, engine, fuel, air" },
      { name: "Hydraulic system", examples: "Pumps, cylinders, hoses, swing motors" },
      { name: "Undercarriage", examples: "Rubber tracks, idlers, sprockets" },
      { name: "Engine (Kohler, Yanmar, Perkins)", examples: "Injectors, belts, gaskets" },
      { name: "Electrical", examples: "Harnesses, sensors, displays" },
      { name: "Light equipment wear parts", examples: "Rammer shoes, plate bases, roller drums" },
    ],
    oemCatalogUrl: "https://www.wackerneuson.com/en/service/spare-parts/",
    sourcingChallenges: [
      "Parts supply for North American customers is concentrated through fewer dealers than large brands",
      "Engine parts vary by model year — Wacker Neuson sources engines from Kohler, Yanmar, and Perkins depending on model",
      "Older pre-2012 machines may require direct-from-Germany orders with longer lead times",
      "Light equipment (plates, rammers) wear parts rotate quickly and stockouts are common",
    ],
    oemVsAftermarket: {
      preferOem: "Hydraulic components, emissions-related parts, and warranty-period machines.",
      aftermarketOk: "Filters, rubber tracks, engine wear parts (since engines are sourced from third-party manufacturers with wider part availability), and light equipment consumables.",
    },
    faq: [
      {
        question: "Where can I find Wacker Neuson parts?",
        answer: "Wacker Neuson's official parts catalog is available through their dealer network and online at wackerneuson.com. For older or specialty parts, the dealer network is the primary channel. PartsIQ helps source across OEM dealers and aftermarket suppliers in one workflow, which can shorten lead times on hard-to-find parts."
      },
      {
        question: "Why is Wacker Neuson engine parts sourcing different?",
        answer: "Wacker Neuson uses engines from multiple manufacturers depending on the model year and equipment class — Kohler, Yanmar, and Perkins are the most common. That means engine parts are often available through those manufacturers' parallel networks, giving you more sourcing options than for fully-proprietary equipment."
      },
      {
        question: "Are there enough aftermarket options for Wacker Neuson parts?",
        answer: "The aftermarket for Wacker Neuson is smaller than for Bobcat or Kubota in North America, but rubber tracks, filters, and common wear parts have reliable aftermarket sources. Hydraulic and emissions components are best sourced OEM. Cross-reference any aftermarket part number against the original before ordering."
      },
      {
        question: "How does PartsIQ help with Wacker Neuson sourcing?",
        answer: "PartsIQ aggregates sourcing across your supplier network. For less common brands like Wacker Neuson, that means our AI voice agent can call multiple dealers and specialty vendors simultaneously — something that's particularly valuable when a single dealer is out of stock and you need a quick alternative."
      }
    ]
  },

  {
    slug: "yanmar",
    name: "Yanmar",
    legalName: "Yanmar Holdings Co., Ltd.",
    primaryKeyword: "yanmar parts",
    secondaryKeywords: ["yanmar parts catalog", "yanmar compact excavator parts", "yanmar engine parts"],
    tagline: "Parts management and sourcing for Yanmar compact construction equipment and industrial engines.",
    description: "Yanmar is a Japanese manufacturer best known for compact excavators, compact wheel loaders, and industrial diesel engines that power many other brands' equipment. Their ViO series compact excavators and SV series compact wheel loaders are widely used in construction, landscaping, and utility work.",
    category: "compact construction equipment",
    equipmentTypes: ["Compact excavators (ViO series)", "Compact wheel loaders", "Skid-steer loaders", "Industrial diesel engines", "Agricultural tractors"],
    popularModels: [
      { model: "ViO35", type: "Compact excavator (zero tail swing)" },
      { model: "ViO55", type: "Compact excavator" },
      { model: "ViO80", type: "Compact excavator" },
      { model: "SV100", type: "Compact excavator" },
      { model: "Vi15", type: "Compact excavator" },
      { model: "B3U", type: "Compact wheel loader" },
    ],
    popularPartsCategories: [
      { name: "Engine components (Yanmar diesel)", examples: "Injectors, pumps, belts, gaskets" },
      { name: "Filters", examples: "Oil, fuel, hydraulic, air" },
      { name: "Hydraulic system", examples: "Pumps, cylinders, hoses, valves" },
      { name: "Undercarriage", examples: "Rubber tracks, idlers, sprockets" },
      { name: "Cooling system", examples: "Radiators, thermostats, water pumps" },
      { name: "Electrical", examples: "Starters, alternators, sensors" },
    ],
    oemCatalogUrl: "https://www.yanmar.com/us/construction/parts-service/",
    sourcingChallenges: [
      "Yanmar engines power many other brands' equipment (John Deere compact tractors, some Vermeer models) — cross-referencing is common",
      "Smaller North American dealer footprint than Kubota or Bobcat",
      "Zero-tail-swing ViO excavators have unique hydraulic routing — aftermarket options narrower",
      "Part number format differs between Yanmar-branded parts and Yanmar engines installed in other brands",
    ],
    oemVsAftermarket: {
      preferOem: "Fuel injection and emissions components, hydraulic systems on ViO series, and warranty-period machines.",
      aftermarketOk: "Filters, belts, rubber tracks, and common engine wear parts — Yanmar's wide OEM installation base means aftermarket engine parts are often well-validated.",
    },
    faq: [
      {
        question: "Where can I find Yanmar parts?",
        answer: "Yanmar's official parts channel is through their dealer network (yanmar.com lists dealer locations). For Yanmar engines installed in other brands' equipment, parts are often available through both Yanmar directly and the host brand's dealer. PartsIQ's sourcing workflow covers both channels."
      },
      {
        question: "Can I use parts from other brands on Yanmar equipment?",
        answer: "For Yanmar engines — which appear in many non-Yanmar-branded machines — many engine parts are interchangeable across installations. For Yanmar-branded equipment specifically (ViO excavators, SV loaders), cross-compatibility is more limited and should be verified against the exact part number before substitution."
      },
      {
        question: "Why do Yanmar engines show up in other brands' equipment?",
        answer: "Yanmar is a major OEM diesel engine supplier to other equipment manufacturers — John Deere compact utility tractors, some Vermeer equipment, and others use Yanmar engines under their own branding. This means engine parts for a non-Yanmar machine may still be sourced as Yanmar parts, with broader availability than brand-exclusive parts."
      },
      {
        question: "How does PartsIQ help source Yanmar parts?",
        answer: "PartsIQ routes quote requests to your verified supplier network. For Yanmar, that typically means OEM dealers plus aftermarket suppliers. Our AI voice agent can handle the back-and-forth with multiple sources simultaneously, which is particularly useful when sourcing for older ViO series machines."
      }
    ]
  },

  {
    slug: "vermeer",
    name: "Vermeer",
    legalName: "Vermeer Corporation",
    primaryKeyword: "vermeer parts",
    secondaryKeywords: ["vermeer parts catalog", "vermeer chipper parts", "vermeer trencher parts"],
    tagline: "Parts management and sourcing for Vermeer underground construction, tree care, and environmental equipment.",
    description: "Vermeer is an American manufacturer specializing in underground construction equipment (directional drills, trenchers), tree care equipment (brush chippers, stump grinders), and environmental/recycling equipment. Their equipment is common in utility contracting, arborist operations, and agricultural baling.",
    category: "compact construction equipment",
    equipmentTypes: ["Directional drills", "Trenchers", "Brush chippers", "Stump grinders", "Horizontal grinders", "Round balers", "Vacuum excavators"],
    popularModels: [
      { model: "D8x12", type: "Navigator horizontal directional drill" },
      { model: "D24x40", type: "Navigator horizontal directional drill" },
      { model: "SC552", type: "Stump cutter" },
      { model: "SC852", type: "Stump cutter" },
      { model: "T558", type: "Trencher" },
      { model: "T655", type: "Trencher" },
      { model: "BC1000XL", type: "Brush chipper" },
    ],
    popularPartsCategories: [
      { name: "Cutting wheels & teeth (stump grinders)", examples: "Teeth, pockets, wheels" },
      { name: "Drilling components (directional drills)", examples: "Drill bits, stabilizers, swivels" },
      { name: "Trencher chains & teeth", examples: "Chain assemblies, teeth, sprockets" },
      { name: "Chipper knives & anvils", examples: "Blades, anvils, feed rollers" },
      { name: "Engine components", examples: "Filters, belts, cooling parts" },
      { name: "Hydraulic system", examples: "Pumps, cylinders, hoses" },
      { name: "Drivetrain", examples: "Final drives, tracks, undercarriage" },
    ],
    oemCatalogUrl: "https://www.vermeer.com/na/en-us/parts-service",
    sourcingChallenges: [
      "Vermeer equipment is highly application-specialized — each product line has distinct parts ecosystems",
      "Wear parts (cutting teeth, chipper knives, trencher chains) consume fast and frequent stockouts occur",
      "Specialty drilling components for the Navigator series often require factory-direct ordering",
      "Aftermarket knife and tooth suppliers exist but quality varies dramatically",
    ],
    oemVsAftermarket: {
      preferOem: "Directional drill components, hydraulic systems, and factory-warrantied machines.",
      aftermarketOk: "Stump grinder teeth, chipper knives, and trencher chain components — the wear parts market for these has many validated aftermarket suppliers.",
    },
    faq: [
      {
        question: "Where can I find Vermeer parts?",
        answer: "Vermeer operates a strong dealer network — find dealers and parts access via vermeer.com. For frequently-consumed wear parts (stump grinder teeth, chipper knives, trencher chains), aftermarket suppliers are common and many are validated. PartsIQ sources across both channels for procurement teams managing tree care or underground construction fleets."
      },
      {
        question: "How fast do Vermeer cutting teeth and chipper knives need replacement?",
        answer: "It depends on material conditions, but production tree care operations typically replace stump grinder teeth every 20-40 hours of cutting in mixed hardwood, and chipper knives every 4-8 hours of heavy use. Maintaining a parts inventory plan for these fast-wear components is often more cost-effective than emergency ordering. Our team has written guidance on parts inventory planning for high-consumption wear parts."
      },
      {
        question: "Can I use aftermarket teeth on a Vermeer stump grinder?",
        answer: "Yes — aftermarket stump grinder teeth are widely used and many are well-validated. The key considerations are tooth pattern (direct replacement vs upgraded profile), tooth hardness rating, and ensuring the tooth pocket is still OEM-spec. For teeth specifically, aftermarket is often the default choice in high-volume operations. For the tooth pockets themselves, OEM is generally preferred."
      },
      {
        question: "How does PartsIQ handle Vermeer parts sourcing?",
        answer: "PartsIQ is useful for Vermeer-heavy fleets where wear parts consume fast and sourcing windows are short. Our AI voice agent can simultaneously call OEM dealers and aftermarket suppliers to compare tooth, knife, and chain availability — which matters when a single dealer is out of stock and a job is waiting."
      }
    ]
  },

  {
    slug: "takeuchi",
    name: "Takeuchi",
    legalName: "Takeuchi Mfg. Co., Ltd.",
    primaryKeyword: "takeuchi parts",
    secondaryKeywords: ["takeuchi parts catalog", "takeuchi track loader parts", "takeuchi mini excavator parts"],
    tagline: "Parts management and sourcing for Takeuchi compact track loaders and compact excavators.",
    description: "Takeuchi is a Japanese manufacturer specializing in compact track loaders and compact excavators. They were the original inventor of the compact excavator in 1970 and continue to be a major player in the compact construction equipment market, particularly in the TL and TB series.",
    category: "compact construction equipment",
    equipmentTypes: ["Compact track loaders", "Compact excavators", "Wheel loaders", "Skid-steer loaders"],
    popularModels: [
      { model: "TL10", type: "Compact track loader" },
      { model: "TL12", type: "Compact track loader" },
      { model: "TL8", type: "Compact track loader" },
      { model: "TB230", type: "Compact excavator" },
      { model: "TB240", type: "Compact excavator" },
      { model: "TB260", type: "Compact excavator" },
      { model: "TB290", type: "Compact excavator" },
      { model: "TB216", type: "Mini excavator" },
    ],
    popularPartsCategories: [
      { name: "Rubber tracks", examples: "Replacement tracks for TL and TB series" },
      { name: "Undercarriage", examples: "Rollers, idlers, sprockets, track tensioners" },
      { name: "Hydraulic system", examples: "Pumps, cylinders, swing motors, hoses" },
      { name: "Filters", examples: "Hydraulic, oil, fuel, air, cab" },
      { name: "Engine components", examples: "Belts, gaskets, injectors" },
      { name: "Cab components", examples: "Windows, seats, control linkages" },
      { name: "Electrical", examples: "Sensors, displays, harnesses" },
    ],
    oemCatalogUrl: "https://www.takeuchi-us.com/parts",
    sourcingChallenges: [
      "Smaller North American dealer network than Bobcat or Kubota — lead times vary more by region",
      "Track loader undercarriage wear parts are high-volume but specific to Takeuchi dimensions",
      "Older machine parts (pre-2015) sometimes require direct factory orders",
      "Rubber track aftermarket is mature; hydraulic aftermarket is narrower",
    ],
    oemVsAftermarket: {
      preferOem: "Hydraulic pumps and motors, emissions components, and warranty-period machines.",
      aftermarketOk: "Rubber tracks, filters, and general undercarriage wear parts — the aftermarket ecosystem for Takeuchi rubber tracks is particularly strong.",
    },
    faq: [
      {
        question: "Where can I find Takeuchi parts?",
        answer: "Takeuchi's official parts channel is through their dealer network (takeuchi-us.com lists dealers). Aftermarket options are strongest for rubber tracks and filters. PartsIQ sources across both channels — particularly useful for fleets running Takeuchi alongside other compact equipment brands."
      },
      {
        question: "Are Takeuchi rubber tracks expensive?",
        answer: "OEM Takeuchi rubber tracks are priced in line with other Japanese compact equipment brands. Aftermarket tracks from validated suppliers are typically 30-40% cheaper and often meet or exceed OEM spec. For high-use fleets, aftermarket rubber tracks are a common cost-reduction move with low risk."
      },
      {
        question: "How do I identify the right Takeuchi part number?",
        answer: "Locate your machine's model and serial number on the VIN plate, then reference the Takeuchi parts catalog (through a dealer or takeuchi-us.com). For aftermarket sourcing, cross-reference the OEM part number against the supplier's compatibility listings before ordering — especially for hydraulic components where tolerances matter."
      },
      {
        question: "How does PartsIQ help with Takeuchi parts sourcing?",
        answer: "PartsIQ is particularly useful for mixed-fleet operations running Takeuchi alongside Bobcat, Kubota, or other compact brands. Our AI voice agent calls your supplier network in parallel, compares quotes side-by-side, and handles the sourcing workflow end-to-end. For Takeuchi specifically, that means faster quote turnaround when local dealer inventory is limited."
      }
    ]
  },

  {
    slug: "john-deere",
    name: "John Deere",
    legalName: "Deere & Company",
    primaryKeyword: "john deere parts",
    secondaryKeywords: ["deere parts", "john deere parts catalog", "deere parts catalog", "john deere parts online", "deere parts diagram"],
    tagline: "Parts management and sourcing for John Deere construction, agricultural, and compact equipment.",
    description: "John Deere (Deere & Company) is one of the world's largest manufacturers of agricultural, construction, and compact equipment. Their lineup spans row-crop and utility tractors, combines, excavators, backhoe loaders, wheel loaders, skid steers, compact track loaders, and compact utility tractors — deployed across farming, construction, forestry, and landscaping operations.",
    category: "heavy construction equipment",
    equipmentTypes: ["Agricultural tractors", "Compact utility tractors", "Combine harvesters", "Excavators", "Backhoe loaders", "Wheel loaders", "Skid-steer loaders", "Compact track loaders", "Crawler dozers", "Motor graders", "Forestry equipment"],
    popularModels: [
      { model: "310SL", type: "Backhoe loader" },
      { model: "410L", type: "Backhoe loader" },
      { model: "544L", type: "Wheel loader" },
      { model: "650L", type: "Crawler dozer" },
      { model: "850L", type: "Crawler dozer" },
      { model: "7R Series", type: "Row-crop tractor" },
      { model: "8R Series", type: "Row-crop tractor" },
      { model: "1025R", type: "Compact utility tractor" },
      { model: "2038R", type: "Compact utility tractor" },
      { model: "S780", type: "Combine harvester" },
    ],
    popularPartsCategories: [
      { name: "Filters", examples: "Engine oil, fuel, hydraulic, cab, air" },
      { name: "PowerTech engine components", examples: "Injectors, belts, gaskets, turbos" },
      { name: "Hydraulic system", examples: "Pumps, cylinders, valves, hoses" },
      { name: "Drivetrain & PTO", examples: "Final drives, transmissions, PTO assemblies" },
      { name: "Undercarriage (dozers & excavators)", examples: "Tracks, rollers, sprockets, idlers" },
      { name: "Tier 4 emissions", examples: "DEF pumps, DPF, SCR components" },
      { name: "Electrical & guidance", examples: "Starters, alternators, AutoTrac, CommandARM" },
      { name: "Ag implements & wear parts", examples: "Tillage points, planter meters, combine concaves" },
      { name: "Cab components", examples: "Seats, displays, HVAC, windows" },
    ],
    oemCatalogUrl: "https://www.deere.com/en/parts-and-service/",
    sourcingChallenges: [
      "John Deere's authorized dealer network holds strict control over pricing — dealer quote variation across geographies can be significant",
      "Tier 4 Final emissions components (DEF systems, DPF, SCR) are typically dealer-only with limited aftermarket alternatives",
      "AutoTrac, CommandCenter, and precision ag electronics are authorized-service-only",
      "PowerTech engine parts are broadly available aftermarket but warranty considerations apply",
      "Construction and agricultural product lines share many part numbers — cross-referencing between the two is common",
      "Pre-Tier-4 (pre-2014) machines have the strongest aftermarket ecosystem",
    ],
    oemVsAftermarket: {
      preferOem: "PowerTech engine internals, Tier 4 emissions systems, AutoTrac and precision ag electronics, transmission internals, and warranty-period machines.",
      aftermarketOk: "Filters, belts, hoses, hydraulic couplers, undercarriage components on dozers and excavators, combine concaves and threshing wear parts, tire and wheel assemblies, and common wear parts on pre-Tier-4 machines.",
    },
    faq: [
      {
        question: "Where can I find the official John Deere parts catalog?",
        answer: "The John Deere parts catalog is available through the Deere.com parts portal and through authorized dealers. You can search by model number and serial number to access exploded-view diagrams and current part numbers. PartsIQ is not affiliated with John Deere — we help source parts across both OEM dealer networks and verified aftermarket suppliers."
      },
      {
        question: "Can I cross-reference John Deere construction and agricultural parts?",
        answer: "Yes, for certain shared components — PowerTech engines, for example, appear across both ag tractors and construction equipment with overlapping part numbers. Hydraulic components, filters, and belts often cross-reference. Always verify the specific part number against your machine's serial number before ordering; compatibility is model-specific even when engine block is shared."
      },
      {
        question: "Are John Deere aftermarket parts reliable?",
        answer: "Quality varies by category. Filters, belts, and basic wear parts have mature aftermarket ecosystems with many validated suppliers. Tier 4 Final emissions components and AutoTrac electronics are riskier aftermarket plays — the diagnostic tools and software tie-ins are authorized-service-only. For PowerTech engine internals, aftermarket rebuilt components can be cost-effective on older machines outside warranty."
      },
      {
        question: "How does PartsIQ source John Deere parts?",
        answer: "PartsIQ aggregates sourcing across your verified supplier network. For John Deere, that means simultaneously contacting authorized dealers for OEM pricing and vetted aftermarket suppliers for cost-effective alternatives — all through a single workflow. Our AI voice agent can call multiple sources in parallel, which shortens quote turnaround especially when a dealer is back-ordered on common parts."
      }
    ]
  },

  {
    slug: "caterpillar",
    name: "Caterpillar",
    legalName: "Caterpillar Inc.",
    primaryKeyword: "caterpillar parts",
    secondaryKeywords: ["cat parts", "cat parts online", "caterpillar parts online", "caterpillar parts diagram", "cat parts diagram", "aftermarket cat parts", "cat parts catalog"],
    tagline: "Parts management and sourcing for Caterpillar (CAT) heavy construction, mining, and quarry equipment.",
    description: "Caterpillar Inc. is the world's largest manufacturer of heavy construction and mining equipment. The CAT lineup includes hydraulic excavators, wheel loaders, crawler dozers, motor graders, articulated trucks, and mining-scale equipment. CAT machines are the operational backbone of construction, quarrying, mining, forestry, and road-building operations worldwide.",
    category: "heavy construction equipment",
    equipmentTypes: ["Hydraulic excavators", "Wheel loaders", "Crawler dozers", "Motor graders", "Articulated trucks", "Compact track loaders", "Skid-steer loaders", "Backhoe loaders", "Telehandlers", "Mining trucks & shovels"],
    popularModels: [
      { model: "320", type: "Hydraulic excavator" },
      { model: "336", type: "Hydraulic excavator" },
      { model: "312", type: "Hydraulic excavator" },
      { model: "349", type: "Hydraulic excavator" },
      { model: "950", type: "Wheel loader" },
      { model: "966", type: "Wheel loader" },
      { model: "D6", type: "Crawler dozer" },
      { model: "D8", type: "Crawler dozer" },
      { model: "140", type: "Motor grader" },
      { model: "730", type: "Articulated truck" },
      { model: "259D3", type: "Compact track loader" },
    ],
    popularPartsCategories: [
      { name: "Filters (CAT Advanced Efficiency)", examples: "Engine oil, fuel, hydraulic, cab, air" },
      { name: "Hydraulic system", examples: "Main pumps, cylinders, swing motors, hoses" },
      { name: "Undercarriage (dozers & excavators)", examples: "Tracks, shoes, rollers, idlers, sprockets" },
      { name: "Ground Engaging Tools (GET)", examples: "Bucket teeth, cutting edges, tips, adapters" },
      { name: "C-series engine components", examples: "Injectors, turbos, belts, gaskets" },
      { name: "Drivetrain", examples: "Transmissions, final drives, torque converters" },
      { name: "Electrical & sensors", examples: "ECMs, sensors, wiring, starters" },
      { name: "Cooling system", examples: "Radiators, oil coolers, fans" },
      { name: "Cat Reman (remanufactured)", examples: "Engines, pumps, turbos — OEM-quality at reduced cost" },
    ],
    oemCatalogUrl: "https://parts.cat.com/en/catcorp",
    sourcingChallenges: [
      "CAT dealer network pricing is premium — cost management is a recurring procurement challenge",
      "Reman parts (CAT Reman program) offer OEM-quality at lower cost but have unique CR/CU part number prefixes that require explicit callout",
      "Undercarriage components are high-wear and account for a disproportionate share of operating cost",
      "Tier 4 Final emissions components (aftertreatment, DEF systems) are typically dealer-only",
      "The 'cat parts' search keyword is ambiguous with pet products, so buyers often use 'caterpillar parts' in catalogs and searches",
      "Ground Engaging Tools (GET) are the most replaced wear parts in the CAT ecosystem — inventory planning is critical",
    ],
    oemVsAftermarket: {
      preferOem: "CAT C-series engine internals, electronic control modules, Tier 4 emissions systems, hydraulic main pumps, swing motors, and warranty-period machines. Cat Reman is an OEM-quality alternative at lower cost for many rebuilt components.",
      aftermarketOk: "Filters, Ground Engaging Tools (teeth, cutting edges, tips), undercarriage pads and links, hoses, belts, and general wear parts. The CAT aftermarket ecosystem is mature with many validated suppliers.",
    },
    faq: [
      {
        question: "Where can I find the official Caterpillar (CAT) parts catalog?",
        answer: "The Caterpillar parts catalog is available at parts.cat.com and through authorized CAT dealers. You can search by model, serial number, or part number for current OEM parts and exploded-view diagrams. PartsIQ is not affiliated with Caterpillar Inc. — we help source parts across CAT dealers, the CAT Reman program, and verified aftermarket suppliers."
      },
      {
        question: "What is CAT Reman and should I use it?",
        answer: "CAT Reman is Caterpillar's factory-remanufactured parts program — rebuilt OEM components (engines, pumps, turbos) that meet OEM specifications at a lower price point than new OEM parts. Reman parts carry a 'CR' or 'CU' prefix on the part number. For many rebuild scenarios, CAT Reman offers the best balance of reliability and cost. It's considered OEM for warranty purposes on most machines."
      },
      {
        question: "Are CAT aftermarket parts reliable?",
        answer: "Quality varies significantly by category. Filters, Ground Engaging Tools, and undercarriage wear parts have mature aftermarket ecosystems with many validated suppliers. Electronic control modules, Tier 4 emissions components, and hydraulic main pumps are higher risk outside OEM or CAT Reman. For CAT specifically, 'aftermarket' covers a wide quality spectrum — verify supplier reputation before ordering critical components."
      },
      {
        question: "How does PartsIQ source Caterpillar parts?",
        answer: "PartsIQ aggregates sourcing across OEM dealers, the CAT Reman program, and aftermarket suppliers in one workflow. Our AI voice agent can call multiple CAT dealers in parallel to collect quotes and compare pricing side-by-side with Reman and aftermarket alternatives. For teams running CAT-heavy fleets, that shortens sourcing cycles on the most common parts (undercarriage, GET, filters) where price variation across sources is significant."
      }
    ]
  },

  {
    slug: "new-holland",
    name: "New Holland",
    legalName: "CNH Industrial N.V. (New Holland brand)",
    primaryKeyword: "new holland parts",
    secondaryKeywords: ["new holland tractor parts", "new holland agriculture parts"],
    tagline: "Parts management and sourcing for New Holland agricultural and construction equipment.",
    description: "New Holland is a brand of CNH Industrial, producing a wide range of agricultural and construction equipment. The agricultural lineup — tractors, combines, balers, and hay tools — is particularly strong in North America. The construction lineup includes skid steers, compact track loaders, and compact excavators. Part numbers and supply chains are shared in many cases with sister brand Case.",
    category: "agricultural equipment",
    equipmentTypes: ["Agricultural tractors", "Compact tractors", "Combine harvesters", "Round & square balers", "Hay tools", "Skid-steer loaders", "Compact track loaders", "Compact excavators", "Telehandlers"],
    popularModels: [
      { model: "Workmaster 25S", type: "Compact utility tractor" },
      { model: "Workmaster 75", type: "Utility tractor" },
      { model: "T5 Series", type: "Utility tractor" },
      { model: "T6 Series", type: "Mid-range tractor" },
      { model: "T7 Series", type: "High-horsepower tractor" },
      { model: "BC5050", type: "Small square baler" },
      { model: "RB560", type: "Round baler" },
      { model: "L220", type: "Skid-steer loader" },
      { model: "C227", type: "Compact track loader" },
    ],
    popularPartsCategories: [
      { name: "Filters", examples: "Engine oil, fuel, hydraulic, cab, air" },
      { name: "FPT engine components", examples: "Injectors, gaskets, belts — shared across CNH brands" },
      { name: "Hydraulic system", examples: "Pumps, cylinders, valves, hoses" },
      { name: "Driveline & PTO", examples: "Clutches, transmissions, PTO shafts" },
      { name: "Hay tool wear parts", examples: "Knotters, pickup teeth, roller chains, twine arms" },
      { name: "Cab & electronics", examples: "Displays, HVAC, precision ag components" },
      { name: "Loader & implement parts", examples: "3-point hitch, front loader attachments, bucket wear" },
    ],
    oemCatalogUrl: "https://parts.cnh.com/",
    sourcingChallenges: [
      "Part numbers are shared across CNH brands (Case IH, New Holland, Steyr) — cross-referencing to Case equivalents is common",
      "FPT (Fiat Powertrain Technologies) engines power many CNH models — engine parts have wider availability than brand-exclusive parts",
      "Baler and hay tool wear parts are fast-consuming and stockouts are common during harvest season",
      "Older Ford-branded New Holland tractors (pre-1999) require specialty dealers or long-tail aftermarket suppliers",
      "North American dealer density for New Holland agriculture is strong, but construction equipment support is narrower",
    ],
    oemVsAftermarket: {
      preferOem: "FPT engine internals, Tier 4 Final emissions systems, precision ag electronics (IntelliView, PLM), transmission internals, and warranty-period machines.",
      aftermarketOk: "Filters, hay tool wear parts (knotters, pickup teeth), hoses, belts, hydraulic couplers, tire assemblies, and common wear parts on older machines. The aftermarket for New Holland balers and hay tools is especially mature.",
    },
    faq: [
      {
        question: "Where can I find the official New Holland parts catalog?",
        answer: "The New Holland parts catalog is available through CNH Industrial's parts portal (parts.cnh.com) and through authorized dealers. You can search by model and serial number for current parts and diagrams. Many part numbers cross-reference to Case IH due to shared CNH manufacturing — a useful sourcing detail. PartsIQ is not affiliated with CNH Industrial."
      },
      {
        question: "Can I use Case IH parts on New Holland equipment?",
        answer: "Frequently yes — CNH Industrial shares many components across Case IH and New Holland brands, especially FPT engine parts, hydraulic components, and driveline parts. Always verify the specific part number against your machine's serial number. For some models the paint color and decals differ while the underlying part is identical. PartsIQ's AI parts search handles this cross-referencing automatically."
      },
      {
        question: "Why are New Holland baler parts so commonly out of stock?",
        answer: "Hay tool wear parts — particularly knotter components, pickup teeth, and roller chain — have extremely high seasonal demand and fast consumption rates. Stockouts are common during hay season when operations are running balers 10-14 hours a day. Planning inventory ahead of season, and maintaining backup aftermarket suppliers, is a common mitigation for baler-heavy operations."
      },
      {
        question: "How does PartsIQ handle New Holland parts sourcing?",
        answer: "PartsIQ is particularly useful for CNH-heavy operations where part numbers cross-reference between New Holland and Case IH. Our AI parts search identifies cross-brand equivalents automatically, and our voice agent can call both New Holland and Case IH dealers in parallel when availability is tight. For baler and hay tool parts specifically, pre-season quote workflows save significant time during harvest."
      }
    ]
  },

  {
    slug: "case-ce",
    name: "Case Construction",
    legalName: "CNH Industrial N.V. (Case Construction Equipment brand)",
    primaryKeyword: "case parts",
    secondaryKeywords: ["case construction parts", "case backhoe parts", "case 580 parts"],
    tagline: "Parts management and sourcing for Case Construction Equipment — including the iconic Case 580 backhoe loader lineage.",
    description: "Case Construction Equipment (Case CE), a brand of CNH Industrial, is the longtime North American leader in backhoe loaders — the Case 580 series is one of the most iconic construction machines ever built, with over 50 years of continuous production. Case CE also manufactures excavators, wheel loaders, crawler dozers, skid steers, and motor graders for construction and utility markets.",
    category: "heavy construction equipment",
    equipmentTypes: ["Backhoe loaders", "Excavators", "Wheel loaders", "Crawler dozers", "Skid-steer loaders", "Compact track loaders", "Motor graders"],
    popularModels: [
      { model: "580 Super N", type: "Backhoe loader" },
      { model: "580 Super M", type: "Backhoe loader (legacy)" },
      { model: "590 Super N", type: "Backhoe loader" },
      { model: "521G", type: "Wheel loader" },
      { model: "621G", type: "Wheel loader" },
      { model: "CX210D", type: "Hydraulic excavator" },
      { model: "CX145D SR", type: "Compact radius excavator" },
      { model: "SR270", type: "Skid-steer loader" },
      { model: "850M", type: "Crawler dozer" },
    ],
    popularPartsCategories: [
      { name: "Filters", examples: "Engine oil, fuel, hydraulic, cab, air" },
      { name: "FPT engine components", examples: "Injectors, gaskets, belts (shared with New Holland)" },
      { name: "Hydraulic system", examples: "Main pumps, cylinders, valves, hoses" },
      { name: "Backhoe-specific", examples: "Boom, dipper, stabilizers, swing bushings" },
      { name: "Drivetrain", examples: "Transmissions, final drives, axles" },
      { name: "Undercarriage (dozers & excavators)", examples: "Tracks, rollers, sprockets" },
      { name: "Electrical", examples: "Starters, alternators, sensors, control modules" },
      { name: "Cab & controls", examples: "Joysticks, seats, HVAC, displays" },
    ],
    oemCatalogUrl: "https://www.casece.com/parts-and-service/",
    sourcingChallenges: [
      "The Case 580 backhoe spans 50+ years of production — part number variations across generations (Super E, M, N, G) are substantial",
      "CNH parts catalog is shared with New Holland — many parts cross-reference between the two brands",
      "Aftermarket for the 580 backhoe is mature due to the massive installed base, especially for older pre-2010 units",
      "FPT engine parts have wide availability across CNH models",
      "Pre-Tier-4 machines (pre-2014) have the strongest aftermarket ecosystem; Tier 4 Final emissions parts are typically dealer-only",
    ],
    oemVsAftermarket: {
      preferOem: "FPT engine internals, Tier 4 emissions systems, transmission components, and warranty-period machines.",
      aftermarketOk: "Filters, hydraulic components for 580 backhoes (mature aftermarket), common wear parts, hoses, belts, and undercarriage components. The aftermarket for Case 580 backhoe boom and dipper components is particularly well-developed.",
    },
    faq: [
      {
        question: "Where can I find the official Case CE parts catalog?",
        answer: "The Case CE parts catalog is available through CNH Industrial's parts portal and through authorized Case dealers. You can search by model and serial number — especially important for 580 backhoe parts where generation (Super E / M / N / G) affects part compatibility. PartsIQ is not affiliated with CNH Industrial."
      },
      {
        question: "How do I identify which Case 580 generation I have?",
        answer: "The Case 580 has evolved through several generations: Super E (1990s), Super L, Super M, Super N, and current G-series (Super N and later). Your machine's serial number tag identifies the exact model generation. Parts lookups must use the correct generation — many components are not interchangeable across generations despite similar part names."
      },
      {
        question: "Can I use New Holland parts on Case CE equipment?",
        answer: "Yes for many components — CNH Industrial shares parts across Case CE, Case IH, and New Holland. FPT engine parts, hydraulic components, and many driveline parts cross-reference. Always verify the specific part number against your machine's serial number, particularly for sub-assemblies where the base part is shared but mounting or configuration differs."
      },
      {
        question: "How does PartsIQ source Case CE parts?",
        answer: "PartsIQ aggregates sourcing across Case dealers, New Holland dealers (for shared parts), and the large Case 580 aftermarket ecosystem. Our AI parts search handles the 580 generation cross-referencing automatically, and our voice agent calls multiple dealers and aftermarket suppliers in parallel. Particularly useful for older 580 backhoes where parts availability varies widely across channels."
      }
    ]
  },

  {
    slug: "komatsu",
    name: "Komatsu",
    legalName: "Komatsu Ltd.",
    primaryKeyword: "komatsu parts",
    secondaryKeywords: ["komatsu parts catalog", "komatsu parts online"],
    tagline: "Parts management and sourcing for Komatsu heavy construction, mining, and quarry equipment.",
    description: "Komatsu Ltd. is a Japanese heavy equipment manufacturer — the world's second-largest after Caterpillar. Their lineup spans hydraulic excavators, wheel loaders, crawler dozers, articulated trucks, and mining-scale haul trucks. Komatsu equipment is particularly prevalent in mining, quarrying, and heavy civil construction operations.",
    category: "heavy construction equipment",
    equipmentTypes: ["Hydraulic excavators", "Wheel loaders", "Crawler dozers", "Articulated trucks", "Rigid-frame haul trucks", "Motor graders", "Mining shovels & trucks"],
    popularModels: [
      { model: "PC200", type: "Hydraulic excavator" },
      { model: "PC210", type: "Hydraulic excavator" },
      { model: "PC290", type: "Hydraulic excavator" },
      { model: "PC360", type: "Hydraulic excavator" },
      { model: "WA320", type: "Wheel loader" },
      { model: "WA380", type: "Wheel loader" },
      { model: "D65", type: "Crawler dozer" },
      { model: "D155", type: "Crawler dozer" },
      { model: "HM300", type: "Articulated truck" },
    ],
    popularPartsCategories: [
      { name: "Filters", examples: "Engine oil, fuel, hydraulic, air" },
      { name: "SAA-series engine components", examples: "Injectors, turbos, belts, gaskets" },
      { name: "Hydraulic system (HydrauMind)", examples: "Main pumps, cylinders, swing motors" },
      { name: "Undercarriage", examples: "Tracks, rollers, sprockets, idlers" },
      { name: "Final drives", examples: "Travel motors, reduction gears" },
      { name: "Electrical & KOMTRAX", examples: "Sensors, ECMs, telematics modules" },
      { name: "Komatsu Reman", examples: "Remanufactured engines, pumps, turbos" },
      { name: "GET wear parts", examples: "Bucket teeth, cutting edges, adapters" },
    ],
    oemCatalogUrl: "https://www.komatsu.com/en/parts-and-service/",
    sourcingChallenges: [
      "Komatsu SAA-series engines have unique diagnostic tools — aftermarket support is narrower for engine internals than for CAT equivalents",
      "Komatsu Reman program competes with OEM — similar to CAT Reman, rebuilt components at reduced cost",
      "Undercarriage is high-wear and high-volume, especially on mining-scale dozers and excavators",
      "Tier 4 Final emissions components typically dealer-only",
      "Pre-Tier-4 Komatsu machines have a mature aftermarket ecosystem, especially for PC-series excavators",
      "KOMTRAX telematics modules are proprietary — servicing is authorized-dealer-only",
    ],
    oemVsAftermarket: {
      preferOem: "SAA engine internals, KOMTRAX telematics, Tier 4 emissions systems, HPV-series hydraulic main pumps, swing motors, and warranty-period machines. Komatsu Reman offers OEM-quality at reduced cost for many rebuilt components.",
      aftermarketOk: "Filters, undercarriage components (the Komatsu undercarriage aftermarket is particularly mature), Ground Engaging Tools, hoses, belts, and general wear parts on pre-Tier-4 machines.",
    },
    faq: [
      {
        question: "Where can I find the official Komatsu parts catalog?",
        answer: "The Komatsu parts catalog is available through komatsu.com and authorized dealers. You can search by model and serial number for current parts and diagrams. Komatsu part numbers are globally standardized, though regional availability and pricing vary. PartsIQ is not affiliated with Komatsu Ltd."
      },
      {
        question: "What is Komatsu Reman and how does it compare to OEM?",
        answer: "Komatsu Reman is Komatsu's factory-remanufactured parts program — rebuilt OEM components (engines, pumps, turbos) that meet OEM specifications at reduced cost. For most rebuild scenarios, Reman offers an excellent balance of reliability and price. Reman parts carry the OEM quality warranty and are considered OEM for most service purposes."
      },
      {
        question: "Are Komatsu aftermarket parts reliable?",
        answer: "Quality varies by category. Filters and undercarriage components have mature, validated aftermarket ecosystems. GET (Ground Engaging Tools) aftermarket is well-developed. Hydraulic main pumps, electronic control modules, and Tier 4 emissions parts are higher risk outside OEM or Komatsu Reman — verify supplier reputation carefully before ordering critical components."
      },
      {
        question: "How does PartsIQ source Komatsu parts?",
        answer: "PartsIQ aggregates sourcing across Komatsu dealers, the Komatsu Reman program, and aftermarket suppliers in one workflow. Our AI voice agent can call multiple dealers simultaneously to compare OEM, Reman, and aftermarket pricing — particularly valuable for undercarriage and wear parts where variation across sources is significant."
      }
    ]
  },

  {
    slug: "jcb",
    name: "JCB",
    legalName: "J.C. Bamford Excavators Limited",
    primaryKeyword: "jcb parts",
    secondaryKeywords: ["jcb backhoe parts", "jcb 3cx parts", "jcb telehandler parts"],
    tagline: "Parts management and sourcing for JCB backhoe loaders, telehandlers, and construction equipment.",
    description: "JCB is a British manufacturer best known for backhoe loaders — particularly the iconic 3CX — and telehandlers, where JCB is the global market leader. They also produce excavators, wheel loaders, skid steers, and agricultural machinery (Fastrac). JCB has strong European market share and a growing North American presence, especially in telehandler and compact equipment categories.",
    category: "heavy construction equipment",
    equipmentTypes: ["Backhoe loaders", "Telehandlers", "Hydraulic excavators", "Wheel loaders", "Skid-steer loaders", "Compact track loaders", "Compact excavators", "Fastrac agricultural tractors"],
    popularModels: [
      { model: "3CX", type: "Backhoe loader (iconic)" },
      { model: "4CX", type: "Backhoe loader" },
      { model: "1CX", type: "Compact backhoe" },
      { model: "540-170", type: "Telehandler" },
      { model: "537-135", type: "Telehandler" },
      { model: "220X", type: "Hydraulic excavator" },
      { model: "403", type: "Compact wheel loader" },
      { model: "270T", type: "Compact track loader" },
    ],
    popularPartsCategories: [
      { name: "Filters", examples: "Engine oil, fuel, hydraulic, air" },
      { name: "JCB Dieselmax / EcoMAX engine", examples: "Injectors, turbos, belts, gaskets" },
      { name: "Hydraulic system", examples: "Main pumps, cylinders, hoses, valves" },
      { name: "Backhoe components (3CX)", examples: "Boom, dipper, stabilizers, swing bushings" },
      { name: "Telehandler components", examples: "Boom sections, chains, hydraulic cylinders" },
      { name: "Drivetrain", examples: "Transmissions, final drives, axles" },
      { name: "Cab & controls", examples: "Joysticks, seats, displays" },
    ],
    oemCatalogUrl: "https://www.jcb.com/en-us/parts-and-service",
    sourcingChallenges: [
      "Smaller North American dealer footprint than Case, CAT, or Deere — parts availability varies regionally",
      "Telehandler parts are specialized and less cross-compatible with other equipment categories",
      "JCB 3CX backhoe has long production lineage — pre-EcoMAX engines used Perkins, current models use JCB Dieselmax/EcoMAX — engine parts differ significantly across eras",
      "The 3CX aftermarket is stronger in European markets than North American",
      "Tier 4 Final emissions components are typically dealer-only",
    ],
    oemVsAftermarket: {
      preferOem: "JCB Dieselmax/EcoMAX engine internals, Tier 4 emissions systems, telehandler boom components (high-precision), hydraulic main pumps, and warranty-period machines.",
      aftermarketOk: "Filters, hoses, belts, 3CX backhoe wear parts (boom bushings, pins, cutting edges), bearings, and common wear parts. Older Perkins-era JCB engines have wide aftermarket parts availability.",
    },
    faq: [
      {
        question: "Where can I find JCB parts in North America?",
        answer: "JCB's North American parts access is through authorized dealers (find them via jcb.com). Because JCB's NA dealer footprint is smaller than Case or Deere, longer lead times on specialty parts are common. PartsIQ helps by sourcing across the full JCB dealer network plus validated aftermarket suppliers in parallel, which shortens lead times when a single dealer is back-ordered."
      },
      {
        question: "What's the difference between Perkins-era and JCB EcoMAX engines?",
        answer: "Pre-2010 JCB machines typically used Perkins engines (e.g., 1004, 1106 series). Since 2010, JCB has transitioned to its own JCB Dieselmax and EcoMAX engines. Engine parts are not interchangeable between the two — and part availability differs significantly. Perkins-era engines have wider aftermarket availability; EcoMAX engines are primarily dealer-supplied."
      },
      {
        question: "Is the JCB 3CX aftermarket reliable?",
        answer: "For mechanical wear parts — boom bushings, pins, hydraulic cylinders, filters — the 3CX aftermarket is reasonable, particularly for older pre-2010 models where the installed base is large. For engine internals (especially EcoMAX), electronics, and Tier 4 emissions, OEM is strongly preferred. Always verify part number cross-references against your specific 3CX generation."
      },
      {
        question: "How does PartsIQ help with JCB parts sourcing?",
        answer: "PartsIQ is particularly useful for JCB operations in North America where dealer density is lower. Our AI voice agent calls multiple JCB dealers simultaneously (across regions if needed) and aftermarket suppliers, which can significantly shorten lead times when a single dealer is out of stock. For 3CX-heavy fleets, that's often the difference between a same-week repair and a multi-week wait."
      }
    ]
  },

  {
    slug: "hitachi",
    name: "Hitachi",
    legalName: "Hitachi Construction Machinery Co., Ltd.",
    primaryKeyword: "hitachi parts",
    secondaryKeywords: ["hitachi construction parts", "hitachi excavator parts"],
    tagline: "Parts management and sourcing for Hitachi construction machinery — primarily hydraulic excavators and wheel loaders.",
    description: "Hitachi Construction Machinery is a Japanese manufacturer specializing in hydraulic excavators — from compact to mining-scale. They also produce wheel loaders and articulated dump trucks, though hydraulic excavators (the ZX-series) are their flagship product category. Hitachi equipment is widely deployed in construction, mining, forestry, and heavy civil operations.",
    category: "heavy construction equipment",
    equipmentTypes: ["Hydraulic excavators", "Wheel loaders", "Articulated dump trucks", "Mining excavators", "Compact excavators"],
    popularModels: [
      { model: "ZX210", type: "Hydraulic excavator" },
      { model: "ZX350", type: "Hydraulic excavator" },
      { model: "ZX450", type: "Hydraulic excavator" },
      { model: "ZX870", type: "Large hydraulic excavator" },
      { model: "ZW140", type: "Wheel loader" },
      { model: "ZW220", type: "Wheel loader" },
      { model: "ZX17U", type: "Compact excavator" },
    ],
    popularPartsCategories: [
      { name: "Filters", examples: "Hydraulic, engine oil, fuel, air" },
      { name: "Hitachi engine components", examples: "Isuzu-sourced diesel components, belts, gaskets" },
      { name: "Hydraulic system (HPV pumps)", examples: "Main pumps, swing motors, cylinders" },
      { name: "Undercarriage", examples: "Tracks, rollers, sprockets, idlers" },
      { name: "Swing system", examples: "Swing bearings, swing motors, reduction gears" },
      { name: "Boom & attachment", examples: "Boom, dipper, bucket, hydraulic lines" },
      { name: "Electrical & ECM", examples: "Hitachi proprietary electronics, sensors" },
    ],
    oemCatalogUrl: "https://www.hitachicm.com/global/en/parts/",
    sourcingChallenges: [
      "Hitachi's North American dealer network is smaller than Komatsu or CAT — parts lead times can be longer for specialty components",
      "Hitachi hydraulic HPV-series pumps are high-precision and typically OEM-only",
      "Isuzu engines (used in many Hitachi excavators) have broader aftermarket parts availability than other Hitachi-exclusive components",
      "John Deere previously manufactured Hitachi excavators under license in North America (before 2022) — this creates cross-reference opportunities for older ZX-series machines",
      "Older pre-2015 machines have longer parts lead times; current production models are better supported",
    ],
    oemVsAftermarket: {
      preferOem: "HPV-series hydraulic main pumps, swing motors, Hitachi proprietary electronics and ECMs, Tier 4 Final emissions systems, and warranty-period machines.",
      aftermarketOk: "Filters, undercarriage components (tracks, rollers, sprockets), Isuzu engine wear parts (since Isuzu sells these broadly), buckets and attachments, hoses, belts, and common wear parts.",
    },
    faq: [
      {
        question: "Where can I find Hitachi construction parts?",
        answer: "Hitachi's official parts channel is through authorized dealers — find dealers via hitachicm.com. For older ZX-series excavators, many parts cross-reference to John Deere since John Deere previously manufactured Hitachi excavators under license in North America. PartsIQ sources across both channels simultaneously, which can shorten lead times on older machines."
      },
      {
        question: "Can I use John Deere parts on older Hitachi excavators?",
        answer: "For older Hitachi ZX-series excavators manufactured before 2022 (when the Deere-Hitachi license arrangement ended in North America), many parts cross-reference between the two brands. Engine, hydraulic, and wear parts are often interchangeable. Always verify the specific part number against your serial number. Newer post-2022 Hitachi machines no longer share this cross-compatibility — parts must come from Hitachi channels."
      },
      {
        question: "Are Hitachi aftermarket parts reliable?",
        answer: "For filters and undercarriage, aftermarket is well-developed. For Isuzu engine parts, aftermarket availability is broad (since Isuzu sells engine parts widely beyond Hitachi installations). Hydraulic HPV pumps, swing motors, and proprietary electronics are higher risk outside OEM — the precision and engineering tolerances on these components are specific to Hitachi."
      },
      {
        question: "How does PartsIQ source Hitachi parts?",
        answer: "PartsIQ aggregates across Hitachi dealers, John Deere dealers (for older ZX-series cross-references), Isuzu engine parts suppliers, and aftermarket channels. For Hitachi operations in North America where dealer density is lower, that multi-channel approach significantly shortens sourcing cycles — especially on undercarriage and common wear parts."
      }
    ]
  }
]

export function getBrand(slug: string): BrandEntry | undefined {
  return BRANDS.find((b) => b.slug === slug)
}

export function getAllBrandSlugs(): string[] {
  return BRANDS.map((b) => b.slug)
}
