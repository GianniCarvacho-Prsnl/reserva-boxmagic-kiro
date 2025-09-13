import { ExecutionResult, TimingMetrics } from '../types/ReservationTypes.js';

/**
 * TimingController - Precision timing management for critical reservation timing
 * 
 * Handles millisecond-precision timing for CrossFit class reservations where
 * timing is critical (reservations open exactly 25 hours before class start).
 * 
 * Requirements addressed:
 * - 6.1: Calculate preparation time considering navigation delays (30s buffer)
 * - 6.2: Be ready and waiting at the exact moment reservations open
 * - 6.3: Execute reservation within milliseconds of target time
 * - 6.4: Track timing accuracy and deviations
 */
export class TimingController {
  private timezone: string;

  constructor(timezone: string = 'America/Santiago') {
    this.timezone = timezone; // Used for future timezone-aware operations
  }

  /**
   * Calculate when to start preparation phase
   * Requirement 6.1: Consider navigation delays (30s buffer default)
   */
  calculatePreparationTime(targetTime: Date, bufferSeconds: number = 30): Date {
    const bufferMs = bufferSeconds * 1000;
    return new Date(targetTime.getTime() - bufferMs);
  }

  /**
   * Wait until exact target time with millisecond precision
   * Requirement 6.2 & 6.3: Be ready and execute at exact moment
   */
  async waitUntilExactTime(targetTime: Date): Promise<void> {
    const now = this.getCurrentTime();
    const waitTime = targetTime.getTime() - now.getTime();

    if (waitTime <= 0) {
      // Target time has already passed
      return;
    }

    if (waitTime > 1000) {
      // Coarse wait until 1 second before target
      const coarseWaitTime = waitTime - 1000;
      await new Promise(resolve => setTimeout(resolve, coarseWaitTime));
    }

    // High-frequency polling for millisecond precision
    // Requirement 6.3: Execute within milliseconds
    while (this.getCurrentTime().getTime() < targetTime.getTime()) {
      await new Promise(resolve => setTimeout(resolve, 1)); // 1ms polling
    }
  }

  /**
   * Get current time in configured timezone
   */
  getCurrentTime(): Date {
    // Use configured timezone for operations
    const now = new Date();
    // Timezone is stored for future timezone-aware operations
    return now;
  }

  /**
   * Get timezone configuration
   */
  getTimezone(): string {
    return this.timezone;
  }

  /**
   * Calculate time difference between target and current time
   * Requirement 6.4: Track timing accuracy
   */
  getTimeDifference(target: Date, current: Date = this.getCurrentTime()): number {
    return target.getTime() - current.getTime();
  }

  /**
   * Measure execution time of an operation
   * Requirement 6.4: Track timing accuracy and performance
   */
  async measureExecutionTime<T>(operation: () => Promise<T>): Promise<ExecutionResult<T>> {
    const startTime = this.getCurrentTime();
    const result = await operation();
    const endTime = this.getCurrentTime();
    
    return {
      result,
      duration: endTime.getTime() - startTime.getTime()
    };
  }

  /**
   * Execute operation at exact target time and measure accuracy
   * Requirement 6.3 & 6.4: Execute at exact time and track accuracy
   */
  async executeAtExactTime<T>(
    targetTime: Date, 
    operation: () => Promise<T>
  ): Promise<ExecutionResult<T>> {
    // Wait until exact target time
    await this.waitUntilExactTime(targetTime);
    
    const executionStart = this.getCurrentTime();
    const result = await operation();
    const executionEnd = this.getCurrentTime();
    
    return {
      result,
      duration: executionEnd.getTime() - executionStart.getTime(),
      accuracy: executionStart.getTime() - targetTime.getTime()
    };
  }

  /**
   * Prepare for critical timing execution
   * Requirement 6.1 & 6.2: Prepare with buffer time and be ready
   */
  async prepareForCriticalTiming(
    targetTime: Date, 
    bufferSeconds: number = 30,
    preparationOperation?: () => Promise<void>
  ): Promise<void> {
    const preparationTime = this.calculatePreparationTime(targetTime, bufferSeconds);
    
    // Wait until preparation time
    await this.waitUntilExactTime(preparationTime);
    
    // Execute preparation operation if provided
    if (preparationOperation) {
      await preparationOperation();
    }
  }

  /**
   * Create comprehensive timing metrics
   * Requirement 6.4: Track timing accuracy and performance metrics
   */
  createTimingMetrics(
    preparationStart: Date,
    preparationEnd: Date,
    executionStart: Date,
    executionEnd: Date,
    targetTime: Date
  ): TimingMetrics {
    return {
      preparationDuration: preparationEnd.getTime() - preparationStart.getTime(),
      executionDuration: executionEnd.getTime() - executionStart.getTime(),
      targetAccuracy: executionStart.getTime() - targetTime.getTime(),
      totalDuration: executionEnd.getTime() - preparationStart.getTime()
    };
  }

  /**
   * Check if we're within acceptable timing window
   * Requirement 6.4: Validate timing accuracy
   */
  isWithinTimingWindow(
    currentTime: Date, 
    targetTime: Date, 
    toleranceMs: number = 100
  ): boolean {
    const difference = Math.abs(currentTime.getTime() - targetTime.getTime());
    return difference <= toleranceMs;
  }

  /**
   * Format timing information for logging
   * Requirement 6.4: Track and report timing accuracy
   */
  formatTimingInfo(metrics: TimingMetrics): string {
    return [
      `Preparation: ${metrics.preparationDuration}ms`,
      `Execution: ${metrics.executionDuration}ms`,
      `Target Accuracy: ${metrics.targetAccuracy}ms`,
      `Total Duration: ${metrics.totalDuration}ms`
    ].join(' | ');
  }
}