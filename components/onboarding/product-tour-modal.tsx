"use client"

import { useEffect, useState } from "react"
import Link from "next/link"
import { useSession } from "next-auth/react"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import {
  Truck,
  Upload,
  Building2,
  Bot,
  FileText,
  Sparkles,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  X,
} from "lucide-react"
import { cn } from "@/lib/utils"
import { trackEvent, AnalyticsEvents } from "@/lib/analytics"

/**
 * One-time product tour modal for new admins. Walks through what PartsIQ
 * does and the 5 setup steps before they're staring at an empty dashboard.
 *
 * Persistence: localStorage flag, not a DB column. The tour is purely a UX
 * hint — if a user clears cookies or signs in on a new device they'll see
 * it once more, which is fine. Avoids a schema migration for low-stakes
 * preference data.
 *
 * Render gate: shown when (a) localStorage flag is unset AND (b) no other
 * critical alert (subscription required, email reauth) is taking the user
 * elsewhere first. The modal only mounts on /admin/* pages so it can't
 * fire on the login screen or onboarding wizard.
 *
 * Skip / Get Started both mark complete — we don't distinguish "skipped"
 * from "completed" because the user can re-open the tour from the sidebar.
 */

const LS_KEY = "partsiq_product_tour_completed_at"

interface Frame {
  title: string
  description: string
  body: React.ReactNode
}

