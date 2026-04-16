import { prisma } from '@/lib/prisma';

export interface PhonePoolConfig {
  minPoolSize: number;
  dailyCap: number;
  defaultAreaCode: string | null;
  degradedThreshold: number;
  blockedThreshold: number;
  supplierDailyCallLimit: number;
}

export interface VapiPlatformConfig {
  platformAssistantId: string;
  serverUrl: string;
  credentialId: string;
  platformFallbackNumber: string;
}

export interface VoiceConfig {
  provider: string;
  voiceId: string;
}

const DEFAULTS: Record<string, string> = {
  PHONE_POOL_MIN_SIZE: '3',
  PHONE_POOL_DAILY_CAP: '50',
  PHONE_POOL_DEFAULT_AREA_CODE: '',
  PHONE_POOL_DEGRADED_THRESHOLD: '3',
  PHONE_POOL_BLOCKED_THRESHOLD: '10',
  PHONE_POOL_SUPPLIER_DAILY_LIMIT: '1',
  VAPI_PLATFORM_ASSISTANT_ID: '',
  VAPI_SERVER_URL: '',
  VAPI_CREDENTIAL_ID: '',
  VAPI_PLATFORM_FALLBACK_NUMBER: '',
  VAPI_VOICE_POOL: '[{"provider":"azure","voiceId":"andrew"}]',
};

let cachedSettings: Map<string, string> | null = null;
let cacheTimestamp = 0;
const CACHE_TTL_MS = 60_000; // 60 seconds

async function getSettings(): Promise<Map<string, string>> {
  const now = Date.now();
  if (cachedSettings && now - cacheTimestamp < CACHE_TTL_MS) {
    return cachedSettings;
  }

  const rows = await prisma.systemSetting.findMany({
    where: {
      key: { in: Object.keys(DEFAULTS) },
    },
    select: { key: true, value: true },
  });

  const map = new Map<string, string>();
  for (const [key, defaultVal] of Object.entries(DEFAULTS)) {
    map.set(key, defaultVal);
  }
  for (const row of rows) {
    map.set(row.key, row.value);
  }

  cachedSettings = map;
  cacheTimestamp = now;
  return map;
}

function get(settings: Map<string, string>, key: string): string {
  return settings.get(key) || DEFAULTS[key] || '';
}

export async function getPhonePoolConfig(): Promise<PhonePoolConfig> {
  const s = await getSettings();
  return {
    minPoolSize: parseInt(get(s, 'PHONE_POOL_MIN_SIZE'), 10),
    dailyCap: parseInt(get(s, 'PHONE_POOL_DAILY_CAP'), 10),
    defaultAreaCode: get(s, 'PHONE_POOL_DEFAULT_AREA_CODE') || null,
    degradedThreshold: parseInt(get(s, 'PHONE_POOL_DEGRADED_THRESHOLD'), 10),
    blockedThreshold: parseInt(get(s, 'PHONE_POOL_BLOCKED_THRESHOLD'), 10),
    supplierDailyCallLimit: parseInt(get(s, 'PHONE_POOL_SUPPLIER_DAILY_LIMIT'), 10),
  };
}

export async function getVapiPlatformConfig(): Promise<VapiPlatformConfig> {
  const s = await getSettings();
  return {
    platformAssistantId: get(s, 'VAPI_PLATFORM_ASSISTANT_ID'),
    serverUrl: get(s, 'VAPI_SERVER_URL'),
    credentialId: get(s, 'VAPI_CREDENTIAL_ID'),
    platformFallbackNumber: get(s, 'VAPI_PLATFORM_FALLBACK_NUMBER'),
  };
}

export async function getVoicePool(): Promise<VoiceConfig[]> {
  const s = await getSettings();
  const raw = get(s, 'VAPI_VOICE_POOL');
  try {
    const parsed = JSON.parse(raw);
    if (Array.isArray(parsed) && parsed.length > 0) {
      return parsed;
    }
  } catch {
    // fall through to default
  }
  return [{ provider: 'azure', voiceId: 'andrew' }];
}

/** Invalidate cache — call after admin updates SystemSettings */
export function invalidatePhonePoolConfigCache(): void {
  cachedSettings = null;
  cacheTimestamp = 0;
}
