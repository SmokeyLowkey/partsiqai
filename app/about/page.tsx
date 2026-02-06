import { Button } from "@/components/ui/button"
import { ArrowRight, Target, Lightbulb, Users } from "lucide-react"
import Link from "next/link"

export default function AboutPage() {
  return (
    <div className="min-h-screen bg-white">
      {/* Hero Section */}
      <section className="relative bg-slate-950 text-white py-24">
        <div className="absolute inset-0 bg-[linear-gradient(rgba(148,163,184,0.05)_1px,transparent_1px),linear-gradient(90deg,rgba(148,163,184,0.05)_1px,transparent_1px)] bg-[size:64px_64px]"></div>

        <div className="relative container mx-auto px-6">
          <div className="max-w-4xl mx-auto text-center">
            <h1 className="text-5xl md:text-6xl font-bold mb-6 tracking-tight">
              Transforming industrial parts procurement
            </h1>
            <p className="text-xl text-slate-400 mb-8">
              PartsIQ is building the future of parts sourcing for industrial operations teams
            </p>
          </div>
        </div>
      </section>

      {/* Mission Section */}
      <section className="py-24 bg-white">
        <div className="container mx-auto px-6">
          <div className="max-w-4xl mx-auto">
            <div className="text-center mb-16">
              <Target className="h-12 w-12 mx-auto mb-6 text-slate-950" />
              <h2 className="text-4xl font-bold mb-6 text-slate-950 tracking-tight">
                Our Mission
              </h2>
              <p className="text-xl text-slate-600 leading-relaxed">
                We're on a mission to eliminate the inefficiencies in industrial parts procurement. Every hour maintenance teams spend hunting for parts is time that equipment sits idle and revenue is lost. We believe AI and automation can transform this process, reducing sourcing time from hours to minutes while ensuring competitive pricing and reliable suppliers.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* Problem & Solution */}
      <section className="py-24 bg-slate-50">
        <div className="container mx-auto px-6">
          <div className="max-w-6xl mx-auto">
            <div className="grid md:grid-cols-2 gap-16">
              <div>
                <h3 className="text-3xl font-bold text-slate-950 mb-6">The Problem</h3>
                <p className="text-slate-600 mb-4 leading-relaxed">
                  Industrial maintenance teams waste countless hours on parts procurement:
                </p>
                <ul className="space-y-3 text-slate-600">
                  <li className="flex items-start gap-2">
                    <span className="text-slate-400 mt-1">•</span>
                    <span>Searching through catalogs to identify correct part numbers</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <span className="text-slate-400 mt-1">•</span>
                    <span>Contacting multiple suppliers individually for quotes</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <span className="text-slate-400 mt-1">•</span>
                    <span>Manually comparing prices and availability</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <span className="text-slate-400 mt-1">•</span>
                    <span>Following up with suppliers for responses</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <span className="text-slate-400 mt-1">•</span>
                    <span>Tracking maintenance schedules manually</span>
                  </li>
                </ul>
              </div>

              <div>
                <h3 className="text-3xl font-bold text-slate-950 mb-6">Our Solution</h3>
                <p className="text-slate-600 mb-4 leading-relaxed">
                  PartsIQ automates the entire procurement workflow:
                </p>
                <ul className="space-y-3 text-slate-600">
                  <li className="flex items-start gap-2">
                    <span className="text-emerald-600 mt-1">✓</span>
                    <span>AI-powered part identification from descriptions or photos</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <span className="text-emerald-600 mt-1">✓</span>
                    <span>Automated quote requests to verified suppliers</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <span className="text-emerald-600 mt-1">✓</span>
                    <span>Real-time price comparison and supplier tracking</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <span className="text-emerald-600 mt-1">✓</span>
                    <span>Communication management and follow-up reminders</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <span className="text-emerald-600 mt-1">✓</span>
                    <span>Equipment tracking with OEM maintenance schedules</span>
                  </li>
                </ul>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Values Section */}
      <section className="py-24 bg-white">
        <div className="container mx-auto px-6">
          <div className="max-w-6xl mx-auto">
            <div className="text-center mb-16">
              <h2 className="text-4xl font-bold mb-4 text-slate-950 tracking-tight">
                Our Values
              </h2>
            </div>

            <div className="grid md:grid-cols-3 gap-8">
              <div className="text-center">
                <div className="w-16 h-16 bg-slate-950 rounded-lg flex items-center justify-center mx-auto mb-4">
                  <Target className="h-8 w-8 text-white" />
                </div>
                <h3 className="text-xl font-bold text-slate-950 mb-3">Customer Focus</h3>
                <p className="text-slate-600">
                  We build for operations teams who can't afford downtime. Every feature is designed to save time and reduce costs.
                </p>
              </div>

              <div className="text-center">
                <div className="w-16 h-16 bg-slate-950 rounded-lg flex items-center justify-center mx-auto mb-4">
                  <Lightbulb className="h-8 w-8 text-white" />
                </div>
                <h3 className="text-xl font-bold text-slate-950 mb-3">Innovation</h3>
                <p className="text-slate-600">
                  We leverage cutting-edge AI and automation to solve real problems faced by industrial operations.
                </p>
              </div>

              <div className="text-center">
                <div className="w-16 h-16 bg-slate-950 rounded-lg flex items-center justify-center mx-auto mb-4">
                  <Users className="h-8 w-8 text-white" />
                </div>
                <h3 className="text-xl font-bold text-slate-950 mb-3">Reliability</h3>
                <p className="text-slate-600">
                  Our platform is built for mission-critical operations with 99.9% uptime and enterprise-grade security.
                </p>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* CTA Section */}
      <section className="py-24 bg-slate-50">
        <div className="container mx-auto px-6">
          <div className="max-w-4xl mx-auto text-center">
            <h2 className="text-4xl md:text-5xl font-bold mb-6 text-slate-950 tracking-tight">
              Join us in transforming parts procurement
            </h2>
            <p className="text-xl text-slate-600 mb-8">
              See how PartsIQ can help your team reduce sourcing time and keep operations running smoothly
            </p>
            <div className="flex flex-col sm:flex-row gap-4 justify-center">
              <Link href="/login">
                <Button size="lg" className="bg-slate-950 text-foreground hover:text-background hover:bg-slate-800 px-8 h-14 text-lg font-medium">
                  Get Started
                  <ArrowRight className="ml-2 h-5 w-5" />
                </Button>
              </Link>
              <Link href="/contact">
                <Button size="lg" variant="outline" className="border-slate-300 text-foreground hover:bg-slate-50 hover:text-background px-8 h-14 text-lg">
                  Contact Us
                </Button>
              </Link>
            </div>
          </div>
        </div>
      </section>
    </div>
  )
}
