/**
 * Normalizes Philippine mobile numbers to E.164 (+639XXXXXXXXX).
 * Accepts the ways people type them: 09171234567, 9171234567, +63 917 123 4567, 63-917-123-4567.
 * Returns null for anything that isn't a PH mobile number.
 */
export function normalizePhMobile(input: string): string | null {
  const digits = input.replace(/[^\d+]/g, "").replace(/(?!^)\+/g, "");
  let local: string;
  if (digits.startsWith("+63")) local = digits.slice(3);
  else if (digits.startsWith("63") && digits.length === 12) local = digits.slice(2);
  else if (digits.startsWith("0")) local = digits.slice(1);
  else local = digits;
  return /^9\d{9}$/.test(local) ? "+63" + local : null;
}

/** +639171234567 → 0917 123 4567 (how Filipinos write it). */
export function formatPhMobile(e164: string): string {
  const m = /^\+63(\d{3})(\d{3})(\d{4})$/.exec(e164);
  return m ? `0${m[1]} ${m[2]} ${m[3]}` : e164;
}

/** +639171234567 → 0917 ••• 4567, for showing which number a code went to. */
export function maskPhMobile(e164: string): string {
  const m = /^\+63(\d{3})\d{3}(\d{4})$/.exec(e164);
  return m ? `0${m[1]} ••• ${m[2]}` : e164;
}
