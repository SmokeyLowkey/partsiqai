import { prisma } from '@/lib/prisma';

export interface ReceptionistConfig {
  phoneNumberId: string;
  assistantId: string;
  e164: string;
  maxCallDurationSec: number;
  identificationTimeoutSec: number;
  callerRateLimitPerHour: number;
  spamBlocklist: string[];
  businessHoursStart: string; // HH:MM
  businessHoursEnd: string; // HH:MM
  businessHoursTz: string;
}

const DEFAULTS: Record<string, string> = {
  RECEPTIONIST_PHONE_NUMBER_ID: '',
  RECEPTIONIST_ASSISTANT_ID: '',
  RECEPTIONIST_E164: '',
  RECEPTIONIST_MAX_CALL_DURATION_SEC: '120',
  RECEPTIONIST_IDENTIFICATION_TIMEOUT_SEC: '60',
  RECEPTIONIST_CALLER_RATE_LIMIT_PER_HOUR: '5',
  RECEPTIONIST_SPAM_BLOCKLIST: '[]',
  RECEPTIONIST_BUSINESS_HOURS_START: '09:00',
  RECEPTIONIST_BUSINESS_HOURS_END: '17:00',
  RECEPTIONIST_BUSINESS_HOURS_TZ: 'America/New_York',
};

let cached: ReceptionistConfig | null = null;
let cacheTimestamp = 0;
const CACHE_TTL_MS = 60_000;

export async function getReceptionistConfig(): Promise<ReceptionistConfig> {
  const now = Date.now();
  if (cached && now - cacheTimestamp < CACHE_TTL_MS) {
    return cached;
  }

  const rows = await prisma.systemSetting.findMany({
    where: { key: { in: Object.keys(DEFAULTS) } },
    select: { key: true, value: true },
  });

  const map = new Map<string, string>();
  for (const [k, v] of Object.entries(DEFAULTS)) map.set(k, v);
  for (const row of rows) map.set(row.key, row.value);

  let spamBlocklist: string[] = [];
  try {
    const parsed = JSON.parse(map.get('RECEPTIONIST_SPAM_BLOCKLIST') || '[]');
    if (Array.isArray(parsed)) spamBlocklist = parsed;
  } catch {
    // ignore — keep empty
  }

  cached = {
    phoneNumberId: map.get('RECEPTIONIST_PHONE_NUMBER_ID') || '',
    assistantId: map.get('RECEPTIONIST_ASSISTANT_ID') || '',
    e164: map.get('RECEPTIONIST_E164') || '',
    maxCallDurationSec: parseInt(map.get('RECEPTIONIST_MAX_CALL_DURATION_SEC') || '120', 10),
    identificationTimeoutSec: parseInt(map.get('RECEPTIONIST_IDENTIFICATION_TIMEOUT_SEC') || '60', 10),
    callerRateLimitPerHour: parseInt(map.get('RECEPTIONIST_CALLER_RATE_LIMIT_PER_HOUR') || '5', 10),
    spamBlocklist,
    businessHoursStart: map.get('RECEPTIONIST_BUSINESS_HOURS_START') || '09:00',
    businessHoursEnd: map.get('RECEPTIONIST_BUSINESS_HOURS_END') || '17:00',
    businessHoursTz: map.get('RECEPTIONIST_BUSINESS_HOURS_TZ') || 'America/New_York',
  };
  cacheTimestamp = now;
  return cached;
}

export function invalidateReceptionistConfigCache(): void {
  cached = null;
  cacheTimestamp = 0;
}

/**
 * Check if the current time is within configured business hours.
 */
export function isWithinBusinessHours(config: ReceptionistConfig, now: Date = new Date()): boolean {
  // Convert "now" to the configured timezone using Intl
  const formatter = new Intl.DateTimeFormat('en-US', {
    timeZone: config.businessHoursTz,
    hour: '2-digit',
    minute: '2-digit',
    hourCycle: 'h23',
  });
  const parts = formatter.formatToParts(now);
  const hour = parseInt(parts.find((p) => p.type === 'hour')?.value || '0', 10);
  const minute = parseInt(parts.find((p) => p.type === 'minute')?.value || '0', 10);
  const nowMinutes = hour * 60 + minute;

  const [startH, startM] = config.businessHoursStart.split(':').map((s) => parseInt(s, 10));
  const [endH, endM] = config.businessHoursEnd.split(':').map((s) => parseInt(s, 10));
  const startMinutes = startH * 60 + startM;
  const endMinutes = endH * 60 + endM;

  return nowMinutes >= startMinutes && nowMinutes < endMinutes;
}
