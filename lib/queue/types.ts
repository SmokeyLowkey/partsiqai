import { z } from 'zod';

// Email Monitor Job
export const EmailMonitorJobSchema = z.object({
  organizationId: z.string(),
  lastEmailId: z.string().optional(),
});

export type EmailMonitorJobData = z.infer<typeof EmailMonitorJobSchema>;

// Parts Search Job
export const PartsSearchJobSchema = z.object({
  organizationId: z.string(),
  conversationId: z.string(),
  query: z.string(),
  vehicleContext: z.object({
    make: z.string(),
    model: z.string(),
    year: z.number(),
    vehicleId: z.string().optional(),
  }).optional(),
});

export type PartsSearchJobData = z.infer<typeof PartsSearchJobSchema>;

// Quote Request Job
export const QuoteRequestJobSchema = z.object({
  quoteRequestId: z.string(),
  supplierId: z.string(),
});

export type QuoteRequestJobData = z.infer<typeof QuoteRequestJobSchema>;

// Quote Extraction Job
export const QuoteExtractionJobSchema = z.object({
  organizationId: z.string(),
  emailThreadId: z.string(),
  emailMessageId: z.string(),
  emailData: z.object({
    id: z.string(),
    threadId: z.string(),
    subject: z.string(),
    body: z.string(),
    from: z.string(),
    date: z.string(),
  }),
  attachments: z.array(z.object({
    id: z.string(),
    filename: z.string(),
    contentType: z.string(),
    size: z.number(),
    gmailAttachmentId: z.string(),
  })).optional(),
});

export type QuoteExtractionJobData = z.infer<typeof QuoteExtractionJobSchema>;

// Order Confirmation Job
export const OrderConfirmationJobSchema = z.object({
  orderId: z.string(),
});

export type OrderConfirmationJobData = z.infer<typeof OrderConfirmationJobSchema>;

// Follow-Up Job
export const FollowUpJobSchema = z.object({
  organizationId: z.string(),
  quoteRequestId: z.string(),
  quoteRequestEmailThreadId: z.string(),
  supplierId: z.string(),
  supplierName: z.string(),
  supplierEmail: z.string().nullable(),
  emailThreadId: z.string(),
  quoteNumber: z.string(),
  customSubject: z.string().optional(),
  customBody: z.string().optional(),
});

export type FollowUpJobData = z.infer<typeof FollowUpJobSchema>;

// Post-Order Tracking Job
export const PostOrderJobSchema = z.object({
  orderId: z.string(),
});

export type PostOrderJobData = z.infer<typeof PostOrderJobSchema>;

// Maintenance PDF Parsing Job
export const MaintenancePdfJobSchema = z.object({
  organizationId: z.string(),
  vehicleId: z.string(),
  scheduleId: z.string(),
  pdfS3Key: z.string(),
  vehicleContext: z.object({
    make: z.string(),
    model: z.string(),
    year: z.number(),
  }),
});

export type MaintenancePdfJobData = z.infer<typeof MaintenancePdfJobSchema>;

// Parts Ingestion Job
export const PartsIngestionJobSchema = z.object({
  organizationId: z.string(),
  ingestionJobId: z.string(),
  s3Key: z.string(),
  fileType: z.enum(['csv', 'json']),
  userId: z.string(),
  options: z.object({
    dryRun: z.boolean().default(false),
    skipPinecone: z.boolean().default(false),
    skipNeo4j: z.boolean().default(false),
    skipPostgres: z.boolean().default(false),
    batchSize: z.number().default(100),
    defaultNamespace: z.string().optional(),
    defaultManufacturer: z.string().optional(),
    defaultMachineModel: z.string().optional(),
    defaultTechnicalDomain: z.string().optional(),
    defaultSerialNumberRange: z.string().optional(),
  }).default({}),
});

export type PartsIngestionJobData = z.infer<typeof PartsIngestionJobSchema>;
