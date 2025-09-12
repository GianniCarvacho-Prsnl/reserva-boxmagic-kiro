import { ErrorType, ErrorCategory, RetryStrategy as RetryStrategyType, getErrorClassification } from '../types/ErrorTypes';
import { Logger } from '../core/Logger';

/**
 * Retry strategy implementation for different error types
 * Provides intelligent retry logic based on error classification
 */

export interface RetryOptions {
  maxRetries?: number;
  baseDelayMs?: number;
  maxDelayMs?: number;
  jitterMs?: number;
  timeoutMs?: number;
}

export interface RetryResult<T> {
  success: boolean;
  result?: T;
  error?: Error;
  attempts: number;
  totalDurationMs: number;
  lastErrorType?: ErrorType;
}

export interface RetryAttempt {
  attemptNumber: number;
  errorType: ErrorType;
  error: Error;
  delayMs: number;
  timestamp: Date;
}

export class RetryStrategyManager {
  private logger: Logger;
  
  constructor(logger: Logger) {
    this.logger = logger;
  }

  /**
   * Execute an operation with retry logic based on error classification
   */
  async executeWithRetry<T>(
    operation: () => Promise<T>,
    context: string,
    customOptions?: RetryOptions
  ): Promise<RetryResult<T>> {
    const startTime = Date.now();
    const attempts: RetryAttempt[] = [];
    let lastError: Error | undefined;
    let lastErrorType: ErrorType | undefined;

    // Default options
    const options: Required<RetryOptions> = {
      maxRetries: 3,
      baseDelayMs: 1000,
      maxDelayMs: 30000,
      jitterMs: 100,
      timeoutMs: 300000, // 5 minutes total timeout
      ...customOptions
    };

    for (let attempt = 0; attempt <= options.maxRetries; attempt++) {
      try {
        // Check total timeout
        if (Date.now() - startTime > options.timeoutMs) {
          this.logger.logError(new Error(`Retry timeout exceeded for ${context}`), {
            context,
            totalDurationMs: Date.now() - startTime,
            attempts: attempts.length
          });
          break;
        }

        this.logger.logInfo(`Executing ${context} (attempt ${attempt + 1}/${options.maxRetries + 1})`);
        
        const result = await operation();
        
        this.logger.logInfo(`${context} succeeded on attempt ${attempt + 1}`, {
          attempts: attempt + 1,
          totalDurationMs: Date.now() - startTime
        });

        return {
          success: true,
          result,
          attempts: attempt + 1,
          totalDurationMs: Date.now() - startTime
        };

      } catch (error) {
        lastError = error as Error;
        lastErrorType = this.classifyAndLogError(error as Error, context, attempt + 1);
        
        const errorClassification = getErrorClassification(lastErrorType);
        
        // Record this attempt
        const retryAttempt: RetryAttempt = {
          attemptNumber: attempt + 1,
          errorType: lastErrorType,
          error: lastError,
          delayMs: 0,
          timestamp: new Date()
        };

        // Check if we should retry based on error classification
        if (attempt >= options.maxRetries || !this.shouldRetry(errorClassification, attempt)) {
          attempts.push(retryAttempt);
          this.logger.logError(lastError, {
            context: `${context} - Final failure`,
            errorType: lastErrorType,
            attempts: attempt + 1,
            totalDurationMs: Date.now() - startTime
          });
          break;
        }

        // Calculate delay based on retry strategy
        const delayMs = this.calculateDelay(
          errorClassification.retryStrategy,
          attempt,
          errorClassification.retryDelayMs,
          options
        );

        retryAttempt.delayMs = delayMs;
        attempts.push(retryAttempt);

        this.logger.logInfo(`${context} failed, retrying in ${delayMs}ms`, {
          errorType: lastErrorType,
          attempt: attempt + 1,
          delayMs,
          retryStrategy: errorClassification.retryStrategy
        });

        // Wait before retry
        if (delayMs > 0) {
          await this.delay(delayMs);
        }
      }
    }

    return {
      success: false,
      error: lastError,
      attempts: attempts.length,
      totalDurationMs: Date.now() - startTime,
      lastErrorType
    };
  }

