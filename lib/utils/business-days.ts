/**
 * Business day utility functions
 * Handles calculation of business days (Monday-Friday, excluding weekends)
 */

/**
 * Check if a date is a weekend (Saturday or Sunday)
 */
export function isWeekend(date: Date): boolean {
  const day = date.getDay();
  return day === 0 || day === 6; // Sunday = 0, Saturday = 6
}

/**
 * Add business days to a date (skips weekends)
 * @param date Starting date
 * @param days Number of business days to add
 * @returns New date after adding business days
 */
export function addBusinessDays(date: Date, days: number): Date {
  const result = new Date(date);
  let addedDays = 0;

  while (addedDays < days) {
    result.setDate(result.getDate() + 1);
    if (!isWeekend(result)) {
      addedDays++;
    }
  }

  return result;
}

/**
 * Get the number of business days between two dates
 * @param start Start date
 * @param end End date
 * @returns Number of business days between the dates
 */
export function getBusinessDaysBetween(start: Date, end: Date): number {
  let count = 0;
  const current = new Date(start);

  // Ensure we're comparing dates without time
  current.setHours(0, 0, 0, 0);
  const endDate = new Date(end);
  endDate.setHours(0, 0, 0, 0);

  while (current < endDate) {
    current.setDate(current.getDate() + 1);
    if (!isWeekend(current)) {
      count++;
    }
  }

  return count;
}

/**
 * Check if a follow-up is due based on expected response date
 * @param expectedResponseBy The expected response date
 * @param now Current date (optional, defaults to now)
 * @returns true if follow-up is due (expectedResponseBy has passed)
 */
export function isFollowUpDue(expectedResponseBy: Date, now: Date = new Date()): boolean {
  return now > expectedResponseBy;
}

/**
 * Get the number of days since a date (calendar days, not business days)
 * @param date The date to compare against
 * @param now Current date (optional, defaults to now)
 * @returns Number of days elapsed
 */
export function getDaysSince(date: Date, now: Date = new Date()): number {
  const diffTime = now.getTime() - new Date(date).getTime();
  return Math.floor(diffTime / (1000 * 60 * 60 * 24));
}

/**
 * Format the days elapsed as a human-readable string
 * @param days Number of days
 * @returns Formatted string like "3 days ago" or "today"
 */
export function formatDaysElapsed(days: number): string {
  if (days === 0) return 'today';
  if (days === 1) return '1 day ago';
  return `${days} days ago`;
}
