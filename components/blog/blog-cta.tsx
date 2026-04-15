"use client"

import { useEffect, useRef, useState } from "react"
import { trackEvent, AnalyticsEvents } from "@/lib/analytics"
import { ArrowRight, CheckCircle2, Loader2 } from "lucide-react"

interface BlogCTAProps {
  /** Where this CTA sits, for analytics (e.g. "post-footer", "inline-after-intro") */
  source?: string
  /** Slug of the post it's embedded in — auto-populated when used via MDX with page-level default, but overridable */
  postSlug?: string
  postTitle?: string
  /** If set, indicates this CTA offers a specific lead magnet (guide, checklist, etc.) */
  leadMagnet?: string
  title?: string
  description?: string
  ctaText?: string
  variant?: "inline" | "footer"
}

export function BlogCTA({
  source = "blog",
  postSlug,
  postTitle,
  leadMagnet,
  title = "See PartsIQ in action",
  description = "Get a personalized 15-minute walkthrough of how we automate parts sourcing. No sales pressure.",
  ctaText = "Request demo",
  variant = "footer",
}: BlogCTAProps) {
  const [email, setEmail] = useState("")
  const [status, setStatus] = useState<"idle" | "submitting" | "success" | "error">("idle")
  const [errorMsg, setErrorMsg] = useState("")
  const rootRef = useRef<HTMLDivElement>(null)
  const viewedRef = useRef(false)

  // Fire a view event once when the CTA actually scrolls into the viewport.
  useEffect(() => {
    const el = rootRef.current
    if (!el || typeof IntersectionObserver === "undefined") return
    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (entry.isIntersecting && !viewedRef.current) {
            viewedRef.current = true
            trackEvent(AnalyticsEvents.LEAD_CAPTURE_VIEWED, {
              source,
              postSlug,
              postTitle,
              leadMagnet,
              variant,
            })
            observer.disconnect()
            break
          }
        }
      },
      { threshold: 0.4 }
    )
    observer.observe(el)
    return () => observer.disconnect()
  }, [source, postSlug, postTitle, leadMagnet, variant])

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!email || status === "submitting") return

    setStatus("submitting")
    setErrorMsg("")

    trackEvent(AnalyticsEvents.LEAD_CAPTURE_SUBMITTED, {
      source,
      postSlug,
      postTitle,
      leadMagnet,
      variant,
    })

    try {
      const res = await fetch("/api/leads", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, source, postSlug, postTitle, leadMagnet }),
      })

      if (!res.ok) {
        const data = await res.json().catch(() => ({}))
        throw new Error(data.error || "Something went wrong")
      }

      setStatus("success")
      trackEvent(AnalyticsEvents.LEAD_CAPTURE_SUCCESS, {
        source,
        postSlug,
        postTitle,
        leadMagnet,
        variant,
      })
    } catch (err) {
      const message = err instanceof Error ? err.message : "Something went wrong"
      setStatus("error")
      setErrorMsg(message)
      trackEvent(AnalyticsEvents.LEAD_CAPTURE_FAILED, {
        source,
        postSlug,
        postTitle,
        leadMagnet,
        variant,
        error: message,
      })
    }
  }

  const containerClass =
    variant === "inline"
      ? "not-prose my-10 rounded-xl border border-emerald-200 dark:border-emerald-800/60 bg-gradient-to-br from-emerald-50 via-white to-emerald-50/40 dark:from-emerald-950/40 dark:via-slate-900 dark:to-emerald-950/20 p-6 shadow-sm"
      : "not-prose my-12 rounded-2xl bg-slate-950 text-white p-8 md:p-10 shadow-lg"

  if (status === "success") {
    return (
      <div ref={rootRef} className={containerClass}>
        <div className="flex items-start gap-3">
          <CheckCircle2 className={variant === "footer" ? "h-6 w-6 text-emerald-400 shrink-0 mt-0.5" : "h-6 w-6 text-emerald-600 shrink-0 mt-0.5"} />
          <div>
            <p className={variant === "footer" ? "text-xl font-semibold" : "text-lg font-semibold text-slate-900 dark:text-slate-100"}>
              Thanks — we'll be in touch shortly.
            </p>
            <p className={variant === "footer" ? "mt-1 text-slate-300" : "mt-1 text-slate-600 dark:text-slate-400"}>
              Check your inbox for a confirmation from our team.
            </p>
          </div>
        </div>
      </div>
    )
  }

  const isFooter = variant === "footer"

  return (
    <div ref={rootRef} className={containerClass}>
      <div className={isFooter ? "max-w-2xl" : ""}>
        <h3 className={isFooter ? "text-2xl md:text-3xl font-bold tracking-tight" : "text-xl font-bold tracking-tight text-slate-900 dark:text-slate-100"}>
          {title}
        </h3>
        <p className={isFooter ? "mt-3 text-slate-300 leading-relaxed" : "mt-2 text-slate-600 dark:text-slate-400 leading-relaxed"}>
          {description}
        </p>

        <form onSubmit={handleSubmit} className="mt-5 flex flex-col sm:flex-row gap-3">
          <label htmlFor={`blog-cta-email-${source}`} className="sr-only">
            Work email
          </label>
          <input
            id={`blog-cta-email-${source}`}
            type="email"
            required
            autoComplete="email"
            placeholder="you@company.com"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            disabled={status === "submitting"}
            className={
              isFooter
                ? "flex-1 rounded-lg bg-white/10 border border-white/20 px-4 py-3 text-white placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-emerald-400 disabled:opacity-60"
                : "flex-1 rounded-lg bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-600 px-4 py-3 text-slate-900 dark:text-slate-100 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-emerald-500 disabled:opacity-60"
            }
          />
          <button
            type="submit"
            disabled={status === "submitting"}
            className={
              isFooter
                ? "inline-flex items-center justify-center gap-2 rounded-lg bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-semibold px-6 py-3 transition-colors disabled:opacity-60"
                : "inline-flex items-center justify-center gap-2 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white font-semibold px-6 py-3 transition-colors disabled:opacity-60"
            }
          >
            {status === "submitting" ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" />
                Sending
              </>
            ) : (
              <>
                {ctaText}
                <ArrowRight className="h-4 w-4" />
              </>
            )}
          </button>
        </form>

        {status === "error" && (
          <p className={isFooter ? "mt-3 text-sm text-red-300" : "mt-3 text-sm text-red-600 dark:text-red-400"}>
            {errorMsg || "Couldn't submit. Please try again."}
          </p>
        )}

        <p className={isFooter ? "mt-3 text-xs text-slate-400" : "mt-3 text-xs text-slate-500 dark:text-slate-500"}>
          We'll only use your email to follow up. No spam, no shared lists.
        </p>
      </div>
    </div>
  )
}
