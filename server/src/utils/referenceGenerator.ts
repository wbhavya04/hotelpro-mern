import crypto from 'crypto';

export function generateBookingReference(date: Date = new Date()): string {
  const y = date.getUTCFullYear();
  const m = String(date.getUTCMonth() + 1).padStart(2, '0');
  const d = String(date.getUTCDate()).padStart(2, '0');
  const suffix = crypto.randomBytes(2).toString('hex').toUpperCase();
  return `HPR-${y}${m}${d}-${suffix}`;
}

export function generateInvoiceNumber(date: Date = new Date()): string {
  const y = date.getUTCFullYear();
  const suffix = crypto.randomBytes(3).toString('hex').toUpperCase();
  return `INV-HPR-${y}-${suffix}`;
}

/**
 * Generates an array of UTC date strings ('YYYY-MM-DD') for each night in [checkIn, checkOut).
 */
export function getStayNightStrings(checkInInput: string | Date, checkOutInput: string | Date): string[] {
  const start = new Date(checkInInput);
  const end = new Date(checkOutInput);
  const startUtc = Date.UTC(start.getUTCFullYear(), start.getUTCMonth(), start.getUTCDate());
  const endUtc = Date.UTC(end.getUTCFullYear(), end.getUTCMonth(), end.getUTCDate());

  const nights: string[] = [];
  const oneDayMs = 24 * 60 * 60 * 1000;
  for (let ts = startUtc; ts < endUtc; ts += oneDayMs) {
    const dt = new Date(ts);
    const y = dt.getUTCFullYear();
    const m = String(dt.getUTCMonth() + 1).padStart(2, '0');
    const d = String(dt.getUTCDate()).padStart(2, '0');
    nights.push(`${y}-${m}-${d}`);
  }
  return nights;
}
