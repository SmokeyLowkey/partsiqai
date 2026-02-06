import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { getSignedPdfUrl } from '@/lib/services/storage/s3-client';

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getServerSession();

    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { id: vehicleId } = await params;

    // Verify vehicle belongs to user's organization
    const vehicle = await prisma.vehicle.findFirst({
      where: {
        id: vehicleId,
        organizationId: session.user.organizationId,
      },
      select: {
        id: true,
        maintenancePdfUrl: true,
        maintenancePdfFileName: true,
      },
    });

    if (!vehicle) {
      return NextResponse.json(
        { error: 'Vehicle not found' },
        { status: 404 }
      );
    }

    if (!vehicle.maintenancePdfUrl) {
      return NextResponse.json(
        { error: 'No maintenance PDF uploaded' },
        { status: 404 }
      );
    }

    // Generate signed URL (valid for 1 hour)
    const signedUrl = await getSignedPdfUrl(vehicle.maintenancePdfUrl, 3600);

    return NextResponse.json({
      url: signedUrl,
      fileName: vehicle.maintenancePdfFileName,
      expiresIn: 3600, // seconds
    });
  } catch (error: any) {
    console.error('Get PDF URL error:', error);

    return NextResponse.json(
      {
        error: 'Failed to get PDF URL',
      },
      { status: 500 }
    );
  }
}
