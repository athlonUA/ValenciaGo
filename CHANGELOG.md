# Changelog

## [Unreleased]

### Added
- **IVC adapter** (`ivc.gva.es`) — Generalitat cultural programming (Teatre Principal, Rialto, Filmoteca), filters out non-València-city venues
- **Ayuntamiento de València adapter** (`valencia.es`) — implemented but disabled; the agenda listing is rendered by a Liferay portlet that requires JS execution
- **Eventbrite second pass** with `price=free` filter to surface free city festivals that rank below the paid/promoted cut-off; `MAX_PAGES` raised to 10
- Shared `ddmmyyyyToMadridIso` helper in `src/utils/dates.ts` with proper Intl-based DST detection (correct for the late-March / late-October DST boundary days)
- 24 new tests (DST boundaries, IVC `isUntil` branch, calendar overflow validation, sourceId collision, IVC description extraction)
- Structured logging with Pino
- Rate limiting on Telegram bot (15 actions/30s per user)
- Input validation on search queries (200 char max)
- Voice file size validation (5MB max)
- Database transaction safety for ingestion and AI summarization
- Parallel adapter execution via Promise.allSettled
- SQL-level pagination for liked events
- 91 unit tests across 5 test files
- GitHub Actions CI pipeline
- ESLint + Prettier configuration
- SSRF domain allowlists for adapter URL validation
- GDPR user data deletion (/deletedata command)
- Data archival function for old events
- Scheduler overlap prevention
- Graceful shutdown with 10s timeout

### Changed
- **Visit Valencia adapter switched to Spanish listing** (`/agenda-valencia` instead of `/en/events-valencia`) — the EN listing carries ~half as many events; municipal festivals like TastArròs and FestIN are ES-only
- Date-range parser now handles Spanish "Del DD/MM/YYYY al DD/MM/YYYY" cards (multi-line collapse, word-boundary stop tokens) in addition to the legacy English format
- Detail-page enrichment matches both English (`price`/`place`) and Spanish (`precio`/`lugar`) labels
- Upsert now refreshes `language` and `source_url` (previously stuck on initial values, leaving rows pointing at stale EN URLs after locale switches)
- Upsert `ends_at` reset is conditional: only drops the stored value when keeping it would violate `chk_events_end_after_start`
- Docker: non-root user, HEALTHCHECK, resource limits, log rotation
- Connection pool: increased to 20 max, added timeouts
- Unified row-to-entity mapping (eliminated 3-way duplication)
- Centralized adapter registration via registry
- Extracted search WHERE clause helper (DRY)

### Fixed
- **Multi-day events stay visible until they truly end.** Bot queries (`getEventsInRange`, `countEventsInRange`, `searchEvents`) now use a range-overlap predicate (`starts_at < to AND COALESCE(ends_at, starts_at) >= from`) instead of `starts_at`-only filtering. Festivals like TastArròs (Apr 25–26) now surface in `/today` on every day of the run, not just day one
- Visit Valencia date-range parser anchors the END date at 23:59 Madrid (was noon) so a 2-day festival's `ends_at` reflects the actual close-of-day, not midday
- Added `arroz` and `rice` to the `food-drink` classifier vocabulary so events like TastArròs ("la gran fiesta del arroz") classify as food rather than nightlife on the strength of the word "fiesta"
- IVC "hasta el …" ongoing events no longer self-invalidate: `startsAt` is anchored to start-of-day Madrid and `endsAt` to end-of-day Madrid, so re-ingest in the evening of the run's last day no longer trips `chk_events_end_after_start`
- IVC `sourceId` now includes the parent path segment (e.g. `pelicula-742/<slug>`); without this, two films with the same trailing slug from different `pelicula-NNNN` buckets would collide on the unique constraint
- IVC detail-page description extraction (`.resumen` + `.bloque-textos` body); the previous selector list (`.descripcion, .contenido-actividad, ...`) matched nothing on the real DOM
- `inferDate` rejects calendar overflow (Feb 29 in non-leap year, Apr 31 etc.) instead of letting JS silently roll the date forward to the next month
- DST boundary handling for `ddmmyyyyToMadridIso`: events on the late-March or late-October days that flip on the transition Sunday are now stored with the correct `+01:00` / `+02:00` offset
- Timezone bug in getWeekRange (now uses Madrid-aware date math)
- Incomplete HTML escaping (added quote escaping)
- Smart search cache memory leak (added interval cleanup)

### Security
- Removed leaked credentials from git staging
- Added per-user rate limiting
- Added SSRF protection for adapter URL fetching
- Database content_hash UNIQUE constraint (replaces app-level dedup)
- CHECK constraint on event end times
