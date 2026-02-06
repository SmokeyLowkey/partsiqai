import {
  S3Client,
  PutObjectCommand,
  DeleteObjectCommand,
  GetObjectCommand,
} from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';

// Initialize S3 client
const s3Client = new S3Client({
  region: process.env.AWS_REGION || 'us-east-1',
  credentials: {
    accessKeyId: process.env.AWS_ACCESS_KEY_ID!,
    secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY!,
  },
});

const BUCKET_NAME = process.env.AWS_S3_BUCKET_NAME!;

/**
 * Upload a PDF file to S3
 * Files are organized by organization and vehicle: {orgId}/vehicles/{vehicleId}/{filename}
 */
export async function uploadMaintenancePdf(
  file: Buffer,
  fileName: string,
  organizationId: string,
  vehicleId: string
): Promise<{ key: string; url: string }> {
  // Validate file is PDF
  if (!fileName.toLowerCase().endsWith('.pdf')) {
    throw new Error('Only PDF files are allowed');
  }

  // Create S3 key with org/vehicle folder structure
  const key = `${organizationId}/vehicles/${vehicleId}/${fileName}`;

  const command = new PutObjectCommand({
    Bucket: BUCKET_NAME,
    Key: key,
    Body: file,
    ContentType: 'application/pdf',
    // Optional: Add metadata
    Metadata: {
      organizationId,
      vehicleId,
      uploadedAt: new Date().toISOString(),
    },
  });

  await s3Client.send(command);

  // Generate a signed URL valid for 7 days
  const url = await getSignedUrl(
    s3Client,
    new GetObjectCommand({
      Bucket: BUCKET_NAME,
      Key: key,
    }),
    { expiresIn: 7 * 24 * 60 * 60 } // 7 days
  );

  return { key, url };
}

/**
 * Generate a signed URL for accessing a PDF
 * @param key - S3 object key
 * @param expiresIn - URL expiration in seconds (default: 1 hour)
 */
export async function getSignedPdfUrl(
  key: string,
  expiresIn: number = 3600
): Promise<string> {
  const command = new GetObjectCommand({
    Bucket: BUCKET_NAME,
    Key: key,
  });

  const url = await getSignedUrl(s3Client, command, { expiresIn });
  return url;
}

/**
 * Delete a PDF file from S3
 */
export async function deleteMaintenancePdf(key: string): Promise<void> {
  const command = new DeleteObjectCommand({
    Bucket: BUCKET_NAME,
    Key: key,
  });

  await s3Client.send(command);
}

/**
 * Validate file is a PDF
 */
export function validatePdfFile(
  file: File | Buffer,
  maxSizeMB: number = 10
): void {
  if (file instanceof File) {
    // Client-side validation
    if (!file.type || file.type !== 'application/pdf') {
      throw new Error('Only PDF files are allowed');
    }

    const maxSize = maxSizeMB * 1024 * 1024; // Convert MB to bytes
    if (file.size > maxSize) {
      throw new Error(`File size must be less than ${maxSizeMB}MB`);
    }
  } else {
    // Server-side validation (Buffer)
    const maxSize = maxSizeMB * 1024 * 1024;
    if (file.length > maxSize) {
      throw new Error(`File size must be less than ${maxSizeMB}MB`);
    }

    // Check PDF magic number (header)
    const pdfHeader = Buffer.from([0x25, 0x50, 0x44, 0x46]); // %PDF
    if (!file.subarray(0, 4).equals(pdfHeader)) {
      throw new Error('Invalid PDF file');
    }
  }
}

/**
 * Generate a safe filename
 */
export function sanitizeFileName(fileName: string): string {
  // Remove path traversal attempts and special characters
  const sanitized = fileName
    .replace(/[^a-zA-Z0-9.-]/g, '_')
    .replace(/_{2,}/g, '_')
    .toLowerCase();

  // Ensure .pdf extension
  if (!sanitized.endsWith('.pdf')) {
    return sanitized + '.pdf';
  }

  return sanitized;
}

/**
 * Upload an email attachment to S3
 * Files are organized by organization and message: {orgId}/attachments/{messageId}/{filename}
 */
export async function uploadEmailAttachment(
  file: Buffer,
  fileName: string,
  contentType: string,
  organizationId: string,
  messageId: string
): Promise<{ key: string; url: string }> {
  // Sanitize filename for security
  const sanitizedFileName = fileName
    .replace(/[^a-zA-Z0-9.-]/g, '_')
    .replace(/_{2,}/g, '_');

  // Create S3 key with org/attachments folder structure
  const key = `${organizationId}/attachments/${messageId}/${sanitizedFileName}`;

  const command = new PutObjectCommand({
    Bucket: BUCKET_NAME,
    Key: key,
    Body: file,
    ContentType: contentType,
    Metadata: {
      organizationId,
      messageId,
      originalFileName: fileName,
      uploadedAt: new Date().toISOString(),
    },
  });

  await s3Client.send(command);

  // Generate a signed URL valid for 7 days
  const url = await getSignedUrl(
    s3Client,
    new GetObjectCommand({
      Bucket: BUCKET_NAME,
      Key: key,
    }),
    { expiresIn: 7 * 24 * 60 * 60 } // 7 days
  );

  return { key, url };
}

/**
 * Generate a signed URL for downloading an attachment
 * @param key - S3 object key
 * @param expiresIn - URL expiration in seconds (default: 1 hour)
 * @param fileName - Optional filename for content-disposition header
 */
export async function getSignedAttachmentUrl(
  key: string,
  expiresIn: number = 3600,
  fileName?: string
): Promise<string> {
  const command = new GetObjectCommand({
    Bucket: BUCKET_NAME,
    Key: key,
    ResponseContentDisposition: fileName
      ? `attachment; filename="${fileName}"`
      : undefined,
  });

  const url = await getSignedUrl(s3Client, command, { expiresIn });
  return url;
}

/**
 * Delete an email attachment from S3
 */
export async function deleteEmailAttachment(key: string): Promise<void> {
  const command = new DeleteObjectCommand({
    Bucket: BUCKET_NAME,
    Key: key,
  });

  await s3Client.send(command);
}

/**
 * Download a file from S3 as a Buffer
 * @param key - S3 object key
 */
export async function downloadFromS3(key: string): Promise<Buffer> {
  const command = new GetObjectCommand({
    Bucket: BUCKET_NAME,
    Key: key,
  });

  const response = await s3Client.send(command);

  if (!response.Body) {
    throw new Error('No body in S3 response');
  }

  // Convert stream to buffer
  const chunks: Uint8Array[] = [];
  for await (const chunk of response.Body as AsyncIterable<Uint8Array>) {
    chunks.push(chunk);
  }

  return Buffer.concat(chunks);
}

/**
 * Check if a file is a supported attachment type
 */
export function isSupportedAttachment(contentType: string): boolean {
  const supportedTypes = [
    'application/pdf',
    'image/png',
    'image/jpeg',
    'image/gif',
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', // xlsx
    'application/vnd.ms-excel', // xls
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document', // docx
    'application/msword', // doc
    'text/csv',
    'text/plain',
  ];
  return supportedTypes.includes(contentType.toLowerCase());
}
