import type { MetadataRoute } from "next"

export default function robots(): MetadataRoute.Robots {
  const baseUrl = process.env.NEXT_PUBLIC_APP_URL || "https://partsiqai.com"

  return {
    rules: [
      {
        userAgent: "*",
        allow: "/",
        disallow: [
          "/admin/",
          "/customer/",
          "/api/",
          "/login",
          "/signup",
          "/onboarding/",
          "/change-password",
          "/forgot-password",
          "/reset-password",
          "/verify-email",
          "/invite/",
          "/subscription-required",
        ],
      },
    ],
    sitemap: `${baseUrl}/sitemap.xml`,
  }
}
