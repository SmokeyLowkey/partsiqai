"use client"

import { useState } from "react"
import { Loader2, CheckCircle2, Send } from "lucide-react"
import { Button } from "@/components/ui/button"
import { trackEvent, AnalyticsEvents } from "@/lib/analytics"

const SUBJECT_OPTIONS = [
  { value: "sales", label: "Sales Inquiry" },
  { value: "demo", label: "Request a Demo" },
  { value: "support", label: "Technical Support" },
  { value: "partnership", label: "Partnership Opportunities" },
  { value: "other", label: "Other" },
] as const

/**
 * Functional /contact form. Submissions POST to /api/contact which routes
 * to the admin notification inbox via Resend and sends a confirmation back
 * to the submitter. No dependency on MX-hosted inbox for partsiqai.com.
 */
export function ContactForm({ defaultSubject }: { defaultSubject?: string }) {
  const [firstName, setFirstName] = useState("")
  const [lastName, setLastName] = useState("")
  const [email, setEmail] = useState("")
  const [company, setCompany] = useState("")
  const [subject, setSubject] = useState(defaultSubject || "")
  const [message, setMessage] = useState("")
  const [status, setStatus] = useState<"idle" | "submitting" | "success" | "error">("idle")
  const [errorMsg, setErrorMsg] = useState("")

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (status === "submitting") return

    setStatus("submitting")
    setErrorMsg("")

    try {
      const res = await fetch("/api/contact", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ firstName, lastName, email, company, subject, message }),
      })

      if (!res.ok) {
        const data = await res.json().catch(() => ({}))
        throw new Error(data.error || "Submission failed")
      }

      setStatus("success")
      trackEvent(AnalyticsEvents.CTA_CLICKED, {
        source: `contact-form-${subject || "other"}`,
        cta_text: "contact form submitted",
      })
    } catch (err) {
      const message = err instanceof Error ? err.message : "Submission failed"
      setStatus("error")
      setErrorMsg(message)
    }
  }

  if (status === "success") {
    return (
      <div className="bg-gradient-to-br from-emerald-50 to-white border-2 border-emerald-500 rounded-lg p-8">
        <div className="flex items-start gap-4">
          <CheckCircle2 className="h-8 w-8 text-emerald-600 shrink-0 mt-1" />
          <div>
            <h3 className="text-2xl font-bold text-slate-950 mb-2">Message received</h3>
            <p className="text-slate-700 leading-relaxed">
              Thanks, {firstName}. We got your message and someone from our team will be in touch within one business day. Check your inbox for a confirmation from us.
            </p>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="bg-slate-50 border border-slate-200 rounded-lg p-8">
      <h2 className="text-2xl font-bold text-slate-950 mb-6">Send us a message</h2>
      <form onSubmit={handleSubmit} className="space-y-6">
        <div className="grid md:grid-cols-2 gap-6">
          <div>
            <label htmlFor="firstName" className="block text-sm font-medium text-slate-700 mb-2">
              First Name *
            </label>
            <input
              type="text"
              id="firstName"
              required
              autoComplete="given-name"
              value={firstName}
              onChange={(e) => setFirstName(e.target.value)}
              disabled={status === "submitting"}
              className="w-full px-4 py-3 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-slate-950 focus:border-transparent disabled:opacity-60"
            />
          </div>
          <div>
            <label htmlFor="lastName" className="block text-sm font-medium text-slate-700 mb-2">
              Last Name *
            </label>
            <input
              type="text"
              id="lastName"
              required
              autoComplete="family-name"
              value={lastName}
              onChange={(e) => setLastName(e.target.value)}
              disabled={status === "submitting"}
              className="w-full px-4 py-3 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-slate-950 focus:border-transparent disabled:opacity-60"
            />
          </div>
        </div>

        <div>
          <label htmlFor="email" className="block text-sm font-medium text-slate-700 mb-2">
            Work Email *
          </label>
          <input
            type="email"
            id="email"
            required
            autoComplete="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            disabled={status === "submitting"}
            className="w-full px-4 py-3 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-slate-950 focus:border-transparent disabled:opacity-60"
            placeholder="you@company.com"
          />
        </div>

        <div>
          <label htmlFor="company" className="block text-sm font-medium text-slate-700 mb-2">
            Company
          </label>
          <input
            type="text"
            id="company"
            autoComplete="organization"
            value={company}
            onChange={(e) => setCompany(e.target.value)}
            disabled={status === "submitting"}
            className="w-full px-4 py-3 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-slate-950 focus:border-transparent disabled:opacity-60"
          />
        </div>

        <div>
          <label htmlFor="subject" className="block text-sm font-medium text-slate-700 mb-2">
            Subject *
          </label>
          <select
            id="subject"
            required
            value={subject}
            onChange={(e) => setSubject(e.target.value)}
            disabled={status === "submitting"}
            className="w-full px-4 py-3 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-slate-950 focus:border-transparent bg-white disabled:opacity-60"
          >
            <option value="">Select a topic</option>
            {SUBJECT_OPTIONS.map((o) => (
              <option key={o.value} value={o.value}>{o.label}</option>
            ))}
          </select>
        </div>

        <div>
          <label htmlFor="message" className="block text-sm font-medium text-slate-700 mb-2">
            Message *
          </label>
          <textarea
            id="message"
            rows={6}
            required
            value={message}
            onChange={(e) => setMessage(e.target.value)}
            disabled={status === "submitting"}
            className="w-full px-4 py-3 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-slate-950 focus:border-transparent resize-none disabled:opacity-60"
            placeholder="How can we help?"
          />
        </div>

        <Button
          type="submit"
          size="lg"
          disabled={status === "submitting"}
          className="w-full bg-slate-950 text-white hover:bg-slate-800 h-12"
        >
          {status === "submitting" ? (
            <>
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              Sending
            </>
          ) : (
            <>
              Send Message
              <Send className="ml-2 h-4 w-4" />
            </>
          )}
        </Button>

        {status === "error" && (
          <p className="text-sm text-red-600">{errorMsg || "Couldn't submit. Please try again."}</p>
        )}

        <p className="text-xs text-slate-500 text-center">
          We use your information solely to respond. Read our <a href="/privacy" className="underline hover:text-slate-700">Privacy Policy</a>.
        </p>
      </form>
    </div>
  )
}
