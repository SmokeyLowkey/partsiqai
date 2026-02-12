// CRITICAL: Load environment variables FIRST before any other imports
require('dotenv').config({ path: require('path').resolve(__dirname, '../.env') });

import { Worker, Job } from 'bullmq';
import { redisConnection } from '@/lib/queue/connection';
import { MaintenancePdfJobData } from '@/lib/queue/types';
import { OpenRouterClient } from '@/lib/services/llm/openrouter-client';
import { extractPdfTextFromS3 } from '@/lib/services/document/pdf-parser';
import { prisma } from '@/lib/prisma';
import { IntervalType } from '@prisma/client';
import { z } from 'zod';
import { workerLogger } from '@/lib/logger';

const QUEUE_NAME = 'maintenance-pdf';

// Normalize LLM interval type outputs to valid Prisma enum values
function normalizeIntervalType(rawType: string | null | undefined): IntervalType {
  if (!rawType) return IntervalType.HOURS;

  const normalized = rawType.toUpperCase().trim();

  // Direct matches
  if (normalized === 'HOURS') return IntervalType.HOURS;
  if (normalized === 'DAYS') return IntervalType.DAYS;
  if (normalized === 'MONTHS') return IntervalType.MONTHS;
  if (normalized === 'MILES') return IntervalType.MILES;

  // Map common LLM variations to valid values
  const mappings: Record<string, IntervalType> = {
    // Hours variations
    'HOUR': IntervalType.HOURS,
    'HRS': IntervalType.HOURS,
    'HR': IntervalType.HOURS,
    'OPERATING_HOURS': IntervalType.HOURS,
    'ENGINE_HOURS': IntervalType.HOURS,
    'MACHINE_HOURS': IntervalType.HOURS,
    'WORK_HOURS': IntervalType.HOURS,

    // Days variations
    'DAY': IntervalType.DAYS,
    'DAILY': IntervalType.DAYS,
    'D': IntervalType.DAYS,

    // Months variations
    'MONTH': IntervalType.MONTHS,
    'MONTHLY': IntervalType.MONTHS,
    'MO': IntervalType.MONTHS,
    'M': IntervalType.MONTHS,

    // Miles variations
    'MILE': IntervalType.MILES,
    'MI': IntervalType.MILES,
    'MILEAGE': IntervalType.MILES,
    'KM': IntervalType.MILES, // Treat km as miles (user can convert)
    'KILOMETERS': IntervalType.MILES,

    // Special cases - default to HOURS as these are typically hour-based
    'AS_REQUIRED': IntervalType.HOURS,
    'AS_NEEDED': IntervalType.HOURS,
    'WEEKLY': IntervalType.DAYS, // 7 days
    'ANNUALLY': IntervalType.MONTHS, // 12 months
    'YEARLY': IntervalType.MONTHS,
    'SEASONAL': IntervalType.MONTHS,
  };

  return mappings[normalized] || IntervalType.HOURS;
}

// Schema for extracted maintenance schedule data - accept any string for intervalType
// since LLM outputs vary and we'll normalize them
const ExtractedMaintenanceScheduleSchema = z.object({
  oem: z.string().nullable().optional(),
  modelMatch: z.string().nullable().optional(),
  intervals: z.array(
    z.object({
      intervalHours: z.number(),
      intervalType: z.string().optional(), // Accept any string, normalize later
      serviceName: z.string(),
      serviceDescription: z.string().nullable().optional(),
      category: z.string().nullable().optional(),
      parts: z.array(
        z.object({
          partNumber: z.string(),
          description: z.string().nullable().optional(),
          quantity: z.number().default(1),
        })
      ).default([]),
    })
  ).default([]),
  extractionNotes: z.string().nullable().optional(),
});

type ExtractedMaintenanceSchedule = z.infer<typeof ExtractedMaintenanceScheduleSchema>;

