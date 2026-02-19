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
  userId: z.string().optional(), // User whose inbox the email was found in (for attachment downloads)
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

// Analytics Collection Job
export const AnalyticsCollectionJobSchema = z.object({
  orderId: z.string(),
});

export type AnalyticsCollectionJobData = z.infer<typeof AnalyticsCollectionJobSchema>;

// VOIP Call Initiation Job
export const VoipCallInitiationJobSchema = z.object({
  quoteRequestId: z.string(),
  supplierId: z.string(),
  supplierName: z.string(),
  supplierPhone: z.string(),
  context: z.object({
    parts: z.array(z.object({
      partNumber: z.string(),
      description: z.string(),
      quantity: z.number(),
      notes: z.string().optional(),
    })),
    vehicleInfo: z.object({
      make: z.string().optional(),
      model: z.string().optional(),
      year: z.number().optional(),
      serialNumber: z.string().optional(),
    }).optional(),
    priority: z.enum(['low', 'medium', 'high', 'urgent']).optional(),
    dueDate: z.string().optional(),
    notes: z.string().optional(),
    customContext: z.string().optional(), // Background facts about this call (vehicle, parts details)
    customInstructions: z.string().optional(), // Behavioral instructions for the AI agent
  }),
  metadata: z.object({
    userId: z.string(),
    organizationId: z.string(),
    preferredMethod: z.enum(['call', 'email', 'both']),
    userRole: z.enum(['TECHNICIAN', 'MANAGER', 'ADMIN', 'MASTER_ADMIN', 'USER']).optional(),
  }),
});

export type VoipCallInitiationJobData = z.infer<typeof VoipCallInitiationJobSchema>;

// VOIP Fallback Job (email fallback when call fails)
export const VoipFallbackJobSchema = z.object({
  quoteRequestId: z.string(),
  supplierId: z.string(),
  supplierName: z.string(),
  supplierEmail: z.string(),
  callId: z.string().optional(), // The failed call ID
  failureReason: z.string(),
  context: z.object({
    parts: z.array(z.object({
      partNumber: z.string(),
      description: z.string(),
      quantity: z.number(),
      notes: z.string().optional(),
    })),
    vehicleInfo: z.object({
      make: z.string().optional(),
      model: z.string().optional(),
      year: z.number().optional(),
      serialNumber: z.string().optional(),
    }).optional(),
    priority: z.enum(['low', 'medium', 'high', 'urgent']).optional(),
    dueDate: z.string().optional(),
    notes: z.string().optional(),
    customContext: z.string().optional(), // Background facts about this call
    customInstructions: z.string().optional(), // Behavioral instructions
  }),
  metadata: z.object({
    userId: z.string(),
    organizationId: z.string(),
  }),
});

export type VoipFallbackJobData = z.infer<typeof VoipFallbackJobSchema>;

// VOIP Call Retry Job
export const VoipCallRetryJobSchema = z.object({
  quoteRequestId: z.string(),
  supplierId: z.string(),
  supplierName: z.string(),
  supplierPhone: z.string(),
  previousCallId: z.string(),
  retryAttempt: z.number(),
  maxRetries: z.number().default(3),
  context: z.object({
    parts: z.array(z.object({
      partNumber: z.string(),
      description: z.string(),
      quantity: z.number(),
      notes: z.string().optional(),
    })),
    vehicleInfo: z.object({
      make: z.string().optional(),
      model: z.string().optional(),
      year: z.number().optional(),
      serialNumber: z.string().optional(),
    }).optional(),
    priority: z.enum(['low', 'medium', 'high', 'urgent']).optional(),
    dueDate: z.string().optional(),
    notes: z.string().optional(),
    customContext: z.string().optional(), // Background facts about this call
    customInstructions: z.string().optional(), // Behavioral instructions
  }),
  metadata: z.object({
    userId: z.string(),
    organizationId: z.string(),
  }),
});

export type VoipCallRetryJobData = z.infer<typeof VoipCallRetryJobSchema>;

// Commander Event Job (Overseer → Commander)
export const CommanderEventJobSchema = z.object({
  callId: z.string(),
  quoteRequestId: z.string(),
  supplierName: z.string(),
  eventType: z.enum([
    'quote_received',
    'quote_rejected',
    'negotiation_stalled',
    'transfer_in_progress',
    'supplier_wants_callback',
    'call_ended',
    'error_detected',
  ]),
  timestamp: z.number(),
  data: z.record(z.any()),
  organizationId: z.string(),
});

export type CommanderEventJobData = z.infer<typeof CommanderEventJobSchema>;
