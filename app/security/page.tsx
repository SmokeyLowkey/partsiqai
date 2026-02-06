import { Button } from "@/components/ui/button"
import { ArrowRight, Shield, Lock, Database, Eye, FileCheck, Users } from "lucide-react"
import Link from "next/link"

export default function SecurityPage() {
  return (
    <div className="min-h-screen bg-white">
      {/* Hero Section */}
      <section className="relative bg-slate-950 text-white py-24">
        <div className="absolute inset-0 bg-[linear-gradient(rgba(148,163,184,0.05)_1px,transparent_1px),linear-gradient(90deg,rgba(148,163,184,0.05)_1px,transparent_1px)] bg-[size:64px_64px]"></div>

        <div className="relative container mx-auto px-6">
          <div className="max-w-4xl mx-auto text-center">
            <Shield className="h-16 w-16 mx-auto mb-6 text-white" />
            <h1 className="text-5xl md:text-6xl font-bold mb-6 tracking-tight">
              Enterprise-grade security
            </h1>
            <p className="text-xl text-slate-400 mb-8">
              Your data security is our top priority. PartsIQ is built with industry-leading security standards to protect your sensitive procurement information.
            </p>
          </div>
        </div>
      </section>

      {/* Security Features */}
      <section className="py-24 bg-white">
        <div className="container mx-auto px-6">
          <div className="max-w-6xl mx-auto">
            <div className="grid md:grid-cols-2 gap-12">
              {/* Feature 1 */}
              <div className="flex gap-6">
                <div className="flex-shrink-0">
                  <div className="w-12 h-12 bg-slate-950 rounded-lg flex items-center justify-center">
                    <Lock className="h-6 w-6 text-white" />
                  </div>
                </div>
                <div>
                  <h3 className="text-2xl font-bold text-slate-950 mb-3">End-to-End Encryption</h3>
                  <p className="text-slate-600 leading-relaxed">
                    All data is encrypted in transit using TLS 1.3 and at rest using AES-256 encryption. Your procurement data, supplier communications, and quotes are protected at every step.
                  </p>
                </div>
              </div>

              {/* Feature 2 */}
              <div className="flex gap-6">
                <div className="flex-shrink-0">
                  <div className="w-12 h-12 bg-slate-950 rounded-lg flex items-center justify-center">
                    <Users className="h-6 w-6 text-white" />
                  </div>
                </div>
                <div>
                  <h3 className="text-2xl font-bold text-slate-950 mb-3">Role-Based Access Control</h3>
                  <p className="text-slate-600 leading-relaxed">
                    Granular permissions system ensures users only access data relevant to their role. Separate portals for administrators, managers, and customers with customizable access levels.
                  </p>
                </div>
              </div>

              {/* Feature 3 */}
              <div className="flex gap-6">
                <div className="flex-shrink-0">
                  <div className="w-12 h-12 bg-slate-950 rounded-lg flex items-center justify-center">
                    <Database className="h-6 w-6 text-white" />
                  </div>
                </div>
                <div>
                  <h3 className="text-2xl font-bold text-slate-950 mb-3">Secure Data Storage</h3>
                  <p className="text-slate-600 leading-relaxed">
                    Data stored in enterprise-grade cloud infrastructure with automatic backups, redundancy, and 99.9% uptime SLA. Regular security audits and penetration testing.
                  </p>
                </div>
              </div>

              {/* Feature 4 */}
              <div className="flex gap-6">
                <div className="flex-shrink-0">
                  <div className="w-12 h-12 bg-slate-950 rounded-lg flex items-center justify-center">
                    <Eye className="h-6 w-6 text-white" />
                  </div>
                </div>
                <div>
                  <h3 className="text-2xl font-bold text-slate-950 mb-3">Audit Logging</h3>
                  <p className="text-slate-600 leading-relaxed">
                    Comprehensive audit trails track all system activities including logins, data access, and modifications. Full visibility into who accessed what and when.
                  </p>
                </div>
              </div>

              {/* Feature 5 */}
              <div className="flex gap-6">
                <div className="flex-shrink-0">
                  <div className="w-12 h-12 bg-slate-950 rounded-lg flex items-center justify-center">
                    <Shield className="h-6 w-6 text-white" />
                  </div>
                </div>
                <div>
                  <h3 className="text-2xl font-bold text-slate-950 mb-3">Authentication Security</h3>
                  <p className="text-slate-600 leading-relaxed">
                    Secure authentication with session management, automatic timeout, and encrypted session tokens. Support for single sign-on (SSO) for enterprise customers.
                  </p>
                </div>
              </div>

              {/* Feature 6 */}
              <div className="flex gap-6">
                <div className="flex-shrink-0">
                  <div className="w-12 h-12 bg-slate-950 rounded-lg flex items-center justify-center">
                    <FileCheck className="h-6 w-6 text-white" />
                  </div>
                </div>
                <div>
                  <h3 className="text-2xl font-bold text-slate-950 mb-3">Compliance Ready</h3>
                  <p className="text-slate-600 leading-relaxed">
                    Built with privacy and compliance in mind. Regular security assessments and adherence to industry best practices for data protection.
                  </p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Security Commitment */}
      <section className="py-24 bg-slate-50">
        <div className="container mx-auto px-6">
          <div className="max-w-4xl mx-auto">
            <div className="text-center mb-12">
              <h2 className="text-4xl font-bold mb-4 text-slate-950 tracking-tight">
                Our Security Commitment
              </h2>
              <p className="text-xl text-slate-600">
                We take security seriously at every level of our organization
              </p>
            </div>

            <div className="grid md:grid-cols-3 gap-8">
              <div className="bg-white border border-slate-200 p-6 rounded-lg text-center">
                <div className="text-4xl font-bold text-slate-950 mb-2">99.9%</div>
                <div className="text-slate-600">Uptime SLA</div>
              </div>

              <div className="bg-white border border-slate-200 p-6 rounded-lg text-center">
                <div className="text-4xl font-bold text-slate-950 mb-2">24/7</div>
                <div className="text-slate-600">Security Monitoring</div>
              </div>

              <div className="bg-white border border-slate-200 p-6 rounded-lg text-center">
                <div className="text-4xl font-bold text-slate-950 mb-2">Daily</div>
                <div className="text-slate-600">Automated Backups</div>
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
              Questions about security?
            </h2>
            <p className="text-xl text-slate-600 mb-8">
              Our security team is available to answer any questions about our practices and certifications
            </p>
            <Link href="/contact">
              <Button size="lg" className="bg-slate-950 text-foreground hover:text-background hover:bg-slate-800 px-8 h-14 text-lg font-medium">
                Contact Security Team
                <ArrowRight className="ml-2 h-5 w-5" />
              </Button>
            </Link>
          </div>
        </div>
      </section>
    </div>
  )
}
