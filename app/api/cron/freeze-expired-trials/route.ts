import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { cronLogger } from '@/lib/logger';
import { verifyCronAuth } from '@/lib/api-utils';
import { deleteTenantIndex } from '@/lib/services/pinecone/index-provisioner';
import { deleteS3ByPrefix } from '@/lib/services/storage/s3-client';
import { deleteNeo4jByOrg } from '@/lib/services/search/neo4j-client';
import { createAuditLog } from '@/lib/audit-log';
import { sendEmail, getTrialDataDeletedEmailHtml } from '@/lib/email/resend';

/**
 * Cron Job: Freeze Expired Trials
 *
 * Three days after a trial ends without conversion, wipe ingestion data
 * (Pinecone index, Part rows, IngestionJob/Outbox rows, S3 chunk blobs)
 * and flip the org to `EXPIRED`. Preserves contact data (Users, emails,
 * business records) so win-back campaigns stay deliverable.
 *
 * Neo4j cleanup is now safe thanks to the hub-node isolation refactor — every
 * data node is attached to an `(:Organization {id})` hub via `[:OWNS]`, so
 * `deleteNeo4jByOrg` can detach-delete the tenant's entire subgraph without
 * touching other tenants. See lib/services/search/neo4j-client.ts.
 *
 * Idempotent via `dataFrozenAt IS NULL` guard — re-running is a no-op for
 * already-frozen orgs.
 *
 * Schedule: daily at 03:00 UTC (registered in vercel.json).
 *
 * Grace period: 3 days by default, overridable via TRIAL_FREEZE_GRACE_DAYS.
 */

const DEFAULT_GRACE_DAYS = 3;

function graceDays(): number {
  const override = process.env.TRIAL_FREEZE_GRACE_DAYS;
  if (override) {
    const n = parseInt(override, 10);
    if (Number.isFinite(n) && n >= 0) return n;
  }
  return DEFAULT_GRACE_DAYS;
}

