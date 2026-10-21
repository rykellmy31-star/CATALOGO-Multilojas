/** Intervalo semiaberto [início, fim) de exibição de um banner. */
function timestamp(value: string): number {
  // Datas legadas do SQLite são UTC, embora não tragam o sufixo Z.
  const normalized = /^\d{4}-\d\d-\d\d \d\d:\d\d:\d\d$/.test(value)
    ? value.replace(' ', 'T') + 'Z'
    : value;
  return Date.parse(normalized);
}

export function isValidBannerSchedule(
  startsAt: string | null | undefined,
  endsAt: string | null | undefined
): boolean {
  if (!startsAt && !endsAt) return true;
  if (startsAt && !Number.isFinite(timestamp(startsAt))) return false;
  if (endsAt && !Number.isFinite(timestamp(endsAt))) return false;
  return !startsAt || !endsAt || timestamp(startsAt) < timestamp(endsAt);
}
