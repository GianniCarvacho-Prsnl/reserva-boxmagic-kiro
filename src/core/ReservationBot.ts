import { ConfigManager } from '../config/ConfigManager.js';
import { WebAutomationEngine } from './WebAutomationEngine.js';
import { TimingController } from './TimingController.js';
import { Logger, ReservationPhase } from './Logger.js';
import { calculateNextReservationTime } from '../utils/timing.js';
import type { ReservationConfig, ReservationSchedule } from '../config/types.js';
import type { ReservationResult, TimingMetrics } from '../types/ReservationTypes.js';

/**
 * ReservationBot - Main orchestrator class for CrossFit reservation automation
 * 
 * Coordinates all components to execute precise timing reservations:
 * - Configuration management
 * - Web automation engine
 * - Timing controller for millisecond precision
 * - Comprehensive logging and error handling
 * 
 * Requirements addressed:
 * - 1.1: Automated reservation at exact timing
 * - 1.2: Complete login, navigation and selection within 30s buffer
 * - 1.3: Confirm reservation success
 * - 1.4: Retry logic and error handling
 */
export class ReservationBot {
  private configManager: ConfigManager;
  private webEngine: WebAutomationEngine;
  private timingController: TimingController;
  private logger: Logger;
  private isInitialized = false;

  constructor(logger?: Logger) {
    this.configManager = ConfigManager.getInstance();
    this.logger = logger || new Logger();
    this.webEngine = new WebAutomationEngine(this.logger);
    this.timingController = new TimingController();
  }

  /**
   * Initialize the reservation bot with configuration
   * Requirements 1.1, 1.2: Setup all components for automated execution
   */
  async initialize(configFilePath?: string): Promise<void> {
    if (this.isInitialized) {
      this.logger.logInfo('ReservationBot already initialized');
      return;
    }

    try {
      this.logger.setPhase(ReservationPhase.INITIALIZATION);
      this.logger.logInfo('Initializing ReservationBot');

      // Load and validate configuration
      const config = await this.configManager.loadConfig(configFilePath);
      this.logger.logInfo('Configuration loaded successfully', {
        schedulesCount: config.schedules.length,
        timezone: config.timezone,
        notificationsEnabled: config.notifications.enabled
      });

      // Initialize timing controller with timezone
      this.timingController = new TimingController(config.timezone);

      // Initialize web automation engine
      await this.webEngine.initialize();

      // Setup webhook notifications if configured
      if (config.notifications.enabled && config.notifications.webhookUrl) {
        this.logger = new Logger(config.notifications.webhookUrl, 'ReservationBot');
        this.logger.logInfo('Webhook notifications enabled', {
          webhookUrl: config.notifications.webhookUrl.substring(0, 50) + '...'
        });
      }

      this.isInitialized = true;
      this.logger.logInfo('ReservationBot initialization completed');

    } catch (error) {
      this.logger.logError(error as Error, { context: 'ReservationBot.initialize' });
      throw error;
    }
  }