function buildFrames(orgName: string): Frame[] {
  return [
    {
      title: `Welcome to PartsIQ, ${orgName}`,
      description: "Let's take 60 seconds to show you what's here.",
      body: (
        <div className="space-y-4">
          <p className="text-sm text-muted-foreground leading-relaxed">
            PartsIQ helps heavy &amp; compact equipment ops source parts in minutes
            instead of hours — through AI parts search, voice-agent supplier calls, and
            multi-supplier quote comparison.
          </p>
          <div className="grid grid-cols-2 gap-3">
            <div className="flex items-start gap-3 rounded-lg border bg-muted/30 p-3">
              <Sparkles className="h-5 w-5 mt-0.5 text-emerald-600 dark:text-emerald-400" />
              <div className="text-xs">
                <div className="font-medium">AI parts search</div>
                <div className="text-muted-foreground">Cross-brand, cross-catalog, in one query</div>
              </div>
            </div>
            <div className="flex items-start gap-3 rounded-lg border bg-muted/30 p-3">
              <Bot className="h-5 w-5 mt-0.5 text-blue-600 dark:text-blue-400" />
              <div className="text-xs">
                <div className="font-medium">Voice agent</div>
                <div className="text-muted-foreground">Calls suppliers, captures quotes</div>
              </div>
            </div>
          </div>
        </div>
      ),
    },
    {
      title: "Five setup steps to get started",
      description: "Each step unlocks more of the product. Most teams complete these in ~30 minutes.",
      body: (
        <div className="space-y-2">
          {[
            {
              icon: Truck,
              title: "Add your first vehicle",
              description: "Register a machine so parts search can scope to it.",
              href: "/customer/vehicles",
            },
            {
              icon: Upload,
              title: "Upload a parts catalog",
              description: "Import your CSV or JSON. Ingestion runs in the background.",
              href: "/admin/data-ingestion",
            },
            {
              icon: Building2,
              title: "Add your suppliers",
              description: "Connect supplier records so RFQs have somewhere to go.",
              href: "/customer/suppliers",
            },
            {
              icon: Bot,
              title: "Try the AI assistant",
              description: "Ask about parts, get cross-brand alternatives.",
              href: "/customer/ai-chat",
            },
            {
              icon: FileText,
              title: "Send a quote request",
              description: "Build a pick list and let the system RFQ multiple suppliers.",
              href: "/customer/quote-requests",
            },
          ].map((step) => (
            <div key={step.title} className="flex items-start gap-3 rounded-lg border bg-muted/20 p-3">
              <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-emerald-100 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-400">
                <step.icon className="h-4 w-4" />
              </div>
              <div className="flex-1 text-xs">
                <div className="font-medium text-foreground">{step.title}</div>
                <div className="text-muted-foreground">{step.description}</div>
              </div>
            </div>
          ))}
        </div>
      ),
    },
    {
      title: "What the AI assistant does",
      description: "The fastest way to feel the value before you've finished setup.",
      body: (
        <div className="space-y-3">
          <div className="rounded-lg border bg-muted/30 p-3 text-xs space-y-2">
            <div className="font-medium text-muted-foreground">You:</div>
            <div className="rounded bg-background px-2 py-1.5">
              Find an oil filter for the 2019 John Deere 160GLC
            </div>
            <div className="font-medium text-muted-foreground pt-1">PartsIQ:</div>
            <div className="rounded bg-background px-2 py-1.5 space-y-1">
              <div>I found 3 candidates for your vehicle:</div>
              <ul className="ml-4 list-disc space-y-0.5">
                <li><strong>RE509672</strong> &mdash; OEM John Deere primary fuel filter</li>
                <li><strong>Donaldson P558616</strong> &mdash; cross-reference, 30% lower cost</li>
                <li><strong>Fleetguard FF5485</strong> &mdash; aftermarket equivalent, in-stock</li>
              </ul>
              <div className="pt-1">Want me to RFQ all three? <span className="text-emerald-600 dark:text-emerald-400 underline">Yes</span> · <span className="text-muted-foreground underline">Just OEM</span></div>
            </div>
          </div>
          <p className="text-xs text-muted-foreground leading-relaxed">
            Behind the scenes: vector search, graph traversal across the OEM catalog,
            and a 7-factor scoring model that compares unit price, lead time, MOQ,
            warranty, quality tier, and supplier reliability — not just price.
          </p>
        </div>
      ),
    },
    {
      title: "Ready to set up your fleet?",
      description: "Pick where to start. The dashboard tracks your progress.",
      body: (
        <div className="space-y-3">
          <Link
            href="/customer/vehicles"
            className="flex items-center gap-3 rounded-lg border-2 border-emerald-200 bg-emerald-50/50 dark:border-emerald-800 dark:bg-emerald-950/30 p-4 hover:border-emerald-400 dark:hover:border-emerald-600 transition-colors"
          >
            <Truck className="h-5 w-5 text-emerald-600 dark:text-emerald-400" />
            <div className="flex-1 text-sm">
              <div className="font-medium text-foreground">Start with a vehicle</div>
              <div className="text-xs text-muted-foreground">Register your first machine — 2 minutes</div>
            </div>
            <ChevronRight className="h-4 w-4 text-muted-foreground" />
          </Link>
          <Link
            href="/admin/data-ingestion"
            className="flex items-center gap-3 rounded-lg border bg-muted/30 p-4 hover:bg-muted/50 transition-colors"
          >
            <Upload className="h-5 w-5 text-muted-foreground" />
            <div className="flex-1 text-sm">
              <div className="font-medium text-foreground">Or upload a parts catalog first</div>
              <div className="text-xs text-muted-foreground">CSV / JSON, any size — runs in the background</div>
            </div>
            <ChevronRight className="h-4 w-4 text-muted-foreground" />
          </Link>
          <p className="text-xs text-muted-foreground text-center pt-2">
            <CheckCircle2 className="h-3 w-3 inline-block mr-1 text-emerald-600 dark:text-emerald-400" />
            You can always replay this tour from the sidebar.
          </p>
        </div>
      ),
    },
  ]
}

interface ProductTourModalProps {
  /** Force open regardless of localStorage flag — for "Replay tour" buttons. */
  forceOpen?: boolean
  /** Callback fired when the tour closes (skip, finish, or X) — used so the
   *  parent's "Replay tour" trigger can reset its open state. */
  onClose?: () => void
}

