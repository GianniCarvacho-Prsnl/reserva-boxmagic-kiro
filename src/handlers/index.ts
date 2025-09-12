// Platform-specific handlers exports
// Provides unified interface for both Vercel and Fly.io deployments

export { default as vercelHandler } from './vercel.js';
export { createFlyioApp, startFlyioServer, flyioHandler } from './flyio.js';