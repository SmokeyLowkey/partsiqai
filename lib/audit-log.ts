import prisma from "@/lib/prisma"
import { SecurityEventType } from "@prisma/client"

interface AuditLogParams {
  organizationId: string
  eventType: SecurityEventType
  userId?: string
  ipAddress?: string
  userAgent?: string
  description: string
  metadata?: Record<string, any>
}

export async function createAuditLog(params: AuditLogParams) {
  try {
    await prisma.securityAuditLog.create({
      data: {
        organizationId: params.organizationId,
        eventType: params.eventType,
        userId: params.userId,
        ipAddress: params.ipAddress,
        userAgent: params.userAgent,
        description: params.description,
        metadata: params.metadata || {},
      }
    })
  } catch (error) {
    console.error("Failed to create audit log:", error)
    // Don't throw - logging failures shouldn't break auth flow
  }
}