  /**
   * Execute reservation for a specific schedule
   * Requirements 1.1, 1.2, 1.3, 1.4: Complete reservation flow with error handling
   */
  async executeReservation(scheduleId: string, params?: { className?: string; targetTime?: string }): Promise<ReservationResult> {
    if (!this.isInitialized) {
      await this.initialize();
    }

    const processStartTime = new Date();
    let timingMetrics: TimingMetrics | undefined;

    try {
      this.logger.logReservationAttempt({ scheduleId, ...params });

      // Load configuration for specific schedule
      const config = await this.configManager.loadConfigForSchedule(scheduleId, params);
      const schedule = config.schedules[0]; // Single schedule after filtering

      this.logger.logInfo('Executing reservation', {
        scheduleId: schedule.id,
        className: schedule.className,
        dayToSelect: schedule.dayToSelect,
        reservationTime: schedule.reservationTime,
        bufferSeconds: schedule.bufferSeconds
      });

      // Parse target time usando nuevo formato
      const targetTime = schedule.reservationTime 
        ? new Date(schedule.reservationTime) // Backward compatibility
        : this.calculateReservationTime(schedule);
      const now = this.timingController.getCurrentTime();

      // Validate timing
      if (targetTime.getTime() <= now.getTime()) {
        const timeStr = schedule.reservationTime || `${schedule.reservationDay} ${schedule.reservationHour}`;
        throw new Error(`Target reservation time ${timeStr} has already passed`);
      }

      // Calculate preparation time
      const preparationTime = this.timingController.calculatePreparationTime(targetTime, schedule.bufferSeconds);
      const timeUntilPreparation = preparationTime.getTime() - now.getTime();

      this.logger.logInfo('Timing calculated', {
        targetTime: targetTime.toISOString(),
        preparationTime: preparationTime.toISOString(),
        timeUntilPreparation: `${Math.round(timeUntilPreparation / 1000)}s`,
        bufferSeconds: schedule.bufferSeconds
      });

      // Execute the complete reservation flow
      const result = await this.executeReservationFlow(config, schedule, targetTime, preparationTime);

      // Calculate final timing metrics
      const processEndTime = new Date();
      timingMetrics = this.timingController.createTimingMetrics(
        processStartTime,
        preparationTime,
        targetTime,
        processEndTime,
        targetTime
      );

      this.logger.logReservationResult(result, timingMetrics);

      // Send webhook notification if configured
      if (config.notifications.enabled) {
        await this.logger.sendWebhookNotification(
          result.success,
          result,
          timingMetrics,
          scheduleId,
          schedule.className
        );
      }

      return result;

    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      this.logger.logError(error as Error, { 
        context: 'ReservationBot.executeReservation',
        scheduleId,
        params
      });

      // Create error result
      const errorResult: ReservationResult = {
        success: false,
        message: errorMessage,
        timestamp: new Date(),
        timingAccuracy: 0,
        hasSpots: false,
        classStatus: 'available'
      };

      // Send error notification if configured
      const config = this.configManager.getCurrentConfig();
      if (config?.notifications.enabled) {
        await this.logger.sendWebhookNotification(
          false,
          errorResult,
          timingMetrics,
          scheduleId,
          params?.className,
          errorMessage
        );
      }

      return errorResult;

    } finally {
      // Always cleanup browser resources
      await this.cleanup();
    }
  }

  /**
   * Execute the complete reservation flow with precise timing
   * Requirements 1.1, 1.2, 1.3: Preparation → Critical Timing → Verification
   */
  private async executeReservationFlow(
    config: ReservationConfig,
    schedule: ReservationSchedule,
    targetTime: Date,
    preparationTime: Date
  ): Promise<ReservationResult> {
    
    // Phase 1: Wait until preparation time
    this.logger.setPhase(ReservationPhase.PREPARATION);
    this.logger.logInfo('Waiting until preparation time', {
      preparationTime: preparationTime.toISOString()
    });

    await this.timingController.waitUntilExactTime(preparationTime);

    // Phase 2: Execute preparation (login, navigation, positioning)
    const preparationStart = new Date();
    
    try {
      await this.webEngine.prepareReservation(
        config.credentials.email,
        config.credentials.password,
        schedule.dayToSelect,
        schedule.className
      );

      const preparationEnd = new Date();
      const preparationDuration = preparationEnd.getTime() - preparationStart.getTime();
      
      this.logger.logInfo('Preparation phase completed', {
        duration: `${preparationDuration}ms`,
        timeUntilTarget: `${targetTime.getTime() - preparationEnd.getTime()}ms`
      });

      // Verify we have enough time before target
      const timeRemaining = targetTime.getTime() - preparationEnd.getTime();
      if (timeRemaining < 1000) { // Less than 1 second remaining
        this.logger.logWarn('Preparation took longer than expected', {
          preparationDuration: `${preparationDuration}ms`,
          timeRemaining: `${timeRemaining}ms`
        });
      }

    } catch (preparationError) {
      // Requirement 1.4: Retry logic for preparation failures
      this.logger.logWarn('Preparation failed, attempting retry', {
        error: preparationError instanceof Error ? preparationError.message : String(preparationError)
      });

      const timeRemaining = targetTime.getTime() - new Date().getTime();
      if (timeRemaining > 10000) { // More than 10 seconds remaining
        this.logger.logInfo('Sufficient time remaining, retrying preparation');
        
        // Cleanup and retry
        await this.webEngine.cleanup();
        await this.webEngine.initialize();
        
        await this.webEngine.prepareReservation(
          config.credentials.email,
          config.credentials.password,
          schedule.dayToSelect,
          schedule.className
        );
        
        this.logger.logInfo('Preparation retry completed successfully');
      } else {
        throw new Error(`Preparation failed and insufficient time for retry: ${timeRemaining}ms remaining`);
      }
    }

    // Phase 3: Wait for exact target time
    this.logger.setPhase(ReservationPhase.CRITICAL_TIMING);
    this.logger.logInfo('Waiting for exact target time', {
      targetTime: targetTime.toISOString()
    });

    await this.timingController.waitUntilExactTime(targetTime);

    // Phase 4: Execute critical timing reservation
    this.logger.setPhase(ReservationPhase.EXECUTION);
    const executionStart = new Date();
    
    this.logger.logCriticalTiming('Reservation execution started', targetTime, executionStart);

    const result = await this.executeWithRetry(schedule.className);

    const executionEnd = new Date();
    this.logger.logCriticalTiming('Reservation execution completed', targetTime, executionEnd);

    // Update result with accurate timing
    result.timingAccuracy = executionStart.getTime() - targetTime.getTime();
    result.timestamp = executionStart;

    return result;
  }

