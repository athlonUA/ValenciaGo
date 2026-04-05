# ADR-002: PostgreSQL for Event Storage

## Status
Accepted

## Context
Need a database for storing events with full-text search, fuzzy matching, and structured queries by date range, category, and price.

## Decision
Use PostgreSQL with pg_trgm extension for trigram similarity search and tsvector for full-text search. Single events table with JSONB for raw payloads.

## Consequences
- Rich query capabilities (trigram, FTS, ILIKE) without external search engine
- pg_trgm extension required (standard in most PostgreSQL distributions)
- Single-table design is simple but may need partitioning at 1M+ rows
- JSONB raw_payload preserves source-specific data without schema changes