export async function GET(req: NextRequest) {
  if (!verifyCronAuth(req.headers.get('authorization'))) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const grace = graceDays();
  const cutoff = new Date(Date.now() - grace * 86_400_000);

  cronLogger.info({ cutoff: cutoff.toISOString(), graceDays: grace }, 'Freeze-expired-trials cron starting');

  // Candidates: still on TRIAL in the DB, trialEndsAt past the grace window,
  // and haven't been frozen yet. Status stays TRIAL until we finish the wipe
  // so an in-progress crash doesn't leave a half-frozen org with status=EXPIRED
  // but data still present (the next cron run retries the wipe).
  const candidates = await prisma.organization.findMany({
    where: {
      subscriptionStatus: 'TRIAL',
      trialEndsAt: { not: null, lt: cutoff },
      dataFrozenAt: null,
    },
    select: {
      id: true,
      slug: true,
      name: true,
      trialEndsAt: true,
      // Used to send the post-wipe notification email.
      users: {
        where: { role: 'ADMIN', isActive: true },
        select: { name: true, email: true },
        take: 1,
      },
    },
    take: 100, // chunk-process; next run picks up the next batch
  });

  const results = {
    checked: candidates.length,
    frozen: 0,
    errors: [] as Array<{ orgId: string; step: string; message: string }>,
  };

  for (const org of candidates) {
    const stepErrors: Array<{ step: string; message: string }> = [];

    // 1. Pinecone — deleteTenantIndex is already 404-tolerant.
    try {
      await deleteTenantIndex(org.slug);
    } catch (err: any) {
      stepErrors.push({ step: 'pinecone', message: err?.message ?? String(err) });
    }

    // 2. Neo4j — detach-delete the tenant's entire subgraph. Safe because
    //    the hub-node isolation model guarantees owned nodes don't have
    //    edges into other tenants' subgraphs.
    let neo4jNodesDeleted = 0;
    try {
      const result = await deleteNeo4jByOrg(org.id);
      neo4jNodesDeleted = result.nodesDeleted;
    } catch (err: any) {
      stepErrors.push({ step: 'neo4j', message: err?.message ?? String(err) });
    }

    // 3. S3 — wipe everything under `{orgId}/ingestion/`. Covers both the
    //    original uploaded file and the prepare worker's chunk blobs
    //    (written at `{originalKey}.chunks/batch-NNNN.json.gz`, which also
    //    live under the `{orgId}/ingestion/` prefix).
    let s3ObjectsDeleted = 0;
    try {
      s3ObjectsDeleted = await deleteS3ByPrefix(`${org.id}/ingestion/`);
    } catch (err: any) {
      stepErrors.push({ step: 's3', message: err?.message ?? String(err) });
    }

    // 4. Postgres — delete ingestion-related rows only. Parts table holds
    //    the catalog entries that were indexed into Pinecone; without the
    //    index they're useless. Explicitly PRESERVED: User, Vehicle,
    //    Supplier, QuoteRequest, Order, AdminEmail, InboundMessage,
    //    UserEmailIntegration, Organization itself, billingEmail.
    try {
      await prisma.$transaction([
        prisma.ingestionOutbox.deleteMany({
          where: { job: { organizationId: org.id } },
        }),
        prisma.ingestionJob.deleteMany({ where: { organizationId: org.id } }),
        prisma.part.deleteMany({ where: { organizationId: org.id } }),
      ]);
    } catch (err: any) {
      stepErrors.push({ step: 'postgres', message: err?.message ?? String(err) });
    }

    // 5. Mark the freeze. Clearing pineconeHost lets provisionIndexForOrg
    //    re-create a fresh index on re-subscribe (it's idempotent and skips
    //    when pineconeHost is already set).
    try {
      await prisma.organization.update({
        where: { id: org.id },
        data: {
          pineconeHost: null,
          subscriptionStatus: 'EXPIRED',
          dataFrozenAt: new Date(),
        },
      });

      await createAuditLog({
        organizationId: org.id,
        eventType: 'TRIAL_DATA_FROZEN',
        description: `Trial data frozen for ${org.name} (${org.slug}) — trial ended ${org.trialEndsAt?.toISOString()} + ${grace}d grace`,
        metadata: {
          trialEndsAt: org.trialEndsAt?.toISOString(),
          graceDays: grace,
          s3ObjectsDeleted,
          neo4jNodesDeleted,
          stepErrors,
        },
      });

      results.frozen += 1;
      cronLogger.info(
        {
          orgId: org.id,
          slug: org.slug,
          s3ObjectsDeleted,
          neo4jNodesDeleted,
          stepErrors: stepErrors.length,
        },
        'Org frozen',
      );

      // Send post-wipe win-back email. Non-blocking: email failure is
      // recorded but doesn't roll back the freeze (the freeze is the
      // important thing; we can always re-email).
      const admin = org.users[0];
      if (admin?.email) {
        try {
          await sendEmail({
            to: admin.email,
            subject: `We've cleared your trial parts data — ${org.name}`,
            html: getTrialDataDeletedEmailHtml(admin.name || 'there', org.name),
          });
        } catch (emailErr: any) {
          cronLogger.error(
            { orgId: org.id, error: emailErr?.message ?? String(emailErr) },
            'Post-freeze email failed',
          );
        }
      }
    } catch (err: any) {
      // If the status-flip itself failed, record but don't abort the batch —
      // the next run will pick this org up again (dataFrozenAt still null).
      stepErrors.push({ step: 'statusUpdate', message: err?.message ?? String(err) });
    }

    for (const e of stepErrors) {
      results.errors.push({ orgId: org.id, ...e });
      cronLogger.error({ orgId: org.id, ...e }, 'Freeze step failed');
    }
  }

  cronLogger.info(results, 'Freeze-expired-trials cron complete');
  return NextResponse.json({ success: true, ...results });
}
