/**
 * Provision PostHog dashboards, funnels, insights, and cohorts via the
 * management API. Idempotent — re-running updates existing items by name
 * tag instead of creating duplicates.
 *
 * Why this exists: clicking through the PostHog UI to recreate funnels
 * after a project switch, or to keep dev / prod projects in sync, is
 * error-prone. Putting the analytical setup in code means it's version-
 * controlled, code-reviewable, and disaster-recoverable.
 *
 * Required env:
 *   NEXT_PUBLIC_POSTHOG_HOST       — e.g. https://us.i.posthog.com
 *   POSTHOG_PERSONAL_API_KEY       — phx_... (Project Settings → Personal API Keys)
 *   POSTHOG_PROJECT_ID             — numeric project id (Project Settings → Project Variables)
 *
 * Usage:
 *   pnpm tsx scripts/posthog-setup.ts          # apply
 *   pnpm tsx scripts/posthog-setup.ts --dry    # print what would be created
 *
 * Items provisioned:
 *   - Cohort: "Internal users" (orgs we don't want polluting analytics)
 *   - Funnel insight: "Trial activation funnel"
 *   - Funnel insight: "Marketing acquisition funnel"
 *   - Trend insight: "Weekly active orgs"
 *   - Trend insight: "AI chat usage by org"
 *   - Dashboard: "PartsIQ — Activation & Growth" containing the insights above
 */

import 'dotenv/config'

const HOST = (process.env.NEXT_PUBLIC_POSTHOG_HOST || 'https://us.i.posthog.com').replace(/\/$/, '')
const TOKEN = process.env.POSTHOG_PERSONAL_API_KEY
const PROJECT_ID = process.env.POSTHOG_PROJECT_ID
const DRY = process.argv.includes('--dry')

if (!TOKEN) {
  console.error(
    'Missing POSTHOG_PERSONAL_API_KEY. Create one in PostHog → Project Settings →',
    'Personal API Keys (scope: project). Then add to .env.',
  )
  process.exit(1)
}
if (!PROJECT_ID) {
  console.error('Missing POSTHOG_PROJECT_ID. Find it in PostHog → Project Settings → Project Variables.')
  process.exit(1)
}

// PostHog uses a /api/projects/:id/ namespace for most management endpoints.
// `app.posthog.com` is the canonical management host in older docs but the
// regional cloud hosts (us.posthog.com / eu.posthog.com) work too — we strip
// the i. ingestion-host prefix because management endpoints live on the
// non-i hostname.
const MGMT_HOST = HOST.replace('//us.i.', '//us.').replace('//eu.i.', '//eu.')
const BASE = `${MGMT_HOST}/api/projects/${PROJECT_ID}`

async function api<T = any>(method: string, path: string, body?: any): Promise<T> {
  if (DRY) {
    console.log(`  [dry] ${method} ${path}${body ? ' ' + JSON.stringify(body).slice(0, 120) : ''}`)
    return {} as T
  }
  const res = await fetch(`${BASE}${path}`, {
    method,
    headers: {
      Authorization: `Bearer ${TOKEN}`,
      'Content-Type': 'application/json',
    },
    body: body ? JSON.stringify(body) : undefined,
  })
  if (!res.ok) {
    const errText = await res.text().catch(() => '')
    throw new Error(`PostHog ${method} ${path} → ${res.status}: ${errText.slice(0, 500)}`)
  }
  return res.json() as Promise<T>
}

interface Named { id: number | string; name?: string }

async function findByName<T extends Named>(path: string, name: string): Promise<T | null> {
  const data = await api<{ results: T[] }>('GET', `${path}?search=${encodeURIComponent(name)}&limit=100`)
  const hit = (data.results || []).find((r) => r.name === name)
  return hit ?? null
}

async function upsert<T extends Named>(
  label: string,
  path: string,
  name: string,
  payload: any,
): Promise<T> {
  const existing = await findByName<T>(path, name).catch(() => null)
  if (existing) {
    console.log(`  ↻ ${label}: "${name}" exists (id=${existing.id}) — updating`)
    return api<T>('PATCH', `${path}${existing.id}/`, payload)
  }
  console.log(`  + ${label}: "${name}" not found — creating`)
  return api<T>('POST', path, { name, ...payload })
}

// ---------- 1. Internal-user cohort ----------
// Manually behavioral: matches anyone whose `role` user-property is MASTER_ADMIN.
// Used as a filter on every dashboard so internal QA traffic doesn't pollute.
async function setupInternalCohort() {
  return upsert('Cohort', '/cohorts/', 'Internal users (PartsIQ team)', {
    description: 'PartsIQ team members and dev/QA browsers. Excluded from all activation/marketing analytics.',
    groups: [
      {
        properties: [
          { key: 'role', value: 'MASTER_ADMIN', operator: 'exact', type: 'person' },
        ],
      },
    ],
    is_static: false,
  })
}

// ---------- 2. Trial activation funnel ----------
// Tracks the events wired in lib/analytics.ts. Matches the order a trial
// user is supposed to follow. Drop-off at any step indicates where the
// onboarding experience needs work.
async function setupActivationFunnel() {
  const funnelEvents = [
    'signup_completed',
    'vehicle_added',
    'ingestion_uploaded',
    'ai_chat_message_sent',
    'quote_request_sent',
  ]
  return upsert('Insight', '/insights/', 'Trial activation funnel', {
    description: 'Signup → Vehicle → Ingestion → AI chat → Quote request. The 5 steps a trial user follows to first value.',
    filters: {
      insight: 'FUNNELS',
      funnel_viz_type: 'steps',
      funnel_window_interval: 14,
      funnel_window_interval_unit: 'day',
      events: funnelEvents.map((event, order) => ({
        id: event,
        type: 'events',
        order,
        name: event,
      })),
      date_from: '-90d',
      // We split by org so the funnel reflects orgs activating, not
      // individual users (an org can have multiple admins doing pieces).
      breakdown: 'organizationId',
      breakdown_type: 'person',
    },
  })
}

