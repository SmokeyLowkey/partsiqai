import type { Metadata } from "next"
import Link from "next/link"
import { ArrowRight, Calendar, Clock, Tag, BookOpen, Star } from "lucide-react"
import { getAllPosts, getPostBySlug } from "@/lib/blog/utils"
import { BreadcrumbJsonLd } from "@/components/seo/breadcrumb-jsonld"
import { PublicFooter } from "@/components/layout/public-footer"

// The pillar post that anchors our parts-inventory content cluster. Featured
// prominently at the top of the blog index to surface topical authority and
// consolidate internal linking into it.
const PILLAR_SLUG = "parts-inventory-management-complete-guide"

export const metadata: Metadata = {
  title: "Parts Procurement & Inventory Blog",
  description:
    "Expert insights on parts inventory tracking, heavy equipment fleet management, parts procurement optimization, and industrial parts sourcing best practices.",
  keywords: [
    "parts inventory tracking",
    "heavy equipment fleet management",
    "parts procurement",
    "industrial parts sourcing",
  ],
  alternates: {
    canonical: "/blog",
  },
  openGraph: {
    title: "PartsIQ Blog - Parts Procurement Insights",
    description:
      "Expert insights on parts inventory, equipment management, and industrial procurement.",
    url: "/blog",
  },
}

export default function BlogPage() {
  const allPosts = getAllPosts()
  const pillar = getPostBySlug(PILLAR_SLUG)
  // Remove the pillar from the grid — it's featured separately above.
  const posts = allPosts.filter((p) => p.slug !== PILLAR_SLUG)

  return (
    <>
      <BreadcrumbJsonLd items={[{ name: "Home", url: "/" }, { name: "Blog", url: "/blog" }]} />
      <div className="min-h-screen bg-white dark:bg-slate-950">
        {/* Hero */}
        <section className="relative bg-slate-950 text-white py-24">
          <div className="absolute inset-0 bg-[linear-gradient(rgba(148,163,184,0.05)_1px,transparent_1px),linear-gradient(90deg,rgba(148,163,184,0.05)_1px,transparent_1px)] bg-[size:64px_64px]"></div>
          <div className="relative container mx-auto px-6">
            <div className="max-w-4xl mx-auto text-center">
              <h1 className="text-5xl md:text-6xl font-bold mb-6 tracking-tight">
                Parts Procurement Insights
              </h1>
              <p className="text-xl text-slate-400">
                Best practices for parts inventory tracking, equipment management, and industrial procurement optimization
              </p>
            </div>
          </div>
        </section>

        {/* Featured pillar post — appears above the post grid to anchor the content cluster */}
        {pillar && (
          <section className="py-16 bg-gradient-to-br from-emerald-50 via-white to-emerald-50/40 dark:from-emerald-950/30 dark:via-slate-950 dark:to-emerald-950/20 border-b border-slate-200 dark:border-slate-800">
            <div className="container mx-auto px-6">
              <div className="max-w-5xl mx-auto">
                <div className="inline-flex items-center gap-2 rounded-full bg-emerald-600 text-white text-xs font-semibold px-3 py-1 mb-4 uppercase tracking-wider">
                  <Star className="h-3.5 w-3.5 fill-white" />
                  Start here — Featured guide
                </div>
                <Link
                  href={`/blog/${pillar.meta.slug}`}
                  className="group block rounded-2xl border border-emerald-200 dark:border-emerald-800/60 bg-white dark:bg-slate-900 p-8 md:p-10 hover:border-emerald-400 hover:shadow-lg transition-all"
                >
                  <div className="flex items-start gap-4 mb-4">
                    <div className="shrink-0 rounded-xl bg-emerald-100 dark:bg-emerald-900/50 p-3 text-emerald-700 dark:text-emerald-400">
                      <BookOpen className="h-6 w-6" />
                    </div>
                    <div className="flex-1">
                      <div className="flex items-center gap-3 mb-2">
                        <span className="px-2.5 py-0.5 bg-emerald-50 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-400 text-xs font-medium rounded-full border border-emerald-200 dark:border-emerald-800">
                          {pillar.meta.category}
                        </span>
                        {pillar.meta.readTime && (
                          <span className="flex items-center gap-1 text-xs text-slate-500 dark:text-slate-400">
                            <Clock className="h-3 w-3" />
                            {pillar.meta.readTime}
                          </span>
                        )}
                      </div>
                      <h2 className="text-2xl md:text-3xl font-bold text-slate-950 dark:text-white mb-3 group-hover:text-emerald-700 dark:group-hover:text-emerald-400 transition-colors tracking-tight">
                        {pillar.meta.title}
                      </h2>
                      <p className="text-slate-600 dark:text-slate-300 leading-relaxed md:text-lg">
                        {pillar.meta.description}
                      </p>
                    </div>
                  </div>
                  <span className="inline-flex items-center gap-1.5 text-sm font-semibold text-emerald-600 dark:text-emerald-400 group-hover:gap-2.5 transition-all">
                    Read the complete guide
                    <ArrowRight className="h-4 w-4" />
                  </span>
                </Link>
              </div>
            </div>
          </section>
        )}

        {/* Posts Grid */}
        <section className="py-24 bg-white dark:bg-slate-950">
          <div className="container mx-auto px-6">
            <div className="max-w-6xl mx-auto">
              {pillar && (
                <h2 className="text-2xl md:text-3xl font-bold text-slate-950 dark:text-white mb-10 tracking-tight">
                  All articles
                </h2>
              )}
              {posts.length === 0 ? (
                <div className="text-center py-16">
                  <p className="text-slate-500 dark:text-slate-400 text-lg">Blog posts coming soon.</p>
                </div>
              ) : (
                <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-8">
                  {posts.map((post) => (
                    <Link
                      key={post.slug}
                      href={`/blog/${post.slug}`}
                      className="group border border-slate-200 dark:border-slate-800 rounded-lg overflow-hidden hover:shadow-lg dark:hover:shadow-slate-900/50 transition-shadow bg-white dark:bg-slate-900"
                    >
                      <div className="p-6">
                        <div className="flex items-center gap-3 mb-4">
                          <span className="px-2.5 py-1 bg-emerald-50 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-400 text-xs font-medium rounded-full border border-emerald-200 dark:border-emerald-800">
                            {post.category}
                          </span>
                          {post.readTime && (
                            <span className="flex items-center gap-1 text-xs text-slate-500 dark:text-slate-400">
                              <Clock className="h-3 w-3" />
                              {post.readTime}
                            </span>
                          )}
                        </div>
                        <h2 className="text-xl font-bold text-slate-950 dark:text-white mb-3 group-hover:text-emerald-700 dark:group-hover:text-emerald-400 transition-colors">
                          {post.title}
                        </h2>
                        <p className="text-slate-600 dark:text-slate-300 text-sm mb-4 leading-relaxed">
                          {post.description}
                        </p>
                        <div className="flex items-center justify-between">
                          <span className="flex items-center gap-1.5 text-xs text-slate-500 dark:text-slate-400">
                            <Calendar className="h-3 w-3" />
                            {new Date(post.date).toLocaleDateString("en-US", {
                              year: "numeric",
                              month: "long",
                              day: "numeric",
                            })}
                          </span>
                          <span className="flex items-center gap-1 text-sm font-medium text-emerald-600 dark:text-emerald-400 group-hover:gap-2 transition-all">
                            Read
                            <ArrowRight className="h-4 w-4" />
                          </span>
                        </div>
                      </div>
                    </Link>
                  ))}
                </div>
              )}
            </div>
          </div>
        </section>
      </div>
      <PublicFooter />
    </>
  )
}
