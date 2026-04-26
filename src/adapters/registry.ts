import { VisitValenciaAdapter } from './visitvalencia.js';
import { MeetupAdapter } from './meetup.js';
import { EventbriteAdapter } from './eventbrite.js';
import { ValenciaCFAdapter } from './valenciacf.js';
import { ValenciaEsAdapter } from './valenciaes.js';
import { IvcAdapter } from './ivc.js';
import type { SourceAdapter } from '../types/index.js';

export function createAdapters(opts: { eventbriteToken?: string }): SourceAdapter[] {
  return [
    new VisitValenciaAdapter(),
    new MeetupAdapter(),
    new EventbriteAdapter(opts.eventbriteToken),
    new ValenciaCFAdapter(),
    new ValenciaEsAdapter(),
    new IvcAdapter(),
  ];
}