  /**
   * Execute reservation with retry logic
   * Requirement 1.4: Retry once immediately if first attempt fails
   */
  private async executeWithRetry(className: string): Promise<ReservationResult> {
    try {
      // First attempt
      this.logger.logInfo('Executing reservation (attempt 1)', { className });
      const result = await this.webEngine.executeReservation(className);
      
      if (result.success) {
        this.logger.logInfo('Reservation successful on first attempt', { className });
        return result;
      }

      // First attempt failed, check if retry is appropriate
      if (result.classStatus === 'full' || result.classStatus === 'already_booked') {
        this.logger.logInfo('No retry needed - class is full or already booked', { 
          className, 
          classStatus: result.classStatus 
        });
        return result;
      }

      // Requirement 1.4: Retry once immediately
      this.logger.logInfo('First attempt failed, retrying immediately', { 
        className,
        firstAttemptMessage: result.message
      });

      const retryResult = await this.webEngine.executeReservation(className);
      
      if (retryResult.success) {
        this.logger.logInfo('Reservation successful on retry', { className });
        return retryResult;
      } else {
        this.logger.logInfo('Reservation failed after retry', { 
          className,
          retryMessage: retryResult.message
        });
        return retryResult;
      }

    } catch (error) {
      this.logger.logError(error as Error, { 
        context: 'ReservationBot.executeWithRetry',
        className 
      });

      return {
        success: false,
        message: error instanceof Error ? error.message : String(error),
        timestamp: new Date(),
        timingAccuracy: 0,
        hasSpots: false,
        classStatus: 'available'
      };
    }
  }

  /**
   * Execute multiple reservations (for multiple schedules)
   * Requirements 1.1, 1.2, 1.3, 1.4: Handle multiple reservations independently
   */
  async executeMultipleReservations(scheduleIds: string[]): Promise<ReservationResult[]> {
    if (!this.isInitialized) {
      await this.initialize();
    }

    this.logger.logInfo('Executing multiple reservations', { 
      scheduleIds,
      count: scheduleIds.length 
    });

    const results: ReservationResult[] = [];

    for (const scheduleId of scheduleIds) {
      try {
        this.logger.logInfo(`Starting reservation for schedule: ${scheduleId}`);
        const result = await this.executeReservation(scheduleId);
        results.push(result);
        
        this.logger.logInfo(`Completed reservation for schedule: ${scheduleId}`, {
          success: result.success,
          message: result.message
        });

        // Brief pause between reservations to avoid overwhelming the system
        if (scheduleIds.indexOf(scheduleId) < scheduleIds.length - 1) {
          await new Promise(resolve => setTimeout(resolve, 1000));
        }

      } catch (error) {
        this.logger.logError(error as Error, { 
          context: 'ReservationBot.executeMultipleReservations',
          scheduleId 
        });

        // Add error result and continue with next reservation
        results.push({
          success: false,
          message: error instanceof Error ? error.message : String(error),
          timestamp: new Date(),
          timingAccuracy: 0,
          hasSpots: false,
          classStatus: 'available'
        });
      }
    }

    this.logger.logInfo('Multiple reservations completed', {
      total: results.length,
      successful: results.filter(r => r.success).length,
      failed: results.filter(r => !r.success).length
    });

    return results;
  }

