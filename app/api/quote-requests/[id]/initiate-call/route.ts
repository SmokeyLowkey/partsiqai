import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { voipCallInitiationQueue, voipCallInitiationQueueEvents } from '@/lib/queue/queues';

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getServerSession();

    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { supplierIds, contactMethod, callContext, agentInstructions } = await req.json();
    const { id } = await params;

    if (!Array.isArray(supplierIds) || supplierIds.length === 0) {
      return NextResponse.json(
        { error: 'supplierIds must be a non-empty array' },
        { status: 400 }
      );
    }

    // Validate contactMethod
    const validMethods = ['call', 'email', 'both'];
    if (!contactMethod || !validMethods.includes(contactMethod)) {
      return NextResponse.json(
        { error: 'contactMethod must be "call", "email", or "both"' },
        { status: 400 }
      );
    }

    // Get quote request
    const quoteRequest = await prisma.quoteRequest.findUnique({
      where: { id },
      include: {
        items: true,
        organization: true,
        vehicle: true,
      },
    });

    if (!quoteRequest) {
      return NextResponse.json(
        { error: 'Quote request not found' },
        { status: 404 }
      );
    }

    // Verify organization access
    if (quoteRequest.organizationId !== session.user.organizationId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 403 });
    }

    // Queue call initiation jobs for each supplier
    const callJobs = await Promise.allSettled(
      supplierIds.map(async (supplierId: string) => {
        const supplier = await prisma.supplier.findUnique({
          where: { id: supplierId },
        });

        if (!supplier) {
          return { supplierId, error: 'Supplier not found' };
        }

        if (!supplier.phone) {
          return { supplierId, error: 'Supplier has no phone number' };
        }

        if (supplier.doNotCall) {
          return { supplierId, error: 'Supplier is marked as do not call' };
        }

        // Validate email if method requires it
        if ((contactMethod === 'both' || contactMethod === 'email') && !supplier.email) {
          return { supplierId, error: 'Supplier has no email address' };
        }

        // Queue background job for call initiation
        const job = await voipCallInitiationQueue.add(
          `call-${quoteRequest.id}-${supplier.id}`,
          {
            quoteRequestId: quoteRequest.id,
            supplierId: supplier.id,
            supplierName: supplier.name,
            supplierPhone: supplier.phone,
            context: {
              parts: quoteRequest.items.map((item) => ({
                partNumber: item.partNumber,
                description: item.description,
                quantity: item.quantity,
                notes: item.notes || undefined,
              })),
              vehicleInfo: quoteRequest.vehicle
                ? {
                    make: quoteRequest.vehicle.make || undefined,
                    model: quoteRequest.vehicle.model || undefined,
                    year: quoteRequest.vehicle.year || undefined,
                    serialNumber: quoteRequest.vehicle.serialNumber || undefined,
                  }
                : undefined,
              notes: quoteRequest.notes || undefined,
              customContext: callContext || undefined,
              customInstructions: agentInstructions || undefined,
            },
            metadata: {
              userId: session.user.id,
              organizationId: quoteRequest.organizationId,
              preferredMethod: contactMethod as 'call' | 'email' | 'both',
            },
          },
          {
            attempts: 1,
            removeOnComplete: { age: 86400, count: 100 },
            removeOnFail: { age: 604800, count: 100 },
          }
        );

        // Wait for job to complete (with 10 second timeout)
        try {
          const result = await job.waitUntilFinished(voipCallInitiationQueueEvents, 10000);
          
          return {
            supplierId,
            supplierName: supplier.name,
            jobId: job.id,
            callId: result.callId,
            vapiCallId: result.vapiCallId,
            status: 'initiated',
          };
        } catch (waitError: any) {
          // Job failed or timed out
          const jobState = await job.getState();
          const jobError = job.failedReason;
          
          return {
            supplierId,
            supplierName: supplier.name,
            jobId: job.id,
            status: jobState,
            error: jobError || waitError.message || 'Call initiation timed out or failed',
          };
        }
      })
    );

    const jobs = callJobs.map((result, index) => {
      if (result.status === 'fulfilled') {
        return result.value;
      } else {
        return {
          supplierId: supplierIds[index],
          supplierName: 'Unknown',
          error: result.reason?.message || 'Failed to queue job',
        };
      }
    });

    const successCount = jobs.filter((j) => 
      'status' in j && (j.status === 'initiated' || j.status === 'queued')
    ).length;
    const failCount = jobs.length - successCount;

    return NextResponse.json({
      success: successCount > 0,
      message: successCount > 0
        ? `Initiated ${successCount} call(s). ${failCount > 0 ? `${failCount} failed.` : ''}`
        : `All ${failCount} call(s) failed to initiate.`,
      jobs,
    });
  } catch (error) {
    console.error('Error initiating calls:', error);
    return NextResponse.json(
      {
        error: 'Failed to initiate calls',
        details: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    );
  }
}
