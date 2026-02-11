import { NextResponse } from 'next/server';
import { getServerSession } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { encrypt, decrypt, maskApiKey, validateEncryption } from '@/lib/encryption';

/**
 * GET /api/admin/organizations/[id]/api-keys
 * Get BYOK settings for an organization (Master Admin only)
 */
export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const session = await getServerSession();
    
    if (!session?.user || session.user.role !== 'MASTER_ADMIN') {
      return NextResponse.json(
        { error: 'Unauthorized - Master Admin access required' },
        { status: 403 }
      );
    }

    const organization = await prisma.organization.findUnique({
      where: { id },
      select: {
        id: true,
        name: true,
        subscriptionTier: true,
        usePlatformKeys: true,
        vapiApiKey: true,
        openrouterApiKey: true,
        elevenLabsApiKey: true,
        aiCallsUsedThisMonth: true,
        maxAICalls: true,
      },
    });

    if (!organization) {
      return NextResponse.json(
        { error: 'Organization not found' },
        { status: 404 }
      );
    }

    // Decrypt and mask keys for display
    const maskedKeys = {
      vapiApiKey: organization.vapiApiKey 
        ? maskApiKey(decrypt(organization.vapiApiKey)) 
        : null,
      openrouterApiKey: organization.openrouterApiKey 
        ? maskApiKey(decrypt(organization.openrouterApiKey)) 
        : null,
      elevenLabsApiKey: organization.elevenLabsApiKey 
        ? maskApiKey(decrypt(organization.elevenLabsApiKey)) 
        : null,
    };

    return NextResponse.json({
      organizationId: organization.id,
      organizationName: organization.name,
      subscriptionTier: organization.subscriptionTier,
      usePlatformKeys: organization.usePlatformKeys,
      hasVapiKey: !!organization.vapiApiKey,
      hasOpenrouterKey: !!organization.openrouterApiKey,
      hasElevenLabsKey: !!organization.elevenLabsApiKey,
      maskedKeys,
      usage: {
        aiCallsUsedThisMonth: organization.aiCallsUsedThisMonth,
        maxAICalls: organization.maxAICalls,
      },
    });
  } catch (error) {
    console.error('Error fetching BYOK settings:', error);
    return NextResponse.json(
      { error: 'Failed to fetch BYOK settings' },
      { status: 500 }
    );
  }
}

/**
 * PATCH /api/admin/organizations/[id]/api-keys
 * Update BYOK settings for an organization (Master Admin only)
 */
