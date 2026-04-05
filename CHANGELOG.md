# Changelog

## [Unreleased]

### Added
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
- Docker: non-root user, HEALTHCHECK, resource limits, log rotation
- Connection pool: increased to 20 max, added timeouts
- Unified row-to-entity mapping (eliminated 3-way duplication)
- Centralized adapter registration via registry
- Extracted search WHERE clause helper (DRY)

### Fixed
- Timezone bug in getWeekRange (now uses Madrid-aware date math)
- Incomplete HTML escaping (added quote escaping)
- Smart search cache memory leak (added interval cleanup)

### Security
- Removed leaked credentials from git staging
- Added per-user rate limiting
- Added SSRF protection for adapter URL fetching
- Database content_hash UNIQUE constraint (replaces app-level dedup)
- CHECK constraint on event end times
