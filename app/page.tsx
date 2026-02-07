import { Button } from "@/components/ui/button"
import {
  ArrowRight,
  Clock,
  Search,
  MessageSquare,
  TrendingDown,
  Building2,
  Factory,
  Wrench,
  Shield,
  Package,
  Truck,
  CheckCircle2,
  FileText,
} from "lucide-react"
import Link from "next/link"

export default function HomePage() {
  return (
    <div className="min-h-screen bg-white">
      {/* Hero Section */}
      <section className="relative bg-slate-950 text-white overflow-hidden">
        {/* Subtle grid pattern background */}
        <div className="absolute inset-0 bg-[linear-gradient(rgba(148,163,184,0.05)_1px,transparent_1px),linear-gradient(90deg,rgba(148,163,184,0.05)_1px,transparent_1px)] bg-[size:64px_64px]"></div>

        <div className="relative container mx-auto px-6 py-24 lg:py-32">
          <div className="max-w-4xl">
            <div className="inline-block mb-8">
              <div className="flex items-center gap-2 px-4 py-2 bg-slate-900 border border-slate-800 rounded-full">
                <div className="w-2 h-2 bg-emerald-500 rounded-full animate-pulse"></div>
                <span className="text-sm text-slate-300 tracking-wide">AI-Powered Sourcing Platform</span>
              </div>
            </div>

            <h1 className="text-5xl md:text-7xl font-bold mb-8 leading-[1.1] tracking-tight">
              Machine parts
              <br />
              <span className="text-slate-400">sourced in minutes,</span>
              <br />
              not days
            </h1>

            <p className="text-xl md:text-2xl mb-12 text-slate-400 max-w-2xl leading-relaxed">
              Intelligent automation for industrial parts procurement. Find suppliers, compare quotes, and place orders — all from a single platform.
            </p>

            <div className="flex flex-col sm:flex-row gap-4 mb-16">
              <Link href="/signup">
                <Button
                  size="lg"
                  className="bg-white text-slate-950 hover:bg-slate-100 px-8 h-14 text-lg font-medium"
                >
                  Start Free Trial
                  <ArrowRight className="ml-2 h-5 w-5" />
                </Button>
              </Link>
              <Link href="/login">
                <Button
                  size="lg"
                  variant="outline"
                  className="border-slate-700 text-white hover:bg-slate-900 px-8 h-14 text-lg"
                >
                  Sign In
                </Button>
              </Link>
            </div>

            {/* Key Metrics */}
            <div className="grid grid-cols-3 gap-8 max-w-2xl">
              <div>
                <div className="text-3xl font-bold text-white mb-1">90%</div>
                <div className="text-sm text-slate-500">Time Saved</div>
              </div>
              <div>
                <div className="text-3xl font-bold text-white mb-1">24/7</div>
                <div className="text-sm text-slate-500">Availability</div>
              </div>
              <div>
                <div className="text-3xl font-bold text-white mb-1">&lt;2min</div>
                <div className="text-sm text-slate-500">Avg. Response</div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* How It Works Section */}
      <section className="py-24 bg-slate-50">
        <div className="container mx-auto px-6">
          <div className="max-w-6xl mx-auto">
            <div className="mb-16">
              <h2 className="text-4xl md:text-5xl font-bold mb-4 text-slate-950 tracking-tight">
                How it works
              </h2>
              <p className="text-xl text-slate-600 max-w-2xl">
                From AI-powered part identification to supplier management and equipment tracking
              </p>
            </div>

            <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-8">
              <div className="relative">
                <div className="flex items-start gap-4">
                  <div className="flex-shrink-0 w-12 h-12 bg-slate-950 text-white rounded-lg flex items-center justify-center font-bold text-lg">
                    1
                  </div>
                  <div>
                    <h3 className="text-xl font-bold text-slate-950 mb-3">AI Part Search</h3>
                    <p className="text-slate-600 leading-relaxed">
                      Multi-agent AI searches across suppliers to identify parts by description, photo, or equipment model. Add verified parts to your pick list.
                    </p>
                  </div>
                </div>
              </div>

              <div className="relative">
                <div className="flex items-start gap-4">
                  <div className="flex-shrink-0 w-12 h-12 bg-slate-950 text-white rounded-lg flex items-center justify-center font-bold text-lg">
                    2
                  </div>
                  <div>
                    <h3 className="text-xl font-bold text-slate-950 mb-3">Request Quotes</h3>
                    <p className="text-slate-600 leading-relaxed">
                      Create quote requests that automatically notify suppliers. Track responses, compare pricing, and communicate directly within the platform.
                    </p>
                  </div>
                </div>
              </div>

              <div className="relative">
                <div className="flex items-start gap-4">
                  <div className="flex-shrink-0 w-12 h-12 bg-slate-950 text-white rounded-lg flex items-center justify-center font-bold text-lg">
                    3
                  </div>
                  <div>
                    <h3 className="text-xl font-bold text-slate-950 mb-3">Track Equipment</h3>
                    <p className="text-slate-600 leading-relaxed">
                      Monitor vehicle health, maintenance schedules, and operating hours. Get proactive service reminders based on equipment usage.
                    </p>
                  </div>
                </div>
              </div>

              <div className="relative">
                <div className="flex items-start gap-4">
                  <div className="flex-shrink-0 w-12 h-12 bg-slate-950 text-white rounded-lg flex items-center justify-center font-bold text-lg">
                    4
                  </div>
                  <div>
                    <h3 className="text-xl font-bold text-slate-950 mb-3">Track Orders</h3>
                    <p className="text-slate-600 leading-relaxed">
                      Convert approved quotes into orders with one click. Track order status, delivery timelines, and receive confirmation notifications automatically.
                    </p>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Features Section */}
      <section className="py-24 bg-white">
        <div className="container mx-auto px-6">
          <div className="max-w-6xl mx-auto">
            <div className="grid lg:grid-cols-2 gap-16 items-center mb-20">
              <div>
                <h2 className="text-4xl md:text-5xl font-bold mb-6 text-slate-950 tracking-tight">
                  Multi-agent AI search with pick list
                </h2>
                <p className="text-xl text-slate-600 mb-8 leading-relaxed">
                  Describe what you need and watch our AI search multiple supplier databases simultaneously. Add verified matches to your pick list, then create quote requests with one click.
                </p>
                <div className="space-y-4">
                  <div className="flex items-start gap-3">
                    <MessageSquare className="h-5 w-5 text-slate-950 mt-1 flex-shrink-0" />
                    <div>
                      <div className="font-medium text-slate-950">Multi-agent search</div>
                      <div className="text-slate-600">Simultaneous searches across postgres, pinecone, and neo4j databases</div>
                    </div>
                  </div>
                  <div className="flex items-start gap-3">
                    <Search className="h-5 w-5 text-slate-950 mt-1 flex-shrink-0" />
                    <div>
                      <div className="font-medium text-slate-950">Confidence scoring</div>
                      <div className="text-slate-600">AI ranks matches by relevance with 95%+ accuracy for top results</div>
                    </div>
                  </div>
                  <div className="flex items-start gap-3">
                    <Shield className="h-5 w-5 text-slate-950 mt-1 flex-shrink-0" />
                    <div>
                      <div className="font-medium text-slate-950">Vehicle context awareness</div>
                      <div className="text-slate-600">Search within specific equipment context for exact compatibility</div>
                    </div>
                  </div>
                </div>
              </div>

              <div className="flex gap-0 bg-slate-950 rounded-lg overflow-hidden shadow-lg">
                {/* Chat Interface */}
                <div className="flex-1 flex flex-col bg-slate-950 min-w-0">
                  {/* Chat Header */}
                  <div className="bg-slate-900 border-b border-slate-800 px-4 py-3">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <div className="w-2 h-2 bg-emerald-500 rounded-full animate-pulse"></div>
                        <span className="font-medium text-white">AI Parts Assistant</span>
                      </div>
                      <div className="flex items-center gap-2 px-3 py-1 bg-blue-900/30 border border-blue-700 rounded text-xs text-blue-300">
                        <Search className="h-3 w-3" />
                        Multi-Agent Search
                      </div>
                    </div>
                    <div className="mt-2 flex items-center gap-2 text-xs text-slate-400">
                      <span>Vehicle Context: 2019 John Deere 160GLC Excavator</span>
                    </div>
                  </div>

                  {/* Chat Messages */}
                  <div className="flex-1 p-4 space-y-3 bg-slate-950 max-h-[450px] overflow-y-auto">
                    {/* User Message */}
                    <div className="flex justify-end">
                      <div className="bg-blue-600 text-white rounded-lg rounded-tr-none px-3 py-2 max-w-[75%]">
                        <p className="text-sm">looking for the right boom cylinder</p>
                      </div>
                    </div>

                    {/* AI Response with Search Results */}
                    <div className="flex justify-start">
                      <div className="bg-slate-900 border border-slate-800 rounded-lg rounded-tl-none px-3 py-2.5 max-w-[90%]">
                        <p className="text-sm text-slate-300 mb-3">
                          I found 5 parts matching "looking for the right boom cylinder" for your 2019 John Deere 160GLC Excavator.
                        </p>

                        <div className="mb-3">
                          <div className="flex items-center gap-2 text-xs text-slate-400 mb-2">
                            <Clock className="h-3 w-3" />
                            <span>Search time: 14565.00s • Sources: postgres, pinecone, neo4j</span>
                          </div>
                          <div className="text-xs text-slate-400">Avg confidence: 77%</div>
                        </div>

                        {/* Search Result Card */}
                        <div className="bg-slate-950 border border-slate-700 rounded-lg p-2.5 mb-2">
                          <div className="flex items-start justify-between mb-1.5">
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center gap-1.5 mb-1 flex-wrap">
                                <span className="text-sm font-semibold text-white">9323701G</span>
                                <span className="px-1.5 py-0.5 bg-emerald-900/50 text-emerald-400 border border-emerald-700 text-xs rounded whitespace-nowrap">✓ Verified</span>
                                <span className="px-1.5 py-0.5 bg-amber-900/50 text-amber-400 border border-amber-700 text-xs rounded whitespace-nowrap">Exact</span>
                              </div>
                              <div className="text-xs text-slate-400">Right Boom Hydraulic Cylinder</div>
                            </div>
                            <div className="text-base font-bold text-emerald-400 ml-2">95%</div>
                          </div>

                          <div className="flex items-center gap-2 text-xs text-slate-400 mb-2">
                            <span>pinecone</span>
                            <span>neo4j</span>
                            <span className="text-slate-600">•</span>
                            <span className="text-slate-500">Stock: Unknown</span>
                          </div>

                          <button className="w-full bg-slate-800 hover:bg-slate-700 text-white text-xs font-medium py-1.5 rounded transition-colors">
                            Add to Pick List
                          </button>
                        </div>

                        <button className="text-xs text-slate-400 hover:text-white transition-colors">
                          Show 4 more results →
                        </button>
                      </div>
                    </div>
                  </div>

                  {/* Chat Input */}
                  <div className="border-t border-slate-800 p-3 bg-slate-900">
                    <div className="flex items-center gap-2 px-3 py-2 bg-slate-950 rounded-lg border border-slate-700">
                      <input
                        type="text"
                        placeholder="Describe the part you need..."
                        className="flex-1 bg-transparent text-sm text-slate-300 outline-none placeholder:text-slate-600"
                        disabled
                      />
                      <ArrowRight className="h-4 w-4 text-slate-600" />
                    </div>
                    <div className="text-xs text-slate-500 mt-1.5">AI can identify parts, find suppliers, and help with orders</div>
                  </div>
                </div>

                {/* Pick List Sidebar */}
                <div className="w-56 bg-slate-900 border-l border-slate-800 flex flex-col">
                  <div className="px-3 py-2.5 border-b border-slate-800">
                    <div className="flex items-center justify-between">
                      <h3 className="font-semibold text-white text-sm">Pick List</h3>
                      <span className="text-xs text-slate-400">(1)</span>
                    </div>
                  </div>

                  <div className="flex-1 p-3 overflow-y-auto">
                    {/* Pick List Item */}
                    <div className="bg-slate-950 border border-slate-700 rounded-lg p-2.5 mb-2">
                      <div className="flex items-start justify-between mb-1.5">
                        <div className="flex-1 min-w-0">
                          <div className="text-sm font-semibold text-white mb-0.5 truncate">9323701G</div>
                          <div className="text-xs text-slate-400 leading-tight line-clamp-2">Right Boom Hydraulic Cylinder</div>
                        </div>
                        <button className="text-slate-500 hover:text-white ml-1 flex-shrink-0">
                          <span className="text-base leading-none">×</span>
                        </button>
                      </div>
                      <div className="text-xs text-slate-500">Qty: 1</div>
                    </div>

                    <div className="text-center text-xs text-slate-500 py-6">
                      Add more parts to request quotes
                    </div>
                  </div>

                  <div className="p-3 border-t border-slate-800">
                    <button className="w-full bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-medium py-2 rounded-lg transition-colors">
                      Create Quote Request (1)
                    </button>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Quote Management Section */}
      <section className="py-24 bg-slate-50 border-t border-slate-200">
        <div className="container mx-auto px-6">
          <div className="max-w-6xl mx-auto">
            <div className="grid lg:grid-cols-2 gap-16 items-center">
              <div className="order-2 lg:order-1">
                <div className="bg-white border border-slate-200 rounded-lg shadow-sm overflow-hidden">
                  {/* Quote Request Header */}
                  <div className="bg-slate-50 border-b border-slate-200 p-5">
                    <div className="flex items-start justify-between mb-3">
                      <div>
                        <div className="text-xs text-slate-500 mb-1">Quote Request #QR-02-2026-0001</div>
                        <h3 className="text-lg font-bold text-slate-950">Quote Request - 3 Items</h3>
                        <p className="text-sm text-slate-600 mt-0.5">John Deere 160GLC Excavator (2019)</p>
                      </div>
                      <div className="flex items-center gap-1.5 px-2.5 py-1 bg-blue-100 border border-blue-300 rounded-full">
                        <div className="w-1.5 h-1.5 bg-blue-600 rounded-full animate-pulse"></div>
                        <span className="text-xs font-medium text-blue-700">Sent</span>
                      </div>
                    </div>
                    <div className="flex items-center gap-3 text-xs text-slate-600">
                      <span>Requested: Feb 3, 2026</span>
                      <span>•</span>
                      <span>Created By: Manager User</span>
                    </div>
                  </div>

                  {/* Tabs */}
                  <div className="border-b border-slate-200 px-5">
                    <div className="flex gap-5">
                      <button className="pb-2.5 text-sm font-medium text-slate-950 border-b-2 border-slate-950">
                        Supplier Communication
                      </button>
                      <button className="pb-2.5 text-sm font-medium text-slate-500">
                        Price Comparison
                      </button>
                    </div>
                  </div>

                  {/* Supplier Communication View */}
                  <div className="p-5 space-y-3 max-h-[500px] overflow-y-auto">
                    {/* Supplier 1 - Waiting */}
                    <div className="border border-slate-200 rounded-lg p-3.5 bg-white">
                      <div className="flex items-start justify-between mb-2.5">
                        <div className="flex-1">
                          <div className="flex items-center gap-2 mb-1">
                            <h4 className="font-semibold text-slate-950">Acme Parts Supply</h4>
                            <span className="px-2 py-0.5 bg-blue-100 text-blue-700 text-xs font-medium rounded">Sent</span>
                          </div>
                          <div className="text-xs text-slate-600">contact@acmepartsupply.com</div>
                          <div className="text-xs text-slate-500 mt-0.5">Contact: Product Support Rep</div>
                        </div>
                        <button className="text-sm text-blue-600 hover:text-blue-700 font-medium">+ message</button>
                      </div>

                      {/* Communication Thread */}
                      <div className="bg-slate-50 rounded-lg p-2.5 mb-2.5">
                        <div className="flex items-start gap-2 mb-1.5">
                          <div className="flex-shrink-0 w-5 h-5 bg-blue-600 text-white rounded-full flex items-center justify-center text-xs font-bold">
                            S
                          </div>
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2 mb-1">
                              <span className="text-xs font-medium text-slate-950">Sent</span>
                              <span className="text-xs text-slate-500">Feb 3, 2026, 3:14 AM</span>
                            </div>
                            <div className="text-xs text-slate-700 bg-white rounded p-2 border border-slate-200 leading-snug">
                              I am writing from Demo Construction Co. to request a quote for excavator parts...
                            </div>
                          </div>
                        </div>
                        <div className="flex items-center gap-1.5 text-xs text-slate-500 pl-7">
                          <Clock className="h-3 w-3" />
                          <span>Awaiting response (0 days)</span>
                        </div>
                      </div>

                      <button className="w-full border border-slate-300 text-slate-950 text-sm font-medium py-1.5 rounded-lg hover:bg-slate-50 transition-colors">
                        Send Follow-Up
                      </button>
                    </div>

                    {/* Supplier 2 - Different brand */}
                    <div className="border border-slate-200 rounded-lg p-3.5 bg-white">
                      <div className="flex items-start justify-between mb-2">
                        <div className="flex-1">
                          <div className="flex items-center gap-2 mb-1">
                            <h4 className="font-semibold text-slate-950">Industrial Equipment Direct</h4>
                            <span className="px-2 py-0.5 bg-blue-100 text-blue-700 text-xs font-medium rounded">Sent</span>
                          </div>
                          <div className="text-xs text-slate-500">Awaiting response</div>
                        </div>
                      </div>
                      <div className="flex items-center gap-1.5 text-xs text-slate-500">
                        <Clock className="h-3 w-3" />
                        <span>Sent 0 days ago • No response yet</span>
                      </div>
                    </div>

                    {/* Waiting State Info */}
                    <div className="flex items-center justify-center gap-2 py-5 text-blue-600">
                      <div className="w-4 h-4 border-2 border-blue-600 border-t-transparent rounded-full animate-spin"></div>
                      <span className="text-sm font-medium">Waiting for Supplier Response</span>
                    </div>

                    <div className="bg-blue-50 border border-blue-200 rounded-lg p-3">
                      <div className="text-sm text-blue-900 leading-relaxed">
                        Quote request has been sent to the supplier. Suppliers typically respond within 24-48 hours.
                      </div>
                    </div>
                  </div>

                  {/* Summary Footer */}
                  <div className="border-t border-slate-200 p-4 bg-slate-50">
                    <div className="flex items-center justify-between text-sm mb-3">
                      <div className="text-slate-600">
                        <span className="font-semibold text-slate-950">Supplier Response Rate:</span> 0/2 (0%)
                      </div>
                      <button className="text-blue-600 hover:text-blue-700 font-medium">
                        Extract Prices from Emails
                      </button>
                    </div>
                    <div className="flex items-center gap-2 text-xs text-slate-500">
                      <span>No price quotes received yet. Suppliers haven't responded with pricing information.</span>
                    </div>
                  </div>
                </div>
              </div>

              <div className="order-1 lg:order-2">
                <h2 className="text-4xl md:text-5xl font-bold mb-6 text-slate-950 tracking-tight">
                  Supplier communication & price comparison
                </h2>
                <p className="text-xl text-slate-600 mb-8 leading-relaxed">
                  Track quote requests with full supplier communication history. Compare responses, send follow-ups, and extract pricing from email replies — all in one dashboard.
                </p>
                <div className="space-y-4">
                  <div className="flex items-start gap-3">
                    <div className="flex-shrink-0 w-6 h-6 bg-slate-950 text-white rounded flex items-center justify-center text-xs font-bold">
                      ✓
                    </div>
                    <div>
                      <div className="font-medium text-slate-950">Automated email notifications</div>
                      <div className="text-slate-600">System sends quote requests and tracks supplier responses automatically</div>
                    </div>
                  </div>
                  <div className="flex items-start gap-3">
                    <div className="flex-shrink-0 w-6 h-6 bg-slate-950 text-white rounded flex items-center justify-center text-xs font-bold">
                      ✓
                    </div>
                    <div>
                      <div className="font-medium text-slate-950">AI price extraction</div>
                      <div className="text-slate-600">Automatically extract and compare pricing from supplier email responses</div>
                    </div>
                  </div>
                  <div className="flex items-start gap-3">
                    <div className="flex-shrink-0 w-6 h-6 bg-slate-950 text-white rounded flex items-center justify-center text-xs font-bold">
                      ✓
                    </div>
                    <div>
                      <div className="font-medium text-slate-950">Communication history</div>
                      <div className="text-slate-600">Full thread visibility with timestamps and follow-up reminders</div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Order Tracking Section */}
      <section className="py-24 bg-white border-t border-slate-200">
        <div className="container mx-auto px-6">
          <div className="max-w-6xl mx-auto">
            <div className="grid lg:grid-cols-2 gap-16 items-center">
              <div>
                <h2 className="text-4xl md:text-5xl font-bold mb-6 text-slate-950 tracking-tight">
                  Order management & delivery tracking
                </h2>
                <p className="text-xl text-slate-600 mb-8 leading-relaxed">
                  Convert approved quotes into orders with one click. Track every order from placement through delivery with full visibility into status, shipping, and item receipt.
                </p>
                <div className="space-y-4">
                  <div className="flex items-start gap-3">
                    <div className="flex-shrink-0 w-6 h-6 bg-slate-950 text-white rounded flex items-center justify-center text-xs font-bold">
                      ✓
                    </div>
                    <div>
                      <div className="font-medium text-slate-950">One-click quote to order conversion</div>
                      <div className="text-slate-600">Approve a quote and convert it into a tracked order instantly</div>
                    </div>
                  </div>
                  <div className="flex items-start gap-3">
                    <div className="flex-shrink-0 w-6 h-6 bg-slate-950 text-white rounded flex items-center justify-center text-xs font-bold">
                      ✓
                    </div>
                    <div>
                      <div className="font-medium text-slate-950">Real-time status tracking</div>
                      <div className="text-slate-600">Monitor orders through every stage — pending, processing, in transit, delivered</div>
                    </div>
                  </div>
                  <div className="flex items-start gap-3">
                    <div className="flex-shrink-0 w-6 h-6 bg-slate-950 text-white rounded flex items-center justify-center text-xs font-bold">
                      ✓
                    </div>
                    <div>
                      <div className="font-medium text-slate-950">Delivery confirmation & item receipt</div>
                      <div className="text-slate-600">Track shipping carriers, confirm individual item receipt, and maintain full audit trails</div>
                    </div>
                  </div>
                </div>
              </div>

              <div className="bg-white border border-slate-200 rounded-lg shadow-sm overflow-hidden">
                {/* Order Header */}
                <div className="bg-slate-50 border-b border-slate-200 p-5">
                  <div className="flex items-start justify-between mb-3">
                    <div>
                      <div className="text-xs text-slate-500 mb-1">Order #ORD-02-2026-0042</div>
                      <h3 className="text-lg font-bold text-slate-950">Excavator Parts Order</h3>
                      <p className="text-sm text-slate-600 mt-0.5">Acme Parts Supply</p>
                    </div>
                    <div className="flex items-center gap-1.5 px-2.5 py-1 bg-indigo-100 border border-indigo-300 rounded-full">
                      <Truck className="h-3 w-3 text-indigo-700" />
                      <span className="text-xs font-medium text-indigo-700">In Transit</span>
                    </div>
                  </div>
                  <div className="flex items-center gap-3 text-xs text-slate-600">
                    <span>Ordered: Feb 4, 2026</span>
                    <span>•</span>
                    <span>Expected: Feb 8, 2026</span>
                  </div>
                </div>

                {/* Order Info Cards */}
                <div className="grid grid-cols-3 gap-3 p-5 border-b border-slate-200">
                  <div className="bg-slate-50 rounded-lg p-3">
                    <div className="flex items-center gap-1.5 text-xs text-slate-500 mb-1">
                      <Building2 className="h-3 w-3" />
                      Supplier
                    </div>
                    <div className="text-sm font-medium text-slate-950">Acme Parts Supply</div>
                    <div className="text-xs text-slate-500">contact@acmepartsupply.com</div>
                  </div>
                  <div className="bg-slate-50 rounded-lg p-3">
                    <div className="flex items-center gap-1.5 text-xs text-slate-500 mb-1">
                      <Truck className="h-3 w-3" />
                      Shipping
                    </div>
                    <div className="text-sm font-medium text-slate-950">FedEx Ground</div>
                    <div className="text-xs text-slate-500">7489 2841 0037</div>
                  </div>
                  <div className="bg-slate-50 rounded-lg p-3">
                    <div className="flex items-center gap-1.5 text-xs text-slate-500 mb-1">
                      <FileText className="h-3 w-3" />
                      Quote Ref
                    </div>
                    <div className="text-sm font-medium text-slate-950">QR-02-2026-0001</div>
                    <div className="text-xs text-blue-600">View Quote →</div>
                  </div>
                </div>

                {/* Order Items */}
                <div className="p-5 space-y-2.5">
                  <div className="flex items-center justify-between mb-2">
                    <div className="text-sm font-semibold text-slate-950">Order Items</div>
                    <span className="px-2 py-0.5 bg-emerald-100 text-emerald-700 text-xs font-medium rounded">1 / 3 Received</span>
                  </div>

                  <div className="border border-slate-200 rounded-lg p-3 bg-white">
                    <div className="flex items-center justify-between mb-1.5">
                      <div className="flex items-center gap-2">
                        <CheckCircle2 className="h-4 w-4 text-emerald-500" />
                        <span className="text-sm font-semibold text-slate-950">9323701G</span>
                      </div>
                      <span className="text-sm font-medium text-slate-950">$2,450.00</span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-xs text-slate-500 ml-6">Right Boom Hydraulic Cylinder</span>
                      <span className="text-xs text-emerald-600">Received</span>
                    </div>
                  </div>

                  <div className="border border-slate-200 rounded-lg p-3 bg-white">
                    <div className="flex items-center justify-between mb-1.5">
                      <div className="flex items-center gap-2">
                        <Package className="h-4 w-4 text-indigo-500" />
                        <span className="text-sm font-semibold text-slate-950">AT435757</span>
                      </div>
                      <span className="text-sm font-medium text-slate-950">$189.00</span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-xs text-slate-500 ml-6">Hydraulic Filter Element</span>
                      <span className="text-xs text-indigo-600">In Transit</span>
                    </div>
                  </div>

                  <div className="border border-slate-200 rounded-lg p-3 bg-white">
                    <div className="flex items-center justify-between mb-1.5">
                      <div className="flex items-center gap-2">
                        <Clock className="h-4 w-4 text-amber-500" />
                        <span className="text-sm font-semibold text-slate-950">RE532552</span>
                      </div>
                      <span className="text-sm font-medium text-slate-950">$67.50</span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-xs text-slate-500 ml-6">Engine Oil Filter</span>
                      <span className="text-xs text-amber-600">Processing</span>
                    </div>
                  </div>
                </div>

                {/* Order Total */}
                <div className="border-t border-slate-200 p-4 bg-slate-50">
                  <div className="flex items-center justify-between text-sm mb-1">
                    <span className="text-slate-600">Subtotal</span>
                    <span className="text-slate-950">$2,706.50</span>
                  </div>
                  <div className="flex items-center justify-between text-sm mb-2">
                    <span className="text-slate-600">Shipping</span>
                    <span className="text-slate-950">$45.00</span>
                  </div>
                  <div className="flex items-center justify-between text-base font-bold border-t border-slate-200 pt-2">
                    <span className="text-slate-950">Total</span>
                    <span className="text-slate-950">$2,751.50</span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Benefits Section */}
      <section className="py-24 bg-slate-950 text-white">
        <div className="container mx-auto px-6">
          <div className="max-w-6xl mx-auto">
            <div className="mb-16">
              <h2 className="text-4xl md:text-5xl font-bold mb-4 tracking-tight">
                Reduce downtime, control costs
              </h2>
              <p className="text-xl text-slate-400 max-w-2xl">
                Purpose-built for operations teams who can't afford delays
              </p>
            </div>

            <div className="grid md:grid-cols-3 gap-8">
              <div className="border border-slate-800 bg-slate-900/50 p-8 rounded-lg">
                <Clock className="h-8 w-8 text-white mb-4" />
                <div className="text-3xl font-bold mb-2">Hours → Minutes</div>
                <p className="text-slate-400 leading-relaxed">
                  Reduce average sourcing time from 4+ hours to under 15 minutes per part
                </p>
              </div>

              <div className="border border-slate-800 bg-slate-900/50 p-8 rounded-lg">
                <TrendingDown className="h-8 w-8 text-white mb-4" />
                <div className="text-3xl font-bold mb-2">Better Pricing</div>
                <p className="text-slate-400 leading-relaxed">
                  Compare multiple suppliers instantly to ensure competitive pricing on every order
                </p>
              </div>

              <div className="border border-slate-800 bg-slate-900/50 p-8 rounded-lg">
                <Shield className="h-8 w-8 text-white mb-4" />
                <div className="text-3xl font-bold mb-2">Audit Trail</div>
                <p className="text-slate-400 leading-relaxed">
                  Complete procurement history with quotes, orders, and delivery confirmations
                </p>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Equipment Tracking Section */}
      <section className="py-24 bg-white">
        <div className="container mx-auto px-6">
          <div className="max-w-6xl mx-auto">
            <div className="grid lg:grid-cols-2 gap-16 items-center">
              <div>
                <h2 className="text-4xl md:text-5xl font-bold mb-6 text-slate-950 tracking-tight">
                  Equipment tracking & predictive maintenance
                </h2>
                <p className="text-xl text-slate-600 mb-8 leading-relaxed">
                  Monitor equipment health scores, track operating hours, and get automated service reminders based on OEM maintenance schedules. Never miss critical maintenance windows.
                </p>
                <div className="space-y-4">
                  <div className="flex items-start gap-3">
                    <Clock className="h-5 w-5 text-slate-950 mt-1 flex-shrink-0" />
                    <div>
                      <div className="font-medium text-slate-950">Operating hour tracking</div>
                      <div className="text-slate-600">Automatic updates with real-time equipment usage monitoring</div>
                    </div>
                  </div>
                  <div className="flex items-start gap-3">
                    <Shield className="h-5 w-5 text-slate-950 mt-1 flex-shrink-0" />
                    <div>
                      <div className="font-medium text-slate-950">Health score monitoring</div>
                      <div className="text-slate-600">AI-powered health assessments based on usage patterns and maintenance history</div>
                    </div>
                  </div>
                  <div className="flex items-start gap-3">
                    <MessageSquare className="h-5 w-5 text-slate-950 mt-1 flex-shrink-0" />
                    <div>
                      <div className="font-medium text-slate-950">OEM maintenance schedules</div>
                      <div className="text-slate-600">Pre-loaded service intervals from manufacturer specifications</div>
                    </div>
                  </div>
                </div>
              </div>

              <div className="bg-slate-950 rounded-lg overflow-hidden shadow-lg">
                {/* Vehicle Header */}
                <div className="bg-slate-900 border-b border-slate-800 p-5">
                  <div className="flex items-start justify-between mb-3">
                    <div>
                      <h3 className="text-lg font-bold text-white mb-1">2019 John Deere 160GLC Excavator</h3>
                      <p className="text-xs text-slate-400">JD-001 • IFF160GXE056001</p>
                    </div>
                    <span className="px-2.5 py-0.5 bg-emerald-900/50 text-emerald-400 text-xs font-medium rounded-full border border-emerald-700">
                      ACTIVE
                    </span>
                  </div>

                  <div className="grid grid-cols-3 gap-3">
                    <div>
                      <div className="text-xs text-slate-500 mb-0.5">Operating Hours</div>
                      <div className="text-xl font-bold text-white">650</div>
                      <div className="text-xs text-slate-400">Updated today</div>
                    </div>
                    <div>
                      <div className="text-xs text-slate-500 mb-0.5">Health Score</div>
                      <div className="text-xl font-bold text-emerald-400">88%</div>
                      <div className="text-xs text-emerald-400">Good</div>
                    </div>
                    <div>
                      <div className="text-xs text-slate-500 mb-0.5">Next Service</div>
                      <div className="text-xl font-bold text-white">0 hrs</div>
                      <div className="text-xs text-amber-400">@ 650 hrs</div>
                    </div>
                  </div>
                </div>

                {/* Upcoming Service Alert */}
                <div className="bg-amber-900/20 border-l-4 border-amber-600 p-3 mx-5 mt-3">
                  <div className="flex items-start gap-2.5">
                    <div className="flex-shrink-0 w-7 h-7 bg-amber-600 rounded-full flex items-center justify-center">
                      <span className="text-white text-xs">⚠</span>
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="font-semibold text-amber-400 text-sm mb-1">Fuel System Service</div>
                      <div className="text-xs text-amber-300 mb-2 leading-snug">
                        Drain water and sediment from fuel tank sump, primary/auxiliary/final fuel filters and water separators.
                      </div>
                      <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs">
                        <span className="text-amber-400">Every 50 hours</span>
                        <span className="text-slate-500">•</span>
                        <span className="text-amber-400">Current: 650 hrs</span>
                        <span className="text-slate-500">•</span>
                        <span className="text-amber-400">Next: 650 hrs</span>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Maintenance Schedule List */}
                <div className="p-5 space-y-2.5 max-h-[280px] overflow-y-auto">
                  <div className="text-sm font-semibold text-white mb-2">Upcoming Maintenance</div>

                  <div className="bg-slate-900 border border-slate-800 rounded-lg p-2.5">
                    <div className="flex items-center justify-between mb-1.5">
                      <span className="text-sm font-medium text-white">Daily Checks</span>
                      <span className="text-xs text-slate-400">Next: 660 hrs</span>
                    </div>
                    <div className="text-xs text-slate-500 leading-snug">Check hydraulic tank oil level, engine oil level, engine coolant level</div>
                  </div>

                  <div className="bg-slate-900 border border-slate-800 rounded-lg p-2.5">
                    <div className="flex items-center justify-between mb-1.5">
                      <span className="text-sm font-medium text-white">Track Inspection</span>
                      <span className="text-xs text-slate-400">Next: 700 hrs</span>
                    </div>
                    <div className="text-xs text-slate-500">Inspect and re-torque track hardware</div>
                  </div>

                  <div className="bg-slate-900 border border-slate-800 rounded-lg p-2.5">
                    <div className="flex items-center justify-between mb-1.5">
                      <span className="text-sm font-medium text-white">Gear Case & Lubrication</span>
                      <span className="text-xs text-slate-400">Next: 750 hrs</span>
                    </div>
                    <div className="text-xs text-slate-500">Check gear case oil level, drain water, lubricate hydraulic tank</div>
                  </div>
                </div>

                <div className="border-t border-slate-800 p-3 bg-slate-900">
                  <button className="w-full text-sm text-slate-400 hover:text-white transition-colors text-center">
                    View Full Maintenance Schedule →
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Target Audience Section */}
      <section className="py-24 bg-slate-50">
        <div className="container mx-auto px-6">
          <div className="max-w-6xl mx-auto">
            <div className="mb-16">
              <h2 className="text-4xl md:text-5xl font-bold mb-4 text-slate-950 tracking-tight">
                Built for industrial operations
              </h2>
              <p className="text-xl text-slate-600 max-w-2xl">
                Whether you're managing a single facility or coordinating across multiple sites
              </p>
            </div>

            <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-6">
              <div className="bg-white border border-slate-200 p-6 rounded-lg">
                <Factory className="h-8 w-8 text-slate-950 mb-4" />
                <h3 className="text-lg font-bold text-slate-950 mb-2">Manufacturing</h3>
                <p className="text-slate-600 text-sm">
                  Production lines that can't wait days for replacement parts
                </p>
              </div>

              <div className="bg-white border border-slate-200 p-6 rounded-lg">
                <Wrench className="h-8 w-8 text-slate-950 mb-4" />
                <h3 className="text-lg font-bold text-slate-950 mb-2">Maintenance Teams</h3>
                <p className="text-slate-600 text-sm">
                  Multi-site operations requiring consistent supplier access
                </p>
              </div>

              <div className="bg-white border border-slate-200 p-6 rounded-lg">
                <Building2 className="h-8 w-8 text-slate-950 mb-4" />
                <h3 className="text-lg font-bold text-slate-950 mb-2">OEMs</h3>
                <p className="text-slate-600 text-sm">
                  Support teams managing aftermarket parts and service requests
                </p>
              </div>

              <div className="bg-white border border-slate-200 p-6 rounded-lg">
                <Shield className="h-8 w-8 text-slate-950 mb-4" />
                <h3 className="text-lg font-bold text-slate-950 mb-2">Distributors</h3>
                <p className="text-slate-600 text-sm">
                  Streamline procurement workflows and supplier coordination
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
            <div className="bg-slate-950 text-white p-12 rounded-lg">
              <h2 className="text-4xl md:text-5xl font-bold mb-6 tracking-tight">
                Ready to streamline your parts procurement?
              </h2>
              <p className="text-xl text-slate-400 mb-8 max-w-2xl">
                See how PartsIQ can reduce sourcing time and keep your operations running smoothly.
              </p>

              <div className="flex flex-col sm:flex-row gap-4">
                <Link href="/signup">
                  <Button
                    size="lg"
                    className="bg-white text-slate-950 hover:bg-slate-100 px-8 h-14 text-lg font-medium"
                  >
                    Start Free Trial
                    <ArrowRight className="ml-2 h-5 w-5" />
                  </Button>
                </Link>
                <Link href="/login">
                  <Button
                    size="lg"
                    variant="outline"
                    className="border-slate-700 text-white hover:bg-slate-900 px-8 h-14 text-lg"
                  >
                    Sign In
                  </Button>
                </Link>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="bg-slate-950 text-white py-16 border-t border-slate-900">
        <div className="container mx-auto px-6">
          <div className="max-w-6xl mx-auto">
            <div className="grid md:grid-cols-4 gap-12 mb-12">
              <div className="col-span-2">
                <h3 className="text-2xl font-bold mb-4">PartsIQ</h3>
                <p className="text-slate-400 mb-6 max-w-md">
                  AI-powered industrial parts procurement platform. Reduce sourcing time and keep your operations running smoothly.
                </p>
                <Link href="/login">
                  <Button variant="outline" className="border-slate-700 text-white hover:bg-slate-900">
                    Sign In
                  </Button>
                </Link>
              </div>

              <div>
                <h4 className="font-semibold mb-4">Platform</h4>
                <ul className="space-y-3 text-slate-400">
                  <li><Link href="/features" className="hover:text-white transition-colors">Features</Link></li>
                  <li><Link href="/pricing" className="hover:text-white transition-colors">Pricing</Link></li>
                  <li><Link href="/security" className="hover:text-white transition-colors">Security</Link></li>
                </ul>
              </div>

              <div>
                <h4 className="font-semibold mb-4">Company</h4>
                <ul className="space-y-3 text-slate-400">
                  <li><Link href="/about" className="hover:text-white transition-colors">About</Link></li>
                  <li><Link href="/contact" className="hover:text-white transition-colors">Contact</Link></li>
                  <li><Link href="/support" className="hover:text-white transition-colors">Support</Link></li>
                </ul>
              </div>
            </div>

            <div className="border-t border-slate-900 pt-8">
              <p className="text-slate-500 text-sm text-center">
                © 2026 PartsIQ. All rights reserved.
              </p>
            </div>
          </div>
        </div>
      </footer>
    </div>
  )
}