  /**
   * Get current configuration
   */
  async getConfig(): Promise<ReservationConfig | null> {
    return this.configManager.getCurrentConfig();
  }

  /**
   * Validate configuration without executing reservations
   */
  async validateConfiguration(configFilePath?: string): Promise<{ valid: boolean; errors: string[] }> {
    try {
      const config = await this.configManager.loadConfig(configFilePath);
      const validation = this.configManager.validateConfig(config);
      
      return {
        valid: validation.isValid,
        errors: validation.errors.map(e => `${e.field}: ${e.message}`)
      };
    } catch (error) {
      return {
        valid: false,
        errors: [error instanceof Error ? error.message : String(error)]
      };
    }
  }

  /**
   * Test webhook configuration
   */
  async testWebhookNotification(): Promise<boolean> {
    if (!this.isInitialized) {
      await this.initialize();
    }

    return await this.logger.sendTestWebhookNotification();
  }

  /**
   * Get reservation logs for debugging
   */
  getLogs(): any[] {
    return this.logger.getLogs();
  }

  /**
   * Cleanup browser resources and reset state
   * Requirement: Automatic cleanup of resources
   */
  async cleanup(): Promise<void> {
    try {
      this.logger.setPhase(ReservationPhase.CLEANUP);
      this.logger.logInfo('Starting cleanup process');

      // Cleanup web automation engine
      await this.webEngine.cleanup();

      // Clear configuration cache for fresh state
      this.configManager.clearCache();

      // Reset initialization state
      this.isInitialized = false;

      this.logger.logInfo('Cleanup completed successfully');
    } catch (error) {
      this.logger.logError(error as Error, { context: 'ReservationBot.cleanup' });
      // Don't throw cleanup errors - log and continue
    }
  }

  /**
   * Force cleanup and reinitialize (useful for error recovery)
   */
  async reset(): Promise<void> {
    await this.cleanup();
    await this.initialize();
  }

  /**
   * Calculate reservation time from new format (reservationHour + reservationDay)
   */
  private calculateReservationTime(schedule: ReservationSchedule): Date {
    if (!schedule.reservationHour || !schedule.reservationDay) {
      throw new Error(`Schedule ${schedule.id} missing reservationHour or reservationDay`);
    }
    
    const config = this.configManager.getCurrentConfig();
    const timezone = config?.timezone || 'America/Santiago';
    
    return calculateNextReservationTime(schedule.reservationHour, schedule.reservationDay);
  }

  /**
   * Get timing metrics for the last execution
   */
  getLastExecutionMetrics(): TimingMetrics | null {
    const logs = this.logger.getLogs();
    const lastLogWithMetrics = logs
      .reverse()
      .find(log => log.timingMetrics && Object.keys(log.timingMetrics).length > 0);
    
    return lastLogWithMetrics?.timingMetrics as TimingMetrics || null;
  }

  /**
   * Check if bot is ready for execution
   */
  isReady(): boolean {
    return this.isInitialized;
  }

  /**
   * Get bot status information
   */
  getStatus(): {
    initialized: boolean;
    configLoaded: boolean;
    webEngineReady: boolean;
    lastExecution?: Date;
  } {
    const config = this.configManager.getCurrentConfig();
    const logs = this.logger.getLogs();
    const lastExecutionLog = logs
      .reverse()
      .find(log => log.message.includes('Starting reservation attempt'));

    return {
      initialized: this.isInitialized,
      configLoaded: config !== null,
      webEngineReady: this.isInitialized, // Web engine is ready when bot is initialized
      lastExecution: lastExecutionLog ? new Date(lastExecutionLog.timestamp) : undefined
    };
  }
}