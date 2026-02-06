import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { getSignedAttachmentUrl } from '@/lib/services/storage/s3-client';

/**
 * GET /api/attachments/[id] - Get a signed URL for downloading an attachment
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getServerSession();
    if (!session?.user?.organizationId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { id } = await params;

    // Get attachment with related data for authorization check
    const attachment = await prisma.emailAttachment.findUnique({
      where: { id },
      include: {
        message: {
          include: {
            thread: true,
          },
        },
      },
    });

    if (!attachment) {
      return NextResponse.json(
        { error: 'Attachment not found' },
        { status: 404 }
      );
    }

    // Verify the attachment belongs to the user's organization
    if (attachment.message.thread.organizationId !== session.user.organizationId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 403 });
    }

    // Generate a signed URL for downloading
    // URL expires in 1 hour, and includes the original filename for download
    const signedUrl = await getSignedAttachmentUrl(
      attachment.path,
      3600, // 1 hour
      attachment.filename
    );

    return NextResponse.json({
      url: signedUrl,
      filename: attachment.filename,
      contentType: attachment.contentType,
      size: attachment.size,
    });
  } catch (error) {
    console.error('Error getting attachment:', error);
    return NextResponse.json(
      { error: 'Failed to get attachment' },
      { status: 500 }
    );
  }
}
