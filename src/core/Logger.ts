import { ReservationResult, TimingMetrics } from '../types/ReservationTypes';

// Log levels enum for structured logging
export enum LogLevel {
  DEBUG = 'DEBUG',
  INFO = 'INFO',
  WARN = 'WARN',
  ERROR = 'ERROR'
}

// Structured log entry interface
export interface LogEntry {
  timestamp: string;
  level: LogLevel;
  message: string;
  metadata?: Record<string, any>;
  component?: string;
  phase?: ReservationPhase;
  timingMetrics?: Partial<TimingMetrics>;
}

// Reservation process phases for detailed tracking
export enum ReservationPhase {
  INITIALIZATION = 'initialization',
  CONFIGURATION = 'configuration',
  PREPARATION = 'preparation',
  LOGIN = 'login',
  NAVIGATION = 'navigation',
  CLASS_SELECTION = 'class_selection',
  CRITICAL_TIMING = 'critical_timing',
  EXECUTION = 'execution',
  VERIFICATION = 'verification',
  CLEANUP = 'cleanup',
  NOTIFICATION = 'notification'
}

// Webhook notification payload interface
export interface WebhookPayload {
  timestamp: string;
  success: boolean;
  scheduleId?: string;
  className?: string;
  reservationResult?: ReservationResult;
  timingMetrics?: TimingMetrics;
  error?: string;
  logs: LogEntry[];
  summary: {
    totalLogs: number;
    errorCount: number;
    warningCount: number;
    phases: string[];
    duration?: number;
  };
  metadata: {
    botVersion: string;
    environment: string;
    timezone: string;
  };
}

export class Logger {
  private logs: LogEntry[] = [];
  private currentPhase?: ReservationPhase;
  private webhookUrl?: string;
  private component: string = 'ReservationBot';

  constructor(webhookUrl?: string, component?: string) {
    this.webhookUrl = webhookUrl;
    if (component) {
      this.component = component;
    }
  }

  // Set current reservation phase for contextual logging
  setPhase(phase: ReservationPhase): void {
    this.currentPhase = phase;
    this.logDebug(`Entering phase: ${phase}`);
  }

  // Core logging method with structured output
  private log(level: LogLevel, message: string, metadata?: Record<string, any>, timingMetrics?: Partial<TimingMetrics>): void {
    const entry: LogEntry = {
      timestamp: new Date().toISOString(),
      level,
      message,
      metadata,
      component: this.component,
      phase: this.currentPhase,
      timingMetrics
    };

    // Store log entry for webhook notifications
    this.logs.push(entry);

    // Console output with structured format
    const metadataStr = metadata ? ` | ${JSON.stringify(metadata)}` : '';
    const phaseStr = this.currentPhase ? ` [${this.currentPhase}]` : '';
    const timingStr = timingMetrics ? ` | Timing: ${JSON.stringify(timingMetrics)}` : '';
    
    const logMessage = `[${entry.timestamp}] ${level}${phaseStr}: ${message}${metadataStr}${timingStr}`;

    switch (level) {
      case LogLevel.DEBUG:
        console.debug(logMessage);
        break;
      case LogLevel.INFO:
        console.log(logMessage);
        break;
      case LogLevel.WARN:
        console.warn(logMessage);
        break;
      case LogLevel.ERROR:
        console.error(logMessage);
        break;
    }
  }

  // Public logging methods with different levels
  logDebug(message: string, metadata?: Record<string, any>, timingMetrics?: Partial<TimingMetrics>): void {
    this.log(LogLevel.DEBUG, message, metadata, timingMetrics);
  }

  logInfo(message: string, metadata?: Record<string, any>, timingMetrics?: Partial<TimingMetrics>): void {
    this.log(LogLevel.INFO, message, metadata, timingMetrics);
  }

  logWarn(message: string, metadata?: Record<string, any>, timingMetrics?: Partial<TimingMetrics>): void {
    this.log(LogLevel.WARN, message, metadata, timingMetrics);
  }

