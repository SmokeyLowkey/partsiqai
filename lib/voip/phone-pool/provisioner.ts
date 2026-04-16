import { prisma } from '@/lib/prisma';
import Twilio from 'twilio';
import { CredentialsManager } from '@/lib/services/credentials/credentials-manager';
import { getVapiPlatformConfig } from './config';

interface TwilioCredentials {
  accountSid: string;
  authToken: string;
}

interface VapiCredentials {
  apiKey: string;
  phoneNumberId?: string;
  assistantId?: string;
}

interface ProvisionResult {
  id: string;
  vapiPhoneNumberId: string;
  twilioSid: string;
  e164: string;
  areaCode: string | null;
}

/**
 * Provision a new phone number: buy from Twilio, import into Vapi, store in DB.
 */
export async function provisionNumber(options: {
  areaCode?: string;
  label?: string;
}): Promise<ProvisionResult> {
  const credentialsManager = new CredentialsManager();

  // Get Twilio credentials from IntegrationCredential (platform-level)
  const twilioCreds = await credentialsManager.getCredentialsWithFallback<TwilioCredentials>(
    'system-platform-credentials',
    'TWILIO'
  );
  if (!twilioCreds?.accountSid || !twilioCreds?.authToken) {
    throw new Error('Twilio credentials not configured. Add them in Admin → Platform Credentials.');
  }

  // Get Vapi credentials
  const vapiCreds = await credentialsManager.getCredentialsWithFallback<VapiCredentials>(
    'system-platform-credentials',
    'VAPI'
  );
  if (!vapiCreds?.apiKey) {
    throw new Error('Vapi API key not configured. Add it in Admin → Platform Credentials.');
  }

  // Get Vapi platform config from SystemSettings
  const vapiConfig = await getVapiPlatformConfig();

  // Step 1: Buy number from Twilio
  const twilioClient = Twilio(twilioCreds.accountSid, twilioCreds.authToken);

  const twilioNumber = await twilioClient.incomingPhoneNumbers.create({
    areaCode: options.areaCode || undefined,
    voiceReceiveMode: 'voice',
  });

  const e164 = twilioNumber.phoneNumber;
  const twilioSid = twilioNumber.sid;
  const areaCode = options.areaCode || e164.slice(2, 5); // Extract from +1XXX...

  try {
    // Step 2: Import into Vapi with full configuration
    const vapiPayload: Record<string, unknown> = {
      provider: 'twilio',
      number: e164,
      twilioAccountSid: twilioCreds.accountSid,
      twilioAuthToken: twilioCreds.authToken,
      name: options.label || `PARTSIQ_POOL_${areaCode}_${Date.now()}`,
      smsEnabled: true,
    };

    // Server config
    if (vapiConfig.serverUrl) {
      const server: Record<string, unknown> = {
        url: vapiConfig.serverUrl,
        timeoutSeconds: 20,
      };
      if (vapiConfig.credentialId) {
        server.credentialId = vapiConfig.credentialId;
      }
      vapiPayload.server = server;
    }

    // Inbound assistant
    if (vapiConfig.platformAssistantId) {
      vapiPayload.assistantId = vapiConfig.platformAssistantId;
    }

    // Fallback destination (platform safety net)
    if (vapiConfig.platformFallbackNumber) {
      vapiPayload.fallbackDestination = {
        type: 'number',
        number: vapiConfig.platformFallbackNumber,
      };
    }

    const vapiResponse = await fetch('https://api.vapi.ai/phone-number', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${vapiCreds.apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(vapiPayload),
    });

    if (!vapiResponse.ok) {
      const error = await vapiResponse.text();
      // Rollback: release Twilio number
      await twilioClient.incomingPhoneNumbers(twilioSid).remove();
      throw new Error(`Vapi import failed (${vapiResponse.status}): ${error}`);
    }

    const vapiData = await vapiResponse.json();
    const vapiPhoneNumberId = vapiData.id as string;
    const vapiStatus = (vapiData.status as string) || null;

    // Step 3: Store in DB
    const row = await prisma.vapiPhoneNumber.create({
      data: {
        vapiPhoneNumberId,
        twilioSid,
        e164,
        areaCode,
        provider: 'TWILIO',
        vapiStatus,
      },
    });

    return {
      id: row.id,
      vapiPhoneNumberId,
      twilioSid,
      e164,
      areaCode,
    };
  } catch (error) {
    // If Vapi import or DB insert failed, ensure Twilio number is released
    try {
      await twilioClient.incomingPhoneNumbers(twilioSid).remove();
    } catch {
      // Best effort — log but don't mask original error
      console.error(`[Provisioner] Failed to rollback Twilio number ${twilioSid}`);
    }
    throw error;
  }
}

