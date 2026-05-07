/**
 * One Q/A pair on a blog post. Used both for the visible FAQ section that
 * MDX renders inline AND for the FAQPage JSON-LD that goes in the page head.
 * Per Google's policy, the answer text must match what's visible to users —
 * keep the frontmatter answer in sync with whatever the MDX renders.
 */
export interface BlogFaqEntry {
  question: string
  answer: string
}

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
  /** Optional. When present, blog page emits FAQPage JSON-LD. */
  faq?: BlogFaqEntry[]
}
