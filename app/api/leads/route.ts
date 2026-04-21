import { NextResponse } from "next/server"
import { sendEmail, getBaseUrl } from "@/lib/email/resend"
import { escapeHtml } from "@/lib/sanitize"
import { withHardening } from "@/lib/api/with-hardening"

// Basic email regex — good enough for UX validation (server still trusts Resend to reject truly bad addresses)
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

// Public lead-capture form (blog CTAs). IP-keyed rate limit to throttle spam.
export const POST = withHardening(
  {
    requireSession: false,
    rateLimit: { limit: 10, windowSeconds: 900, prefix: "leads-form", keyBy: "ip" },
  },
  async (request: Request) => {
  let body: unknown
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 })
  }

  const { email, source, postSlug, postTitle, leadMagnet } = (body ?? {}) as {
    email?: string
    source?: string
    postSlug?: string
    postTitle?: string
    leadMagnet?: string
  }

  if (!email || typeof email !== "string" || !EMAIL_RE.test(email)) {
    return NextResponse.json({ error: "Valid email required" }, { status: 400 })
  }

  const notificationTo =
    process.env.LEADS_NOTIFICATION_EMAIL ||
    process.env.ADMIN_NOTIFICATION_EMAIL ||
    "onboarding@partsiqai.com"

  const safeEmail = escapeHtml(email)
  const safeSource = escapeHtml(source || "unknown")
  const safePostTitle = escapeHtml(postTitle || "")
  const safePostSlug = escapeHtml(postSlug || "")
  const safeLeadMagnet = escapeHtml(leadMagnet || "")

  const baseUrl = getBaseUrl()
  const postLink = postSlug ? `${baseUrl}/blog/${safePostSlug}` : ""

  // 1. Sales / ops notification
  const notificationHtml = `
    <h2 style="font-family:system-ui,sans-serif;color:#0f172a;">New lead captured</h2>
    <table style="font-family:system-ui,sans-serif;border-collapse:collapse;">
      <tr><td style="padding:4px 12px 4px 0;color:#64748b;">Email</td><td style="padding:4px 0;"><strong>${safeEmail}</strong></td></tr>
      <tr><td style="padding:4px 12px 4px 0;color:#64748b;">Source</td><td style="padding:4px 0;">${safeSource}</td></tr>
      ${safeLeadMagnet ? `<tr><td style="padding:4px 12px 4px 0;color:#64748b;">Lead magnet</td><td style="padding:4px 0;">${safeLeadMagnet}</td></tr>` : ""}
      ${safePostTitle ? `<tr><td style="padding:4px 12px 4px 0;color:#64748b;">Post</td><td style="padding:4px 0;"><a href="${postLink}">${safePostTitle}</a></td></tr>` : ""}
    </table>
  `

  try {
    await sendEmail({
      to: notificationTo,
      subject: `New lead: ${email}${postTitle ? ` (from "${postTitle}")` : ""}`,
      html: notificationHtml,
    })
  } catch (err) {
    console.error("[api/leads] notification email failed:", err)
    // don't fail the request — we still want the lead captured on the client
  }

  // 2. Confirmation to the lead themselves
  const confirmationHtml = `
    <div style="font-family:system-ui,sans-serif;max-width:520px;margin:0 auto;padding:24px;color:#0f172a;">
      <h2 style="margin:0 0 16px 0;">Thanks for reaching out 👋</h2>
      <p style="line-height:1.6;color:#334155;">
        We got your request and someone from the PartsIQ team will be in touch shortly.
      </p>
      <p style="line-height:1.6;color:#334155;">
        In the meantime, feel free to explore our
        <a href="${baseUrl}/solutions" style="color:#0891b2;">solutions</a>
        or book a demo directly at
        <a href="${baseUrl}/contact" style="color:#0891b2;">${baseUrl}/contact</a>.
      </p>
      <p style="line-height:1.6;color:#64748b;margin-top:32px;font-size:14px;">
        — The PartsIQ team
      </p>
    </div>
  `

  try {
    await sendEmail({
      to: email,
      subject: "Thanks — we'll be in touch",
      html: confirmationHtml,
    })
  } catch (err) {
    console.error("[api/leads] confirmation email failed:", err)
  }

  return NextResponse.json({ ok: true })
  }
);