  /**
   * Execute operation with timing-critical retry logic
   * Special handling for timing-sensitive operations
   */
  async executeTimingCritical<T>(
    operation: () => Promise<T>,
    context: string,
    targetTime: Date,
    maxLatencyMs: number = 1000
  ): Promise<RetryResult<T>> {
    const startTime = Date.now();
    let lastError: Error | undefined;
    let lastErrorType: ErrorType | undefined;

    try {
      // Check if we still have time for execution
      const timeUntilTarget = targetTime.getTime() - Date.now();
      if (timeUntilTarget < -maxLatencyMs) {
        throw new Error(`Timing critical operation too late: ${Math.abs(timeUntilTarget)}ms past target`);
      }

      this.logger.logInfo(`Executing timing-critical ${context}`, {
        timeUntilTargetMs: timeUntilTarget,
        targetTime: targetTime.toISOString()
      });

      const result = await operation();
      const executionTime = Date.now();
      const latency = executionTime - targetTime.getTime();

      this.logger.logInfo(`Timing-critical ${context} completed`, {
        latencyMs: latency,
        withinTolerance: Math.abs(latency) <= maxLatencyMs
      });

      return {
        success: true,
        result,
        attempts: 1,
        totalDurationMs: Date.now() - startTime
      };

    } catch (error) {
      lastError = error as Error;
      lastErrorType = this.classifyAndLogError(error as Error, context, 1);
      
      const errorClassification = getErrorClassification(lastErrorType);
      const timeRemaining = targetTime.getTime() - Date.now();

      // Only retry if we have time and the error allows it
      if (timeRemaining > 500 && errorClassification.retryStrategy === RetryStrategyType.TIMING_CRITICAL_RETRY) {
        this.logger.logInfo(`Timing-critical retry for ${context}`, {
          errorType: lastErrorType,
          timeRemainingMs: timeRemaining
        });

        try {
          const result = await operation();
          const executionTime = Date.now();
          const latency = executionTime - targetTime.getTime();

          return {
            success: true,
            result,
            attempts: 2,
            totalDurationMs: Date.now() - startTime
          };
        } catch (retryError) {
          lastError = retryError as Error;
          lastErrorType = this.classifyAndLogError(retryError as Error, context, 2);
        }
      }

      this.logger.logError(lastError, {
        context: `Timing-critical ${context} failed`,
        errorType: lastErrorType,
        timeRemainingMs: timeRemaining
      });

      return {
        success: false,
        error: lastError,
        attempts: timeRemaining > 500 ? 2 : 1,
        totalDurationMs: Date.now() - startTime,
        lastErrorType
      };
    }
  }

  /**
   * Determine if we should retry based on error classification
   */
  private shouldRetry(errorClassification: any, currentAttempt: number): boolean {
    // Never retry if strategy is NO_RETRY
    if (errorClassification.retryStrategy === RetryStrategyType.NO_RETRY) {
      return false;
    }

    // Don't exceed max retries for this error type
    if (currentAttempt >= errorClassification.maxRetries) {
      return false;
    }

    // Don't retry critical errors (except for specific cases)
    if (errorClassification.isCritical && 
        errorClassification.retryStrategy !== RetryStrategyType.IMMEDIATE_RETRY) {
      return false;
    }

    return true;
  }

  /**
   * Calculate delay based on retry strategy
   */
  private calculateDelay(
    strategy: RetryStrategyType,
    attempt: number,
    baseDelayMs: number,
    options: Required<RetryOptions>
  ): number {
    let delayMs = 0;

    switch (strategy) {
      case RetryStrategyType.NO_RETRY:
        return 0;

      case RetryStrategyType.IMMEDIATE_RETRY:
        return 0;

      case RetryStrategyType.LINEAR_BACKOFF:
        delayMs = baseDelayMs * (attempt + 1);
        break;

      case RetryStrategyType.EXPONENTIAL_BACKOFF:
        delayMs = baseDelayMs * Math.pow(2, attempt);
        break;

      case RetryStrategyType.TIMING_CRITICAL_RETRY:
        // Minimal delay for timing-critical operations
        return Math.min(100, baseDelayMs);

      default:
        delayMs = baseDelayMs;
    }

    // Apply jitter to avoid thundering herd
    const jitter = Math.random() * options.jitterMs;
    delayMs += jitter;

    // Cap at maximum delay
    return Math.min(delayMs, options.maxDelayMs);
  }

  /**
   * Classify error and log it appropriately
   */
  private classifyAndLogError(error: Error, context: string, attempt: number): ErrorType {
    const errorType = this.classifyError(error);
    const errorClassification = getErrorClassification(errorType);

    this.logger.logError(error, {
      context: `${context} - Attempt ${attempt}`,
      errorType,
      errorCategory: errorClassification.category,
      retryStrategy: errorClassification.retryStrategy,
      isCritical: errorClassification.isCritical
    });

    return errorType;
  }

