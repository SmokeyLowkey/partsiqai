import type { Metadata } from "next"
import { MessageSquare, Mail, Handshake } from "lucide-react"
import { BreadcrumbJsonLd } from "@/components/seo/breadcrumb-jsonld"
import { PublicFooter } from "@/components/layout/public-footer"
import { ContactForm } from "@/components/contact/contact-form"

export const metadata: Metadata = {
  title: "Contact Sales, Support & Partnerships",
  description:
    "Get in touch with PartsIQ. Contact our sales team for a demo of our parts inventory management software, reach support for technical help, or discuss partnership opportunities.",
  alternates: {
    canonical: "/contact",
  },
  openGraph: {
    title: "Contact PartsIQ",
    description:
      "Contact our sales or support team. Schedule a demo of PartsIQ's AI-powered parts procurement platform.",
    url: "/contact",
  },
}

export default function ContactPage() {
  return (
    <>
      <BreadcrumbJsonLd items={[{ name: "Home", url: "/" }, { name: "Contact", url: "/contact" }]} />
      <div className="min-h-screen bg-white">
        {/* Hero Section */}
        <section className="relative bg-slate-950 text-white py-24">
          <div className="absolute inset-0 bg-[linear-gradient(rgba(148,163,184,0.05)_1px,transparent_1px),linear-gradient(90deg,rgba(148,163,184,0.05)_1px,transparent_1px)] bg-[size:64px_64px]"></div>
          <div className="relative container mx-auto px-6">
            <div className="max-w-4xl mx-auto text-center">
              <h1 className="text-5xl md:text-6xl font-bold mb-6 tracking-tight">Get in touch</h1>
              <p className="text-xl text-slate-400 mb-8">
                Our team is here to answer your questions about PartsIQ
              </p>
            </div>
          </div>
        </section>

        {/* Topic cards — scroll to form; no fake email addresses */}
        <section className="py-20 bg-white">
          <div className="container mx-auto px-6">
            <div className="max-w-5xl mx-auto">
              <div className="grid md:grid-cols-3 gap-8 mb-16">
                <a href="#contact-form" className="group text-center rounded-xl border border-slate-200 p-8 hover:border-slate-950 hover:shadow-md transition-all">
                  <div className="w-14 h-14 bg-slate-950 rounded-lg flex items-center justify-center mx-auto mb-4">
                    <MessageSquare className="h-7 w-7 text-white" />
                  </div>
                  <h3 className="text-xl font-bold text-slate-950 mb-2">Sales</h3>
                  <p className="text-slate-600 text-sm mb-4 leading-relaxed">
                    Interested in PartsIQ for your organization? Get a personalized demo.
                  </p>
                  <span className="text-sm font-medium text-slate-950 group-hover:underline">
                    Request a demo →
                  </span>
                </a>

                <a href="#contact-form" className="group text-center rounded-xl border border-slate-200 p-8 hover:border-slate-950 hover:shadow-md transition-all">
                  <div className="w-14 h-14 bg-slate-950 rounded-lg flex items-center justify-center mx-auto mb-4">
                    <Mail className="h-7 w-7 text-white" />
                  </div>
                  <h3 className="text-xl font-bold text-slate-950 mb-2">Support</h3>
                  <p className="text-slate-600 text-sm mb-4 leading-relaxed">
                    Need help with your account, integrations, or technical questions?
                  </p>
                  <span className="text-sm font-medium text-slate-950 group-hover:underline">
                    Get support →
                  </span>
                </a>

                <a href="#contact-form" className="group text-center rounded-xl border border-slate-200 p-8 hover:border-slate-950 hover:shadow-md transition-all">
                  <div className="w-14 h-14 bg-slate-950 rounded-lg flex items-center justify-center mx-auto mb-4">
                    <Handshake className="h-7 w-7 text-white" />
                  </div>
                  <h3 className="text-xl font-bold text-slate-950 mb-2">Partnerships</h3>
                  <p className="text-slate-600 text-sm mb-4 leading-relaxed">
                    Interested in a partnership, integration, or channel opportunity?
                  </p>
                  <span className="text-sm font-medium text-slate-950 group-hover:underline">
                    Partner with us →
                  </span>
                </a>
              </div>

              {/* Functional contact form */}
              <div id="contact-form" className="max-w-2xl mx-auto scroll-mt-20">
                <ContactForm />
              </div>
            </div>
          </div>
        </section>
      </div>
      <PublicFooter />
    </>
  )
}
