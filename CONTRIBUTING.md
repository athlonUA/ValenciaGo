# Contributing to Valencia Events

## Getting Started

1. Fork the repository
2. Clone your fork
3. Install dependencies: `npm install`
4. Copy environment: `cp .env.example .env`
5. Start database: `docker compose up -d db`
6. Run in development: `npm run dev`

## Development Workflow

### Commands
- `npm run dev` — Start with hot reload (tsx)
- `npm run build` — Compile TypeScript
- `npm test` — Run tests
- `npm run test:watch` — Run tests in watch mode
- `npm run lint` — Type check + ESLint
- `npm run lint:fix` — Auto-fix ESLint issues
- `npm run ingest` — Manual ingestion run

### Adding a New Source Adapter

1. Create `src/adapters/yoursource.ts` implementing the `SourceAdapter` interface
2. Register it in `src/adapters/registry.ts`
3. Add tests in `src/adapters/yoursource.test.ts`
4. Run `npm test` and `npm run lint`

### Code Quality

- TypeScript strict mode is enabled
- ESLint and Prettier are configured
- All utility functions must have tests
- Use the structured logger (`createLogger`) instead of `console.log`

### Pull Request Process

1. Create a feature branch from `main`
2. Make your changes with tests
3. Ensure `npm run lint` and `npm test` pass
4. Submit a PR with a clear description
5. CI will run type-check, lint, test, and build automatically
