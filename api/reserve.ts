/**
 * Vercel API endpoint for CrossFit reservation automation
 * 
 * This file is the main entry point for Vercel Functions.
 * It handles all reservation-related operations including:
 * - Single and multiple reservations
 * - Configuration validation
 * - Webhook testing
 * - System status checks
 * 
 * URL patterns:
 * - /api/reserve?scheduleId=xxx - Execute single reservation
 * - /api/reserve?scheduleIds=xxx,yyy - Execute multiple reservations
 * - /api/reserve?validate=true - Validate configuration
 * - /api/reserve?testWebhook=true - Test webhook
 * - /api/reserve?status=true - Get system status
 */

// Import the Vercel handler directly from source
import handler from '../src/handlers/vercel.js';

// Export as default for Vercel Functions
export default handler;