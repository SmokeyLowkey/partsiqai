import { NextRequest } from "next/server"
import { handlers } from "@/lib/auth"
import { checkRateLimit, getClientIp, rateLimits } from "@/lib/rate-limit"

export const { GET } = handlers

export async function POST(req: NextRequest) {
  const ip = getClientIp(req)
  const rateCheck = checkRateLimit(`login:${ip}`, rateLimits.login)
  if (!rateCheck.success) return rateCheck.response

  return handlers.POST(req)
}