// Extract maintenance schedule using OpenRouterClient
async function extractMaintenanceScheduleWithLLM(
  llmClient: OpenRouterClient,
  pdfText: string,
  vehicleContext: { make: string; model: string; year: number }
): Promise<ExtractedMaintenanceSchedule> {
  const extractionPrompt = `You are a specialized assistant that extracts maintenance schedule information from OEM maintenance planner PDFs.

VEHICLE CONTEXT:
Make: ${vehicleContext.make}
Model: ${vehicleContext.model}
Year: ${vehicleContext.year}

PDF CONTENT:
${pdfText}

INSTRUCTIONS:
Extract all maintenance intervals and required parts from this maintenance planner PDF.

1. Identify all maintenance intervals (typically at 50, 100, 250, 500, 1000, 2000, 3000, 5000 operating hours or daily/weekly/monthly schedules)
2. For each interval, extract:
   - The interval number (e.g., 250, 500 hours)
   - The interval type (HOURS, DAYS, MONTHS, or MILES)
   - Service name/type (e.g., "Engine Oil Change", "Hydraulic Filter Replacement")
   - Service description (additional details from the PDF)
   - Category (e.g., "Lubrication", "Filters", "Hydraulics", "Engine", "Cooling", "Electrical")
   - Required parts with OEM part numbers and quantities

3. Part numbers follow patterns like:
   - John Deere: RE123456, AT123456, RE000000, TY000000
   - Caterpillar: 1R-0750, 3E-9713, 1R-1808
   - Komatsu: 600-185-5100, 07063-01054
   - Case: 84259320, 87349575
   - Kubota: HH1C0-32430, 1A001-43560
   - Generic: Look for alphanumeric codes that appear to be part numbers

4. If a service says "Same as X hours PLUS additional items", include both the base items and additional items.

5. Detect the OEM/manufacturer from the PDF content (John Deere, Caterpillar, Komatsu, Case, Kubota, etc.)

Respond with a JSON object in this EXACT format:
{
  "oem": "detected manufacturer name or null",
  "modelMatch": "model name/number found in PDF that matches vehicle or null",
  "intervals": [
    {
      "intervalHours": 500,
      "intervalType": "HOURS",
      "serviceName": "Engine Oil & Filter Change",
      "serviceDescription": "Change engine oil and replace oil filter. Check for leaks.",
      "category": "Lubrication",
      "parts": [
        {
          "partNumber": "RE123456",
          "description": "Engine Oil Filter",
          "quantity": 1
        },
        {
          "partNumber": "TY26674",
          "description": "Engine Oil 15W-40 (gallons)",
          "quantity": 3
        }
      ]
    }
  ],
  "extractionNotes": "any notes about uncertain extractions or PDF quality issues"
}

If no maintenance schedule information can be extracted, return an empty intervals array with extractionNotes explaining why.`;

  workerLogger.info('Extracting maintenance schedule from PDF');

  try {
    const result = await llmClient.generateStructuredOutput<ExtractedMaintenanceSchedule>(
      extractionPrompt,
      ExtractedMaintenanceScheduleSchema,
      { maxTokens: 8000 } // Larger token limit for comprehensive extraction
    );

    workerLogger.info({ intervalCount: result.intervals?.length || 0 }, 'Maintenance extraction result');
    return result;
  } catch (error: any) {
    workerLogger.error({ err: error }, 'LLM maintenance extraction error');
    return {
      oem: null,
      modelMatch: null,
      intervals: [],
      extractionNotes: `Extraction failed: ${error.message}`,
    };
  }
}

