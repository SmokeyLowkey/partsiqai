import { NextResponse } from "next/server"
import { sendEmail, getBaseUrl } from "@/lib/email/resend"
import { escapeHtml } from "@/lib/sanitize"
import { withHardening } from "@/lib/api/with-hardening"

/**
 * General contact form submissions from /contact.
 *
 * Routes the inquiry to the admin notification inbox via Resend (so there's
 * no dependency on an MX-hosted inbox for partsiqai.com) and replies to the
 * submitter with a confirmation.
 *
 * Env configuration (any one works, resolved in order):
 *   CONTACT_NOTIFICATION_EMAIL (optional — dedicated inbound sales/contact inbox)
 *   ADMIN_NOTIFICATION_EMAIL   (fallback)
 *   LEADS_NOTIFICATION_EMAIL   (fallback — reuses leads inbox)
 *   onboarding@partsiqai.com   (final fallback — verified sender on Resend)
 */

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
const SUBJECT_LABELS: Record<string, string> = {
  sales: "Sales Inquiry",
  demo: "Demo Request",
  support: "Technical Support",
  partnership: "Partnership Opportunity",
  other: "General Inquiry",
}

// Public contact form — IP rate limit to prevent spam, origin check
// catches cross-site form submissions. No session required.
export const POST = withHardening(
  {
    requireSession: false,
    rateLimit: { limit: 5, windowSeconds: 900, prefix: "contact-form", keyBy: "ip" },
  },
  async (request: Request) => {
  let body: unknown
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 })
  }

  const { firstName, lastName, email, company, subject, message } = (body ?? {}) as {
    firstName?: string
    lastName?: string
    email?: string
    company?: string
    subject?: string
    message?: string
  }

  if (!firstName || typeof firstName !== "string" || firstName.length > 100) {
    return NextResponse.json({ error: "First name required (max 100 chars)" }, { status: 400 })
  }
  if (!lastName || typeof lastName !== "string" || lastName.length > 100) {
    return NextResponse.json({ error: "Last name required (max 100 chars)" }, { status: 400 })
  }
  if (!email || typeof email !== "string" || !EMAIL_RE.test(email)) {
    return NextResponse.json({ error: "Valid email required" }, { status: 400 })
  }
  if (company && (typeof company !== "string" || company.length > 200)) {
    return NextResponse.json({ error: "Company name too long" }, { status: 400 })
  }
  if (!message || typeof message !== "string" || message.length > 5000) {
    return NextResponse.json({ error: "Message required (max 5000 chars)" }, { status: 400 })
  }
  const safeSubjectKey = typeof subject === "string" && subject in SUBJECT_LABELS ? subject : "other"

  const notificationTo =
    process.env.CONTACT_NOTIFICATION_EMAIL ||
    process.env.ADMIN_NOTIFICATION_EMAIL ||
    process.env.LEADS_NOTIFICATION_EMAIL ||
    "onboarding@partsiqai.com"

  const safeFirstName = escapeHtml(firstName)
  const safeLastName = escapeHtml(lastName)
  const safeFullName = `${safeFirstName} ${safeLastName}`
  const safeEmail = escapeHtml(email)
  const safeCompany = company ? escapeHtml(company) : ""
  const safeSubjectLabel = escapeHtml(SUBJECT_LABELS[safeSubjectKey])
  const safeMessage = escapeHtml(message).replace(/\n/g, "<br />")
  const baseUrl = getBaseUrl()

  // 1. Admin notification — Reply-To header set to submitter for one-click replies.
  const adminHtml = `
    <div style="font-family:system-ui,sans-serif;max-width:640px;margin:0 auto;color:#0f172a;">
      <h2 style="margin:0 0 8px 0;">New contact form submission</h2>
      <p style="color:#64748b;margin:0 0 20px 0;font-size:14px;">Submitted via /contact on partsiqai.com</p>
      <table style="width:100%;border-collapse:collapse;font-size:14px;">
        <tr><td style="padding:6px 12px 6px 0;color:#64748b;width:100px;">From</td><td style="padding:6px 0;"><strong>${safeFullName}</strong></td></tr>
        <tr><td style="padding:6px 12px 6px 0;color:#64748b;">Email</td><td style="padding:6px 0;"><strong>${safeEmail}</strong></td></tr>
        ${safeCompany ? `<tr><td style="padding:6px 12px 6px 0;color:#64748b;">Company</td><td style="padding:6px 0;">${safeCompany}</td></tr>` : ""}
        <tr><td style="padding:6px 12px 6px 0;color:#64748b;">Topic</td><td style="padding:6px 0;">${safeSubjectLabel}</td></tr>
      </table>
      <div style="margin-top:20px;padding:16px;background:#f1f5f9;border-radius:8px;">
        <p style="margin:0 0 8px 0;color:#64748b;font-size:12px;text-transform:uppercase;letter-spacing:0.5px;">Message</p>
        <p style="margin:0;line-height:1.6;">${safeMessage}</p>
      </div>
      <p style="margin-top:24px;font-size:12px;color:#94a3b8;">
        Reply directly to this email to respond to ${safeFullName} — the Reply-To header is set to their address.
      </p>
    </div>
  `

  try {
    await sendEmail({
      to: notificationTo,
      subject: `[${safeSubjectLabel}] ${safeFullName}${safeCompany ? ` (${safeCompany})` : ""}`,
      html: adminHtml,
      headers: { "Reply-To": email },
    })
  } catch (err) {
    console.error("[api/contact] admin notification failed:", err)
    // Still respond 200 — submitter's confirmation below proves acceptance.
  }

  // 2. Confirmation back to the submitter.
  const confirmHtml = `
    <div style="font-family:system-ui,sans-serif;max-width:520px;margin:0 auto;padding:24px;color:#0f172a;">
      <h2 style="margin:0 0 16px 0;">Thanks for reaching out 👋</h2>
      <p style="line-height:1.6;color:#334155;">Hi ${safeFirstName},</p>
      <p style="line-height:1.6;color:#334155;">
        We received your ${safeSubjectLabel.toLowerCase()} and someone from the PartsIQ team will be in touch within one business day.
      </p>
      <div style="margin:20px 0;padding:16px;background:#f1f5f9;border-radius:8px;font-size:14px;">
        <p style="margin:0 0 8px 0;color:#64748b;text-transform:uppercase;letter-spacing:0.5px;font-size:12px;">Your submission</p>
        <p style="margin:0 0 4px 0;"><strong>Topic:</strong> ${safeSubjectLabel}</p>
        ${safeCompany ? `<p style="margin:0 0 4px 0;"><strong>Company:</strong> ${safeCompany}</p>` : ""}
      </div>
      <p style="line-height:1.6;color:#334155;">
        While you wait, feel free to explore our
        <a href="${baseUrl}/solutions" style="color:#0891b2;">solutions</a> or
        <a href="${baseUrl}/pricing" style="color:#0891b2;">pricing</a>.
      </p>
      <p style="line-height:1.6;color:#64748b;margin-top:32px;font-size:14px;">— The PartsIQ team</p>
    </div>
  `

  try {
    await sendEmail({
      to: email,
      subject: "We received your message",
      html: confirmHtml,
    })
  } catch (err) {
    console.error("[api/contact] confirmation email failed:", err)
  }

  return NextResponse.json({ ok: true })
  }
);
