/**
 * Timestamps on the live service carry microsecond precision,
 * e.g. "2026-10-28T15:00:41.895585Z". ISODate#toISOString() only gives
 * milliseconds, so we pad to six fractional digits to match byte for byte.
 */
export function isoMicro(date = new Date()) {
  const d = date instanceof Date ? date : new Date(date);
  return d.toISOString().replace(/\.(\d{3})Z$/, '.$1000Z');
}

export function nowMicro() {
  return isoMicro(new Date());
}