// Process the maintenance PDF job
async function processMaintenancePdf(job: Job<MaintenancePdfJobData>): Promise<void> {
  const { organizationId, vehicleId, scheduleId, pdfS3Key, vehicleContext } = job.data;

  workerLogger.info({ vehicleId, scheduleId }, 'Processing maintenance PDF job');

  try {
    // Update status to PROCESSING
    await prisma.maintenanceSchedule.update({
      where: { id: scheduleId },
      data: { parsingStatus: 'PROCESSING' },
    });

    // Step 1: Extract text from PDF using Mistral OCR
    workerLogger.info({ pdfS3Key }, 'Extracting text from PDF');
    const pdfText = await extractPdfTextFromS3(organizationId, pdfS3Key);
    workerLogger.info({ charCount: pdfText.length }, 'Extracted text from PDF');

    if (!pdfText || pdfText.length < 100) {
      throw new Error('PDF extraction returned insufficient text');
    }

    // Step 2: Extract structured data using LLM
    const llmClient = await OpenRouterClient.fromOrganization(organizationId);
    const extractedData = await extractMaintenanceScheduleWithLLM(
      llmClient,
      pdfText,
      vehicleContext
    );

    // Step 3: Calculate extraction confidence
    let confidence = 0;
    if (extractedData.oem) confidence += 20;
    if (extractedData.intervals && extractedData.intervals.length > 0) {
      confidence += 30;
      // More intervals = higher confidence (up to +30)
      confidence += Math.min(30, extractedData.intervals.length * 5);
      // Having parts in intervals = higher confidence (up to +20)
      const partsCount = extractedData.intervals.reduce(
        (sum, interval) => sum + (interval.parts?.length || 0),
        0
      );
      confidence += Math.min(20, partsCount * 2);
    }

    // Step 4: Store extracted intervals and parts in database
    await prisma.$transaction(async (tx) => {
      // Delete any existing intervals for this schedule (in case of re-processing)
      await tx.maintenanceInterval.deleteMany({
        where: { maintenanceScheduleId: scheduleId },
      });

      // Create intervals with their parts
      for (const interval of extractedData.intervals || []) {
        // Normalize the interval type from LLM output to valid enum value
        const normalizedIntervalType = normalizeIntervalType(interval.intervalType);
        workerLogger.debug({ serviceName: interval.serviceName, rawType: interval.intervalType, normalizedType: normalizedIntervalType }, 'Normalized interval type');

        await tx.maintenanceInterval.create({
          data: {
            maintenanceScheduleId: scheduleId,
            intervalHours: interval.intervalHours,
            intervalType: normalizedIntervalType,
            serviceName: interval.serviceName,
            serviceDescription: interval.serviceDescription,
            category: interval.category,
            requiredParts: {
              create: (interval.parts || []).map((part) => ({
                partNumber: part.partNumber,
                partDescription: part.description,
                quantity: part.quantity || 1,
              })),
            },
          },
        });
      }

      // Update the schedule with extraction results
      await tx.maintenanceSchedule.update({
        where: { id: scheduleId },
        data: {
          parsingStatus: 'COMPLETED',
          parsedAt: new Date(),
          oem: extractedData.oem,
          extractionConfidence: confidence,
          parsingError: extractedData.extractionNotes || null,
          // Keep approvalStatus as PENDING_REVIEW for admin to review
        },
      });
    });

    workerLogger.info({
      scheduleId,
      intervalCount: extractedData.intervals?.length || 0,
      confidence,
    }, 'Successfully processed maintenance PDF');
  } catch (error: any) {
    workerLogger.error({ err: error, scheduleId }, 'Error processing maintenance PDF');

    // Update schedule with error status
    await prisma.maintenanceSchedule.update({
      where: { id: scheduleId },
      data: {
        parsingStatus: 'FAILED',
        parsingError: error.message || 'Unknown error during PDF parsing',
      },
    });

    throw error; // Re-throw to trigger BullMQ retry logic
  }
}

// Create the worker
const worker = new Worker<MaintenancePdfJobData>(
  QUEUE_NAME,
  async (job) => {
    workerLogger.info({ queue: QUEUE_NAME, jobId: job.id }, 'Processing job');
    await processMaintenancePdf(job);
  },
  {
    connection: redisConnection,
    concurrency: 2, // Process up to 2 PDFs at a time
  }
);

// Worker event handlers
worker.on('completed', (job) => {
  workerLogger.info({ queue: QUEUE_NAME, jobId: job.id }, 'Job completed successfully');
});

worker.on('failed', (job, err) => {
  workerLogger.error({ err, queue: QUEUE_NAME, jobId: job?.id }, 'Job failed');
});

worker.on('error', (err) => {
  workerLogger.error({ err, queue: QUEUE_NAME }, 'Worker error');
});

workerLogger.info({ queue: QUEUE_NAME }, 'Maintenance PDF Worker started');

export { worker as maintenancePdfWorker };
