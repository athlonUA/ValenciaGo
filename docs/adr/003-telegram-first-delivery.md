# ADR-003: Telegram Bot as Primary Interface

## Status
Accepted

## Context
Need a user-facing interface for event discovery in Valencia. Options: web app, mobile app, Telegram bot, Discord bot.

## Decision
Telegram bot via grammY framework. Supports inline keyboards for navigation, voice messages for search, and per-user state (liked events).

## Consequences
- No web server needed — bot uses long polling
- Health checks must use Docker HEALTHCHECK rather than HTTP endpoints
- Rich UI limited to Telegram's inline keyboard capabilities (3 events per page)
- Voice search requires OpenAI Whisper integration
- User identity is Telegram user ID (no custom auth needed)
