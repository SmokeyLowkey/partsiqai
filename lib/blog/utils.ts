import fs from "fs"
import path from "path"
import matter from "gray-matter"
import type { BlogPostMeta } from "./types"

const BLOG_DIR = path.join(process.cwd(), "content", "blog")

export function getAllPosts(): BlogPostMeta[] {
  if (!fs.existsSync(BLOG_DIR)) return []

  const files = fs.readdirSync(BLOG_DIR).filter((f) => f.endsWith(".mdx"))

  const posts = files
    .map((filename) => {
      const filePath = path.join(BLOG_DIR, filename)
      const fileContents = fs.readFileSync(filePath, "utf-8")
      const { data } = matter(fileContents)

      return {
        title: data.title || "",
        description: data.description || "",
        date: data.date || "",
        author: data.author || "PartsIQ Team",
        slug: data.slug || filename.replace(".mdx", ""),
        keywords: data.keywords || [],
        category: data.category || "",
        image: data.image,
        imageAlt: data.imageAlt,
        readTime: data.readTime,
        draft: data.draft || false,
      } satisfies BlogPostMeta
    })
    .filter((post) => !post.draft)
    .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())

  return posts
}

export function getPostBySlug(slug: string): { meta: BlogPostMeta; content: string } | null {
  if (!fs.existsSync(BLOG_DIR)) return null

  const filePath = path.join(BLOG_DIR, `${slug}.mdx`)
  if (!fs.existsSync(filePath)) return null

  const fileContents = fs.readFileSync(filePath, "utf-8")
  const { data, content } = matter(fileContents)

  return {
    meta: {
      title: data.title || "",
      description: data.description || "",
      date: data.date || "",
      author: data.author || "PartsIQ Team",
      slug: data.slug || slug,
      keywords: data.keywords || [],
      category: data.category || "",
      image: data.image,
      imageAlt: data.imageAlt,
      readTime: data.readTime,
      draft: data.draft || false,
    },
    content,
  }
}

export function getAllSlugs(): string[] {
  if (!fs.existsSync(BLOG_DIR)) return []

  return fs
    .readdirSync(BLOG_DIR)
    .filter((f) => f.endsWith(".mdx"))
    .map((f) => f.replace(".mdx", ""))
}