  logError(error: Error | string, metadata?: Record<string, any>, timingMetrics?: Partial<TimingMetrics>): void {
    const message = error instanceof Error ? error.message : error;
    const errorMetadata = {
      ...metadata,
      ...(error instanceof Error && error.stack ? { stack: error.stack } : {})
    };
    this.log(LogLevel.ERROR, message, errorMetadata, timingMetrics);
  }

  // Specialized logging methods for reservation process
  logReservationAttempt(config: { scheduleId?: string; className?: string; targetTime?: string }): void {
    this.setPhase(ReservationPhase.INITIALIZATION);
    this.logInfo('Starting reservation attempt', {
      scheduleId: config.scheduleId,
      className: config.className,
      targetTime: config.targetTime
    });
  }

  logReservationResult(result: ReservationResult, timingMetrics?: TimingMetrics): void {
    this.setPhase(ReservationPhase.VERIFICATION);
    this.log(LogLevel.INFO, 'Reservation completed', {
      success: result.success,
      message: result.message,
      classStatus: result.classStatus,
      hasSpots: result.hasSpots,
      participantCount: result.participantCount
    }, timingMetrics);
  }

  // Timing-specific logging methods
  logTimingStart(operation: string): Date {
    const startTime = new Date();
    this.logDebug(`Starting ${operation}`, { startTime: startTime.toISOString() });
    return startTime;
  }

  logTimingEnd(operation: string, startTime: Date, targetTime?: Date): number {
    const endTime = new Date();
    const duration = endTime.getTime() - startTime.getTime();
    const accuracy = targetTime ? endTime.getTime() - targetTime.getTime() : undefined;
    
    const timingMetrics: Partial<TimingMetrics> = {
      ...(operation.includes('execution') ? { executionDuration: duration } : {}),
      ...(operation.includes('preparation') ? { preparationDuration: duration } : {}),
      ...(accuracy !== undefined ? { targetAccuracy: accuracy } : {})
    };

    this.log(LogLevel.INFO, `Completed ${operation}`, {
      duration: `${duration}ms`,
      ...(accuracy !== undefined ? { accuracy: `${accuracy}ms` } : {})
    }, timingMetrics);

    return duration;
  }

  // Critical timing logging for millisecond precision tracking
  logCriticalTiming(action: string, targetTime: Date, actualTime: Date): void {
    const accuracy = actualTime.getTime() - targetTime.getTime();
    this.setPhase(ReservationPhase.CRITICAL_TIMING);
    this.log(LogLevel.INFO, `Critical timing: ${action}`, {
      targetTime: targetTime.toISOString(),
      actualTime: actualTime.toISOString(),
      accuracy: `${accuracy}ms`,
      withinTolerance: Math.abs(accuracy) <= 100 // 100ms tolerance
    }, { targetAccuracy: accuracy });
  }

  // Phase-specific logging methods
  logLoginAttempt(email: string): void {
    this.setPhase(ReservationPhase.LOGIN);
    this.logInfo('Attempting login', { email: email.replace(/(.{3}).*(@.*)/, '$1***$2') });
  }

  logLoginSuccess(): void {
    this.logInfo('Login successful');
  }

  logNavigationStep(step: string, url?: string): void {
    this.setPhase(ReservationPhase.NAVIGATION);
    this.logInfo(`Navigation: ${step}`, url ? { url } : undefined);
  }

  logClassSelection(className: string, daySelected: string): void {
    this.setPhase(ReservationPhase.CLASS_SELECTION);
    this.logInfo('Class selection', { className, daySelected });
  }

  logClassStatus(className: string, status: string, participantCount?: string): void {
    this.logInfo('Class status check', { className, status, participantCount });
  }

  logExecutionStep(step: string, success: boolean, duration?: number): void {
    this.setPhase(ReservationPhase.EXECUTION);
    this.logInfo(`Execution step: ${step}`, { 
      success, 
      ...(duration ? { duration: `${duration}ms` } : {})
    });
  }

