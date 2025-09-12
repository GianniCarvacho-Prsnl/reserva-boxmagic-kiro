# Project Structure & Organization

## Root Directory Layout

```
├── src/                    # Source code (TypeScript)
├── api/                    # Vercel serverless functions
├── tests/                  # Test suites (unit + integration)
├── dist/                   # Compiled JavaScript output
├── .kiro/                  # Kiro IDE configuration
├── Imagenes/               # Documentation screenshots
└── node_modules/           # Dependencies
```

## Source Code Architecture (`src/`)

### Core Business Logic (`src/core/`)
- `ReservationBot.ts` - Main orchestrator class
- `WebAutomationEngine.ts` - Playwright browser automation
- `TimingController.ts` - Precise timing and scheduling
- `Logger.ts` - Comprehensive logging with phases

### Configuration Management (`src/config/`)
- `ConfigManager.ts` - Configuration loading and validation
- `types.ts` - Configuration type definitions
- `index.ts` - Public configuration exports

### Platform Handlers (`src/handlers/`)
- `vercel.ts` - Vercel serverless function handler
- `flyio.ts` - Fly.io Express server handler
- `index.ts` - Common handler utilities

### Type Definitions (`src/types/`)
- `ReservationTypes.ts` - Reservation result and timing types
- `ConfigTypes.ts` - Configuration interfaces
- `ErrorTypes.ts` - Error handling types
- `index.ts` - Consolidated type exports

### Utilities (`src/utils/`)
- `timing.ts` - Date/time utility functions
- `validation.ts` - Input validation helpers
- `webhook.ts` - Webhook notification utilities
- `constants.ts` - Application constants
- `RetryStrategy.ts` - Retry logic implementation
- `EdgeCaseHandler.ts` - Edge case handling

## Entry Points

- `src/index.ts` - Main CLI entry point
- `src/server.ts` - Express server entry point
- `api/reserve.ts` - Vercel function entry point

## Test Organization (`tests/`)

### Unit Tests (`tests/unit/`)
- Component-level testing
- Mock external dependencies
- Fast execution (< 1s per test)

### Integration Tests (`tests/integration/`)
- End-to-end workflow testing
- Real browser automation (when needed)
- Slower execution but comprehensive

## Configuration Files

### Build & Development
- `package.json` - Dependencies and scripts
- `tsconfig.json` - TypeScript compiler configuration
- `vitest.config.ts` - Test runner configuration
- `.eslintrc.json` - Code linting rules

### Deployment
- `vercel.json` - Vercel platform configuration
- `fly.toml` - Fly.io deployment configuration
- `Dockerfile` - Container build instructions

### Environment
- `.env.example` - Environment variable template
- `config.example.json` - Configuration file template
- `webhook-config.example.json` - Webhook setup example

## Import Conventions

### File Extensions
- Use `.js` extensions in imports (TypeScript requirement for ES modules)
- Example: `import { Logger } from './Logger.js'`

### Path Structure
- Relative imports within same directory: `./filename.js`
- Parent directory imports: `../directory/filename.js`
- Absolute imports from src root: Use relative paths

### Export Patterns
- Named exports preferred over default exports
- Index files (`index.ts`) for clean public APIs
- Re-export pattern: `export * from './module.js'`

## Naming Conventions

### Files & Directories
- PascalCase for class files: `ReservationBot.ts`
- camelCase for utility files: `timing.ts`
- kebab-case for configuration: `config.example.json`

### Code Elements
- PascalCase for classes and interfaces: `ReservationBot`, `ReservationConfig`
- camelCase for functions and variables: `executeReservation`, `targetTime`
- UPPER_SNAKE_CASE for constants: `DEFAULT_TIMEOUT`, `MAX_RETRIES`

## Architecture Patterns

### Dependency Injection
- Constructor injection for core dependencies
- Singleton pattern for ConfigManager
- Factory pattern for platform handlers

### Error Handling
- Custom error types in `src/types/ErrorTypes.ts`
- Comprehensive logging at all levels
- Graceful degradation with retry logic

### Configuration Management
- Environment variables for secrets
- JSON files for complex configuration
- Runtime validation with detailed error messages

### Resource Management
- Automatic cleanup of browser resources
- Connection pooling not needed (single-user)
- Memory-conscious operations for serverless deployment