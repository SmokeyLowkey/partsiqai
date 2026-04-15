import type { Metadata } from "next"
import Link from "next/link"
import { Shield, Lock, FileText } from "lucide-react"
import { BreadcrumbJsonLd } from "@/components/seo/breadcrumb-jsonld"
import { PublicFooter } from "@/components/layout/public-footer"
import { LegalContactForm } from "@/components/legal/legal-contact-form"

export const metadata: Metadata = {
  title: "Privacy Policy",
  description:
    "Privacy Policy for PartsIQ — how we collect, use, and protect customer data including AI voice call recordings, email content, and parts procurement information.",
  alternates: { canonical: "/privacy" },
  robots: { index: true, follow: true },
}

const LAST_UPDATED = "April 15, 2026"

export default function PrivacyPage() {
  return (
    <>
      <BreadcrumbJsonLd
        items={[
          { name: "Home", url: "/" },
          { name: "Privacy Policy", url: "/privacy" },
        ]}
      />
      <div className="min-h-screen bg-white">
        {/* Hero */}
        <section className="relative bg-slate-950 text-white py-20">
          <div className="absolute inset-0 bg-[linear-gradient(rgba(148,163,184,0.05)_1px,transparent_1px),linear-gradient(90deg,rgba(148,163,184,0.05)_1px,transparent_1px)] bg-[size:64px_64px]" />
          <div className="relative container mx-auto px-6">
            <div className="max-w-3xl mx-auto text-center">
              <div className="inline-flex items-center gap-2 bg-emerald-500/10 border border-emerald-500/20 rounded-full px-4 py-1.5 text-emerald-400 text-sm font-medium mb-6">
                <Shield className="h-4 w-4" />
                Privacy
              </div>
              <h1 className="text-4xl md:text-5xl font-bold mb-4 tracking-tight">Privacy Policy</h1>
              <p className="text-lg text-slate-400">
                Effective {LAST_UPDATED}
              </p>
            </div>
          </div>
        </section>

        {/* Content */}
        <section className="py-16 bg-white">
          <div className="container mx-auto px-6">
            <article className="max-w-3xl mx-auto prose prose-slate prose-lg
              prose-headings:tracking-tight prose-headings:font-bold
              prose-h2:text-2xl prose-h2:mt-14 prose-h2:mb-4 prose-h2:pb-3 prose-h2:border-b prose-h2:border-slate-200
              prose-h3:text-lg prose-h3:mt-8 prose-h3:mb-3
              prose-p:leading-relaxed
              prose-a:text-emerald-600 prose-a:no-underline hover:prose-a:underline prose-a:font-medium
              prose-strong:text-slate-900
              prose-li:marker:text-emerald-500
              prose-table:text-sm">

              <p className="text-lg">
                This Privacy Policy explains how PartsIQ (&ldquo;PartsIQ&rdquo;, &ldquo;we&rdquo;, &ldquo;us&rdquo;) collects, uses, and shares information when you use our parts procurement platform (the &ldquo;Service&rdquo;). This Policy applies to customer administrators, team members, and visitors to our marketing site. It does not cover data that our customers collect about their own suppliers or contacts, which customers are responsible for under their own privacy practices.
              </p>

              <div className="not-prose my-8 rounded-lg border border-emerald-200 bg-emerald-50 p-5">
                <div className="flex items-start gap-3">
                  <Lock className="h-5 w-5 text-emerald-600 shrink-0 mt-0.5" />
                  <div>
                    <p className="font-semibold text-emerald-900 mb-1">Key points in plain language</p>
                    <ul className="text-sm text-emerald-900 leading-relaxed mb-0 space-y-1 pl-4 list-disc">
                      <li>We store parts data, supplier contact information, and email/call content you send through PartsIQ.</li>
                      <li>Calls placed by our AI voice agent on your behalf are recorded and transcribed.</li>
                      <li>We use third-party services (listed below) to process this data &mdash; AI models, voice calling, databases, email delivery.</li>
                      <li>We do not sell personal information. We do not use your identifiable data to train shared AI models.</li>
                      <li>You can export or delete your data at any time.</li>
                    </ul>
                  </div>
                </div>
              </div>

              <h2>1. Information We Collect</h2>

              <h3>1.1 Account and contact information</h3>
              <p>
                When you sign up, we collect your name, business email, phone number, company name, industry, company size, and password (hashed). We may collect billing information such as billing address and payment method via our payment processor (Stripe).
              </p>

              <h3>1.2 Customer Content</h3>
              <p>
                Through normal use of the Service, you submit and generate data we call &ldquo;Customer Content&rdquo;:
              </p>
              <ul>
                <li>Parts catalogs, part numbers, descriptions, specifications, and pricing</li>
                <li>Supplier records including names, phone numbers, emails, and specialties</li>
                <li>Quote requests and supplier responses</li>
                <li>Purchase orders and order fulfillment data</li>
                <li>Vehicle and equipment records (make, model, serial number, maintenance schedules)</li>
                <li>Uploaded maintenance manuals (PDFs) and documents</li>
              </ul>

              <h3>1.3 AI voice agent call data</h3>
              <p>
                When you authorize the AI voice agent to call suppliers on your behalf, we collect and retain:
              </p>
              <ul>
                <li><strong>Call audio recordings</strong> of the full conversation between the AI and the supplier</li>
                <li><strong>Call transcripts</strong> generated from the audio</li>
                <li><strong>Extracted structured data</strong> (prices, availability, lead times) parsed from the conversation</li>
                <li>Call metadata: caller ID, recipient number, duration, timestamps, call status</li>
              </ul>
              <p>
                Call recordings and transcripts are retained for the life of your subscription and for 90 days after cancellation, unless you request earlier deletion.
              </p>

              <h3>1.4 Email integration data</h3>
              <p>
                If you connect a Gmail or Microsoft 365 account via OAuth, we read and send emails within the scope you authorize (typically: emails related to quote requests you initiate through the Service). Email content is stored for quote extraction, audit, and procurement-history purposes.
              </p>

              <h3>1.5 Usage and technical data</h3>
              <p>
                We collect technical data to operate and improve the Service:
              </p>
              <ul>
                <li>Log data (pages visited, features used, timestamps)</li>
                <li>Device and browser information, IP address, approximate location from IP</li>
                <li>Product analytics events (via PostHog &mdash; our analytics provider; see &sect; 4)</li>
                <li>Session replays on our marketing site (form inputs are masked)</li>
              </ul>

              <h2>2. How We Use Your Information</h2>
              <p>We use collected information to:</p>
              <ul>
                <li>Provide the Service &mdash; source parts, call suppliers, compare quotes, manage orders</li>
                <li>Process AI inference on your data (parts search, quote extraction, call transcription)</li>
                <li>Operate billing and manage your subscription</li>
                <li>Provide customer support and communicate service notices</li>
                <li>Monitor security and detect abuse</li>
                <li>Improve our AI models using <strong>aggregated, de-identified data only</strong> &mdash; we do not use identifiable Customer Content to train general-purpose AI models</li>
                <li>Comply with legal obligations</li>
              </ul>

              <h2>3. Legal Bases for Processing (GDPR)</h2>
              <p>
                If you are in the European Economic Area, United Kingdom, or another region with similar data protection laws, we rely on the following legal bases:
              </p>
              <ul>
                <li><strong>Contract:</strong> Processing necessary to provide the Service you subscribed to.</li>
                <li><strong>Legitimate interests:</strong> Improving the Service, securing our platform, preventing fraud, and operating our business, balanced against your privacy interests.</li>
                <li><strong>Consent:</strong> Where required (e.g., certain marketing communications), we rely on your consent, which you can withdraw at any time.</li>
                <li><strong>Legal obligation:</strong> Where we must retain data for tax, accounting, or other regulatory reasons.</li>
              </ul>

              <h2>4. Sub-Processors</h2>
              <p>
                We use the following third-party services to operate the Service. Each has their own privacy policy and data-handling practices. Using the Service requires that Customer Content is transmitted to these sub-processors as necessary.
              </p>

              <div className="not-prose overflow-x-auto my-6">
                <table className="w-full border-collapse text-sm">
                  <thead className="bg-slate-100">
                    <tr>
                      <th className="text-left p-3 font-semibold border-b border-slate-200">Sub-processor</th>
                      <th className="text-left p-3 font-semibold border-b border-slate-200">Purpose</th>
                      <th className="text-left p-3 font-semibold border-b border-slate-200">Data processed</th>
                    </tr>
                  </thead>
                  <tbody>
                    <tr>
                      <td className="p-3 border-b border-slate-100"><strong>Vapi</strong></td>
                      <td className="p-3 border-b border-slate-100">AI voice calling, recording, transcription</td>
                      <td className="p-3 border-b border-slate-100">Call audio, transcripts, phone numbers</td>
                    </tr>
                    <tr className="bg-slate-50/50">
                      <td className="p-3 border-b border-slate-100"><strong>OpenRouter</strong> (routes to Anthropic, OpenAI, others)</td>
                      <td className="p-3 border-b border-slate-100">Large-language-model inference</td>
                      <td className="p-3 border-b border-slate-100">Conversation text, parts queries, email content passed to the model for processing</td>
                    </tr>
                    <tr>
                      <td className="p-3 border-b border-slate-100"><strong>Mistral AI</strong></td>
                      <td className="p-3 border-b border-slate-100">Optical character recognition (PDF parsing)</td>
                      <td className="p-3 border-b border-slate-100">Uploaded maintenance manuals and documents</td>
                    </tr>
                    <tr className="bg-slate-50/50">
                      <td className="p-3 border-b border-slate-100"><strong>Pinecone</strong></td>
                      <td className="p-3 border-b border-slate-100">Vector database for semantic parts search</td>
                      <td className="p-3 border-b border-slate-100">Parts descriptions, embeddings, metadata</td>
                    </tr>
                    <tr>
                      <td className="p-3 border-b border-slate-100"><strong>Neo4j</strong></td>
                      <td className="p-3 border-b border-slate-100">Graph database for parts relationships</td>
                      <td className="p-3 border-b border-slate-100">Parts-to-equipment-to-supplier relationships</td>
                    </tr>
                    <tr className="bg-slate-50/50">
                      <td className="p-3 border-b border-slate-100"><strong>Serper</strong></td>
                      <td className="p-3 border-b border-slate-100">Web search for parts lookups</td>
                      <td className="p-3 border-b border-slate-100">Parts search queries</td>
                    </tr>
                    <tr>
                      <td className="p-3 border-b border-slate-100"><strong>Resend</strong></td>
                      <td className="p-3 border-b border-slate-100">Transactional email delivery</td>
                      <td className="p-3 border-b border-slate-100">Recipient emails, email content for verification, notifications, supplier correspondence</td>
                    </tr>
                    <tr className="bg-slate-50/50">
                      <td className="p-3 border-b border-slate-100"><strong>Stripe</strong></td>
                      <td className="p-3 border-b border-slate-100">Payment processing</td>
                      <td className="p-3 border-b border-slate-100">Billing name, address, payment method (Stripe handles card data; we do not store card numbers)</td>
                    </tr>
                    <tr>
                      <td className="p-3 border-b border-slate-100"><strong>Google Workspace / Microsoft 365</strong></td>
                      <td className="p-3 border-b border-slate-100">Email integration via OAuth</td>
                      <td className="p-3 border-b border-slate-100">Email content within the OAuth scope you authorize</td>
                    </tr>
                    <tr className="bg-slate-50/50">
                      <td className="p-3 border-b border-slate-100"><strong>PostHog</strong></td>
                      <td className="p-3 border-b border-slate-100">Product analytics and session replay</td>
                      <td className="p-3 border-b border-slate-100">Event data, anonymous identifiers, masked session recordings (form inputs are masked)</td>
                    </tr>
                    <tr>
                      <td className="p-3 border-b border-slate-100"><strong>Neon / PostgreSQL host</strong></td>
                      <td className="p-3 border-b border-slate-100">Primary application database</td>
                      <td className="p-3 border-b border-slate-100">All Customer Content and account data</td>
                    </tr>
                    <tr className="bg-slate-50/50">
                      <td className="p-3 border-b border-slate-100"><strong>Redis host</strong></td>
                      <td className="p-3 border-b border-slate-100">Caching and session storage</td>
                      <td className="p-3 border-b border-slate-100">Short-lived cache data, session tokens</td>
                    </tr>
                    <tr>
                      <td className="p-3"><strong>Vercel</strong> (or equivalent cloud hosting)</td>
                      <td className="p-3">Application hosting and content delivery</td>
                      <td className="p-3">All data transiting the Service</td>
                    </tr>
                  </tbody>
                </table>
              </div>

              <p>
                We do not sell or rent Customer Content or personal information to any third party. We do not share Customer Content with advertising networks.
              </p>

              <h2>5. Data Retention</h2>
              <table>
                <thead>
                  <tr>
                    <th>Data type</th>
                    <th>Retention period</th>
                  </tr>
                </thead>
                <tbody>
                  <tr><td>Account and profile data</td><td>Life of subscription + 30 days after cancellation</td></tr>
                  <tr><td>Parts catalogs, quotes, orders</td><td>Life of subscription + 30 days after cancellation</td></tr>
                  <tr><td>Call audio recordings</td><td>Life of subscription + 90 days after cancellation</td></tr>
                  <tr><td>Call transcripts and extracted quote data</td><td>Life of subscription + 90 days after cancellation</td></tr>
                  <tr><td>Email content (Gmail/Microsoft integration)</td><td>Revoked when you disconnect the OAuth integration</td></tr>
                  <tr><td>Billing records (legal retention)</td><td>7 years from transaction date</td></tr>
                  <tr><td>Security logs</td><td>12 months</td></tr>
                  <tr><td>Product analytics (PostHog)</td><td>12 months</td></tr>
                </tbody>
              </table>
              <p>
                You can request earlier deletion by contacting us (see &sect; 9). Some records may persist longer in backups before being purged.
              </p>

              <h2>6. Security</h2>
              <p>
                We implement technical and organizational measures appropriate to the nature of the data:
              </p>
              <ul>
                <li><strong>In transit:</strong> All connections to the Service use TLS 1.2 or higher.</li>
                <li><strong>At rest:</strong> Databases and call recordings are encrypted at rest by our hosting providers.</li>
                <li><strong>Access controls:</strong> Role-based access inside the platform; internal team access limited to need-to-know.</li>
                <li><strong>OAuth credentials:</strong> Third-party service credentials are stored encrypted and scoped narrowly.</li>
                <li><strong>Monitoring:</strong> Security logs are monitored for anomalies.</li>
              </ul>
              <p>
                No system is perfectly secure. In the event of a data breach affecting your information, we will notify you without undue delay as required by applicable law.
              </p>

              <h2>7. International Data Transfers</h2>
              <p>
                Our infrastructure and sub-processors may store or process data in the United States, Canada, European Union, and other regions. Where required, transfers from the EEA, UK, or Switzerland to the United States and other non-adequate jurisdictions are protected by Standard Contractual Clauses or equivalent safeguards.
              </p>

              <h2>8. Your Rights</h2>

              <h3>8.1 All users</h3>
              <p>Regardless of where you live, you can:</p>
              <ul>
                <li>Access and export your Customer Content via the Service</li>
                <li>Correct inaccurate account information in your settings</li>
                <li>Delete your account and Customer Content (see &sect; 5)</li>
                <li>Disconnect third-party integrations (Gmail, Microsoft) at any time</li>
              </ul>

              <h3>8.2 European Economic Area, UK, Switzerland (GDPR / UK GDPR)</h3>
              <p>
                You have additional rights including: access, rectification, erasure, restriction of processing, data portability, objection to processing, and the right to lodge a complaint with a supervisory authority. To exercise these rights, contact us via the form at the bottom of this page.
              </p>

              <h3>8.3 California residents (CCPA / CPRA)</h3>
              <p>
                California residents have the right to:
              </p>
              <ul>
                <li>Know what personal information we collect and how we use it (disclosed in this Policy)</li>
                <li>Access specific pieces of personal information</li>
                <li>Delete personal information (subject to legal exceptions)</li>
                <li>Opt out of the sale or sharing of personal information &mdash; <strong>we do not sell or share personal information for cross-context behavioral advertising</strong></li>
                <li>Non-discrimination for exercising these rights</li>
              </ul>
              <p>
                To exercise these rights, contact us via the form at the bottom of this page.
              </p>

              <h3>8.4 Canadian residents (PIPEDA)</h3>
              <p>
                If you are in Canada, you may request access to or correction of your personal information, or lodge a complaint with the Office of the Privacy Commissioner of Canada. Contact <a href="mailto:privacy@partsiqai.com">privacy@partsiqai.com</a>.
              </p>

              <h2>9. Call Recording and Supplier Data</h2>
              <p>
                When you use the AI voice agent to call suppliers, the supplier is a data subject whose information we process on your behalf. We record calls and transcribe conversations as described in &sect; 1.3. <strong>You, the customer, are responsible for ensuring you have the right to initiate these calls and that recording is lawful in the jurisdictions of both parties.</strong> Our Terms of Service (&sect; 3.3) describe these obligations in detail.
              </p>
              <p>
                If a supplier requests that we delete a recording of a call placed from your account, we will work with you to honor that request, and we reserve the right to comply directly with such requests where required by law.
              </p>

              <h2>10. Cookies and Similar Technologies</h2>
              <p>
                We use essential cookies for authentication and session management. We use analytics cookies (via PostHog) to understand product usage. We do not use advertising or cross-site tracking cookies. You can control cookies via your browser settings; disabling essential cookies will prevent you from logging in.
              </p>

              <h2>11. Children&rsquo;s Privacy</h2>
              <p>
                The Service is intended for business use and is not directed at individuals under 18. We do not knowingly collect personal information from children. If we learn we have collected information from a child, we will delete it.
              </p>

              <h2>12. Changes to This Policy</h2>
              <p>
                We may update this Policy from time to time. For material changes, we will provide at least 30 days&rsquo; notice by email or in-app notification. The &ldquo;Effective&rdquo; date at the top reflects the most recent update.
              </p>

              <h2>13. Contact Us</h2>
              <p>
                For privacy questions, data access/deletion requests, or complaints, use the form below. Submissions are routed directly to our team and you&rsquo;ll receive a confirmation email.
              </p>
              <div className="not-prose my-6">
                <LegalContactForm requestType="privacy" />
              </div>

              <div className="not-prose mt-12 rounded-lg border border-slate-200 bg-slate-50 p-5 text-sm text-slate-600">
                <div className="flex items-start gap-3">
                  <FileText className="h-4 w-4 text-slate-500 shrink-0 mt-0.5" />
                  <p className="leading-relaxed m-0">
                    This Policy describes our current practices in good faith. For a customized Data Processing Addendum (DPA) suitable for enterprise or regulated-industry customers, please contact us.
                  </p>
                </div>
              </div>
            </article>
          </div>
        </section>
      </div>
      <PublicFooter />
    </>
  )
}
