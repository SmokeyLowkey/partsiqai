"use client"

import { useState } from "react"
import { Loader2, CheckCircle2, Send } from "lucide-react"
import { trackEvent, AnalyticsEvents } from "@/lib/analytics"

export type LegalRequestType = "legal" | "privacy" | "data_request"

interface LegalContactFormProps {
  requestType: LegalRequestType
}

const TYPE_LABELS: Record<LegalRequestType, string> = {
  legal: "General / Terms question",
  privacy: "Privacy question",
  data_request: "Data access / deletion request",
}

/**
 * Inline form embedded on /terms and /privacy. Submissions are routed to
 * the master admin inbox via Resend (server-side) and the submitter gets
 * an auto-confirmation. Gives us structured legal-request records without
 * requiring DNS-level inbound email forwarding.
 */
export function LegalContactForm({ requestType: defaultType }: LegalContactFormProps) {
  const [name, setName] = useState("")
  const [email, setEmail] = useState("")
  const [subject, setSubject] = useState("")
  const [message, setMessage] = useState("")
  const [type, setType] = useState<LegalRequestType>(defaultType)
  const [status, setStatus] = useState<"idle" | "submitting" | "success" | "error">("idle")
  const [errorMsg, setErrorMsg] = useState("")

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (status === "submitting") return

    setStatus("submitting")
    setErrorMsg("")

    try {
      const res = await fetch("/api/legal-contact", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, email, subject, message, type }),
      })

      if (!res.ok) {
        const data = await res.json().catch(() => ({}))
        throw new Error(data.error || "Submission failed")
      }

      setStatus("success")
      trackEvent(AnalyticsEvents.CTA_CLICKED, {
        source: `legal-form-${type}`,
        cta_text: "legal form submitted",
      })
    } catch (err) {
      const message = err instanceof Error ? err.message : "Submission failed"
      setStatus("error")
      setErrorMsg(message)
    }
  }

  if (status === "success") {
    return (
      <div className="rounded-xl border-2 border-emerald-500 bg-gradient-to-br from-white to-emerald-50/40 p-6">
        <div className="flex items-start gap-3">
          <CheckCircle2 className="h-6 w-6 text-emerald-600 shrink-0 mt-0.5" />
          <div>
            <p className="text-lg font-semibold text-slate-900">Thanks — your message is in our queue.</p>
            <p className="mt-1 text-sm text-slate-600">
              You&rsquo;ll receive a confirmation email shortly. We aim to respond within 3 business days for general questions, and sooner for formal data-access requests.
            </p>
          </div>
        </div>
      </div>
    )
  }

  return (
    <form onSubmit={handleSubmit} className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm space-y-5">
      <div>
        <label htmlFor="legal-form-type" className="block text-sm font-semibold text-slate-900 mb-1.5">
          Request type
        </label>
        <select
          id="legal-form-type"
          value={type}
          onChange={(e) => setType(e.target.value as LegalRequestType)}
          disabled={status === "submitting"}
          className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2.5 text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-emerald-500 disabled:opacity-60"
        >
          {(Object.keys(TYPE_LABELS) as LegalRequestType[]).map((k) => (
            <option key={k} value={k}>{TYPE_LABELS[k]}</option>
          ))}
        </select>
      </div>

      <div className="grid md:grid-cols-2 gap-4">
        <div>
          <label htmlFor="legal-form-name" className="block text-sm font-semibold text-slate-900 mb-1.5">
            Your name
          </label>
          <input
            id="legal-form-name"
            type="text"
            required
            autoComplete="name"
            value={name}
            onChange={(e) => setName(e.target.value)}
            disabled={status === "submitting"}
            className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2.5 text-sm text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-emerald-500 disabled:opacity-60"
            placeholder="Jane Doe"
          />
        </div>
        <div>
          <label htmlFor="legal-form-email" className="block text-sm font-semibold text-slate-900 mb-1.5">
            Email
          </label>
          <input
            id="legal-form-email"
            type="email"
            required
            autoComplete="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            disabled={status === "submitting"}
            className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2.5 text-sm text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-emerald-500 disabled:opacity-60"
            placeholder="you@company.com"
          />
        </div>
      </div>

      <div>
        <label htmlFor="legal-form-subject" className="block text-sm font-semibold text-slate-900 mb-1.5">
          Subject
        </label>
        <input
          id="legal-form-subject"
          type="text"
          required
          value={subject}
          onChange={(e) => setSubject(e.target.value)}
          disabled={status === "submitting"}
          className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2.5 text-sm text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-emerald-500 disabled:opacity-60"
          placeholder="Brief summary of your question or request"
        />
      </div>

      <div>
        <label htmlFor="legal-form-message" className="block text-sm font-semibold text-slate-900 mb-1.5">
          Message
        </label>
        <textarea
          id="legal-form-message"
          required
          rows={5}
          value={message}
          onChange={(e) => setMessage(e.target.value)}
          disabled={status === "submitting"}
          className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2.5 text-sm text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-emerald-500 disabled:opacity-60 resize-none"
          placeholder="Share as much detail as you can. For data access or deletion requests, include the account email so we can verify your identity."
        />
      </div>

      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <p className="text-xs text-slate-500">
          We use your information solely to respond to this request. See our Privacy Policy.
        </p>
        <button
          type="submit"
          disabled={status === "submitting"}
          className="inline-flex items-center justify-center gap-2 rounded-lg bg-slate-950 text-white font-semibold px-5 py-2.5 hover:bg-slate-800 transition-colors disabled:opacity-60"
        >
          {status === "submitting" ? (
            <>
              <Loader2 className="h-4 w-4 animate-spin" />
              Sending
            </>
          ) : (
            <>
              Submit
              <Send className="h-4 w-4" />
            </>
          )}
        </button>
      </div>

      {status === "error" && (
        <p className="text-sm text-red-600">{errorMsg || "Couldn't submit. Please try again."}</p>
      )}
    </form>
  )
}
