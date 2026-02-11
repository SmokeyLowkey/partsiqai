import { Worker, Job } from 'bullmq';
import { redisConnection } from '@/lib/queue/connection';
import { QUEUE_NAMES } from '@/lib/queue/queues';
import { VoipFallbackJobData } from '@/lib/queue/types';
import { workerLogger } from '@/lib/logger';
import { prisma } from '@/lib/prisma';
import { sendEmail } from '@/lib/email/resend';

const logger = workerLogger.child({ worker: 'voip-fallback' });

async function processVoipFallback(job: Job<VoipFallbackJobData>) {
  const {
    quoteRequestId,
    supplierId,
    supplierName,
    supplierEmail,
    callId,
    failureReason,
    context,
    metadata,
  } = job.data;

  logger.info(
    { quoteRequestId, supplierId, supplierEmail, jobId: job.id },
    'Processing VOIP fallback email'
  );

  try {
    // Fetch quote request details
    const quoteRequest = await prisma.quoteRequest.findUnique({
      where: { id: quoteRequestId },
      include: {
        items: {
          include: {
            part: true,
          },
        },
        vehicle: true,
        organization: true,
        createdBy: true,
      },
    });

    if (!quoteRequest) {
      throw new Error(`Quote request not found: ${quoteRequestId}`);
    }

    // Generate email content
    const subject = `Quote Request ${quoteRequest.quoteNumber} - Automated Followup`;
    
    const partsList = context.parts
      .map(
        (part, idx) =>
          `${idx + 1}. ${part.partNumber} - ${part.description}\n   Quantity: ${part.quantity}${part.notes ? `\n   Notes: ${part.notes}` : ''}`
      )
      .join('\n\n');

    const vehicleInfo = context.vehicleInfo
      ? `\n\nVehicle Information:\n- Make: ${context.vehicleInfo.make || 'N/A'}\n- Model: ${context.vehicleInfo.model || 'N/A'}\n- Year: ${context.vehicleInfo.year || 'N/A'}\n- Serial Number: ${context.vehicleInfo.serialNumber || 'N/A'}`
      : '';

    const priorityInfo = context.priority
      ? `\n\nPriority: ${context.priority.toUpperCase()}`
      : '';

    const dueDateInfo = context.dueDate
      ? `\nDue Date: ${new Date(context.dueDate).toLocaleDateString()}`
      : '';

    const body = `Dear ${supplierName},

We recently attempted to reach you by phone regarding Quote Request #${quoteRequest.quoteNumber}, but were unable to connect. 

${callId ? `Previous call attempt failed: ${failureReason}` : `Automated call system: ${failureReason}`}

We're following up via email to ensure you receive our quote request for the following parts:

${partsList}${vehicleInfo}${priorityInfo}${dueDateInfo}

${context.notes ? `\nAdditional Notes:\n${context.notes}\n` : ''}
Please provide your best pricing and availability for these items at your earliest convenience.

You can reply directly to this email or contact us at:
${quoteRequest.createdBy?.email || 'N/A'}

Thank you for your prompt attention to this matter.

Best regards,
${quoteRequest.organization?.name || 'Our Team'}

---
Quote Request #${quoteRequest.quoteNumber}
${new Date().toLocaleString()}
`;

    // Send email
    await sendEmail({
      to: supplierEmail,
      subject,
      html: body.replace(/\n/g, '<br>'),
    });

    // Note: Communication logging removed - EmailMessage requires EmailThread
    // The email send is tracked via Resend and the SupplierCall record exists
    // TODO: Implement full EmailThread/EmailMessage logging if needed

    logger.info(
      { quoteRequestId, supplierId, email: supplierEmail },
      'VOIP fallback email sent successfully'
    );

    return {
      success: true,
      email: supplierEmail,
      quoteRequestId,
      supplierId,
    };
  } catch (error: any) {
    logger.error(
      { error: error.message, quoteRequestId, supplierId },
      'Error sending VOIP fallback email'
    );

    // Note: Communication logging removed - EmailMessage requires EmailThread
    // The failure is logged via the logger above
    // TODO: Implement full EmailThread/EmailMessage logging if needed

    return {
      success: false,
      error: error.message,
    };
  }
}

// Create and start the worker
export function startVoipFallbackWorker() {
  const worker = new Worker<VoipFallbackJobData>(
    QUEUE_NAMES.VOIP_FALLBACK,
    async (job) => {
      logger.info(
        { jobId: job.id, data: job.data },
        'Processing VOIP fallback job'
      );

      try {
        const result = await processVoipFallback(job);
        return result;
      } catch (error) {
        logger.error(
          { jobId: job.id, error },
          'VOIP fallback job failed'
        );
        throw error;
      }
    },
    {
      connection: redisConnection,
      concurrency: 3, // Process 3 fallback emails concurrently
      removeOnComplete: {
        count: 100,
      },
      removeOnFail: {
        count: 500,
      },
    }
  );

  worker.on('completed', (job) => {
    logger.info(
      { jobId: job.id },
      'VOIP fallback job completed successfully'
    );
  });

  worker.on('failed', (job, err) => {
    logger.error(
      { jobId: job?.id, error: err },
      'VOIP fallback job failed'
    );
  });

  logger.info('VOIP fallback worker started');
  return worker;
}
