import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import { TimingController } from '../../src/core/TimingController.js';
import { TimingMetrics } from '../../src/types/ReservationTypes.js';

describe('TimingController', () => {
  let timingController: TimingController;
  
  beforeEach(() => {
    timingController = new TimingController();
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  describe('calculatePreparationTime', () => {
    it('should calculate preparation time with default 30 second buffer', () => {
      const targetTime = new Date('2024-12-09T17:00:00.000Z');
      const preparationTime = timingController.calculatePreparationTime(targetTime);
      
      expect(preparationTime.getTime()).toBe(targetTime.getTime() - 30000);
    });

    it('should calculate preparation time with custom buffer', () => {
      const targetTime = new Date('2024-12-09T17:00:00.000Z');
      const bufferSeconds = 60;
      const preparationTime = timingController.calculatePreparationTime(targetTime, bufferSeconds);
      
      expect(preparationTime.getTime()).toBe(targetTime.getTime() - 60000);
    });

    it('should handle zero buffer', () => {
      const targetTime = new Date('2024-12-09T17:00:00.000Z');
      const preparationTime = timingController.calculatePreparationTime(targetTime, 0);
      
      expect(preparationTime.getTime()).toBe(targetTime.getTime());
    });
  });

  describe('getCurrentTime', () => {
    it('should return current time', () => {
      const mockTime = new Date('2024-12-09T17:00:00.000Z');
      vi.setSystemTime(mockTime);
      
      const currentTime = timingController.getCurrentTime();
      expect(currentTime.getTime()).toBe(mockTime.getTime());
    });
  });

  describe('getTimeDifference', () => {
    it('should calculate positive difference when target is in future', () => {
      const current = new Date('2024-12-09T17:00:00.000Z');
      const target = new Date('2024-12-09T17:00:05.000Z');
      
      const difference = timingController.getTimeDifference(target, current);
      expect(difference).toBe(5000); // 5 seconds
    });

    it('should calculate negative difference when target is in past', () => {
      const current = new Date('2024-12-09T17:00:05.000Z');
      const target = new Date('2024-12-09T17:00:00.000Z');
      
      const difference = timingController.getTimeDifference(target, current);
      expect(difference).toBe(-5000); // -5 seconds
    });

    it('should use current time when no current time provided', () => {
      const mockTime = new Date('2024-12-09T17:00:00.000Z');
      vi.setSystemTime(mockTime);
      
      const target = new Date('2024-12-09T17:00:05.000Z');
      const difference = timingController.getTimeDifference(target);
      expect(difference).toBe(5000);
    });
  });

  describe('waitUntilExactTime', () => {
    it('should return immediately if target time has passed', async () => {
      const pastTime = new Date('2024-12-09T16:59:00.000Z');
      vi.setSystemTime(new Date('2024-12-09T17:00:00.000Z'));
      
      const startTime = Date.now();
      await timingController.waitUntilExactTime(pastTime);
      const endTime = Date.now();
      
      expect(endTime - startTime).toBeLessThan(10); // Should return almost immediately
    });

    it('should wait for short durations with high precision polling', async () => {
      const currentTime = new Date('2024-12-09T17:00:00.000Z');
      const targetTime = new Date('2024-12-09T17:00:00.500Z'); // 500ms in future
      
      vi.setSystemTime(currentTime);
      
      const waitPromise = timingController.waitUntilExactTime(targetTime);
      
      // Advance time to just before target
      vi.advanceTimersByTime(499);
      await vi.runOnlyPendingTimersAsync();
      
      // Advance to exact target time
      vi.advanceTimersByTime(1);
      await vi.runOnlyPendingTimersAsync();
      
      await waitPromise;
      expect(vi.getTimerCount()).toBe(0);
    });

    it('should handle longer waits with coarse then fine timing', async () => {
      const currentTime = new Date('2024-12-09T17:00:00.000Z');
      const targetTime = new Date('2024-12-09T17:00:02.000Z'); // 2 seconds in future
      
      vi.setSystemTime(currentTime);
      
      const waitPromise = timingController.waitUntilExactTime(targetTime);
      
      // Advance to 1 second before target (coarse wait)
      vi.advanceTimersByTime(1000);
      await vi.runOnlyPendingTimersAsync();
      
      // Advance through fine-grained polling
      vi.advanceTimersByTime(1000);
      await vi.runOnlyPendingTimersAsync();
      
      await waitPromise;
      expect(vi.getTimerCount()).toBe(0);
    });
  });

  describe('measureExecutionTime', () => {
    it('should measure execution time of async operation', async () => {
      const mockOperation = vi.fn().mockImplementation(async () => {
        // Simulate 100ms operation
        vi.advanceTimersByTime(100);
        return 'result';
      });

      const result = await timingController.measureExecutionTime(mockOperation);
      
      expect(result.result).toBe('result');
      expect(result.duration).toBe(100);
      expect(mockOperation).toHaveBeenCalledOnce();
    });

    it('should handle operations that throw errors', async () => {
      const mockOperation = vi.fn().mockRejectedValue(new Error('Test error'));

      await expect(timingController.measureExecutionTime(mockOperation)).rejects.toThrow('Test error');
      expect(mockOperation).toHaveBeenCalledOnce();
    });
  });

  describe('executeAtExactTime', () => {
    it('should execute operation at exact target time and measure accuracy', async () => {
      const currentTime = new Date('2024-12-09T17:00:00.000Z');
      const targetTime = new Date('2024-12-09T17:00:00.100Z'); // 100ms in future
      
      vi.setSystemTime(currentTime);
      
      const mockOperation = vi.fn().mockImplementation(async () => {
        vi.advanceTimersByTime(50); // Operation takes 50ms
        return 'executed';
      });

      const executePromise = timingController.executeAtExactTime(targetTime, mockOperation);
      
      // Advance to target time
      vi.advanceTimersByTime(100);
      await vi.runOnlyPendingTimersAsync();
      
      const result = await executePromise;
      
      expect(result.result).toBe('executed');
      expect(result.duration).toBe(50);
      expect(result.accuracy).toBe(0); // Should be executed exactly at target time
      expect(mockOperation).toHaveBeenCalledOnce();
    });
  });

  describe('prepareForCriticalTiming', () => {
    it('should wait until preparation time and execute preparation operation', async () => {
      const currentTime = new Date('2024-12-09T17:00:00.000Z');
      const targetTime = new Date('2024-12-09T17:00:30.000Z'); // 30 seconds in future
      
      vi.setSystemTime(currentTime);
      
      const mockPreparation = vi.fn().mockResolvedValue(undefined);
      
      const preparePromise = timingController.prepareForCriticalTiming(
        targetTime, 
        30, 
        mockPreparation
      );
      
      // Should wait until preparation time (target time - buffer = now)
      await vi.runOnlyPendingTimersAsync();
      
      await preparePromise;
      
      expect(mockPreparation).toHaveBeenCalledOnce();
    });

    it('should work without preparation operation', async () => {
      const currentTime = new Date('2024-12-09T17:00:00.000Z');
      const targetTime = new Date('2024-12-09T17:00:30.000Z');
      
      vi.setSystemTime(currentTime);
      
      const preparePromise = timingController.prepareForCriticalTiming(targetTime, 30);
      
      await vi.runOnlyPendingTimersAsync();
      await preparePromise;
      
      // Should complete without errors
      expect(true).toBe(true);
    });
  });

  describe('createTimingMetrics', () => {
    it('should create comprehensive timing metrics', () => {
      const preparationStart = new Date('2024-12-09T17:00:00.000Z');
      const preparationEnd = new Date('2024-12-09T17:00:25.000Z');
      const executionStart = new Date('2024-12-09T17:00:30.000Z');
      const executionEnd = new Date('2024-12-09T17:00:30.100Z');
      const targetTime = new Date('2024-12-09T17:00:30.005Z');
      
      const metrics = timingController.createTimingMetrics(
        preparationStart,
        preparationEnd,
        executionStart,
        executionEnd,
        targetTime
      );
      
      expect(metrics.preparationDuration).toBe(25000); // 25 seconds
      expect(metrics.executionDuration).toBe(100); // 100ms
      expect(metrics.targetAccuracy).toBe(-5); // 5ms early
      expect(metrics.totalDuration).toBe(30100); // Total time
    });
  });

  describe('isWithinTimingWindow', () => {
    it('should return true when within tolerance', () => {
      const targetTime = new Date('2024-12-09T17:00:00.000Z');
      const currentTime = new Date('2024-12-09T17:00:00.050Z'); // 50ms later
      
      const isWithin = timingController.isWithinTimingWindow(currentTime, targetTime, 100);
      expect(isWithin).toBe(true);
    });

    it('should return false when outside tolerance', () => {
      const targetTime = new Date('2024-12-09T17:00:00.000Z');
      const currentTime = new Date('2024-12-09T17:00:00.150Z'); // 150ms later
      
      const isWithin = timingController.isWithinTimingWindow(currentTime, targetTime, 100);
      expect(isWithin).toBe(false);
    });

    it('should use default tolerance of 100ms', () => {
      const targetTime = new Date('2024-12-09T17:00:00.000Z');
      const currentTime = new Date('2024-12-09T17:00:00.099Z'); // 99ms later
      
      const isWithin = timingController.isWithinTimingWindow(currentTime, targetTime);
      expect(isWithin).toBe(true);
    });

    it('should handle negative differences (early execution)', () => {
      const targetTime = new Date('2024-12-09T17:00:00.100Z');
      const currentTime = new Date('2024-12-09T17:00:00.050Z'); // 50ms early
      
      const isWithin = timingController.isWithinTimingWindow(currentTime, targetTime, 100);
      expect(isWithin).toBe(true);
    });
  });

  describe('formatTimingInfo', () => {
    it('should format timing metrics into readable string', () => {
      const metrics: TimingMetrics = {
        preparationDuration: 25000,
        executionDuration: 100,
        targetAccuracy: -5,
        totalDuration: 30100
      };
      
      const formatted = timingController.formatTimingInfo(metrics);
      
      expect(formatted).toBe(
        'Preparation: 25000ms | Execution: 100ms | Target Accuracy: -5ms | Total Duration: 30100ms'
      );
    });
  });
});

describe('TimingController Integration Tests', () => {
  let timingController: TimingController;
  
  beforeEach(() => {
    timingController = new TimingController();
  });

  describe('Real timing precision tests', () => {
    it('should demonstrate high precision timing in real environment', async () => {
      const targetTime = new Date(Date.now() + 50); // 50ms in future
      const tolerance = 10; // 10ms tolerance
      
      const result = await timingController.executeAtExactTime(targetTime, async () => {
        return 'precise execution';
      });
      
      expect(result.result).toBe('precise execution');
      expect(Math.abs(result.accuracy || 0)).toBeLessThan(tolerance);
    }, 1000);

    it('should handle preparation phase timing', async () => {
      const targetTime = new Date(Date.now() + 100); // 100ms in future
      let preparationExecuted = false;
      
      await timingController.prepareForCriticalTiming(
        targetTime,
        0.05, // 50ms buffer
        async () => {
          preparationExecuted = true;
        }
      );
      
      expect(preparationExecuted).toBe(true);
    }, 1000);
  });

  describe('Error handling', () => {
    it('should handle operations that throw during execution', async () => {
      const targetTime = new Date(Date.now() + 10);
      
      await expect(
        timingController.executeAtExactTime(targetTime, async () => {
          throw new Error('Execution failed');
        })
      ).rejects.toThrow('Execution failed');
    });

    it('should handle invalid target times gracefully', async () => {
      const pastTime = new Date(Date.now() - 1000); // 1 second ago
      
      const result = await timingController.executeAtExactTime(pastTime, async () => {
        return 'executed anyway';
      });
      
      expect(result.result).toBe('executed anyway');
      expect(result.accuracy).toBeGreaterThanOrEqual(1000); // Should be significantly late
    });
  });
});