#!/usr/bin/env node

/**
 * Fly.io server entry point
 * 
 * This file starts the Express server for Fly.io deployment.
 * It can also be used for local development and testing.
 * 
 * Usage:
 * - Production: npm start (via package.json)
 * - Development: npm run dev
 * - Direct: node dist/server.js
 */

import { startFlyioServer } from './handlers/flyio.js';
import { Logger } from './core/Logger.js';

const logger = new Logger(process.env.WEBHOOK_URL, 'ServerBootstrap');

// Get port from environment or default to 3000
const port = parseInt(process.env.PORT || '3000', 10);

// Validate port
if (isNaN(port) || port < 1 || port > 65535) {
  logger.logError(new Error(`Invalid port: ${process.env.PORT}`));
  process.exit(1);
}

// Log startup information
logger.logInfo('Starting CrossFit Reservation Bot server', {
  port,
  nodeEnv: process.env.NODE_ENV || 'development',
  nodeVersion: process.version,
  platform: process.platform,
  timezone: process.env.TIMEZONE || 'America/Santiago',
  flyRegion: process.env.FLY_REGION || 'local',
  flyAppName: process.env.FLY_APP_NAME || 'local-dev'
});

// Start the server
try {
  startFlyioServer(port);
} catch (error) {
  logger.logError(error as Error, { context: 'ServerBootstrap.startup' });
  process.exit(1);
}