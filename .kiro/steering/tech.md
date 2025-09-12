# Technology Stack & Build System

## Core Technologies

- **Runtime**: Node.js 18+ (ES Modules)
- **Language**: TypeScript 5.3+ with strict configuration
- **Web Automation**: Playwright (Chromium browser)
- **Testing**: Vitest with coverage reporting
- **Linting**: ESLint with TypeScript rules

## Key Dependencies

- **Timing**: `date-fns` and `date-fns-tz` for precise date/time handling
- **Server**: Express.js for HTTP endpoints
- **Environment**: `dotenv` for configuration management
- **Browser**: Playwright for web automation

## Build System

### Development Commands
```bash
# Development with hot reload
npm run dev              # Run main bot
npm run dev:server       # Run Express server

# Building
npm run build           # Compile TypeScript to dist/
npm run clean           # Remove dist/ folder

# Testing
npm test                # Run all tests once
npm run test:watch      # Run tests in watch mode

# Code Quality
npm run lint            # ESLint validation
```

### Deployment Commands
```bash
# Vercel (Serverless Functions + Cron)
npm run vercel:dev      # Local Vercel development
npm run vercel:deploy   # Deploy to production

# Fly.io (Container + Express Server)
npm run fly:deploy      # Deploy to Fly.io
npm run fly:logs        # View application logs
```

## TypeScript Configuration

- **Target**: ES2022 with ESNext modules
- **Strict Mode**: Enabled with comprehensive type checking
- **Output**: `dist/` directory with source maps and declarations
- **Module Resolution**: Node.js style with `.js` extensions for imports

## Browser Configuration

- **Headless Mode**: Production runs headless, development can run headed
- **Timeout**: 30-second default timeouts for web operations
- **Browser**: Chromium only (consistent across environments)

## Environment Variables

```bash
# Required
BOXMAGIC_EMAIL=user@example.com
BOXMAGIC_PASSWORD=password
TIMEZONE=America/Santiago

# Optional
WEBHOOK_URL=https://webhook.site/...
BROWSER_HEADLESS=true
NOTIFICATIONS_ENABLED=true
NODE_ENV=production
```

## Deployment Platforms

### Vercel (Primary)
- Serverless functions with cron scheduling
- Automatic builds from Git
- Environment variables via Vercel dashboard
- Regional deployment: `scl1` (Santiago)

### Fly.io (Alternative)
- Container deployment with Dockerfile
- Express server with health checks
- Manual cron setup required (external service)
- Regional deployment: `scl` (Santiago)

## Performance Considerations

- **Memory**: 512MB-1GB allocation for browser operations
- **Timeout**: 60-second function timeout for complete reservation flow
- **Concurrency**: Single reservation execution (no parallel processing)
- **Resource Cleanup**: Automatic browser cleanup after each execution