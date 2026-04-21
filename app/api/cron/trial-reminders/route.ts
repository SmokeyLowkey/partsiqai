import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { cronLogger } from '@/lib/logger';
import {
  sendEmail,
  getTrialCheckInEmailHtml,
  getTrialEndingSoonEmailHtml,
  getTrialLastDayEmailHtml,
  getTrialExpiredEmailHtml,
} from '@/lib/email/resend';
import { verifyCronAuth } from '@/lib/api-utils';

/**
 * Cron Job: Trial Reminder Emails
 *
 * Sends automated emails to trial organizations at key milestones:
 * - Day 7 (7 days left): Mid-trial check-in
 * - Day 12 (2 days left): Urgency reminder
 * - Day 13 (1 day left): Last day warning
 * - Day 15 (1 day after expiry): Win-back email
 *
 * Schedule: Daily at 10 AM UTC
 *
 * Setup with Vercel Cron:
 * {
 *   "crons": [{
 *     "path": "/api/cron/trial-reminders",
 *     "schedule": "0 10 * * *"
 *   }]
 * }
 */

interface ReminderConfig {
  daysSinceStart: number;
  tag: string;
  subject: string;
  getHtml: (name: string, company: string, daysLeft: number) => string;
}

const REMINDER_SCHEDULE: ReminderConfig[] = [
  {
    daysSinceStart: 7,
    tag: 'TRIAL_DAY7',
    subject: "How's your PartsIQ setup going?",
    getHtml: (name, company, daysLeft) => getTrialCheckInEmailHtml(name, company, daysLeft),
  },
  {
    daysSinceStart: 12,
    tag: 'TRIAL_DAY12',
    subject: 'Your PartsIQ trial ends in 2 days',
    getHtml: (name, company, daysLeft) => getTrialEndingSoonEmailHtml(name, company, daysLeft),
  },
  {
    daysSinceStart: 13,
    tag: 'TRIAL_DAY13',
    subject: 'Last day of your PartsIQ trial',
    getHtml: (name, company) => getTrialLastDayEmailHtml(name, company),
  },
  {
    daysSinceStart: 15,
    tag: 'TRIAL_DAY15',
    subject: 'Your PartsIQ trial has expired — your data is safe',
    getHtml: (name, company) => getTrialExpiredEmailHtml(name, company),
  },
];

export async function GET(req: NextRequest) {
  try {
    // Verify cron secret for security (timing-safe)
    if (!verifyCronAuth(req.headers.get('authorization'))) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    cronLogger.info('Trial reminder check triggered');

    // Find all trial organizations with trialEndsAt set
    const trialOrgs = await prisma.organization.findMany({
      where: {
        subscriptionStatus: { in: ['TRIAL', 'CANCELLED'] },
        trialEndsAt: { not: null },
      },
      select: {
        id: true,
        name: true,
        trialEndsAt: true,
        subscriptionStatus: true,
        users: {
          where: { role: 'ADMIN', isActive: true },
          select: { name: true, email: true },
          take: 1,
        },
      },
    });

    let sent = 0;
    let skipped = 0;

    for (const org of trialOrgs) {
      if (!org.trialEndsAt || org.users.length === 0) continue;

      const trialStart = new Date(org.trialEndsAt.getTime() - 14 * 24 * 60 * 60 * 1000);
      const now = new Date();
      const daysSinceStart = Math.floor((now.getTime() - trialStart.getTime()) / (1000 * 60 * 60 * 24));
      const daysLeft = Math.ceil((org.trialEndsAt.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));

      for (const reminder of REMINDER_SCHEDULE) {
        if (daysSinceStart !== reminder.daysSinceStart) continue;

        // Check if already sent (idempotency)
        const alreadySent = await prisma.activityLog.findFirst({
          where: {
            organizationId: org.id,
            type: 'TRIAL_REMINDER',
            title: reminder.tag,
          },
        });

        if (alreadySent) {
          skipped++;
          continue;
        }

        const admin = org.users[0];
        const html = reminder.getHtml(admin.name || 'there', org.name, daysLeft);

        try {
          await sendEmail({
            to: admin.email,
            subject: reminder.subject,
            html,
            organizationId: org.id,
          });

          await prisma.activityLog.create({
            data: {
              organizationId: org.id,
              type: 'TRIAL_REMINDER',
              title: reminder.tag,
              description: `Sent ${reminder.tag} email to ${admin.email}`,
            },
          });

          sent++;
          cronLogger.info({ org: org.name, tag: reminder.tag }, 'Trial reminder sent');
        } catch (emailErr) {
          cronLogger.error({ org: org.name, tag: reminder.tag, error: emailErr }, 'Failed to send trial reminder');
        }
      }
    }

    cronLogger.info({ sent, skipped, totalOrgs: trialOrgs.length }, 'Trial reminder check complete');

    return NextResponse.json({
      success: true,
      sent,
      skipped,
      totalTrialOrgs: trialOrgs.length,
    });
  } catch (error) {
    cronLogger.error({ error }, 'Trial reminder cron failed');
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
