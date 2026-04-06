import type React from "react"
import type { Metadata } from "next"
import { Inter } from "next/font/google"
import "./globals.css"
import { ThemeProvider } from "@/components/theme-provider"
import { SessionProvider } from "next-auth/react"
import { PostHogProvider } from "@/components/posthog-provider"
import { Toaster } from "@/components/ui/toaster"
import { JsonLd } from "@/components/seo/json-ld"

const inter = Inter({ subsets: ["latin"] })

const baseUrl = process.env.NEXT_PUBLIC_APP_URL || "https://partsiqai.com"

export const metadata: Metadata = {
  metadataBase: new URL(baseUrl),
  title: {
    default: "PartsIQ - AI-Powered Parts Inventory Management Software",
    template: "%s | PartsIQ",
  },
  description:
    "AI-powered parts ordering platform with voice agent automation, semantic parts search, supplier management, and heavy equipment parts catalog. Reduce sourcing time from hours to minutes.",
  keywords: [
    "parts inventory management software",
    "parts ordering system",
    "AI parts lookup",
    "supplier management software",
    "heavy equipment parts catalog",
    "parts catalog software",
    "industrial parts search engine",
    "parts inventory tracking",
    "digital parts catalog",
    "parts procurement software",
  ],
  authors: [{ name: "PartsIQ", url: baseUrl }],
  creator: "PartsIQ",
  publisher: "PartsIQ",
  robots: {
    index: true,
    follow: true,
    googleBot: {
      index: true,
      follow: true,
      "max-video-preview": -1,
      "max-image-preview": "large",
      "max-snippet": -1,
    },
  },
  openGraph: {
    type: "website",
    locale: "en_US",
    url: baseUrl,
    siteName: "PartsIQ",
    title: "PartsIQ - AI-Powered Parts Inventory Management Software",
    description:
      "AI voice agent calls your suppliers, gets quotes, and manages the entire parts procurement workflow. Reduce sourcing time from hours to minutes.",
    images: [
      {
        url: "/api/og",
        width: 1200,
        height: 630,
        alt: "PartsIQ - AI-Powered Parts Ordering Platform",
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: "PartsIQ - AI-Powered Parts Inventory Management Software",
    description:
      "AI voice agent calls your suppliers, gets quotes, and manages the entire parts procurement workflow.",
    images: ["/api/og"],
  },
  alternates: {
    canonical: baseUrl,
  },
  icons: {
    icon: "/icon.svg",
    apple: "/apple-icon.png",
  },
}

const organizationJsonLd = {
  "@context": "https://schema.org",
  "@type": "Organization",
  name: "PartsIQ",
  url: baseUrl,
  logo: `${baseUrl}/icon.svg`,
  description:
    "AI-powered machinery parts ordering platform with voice agent automation and intelligent parts search.",
  contactPoint: [
    {
      "@type": "ContactPoint",
      email: "sales@partsiqai.com",
      contactType: "sales",
    },
    {
      "@type": "ContactPoint",
      email: "support@partsiqai.com",
      contactType: "customer support",
    },
  ],
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="en">
      <body className={inter.className}>
        <JsonLd data={organizationJsonLd} />
        <SessionProvider>
          <PostHogProvider>
            <ThemeProvider attribute="class" defaultTheme="system" enableSystem disableTransitionOnChange>
              {children}
              <Toaster />
            </ThemeProvider>
          </PostHogProvider>
        </SessionProvider>
      </body>
    </html>
  )
}