  /**
   * Classify error based on message and type
   */
  private classifyError(error: Error | any): ErrorType {
    // Handle null, undefined, or non-Error objects
    if (!error) {
      return ErrorType.UNKNOWN_ERROR;
    }
    
    let message: string;
    if (typeof error === 'string') {
      message = error.toLowerCase();
    } else if (error.message) {
      message = error.message.toLowerCase();
    } else {
      return ErrorType.UNKNOWN_ERROR;
    }

    // Network errors
    if (message.includes('network') || message.includes('connection')) {
      if (message.includes('timeout')) return ErrorType.CONNECTION_TIMEOUT;
      if (message.includes('dns')) return ErrorType.DNS_RESOLUTION_FAILED;
      return ErrorType.NETWORK_ERROR;
    }

    // Authentication errors
    if (message.includes('login') || message.includes('auth')) {
      if (message.includes('credential') || message.includes('password')) {
        return ErrorType.INVALID_CREDENTIALS;
      }
      if (message.includes('session') || message.includes('expired')) {
        return ErrorType.SESSION_EXPIRED;
      }
      return ErrorType.LOGIN_FAILED;
    }

    // UI/Navigation errors
    if (message.includes('element') || message.includes('selector')) {
      return ErrorType.ELEMENT_NOT_FOUND;
    }
    if (message.includes('timeout') && message.includes('page')) {
      return ErrorType.PAGE_LOAD_TIMEOUT;
    }
    if (message.includes('modal')) {
      return ErrorType.MODAL_NOT_OPENED;
    }

    // Class/Reservation errors
    if (message.includes('class') || message.includes('clase')) {
      if (message.includes('not found') || message.includes('no encontrada')) {
        return ErrorType.CLASS_NOT_FOUND;
      }
      if (message.includes('booked') || message.includes('agendada')) {
        return ErrorType.CLASS_ALREADY_BOOKED;
      }
    }
    
    // Check for capacity/spots separately
    if (message.includes('capacidad completa') || 
        message.includes('full') || 
        message.includes('no spots')) {
      return ErrorType.NO_SPOTS_AVAILABLE;
    }

    // Browser errors
    if (message.includes('browser') || message.includes('chromium')) {
      if (message.includes('crash') || message.includes('disconnect')) {
        return ErrorType.BROWSER_CRASH;
      }
      if (message.includes('launch') || message.includes('start')) {
        return ErrorType.BROWSER_LAUNCH_FAILED;
      }
      return ErrorType.BROWSER_ERROR;
    }

    // Timing errors - check specific patterns first
    if (message.includes('preparation') && message.includes('timeout')) {
      return ErrorType.PREPARATION_TIMEOUT;
    }
    if (message.includes('execution') && message.includes('late')) {
      return ErrorType.EXECUTION_TOO_LATE;
    }
    if (message.includes('timing') || 
        (message.includes('time') && message.includes('error'))) {
      return ErrorType.TIMING_ERROR;
    }

    // Configuration errors
    if (message.includes('config') || message.includes('environment')) {
      return ErrorType.CONFIG_ERROR;
    }

    return ErrorType.UNKNOWN_ERROR;
  }

  /**
   * Simple delay utility
   */
  private delay(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}

/**
 * Specialized retry strategies for different operation types
 */
export class SpecializedRetryStrategies {
  private retryManager: RetryStrategyManager;

  constructor(logger: Logger) {
    this.retryManager = new RetryStrategyManager(logger);
  }

  /**
   * Retry strategy for network operations
   */
  async retryNetworkOperation<T>(
    operation: () => Promise<T>,
    context: string
  ): Promise<RetryResult<T>> {
    return this.retryManager.executeWithRetry(operation, context, {
      maxRetries: 3,
      baseDelayMs: 1000,
      maxDelayMs: 10000,
      jitterMs: 200
    });
  }

  /**
   * Retry strategy for UI operations
   */
  async retryUIOperation<T>(
    operation: () => Promise<T>,
    context: string
  ): Promise<RetryResult<T>> {
    return this.retryManager.executeWithRetry(operation, context, {
      maxRetries: 2,
      baseDelayMs: 1000,
      maxDelayMs: 5000,
      jitterMs: 100
    });
  }

  /**
   * Retry strategy for authentication operations
   */
  async retryAuthOperation<T>(
    operation: () => Promise<T>,
    context: string
  ): Promise<RetryResult<T>> {
    return this.retryManager.executeWithRetry(operation, context, {
      maxRetries: 1,
      baseDelayMs: 2000,
      maxDelayMs: 5000,
      jitterMs: 0
    });
  }

  /**
   * Retry strategy for timing-critical operations
   */
  async retryTimingCritical<T>(
    operation: () => Promise<T>,
    context: string,
    targetTime: Date
  ): Promise<RetryResult<T>> {
    return this.retryManager.executeTimingCritical(operation, context, targetTime);
  }

  /**
   * Retry strategy for browser operations
   */
  async retryBrowserOperation<T>(
    operation: () => Promise<T>,
    context: string
  ): Promise<RetryResult<T>> {
    return this.retryManager.executeWithRetry(operation, context, {
      maxRetries: 2,
      baseDelayMs: 2000,
      maxDelayMs: 8000,
      jitterMs: 500
    });
  }
}