import type { Metadata } from "next"
import Link from "next/link"
import { ArrowRight, Calendar, Clock, Tag } from "lucide-react"
import { getAllPosts } from "@/lib/blog/utils"
import { BreadcrumbJsonLd } from "@/components/seo/breadcrumb-jsonld"
import { PublicFooter } from "@/components/layout/public-footer"

export const metadata: Metadata = {
  title: "Blog - Parts Procurement & Equipment Management Insights",
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
  const posts = getAllPosts()

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

        {/* Posts Grid */}
        <section className="py-24 bg-white dark:bg-slate-950">
          <div className="container mx-auto px-6">
            <div className="max-w-6xl mx-auto">
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
