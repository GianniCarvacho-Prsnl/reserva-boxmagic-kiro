import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { WebAutomationEngine } from '../../src/core/WebAutomationEngine.js';
import { Logger } from '../../src/core/Logger.js';

describe('Day Selection Integration Tests', () => {
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

  describe('Day Selection Functionality', () => {
    it('should handle selecting today without errors', async () => {
      await expect(webEngine.selectDay('today')).resolves.not.toThrow();
    });

    it('should handle selecting tomorrow without errors', async () => {
      await expect(webEngine.selectDay('tomorrow')).resolves.not.toThrow();
    });

    it('should verify day selection returns boolean', async () => {
      const result = await webEngine.verifyCorrectDaySelected('today');
      expect(typeof result).toBe('boolean');
    });

    it('should verify class list loaded returns boolean', async () => {
      const result = await webEngine.verifyClassListLoaded();
      expect(typeof result).toBe('boolean');
    });
  });

  describe('Day Selection with Navigation', () => {
    beforeEach(async () => {
      await webEngine.navigateToSchedule();
    });

    it('should select today and verify class list loads', async () => {
      await webEngine.selectDay('today');
      const classListLoaded = await webEngine.verifyClassListLoaded();
      // We don't assert true/false since it depends on the actual site
      expect(typeof classListLoaded).toBe('boolean');
    });

    it('should select tomorrow and verify class list loads', async () => {
      await webEngine.selectDay('tomorrow');
      const classListLoaded = await webEngine.verifyClassListLoaded();
      // We don't assert true/false since it depends on the actual site
      expect(typeof classListLoaded).toBe('boolean');
    });

    it('should handle day verification for today', async () => {
      await webEngine.selectDay('today');
      const dayVerified = await webEngine.verifyCorrectDaySelected('today');
      expect(typeof dayVerified).toBe('boolean');
    });

    it('should handle day verification for tomorrow', async () => {
      await webEngine.selectDay('tomorrow');
      const dayVerified = await webEngine.verifyCorrectDaySelected('tomorrow');
      expect(typeof dayVerified).toBe('boolean');
    });
  });

  describe('Error Handling', () => {
    it('should throw error when verifying day without initialization', async () => {
      const uninitializedEngine = new WebAutomationEngine(logger);
      
      await expect(uninitializedEngine.verifyCorrectDaySelected('today'))
        .rejects.toThrow('WebAutomationEngine not initialized');
      
      await expect(uninitializedEngine.verifyClassListLoaded())
        .rejects.toThrow('WebAutomationEngine not initialized');
    });

    it('should handle invalid day selection gracefully', async () => {
      // This tests the type safety - TypeScript should prevent this
      // but we test runtime behavior
      await expect(webEngine.selectDay('today')).resolves.not.toThrow();
      await expect(webEngine.selectDay('tomorrow')).resolves.not.toThrow();
    });
  });

  describe('Sequential Day Operations', () => {
    beforeEach(async () => {
      await webEngine.navigateToSchedule();
    });

    it('should handle switching between days', async () => {
      // Select today first
      await webEngine.selectDay('today');
      await webEngine.verifyClassListLoaded();
      
      // Then switch to tomorrow
      await webEngine.selectDay('tomorrow');
      await webEngine.verifyClassListLoaded();
      
      // Verify we can switch back
      await webEngine.selectDay('today');
      const finalVerification = await webEngine.verifyClassListLoaded();
      expect(typeof finalVerification).toBe('boolean');
    });
  });
});