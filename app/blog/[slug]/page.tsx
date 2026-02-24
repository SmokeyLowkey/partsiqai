import type { Metadata } from "next"
import Link from "next/link"
import { ArrowLeft, Calendar, Clock, Tag } from "lucide-react"
import { notFound } from "next/navigation"
import { MDXRemote } from "next-mdx-remote/rsc"
import { getAllSlugs, getPostBySlug } from "@/lib/blog/utils"
import { JsonLd } from "@/components/seo/json-ld"
import { BreadcrumbJsonLd } from "@/components/seo/breadcrumb-jsonld"
import { PublicFooter } from "@/components/layout/public-footer"

interface Props {
  params: Promise<{ slug: string }>
}

export async function generateStaticParams() {
  return getAllSlugs().map((slug) => ({ slug }))
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params
  const post = getPostBySlug(slug)
  if (!post) return {}

  const baseUrl = process.env.NEXT_PUBLIC_APP_URL || "https://partsiqai.com"

  return {
    title: post.meta.title,
    description: post.meta.description,
    keywords: post.meta.keywords,
    alternates: { canonical: `/blog/${post.meta.slug}` },
    openGraph: {
      title: post.meta.title,
      description: post.meta.description,
      type: "article",
      publishedTime: post.meta.date,
      authors: [post.meta.author],
      url: `/blog/${post.meta.slug}`,
      images: post.meta.image ? [{ url: `${baseUrl}${post.meta.image}` }] : [],
    },
  }
}

export default async function BlogPostPage({ params }: Props) {
  const { slug } = await params
  const post = getPostBySlug(slug)
  if (!post) notFound()

  const baseUrl = process.env.NEXT_PUBLIC_APP_URL || "https://partsiqai.com"

  const articleJsonLd = {
    "@context": "https://schema.org",
    "@type": "Article",
    headline: post.meta.title,
    description: post.meta.description,
    datePublished: post.meta.date,
    author: {
      "@type": "Organization",
      name: post.meta.author,
    },
    publisher: {
      "@type": "Organization",
      name: "PartsIQ",
      url: baseUrl,
    },
    mainEntityOfPage: `${baseUrl}/blog/${post.meta.slug}`,
    keywords: post.meta.keywords.join(", "),
  }

  return (
    <>
      <JsonLd data={articleJsonLd} />
      <BreadcrumbJsonLd
        items={[
          { name: "Home", url: "/" },
          { name: "Blog", url: "/blog" },
          { name: post.meta.title, url: `/blog/${post.meta.slug}` },
        ]}
      />
      <div className="min-h-screen bg-white">
        {/* Header */}
        <section className="relative bg-slate-950 text-white py-16">
          <div className="absolute inset-0 bg-[linear-gradient(rgba(148,163,184,0.05)_1px,transparent_1px),linear-gradient(90deg,rgba(148,163,184,0.05)_1px,transparent_1px)] bg-[size:64px_64px]"></div>
          <div className="relative container mx-auto px-6">
            <div className="max-w-3xl mx-auto">
              <Link
                href="/blog"
                className="inline-flex items-center gap-2 text-slate-400 hover:text-white transition-colors mb-8"
              >
                <ArrowLeft className="h-4 w-4" />
                Back to Blog
              </Link>

              <div className="flex items-center gap-3 mb-6">
                <span className="px-2.5 py-1 bg-emerald-900/50 text-emerald-400 text-xs font-medium rounded-full border border-emerald-700">
                  {post.meta.category}
                </span>
                {post.meta.readTime && (
                  <span className="flex items-center gap-1.5 text-xs text-slate-400">
                    <Clock className="h-3 w-3" />
                    {post.meta.readTime}
                  </span>
                )}
              </div>

              <h1 className="text-4xl md:text-5xl font-bold mb-6 tracking-tight leading-tight">
                {post.meta.title}
              </h1>

              <div className="flex items-center gap-4 text-sm text-slate-400">
                <span>{post.meta.author}</span>
                <span>&bull;</span>
                <span className="flex items-center gap-1.5">
                  <Calendar className="h-3.5 w-3.5" />
                  {new Date(post.meta.date).toLocaleDateString("en-US", {
                    year: "numeric",
                    month: "long",
                    day: "numeric",
                  })}
                </span>
              </div>
            </div>
          </div>
        </section>

        {/* Content */}
        <section className="py-16 bg-white">
          <div className="container mx-auto px-6">
            <article className="max-w-3xl mx-auto prose prose-slate prose-lg prose-headings:tracking-tight prose-a:text-emerald-600 prose-a:no-underline hover:prose-a:underline">
              <MDXRemote source={post.content} />
            </article>
          </div>
        </section>

        {/* Keywords Footer */}
        <section className="py-8 bg-slate-50 border-t border-slate-200">
          <div className="container mx-auto px-6">
            <div className="max-w-3xl mx-auto flex flex-wrap items-center gap-2">
              <Tag className="h-4 w-4 text-slate-400" />
              {post.meta.keywords.map((keyword) => (
                <span
                  key={keyword}
                  className="px-2.5 py-1 bg-white border border-slate-200 text-xs text-slate-600 rounded-full"
                >
                  {keyword}
                </span>
              ))}
            </div>
          </div>
        </section>
      </div>
      <PublicFooter />
    </>
  )
}