export function ProductTourModal({ forceOpen, onClose }: ProductTourModalProps) {
  const { data: session } = useSession()
  const [open, setOpen] = useState(false)
  const [frame, setFrame] = useState(0)

  // First-time auto-open. Runs after mount because localStorage is client-only.
  // We deliberately wait for an authenticated session — no point firing on
  // login / signup pages.
  useEffect(() => {
    if (forceOpen) {
      setOpen(true)
      setFrame(0)
      trackEvent(AnalyticsEvents.PRODUCT_TOUR_VIEWED, { source: 'replay' })
      return
    }
    if (!session?.user) return
    try {
      const completed = window.localStorage.getItem(LS_KEY)
      if (!completed) {
        setOpen(true)
        setFrame(0)
        trackEvent(AnalyticsEvents.PRODUCT_TOUR_VIEWED, { source: 'auto' })
      }
    } catch {
      // localStorage blocked — silently skip; tour just doesn't show.
    }
  }, [session?.user, forceOpen])

  // Per-frame view event — fires on initial open and on every Next/Back/dot
  // click. Lets us see drop-off curve across the four frames.
  useEffect(() => {
    if (open) {
      trackEvent(AnalyticsEvents.PRODUCT_TOUR_FRAME_VIEWED, {
        frame: frame + 1,
        totalFrames: 4,
      })
    }
  }, [open, frame])

  const orgName = (session?.user as any)?.organization?.name ?? session?.user?.name ?? "there"
  const frames = buildFrames(orgName)
  const isLast = frame === frames.length - 1
  const isFirst = frame === 0

  const markComplete = () => {
    try {
      window.localStorage.setItem(LS_KEY, new Date().toISOString())
    } catch {}
  }

  // Distinguish "user dismissed without finishing" (skipped) from "user
  // walked through and clicked Get started" (completed). Both end the
  // session but the analytics distinguish.
  const handleClose = (nextOpen: boolean) => {
    setOpen(nextOpen)
    if (!nextOpen) {
      markComplete()
      trackEvent(AnalyticsEvents.PRODUCT_TOUR_SKIPPED, { atFrame: frame + 1 })
      onClose?.()
    }
  }

  const handleFinish = () => {
    markComplete()
    setOpen(false)
    trackEvent(AnalyticsEvents.PRODUCT_TOUR_COMPLETED, { atFrame: frame + 1 })
    onClose?.()
  }

  if (!session?.user) return null

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>{frames[frame].title}</DialogTitle>
          <DialogDescription>{frames[frame].description}</DialogDescription>
        </DialogHeader>

        <div className="py-2">{frames[frame].body}</div>

        {/* Frame indicator dots */}
        <div className="flex items-center justify-center gap-1.5 pt-2">
          {frames.map((_, i) => (
            <button
              key={i}
              type="button"
              onClick={() => setFrame(i)}
              className={cn(
                "h-1.5 rounded-full transition-all",
                i === frame ? "w-6 bg-emerald-600 dark:bg-emerald-400" : "w-1.5 bg-muted-foreground/30 hover:bg-muted-foreground/60",
              )}
              aria-label={`Go to frame ${i + 1}`}
            />
          ))}
        </div>

        <div className="flex items-center justify-between pt-2 gap-2">
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={handleFinish}
            className="text-muted-foreground"
          >
            Skip
          </Button>
          <div className="flex items-center gap-2">
            {!isFirst && (
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => setFrame(frame - 1)}
              >
                <ChevronLeft className="mr-1 h-4 w-4" /> Back
              </Button>
            )}
            {isLast ? (
              <Button type="button" size="sm" onClick={handleFinish}>
                Get started
              </Button>
            ) : (
              <Button
                type="button"
                size="sm"
                onClick={() => setFrame(frame + 1)}
              >
                Next <ChevronRight className="ml-1 h-4 w-4" />
              </Button>
            )}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}
