import { Button } from "@/components/ui/button"
import { ArrowRight, Check, Mail } from "lucide-react"
import Link from "next/link"

export default function PricingPage() {
  return (
    <div className="min-h-screen bg-white">
      {/* Hero Section */}
      <section className="relative bg-slate-950 text-white py-24">
        <div className="absolute inset-0 bg-[linear-gradient(rgba(148,163,184,0.05)_1px,transparent_1px),linear-gradient(90deg,rgba(148,163,184,0.05)_1px,transparent_1px)] bg-[size:64px_64px]"></div>

        <div className="relative container mx-auto px-6">
          <div className="max-w-4xl mx-auto text-center">
            <h1 className="text-5xl md:text-6xl font-bold mb-6 tracking-tight">
              Simple, transparent pricing
            </h1>
            <p className="text-xl text-slate-400 mb-8">
              Enterprise-grade parts procurement platform built for operations teams
            </p>
          </div>
        </div>
      </section>

      {/* Pricing Cards */}
      <section className="py-24 bg-white">
        <div className="container mx-auto px-6">
          <div className="max-w-6xl mx-auto">
            <div className="grid md:grid-cols-3 gap-8">
              {/* Basic Plan */}
              <div className="border-2 border-slate-200 rounded-lg p-8 bg-white flex flex-col">
                <h3 className="text-2xl font-bold text-slate-950 mb-2">Basic</h3>
                <p className="text-slate-600 mb-6">For small operations getting started</p>

                <div className="mb-6">
                  <div className="flex items-baseline gap-2">
                    <span className="text-5xl font-bold text-slate-950">$99</span>
                    <span className="text-slate-600">/month</span>
                  </div>
                  <p className="text-sm text-slate-600 mt-2">Billed monthly</p>
                </div>

                <ul className="space-y-4 mb-8 flex-grow">
                  <li className="flex items-start gap-3">
                    <Check className="h-5 w-5 text-emerald-600 mt-0.5 flex-shrink-0" />
                    <span className="text-slate-700">AI-powered part search</span>
                  </li>
                  <li className="flex items-start gap-3">
                    <Check className="h-5 w-5 text-emerald-600 mt-0.5 flex-shrink-0" />
                    <span className="text-slate-700">Quote management</span>
                  </li>
                  <li className="flex items-start gap-3">
                    <Check className="h-5 w-5 text-emerald-600 mt-0.5 flex-shrink-0" />
                    <span className="text-slate-700">Up to 5 vehicles</span>
                  </li>
                  <li className="flex items-start gap-3">
                    <Check className="h-5 w-5 text-emerald-600 mt-0.5 flex-shrink-0" />
                    <span className="text-slate-700">Basic equipment tracking</span>
                  </li>
                  <li className="flex items-start gap-3">
                    <Check className="h-5 w-5 text-emerald-600 mt-0.5 flex-shrink-0" />
                    <span className="text-slate-700">Email support</span>
                  </li>
                </ul>

                <Link href="/login" className="mt-auto">
                  <Button size="lg" variant="outline" className="w-full border-slate-300 text-foreground hover:bg-slate-50 hover:text-background h-12">
                    Get Started
                  </Button>
                </Link>
              </div>

              {/* Professional Plan */}
              <div className="border-2 border-slate-950 rounded-lg p-8 bg-white relative flex flex-col">
                <div className="absolute -top-4 left-1/2 -translate-x-1/2">
                  <span className="bg-emerald-600 text-white px-4 py-1 rounded-full text-sm font-medium">
                    Most Popular
                  </span>
                </div>

                <h3 className="text-2xl font-bold text-slate-950 mb-2">Professional</h3>
                <p className="text-slate-600 mb-6">For growing operations teams</p>

                <div className="mb-6">
                  <div className="flex items-baseline gap-2">
                    <span className="text-5xl font-bold text-slate-950">$299</span>
                    <span className="text-slate-600">/month</span>
                  </div>
                  <p className="text-sm text-slate-600 mt-2">Billed monthly</p>
                </div>

                <ul className="space-y-4 mb-8 flex-grow">
                  <li className="flex items-start gap-3">
                    <Check className="h-5 w-5 text-emerald-600 mt-0.5 flex-shrink-0" />
                    <span className="text-slate-700">Everything in Basic</span>
                  </li>
                  <li className="flex items-start gap-3">
                    <Check className="h-5 w-5 text-emerald-600 mt-0.5 flex-shrink-0" />
                    <span className="text-slate-700">Unlimited vehicles</span>
                  </li>
                  <li className="flex items-start gap-3">
                    <Check className="h-5 w-5 text-emerald-600 mt-0.5 flex-shrink-0" />
                    <span className="text-slate-700">Advanced equipment tracking</span>
                  </li>
                  <li className="flex items-start gap-3">
                    <Check className="h-5 w-5 text-emerald-600 mt-0.5 flex-shrink-0" />
                    <span className="text-slate-700">Supplier communication tools</span>
                  </li>
                  <li className="flex items-start gap-3">
                    <Check className="h-5 w-5 text-emerald-600 mt-0.5 flex-shrink-0" />
                    <span className="text-slate-700">Price comparison & analytics</span>
                  </li>
                  <li className="flex items-start gap-3">
                    <Check className="h-5 w-5 text-emerald-600 mt-0.5 flex-shrink-0" />
                    <span className="text-slate-700">Priority email support</span>
                  </li>
                </ul>

                <Link href="/login" className="mt-auto">
                  <Button size="lg" className="w-full bg-slate-950 text-white hover:bg-slate-800 h-12">
                    Get Started
                    <ArrowRight className="ml-2 h-4 w-4" />
                  </Button>
                </Link>
              </div>

              {/* Enterprise Plan */}
              <div className="border-2 border-slate-200 rounded-lg p-8 bg-white flex flex-col">
                <h3 className="text-2xl font-bold text-slate-950 mb-2">Enterprise</h3>
                <p className="text-slate-600 mb-6">For large-scale operations</p>

                <div className="mb-6">
                  <div className="flex items-baseline gap-2">
                    <span className="text-5xl font-bold text-slate-950">$799</span>
                    <span className="text-slate-600">/month</span>
                  </div>
                  <p className="text-sm text-slate-600 mt-2">Billed monthly</p>
                </div>

                <ul className="space-y-4 mb-8 flex-grow">
                  <li className="flex items-start gap-3">
                    <Check className="h-5 w-5 text-emerald-600 mt-0.5 flex-shrink-0" />
                    <span className="text-slate-700">Everything in Professional</span>
                  </li>
                  <li className="flex items-start gap-3">
                    <Check className="h-5 w-5 text-emerald-600 mt-0.5 flex-shrink-0" />
                    <span className="text-slate-700">Dedicated account manager</span>
                  </li>
                  <li className="flex items-start gap-3">
                    <Check className="h-5 w-5 text-emerald-600 mt-0.5 flex-shrink-0" />
                    <span className="text-slate-700">Custom integrations</span>
                  </li>
                  <li className="flex items-start gap-3">
                    <Check className="h-5 w-5 text-emerald-600 mt-0.5 flex-shrink-0" />
                    <span className="text-slate-700">24/7 priority support</span>
                  </li>
                  <li className="flex items-start gap-3">
                    <Check className="h-5 w-5 text-emerald-600 mt-0.5 flex-shrink-0" />
                    <span className="text-slate-700">Advanced analytics & reporting</span>
                  </li>
                  <li className="flex items-start gap-3">
                    <Check className="h-5 w-5 text-emerald-600 mt-0.5 flex-shrink-0" />
                    <span className="text-slate-700">Training & onboarding</span>
                  </li>
                  <li className="flex items-start gap-3">
                    <Check className="h-5 w-5 text-emerald-600 mt-0.5 flex-shrink-0" />
                    <span className="text-slate-700">SLA guarantees</span>
                  </li>
                </ul>

                <Link href="/contact" className="mt-auto">
                  <Button size="lg" variant="outline" className="w-full border-slate-300 text-foreground hover:bg-slate-50 hover:text-background h-12">
                    Contact Sales
                  </Button>
                </Link>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* FAQ Section */}
      <section className="py-24 bg-slate-50">
        <div className="container mx-auto px-6">
          <div className="max-w-3xl mx-auto">
            <h2 className="text-4xl font-bold mb-12 text-slate-950 text-center tracking-tight">
              Frequently asked questions
            </h2>

            <div className="space-y-8">
              <div>
                <h3 className="text-xl font-bold text-slate-950 mb-3">How is pricing determined?</h3>
                <p className="text-slate-600 leading-relaxed">
                  Pricing is customized based on your organization's size, number of users, equipment count, and specific feature requirements. Contact our sales team for a tailored quote.
                </p>
              </div>

              <div>
                <h3 className="text-xl font-bold text-slate-950 mb-3">Is there a free trial?</h3>
                <p className="text-slate-600 leading-relaxed">
                  We offer product demonstrations to qualified prospects. Schedule a demo to see the platform in action and discuss trial options.
                </p>
              </div>

              <div>
                <h3 className="text-xl font-bold text-slate-950 mb-3">What's included in implementation?</h3>
                <p className="text-slate-600 leading-relaxed">
                  Implementation includes system setup, data migration assistance, supplier network integration, team training, and ongoing support during the onboarding period.
                </p>
              </div>

              <div>
                <h3 className="text-xl font-bold text-slate-950 mb-3">Can I upgrade or downgrade my plan?</h3>
                <p className="text-slate-600 leading-relaxed">
                  Yes, plans can be adjusted as your needs change. Contact your account manager to discuss plan modifications.
                </p>
              </div>

              <div>
                <h3 className="text-xl font-bold text-slate-950 mb-3">What payment methods do you accept?</h3>
                <p className="text-slate-600 leading-relaxed">
                  We accept major credit cards, ACH transfers, and wire transfers. Enterprise customers can request custom payment terms.
                </p>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* CTA Section */}
      <section className="py-24 bg-white">
        <div className="container mx-auto px-6">
          <div className="max-w-4xl mx-auto">
            <div className="bg-slate-950 text-white p-12 rounded-lg text-center">
              <Mail className="h-12 w-12 mx-auto mb-6 text-white" />
              <h2 className="text-4xl font-bold mb-4 tracking-tight">
                Ready to discuss pricing?
              </h2>
              <p className="text-xl text-slate-400 mb-8 max-w-2xl mx-auto">
                Contact our sales team to get a custom quote tailored to your organization's needs
              </p>
              <Link href="/contact">
                <Button size="lg" className="bg-white text-background hover:text-foreground hover:bg-background px-8 h-14 text-lg font-medium">
                  Contact Sales
                  <ArrowRight className="ml-2 h-5 w-5" />
                </Button>
              </Link>
            </div>
          </div>
        </div>
      </section>
    </div>
  )
}
