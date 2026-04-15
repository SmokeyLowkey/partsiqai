import { NextResponse } from "next/server"
import { sendEmail, getBaseUrl } from "@/lib/email/resend"
import { escapeHtml } from "@/lib/sanitize"

/**
 * Inbound submissions from the legal/privacy contact form. Routes the
 * request to the admin notification inbox via Resend and replies to the
 * submitter with a confirmation.
 *
 * Env configuration (any one works, resolved in order):
 *   LEGAL_NOTIFICATION_EMAIL  (optional — dedicated legal inbox)
 *   ADMIN_NOTIFICATION_EMAIL  (fallback — general admin inbox)
 *   LEADS_NOTIFICATION_EMAIL  (fallback — reuses leads inbox)
 *   onboarding@partsiqai.com  (final fallback — verified sender on Resend)
 */

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
const TYPE_LABELS: Record<string, string> = {
  legal: "General / Terms question",
  privacy: "Privacy question",
  data_request: "Data access / deletion request",
}

export async function POST(request: Request) {
  let body: unknown
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 })
  }

  const { name, email, subject, message, type } = (body ?? {}) as {
    name?: string
    email?: string
    subject?: string
    message?: string
    type?: string
  }

  // Basic validation — the form enforces these client-side, but the
  // server still verifies since the endpoint is public.
  if (!name || typeof name !== "string" || name.length > 200) {
    return NextResponse.json({ error: "Name required (max 200 chars)" }, { status: 400 })
  }
  if (!email || typeof email !== "string" || !EMAIL_RE.test(email)) {
    return NextResponse.json({ error: "Valid email required" }, { status: 400 })
  }
  if (!subject || typeof subject !== "string" || subject.length > 300) {
    return NextResponse.json({ error: "Subject required (max 300 chars)" }, { status: 400 })
  }
  if (!message || typeof message !== "string" || message.length > 5000) {
    return NextResponse.json({ error: "Message required (max 5000 chars)" }, { status: 400 })
  }
  const safeType = typeof type === "string" && type in TYPE_LABELS ? type : "legal"

  const notificationTo =
    process.env.LEGAL_NOTIFICATION_EMAIL ||
    process.env.ADMIN_NOTIFICATION_EMAIL ||
    process.env.LEADS_NOTIFICATION_EMAIL ||
    "onboarding@partsiqai.com"

  const safeName = escapeHtml(name)
  const safeEmail = escapeHtml(email)
  const safeSubject = escapeHtml(subject)
  const safeTypeLabel = escapeHtml(TYPE_LABELS[safeType])
  // Preserve newlines in the message when rendering as HTML
  const safeMessage = escapeHtml(message).replace(/\n/g, "<br />")
  const baseUrl = getBaseUrl()

  // 1. Route the request to the admin inbox (the "send a copy to master admin" flow).
  // Set replyTo to the submitter so admin can reply directly from their inbox.
  const adminHtml = `
    <div style="font-family:system-ui,sans-serif;max-width:640px;margin:0 auto;color:#0f172a;">
      <h2 style="margin:0 0 8px 0;">New ${safeTypeLabel}</h2>
      <p style="color:#64748b;margin:0 0 20px 0;font-size:14px;">
        Submitted via the ${safeType === "privacy" || safeType === "data_request" ? "Privacy Policy" : "Terms of Service"} page on partsiqai.com
      </p>
      <table style="width:100%;border-collapse:collapse;font-size:14px;">
        <tr><td style="padding:6px 12px 6px 0;color:#64748b;width:100px;">Name</td><td style="padding:6px 0;"><strong>${safeName}</strong></td></tr>
        <tr><td style="padding:6px 12px 6px 0;color:#64748b;">Email</td><td style="padding:6px 0;"><strong>${safeEmail}</strong></td></tr>
        <tr><td style="padding:6px 12px 6px 0;color:#64748b;">Type</td><td style="padding:6px 0;">${safeTypeLabel}</td></tr>
        <tr><td style="padding:6px 12px 6px 0;color:#64748b;">Subject</td><td style="padding:6px 0;">${safeSubject}</td></tr>
      </table>
      <div style="margin-top:20px;padding:16px;background:#f1f5f9;border-radius:8px;">
        <p style="margin:0 0 8px 0;color:#64748b;font-size:12px;text-transform:uppercase;letter-spacing:0.5px;">Message</p>
        <p style="margin:0;line-height:1.6;">${safeMessage}</p>
      </div>
      <p style="margin-top:24px;font-size:12px;color:#94a3b8;">
        Reply directly to this email to respond to ${safeName} — the Reply-To header is set to their address.
      </p>
    </div>
  `

  try {
    await sendEmail({
      to: notificationTo,
      subject: `[${safeTypeLabel}] ${subject} — from ${name}`,
      html: adminHtml,
      headers: { "Reply-To": email },
    })
  } catch (err) {
    console.error("[api/legal-contact] admin notification failed:", err)
    // Still reply 200 to user so they know their message was accepted —
    // but log so we can investigate. The confirmation email below gives
    // the user proof of submission either way.
  }

  // 2. Confirmation back to the submitter.
  const confirmHtml = `
    <div style="font-family:system-ui,sans-serif;max-width:520px;margin:0 auto;padding:24px;color:#0f172a;">
      <h2 style="margin:0 0 16px 0;">We received your ${safeTypeLabel.toLowerCase()}</h2>
      <p style="line-height:1.6;color:#334155;">Hi ${safeName},</p>
      <p style="line-height:1.6;color:#334155;">
        Thanks for reaching out. We&rsquo;ve logged your submission and someone from our team will respond within 3 business days — sooner for formal data-access requests.
      </p>
      <div style="margin:20px 0;padding:16px;background:#f1f5f9;border-radius:8px;font-size:14px;">
        <p style="margin:0 0 8px 0;color:#64748b;text-transform:uppercase;letter-spacing:0.5px;font-size:12px;">Your submission</p>
        <p style="margin:0 0 4px 0;"><strong>Subject:</strong> ${safeSubject}</p>
        <p style="margin:0 0 4px 0;"><strong>Type:</strong> ${safeTypeLabel}</p>
      </div>
      <p style="line-height:1.6;color:#334155;">
        In the meantime, you can review our
        <a href="${baseUrl}/terms" style="color:#0891b2;">Terms of Service</a> and
        <a href="${baseUrl}/privacy" style="color:#0891b2;">Privacy Policy</a>.
      </p>
      <p style="line-height:1.6;color:#64748b;margin-top:32px;font-size:14px;">
        — The PartsIQ team
      </p>
    </div>
  `

  try {
    await sendEmail({
      to: email,
      subject: "We received your request",
      html: confirmHtml,
    })
  } catch (err) {
    console.error("[api/legal-contact] confirmation email failed:", err)
  }

  return NextResponse.json({ ok: true })
}
