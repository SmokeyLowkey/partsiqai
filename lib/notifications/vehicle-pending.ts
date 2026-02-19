import { prisma } from '@/lib/prisma';
import { sendEmail, getBaseUrl } from '@/lib/email/resend';

interface NotifyVehiclePendingParams {
  vehicleId: string;
  vehicleName: string;
  createdByName: string;
  organizationId: string;
}

/**
 * Notify admin/manager users that a new vehicle needs search configuration.
 * Sends to all ADMIN, MASTER_ADMIN, and MANAGER users in the organization
 * who have email notifications enabled.
 * Wrapped in try/catch so failures never break the caller.
 */
export async function notifyVehiclePending(params: NotifyVehiclePendingParams): Promise<void> {
  const { vehicleId, vehicleName, createdByName, organizationId } = params;

  try {
    // Find all admins/managers in the organization with email notifications enabled
    const admins = await prisma.user.findMany({
      where: {
        organizationId,
        role: { in: ['ADMIN', 'MASTER_ADMIN', 'MANAGER'] },
        isActive: true,
        emailNotifications: true,
        email: { not: '' },
      },
      select: {
        id: true,
        name: true,
        email: true,
      },
    });

    if (admins.length === 0) return;

    // Create activity log entry
    await prisma.activityLog.create({
      data: {
        organizationId,
        type: 'VEHICLE_ADDED',
        title: `New vehicle added: ${vehicleName}`,
        description: `${createdByName} added a new vehicle that needs search configuration`,
        entityType: 'VEHICLE',
        entityId: vehicleId,
        metadata: {
          vehicleName,
          createdByName,
          searchConfigStatus: 'PENDING_ADMIN_REVIEW',
        },
      },
    });

    // Send email to each admin
    const pendingUrl = `${getBaseUrl()}/admin/vehicles/pending`;
    const subject = `New Vehicle Needs Configuration — ${vehicleName}`;

    for (const admin of admins) {
      if (!admin.email) continue;

      const html = getVehiclePendingEmailHtml({
        adminName: admin.name || 'Admin',
        vehicleName,
        createdByName,
        pendingUrl,
      });

      await sendEmail({ to: admin.email, subject, html });
    }
  } catch (error) {
    // Log but never throw — notifications must not break the caller
    console.error('[notifyVehiclePending] Failed to send notification:', error);
  }
}

function getVehiclePendingEmailHtml(params: {
  adminName: string;
  vehicleName: string;
  createdByName: string;
  pendingUrl: string;
}): string {
  const { adminName, vehicleName, createdByName, pendingUrl } = params;

  return `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>New Vehicle Needs Configuration - PartsIQ</title>
  <style>
    body {
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;
      line-height: 1.6;
      color: #334155;
      background-color: #f8fafc;
      margin: 0;
      padding: 0;
    }
    .container {
      max-width: 600px;
      margin: 40px auto;
      background: white;
      border-radius: 12px;
      overflow: hidden;
      box-shadow: 0 4px 6px rgba(0, 0, 0, 0.07);
    }
    .header {
      background: linear-gradient(135deg, #9333ea 0%, #06b6d4 100%);
      padding: 40px 30px;
      text-align: center;
    }
    .header h1 {
      color: white;
      margin: 0;
      font-size: 28px;
      font-weight: 700;
    }
    .content {
      padding: 40px 30px;
    }
    .content h2 {
      color: #1e293b;
      margin: 0 0 20px 0;
      font-size: 24px;
    }
    .content p {
      margin: 0 0 20px 0;
      color: #475569;
    }
    .button {
      display: inline-block;
      padding: 14px 32px;
      background: linear-gradient(135deg, #9333ea 0%, #06b6d4 100%);
      color: white !important;
      text-decoration: none;
      border-radius: 8px;
      font-weight: 600;
      margin: 20px 0;
      text-align: center;
    }
    .info-box {
      background: #f1f5f9;
      border-left: 4px solid #9333ea;
      padding: 16px 20px;
      margin: 20px 0;
      border-radius: 4px;
    }
    .info-box p {
      margin: 0;
      font-size: 14px;
    }
    .footer {
      background: #f8fafc;
      padding: 30px;
      text-align: center;
      border-top: 1px solid #e2e8f0;
    }
    .footer p {
      margin: 0 0 10px 0;
      font-size: 13px;
      color: #64748b;
    }
    .footer a {
      color: #9333ea;
      text-decoration: none;
    }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <h1>New Vehicle Needs Configuration</h1>
    </div>

    <div class="content">
      <h2>Hi ${adminName},</h2>

      <p><strong>${createdByName}</strong> has added a new vehicle: <strong>${vehicleName}</strong>.</p>

      <p>This vehicle needs its search mappings configured before it can be used for parts lookups. Please review and set up the Pinecone, Neo4j, and catalog mappings.</p>

      <div style="text-align: center;">
        <a href="${pendingUrl}" class="button">
          Review Pending Vehicles
        </a>
      </div>

      <div class="info-box">
        <p>You can manage your notification preferences in your account settings.</p>
      </div>
    </div>

    <div class="footer">
      <p>Need help? <a href="mailto:support@partsiq.com">Contact our support team</a></p>
      <p>&copy; ${new Date().getFullYear()} PartsIQ AI. All rights reserved.</p>
    </div>
  </div>
</body>
</html>
`;
}
