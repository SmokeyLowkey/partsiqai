import { prisma } from '@/lib/prisma';
import Twilio from 'twilio';
import { CredentialsManager } from '@/lib/services/credentials/credentials-manager';
import { getVapiPlatformConfig } from './config';
import { getReceptionistConfig } from '@/lib/voip/receptionist/config';

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
 * Naming convention for PartsIQ-owned Vapi phone numbers. The sync importer
 * uses this prefix to distinguish our numbers from any other apps that share
 * the same Vapi account.
 */
const PARTSIQ_NAME_PREFIX = 'PARTSIQ_POOL_';

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
  const receptionistConfig = await getReceptionistConfig();

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
    // Always prefix with PARTSIQ_POOL_ so the sync importer can identify our numbers
    // and skip numbers belonging to other apps on the same Vapi account.
    const labelSuffix = options.label || `${areaCode}_${Date.now()}`;
    const vapiName = labelSuffix.startsWith(PARTSIQ_NAME_PREFIX)
      ? labelSuffix
      : `${PARTSIQ_NAME_PREFIX}${labelSuffix}`;

    const vapiPayload: Record<string, unknown> = {
      provider: 'twilio',
      number: e164,
      twilioAccountSid: twilioCreds.accountSid,
      twilioAuthToken: twilioCreds.authToken,
      name: vapiName,
      smsEnabled: false,
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

    // Inbound assistant — pool numbers route inbound (supplier callbacks) to the
    // receptionist assistant. Outbound calls override this via assistantId in the
    // createCall payload, so this only affects inbound.
    const inboundAssistantId = receptionistConfig.assistantId || vapiConfig.platformAssistantId;
    if (inboundAssistantId) {
      vapiPayload.assistantId = inboundAssistantId;
    }

    // Fallback destination — if the receptionist assistant fails, forward the call
    // to the receptionist's PSTN number as a safety net.
    const fallbackNumber = receptionistConfig.e164 || vapiConfig.platformFallbackNumber;
    if (fallbackNumber) {
      vapiPayload.fallbackDestination = {
        type: 'number',
        number: fallbackNumber,
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
 * Import phone numbers from Vapi that aren't already in the local pool.
 * Filters strictly to PartsIQ-owned numbers:
 *   1. Name must start with PARTSIQ_POOL_ (the provisioner's naming convention), AND
 *   2. Server URL must match our configured VAPI_SERVER_URL (when set).
 * Numbers belonging to other applications on the same Vapi account are skipped.
 */
async function importNumbersFromVapi(apiKey: string, serverUrl: string): Promise<{ imported: number; skipped: number; failed: number }> {
  const response = await fetch('https://api.vapi.ai/phone-number', {
    method: 'GET',
    headers: {
      Authorization: `Bearer ${apiKey}`,
    },
  });

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`Failed to fetch numbers from Vapi (${response.status}): ${error}`);
  }

  const vapiNumbers = await response.json() as Array<{
    id: string;
    number?: string;
    provider?: string;
    name?: string;
    status?: string;
    server?: { url?: string };
  }>;

  let imported = 0;
  let skipped = 0;
  let failed = 0;

  for (const vn of vapiNumbers) {
    const e164 = vn.number;
    if (!e164) {
      failed++;
      continue;
    }

    // PartsIQ-only filter: name must use our naming convention
    const name = vn.name || '';
    if (!name.startsWith(PARTSIQ_NAME_PREFIX)) {
      console.log(`[Provisioner] Skipping Vapi number ${vn.id} (${e164}) — name "${name}" does not start with "${PARTSIQ_NAME_PREFIX}"`);
      skipped++;
      continue;
    }

    // Additional defense-in-depth: server URL must match ours when configured
    const numberServerUrl = vn.server?.url || '';
    if (serverUrl && numberServerUrl !== serverUrl) {
      console.log(`[Provisioner] Skipping Vapi number ${vn.id} (${e164}) — server URL "${numberServerUrl}" does not match "${serverUrl}"`);
      skipped++;
      continue;
    }

    try {
      await prisma.vapiPhoneNumber.upsert({
        where: { vapiPhoneNumberId: vn.id },
        update: {
          vapiStatus: vn.status || null,
        },
        create: {
          vapiPhoneNumberId: vn.id,
          e164,
          areaCode: e164.startsWith('+1') ? e164.slice(2, 5) : null,
          provider: 'TWILIO',
          vapiStatus: vn.status || null,
        },
      });
      imported++;
    } catch (error) {
      console.error(`[Provisioner] Failed to import Vapi number ${vn.id} (${e164}):`, error);
      failed++;
    }
  }

  return { imported, skipped, failed };
}

/**
 * Sync all pool numbers: import from Vapi, then update config on active numbers.
 * 1. Fetches all phone numbers from Vapi and upserts into local DB
 * 2. PATCHes Vapi config on each active number (server URL, assistant, fallback)
 */
export async function syncPoolConfig(): Promise<{ imported: number; updated: number; failed: number }> {
  const credentialsManager = new CredentialsManager();
  const vapiCreds = await credentialsManager.getCredentialsWithFallback<VapiCredentials>(
    'system-platform-credentials',
    'VAPI'
  );

  if (!vapiCreds?.apiKey) {
    throw new Error('Vapi API key not configured');
  }

  // Get Vapi platform config (used for both import filtering and config patching)
  const vapiConfig = await getVapiPlatformConfig();
  const receptionistConfig = await getReceptionistConfig();

  // Step 1: Import/discover numbers from Vapi (filtered by our server URL)
  const importResult = await importNumbersFromVapi(vapiCreds.apiKey, vapiConfig.serverUrl);

  // Step 2: Update config on all active numbers
  const numbers = await prisma.vapiPhoneNumber.findMany({
    where: { isActive: true },
    select: { vapiPhoneNumberId: true },
  });

  let updated = 0;
  let failed = importResult.failed;

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

  // Inbound assistant — receptionist (pool numbers route inbound to receptionist)
  const syncInboundAssistantId = receptionistConfig.assistantId || vapiConfig.platformAssistantId;
  if (syncInboundAssistantId) {
    patchPayload.assistantId = syncInboundAssistantId;
  }

  // Fallback destination — receptionist PSTN number as safety net if the assistant fails
  const syncFallbackNumber = receptionistConfig.e164 || vapiConfig.platformFallbackNumber;
  if (syncFallbackNumber) {
    patchPayload.fallbackDestination = {
      type: 'number',
      number: syncFallbackNumber,
    };
  }

  // Only PATCH if there's config to push
  if (Object.keys(patchPayload).length > 0) {
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
  } else {
    updated = numbers.length;
  }

  return { imported: importResult.imported, updated, failed };
}
