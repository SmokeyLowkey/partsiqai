import type { Metadata } from "next"
import Link from "next/link"
import { ArrowLeft, Calendar, Clock, Tag } from "lucide-react"
import { notFound } from "next/navigation"
import { MDXRemote } from "next-mdx-remote/rsc"
import { mdxComponents } from "@/components/blog/mdx-components"
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
      <div className="min-h-screen bg-white dark:bg-slate-950">
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
        <section className="py-16 bg-white dark:bg-slate-950">
          <div className="container mx-auto px-6">
            <article className="max-w-3xl mx-auto prose prose-slate prose-lg dark:prose-invert
              prose-headings:tracking-tight prose-headings:font-bold
              prose-h2:text-2xl prose-h2:mt-14 prose-h2:mb-4 prose-h2:pb-3 prose-h2:border-b prose-h2:border-slate-200 prose-h2:dark:border-slate-800
              prose-h3:text-xl prose-h3:mt-8 prose-h3:mb-3
              prose-p:leading-relaxed
              prose-a:text-emerald-600 dark:prose-a:text-emerald-400 prose-a:no-underline hover:prose-a:underline prose-a:font-medium
              prose-strong:text-slate-900 dark:prose-strong:text-white
              prose-blockquote:border-emerald-500 prose-blockquote:bg-slate-50 dark:prose-blockquote:bg-slate-800/50 prose-blockquote:rounded-r-lg prose-blockquote:py-1 prose-blockquote:px-6 prose-blockquote:not-italic
              prose-table:overflow-hidden prose-table:rounded-lg prose-table:border prose-table:border-slate-200 dark:prose-table:border-slate-700
              prose-thead:bg-slate-100 dark:prose-thead:bg-slate-800
              prose-th:py-3 prose-th:px-4 prose-th:text-left prose-th:font-semibold prose-th:text-sm
              prose-td:py-3 prose-td:px-4 prose-td:text-sm prose-td:border-t prose-td:border-slate-200 dark:prose-td:border-slate-700
              prose-li:marker:text-emerald-500
              prose-hr:border-slate-200 dark:prose-hr:border-slate-800 prose-hr:my-12
              prose-img:rounded-xl prose-img:shadow-lg">
              <MDXRemote source={post.content} components={mdxComponents} />
            </article>
          </div>
        </section>

        {/* Keywords Footer */}
        <section className="py-8 bg-slate-50 dark:bg-slate-900 border-t border-slate-200 dark:border-slate-800">
          <div className="container mx-auto px-6">
            <div className="max-w-3xl mx-auto flex flex-wrap items-center gap-2">
              <Tag className="h-4 w-4 text-slate-400" />
              {post.meta.keywords.map((keyword) => (
                <span
                  key={keyword}
                  className="px-2.5 py-1 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-xs text-slate-600 dark:text-slate-300 rounded-full"
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
