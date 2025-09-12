import type { VercelRequest, VercelResponse } from '@vercel/node';
import { ReservationBot } from '../core/ReservationBot.js';
import { Logger } from '../core/Logger.js';
import type { ReservationResult } from '../types/ReservationTypes.js';

/**
 * Vercel Functions handler for CrossFit reservation automation
 * 
 * Supports multiple execution modes:
 * 1. Single reservation: /api/reserve?scheduleId=xxx
 * 2. Multiple reservations: /api/reserve?scheduleIds=xxx,yyy,zzz
 * 3. Configuration validation: /api/reserve?validate=true
 * 4. Webhook test: /api/reserve?testWebhook=true
 * 
 * Requirements addressed:
 * - 4.1: Compatible with Vercel serverless platform
 * - 4.2: Automatic execution via cron jobs
 * - 4.3: Operate in Santiago timezone (UTC-3/UTC-4)
 */

interface VercelHandlerResponse {
  success: boolean;
  message: string;
  timestamp: string;
  data?: any;
  error?: string;
  executionTime?: number;
  results?: ReservationResult[];
}

/**
 * Main Vercel handler function
 * Requirements 4.1, 4.2, 4.3: Serverless execution with timezone support
 */
export default async function handler(
  req: VercelRequest,
  res: VercelResponse
): Promise<void> {
  const startTime = new Date();
  const logger = new Logger(process.env.WEBHOOK_URL, 'VercelHandler');

  // Set CORS headers for browser requests
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

  // Handle preflight requests
  if (req.method === 'OPTIONS') {
    res.status(200).end();
    return;
  }

  try {
    logger.logInfo('Vercel handler invoked', {
      method: req.method,
      query: req.query,
      userAgent: req.headers['user-agent'],
      timestamp: startTime.toISOString()
    });

    // Parse query parameters
    const {
      scheduleId,
      scheduleIds,
      className,
      targetTime,
      validate,
      testWebhook,
      status
    } = req.query;

    // Validate HTTP method
    if (!['GET', 'POST'].includes(req.method || '')) {
      return sendErrorResponse(res, 'Method not allowed', 405, logger);
    }

    // Initialize ReservationBot
    const bot = new ReservationBot(logger);

    // Handle different operation modes
    if (validate === 'true') {
      return await handleConfigValidation(res, bot, logger, startTime);
    }

    if (testWebhook === 'true') {
      return await handleWebhookTest(res, bot, logger, startTime);
    }

    if (status === 'true') {
      return await handleStatusCheck(res, bot, logger, startTime);
    }

    // Handle reservation execution
    if (scheduleId || scheduleIds) {
      return await handleReservationExecution(
        res,
        bot,
        logger,
        startTime,
        {
          scheduleId: scheduleId as string,
          scheduleIds: scheduleIds as string,
          className: className as string,
          targetTime: targetTime as string
        }
      );
    }

    // No valid operation specified
    return sendErrorResponse(
      res,
      'Missing required parameters. Specify scheduleId, scheduleIds, validate=true, testWebhook=true, or status=true',
      400,
      logger
    );

  } catch (error) {
    logger.logError(error as Error, { context: 'VercelHandler.main' });
    return sendErrorResponse(
      res,
      error instanceof Error ? error.message : 'Internal server error',
      500,
      logger
    );
  }
}

/**
 * Handle reservation execution (single or multiple)
 * Requirements 4.1, 4.2: Execute reservations via serverless functions
 */
async function handleReservationExecution(
  res: VercelResponse,
  bot: ReservationBot,
  logger: Logger,
  startTime: Date,
  params: {
    scheduleId?: string;
    scheduleIds?: string;
    className?: string;
    targetTime?: string;
  }
): Promise<void> {
  try {
    let results: ReservationResult[];

    if (params.scheduleIds) {
      // Multiple reservations
      const scheduleIdArray = params.scheduleIds.split(',').map(id => id.trim());
      logger.logInfo('Executing multiple reservations', { scheduleIds: scheduleIdArray });
      
      results = await bot.executeMultipleReservations(scheduleIdArray);
      
    } else if (params.scheduleId) {
      // Single reservation
      logger.logInfo('Executing single reservation', { scheduleId: params.scheduleId });
      
      const result = await bot.executeReservation(params.scheduleId, {
        className: params.className,
        targetTime: params.targetTime
      });
      
      results = [result];
    } else {
      return sendErrorResponse(res, 'Missing scheduleId or scheduleIds parameter', 400, logger);
    }

    const executionTime = new Date().getTime() - startTime.getTime();
    const successCount = results.filter(r => r.success).length;
    const failureCount = results.length - successCount;

    logger.logInfo('Reservation execution completed', {
      totalReservations: results.length,
      successful: successCount,
      failed: failureCount,
      executionTime: `${executionTime}ms`
    });

    const response: VercelHandlerResponse = {
      success: successCount > 0,
      message: `Completed ${results.length} reservation(s): ${successCount} successful, ${failureCount} failed`,
      timestamp: new Date().toISOString(),
      executionTime,
      results,
      data: {
        summary: {
          total: results.length,
          successful: successCount,
          failed: failureCount,
          successRate: `${Math.round((successCount / results.length) * 100)}%`
        },
        details: results.map(result => ({
          success: result.success,
          message: result.message,
          classStatus: result.classStatus,
          timingAccuracy: `${result.timingAccuracy}ms`,
          timestamp: result.timestamp.toISOString()
        }))
      }
    };

    res.status(200).json(response);

  } catch (error) {
    logger.logError(error as Error, { context: 'VercelHandler.handleReservationExecution' });
    return sendErrorResponse(
      res,
      error instanceof Error ? error.message : 'Reservation execution failed',
      500,
      logger
    );
  }
}

