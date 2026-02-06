import { Button } from "@/components/ui/button"
import { ArrowRight, BookOpen, Mail, MessageCircle, FileText, HelpCircle, Search } from "lucide-react"
import Link from "next/link"

export default function SupportPage() {
  return (
    <div className="min-h-screen bg-white">
      {/* Hero Section */}
      <section className="relative bg-slate-950 text-white py-24">
        <div className="absolute inset-0 bg-[linear-gradient(rgba(148,163,184,0.05)_1px,transparent_1px),linear-gradient(90deg,rgba(148,163,184,0.05)_1px,transparent_1px)] bg-[size:64px_64px]"></div>

        <div className="relative container mx-auto px-6">
          <div className="max-w-4xl mx-auto text-center">
            <h1 className="text-5xl md:text-6xl font-bold mb-6 tracking-tight">
              How can we help?
            </h1>
            <p className="text-xl text-slate-400 mb-8">
              Find answers, get support, and learn how to make the most of PartsIQ
            </p>

            {/* Search Bar */}
            <div className="max-w-2xl mx-auto">
              <div className="relative">
                <input
                  type="text"
                  placeholder="Search for help articles..."
                  className="w-full px-6 py-4 pl-14 bg-white text-slate-950 rounded-lg border-0 focus:outline-none focus:ring-2 focus:ring-white/20"
                />
                <Search className="absolute left-4 top-1/2 -translate-y-1/2 h-6 w-6 text-slate-400" />
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Support Options */}
      <section className="py-24 bg-white">
        <div className="container mx-auto px-6">
          <div className="max-w-6xl mx-auto">
            <div className="grid md:grid-cols-3 gap-8">
              {/* Documentation */}
              <div className="border border-slate-200 rounded-lg p-8 hover:shadow-lg transition-shadow">
                <div className="w-12 h-12 bg-slate-950 rounded-lg flex items-center justify-center mb-4">
                  <BookOpen className="h-6 w-6 text-white" />
                </div>
                <h3 className="text-xl font-bold text-slate-950 mb-3">Documentation</h3>
                <p className="text-slate-600 mb-6">
                  Comprehensive guides and tutorials for getting started with PartsIQ
                </p>
                <Button variant="outline" className="w-full border-slate-300 text-foreground hover:bg-slate-50 hover:text-background">
                  Browse Docs
                  <ArrowRight className="ml-2 h-4 w-4" />
                </Button>
              </div>

              {/* Contact Support */}
              <div className="border border-slate-200 rounded-lg p-8 hover:shadow-lg transition-shadow">
                <div className="w-12 h-12 bg-slate-950 rounded-lg flex items-center justify-center mb-4">
                  <Mail className="h-6 w-6 text-white" />
                </div>
                <h3 className="text-xl font-bold text-slate-950 mb-3">Email Support</h3>
                <p className="text-slate-600 mb-6">
                  Get help from our support team via email. Response within 24 hours.
                </p>
                <a href="mailto:support@partsiq.com">
                  <Button variant="outline" className="w-full border-slate-300 text-foreground hover:bg-slate-50 hover:text-background">
                    Email Us
                    <ArrowRight className="ml-2 h-4 w-4" />
                  </Button>
                </a>
              </div>

              {/* Live Chat */}
              <div className="border border-slate-200 rounded-lg p-8 hover:shadow-lg transition-shadow">
                <div className="w-12 h-12 bg-slate-950 rounded-lg flex items-center justify-center mb-4">
                  <MessageCircle className="h-6 w-6 text-white" />
                </div>
                <h3 className="text-xl font-bold text-slate-950 mb-3">Live Chat</h3>
                <p className="text-slate-600 mb-6">
                  Chat with our team in real-time during business hours
                </p>
                <Button className="w-full bg-slate-950 text-foreground hover:text-background hover:bg-slate-800">
                  Start Chat
                  <ArrowRight className="ml-2 h-4 w-4" />
                </Button>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* FAQ Section */}
      <section className="py-24 bg-slate-50">
        <div className="container mx-auto px-6">
          <div className="max-w-4xl mx-auto">
            <div className="text-center mb-16">
              <HelpCircle className="h-12 w-12 mx-auto mb-6 text-slate-950" />
              <h2 className="text-4xl font-bold mb-4 text-slate-950 tracking-tight">
                Frequently Asked Questions
              </h2>
              <p className="text-xl text-slate-600">
                Quick answers to common questions
              </p>
            </div>

            <div className="space-y-6">
              {/* FAQ Item */}
              <div className="bg-white border border-slate-200 rounded-lg p-6">
                <h3 className="text-lg font-bold text-slate-950 mb-3">How do I get started with PartsIQ?</h3>
                <p className="text-slate-600">
                  Sign in to your account, add your equipment to the system, and start using the AI search to find parts. Our onboarding guide will walk you through the setup process.
                </p>
              </div>

              <div className="bg-white border border-slate-200 rounded-lg p-6">
                <h3 className="text-lg font-bold text-slate-950 mb-3">How does the AI part search work?</h3>
                <p className="text-slate-600">
                  Describe the part you need in plain language or upload a photo. Our multi-agent AI searches across multiple databases (postgres, pinecone, neo4j) to find exact matches with confidence scores.
                </p>
              </div>

              <div className="bg-white border border-slate-200 rounded-lg p-6">
                <h3 className="text-lg font-bold text-slate-950 mb-3">Can I track multiple vehicles?</h3>
                <p className="text-slate-600">
                  Yes, you can add and track unlimited vehicles and equipment. Each piece of equipment has its own maintenance schedule, operating hours, and health score.
                </p>
              </div>

              <div className="bg-white border border-slate-200 rounded-lg p-6">
                <h3 className="text-lg font-bold text-slate-950 mb-3">How do quote requests work?</h3>
                <p className="text-slate-600">
                  Once you've added parts to your pick list, create a quote request. The system automatically emails your selected suppliers and tracks their responses in one centralized dashboard.
                </p>
              </div>

              <div className="bg-white border border-slate-200 rounded-lg p-6">
                <h3 className="text-lg font-bold text-slate-950 mb-3">What if I need help during setup?</h3>
                <p className="text-slate-600">
                  Enterprise customers receive dedicated onboarding support. All customers can access our documentation, email support, and live chat during business hours.
                </p>
              </div>

              <div className="bg-white border border-slate-200 rounded-lg p-6">
                <h3 className="text-lg font-bold text-slate-950 mb-3">Is my data secure?</h3>
                <p className="text-slate-600">
                  Yes. We use enterprise-grade encryption (TLS 1.3, AES-256), role-based access control, and maintain comprehensive audit logs. See our{" "}
                  <Link href="/security" className="text-blue-600 hover:text-blue-700 font-medium">
                    security page
                  </Link>{" "}
                  for more details.
                </p>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Support Hours */}
      <section className="py-24 bg-white">
        <div className="container mx-auto px-6">
          <div className="max-w-4xl mx-auto">
            <div className="bg-slate-50 border border-slate-200 rounded-lg p-8">
              <div className="flex items-start gap-6">
                <FileText className="h-8 w-8 text-slate-950 mt-1 flex-shrink-0" />
                <div>
                  <h3 className="text-2xl font-bold text-slate-950 mb-3">Support Hours</h3>
                  <div className="space-y-2 text-slate-600">
                    <p><span className="font-medium text-slate-950">Email Support:</span> 24/7 (response within 24 hours)</p>
                    <p><span className="font-medium text-slate-950">Live Chat:</span> Monday-Friday, 9am-5pm EST</p>
                    <p><span className="font-medium text-slate-950">Phone Support:</span> Enterprise customers only</p>
                  </div>
                  <p className="text-sm text-slate-500 mt-4">
                    Enterprise customers with priority support receive 24/7 assistance with guaranteed response times.
                  </p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="py-24 bg-slate-50">
        <div className="container mx-auto px-6">
          <div className="max-w-4xl mx-auto text-center">
            <h2 className="text-4xl md:text-5xl font-bold mb-6 text-slate-950 tracking-tight">
              Still have questions?
            </h2>
            <p className="text-xl text-slate-600 mb-8">
              Our support team is ready to help
            </p>
            <Link href="/contact">
              <Button size="lg" className="bg-slate-950 text-foreground hover:text-background hover:bg-slate-800 px-8 h-14 text-lg font-medium">
                Contact Support
                <ArrowRight className="ml-2 h-5 w-5" />
              </Button>
            </Link>
          </div>
        </div>
      </section>
    </div>
  )
}
