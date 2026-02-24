export interface BlogPostMeta {
  title: string
  description: string
  date: string
  author: string
  slug: string
  keywords: string[]
  category: string
  image?: string
  imageAlt?: string
  readTime?: string
  draft?: boolean
}
