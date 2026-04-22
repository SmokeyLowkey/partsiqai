import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { partsSearchQueue } from '@/lib/queue/queues';
import { PartsSearchJobSchema } from '@/lib/queue/types';
import { withHardening } from '@/lib/api/with-hardening';
import { canUseExpensiveFeatures } from '@/lib/subscription-limits';
import { z } from 'zod';

const SearchRequestSchema = z.object({
  query: z.string().min(1, 'Search query is required'),
  conversationId: z.string().optional(),
  vehicleContext: z
    .object({
      make: z.string(),
      model: z.string(),
      year: z.number(),
      vehicleId: z.string().optional(),
    })
    .optional(),
});

// Parts search enqueues a worker job that hits Pinecone + OpenRouter — rate-limit
// to prevent search-spam from burning external-API credits.
export const POST = withHardening(
  {
    rateLimit: { limit: 60, windowSeconds: 60, prefix: 'parts-search', keyBy: 'user' },
  },
  async (req: Request) => {
  try {
    const session = await getServerSession();

    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await req.json();

    // Validate request body
    const validationResult = SearchRequestSchema.safeParse(body);
    if (!validationResult.success) {
      return NextResponse.json(
        {
          error: 'Invalid request',
          details: validationResult.error.errors,
        },
        { status: 400 }
      );
    }

    const { query, conversationId, vehicleContext } = validationResult.data;

    // Block expired-trial orgs from burning Pinecone + OpenRouter. Applies
    // to both the grace window (data still present, user hasn't converted)
    // and post-wipe state (vector index already deleted, search would
    // return nothing anyway). 402 Payment Required lets the UI render a
    // "subscribe to search again" prompt.
    const org = await prisma.organization.findUnique({
      where: { id: session.user.organizationId },
      select: { subscriptionStatus: true, trialEndsAt: true },
    });
    if (org && !canUseExpensiveFeatures(org.subscriptionStatus, org.trialEndsAt)) {
      return NextResponse.json(
        {
          error: 'Subscription required',
          message: 'Your trial has ended. Subscribe to search parts again.',
        },
        { status: 402 },
      );
    }

    // Create job data
    const jobData = {
      organizationId: session.user.organizationId,
      conversationId: conversationId || `temp-${Date.now()}`,
      query,
      vehicleContext,
    };

    // Validate job data with Zod schema
    const jobValidation = PartsSearchJobSchema.safeParse(jobData);
    if (!jobValidation.success) {
      return NextResponse.json(
        {
          error: 'Invalid job data',
          details: jobValidation.error.errors,
        },
        { status: 400 }
      );
    }

    // Enqueue search job
    const job = await (partsSearchQueue as any).add('search', jobValidation.data, {
      jobId: `search-${session.user.organizationId}-${Date.now()}`,
      removeOnComplete: {
        age: 3600, // Keep for 1 hour
        count: 100,
      },
      removeOnFail: {
        age: 86400, // Keep failed jobs for 24 hours
        count: 500,
      },
    });

    // Store job reference in database
    await prisma.jobQueue.create({
      data: {
        jobId: job.id!,
        queueName: 'parts-search',
        jobType: 'search',
        status: 'PENDING',
        organizationId: session.user.organizationId,
        userId: session.user.id,
        data: jobData,
      },
    });

    return NextResponse.json({
      jobId: job.id,
      status: 'queued',
      message: 'Search job queued successfully',
    });
  } catch (error: any) {
    console.error('Parts search API error:', error);

    return NextResponse.json(
      {
        error: 'Failed to queue search job',
      },
      { status: 500 }
    );
  }
  }
);
