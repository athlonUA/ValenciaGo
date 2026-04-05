const ALLOWED_DOMAINS: Record<string, string[]> = {
  visitvalencia: ['www.visitvalencia.com', 'visitvalencia.com'],
  meetup: ['www.meetup.com', 'meetup.com'],
  eventbrite: ['www.eventbrite.com', 'www.eventbrite.es', 'www.eventbriteapi.com', 'eventbrite.com', 'eventbrite.es'],
  valenciacf: ['www.valenciacf.com', 'valenciacf.com'],
};

export function isAllowedUrl(url: string, source: string): boolean {
  const domains = ALLOWED_DOMAINS[source];
  if (!domains) return false;
  try {
    const parsed = new URL(url);
    return domains.some(d => parsed.hostname === d || parsed.hostname.endsWith('.' + d));
  } catch {
    return false;
  }
}
