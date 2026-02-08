import { Button } from "@/components/ui/button"
import { Mail, MessageSquare, Phone, MapPin } from "lucide-react"

export default function ContactPage() {
  return (
    <div className="min-h-screen bg-white">
      {/* Hero Section */}
      <section className="relative bg-slate-950 text-white py-24">
        <div className="absolute inset-0 bg-[linear-gradient(rgba(148,163,184,0.05)_1px,transparent_1px),linear-gradient(90deg,rgba(148,163,184,0.05)_1px,transparent_1px)] bg-[size:64px_64px]"></div>

        <div className="relative container mx-auto px-6">
          <div className="max-w-4xl mx-auto text-center">
            <h1 className="text-5xl md:text-6xl font-bold mb-6 tracking-tight">
              Get in touch
            </h1>
            <p className="text-xl text-slate-400 mb-8">
              Our team is here to answer your questions about PartsIQ
            </p>
          </div>
        </div>
      </section>

      {/* Contact Options */}
      <section className="py-24 bg-white">
        <div className="container mx-auto px-6">
          <div className="max-w-5xl mx-auto">
            <div className="grid md:grid-cols-3 gap-8 mb-16">
              {/* Sales */}
              <div className="text-center">
                <div className="w-16 h-16 bg-slate-950 rounded-lg flex items-center justify-center mx-auto mb-4">
                  <MessageSquare className="h-8 w-8 text-white" />
                </div>
                <h3 className="text-xl font-bold text-slate-950 mb-3">Sales</h3>
                <p className="text-slate-600 mb-4">
                  Interested in PartsIQ for your organization?
                </p>
                <a href="mailto:sales@partsiq.com" className="text-blue-600 hover:text-blue-700 font-medium">
                  sales@partsiq.com
                </a>
              </div>

              {/* Support */}
              <div className="text-center">
                <div className="w-16 h-16 bg-slate-950 rounded-lg flex items-center justify-center mx-auto mb-4">
                  <Mail className="h-8 w-8 text-white" />
                </div>
                <h3 className="text-xl font-bold text-slate-950 mb-3">Support</h3>
                <p className="text-slate-600 mb-4">
                  Need help with your account?
                </p>
                <a href="mailto:support@partsiq.com" className="text-blue-600 hover:text-blue-700 font-medium">
                  support@partsiq.com
                </a>
              </div>

              {/* General */}
              <div className="text-center">
                <div className="w-16 h-16 bg-slate-950 rounded-lg flex items-center justify-center mx-auto mb-4">
                  <Phone className="h-8 w-8 text-white" />
                </div>
                <h3 className="text-xl font-bold text-slate-950 mb-3">General Inquiries</h3>
                <p className="text-slate-600 mb-4">
                  Questions about PartsIQ?
                </p>
                <a href="mailto:info@partsiq.com" className="text-blue-600 hover:text-blue-700 font-medium">
                  info@partsiq.com
                </a>
              </div>
            </div>

            {/* Contact Form */}
            <div className="max-w-2xl mx-auto">
              <div className="bg-slate-50 border border-slate-200 rounded-lg p-8">
                <h2 className="text-2xl font-bold text-slate-950 mb-6">Send us a message</h2>

                <form className="space-y-6">
                  <div className="grid md:grid-cols-2 gap-6">
                    <div>
                      <label htmlFor="firstName" className="block text-sm font-medium text-slate-700 mb-2">
                        First Name *
                      </label>
                      <input
                        type="text"
                        id="firstName"
                        className="w-full px-4 py-3 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-slate-950 focus:border-transparent"
                        required
                      />
                    </div>
                    <div>
                      <label htmlFor="lastName" className="block text-sm font-medium text-slate-700 mb-2">
                        Last Name *
                      </label>
                      <input
                        type="text"
                        id="lastName"
                        className="w-full px-4 py-3 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-slate-950 focus:border-transparent"
                        required
                      />
                    </div>
                  </div>

                  <div>
                    <label htmlFor="email" className="block text-sm font-medium text-slate-700 mb-2">
                      Work Email *
                    </label>
                    <input
                      type="email"
                      id="email"
                      className="w-full px-4 py-3 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-slate-950 focus:border-transparent"
                      required
                    />
                  </div>

                  <div>
                    <label htmlFor="company" className="block text-sm font-medium text-slate-700 mb-2">
                      Company
                    </label>
                    <input
                      type="text"
                      id="company"
                      className="w-full px-4 py-3 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-slate-950 focus:border-transparent"
                    />
                  </div>

                  <div>
                    <label htmlFor="subject" className="block text-sm font-medium text-slate-700 mb-2">
                      Subject *
                    </label>
                    <select
                      id="subject"
                      className="w-full px-4 py-3 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-slate-950 focus:border-transparent"
                      required
                    >
                      <option value="">Select a topic</option>
                      <option value="sales">Sales Inquiry</option>
                      <option value="demo">Request a Demo</option>
                      <option value="support">Technical Support</option>
                      <option value="partnership">Partnership Opportunities</option>
                      <option value="other">Other</option>
                    </select>
                  </div>

                  <div>
                    <label htmlFor="message" className="block text-sm font-medium text-slate-700 mb-2">
                      Message *
                    </label>
                    <textarea
                      id="message"
                      rows={6}
                      className="w-full px-4 py-3 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-slate-950 focus:border-transparent resize-none"
                      required
                    ></textarea>
                  </div>

                  <Button type="submit" size="lg" className="w-full bg-slate-950 text-white hover:bg-slate-800 h-12">
                    Send Message
                  </Button>
                </form>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Office Location */}
      <section className="py-24 bg-slate-50">
        <div className="container mx-auto px-6">
          <div className="max-w-4xl mx-auto">
            <div className="flex items-start gap-6">
              <MapPin className="h-8 w-8 text-slate-950 mt-1 flex-shrink-0" />
              <div>
                <h3 className="text-2xl font-bold text-slate-950 mb-3">Headquarters</h3>
                <p className="text-slate-600 leading-relaxed">
                  PartsIQ, Inc.<br />
                  123 Industrial Parkway<br />
                  Suite 400<br />
                  Manufacturing District<br />
                  IN 46250<br />
                  United States
                </p>
              </div>
            </div>
          </div>
        </div>
      </section>
    </div>
  )
}
