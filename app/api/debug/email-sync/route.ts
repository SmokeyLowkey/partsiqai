import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { getEmailClientForUser } from '@/lib/services/email/email-client-factory';
import { EmailParser } from '@/lib/services/email/email-parser';
import { quoteExtractionQueue } from '@/lib/queue/queues';

/**
 * DEBUG ENDPOINT - Manually test email sync
 * GET /api/debug/email-sync - Fetch recent emails and show what would be processed
 * GET /api/debug/email-sync?reset=true - Reset sync state and fetch all emails
 * POST /api/debug/email-sync - Actually process the emails
 */
export async function GET(req: NextRequest) {
  try {
    if (process.env.NODE_ENV === 'production') {
      return NextResponse.json({ error: 'Not found' }, { status: 404 });
    }

    const session = await getServerSession();
    if (!session?.user?.organizationId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    if (session.user.role !== 'MASTER_ADMIN') {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const organizationId = session.user.organizationId;
    const url = new URL(req.url);
    const resetSync = url.searchParams.get('reset') === 'true';

    // Get email client using current user's credentials (supports Gmail and Microsoft)
    let emailClient;
    try {
      emailClient = await getEmailClientForUser(session.user.id);
    } catch (error: any) {
      return NextResponse.json({
        error: error.message || 'Email not configured',
      }, { status: 400 });
    }

    // Get sync state
    let syncState = await prisma.emailSyncState.findUnique({
      where: { organizationId },
    });

    // If reset requested, clear sync state
    if (resetSync && syncState) {
      await prisma.emailSyncState.delete({
        where: { organizationId },
      });
      syncState = null;
      console.log('Sync state reset');
    }

    // Fetch recent emails (don't filter by lastEmailId for debugging)
    const emails = await emailClient.fetchNewEmails();
    const emailParser = new EmailParser();

    // Get all email threads for this org to show matching
    const existingThreads = await prisma.emailThread.findMany({
      where: { organizationId },
      select: {
        id: true,
        externalThreadId: true,
        subject: true,
        status: true,
        supplierId: true,
      },
    });

    // Process emails to show what would happen
    const emailDetails = await Promise.all(emails.map(async (email) => {
      const headers = emailParser.parseHeaders(email.headers);
      const { text, html } = emailParser.extractBody(email.parts);
      const fromEmail = emailParser.extractEmailAddress(headers.from);

      // Check if there's a matching thread
      const matchingThread = existingThreads.find(
        t => t.externalThreadId === email.threadId
      );

      // Check if there's a supplier match
      const supplier = await prisma.supplier.findFirst({
        where: {
          organizationId,
          OR: [
            { email: fromEmail },
            {
              auxiliaryEmails: {
                some: { email: fromEmail },
              },
            },
          ],
        },
        select: { id: true, name: true, email: true },
      });

      return {
        gmailMessageId: email.id,
        gmailThreadId: email.threadId,
        from: fromEmail,
        subject: headers.subject,
        date: new Date(parseInt(email.date)).toISOString(),
        bodyPreview: (text || html.replace(/<[^>]*>/g, '')).substring(0, 200),
        attachmentCount: email.attachments.length,
        matchingThread: matchingThread ? {
          id: matchingThread.id,
          externalThreadId: matchingThread.externalThreadId,
          subject: matchingThread.subject,
          status: matchingThread.status,
        } : null,
        matchingSupplier: supplier,
        wouldBeProcessed: !!matchingThread || !!supplier,
      };
    }));

    // Also get existing messages to show full picture
    const existingMessages = await prisma.emailMessage.findMany({
      where: {
        thread: { organizationId },
      },
      select: {
        id: true,
        threadId: true,
        direction: true,
        from: true,
        subject: true,
        externalMessageId: true,
        receivedAt: true,
        sentAt: true,
      },
      orderBy: { createdAt: 'desc' },
      take: 20,
    });

    return NextResponse.json({
      syncState: syncState ? {
        lastEmailId: syncState.lastEmailId,
        lastSyncAt: syncState.lastSyncAt,
        syncStatus: syncState.syncStatus,
        errorCount: syncState.errorCount,
      } : null,
      existingThreads: existingThreads.map(t => ({
        id: t.id,
        externalThreadId: t.externalThreadId,
        subject: t.subject,
        status: t.status,
      })),
      existingMessages: existingMessages.map(m => ({
        id: m.id,
        threadId: m.threadId,
        direction: m.direction,
        from: m.from,
        subject: m.subject,
        externalMessageId: m.externalMessageId,
        date: m.receivedAt || m.sentAt,
      })),
      recentEmails: emailDetails,
      summary: {
        totalEmails: emails.length,
        withMatchingThread: emailDetails.filter(e => e.matchingThread).length,
        withMatchingSupplier: emailDetails.filter(e => e.matchingSupplier).length,
        wouldProcess: emailDetails.filter(e => e.wouldBeProcessed).length,
      },
      tips: {
        resetSync: 'Add ?reset=true to clear sync state and see all recent emails',
        processEmails: 'Use POST to actually process and save emails',
      },
    });
  } catch (error: any) {
    console.error('Debug email sync error:', error);
    return NextResponse.json({
      error: 'Debug failed',
    }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    if (process.env.NODE_ENV === 'production') {
      return NextResponse.json({ error: 'Not found' }, { status: 404 });
    }

    const session = await getServerSession();
    if (!session?.user?.organizationId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    if (session.user.role !== 'MASTER_ADMIN') {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const organizationId = session.user.organizationId;
    const url = new URL(req.url);
    const ignoreSyncState = url.searchParams.get('ignoreSync') === 'true';

    // Get email client using current user's credentials (supports Gmail and Microsoft)
    const emailClient = await getEmailClientForUser(session.user.id);
    const emailParser = new EmailParser();

    // Get sync state
    const syncState = await prisma.emailSyncState.findUnique({
      where: { organizationId },
    });

    // Fetch emails - optionally ignore sync state
    const emails = await emailClient.fetchNewEmails(
      ignoreSyncState ? undefined : (syncState?.lastEmailId || undefined)
    );

    console.log(`Fetched ${emails.length} emails (ignoreSyncState: ${ignoreSyncState})`);

    // Get system user
    const systemUser = await prisma.user.findFirst({
      where: {
        organizationId,
        role: { in: ['MASTER_ADMIN', 'ADMIN'] },
      },
      select: { id: true },
    });

    if (!systemUser) {
      return NextResponse.json({ error: 'No admin user found' }, { status: 400 });
    }

    const results: any[] = [];

    for (const email of emails) {
      const headers = emailParser.parseHeaders(email.headers);
      const { text, html } = emailParser.extractBody(email.parts);
      const fromEmail = emailParser.extractEmailAddress(headers.from);
      const body = text || html.replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim();

      // Find matching thread
      let thread = await prisma.emailThread.findFirst({
        where: {
          organizationId,
          externalThreadId: email.threadId,
        },
      });

      // Find supplier
      const supplier = await prisma.supplier.findFirst({
        where: {
          organizationId,
          OR: [
            { email: fromEmail },
            { auxiliaryEmails: { some: { email: fromEmail } } },
          ],
        },
      });

      let action = 'skipped';
      let messageCreated = false;

      let emailMessageId: string | null = null;
      let quoteExtractionQueued = false;

      if (thread) {
        // Add message to existing thread
        const existingMessage = await prisma.emailMessage.findFirst({
          where: {
            threadId: thread.id,
            externalMessageId: email.id,
          },
        });

        if (!existingMessage) {
          const newMessage = await prisma.emailMessage.create({
            data: {
              threadId: thread.id,
              direction: 'INBOUND',
              from: fromEmail,
              to: '',
              subject: headers.subject,
              body,
              bodyHtml: html || `<p>${text}</p>`,
              externalMessageId: email.id,
              receivedAt: new Date(parseInt(email.date)),
              inReplyTo: headers.inReplyTo || null,
            },
          });
          emailMessageId = newMessage.id;

          // Update thread status
          await prisma.emailThread.update({
            where: { id: thread.id },
            data: { status: 'RESPONSE_RECEIVED' },
          });

          // Update QuoteRequestEmailThread if exists
          await prisma.quoteRequestEmailThread.updateMany({
            where: { emailThreadId: thread.id },
            data: {
              status: 'RESPONDED',
              responseDate: new Date(),
            },
          });

          action = 'added_to_existing_thread';
          messageCreated = true;

          // Queue quote extraction if there are attachments
          if (email.attachments.length > 0) {
            await (quoteExtractionQueue as any).add('extract-quote', {
              organizationId,
              emailThreadId: thread.id,
              emailMessageId: newMessage.id,
              emailData: {
                id: email.id,
                threadId: email.threadId,
                subject: headers.subject,
                body,
                from: fromEmail,
                date: email.date,
              },
              attachments: email.attachments.map((att) => ({
                id: `${email.id}-${att.attachmentId}`,
                filename: att.filename,
                contentType: att.mimeType,
                size: att.size,
                gmailAttachmentId: att.attachmentId,
              })),
            });
            quoteExtractionQueued = true;
          }
        } else {
          action = 'message_already_exists';
          emailMessageId = existingMessage.id;
        }
      } else if (supplier) {
        // Create new thread for supplier email
        thread = await prisma.emailThread.create({
          data: {
            organizationId,
            externalThreadId: email.threadId,
            subject: headers.subject,
            supplierId: supplier.id,
            status: 'RESPONSE_RECEIVED',
            createdById: systemUser.id,
          },
        });

        const newMessage = await prisma.emailMessage.create({
          data: {
            threadId: thread.id,
            direction: 'INBOUND',
            from: fromEmail,
            to: '',
            subject: headers.subject,
            body,
            bodyHtml: html || `<p>${text}</p>`,
            externalMessageId: email.id,
            receivedAt: new Date(parseInt(email.date)),
          },
        });
        emailMessageId = newMessage.id;

        action = 'created_new_thread';
        messageCreated = true;

        // Queue quote extraction if there are attachments
        if (email.attachments.length > 0) {
          await (quoteExtractionQueue as any).add('extract-quote', {
            organizationId,
            emailThreadId: thread.id,
            emailMessageId: newMessage.id,
            emailData: {
              id: email.id,
              threadId: email.threadId,
              subject: headers.subject,
              body,
              from: fromEmail,
              date: email.date,
            },
            attachments: email.attachments.map((att) => ({
              id: `${email.id}-${att.attachmentId}`,
              filename: att.filename,
              contentType: att.mimeType,
              size: att.size,
              gmailAttachmentId: att.attachmentId,
            })),
          });
          quoteExtractionQueued = true;
        }
      }

      results.push({
        gmailMessageId: email.id,
        gmailThreadId: email.threadId,
        from: fromEmail,
        subject: headers.subject,
        action,
        messageCreated,
        threadId: thread?.id,
        emailMessageId,
        supplierId: supplier?.id,
        attachmentCount: email.attachments.length,
        quoteExtractionQueued,
      });
    }

    // Update sync state
    if (emails.length > 0) {
      await prisma.emailSyncState.upsert({
        where: { organizationId },
        update: {
          lastEmailId: emails[0].id,
          lastSyncAt: new Date(),
          syncStatus: 'ACTIVE',
        },
        create: {
          organizationId,
          lastEmailId: emails[0].id,
          lastSyncAt: new Date(),
          syncStatus: 'ACTIVE',
        },
      });
    }

    return NextResponse.json({
      success: true,
      emailsProcessed: emails.length,
      ignoredSyncState: ignoreSyncState,
      results,
      tips: {
        ignoreSync: 'Add ?ignoreSync=true to process all recent emails regardless of sync state',
      },
    });
  } catch (error: any) {
    console.error('Debug email sync error:', error);
    return NextResponse.json({
      error: 'Sync failed',
    }, { status: 500 });
  }
}
