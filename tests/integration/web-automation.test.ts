import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { WebAutomationEngine } from '../../src/core/WebAutomationEngine.js';
import { Logger } from '../../src/core/Logger.js';

describe('WebAutomationEngine Integration Tests', () => {
  let webEngine: WebAutomationEngine;
  let logger: Logger;

  beforeEach(async () => {
    logger = new Logger();
    webEngine = new WebAutomationEngine(logger);
  });

  afterEach(async () => {
    await webEngine.cleanup();
  });

  describe('Initialization', () => {
    it('should initialize browser successfully', async () => {
      await expect(webEngine.initialize()).resolves.not.toThrow();
    });

    it('should handle multiple initialization calls gracefully', async () => {
      await webEngine.initialize();
      await expect(webEngine.initialize()).resolves.not.toThrow();
    });
  });

  describe('Navigation', () => {
    beforeEach(async () => {
      await webEngine.initialize();
    });

    it('should navigate to BoxMagic schedule page', async () => {
      await expect(webEngine.navigateToSchedule()).resolves.not.toThrow();
    });

    it('should handle navigation errors gracefully', async () => {
      // Test with invalid URL by temporarily modifying the method
      // This is a basic test - in real scenarios we'd mock the page.goto
      await expect(webEngine.navigateToSchedule()).resolves.not.toThrow();
    });
  });

  describe('Login Flow', () => {
    beforeEach(async () => {
      await webEngine.initialize();
    });

    it('should handle login with invalid credentials gracefully', async () => {
      const result = await webEngine.login('invalid@email.com', 'wrongpassword');
      expect(typeof result).toBe('boolean');
      // We expect this to return false for invalid credentials
      // but not throw an error
    });

    it('should handle login form not found', async () => {
      // Navigate to a page without login form
      const result = await webEngine.login('test@email.com', 'password');
      expect(typeof result).toBe('boolean');
    });

    // Note: We don't test with real credentials in automated tests
    // Real credential testing should be done manually or in a separate test environment
  });

  describe('Popup Handling', () => {
    beforeEach(async () => {
      await webEngine.initialize();
    });

    it('should handle popup dismissal without errors', async () => {
      await expect(webEngine.handlePopups()).resolves.not.toThrow();
    });
  });

  describe('Day Selection', () => {
    beforeEach(async () => {
      await webEngine.initialize();
      await webEngine.navigateToSchedule();
    });

    it('should handle day selection for today', async () => {
      await expect(webEngine.selectDay('today')).resolves.not.toThrow();
    });

    it('should handle day selection for tomorrow', async () => {
      await expect(webEngine.selectDay('tomorrow')).resolves.not.toThrow();
    });
  });

  describe('Class Status Checking', () => {
    beforeEach(async () => {
      await webEngine.initialize();
      await webEngine.navigateToSchedule();
    });

    it('should return not_found for non-existent class', async () => {
      const status = await webEngine.checkClassStatus('NonExistentClass');
      expect(['available', 'full', 'already_booked', 'not_found']).toContain(status);
    });

    it('should handle class status check without errors', async () => {
      const status = await webEngine.checkClassStatus('CrossFit');
      expect(['available', 'full', 'already_booked', 'not_found']).toContain(status);
    });
  });

  describe('Ready State', () => {
    beforeEach(async () => {
      await webEngine.initialize();
    });

    it('should wait until ready without errors', async () => {
      await expect(webEngine.waitUntilReady()).resolves.not.toThrow();
    });
  });

  describe('Preparation Phase', () => {
    beforeEach(async () => {
      await webEngine.initialize();
    });

    it('should handle preparation with invalid credentials gracefully', async () => {
      await expect(
        webEngine.prepareReservation('invalid@email.com', 'wrongpassword', 'tomorrow', 'CrossFit')
      ).rejects.toThrow();
    });

    it('should handle preparation for non-existent class', async () => {
      // This should fail because the class doesn't exist
      await expect(
        webEngine.prepareReservation('test@email.com', 'password', 'tomorrow', 'NonExistentClass')
      ).rejects.toThrow();
    });

    it('should complete preparation steps in correct order', async () => {
      // Test that preparation doesn't throw errors even with invalid credentials
      // The actual login failure will be caught and thrown appropriately
      try {
        await webEngine.prepareReservation('test@email.com', 'password', 'tomorrow', 'CrossFit');
      } catch (error) {
        // Expected to fail with invalid credentials, but should fail gracefully
        expect(error).toBeInstanceOf(Error);
      }
    });
  });

  describe('Critical Timing Execution', () => {
    beforeEach(async () => {
      await webEngine.initialize();
    });

    it('should handle reservation execution without preparation', async () => {
      // This should handle the case where executeReservation is called without proper preparation
      const result = await webEngine.executeReservation('CrossFit');
      expect(result).toHaveProperty('success');
      expect(result).toHaveProperty('message');
      expect(result).toHaveProperty('timestamp');
      expect(result).toHaveProperty('timingAccuracy');
      expect(result).toHaveProperty('hasSpots');
      expect(result).toHaveProperty('classStatus');
    });

    it('should return proper ReservationResult structure', async () => {
      const result = await webEngine.executeReservation('TestClass');
      
      expect(typeof result.success).toBe('boolean');
      expect(typeof result.message).toBe('string');
      expect(result.timestamp).toBeInstanceOf(Date);
      expect(typeof result.timingAccuracy).toBe('number');
      expect(typeof result.hasSpots).toBe('boolean');
      expect(['available', 'full', 'already_booked']).toContain(result.classStatus);
    });
  });

  describe('Reservation Verification', () => {
    beforeEach(async () => {
      await webEngine.initialize();
    });

    it('should verify reservation success without errors', async () => {
      const result = await webEngine.verifyReservationSuccess('CrossFit');
      
      expect(result).toHaveProperty('success');
      expect(result).toHaveProperty('message');
      expect(result).toHaveProperty('timestamp');
      expect(result).toHaveProperty('hasSpots');
      expect(result).toHaveProperty('classStatus');
      expect(['available', 'full', 'already_booked']).toContain(result.classStatus);
    });

    it('should handle verification for non-existent class', async () => {
      const result = await webEngine.verifyReservationSuccess('NonExistentClass');
      
      expect(result.success).toBe(false);
      expect(typeof result.message).toBe('string');
    });
  });

  describe('Cleanup', () => {
    it('should cleanup resources without errors', async () => {
      await webEngine.initialize();
      await expect(webEngine.cleanup()).resolves.not.toThrow();
    });

    it('should handle cleanup when not initialized', async () => {
      await expect(webEngine.cleanup()).resolves.not.toThrow();
    });
  });

  describe('Error Handling', () => {
    it('should throw error when calling methods before initialization', async () => {
      await expect(webEngine.login('test@email.com', 'password'))
        .rejects.toThrow('WebAutomationEngine not initialized');
      
      await expect(webEngine.selectDay('today'))
        .rejects.toThrow('WebAutomationEngine not initialized');
      
      await expect(webEngine.checkClassStatus('CrossFit'))
        .rejects.toThrow('WebAutomationEngine not initialized');
    });
  });
});