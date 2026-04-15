import type { Metadata } from "next"
import Link from "next/link"
import { Scale, FileText, AlertTriangle } from "lucide-react"
import { BreadcrumbJsonLd } from "@/components/seo/breadcrumb-jsonld"
import { PublicFooter } from "@/components/layout/public-footer"
import { LegalContactForm } from "@/components/legal/legal-contact-form"

export const metadata: Metadata = {
  title: "Terms of Service",
  description:
    "Terms of Service for PartsIQ — an AI-powered parts procurement platform. Covers the AI voice agent, supplier calling, subscription terms, and acceptable use.",
  alternates: { canonical: "/terms" },
  robots: { index: true, follow: true },
}

const LAST_UPDATED = "April 15, 2026"

export default function TermsPage() {
  return (
    <>
      <BreadcrumbJsonLd
        items={[
          { name: "Home", url: "/" },
          { name: "Terms of Service", url: "/terms" },
        ]}
      />
      <div className="min-h-screen bg-white">
        {/* Hero */}
        <section className="relative bg-slate-950 text-white py-20">
          <div className="absolute inset-0 bg-[linear-gradient(rgba(148,163,184,0.05)_1px,transparent_1px),linear-gradient(90deg,rgba(148,163,184,0.05)_1px,transparent_1px)] bg-[size:64px_64px]" />
          <div className="relative container mx-auto px-6">
            <div className="max-w-3xl mx-auto text-center">
              <div className="inline-flex items-center gap-2 bg-emerald-500/10 border border-emerald-500/20 rounded-full px-4 py-1.5 text-emerald-400 text-sm font-medium mb-6">
                <Scale className="h-4 w-4" />
                Legal
              </div>
              <h1 className="text-4xl md:text-5xl font-bold mb-4 tracking-tight">Terms of Service</h1>
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
              prose-li:marker:text-emerald-500">

              <p className="text-lg">
                These Terms of Service (&ldquo;Terms&rdquo;) govern your access to and use of the PartsIQ platform operated by PartsIQ (&ldquo;PartsIQ&rdquo;, &ldquo;we&rdquo;, &ldquo;us&rdquo;). By creating an account or using the Service, you (&ldquo;Customer&rdquo;, &ldquo;you&rdquo;) agree to these Terms. If you are agreeing on behalf of an organization, you represent that you have the authority to bind that organization to these Terms.
              </p>

              <div className="not-prose my-8 rounded-lg border border-amber-200 bg-amber-50 p-5">
                <div className="flex items-start gap-3">
                  <AlertTriangle className="h-5 w-5 text-amber-600 shrink-0 mt-0.5" />
                  <div>
                    <p className="font-semibold text-amber-900 mb-1">Please read carefully</p>
                    <p className="text-sm text-amber-900 leading-relaxed">
                      These Terms contain important provisions including authorization for PartsIQ to place phone calls to suppliers on your behalf using AI voice technology, a limitation of liability, and a disclaimer of warranties. By using the Service you acknowledge these provisions.
                    </p>
                  </div>
                </div>
              </div>

              <h2>1. The Service</h2>
              <p>
                PartsIQ provides a software-as-a-service platform for parts procurement, inventory management, and supplier communication, including but not limited to:
              </p>
              <ul>
                <li>AI-powered parts search across multiple databases</li>
                <li>An AI voice agent that places outbound telephone calls to your suppliers to request quotes and availability</li>
                <li>Automated email correspondence with suppliers for quote requests and follow-ups</li>
                <li>Quote comparison and procurement workflow tools</li>
                <li>Order management and tracking</li>
                <li>Integrations with email providers (Gmail, Microsoft) and payment processors</li>
              </ul>
              <p>
                We may modify, update, or discontinue features from time to time. Material changes that reduce core functionality will be communicated with at least 30 days&rsquo; notice.
              </p>

              <h2>2. Accounts and Eligibility</h2>
              <p>
                To use the Service you must be at least 18 years old and capable of forming a binding contract. You must provide accurate registration information and keep it current. You are responsible for maintaining the confidentiality of your credentials and for all activity that occurs under your account.
              </p>
              <p>
                The Service is intended for business use. You may not use the Service for personal, household, or consumer purposes.
              </p>

              <h2>3. AI Voice Agent &mdash; Authorization to Call Suppliers on Your Behalf</h2>
              <p>
                The Service includes an AI voice agent that places outbound phone calls to suppliers and other business contacts you designate, to request pricing, availability, and other business information on your behalf.
              </p>

              <h3>3.1 Your authorization</h3>
              <p>
                By adding a supplier or business contact to the Service and initiating a quote request or call, you expressly authorize PartsIQ to place telephone calls to that contact on your behalf. You represent and warrant that:
              </p>
              <ul>
                <li>You have an existing business relationship with the contact, or otherwise have the lawful right to initiate commercial communications with that contact;</li>
                <li>The contact information you provide is accurate and relates to a business line;</li>
                <li>You have the authority to authorize communications on behalf of the organization operating the account;</li>
                <li>You will comply with all applicable laws governing automated and AI-assisted communications in your jurisdiction and the contact&rsquo;s jurisdiction, including but not limited to the Telephone Consumer Protection Act (TCPA) in the United States, the Canadian Anti-Spam Legislation (CASL) in Canada, and analogous laws elsewhere.</li>
              </ul>

              <h3>3.2 AI identification on calls</h3>
              <p>
                Our AI voice agent is configured to identify itself as an automated AI assistant at the beginning of each call and to disclose that it is calling on your behalf. You acknowledge that AI identification is a legal requirement in many jurisdictions and agree not to disable or circumvent this disclosure.
              </p>

              <h3>3.3 Call recording and transcription</h3>
              <p>
                Calls placed through the Service are recorded and transcribed for quality, record-keeping, training, and service-improvement purposes. You are responsible for ensuring that the recording of the call is lawful in the jurisdictions of both parties to the call, including two-party consent states in the United States (California, Florida, Illinois, Maryland, Massachusetts, New Hampshire, New Jersey, Pennsylvania, Washington, and others). Our AI voice agent is configured to announce that the call may be recorded; you agree not to disable or circumvent this announcement.
              </p>

              <h3>3.4 Non-binding nature of AI-obtained quotes</h3>
              <p>
                Pricing, availability, and other information gathered by the AI voice agent is provided for your informational use only. The AI voice agent does not enter binding purchase agreements on your behalf. You are responsible for reviewing the quotes collected and confirming any purchase order directly with the supplier through the Service or otherwise.
              </p>

              <h3>3.5 Your responsibility for communications</h3>
              <p>
                You are solely responsible for the content and consequences of communications sent from your account, including calls placed by the AI voice agent on your behalf, emails sent via the Service, and follow-up actions taken by suppliers in reliance on those communications. PartsIQ does not warrant that the AI voice agent will achieve any particular outcome, accurately transcribe every exchange, or avoid misunderstandings in conversation.
              </p>

              <h2>4. Subscription, Billing, and Trial</h2>

              <h3>4.1 Free trial</h3>
              <p>
                We offer a 14-day free trial. No credit card is required to begin the trial. At the end of the trial, continued use of the Service requires a paid subscription. We may modify or discontinue the trial offering at any time.
              </p>

              <h3>4.2 Subscription fees</h3>
              <p>
                Subscription fees are billed monthly at the price in effect at the time of subscription, as published on our <Link href="/pricing">pricing page</Link>. Fees are charged in advance and are non-refundable except as expressly stated or as required by applicable law. All fees are stated in U.S. dollars unless otherwise indicated.
              </p>

              <h3>4.3 Usage-based fees</h3>
              <p>
                Certain features, including AI voice agent calls, may be subject to usage limits or usage-based charges as described in your plan. Overage may be billed separately at rates published on the pricing page or communicated in-app.
              </p>

              <h3>4.4 Price changes</h3>
              <p>
                We may change subscription prices with at least 30 days&rsquo; notice. Price changes take effect at the start of the next billing period after the notice period.
              </p>

              <h3>4.5 Cancellation</h3>
              <p>
                You may cancel your subscription at any time from your account settings. Cancellation takes effect at the end of the current billing period. You retain access to the Service through the end of the period you paid for. We do not issue refunds for partial months except where required by law.
              </p>

              <h3>4.6 Suspension and termination by us</h3>
              <p>
                We may suspend or terminate your account for non-payment, breach of these Terms, misuse of the AI voice agent (including violations of TCPA or analogous laws), or security concerns. We will generally provide notice and an opportunity to cure, except where immediate action is necessary to protect the Service or third parties.
              </p>

              <h2>5. Your Data and Content</h2>

              <h3>5.1 Ownership</h3>
              <p>
                You retain all ownership of data and content you submit to or generate through the Service, including your parts catalogs, supplier lists, quote requests, orders, vehicle data, and email content (&ldquo;Customer Data&rdquo;). PartsIQ does not claim ownership of Customer Data.
              </p>

              <h3>5.2 License to PartsIQ</h3>
              <p>
                You grant PartsIQ a worldwide, non-exclusive, royalty-free license to host, copy, transmit, and process Customer Data solely to provide, maintain, and improve the Service for you.
              </p>

              <h3>5.3 AI model training</h3>
              <p>
                We may use Customer Data in aggregated and de-identified form to improve the accuracy of our AI systems. We do not use your identifiable Customer Data to train general-purpose AI models shared with other customers, and we do not share Customer Data with third-party LLM providers for training purposes.
              </p>

              <h3>5.4 Data export and deletion</h3>
              <p>
                You can export your Customer Data in machine-readable form at any time via the Service. Upon termination, we retain Customer Data for 30 days to allow export, after which Customer Data is deleted from active systems. Certain records may persist in backups, access logs, or financial records where retention is required by law.
              </p>

              <h2>6. Acceptable Use</h2>
              <p>You agree not to:</p>
              <ul>
                <li>Use the Service to initiate communications you are not authorized to initiate, including unsolicited commercial calls prohibited by TCPA, CASL, or analogous laws;</li>
                <li>Use the AI voice agent to harass, defraud, mislead, or coerce suppliers or other recipients;</li>
                <li>Circumvent the AI identification or recording disclosure configured into the voice agent;</li>
                <li>Use the Service to violate antitrust, competition, or pricing laws (including illegal price-fixing, bid-rigging, or collusion with competitors);</li>
                <li>Reverse engineer, decompile, or attempt to derive the source code of the Service;</li>
                <li>Upload malicious code, attempt to disrupt the Service, or perform security probing without written authorization;</li>
                <li>Resell, sublicense, or repackage the Service;</li>
                <li>Use the Service in violation of any applicable law.</li>
              </ul>

              <h2>7. Third-Party Services</h2>
              <p>
                The Service integrates with third-party services including, without limitation, Vapi (voice calling), OpenRouter and underlying LLM providers (AI inference), Mistral (document parsing), Pinecone (vector search), Neo4j (graph database), Resend (transactional email), Stripe (payment processing), Google Workspace / Microsoft 365 (email integration via OAuth), and Serper (web search). Your use of these integrations is subject to the third-party providers&rsquo; terms and privacy policies. A current list of sub-processors is maintained in our <Link href="/privacy">Privacy Policy</Link>.
              </p>

              <h2>8. Intellectual Property</h2>
              <p>
                PartsIQ and its licensors own all right, title, and interest in the Service, including the software, user interface, underlying technology, and documentation. We grant you a limited, non-exclusive, non-transferable, revocable license to access and use the Service during your subscription term, solely for your internal business purposes. All rights not expressly granted are reserved.
              </p>
              <p>
                All trademarks, brand names, and logos of third parties referenced on our marketing pages (including equipment manufacturer names such as Caterpillar, Komatsu, John Deere, Bobcat, Kubota, and others) are the property of their respective owners. Reference to such trademarks on our marketing pages is under nominative fair use and does not imply endorsement, sponsorship, or affiliation.
              </p>

              <h2>9. Disclaimer of Warranties</h2>
              <p>
                THE SERVICE IS PROVIDED &ldquo;AS IS&rdquo; AND &ldquo;AS AVAILABLE&rdquo;, WITHOUT WARRANTIES OF ANY KIND, EITHER EXPRESS OR IMPLIED. TO THE FULLEST EXTENT PERMITTED BY LAW, PARTSIQ DISCLAIMS ALL WARRANTIES INCLUDING IMPLIED WARRANTIES OF MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE, NON-INFRINGEMENT, AND ANY WARRANTY ARISING FROM COURSE OF DEALING OR USAGE OF TRADE.
              </p>
              <p>
                WITHOUT LIMITING THE FOREGOING, PARTSIQ DOES NOT WARRANT THAT: (A) THE AI VOICE AGENT WILL ACCURATELY CAPTURE ALL INFORMATION OR ACHIEVE ANY PARTICULAR OUTCOME; (B) AI-GENERATED SEARCH RESULTS, PART MATCHES, OR QUOTE EXTRACTIONS WILL BE FREE OF ERRORS; (C) THE SERVICE WILL BE UNINTERRUPTED OR ERROR-FREE; OR (D) THE SERVICE WILL MEET YOUR SPECIFIC REQUIREMENTS.
              </p>
              <p>
                You are responsible for reviewing AI-generated outputs (search results, quote extractions, transcripts, recommendations) before relying on them for purchasing or operational decisions.
              </p>

              <h2>10. Limitation of Liability</h2>
              <p>
                TO THE FULLEST EXTENT PERMITTED BY LAW, IN NO EVENT SHALL PARTSIQ, ITS OFFICERS, DIRECTORS, EMPLOYEES, OR AGENTS BE LIABLE FOR ANY INDIRECT, INCIDENTAL, SPECIAL, CONSEQUENTIAL, OR PUNITIVE DAMAGES, INCLUDING LOST PROFITS, LOST REVENUE, LOST DATA, OR BUSINESS INTERRUPTION, ARISING FROM OR RELATING TO YOUR USE OF THE SERVICE, EVEN IF ADVISED OF THE POSSIBILITY OF SUCH DAMAGES.
              </p>
              <p>
                IN NO EVENT SHALL PARTSIQ&rsquo;S TOTAL CUMULATIVE LIABILITY EXCEED THE AMOUNTS PAID BY YOU TO PARTSIQ FOR THE SERVICE DURING THE TWELVE (12) MONTHS PRECEDING THE EVENT GIVING RISE TO THE CLAIM.
              </p>
              <p>
                Some jurisdictions do not allow the exclusion or limitation of certain damages, so some of the above limitations may not apply to you.
              </p>

              <h2>11. Indemnification</h2>
              <p>
                You agree to defend, indemnify, and hold harmless PartsIQ and its officers, directors, employees, and agents from and against any claims, damages, losses, liabilities, and expenses (including reasonable attorneys&rsquo; fees) arising from (a) your use of the Service in violation of these Terms or applicable law; (b) communications initiated from your account, including calls placed by the AI voice agent on your authorization; (c) your Customer Data; or (d) your violation of any third party&rsquo;s rights.
              </p>

              <h2>12. Term and Termination</h2>
              <p>
                These Terms remain in effect while you use the Service. Either party may terminate the relationship at any time for convenience by canceling the subscription (if you) or providing notice (if us). Sections that by their nature should survive termination (including intellectual property, disclaimers, limitation of liability, and indemnification) will survive.
              </p>

              <h2>13. Modifications to These Terms</h2>
              <p>
                We may update these Terms from time to time. For material changes, we will provide at least 30 days&rsquo; notice by email or in-app notification. Your continued use of the Service after the effective date of a change constitutes acceptance of the revised Terms. The &ldquo;Effective&rdquo; date at the top of this page reflects the most recent update.
              </p>

              <h2>14. Governing Law and Dispute Resolution</h2>
              <p>
                These Terms are governed by the laws of the jurisdiction where PartsIQ&rsquo;s principal place of business is located, without regard to its conflict-of-law rules. Any dispute arising out of or relating to these Terms or the Service will be resolved through good-faith negotiation in the first instance, and if unresolved, through binding arbitration administered in that jurisdiction.
              </p>
              <p>
                To the maximum extent permitted by law, you and PartsIQ each waive the right to a trial by jury and the right to participate in a class action.
              </p>

              <h2>15. Miscellaneous</h2>
              <p>
                These Terms, together with the <Link href="/privacy">Privacy Policy</Link> and any order forms or supplemental agreements, constitute the entire agreement between you and PartsIQ with respect to the Service. If any provision is held unenforceable, the remaining provisions remain in effect. Our failure to enforce any right is not a waiver. You may not assign these Terms without our written consent; we may assign them in connection with a merger, acquisition, or sale of assets.
              </p>

              <h2>16. Contact</h2>
              <p>
                Questions about these Terms? Use the contact form below and we&rsquo;ll respond.
              </p>
              <div className="not-prose my-6">
                <LegalContactForm requestType="legal" />
              </div>

              <div className="not-prose mt-12 rounded-lg border border-slate-200 bg-slate-50 p-5 text-sm text-slate-600">
                <div className="flex items-start gap-3">
                  <FileText className="h-4 w-4 text-slate-500 shrink-0 mt-0.5" />
                  <p className="leading-relaxed m-0">
                    This document is a good-faith summary of the terms under which PartsIQ is provided. It is not a substitute for legal advice. For customized contract terms (data processing addendum, enterprise MSA, jurisdiction-specific amendments), please contact us.
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