export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const session = await getServerSession();
    
    if (!session?.user || session.user.role !== 'MASTER_ADMIN') {
      return NextResponse.json(
        { error: 'Unauthorized - Master Admin access required' },
        { status: 403 }
      );
    }

    const body = await request.json();
    const { usePlatformKeys, vapiApiKey, openrouterApiKey, elevenLabsApiKey } = body;

    // Validate organization exists
    const organization = await prisma.organization.findUnique({
      where: { id },
      select: { id: true, name: true },
    });

    if (!organization) {
      return NextResponse.json(
        { error: 'Organization not found' },
        { status: 404 }
      );
    }

    // Build update object with encrypted keys
    const updateData: {
      usePlatformKeys?: boolean;
      vapiApiKey?: string | null;
      openrouterApiKey?: string | null;
      elevenLabsApiKey?: string | null;
    } = {};

    if (typeof usePlatformKeys !== 'undefined') {
      updateData.usePlatformKeys = usePlatformKeys;
    }

    // Validate and encrypt API keys before storing
    if (vapiApiKey !== undefined) {
      if (vapiApiKey === null || vapiApiKey === '') {
        updateData.vapiApiKey = null;
      } else {
        // Validate key format (basic check)
        if (typeof vapiApiKey !== 'string' || vapiApiKey.length < 10) {
          return NextResponse.json(
            { error: 'Invalid Vapi API key format' },
            { status: 400 }
          );
        }
        
        // Test encryption/decryption
        if (!validateEncryption(vapiApiKey)) {
          return NextResponse.json(
            { error: 'Failed to validate encryption for Vapi API key' },
            { status: 500 }
          );
        }
        
        updateData.vapiApiKey = encrypt(vapiApiKey);
      }
    }

    if (openrouterApiKey !== undefined) {
      if (openrouterApiKey === null || openrouterApiKey === '') {
        updateData.openrouterApiKey = null;
      } else {
        if (typeof openrouterApiKey !== 'string' || openrouterApiKey.length < 10) {
          return NextResponse.json(
            { error: 'Invalid OpenRouter API key format' },
            { status: 400 }
          );
        }
        
        if (!validateEncryption(openrouterApiKey)) {
          return NextResponse.json(
            { error: 'Failed to validate encryption for OpenRouter API key' },
            { status: 500 }
          );
        }
        
        updateData.openrouterApiKey = encrypt(openrouterApiKey);
      }
    }

    if (elevenLabsApiKey !== undefined) {
      if (elevenLabsApiKey === null || elevenLabsApiKey === '') {
        updateData.elevenLabsApiKey = null;
      } else {
        if (typeof elevenLabsApiKey !== 'string' || elevenLabsApiKey.length < 10) {
          return NextResponse.json(
            { error: 'Invalid ElevenLabs API key format' },
            { status: 400 }
          );
        }
        
        if (!validateEncryption(elevenLabsApiKey)) {
          return NextResponse.json(
            { error: 'Failed to validate encryption for ElevenLabs API key' },
            { status: 500 }
          );
        }
        
        updateData.elevenLabsApiKey = encrypt(elevenLabsApiKey);
      }
    }

    // Update organization
    const updated = await prisma.organization.update({
      where: { id },
      data: updateData,
    });

    // Log activity
    await prisma.activityLog.create({
      data: {
        type: 'SUBSCRIPTION_UPDATED',
        title: 'BYOK Settings Updated',
        description: `Master admin updated BYOK settings: usePlatformKeys=${updateData.usePlatformKeys}, keys updated: ${Object.keys(updateData).filter(k => k.includes('ApiKey')).join(', ')}`,
        organizationId: id,
        metadata: {
          updatedBy: session.user.email,
          usePlatformKeys: updateData.usePlatformKeys,
          keysUpdated: Object.keys(updateData).filter(k => k.includes('ApiKey')),
        },
      },
    });

    return NextResponse.json({
      success: true,
      message: 'BYOK settings updated successfully',
      organizationId: updated.id,
      usePlatformKeys: updated.usePlatformKeys,
    });
  } catch (error) {
    console.error('Error updating BYOK settings:', error);
    return NextResponse.json(
      { error: 'Failed to update BYOK settings' },
      { status: 500 }
    );
  }
}

/**
 * DELETE /api/admin/organizations/[id]/api-keys
 * Remove all BYOK keys and revert to platform keys (Master Admin only)
 */
export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const session = await getServerSession();
    
    if (!session?.user || session.user.role !== 'MASTER_ADMIN') {
      return NextResponse.json(
        { error: 'Unauthorized - Master Admin access required' },
        { status: 403 }
      );
    }

    // Update organization to remove all keys and enable platform keys
    const updated = await prisma.organization.update({
      where: { id },
      data: {
        usePlatformKeys: true,
        vapiApiKey: null,
        openrouterApiKey: null,
        elevenLabsApiKey: null,
      },
    });

    // Log activity
    await prisma.activityLog.create({
      data: {
        type: 'SUBSCRIPTION_UPDATED',
        title: 'BYOK Keys Removed',
        description: 'Master admin removed all BYOK keys and reverted to platform keys',
        organizationId: id,
        metadata: {
          removedBy: session.user.email,
        },
      },
    });

    return NextResponse.json({
      success: true,
      message: 'All BYOK keys removed, reverted to platform keys',
      organizationId: updated.id,
    });
  } catch (error) {
    console.error('Error removing BYOK keys:', error);
    return NextResponse.json(
      { error: 'Failed to remove BYOK keys' },
      { status: 500 }
    );
  }
}
