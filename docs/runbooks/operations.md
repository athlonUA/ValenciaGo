# Operations Runbook

## Manual Ingestion
```bash
npm run ingest
```
Triggers a one-time ingestion from all enabled sources. Useful for testing or catching up after downtime.

## Database Migrations

### Run migrations
```bash
npm run migrate
```
Migrations run automatically on startup. Manual run useful for debugging.

### Rollback last migration
```bash
npm run migrate:down
```

## Troubleshooting

### Bot not responding
1. Check bot is running: `docker compose logs app`
2. Verify Telegram token: check `.env` has valid `TELEGRAM_BOT_TOKEN`
3. Check rate limits: search logs for "rate limit"
4. Restart: `docker compose restart app`

### Ingestion failing
1. Check adapter logs: search for `[adapter-name]` in logs
2. Common causes:
   - Website structure changed (HTML selectors broken)
   - Rate limiting by source (increase DELAY_MS)
   - Network timeout (check `timeout: 15000` in adapter)
3. Test single adapter: modify `src/cli/ingest.ts` temporarily

### Database connection issues
1. Check PostgreSQL is running: `docker compose ps db`
2. Verify connection: `docker compose exec db pg_isready -U events`
3. Check pool exhaustion: search logs for "connection timeout"
4. Pool config: `src/db/pool.ts` — max 20 connections, 5s timeout

### Old events accumulating
Archive runs automatically every 6 hours (after ingestion). Events older than 365 days are deleted.
To run manually:
```sql
SELECT archive_old_events(365);
```

### User data deletion (GDPR)
Users can run `/deletedata` in the bot. For manual deletion:
```sql
DELETE FROM liked_events WHERE user_id = <telegram_user_id>;
```

## Monitoring
- Logs: structured JSON via Pino, component-tagged
- Filter by component: `docker compose logs app | jq 'select(.component == "ingest")'`
- Filter errors: `docker compose logs app | jq 'select(.level >= 50)'`