  // Webhook notification method with enhanced error handling and retry logic
  async sendWebhookNotification(
    success: boolean, 
    reservationResult?: ReservationResult, 
    timingMetrics?: TimingMetrics,
    scheduleId?: string,
    className?: string,
    error?: string
  ): Promise<void> {
    if (!this.webhookUrl) {
      this.logDebug('Webhook URL not configured, skipping notification');
      return;
    }

    this.setPhase(ReservationPhase.NOTIFICATION);

    const summary = this.generateSummaryReport();
    const payload: WebhookPayload = {
      timestamp: new Date().toISOString(),
      success,
      scheduleId,
      className,
      reservationResult,
      timingMetrics,
      error,
      logs: this.logs.slice(-20), // Send last 20 log entries
      summary: {
        totalLogs: summary.totalLogs,
        errorCount: summary.errorCount,
        warningCount: summary.warningCount,
        phases: summary.phases,
        duration: summary.totalDuration
      },
      metadata: {
        botVersion: '1.0.0',
        environment: process.env.NODE_ENV || 'development',
        timezone: process.env.TIMEZONE || 'America/Santiago'
      }
    };

    const maxRetries = 3;
    const retryDelay = 1000; // 1 second

    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      try {
        this.logInfo('Sending webhook notification', { 
          webhookUrl: this.webhookUrl,
          attempt,
          maxRetries
        });
        
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 10000); // 10 second timeout

        const response = await fetch(this.webhookUrl, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'User-Agent': 'CrossFit-Reservation-Bot/1.0',
            'X-Webhook-Attempt': attempt.toString(),
            'X-Webhook-Source': 'crossfit-reservation-bot'
          },
          body: JSON.stringify(payload),
          signal: controller.signal
        });

        clearTimeout(timeoutId);

        if (response.ok) {
          this.logInfo('Webhook notification sent successfully', { 
            status: response.status,
            attempt,
            responseTime: `${Date.now() - new Date(payload.timestamp).getTime()}ms`
          });
          return; // Success, exit retry loop
        } else {
          const responseText = await response.text().catch(() => 'Unable to read response');
          this.logWarn('Webhook notification failed', { 
            status: response.status, 
            statusText: response.statusText,
            responseBody: responseText.substring(0, 200), // Limit response body size
            attempt
          });

          // Don't retry on client errors (4xx), only on server errors (5xx) or network issues
          if (response.status >= 400 && response.status < 500) {
            this.logError('Webhook notification failed with client error, not retrying', {
              status: response.status,
              finalAttempt: attempt
            });
            return;
          }
        }
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : String(error);
        this.logWarn('Webhook notification attempt failed', { 
          error: errorMessage,
          attempt,
          isTimeout: errorMessage.includes('abort'),
          isNetworkError: errorMessage.includes('fetch')
        });
      }

      // Wait before retry (except on last attempt)
      if (attempt < maxRetries) {
        this.logDebug(`Retrying webhook notification in ${retryDelay}ms`, { 
          nextAttempt: attempt + 1 
        });
        await new Promise(resolve => setTimeout(resolve, retryDelay));
      }
    }

    // All retries failed
    this.logError('Webhook notification failed after all retries', { 
      maxRetries,
      finalPayload: {
        success: payload.success,
        scheduleId: payload.scheduleId,
        className: payload.className,
        error: payload.error
      }
    });
  }

  // Get all logs for debugging or external processing
  getLogs(): LogEntry[] {
    return [...this.logs];
  }

  // Get logs filtered by level
  getLogsByLevel(level: LogLevel): LogEntry[] {
    return this.logs.filter(log => log.level === level);
  }

  // Get logs filtered by phase
  getLogsByPhase(phase: ReservationPhase): LogEntry[] {
    return this.logs.filter(log => log.phase === phase);
  }

  // Clear logs (useful for testing or memory management)
  clearLogs(): void {
    this.logs = [];
    this.logDebug('Logs cleared');
  }

  // Validate webhook URL format and accessibility
  async validateWebhookUrl(url: string): Promise<{ valid: boolean; error?: string }> {
    try {
      // Basic URL format validation
      const urlObj = new URL(url);
      if (!['http:', 'https:'].includes(urlObj.protocol)) {
        return { valid: false, error: 'Webhook URL must use HTTP or HTTPS protocol' };
      }

      // Test connectivity with a simple HEAD request
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 5000);

      await fetch(url, {
        method: 'HEAD',
        signal: controller.signal,
        headers: {
          'User-Agent': 'CrossFit-Reservation-Bot/1.0'
        }
      });

      clearTimeout(timeoutId);

      // Accept any response (including 404) as long as the endpoint is reachable
      return { valid: true };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      return { 
        valid: false, 
        error: `Webhook URL validation failed: ${errorMessage}` 
      };
    }
  }

  // Create a test webhook notification to verify configuration
  async sendTestWebhookNotification(): Promise<boolean> {
    if (!this.webhookUrl) {
      this.logWarn('Cannot send test webhook: URL not configured');
      return false;
    }

    const testPayload: WebhookPayload = {
      timestamp: new Date().toISOString(),
      success: true,
      scheduleId: 'test-webhook',
      className: 'Test Notification',
      logs: [{
        timestamp: new Date().toISOString(),
        level: LogLevel.INFO,
        message: 'Test webhook notification',
        component: this.component,
        metadata: { test: true }
      }],
      summary: {
        totalLogs: 1,
        errorCount: 0,
        warningCount: 0,
        phases: ['notification'],
        duration: 0
      },
      metadata: {
        botVersion: '1.0.0',
        environment: process.env.NODE_ENV || 'development',
        timezone: process.env.TIMEZONE || 'America/Santiago'
      }
    };

    try {
      this.logInfo('Sending test webhook notification');
      
      const response = await fetch(this.webhookUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'User-Agent': 'CrossFit-Reservation-Bot/1.0',
          'X-Webhook-Test': 'true'
        },
        body: JSON.stringify(testPayload)
      });

      if (response.ok) {
        this.logInfo('Test webhook notification sent successfully', { status: response.status });
        return true;
      } else {
        this.logWarn('Test webhook notification failed', { 
          status: response.status, 
          statusText: response.statusText 
        });
        return false;
      }
    } catch (error) {
      this.logError('Test webhook notification error', { 
        error: error instanceof Error ? error.message : String(error) 
      });
      return false;
    }
  }

  // Generate summary report of the reservation process
  generateSummaryReport(): {
    totalLogs: number;
    errorCount: number;
    warningCount: number;
    phases: string[];
    totalDuration?: number;
    timingMetrics?: TimingMetrics;
  } {
    const errorCount = this.getLogsByLevel(LogLevel.ERROR).length;
    const warningCount = this.getLogsByLevel(LogLevel.WARN).length;
    const phases = [...new Set(this.logs.map(log => log.phase).filter(Boolean))] as string[];
    
    // Calculate total duration if we have start and end logs
    let totalDuration: number | undefined;
    let timingMetrics: TimingMetrics | undefined;
    
    const firstLog = this.logs[0];
    const lastLog = this.logs[this.logs.length - 1];
    
    if (firstLog && lastLog) {
      totalDuration = new Date(lastLog.timestamp).getTime() - new Date(firstLog.timestamp).getTime();
    }

    // Aggregate timing metrics from logs
    const allTimingMetrics = this.logs
      .map(log => log.timingMetrics)
      .filter(Boolean) as Partial<TimingMetrics>[];
    
    if (allTimingMetrics.length > 0) {
      timingMetrics = {
        preparationDuration: allTimingMetrics.find(m => m.preparationDuration)?.preparationDuration || 0,
        executionDuration: allTimingMetrics.find(m => m.executionDuration)?.executionDuration || 0,
        targetAccuracy: allTimingMetrics.find(m => m.targetAccuracy)?.targetAccuracy || 0,
        totalDuration: totalDuration || 0
      };
    }

    return {
      totalLogs: this.logs.length,
      errorCount,
      warningCount,
      phases,
      totalDuration,
      timingMetrics
    };
  }
}