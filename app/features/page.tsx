import { Button } from "@/components/ui/button"
import {
  ArrowRight,
  Search,
  MessageSquare,
  TrendingDown,
  Clock,
  Shield,
  Mail,
  FileText,
  BarChart3,
  Users,
  Zap,
  CheckCircle,
} from "lucide-react"
import Link from "next/link"

export default function FeaturesPage() {
  return (
    <div className="min-h-screen bg-white">
      {/* Hero Section */}
      <section className="relative bg-slate-950 text-white py-24">
        <div className="absolute inset-0 bg-[linear-gradient(rgba(148,163,184,0.05)_1px,transparent_1px),linear-gradient(90deg,rgba(148,163,184,0.05)_1px,transparent_1px)] bg-[size:64px_64px]"></div>

        <div className="relative container mx-auto px-6">
          <div className="max-w-4xl mx-auto text-center">
            <h1 className="text-5xl md:text-6xl font-bold mb-6 tracking-tight">
              Everything you need for industrial parts procurement
            </h1>
            <p className="text-xl text-slate-400 mb-8">
              From AI-powered search to equipment tracking, PartsIQ provides a complete platform for managing your parts sourcing workflow.
            </p>
            <Link href="/login">
              <Button size="lg" className="bg-white text-background hover:text-foreground hover:bg-background px-8 h-14 text-lg font-medium">
                Get Started
                <ArrowRight className="ml-2 h-5 w-5" />
              </Button>
            </Link>
          </div>
        </div>
      </section>

      {/* Core Features */}
      <section className="py-24 bg-white">
        <div className="container mx-auto px-6">
          <div className="max-w-6xl mx-auto">
            <div className="mb-16 text-center">
              <h2 className="text-4xl md:text-5xl font-bold mb-4 text-slate-950 tracking-tight">
                Core Features
              </h2>
              <p className="text-xl text-slate-600 max-w-2xl mx-auto">
                Purpose-built tools for industrial operations teams
              </p>
            </div>

            <div className="grid md:grid-cols-2 gap-12">
              {/* Feature 1 */}
              <div className="flex gap-6">
                <div className="flex-shrink-0">
                  <div className="w-12 h-12 bg-slate-950 rounded-lg flex items-center justify-center">
                    <Search className="h-6 w-6 text-white" />
                  </div>
                </div>
                <div>
                  <h3 className="text-2xl font-bold text-slate-950 mb-3">Multi-Agent AI Search</h3>
                  <p className="text-slate-600 mb-4 leading-relaxed">
                    Simultaneous searches across multiple databases (postgres, pinecone, neo4j) to find exact part matches with 95%+ confidence scoring.
                  </p>
                  <ul className="space-y-2 text-slate-600">
                    <li className="flex items-start gap-2">
                      <CheckCircle className="h-5 w-5 text-emerald-600 mt-0.5 flex-shrink-0" />
                      <span>Natural language part descriptions</span>
                    </li>
                    <li className="flex items-start gap-2">
                      <CheckCircle className="h-5 w-5 text-emerald-600 mt-0.5 flex-shrink-0" />
                      <span>Vehicle context awareness for compatibility</span>
                    </li>
                    <li className="flex items-start gap-2">
                      <CheckCircle className="h-5 w-5 text-emerald-600 mt-0.5 flex-shrink-0" />
                      <span>OEM and aftermarket cross-referencing</span>
                    </li>
                  </ul>
                </div>
              </div>

              {/* Feature 2 */}
              <div className="flex gap-6">
                <div className="flex-shrink-0">
                  <div className="w-12 h-12 bg-slate-950 rounded-lg flex items-center justify-center">
                    <MessageSquare className="h-6 w-6 text-white" />
                  </div>
                </div>
                <div>
                  <h3 className="text-2xl font-bold text-slate-950 mb-3">Quote Management</h3>
                  <p className="text-slate-600 mb-4 leading-relaxed">
                    Create quote requests that automatically notify suppliers. Track responses and communicate directly within the platform.
                  </p>
                  <ul className="space-y-2 text-slate-600">
                    <li className="flex items-start gap-2">
                      <CheckCircle className="h-5 w-5 text-emerald-600 mt-0.5 flex-shrink-0" />
                      <span>Automated supplier notifications</span>
                    </li>
                    <li className="flex items-start gap-2">
                      <CheckCircle className="h-5 w-5 text-emerald-600 mt-0.5 flex-shrink-0" />
                      <span>Communication thread tracking</span>
                    </li>
                    <li className="flex items-start gap-2">
                      <CheckCircle className="h-5 w-5 text-emerald-600 mt-0.5 flex-shrink-0" />
                      <span>Follow-up reminders</span>
                    </li>
                  </ul>
                </div>
              </div>

              {/* Feature 3 */}
              <div className="flex gap-6">
                <div className="flex-shrink-0">
                  <div className="w-12 h-12 bg-slate-950 rounded-lg flex items-center justify-center">
                    <TrendingDown className="h-6 w-6 text-white" />
                  </div>
                </div>
                <div>
                  <h3 className="text-2xl font-bold text-slate-950 mb-3">Price Comparison</h3>
                  <p className="text-slate-600 mb-4 leading-relaxed">
                    AI-powered price extraction from supplier emails. Compare quotes side-by-side to ensure competitive pricing.
                  </p>
                  <ul className="space-y-2 text-slate-600">
                    <li className="flex items-start gap-2">
                      <CheckCircle className="h-5 w-5 text-emerald-600 mt-0.5 flex-shrink-0" />
                      <span>Automatic price extraction from emails</span>
                    </li>
                    <li className="flex items-start gap-2">
                      <CheckCircle className="h-5 w-5 text-emerald-600 mt-0.5 flex-shrink-0" />
                      <span>Side-by-side quote comparison</span>
                    </li>
                    <li className="flex items-start gap-2">
                      <CheckCircle className="h-5 w-5 text-emerald-600 mt-0.5 flex-shrink-0" />
                      <span>Best value highlighting</span>
                    </li>
                  </ul>
                </div>
              </div>

              {/* Feature 4 */}
              <div className="flex gap-6">
                <div className="flex-shrink-0">
                  <div className="w-12 h-12 bg-slate-950 rounded-lg flex items-center justify-center">
                    <Clock className="h-6 w-6 text-white" />
                  </div>
                </div>
                <div>
                  <h3 className="text-2xl font-bold text-slate-950 mb-3">Equipment Tracking</h3>
                  <p className="text-slate-600 mb-4 leading-relaxed">
                    Monitor operating hours, health scores, and maintenance schedules based on OEM specifications.
                  </p>
                  <ul className="space-y-2 text-slate-600">
                    <li className="flex items-start gap-2">
                      <CheckCircle className="h-5 w-5 text-emerald-600 mt-0.5 flex-shrink-0" />
                      <span>Real-time operating hour tracking</span>
                    </li>
                    <li className="flex items-start gap-2">
                      <CheckCircle className="h-5 w-5 text-emerald-600 mt-0.5 flex-shrink-0" />
                      <span>AI-powered health score monitoring</span>
                    </li>
                    <li className="flex items-start gap-2">
                      <CheckCircle className="h-5 w-5 text-emerald-600 mt-0.5 flex-shrink-0" />
                      <span>Automated service reminders</span>
                    </li>
                  </ul>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Additional Features */}
      <section className="py-24 bg-slate-50">
        <div className="container mx-auto px-6">
          <div className="max-w-6xl mx-auto">
            <div className="mb-16 text-center">
              <h2 className="text-4xl font-bold mb-4 text-slate-950 tracking-tight">
                Platform Capabilities
              </h2>
            </div>

            <div className="grid md:grid-cols-3 gap-8">
              <div className="bg-white border border-slate-200 p-6 rounded-lg">
                <Mail className="h-8 w-8 text-slate-950 mb-4" />
                <h3 className="text-lg font-bold text-slate-950 mb-2">Email Integration</h3>
                <p className="text-slate-600 text-sm">
                  Automated email notifications to suppliers with response tracking and follow-up management.
                </p>
              </div>

              <div className="bg-white border border-slate-200 p-6 rounded-lg">
                <FileText className="h-8 w-8 text-slate-950 mb-4" />
                <h3 className="text-lg font-bold text-slate-950 mb-2">Audit Trail</h3>
                <p className="text-slate-600 text-sm">
                  Complete procurement history with timestamps, communications, and delivery confirmations.
                </p>
              </div>

              <div className="bg-white border border-slate-200 p-6 rounded-lg">
                <BarChart3 className="h-8 w-8 text-slate-950 mb-4" />
                <h3 className="text-lg font-bold text-slate-950 mb-2">Analytics Dashboard</h3>
                <p className="text-slate-600 text-sm">
                  Track sourcing time, supplier response rates, and cost savings across your organization.
                </p>
              </div>

              <div className="bg-white border border-slate-200 p-6 rounded-lg">
                <Users className="h-8 w-8 text-slate-950 mb-4" />
                <h3 className="text-lg font-bold text-slate-950 mb-2">Multi-User Access</h3>
                <p className="text-slate-600 text-sm">
                  Role-based permissions for administrators, managers, and customers with separate portals.
                </p>
              </div>

              <div className="bg-white border border-slate-200 p-6 rounded-lg">
                <Shield className="h-8 w-8 text-slate-950 mb-4" />
                <h3 className="text-lg font-bold text-slate-950 mb-2">Secure Platform</h3>
                <p className="text-slate-600 text-sm">
                  Enterprise-grade encryption, role-based security, and automatic session management.
                </p>
              </div>

              <div className="bg-white border border-slate-200 p-6 rounded-lg">
                <Zap className="h-8 w-8 text-slate-950 mb-4" />
                <h3 className="text-lg font-bold text-slate-950 mb-2">Fast Performance</h3>
                <p className="text-slate-600 text-sm">
                  Sub-2-minute average response times with 99.9% uptime SLA for critical operations.
                </p>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* CTA Section */}
      <section className="py-24 bg-white">
        <div className="container mx-auto px-6">
          <div className="max-w-4xl mx-auto text-center">
            <h2 className="text-4xl md:text-5xl font-bold mb-6 text-slate-950 tracking-tight">
              Ready to get started?
            </h2>
            <p className="text-xl text-slate-600 mb-8">
              See how PartsIQ can transform your parts procurement workflow
            </p>
            <div className="flex flex-col sm:flex-row gap-4 justify-center">
              <Link href="/login">
                <Button size="lg" className="bg-slate-950 text-white hover:bg-slate-800 px-8 h-14 text-lg font-medium">
                  Get Started
                  <ArrowRight className="ml-2 h-5 w-5" />
                </Button>
              </Link>
              <Link href="/pricing">
                <Button size="lg" variant="outline" className="border-slate-300 text-foreground hover:bg-slate-50 hover:text-background px-8 h-14 text-lg">
                  View Pricing
                </Button>
              </Link>
            </div>
          </div>
        </div>
      </section>
    </div>
  )
}
