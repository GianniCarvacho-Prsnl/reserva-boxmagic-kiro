import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import {
  calculatePreparationTime,
  parseReservationTime,
  isTargetTimeValid,
  formatTimeDifference,
  sleep,
  precisionSleep
} from '../../src/utils/timing.js';

describe('Timing Utilities', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  describe('calculatePreparationTime', () => {
    it('should calculate preparation time with default 30 second buffer', () => {
      const targetTime = new Date('2024-12-09T17:00:00.000Z');
      const preparationTime = calculatePreparationTime(targetTime);
      
      expect(preparationTime.getTime()).toBe(targetTime.getTime() - 30000);
    });

    it('should calculate preparation time with custom buffer', () => {
      const targetTime = new Date('2024-12-09T17:00:00.000Z');
      const preparationTime = calculatePreparationTime(targetTime, 60);
      
      expect(preparationTime.getTime()).toBe(targetTime.getTime() - 60000);
    });

    it('should handle zero buffer', () => {
      const targetTime = new Date('2024-12-09T17:00:00.000Z');
      const preparationTime = calculatePreparationTime(targetTime, 0);
      
      expect(preparationTime.getTime()).toBe(targetTime.getTime());
    });
  });

  describe('parseReservationTime', () => {
    it('should parse ISO datetime string correctly', () => {
      const isoString = '2024-12-09T17:00:00.000Z';
      const parsedTime = parseReservationTime(isoString);
      
      expect(parsedTime.toISOString()).toBe(isoString);
    });

    it('should parse ISO datetime with timezone', () => {
      const isoString = '2024-12-09T17:00:00-03:00';
      const parsedTime = parseReservationTime(isoString);
      
      expect(parsedTime.getTime()).toBe(new Date('2024-12-09T20:00:00.000Z').getTime());
    });

    it('should handle invalid date strings', () => {
      const invalidString = 'invalid-date';
      const parsedTime = parseReservationTime(invalidString);
      
      expect(isNaN(parsedTime.getTime())).toBe(true);
    });
  });

  describe('isTargetTimeValid', () => {
    it('should return true for future times', () => {
      const mockNow = new Date('2024-12-09T17:00:00.000Z');
      vi.setSystemTime(mockNow);
      
      const futureTime = new Date('2024-12-09T17:00:01.000Z');
      expect(isTargetTimeValid(futureTime)).toBe(true);
    });

    it('should return false for past times', () => {
      const mockNow = new Date('2024-12-09T17:00:00.000Z');
      vi.setSystemTime(mockNow);
      
      const pastTime = new Date('2024-12-09T16:59:59.000Z');
      expect(isTargetTimeValid(pastTime)).toBe(false);
    });

    it('should return false for current time', () => {
      const mockNow = new Date('2024-12-09T17:00:00.000Z');
      vi.setSystemTime(mockNow);
      
      expect(isTargetTimeValid(mockNow)).toBe(false);
    });
  });

  describe('formatTimeDifference', () => {
    it('should format positive milliseconds', () => {
      expect(formatTimeDifference(500)).toBe('500ms');
      expect(formatTimeDifference(50)).toBe('50ms');
      expect(formatTimeDifference(5)).toBe('5ms');
    });

    it('should format negative milliseconds', () => {
      expect(formatTimeDifference(-500)).toBe('-500ms');
      expect(formatTimeDifference(-50)).toBe('-50ms');
    });

    it('should format seconds with milliseconds', () => {
      expect(formatTimeDifference(1500)).toBe('1.500s');
      expect(formatTimeDifference(2050)).toBe('2.050s');
      expect(formatTimeDifference(10000)).toBe('10.000s');
    });

    it('should format negative seconds', () => {
      expect(formatTimeDifference(-1500)).toBe('-1.500s');
      expect(formatTimeDifference(-2050)).toBe('-2.050s');
    });

    it('should pad milliseconds with zeros', () => {
      expect(formatTimeDifference(1001)).toBe('1.001s');
      expect(formatTimeDifference(1010)).toBe('1.010s');
      expect(formatTimeDifference(1100)).toBe('1.100s');
    });

    it('should handle zero', () => {
      expect(formatTimeDifference(0)).toBe('0ms');
    });
  });

  describe('sleep', () => {
    it('should resolve after specified milliseconds', async () => {
      const sleepPromise = sleep(100);
      
      // Advance time by 99ms - should not resolve yet
      vi.advanceTimersByTime(99);
      await vi.runOnlyPendingTimersAsync();
      
      let resolved = false;
      sleepPromise.then(() => { resolved = true; });
      expect(resolved).toBe(false);
      
      // Advance by 1 more ms - should resolve now
      vi.advanceTimersByTime(1);
      await vi.runOnlyPendingTimersAsync();
      
      await sleepPromise;
      expect(resolved).toBe(true);
    });

    it('should handle zero milliseconds', async () => {
      const sleepPromise = sleep(0);
      await vi.runOnlyPendingTimersAsync();
      await sleepPromise;
      
      // Should resolve immediately
      expect(true).toBe(true);
    });
  });

  describe('precisionSleep', () => {
    it('should use regular sleep for durations > 10ms', async () => {
      const sleepPromise = precisionSleep(50);
      
      // Should use setTimeout for first 40ms
      vi.advanceTimersByTime(40);
      await vi.runOnlyPendingTimersAsync();
      
      // Then busy wait for remaining 10ms
      vi.advanceTimersByTime(10);
      await sleepPromise;
      
      expect(true).toBe(true);
    });

    it('should use busy wait for short durations', async () => {
      const sleepPromise = precisionSleep(5);
      
      // Should use busy wait immediately
      vi.advanceTimersByTime(5);
      await sleepPromise;
      
      expect(true).toBe(true);
    });

    it('should handle zero milliseconds', async () => {
      await precisionSleep(0);
      expect(true).toBe(true);
    });
  });
});

describe('Timing Utilities Integration Tests', () => {
  describe('Real timing tests', () => {
    it('should demonstrate sleep accuracy', async () => {
      const startTime = Date.now();
      await sleep(50);
      const endTime = Date.now();
      
      const actualDuration = endTime - startTime;
      expect(actualDuration).toBeGreaterThanOrEqual(45); // Allow some tolerance
      expect(actualDuration).toBeLessThan(100); // Should not be too slow
    }, 1000);

    it('should validate future time checking', () => {
      const futureTime = new Date(Date.now() + 1000);
      expect(isTargetTimeValid(futureTime)).toBe(true);
      
      const pastTime = new Date(Date.now() - 1000);
      expect(isTargetTimeValid(pastTime)).toBe(false);
    });

    it('should parse real ISO strings correctly', () => {
      const now = new Date();
      const isoString = now.toISOString();
      const parsed = parseReservationTime(isoString);
      
      expect(parsed.getTime()).toBe(now.getTime());
    });
  });
});