/**
 * Handle configuration validation
 * Requirements 4.1: Validate configuration in serverless environment
 */
async function handleConfigValidation(
  res: VercelResponse,
  bot: ReservationBot,
  logger: Logger,
  startTime: Date
): Promise<void> {
  try {
    logger.logInfo('Validating configuration');
    
    const validation = await bot.validateConfiguration();
    const executionTime = new Date().getTime() - startTime.getTime();

    const response: VercelHandlerResponse = {
      success: validation.valid,
      message: validation.valid ? 'Configuration is valid' : 'Configuration validation failed',
      timestamp: new Date().toISOString(),
      executionTime,
      data: {
        valid: validation.valid,
        errors: validation.errors,
        errorCount: validation.errors.length
      }
    };

    res.status(validation.valid ? 200 : 400).json(response);

  } catch (error) {
    logger.logError(error as Error, { context: 'VercelHandler.handleConfigValidation' });
    return sendErrorResponse(
      res,
      error instanceof Error ? error.message : 'Configuration validation failed',
      500,
      logger
    );
  }
}

/**
 * Handle webhook test
 * Requirements 4.1: Test webhook configuration in serverless environment
 */
async function handleWebhookTest(
  res: VercelResponse,
  bot: ReservationBot,
  logger: Logger,
  startTime: Date
): Promise<void> {
  try {
    logger.logInfo('Testing webhook notification');
    
    const webhookSuccess = await bot.testWebhookNotification();
    const executionTime = new Date().getTime() - startTime.getTime();

    const response: VercelHandlerResponse = {
      success: webhookSuccess,
      message: webhookSuccess ? 'Webhook test successful' : 'Webhook test failed',
      timestamp: new Date().toISOString(),
      executionTime,
      data: {
        webhookConfigured: !!process.env.WEBHOOK_URL,
        webhookUrl: process.env.WEBHOOK_URL ? 
          process.env.WEBHOOK_URL.substring(0, 50) + '...' : 
          'Not configured',
        testResult: webhookSuccess
      }
    };

    res.status(200).json(response);

  } catch (error) {
    logger.logError(error as Error, { context: 'VercelHandler.handleWebhookTest' });
    return sendErrorResponse(
      res,
      error instanceof Error ? error.message : 'Webhook test failed',
      500,
      logger
    );
  }
}

/**
 * Handle status check
 * Requirements 4.1: Provide system status in serverless environment
 */
async function handleStatusCheck(
  res: VercelResponse,
  bot: ReservationBot,
  logger: Logger,
  startTime: Date
): Promise<void> {
  try {
    logger.logInfo('Checking system status');
    
    const status = bot.getStatus();
    const config = await bot.getConfig();
    const executionTime = new Date().getTime() - startTime.getTime();

    const response: VercelHandlerResponse = {
      success: true,
      message: 'System status retrieved successfully',
      timestamp: new Date().toISOString(),
      executionTime,
      data: {
        status,
        environment: {
          nodeEnv: process.env.NODE_ENV || 'development',
          timezone: process.env.TIMEZONE || 'America/Santiago',
          platform: 'vercel',
          region: process.env.VERCEL_REGION || 'unknown'
        },
        configuration: {
          loaded: !!config,
          schedulesCount: config?.schedules.length || 0,
          notificationsEnabled: config?.notifications.enabled || false,
          webhookConfigured: !!process.env.WEBHOOK_URL
        },
        timing: {
          currentTime: new Date().toISOString(),
          timezone: process.env.TIMEZONE || 'America/Santiago'
        }
      }
    };

    res.status(200).json(response);

  } catch (error) {
    logger.logError(error as Error, { context: 'VercelHandler.handleStatusCheck' });
    return sendErrorResponse(
      res,
      error instanceof Error ? error.message : 'Status check failed',
      500,
      logger
    );
  }
}

/**
 * Send standardized error response
 */
function sendErrorResponse(
  res: VercelResponse,
  message: string,
  statusCode: number,
  logger: Logger
): void {
  logger.logError(message, { statusCode });

  const response: VercelHandlerResponse = {
    success: false,
    message,
    timestamp: new Date().toISOString(),
    error: message
  };

  res.status(statusCode).json(response);
}

/**
 * Alternative export for direct function calls (for testing)
 */
export const vercelHandler = handler;