/**
 * Release a phone number: remove from Vapi, release from Twilio, mark as RETIRED.
 */
export async function releaseNumber(phoneNumberRowId: string): Promise<void> {
  const number = await prisma.vapiPhoneNumber.findUnique({
    where: { id: phoneNumberRowId },
  });

  if (!number) {
    throw new Error(`Phone number not found: ${phoneNumberRowId}`);
  }

  const credentialsManager = new CredentialsManager();

  const vapiCreds = await credentialsManager.getCredentialsWithFallback<VapiCredentials>(
    'system-platform-credentials',
    'VAPI'
  );

  // Step 1: Remove from Vapi
  if (vapiCreds?.apiKey) {
    try {
      await fetch(`https://api.vapi.ai/phone-number/${number.vapiPhoneNumberId}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${vapiCreds.apiKey}` },
      });
    } catch {
      console.error(`[Provisioner] Failed to delete Vapi number ${number.vapiPhoneNumberId}`);
    }
  }

  // Step 2: Release from Twilio
  if (number.twilioSid) {
    try {
      const twilioCreds = await credentialsManager.getCredentialsWithFallback<TwilioCredentials>(
        'system-platform-credentials',
        'TWILIO'
      );
      if (twilioCreds?.accountSid && twilioCreds?.authToken) {
        const twilioClient = Twilio(twilioCreds.accountSid, twilioCreds.authToken);
        await twilioClient.incomingPhoneNumbers(number.twilioSid).remove();
      }
    } catch {
      console.error(`[Provisioner] Failed to release Twilio number ${number.twilioSid}`);
    }
  }

  // Step 3: Mark as RETIRED
  await prisma.vapiPhoneNumber.update({
    where: { id: phoneNumberRowId },
    data: {
      healthStatus: 'RETIRED',
      isActive: false,
    },
  });
}

/**
 * Sync all active pool numbers with current SystemSetting values.
 * PATCHes Vapi config on each number (server URL, assistant, fallback).
 */
export async function syncPoolConfig(): Promise<{ updated: number; failed: number }> {
  const credentialsManager = new CredentialsManager();
  const vapiCreds = await credentialsManager.getCredentialsWithFallback<VapiCredentials>(
    'system-platform-credentials',
    'VAPI'
  );

  if (!vapiCreds?.apiKey) {
    throw new Error('Vapi API key not configured');
  }

  const vapiConfig = await getVapiPlatformConfig();
  const numbers = await prisma.vapiPhoneNumber.findMany({
    where: { isActive: true },
    select: { vapiPhoneNumberId: true },
  });

  let updated = 0;
  let failed = 0;

  const patchPayload: Record<string, unknown> = {};

  if (vapiConfig.serverUrl) {
    const server: Record<string, unknown> = {
      url: vapiConfig.serverUrl,
      timeoutSeconds: 20,
    };
    if (vapiConfig.credentialId) {
      server.credentialId = vapiConfig.credentialId;
    }
    patchPayload.server = server;
  }

  if (vapiConfig.platformAssistantId) {
    patchPayload.assistantId = vapiConfig.platformAssistantId;
  }

  if (vapiConfig.platformFallbackNumber) {
    patchPayload.fallbackDestination = {
      type: 'number',
      number: vapiConfig.platformFallbackNumber,
    };
  }

  for (const number of numbers) {
    try {
      const response = await fetch(
        `https://api.vapi.ai/phone-number/${number.vapiPhoneNumberId}`,
        {
          method: 'PATCH',
          headers: {
            Authorization: `Bearer ${vapiCreds.apiKey}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify(patchPayload),
        }
      );

      if (response.ok) {
        updated++;
      } else {
        failed++;
      }
    } catch {
      failed++;
    }
  }

  return { updated, failed };
}
