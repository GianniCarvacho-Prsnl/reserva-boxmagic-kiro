import express from 'express';
import { ReservationBot } from '../core/ReservationBot.js';
import { Logger } from '../core/Logger.js';
import type { ReservationResult } from '../types/ReservationTypes.js';

/**
 * Fly.io Express server handler for CrossFit reservation automation
 * 
 * Provides HTTP endpoints for:
 * - POST /reserve - Execute reservations
 * - GET /status - System status
 * - GET /health - Health check
 * - POST /webhook/test - Test webhook
 * - GET /validate - Configuration validation
 * 
 * Requirements addressed:
 * - 4.1: Compatible with Fly.io platform
 * - 4.2: Automatic execution via external cron jobs
 * - 4.4: Alternative deployment option to Vercel
 */

interface FlyioHandlerResponse {
  success: boolean;
  message: string;
  timestamp: string;
  data?: any;
  error?: string;
  executionTime?: number;
  results?: ReservationResult[];
}

/**
 * Create Express application for Fly.io deployment
 * Requirements 4.1, 4.4: Express server for Fly.io platform
 */
export function createFlyioApp(): express.Application {
  const app = express();
  const logger = new Logger(process.env.WEBHOOK_URL, 'FlyioHandler');

  // Middleware
  app.use(express.json());
  app.use(express.urlencoded({ extended: true }));

  // CORS middleware
  app.use((req, res, next) => {
    res.header('Access-Control-Allow-Origin', '*');
    res.header('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
    res.header('Access-Control-Allow-Headers', 'Content-Type, Authorization');
    
    if (req.method === 'OPTIONS') {
      res.sendStatus(200);
      return;
    }
    
    next();
  });

  // Request logging middleware
  app.use((req, _res, next) => {
    logger.logInfo('Request received', {
      method: req.method,
      path: req.path,
      query: req.query,
      userAgent: req.get('User-Agent'),
      ip: req.ip
    });
    next();
  });

  // Health check endpoint (required for Fly.io)
  app.get('/health', (_req, res) => {
    res.status(200).json({
      success: true,
      message: 'Service is healthy',
      timestamp: new Date().toISOString(),
      data: {
        status: 'healthy',
        uptime: process.uptime(),
        memory: process.memoryUsage(),
        platform: 'flyio'
      }
    });
  });

  // System status endpoint
  app.get('/status', async (_req, res) => {
    const startTime = new Date();
    
    try {
      logger.logInfo('Status check requested');
      
      const bot = new ReservationBot(logger);
      const status = bot.getStatus();
      const config = await bot.getConfig();
      const executionTime = new Date().getTime() - startTime.getTime();

      const response: FlyioHandlerResponse = {
        success: true,
        message: 'System status retrieved successfully',
        timestamp: new Date().toISOString(),
        executionTime,
        data: {
          status,
          environment: {
            nodeEnv: process.env.NODE_ENV || 'development',
            timezone: process.env.TIMEZONE || 'America/Santiago',
            platform: 'flyio',
            region: process.env.FLY_REGION || 'unknown',
            appName: process.env.FLY_APP_NAME || 'unknown'
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
          },
          system: {
            uptime: process.uptime(),
            memory: process.memoryUsage(),
            nodeVersion: process.version
          }
        }
      };

      res.status(200).json(response);

    } catch (error) {
      logger.logError(error as Error, { context: 'FlyioHandler.status' });
      res.status(500).json({
        success: false,
        message: error instanceof Error ? error.message : 'Status check failed',
        timestamp: new Date().toISOString(),
        error: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  });

  // Configuration validation endpoint
  app.get('/validate', async (_req, res) => {
    const startTime = new Date();
    
    try {
      logger.logInfo('Configuration validation requested');
      
      const bot = new ReservationBot(logger);
      const validation = await bot.validateConfiguration();
      const executionTime = new Date().getTime() - startTime.getTime();

      const response: FlyioHandlerResponse = {
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
      logger.logError(error as Error, { context: 'FlyioHandler.validate' });
      res.status(500).json({
        success: false,
        message: error instanceof Error ? error.message : 'Configuration validation failed',
        timestamp: new Date().toISOString(),
        error: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  });

  // Webhook test endpoint
  app.post('/webhook/test', async (_req, res) => {
    const startTime = new Date();
    
    try {
      logger.logInfo('Webhook test requested');
      
      const bot = new ReservationBot(logger);
      const webhookSuccess = await bot.testWebhookNotification();
      const executionTime = new Date().getTime() - startTime.getTime();

      const response: FlyioHandlerResponse = {
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
      logger.logError(error as Error, { context: 'FlyioHandler.webhookTest' });
      res.status(500).json({
        success: false,
        message: error instanceof Error ? error.message : 'Webhook test failed',
        timestamp: new Date().toISOString(),
        error: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  });

  // Main reservation execution endpoint
  app.post('/reserve', async (req, res) => {
    const startTime = new Date();
    
    try {
      // Parse parameters from body or query
      const params = { ...req.query, ...req.body };
      const {
        scheduleId,
        scheduleIds,
        className,
        targetTime
      } = params;

      logger.logInfo('Reservation execution requested', { params });

      if (!scheduleId && !scheduleIds) {
        return res.status(400).json({
          success: false,
          message: 'Missing required parameter: scheduleId or scheduleIds',
          timestamp: new Date().toISOString(),
          error: 'Bad Request'
        });
      }

      const bot = new ReservationBot(logger);
      let results: ReservationResult[];

      if (scheduleIds) {
        // Multiple reservations
        const scheduleIdArray = typeof scheduleIds === 'string' 
          ? scheduleIds.split(',').map(id => id.trim())
          : scheduleIds;
        
        logger.logInfo('Executing multiple reservations', { scheduleIds: scheduleIdArray });
        results = await bot.executeMultipleReservations(scheduleIdArray);
        
      } else {
        // Single reservation
        logger.logInfo('Executing single reservation', { scheduleId });
        const result = await bot.executeReservation(scheduleId as string, {
          className: className as string,
          targetTime: targetTime as string
        });
        results = [result];
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

      const response: FlyioHandlerResponse = {
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

      return res.status(200).json(response);

    } catch (error) {
      logger.logError(error as Error, { context: 'FlyioHandler.reserve' });
      return res.status(500).json({
        success: false,
        message: error instanceof Error ? error.message : 'Reservation execution failed',
        timestamp: new Date().toISOString(),
        error: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  });

  // Catch-all for undefined routes
  app.use('*', (req, res) => {
    res.status(404).json({
      success: false,
      message: `Route ${req.method} ${req.originalUrl} not found`,
      timestamp: new Date().toISOString(),
      error: 'Not Found',
      data: {
        availableEndpoints: [
          'GET /health - Health check',
          'GET /status - System status',
          'GET /validate - Configuration validation',
          'POST /webhook/test - Test webhook',
          'POST /reserve - Execute reservations'
        ]
      }
    });
  });

  // Global error handler
  app.use((error: Error, req: express.Request, res: express.Response, _next: express.NextFunction) => {
    logger.logError(error, { 
      context: 'FlyioHandler.globalErrorHandler',
      method: req.method,
      path: req.path
    });

    res.status(500).json({
      success: false,
      message: 'Internal server error',
      timestamp: new Date().toISOString(),
      error: error.message
    });
  });

  return app;
}

/**
 * Start the Fly.io server
 * Requirements 4.1, 4.4: Server startup for Fly.io deployment
 */
export function startFlyioServer(port: number = 3000): void {
  const app = createFlyioApp();
  const logger = new Logger(process.env.WEBHOOK_URL, 'FlyioServer');

  const server = app.listen(port, '0.0.0.0', () => {
    logger.logInfo('Fly.io server started', {
      port,
      environment: process.env.NODE_ENV || 'development',
      timezone: process.env.TIMEZONE || 'America/Santiago',
      region: process.env.FLY_REGION || 'unknown',
      appName: process.env.FLY_APP_NAME || 'unknown'
    });
  });

  // Graceful shutdown handling
  process.on('SIGTERM', () => {
    logger.logInfo('SIGTERM received, shutting down gracefully');
    server.close(() => {
      logger.logInfo('Server closed');
      process.exit(0);
    });
  });

  process.on('SIGINT', () => {
    logger.logInfo('SIGINT received, shutting down gracefully');
    server.close(() => {
      logger.logInfo('Server closed');
      process.exit(0);
    });
  });

  // Handle uncaught exceptions
  process.on('uncaughtException', (error) => {
    logger.logError(error, { context: 'UncaughtException' });
    process.exit(1);
  });

  process.on('unhandledRejection', (reason, promise) => {
    logger.logError(new Error(`Unhandled Rejection: ${reason}`), { 
      context: 'UnhandledRejection',
      promise: promise.toString()
    });
    process.exit(1);
  });
}

/**
 * Legacy export for compatibility
 */
export const flyioHandler = createFlyioApp;