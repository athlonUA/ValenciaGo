# ADR-001: Content Hash Deduplication

## Status
Accepted

## Context
Events are ingested from multiple sources (Meetup, Eventbrite, Visit Valencia, Valencia CF). The same event may appear on multiple platforms with different IDs, titles, and descriptions.

## Decision
Use SHA-256 content hashing of `(normalized_title, date, city)` for cross-source deduplication. A UNIQUE constraint on `content_hash` in PostgreSQL enforces this at the database level.

## Consequences
- Same event from different sources is detected and merged
- Title normalization (accent stripping, word sorting) handles minor differences
- Events on the same day with identical normalized titles will collide — acceptable tradeoff for this domain
- Venue is intentionally excluded from the hash to catch events with venue name variations
