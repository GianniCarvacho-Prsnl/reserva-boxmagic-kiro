# CrossFit Reservation Bot

Automated CrossFit class reservation bot for BoxMagic with precise timing execution.

## Project Structure

```
src/
├── core/           # Core business logic
├── handlers/       # Platform-specific handlers (Vercel, Fly.io)
├── config/         # Configuration management
├── types/          # TypeScript type definitions
└── utils/          # Utility functions

tests/
├── unit/           # Unit tests
└── integration/    # Integration tests
```

## Setup

1. Install dependencies:
```bash
npm install
```

2. Install Playwright browsers:
```bash
npx playwright install
```

3. Copy environment configuration:
```bash
cp .env.example .env
```

4. Fill in your BoxMagic credentials in `.env`

## Development

```bash
# Run in development mode
npm run dev

# Build the project
npm run build

# Run tests
npm test

# Run tests in watch mode
npm run test:watch

# Lint code
npm run lint
```

## Implementation Status

This project is currently in development. Components will be implemented according to the task list in `.kiro/specs/crossfit-reservation-bot/tasks.md`.

## Requirements

- Node.js >= 18.0.0
- npm or yarn
- BoxMagic account credentials