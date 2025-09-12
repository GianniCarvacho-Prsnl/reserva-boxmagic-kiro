import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { WebAutomationEngine } from '../../src/core/WebAutomationEngine.js';
import { Logger } from '../../src/core/Logger.js';

describe('Class Status Detection Integration Tests', () => {
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

  describe('Class Status Checking', () => {
    it('should return valid status for non-existent class', async () => {
      const status = await webEngine.checkClassStatus('NonExistentClass123');
      expect(['available', 'full', 'already_booked', 'not_found']).toContain(status);
      // We expect 'not_found' for a clearly non-existent class
      expect(status).toBe('not_found');
    });

    it('should handle common class names without errors', async () => {
      const commonClassNames = ['CrossFit', 'METCON', '18:00 CrossFit', 'Yoga', 'Pilates'];
      
      for (const className of commonClassNames) {
        const status = await webEngine.checkClassStatus(className);
        expect(['available', 'full', 'already_booked', 'not_found']).toContain(status);
      }
    });

    it('should handle empty class name gracefully', async () => {
      const status = await webEngine.checkClassStatus('');
      expect(['available', 'full', 'already_booked', 'not_found']).toContain(status);
    });

    it('should handle special characters in class names', async () => {
      const specialClassNames = ['18:00 CrossFit', 'HIIT & Core', 'Yoga (Principiantes)'];
      
      for (const className of specialClassNames) {
        const status = await webEngine.checkClassStatus(className);
        expect(['available', 'full', 'already_booked', 'not_found']).toContain(status);
      }
    });
  });

  describe('Class Existence Verification', () => {
    it('should return boolean for class existence check', async () => {
      const exists = await webEngine.verifyClassExists('TestClass');
      expect(typeof exists).toBe('boolean');
    });

    it('should handle multiple class existence checks', async () => {
      const classNames = ['CrossFit', 'METCON', 'NonExistent'];
      
      for (const className of classNames) {
        const exists = await webEngine.verifyClassExists(className);
        expect(typeof exists).toBe('boolean');
      }
    });

    it('should return false for clearly non-existent class', async () => {
      const exists = await webEngine.verifyClassExists('ThisClassDefinitelyDoesNotExist123456');
      expect(exists).toBe(false);
    });
  });

  describe('Participant Information', () => {
    it('should return null or valid participant info', async () => {
      const participantInfo = await webEngine.getParticipantInfo('TestClass');
      
      if (participantInfo !== null) {
        expect(typeof participantInfo.current).toBe('number');
        expect(typeof participantInfo.max).toBe('number');
        expect(participantInfo.current).toBeGreaterThanOrEqual(0);
        expect(participantInfo.max).toBeGreaterThan(0);
        expect(participantInfo.current).toBeLessThanOrEqual(participantInfo.max);
      }
    });

    it('should handle multiple participant info requests', async () => {
      const classNames = ['CrossFit', 'METCON', 'Yoga'];
      
      for (const className of classNames) {
        const participantInfo = await webEngine.getParticipantInfo(className);
        
        if (participantInfo !== null) {
          expect(typeof participantInfo.current).toBe('number');
          expect(typeof participantInfo.max).toBe('number');
        }
      }
    });
  });

  describe('Available Spaces Calculation', () => {
    it('should return null or valid number for available spaces', async () => {
      const availableSpaces = await webEngine.getAvailableSpaces('TestClass');
      
      if (availableSpaces !== null) {
        expect(typeof availableSpaces).toBe('number');
        expect(availableSpaces).toBeGreaterThanOrEqual(0);
      }
    });

    it('should calculate available spaces correctly when participant info exists', async () => {
      // Mock a scenario where we can test the calculation
      const participantInfo = await webEngine.getParticipantInfo('TestClass');
      const availableSpaces = await webEngine.getAvailableSpaces('TestClass');
      
      if (participantInfo !== null && availableSpaces !== null) {
        expect(availableSpaces).toBe(participantInfo.max - participantInfo.current);
      }
    });
  });

  describe('Class Status with Navigation', () => {
    beforeEach(async () => {
      await webEngine.navigateToSchedule();
    });

    it('should check class status after navigation', async () => {
      const status = await webEngine.checkClassStatus('CrossFit');
      expect(['available', 'full', 'already_booked', 'not_found']).toContain(status);
    });

    it('should verify class existence after navigation', async () => {
      const exists = await webEngine.verifyClassExists('CrossFit');
      expect(typeof exists).toBe('boolean');
    });

    it('should get participant info after navigation', async () => {
      const participantInfo = await webEngine.getParticipantInfo('CrossFit');
      
      if (participantInfo !== null) {
        expect(typeof participantInfo.current).toBe('number');
        expect(typeof participantInfo.max).toBe('number');
      }
    });
  });

  describe('Error Handling', () => {
    it('should throw error when checking status without initialization', async () => {
      const uninitializedEngine = new WebAutomationEngine(logger);
      
      await expect(uninitializedEngine.checkClassStatus('TestClass'))
        .rejects.toThrow('WebAutomationEngine not initialized');
      
      await expect(uninitializedEngine.verifyClassExists('TestClass'))
        .rejects.toThrow('WebAutomationEngine not initialized');
      
      await expect(uninitializedEngine.getParticipantInfo('TestClass'))
        .rejects.toThrow('WebAutomationEngine not initialized');
      
      await expect(uninitializedEngine.getAvailableSpaces('TestClass'))
        .rejects.toThrow('WebAutomationEngine not initialized');
    });

    it('should handle network errors gracefully', async () => {
      // Test with a very long class name that might cause issues
      const longClassName = 'A'.repeat(1000);
      const status = await webEngine.checkClassStatus(longClassName);
      expect(['available', 'full', 'already_booked', 'not_found']).toContain(status);
    });
  });

  describe('Different Class Status Scenarios', () => {
    it('should handle various class name formats', async () => {
      const classNameFormats = [
        'CrossFit',
        '18:00 CrossFit',
        'METCON',
        'Yoga Principiantes',
        'HIIT',
        'Functional Training'
      ];
      
      for (const className of classNameFormats) {
        const status = await webEngine.checkClassStatus(className);
        const exists = await webEngine.verifyClassExists(className);
        const participantInfo = await webEngine.getParticipantInfo(className);
        const availableSpaces = await webEngine.getAvailableSpaces(className);
        
        expect(['available', 'full', 'already_booked', 'not_found']).toContain(status);
        expect(typeof exists).toBe('boolean');
        
        if (participantInfo !== null) {
          expect(typeof participantInfo.current).toBe('number');
          expect(typeof participantInfo.max).toBe('number');
        }
        
        if (availableSpaces !== null) {
          expect(typeof availableSpaces).toBe('number');
        }
      }
    });
  });
});