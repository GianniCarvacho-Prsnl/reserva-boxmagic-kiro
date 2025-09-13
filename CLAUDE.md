# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Development Commands

### Core Development
```bash
# Development with hot reload
npm run dev              # Run direct execution (src/index.ts)
npm run dev:server       # Run server mode (src/server.ts)

# Build and production
npm run build            # Compile TypeScript to dist/
npm run start           # Run built application (dist/index.js)
npm run start:server    # Run built server (dist/server.js)

# Testing
npm test                # Run tests with Vitest
npm run test:watch      # Run tests in watch mode
npm run lint            # Lint TypeScript files with ESLint

# Platform deployment
npm run vercel:dev      # Run Vercel development server
npm run vercel:deploy   # Deploy to Vercel
npm run fly:deploy      # Deploy to Fly.io
npm run fly:logs        # View Fly.io logs
```

### Playwright Commands
```bash
# Install required browsers (run after npm install)
npx playwright install
```

## Architecture Overview

This is a CrossFit class reservation bot for BoxMagic with precise timing execution capabilities.

### Core Architecture Components

**Main Orchestration:**
- `ReservationBot` (src/core/ReservationBot.ts) - Main orchestrator class that coordinates all components
- Handles complete reservation flow: preparation → critical timing → verification
- Implements retry logic and comprehensive error handling

**Web Automation:**
- `WebAutomationEngine` (src/core/WebAutomationEngine.ts) - Playwright-based automation with anti-detection
- Contains BoxMagic-specific selectors and navigation logic
- Implements both standard and ultra-fast reservation execution methods

**Timing Control:**
- `TimingController` (src/core/TimingController.ts) - Millisecond-precision timing for exact reservation execution
- Handles timezone-aware scheduling and preparation timing calculations

**Configuration Management:**
- `ConfigManager` (src/config/ConfigManager.ts) - Loads from environment variables and config.json
- Supports both full config and per-schedule filtering for serverless functions

**Platform Handlers:**
- `src/handlers/vercel.ts` - Vercel serverless function handler
- `src/handlers/flyio.ts` - Fly.io application server handler
- Unified API interface across both platforms

### Key Requirements Implementation

The bot implements the "25-hour rule" for BoxMagic reservations:
1. **Preparation Phase**: Login, navigation, and positioning (30s buffer before target time)
2. **Critical Timing**: Execute reservation at exact moment (millisecond precision)  
3. **Verification Phase**: Confirm success and handle different failure types
4. **Retry Logic**: Single immediate retry for failed attempts

### Configuration Files

- `config.json` - Reservation schedules (not committed, use config.example.json)
- `.env` - Credentials and environment variables
- `vercel.json` - Vercel deployment with cron scheduling
- `webhook-config.example.json` - Webhook notification examples

### Testing Structure

- `tests/unit/` - Unit tests for individual components
- `tests/integration/` - Integration tests for web automation and timing
- Uses Vitest as test runner with proper ESM support

### Important Development Notes

- **ES Modules**: Project uses ESM with `.js` imports in TypeScript files
- **Timing Critical**: The core execution path is optimized for millisecond-level accuracy
- **Anti-Detection**: Browser configuration specifically tuned to avoid BoxMagic automation detection
- **Multi-Platform**: Same codebase supports both Vercel serverless and Fly.io persistent server deployment
- **BoxMagic Specific**: Web selectors and logic are highly specific to BoxMagic's current UI structure

### Environment Variables Required

```bash
BOXMAGIC_EMAIL=your-email@example.com
BOXMAGIC_PASSWORD=your-password
WEBHOOK_URL=https://your-webhook-endpoint
TIMEZONE=America/Santiago
BROWSER_HEADLESS=true
NOTIFICATIONS_ENABLED=true
```

When working on timing-critical code or web automation components, always test with actual BoxMagic credentials in a development environment first.