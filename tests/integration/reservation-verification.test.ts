import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { WebAutomationEngine } from '../../src/core/WebAutomationEngine.js';
import { Logger } from '../../src/core/Logger.js';

describe('Reservation Verification Tests', () => {
  let webEngine: WebAutomationEngine;
  let logger: Logger;

  beforeEach(async () => {
    logger = new Logger();
    webEngine = new WebAutomationEngine(logger);
    await webEngine.initialize();
  });

  afterEach(async () => {
    await webEngine.cleanup();
  });

  describe('Participant Count Detection', () => {
    it('should detect participant count changes', async () => {
      const previousCount = { current: 5, max: 15 };
      
      const result = await webEngine.detectParticipantCountChange('TestClass', previousCount);
      
      expect(result).toHaveProperty('changed');
      expect(result).toHaveProperty('previousCount');
      expect(result).toHaveProperty('increased');
      expect(typeof result.changed).toBe('boolean');
      expect(typeof result.increased).toBe('boolean');
    });

    it('should handle missing participant count gracefully', async () => {
      const result = await webEngine.detectParticipantCountChange('NonExistentClass');
      
      expect(result.changed).toBe(false);
      expect(result.increased).toBe(false);
    });
  });

  describe('Enhanced Verification', () => {
    it('should provide detailed failure type information', async () => {
      const result = await webEngine.verifyReservationWithFailureTypes('TestClass');
      
      expect(result).toHaveProperty('success');
      expect(result).toHaveProperty('message');
      expect(result).toHaveProperty('timestamp');
      expect(result).toHaveProperty('hasSpots');
      expect(result).toHaveProperty('classStatus');
      
      // Should have failure type for failed reservations
      if (!result.success) {
        expect(result).toHaveProperty('failureType');
        expect(['network_error', 'capacity_full', 'already_booked', 'session_expired', 'class_not_found', 'unknown'])
          .toContain(result.failureType);
      }
    });

    it('should detect participant count changes during verification', async () => {
      const result = await webEngine.verifyReservationWithFailureTypes('TestClass');
      
      // Should have participant count change information
      if (result.participantCountChange) {
        expect(result.participantCountChange).toHaveProperty('changed');
        expect(result.participantCountChange).toHaveProperty('increased');
        expect(typeof result.participantCountChange.changed).toBe('boolean');
        expect(typeof result.participantCountChange.increased).toBe('boolean');
      }
    });
  });

  describe('Error Message Detection', () => {
    it('should handle error detection without throwing', async () => {
      // This tests the private detectErrorMessages method indirectly
      const result = await webEngine.verifyReservationWithFailureTypes('TestClass');
      
      // Should complete without throwing errors
      expect(result).toHaveProperty('success');
      expect(typeof result.success).toBe('boolean');
    });
  });

  describe('Verification Result Structure', () => {
    it('should return consistent ReservationResult structure', async () => {
      const result = await webEngine.verifyReservationSuccess('TestClass');
      
      expect(result).toHaveProperty('success');
      expect(result).toHaveProperty('message');
      expect(result).toHaveProperty('timestamp');
      expect(result).toHaveProperty('timingAccuracy');
      expect(result).toHaveProperty('hasSpots');
      expect(result).toHaveProperty('classStatus');
      
      expect(typeof result.success).toBe('boolean');
      expect(typeof result.message).toBe('string');
      expect(result.timestamp).toBeInstanceOf(Date);
      expect(typeof result.timingAccuracy).toBe('number');
      expect(typeof result.hasSpots).toBe('boolean');
      expect(['available', 'full', 'already_booked']).toContain(result.classStatus);
    });

    it('should handle verification for different class states', async () => {
      const testClasses = ['AvailableClass', 'FullClass', 'BookedClass', 'NonExistentClass'];
      
      for (const className of testClasses) {
        const result = await webEngine.verifyReservationSuccess(className);
        
        expect(result).toHaveProperty('success');
        expect(result).toHaveProperty('classStatus');
        expect(['available', 'full', 'already_booked']).toContain(result.classStatus);
      }
    });
  });

  describe('Timing Accuracy', () => {
    it('should measure verification timing accurately', async () => {
      const startTime = Date.now();
      const result = await webEngine.verifyReservationSuccess('TestClass');
      const endTime = Date.now();
      
      expect(result.timingAccuracy).toBeGreaterThanOrEqual(0);
      expect(result.timestamp.getTime()).toBeGreaterThanOrEqual(startTime);
      expect(result.timestamp.getTime()).toBeLessThanOrEqual(endTime);
    });
  });
});