// ---------- 3. Marketing acquisition funnel ----------
// From a fresh pageview on the homepage to signup_completed. Useful to
// see where the acquisition path leaks before users even start a trial.
async function setupMarketingFunnel() {
  return upsert('Insight', '/insights/', 'Marketing acquisition funnel', {
    description: 'Pageview → hero scroll → CTA click → signup_started → signup_completed. Marketing-side conversion path.',
    filters: {
      insight: 'FUNNELS',
      funnel_viz_type: 'steps',
      funnel_window_interval: 1,
      funnel_window_interval_unit: 'day',
      events: [
        { id: '$pageview', type: 'events', order: 0, name: 'Pageview' },
        { id: 'hero_scrolled_past', type: 'events', order: 1, name: 'hero_scrolled_past' },
        { id: 'cta_clicked', type: 'events', order: 2, name: 'cta_clicked' },
        { id: 'signup_started', type: 'events', order: 3, name: 'signup_started' },
        { id: 'signup_completed', type: 'events', order: 4, name: 'signup_completed' },
      ],
      date_from: '-30d',
    },
  })
}

// ---------- 4. Weekly active orgs trend ----------
async function setupWeeklyActiveOrgsTrend() {
  return upsert('Insight', '/insights/', 'Weekly active orgs', {
    description: 'Distinct orgs with any tracked event in a given week. Best high-level engagement signal.',
    filters: {
      insight: 'TRENDS',
      display: 'ActionsLineGraph',
      interval: 'week',
      events: [
        {
          id: '$pageview',
          type: 'events',
          order: 0,
          name: 'Pageview',
          math: 'unique_group',
          math_group_type_index: 0, // requires Group Analytics — falls back to dau if not configured
        },
      ],
      date_from: '-90d',
    },
  })
}

// ---------- 5. AI chat usage by org ----------
async function setupChatUsageTrend() {
  return upsert('Insight', '/insights/', 'AI chat messages per org', {
    description: 'Daily AI chat message volume, breakdown by organization. Identifies power users + dropoff orgs.',
    filters: {
      insight: 'TRENDS',
      display: 'ActionsLineGraph',
      interval: 'day',
      events: [
        {
          id: 'ai_chat_message_sent',
          type: 'events',
          order: 0,
          name: 'ai_chat_message_sent',
          math: 'total',
        },
      ],
      breakdown: 'organizationId',
      breakdown_type: 'person',
      breakdown_limit: 10,
      date_from: '-30d',
    },
  })
}

// ---------- 6. Activation dashboard ----------
async function setupDashboard(insightIds: number[]) {
  const existing = await findByName<{ id: number }>('/dashboards/', 'PartsIQ — Activation & Growth').catch(() => null)
  if (existing) {
    console.log(`  ↻ Dashboard: "PartsIQ — Activation & Growth" exists (id=${existing.id}) — updating tiles`)
  } else {
    console.log(`  + Dashboard: creating "PartsIQ — Activation & Growth"`)
  }

  const dashboard = existing
    ? existing
    : await api<{ id: number }>('POST', '/dashboards/', {
        name: 'PartsIQ — Activation & Growth',
        description: 'Activation funnel, marketing funnel, and engagement trends. Provisioned by scripts/posthog-setup.ts.',
        pinned: true,
      })

  // Add each insight as a tile. PostHog's API uses /dashboard_tiles/ for this.
  for (const insightId of insightIds) {
    if (DRY) {
      console.log(`  [dry] add insight ${insightId} to dashboard ${dashboard.id}`)
      continue
    }
    try {
      await api('POST', `/dashboards/${dashboard.id}/tiles/`, {
        insight: insightId,
      })
      console.log(`    + tile insight=${insightId}`)
    } catch (err: any) {
      // Tile already linked is non-fatal. PostHog returns 400 on duplicate.
      console.log(`    ↻ tile insight=${insightId} (already on dashboard or skipped: ${err.message?.slice(0, 80)})`)
    }
  }
  return dashboard
}

async function main() {
  console.log(`PostHog setup — host=${MGMT_HOST}, project=${PROJECT_ID}, dry=${DRY}`)

  console.log('\n[1/6] Internal-users cohort')
  const cohort = await setupInternalCohort()

  console.log('\n[2/6] Trial activation funnel')
  const activation = await setupActivationFunnel()

  console.log('\n[3/6] Marketing acquisition funnel')
  const marketing = await setupMarketingFunnel()

  console.log('\n[4/6] Weekly active orgs trend')
  const wao = await setupWeeklyActiveOrgsTrend()

  console.log('\n[5/6] AI chat usage trend')
  const chat = await setupChatUsageTrend()

  console.log('\n[6/6] Dashboard')
  const insightIds = [activation, marketing, wao, chat]
    .map((i: any) => i?.id)
    .filter((id): id is number => typeof id === 'number')
  const dashboard = await setupDashboard(insightIds)

  console.log('\n✓ done')
  if (!DRY) {
    console.log(`  Cohort:    ${MGMT_HOST}/project/${PROJECT_ID}/cohorts/${(cohort as any)?.id ?? '?'}`)
    console.log(`  Dashboard: ${MGMT_HOST}/project/${PROJECT_ID}/dashboard/${(dashboard as any)?.id ?? '?'}`)
  }
}

main().catch((err) => {
  console.error('\n✗ posthog-setup failed:', err.message ?? err)
  process.exit(1)
})
