import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { chromium, Browser, Page, BrowserContext } from 'playwright';
import { EdgeCaseHandler } from '../../src/utils/EdgeCaseHandler';
import { Logger } from '../../src/core/Logger';
import { ErrorType } from '../../src/types/ErrorTypes';

describe('Edge Case Handler Integration Tests', () => {
  let browser: Browser;
  let context: BrowserContext;
  let page: Page;
  let logger: Logger;
  let edgeCaseHandler: EdgeCaseHandler;

  beforeEach(async () => {
    browser = await chromium.launch({ headless: true });
    context = await browser.newContext();
    page = await context.newPage();
    logger = new Logger();
    
    // Mock logger methods to avoid console output during tests
    vi.spyOn(logger, 'logInfo').mockImplementation(() => {});
    vi.spyOn(logger, 'logError').mockImplementation(() => {});
    
    edgeCaseHandler = new EdgeCaseHandler(page, browser, logger);
  });

  afterEach(async () => {
    await context.close();
    await browser.close();
    vi.restoreAllMocks();
  });

  describe('Popup Handling', () => {
    it('should detect and close generic OK popup', async () => {
      // Create a test page with a popup
      await page.setContent(`
        <html>
          <body>
            <div id="popup" style="display: block;">
              <p>This is a popup message</p>
              <button>OK</button>
            </div>
            <div id="main-content">Main content</div>
          </body>
        </html>
      `);

      const result = await edgeCaseHandler.handleUnexpectedPopups();
      
      expect(result).toBe(true);
      expect(logger.logInfo).toHaveBeenCalledWith(
        expect.stringContaining('Found popup'),
        expect.any(Object)
      );
    });

    it('should detect and close Spanish accept button', async () => {
      await page.setContent(`
        <html>
          <body>
            <div class="modal">
              <p>Mensaje de confirmación</p>
              <button>Aceptar</button>
            </div>
          </body>
        </html>
      `);

      const result = await edgeCaseHandler.handleUnexpectedPopups();
      
      expect(result).toBe(true);
    });

    it('should handle cookie consent popup', async () => {
      await page.setContent(`
        <html>
          <body>
            <div class="cookie-consent">
              <p>We use cookies</p>
              <button>Accept</button>
            </div>
          </body>
        </html>
      `);

      const result = await edgeCaseHandler.handleUnexpectedPopups();
      
      expect(result).toBe(true);
    });

    it('should return false when no popups are present', async () => {
      await page.setContent(`
        <html>
          <body>
            <div id="main-content">No popups here</div>
          </body>
        </html>
      `);

      const result = await edgeCaseHandler.handleUnexpectedPopups();
      
      expect(result).toBe(false);
    });

    it('should handle multiple popups in priority order', async () => {
      await page.setContent(`
        <html>
          <body>
            <div class="high-priority">
              <button>OK</button>
            </div>
            <div class="low-priority">
              <button class="cookie-consent">Accept</button>
            </div>
          </body>
        </html>
      `);

      const result = await edgeCaseHandler.handleUnexpectedPopups();
      
      expect(result).toBe(true);
      // Should handle the higher priority OK button first
    });
  });

  describe('Session Expiration Detection', () => {
    it('should detect login form indicating session expiration', async () => {
      await page.setContent(`
        <html>
          <body>
            <form id="login-form">
              <input name="Correo" type="email" placeholder="Email">
              <input name="password" type="password" placeholder="Contraseña">
              <button type="submit">Ingresar</button>
            </form>
          </body>
        </html>
      `);

      const result = await edgeCaseHandler.detectSessionExpiration();
      
      expect(result.expired).toBe(true);
      expect(result.type).toBe('login_required');
    });

    it('should detect explicit session expired message', async () => {
      await page.setContent(`
        <html>
          <body>
            <div class="error-message">Sesión expirada</div>
          </body>
        </html>
      `);

      const result = await edgeCaseHandler.detectSessionExpiration();
      
      expect(result.expired).toBe(true);
      expect(result.type).toBe('session_expired');
    });

    it('should detect account locked message', async () => {
      await page.setContent(`
        <html>
          <body>
            <div class="error">Cuenta bloqueada</div>
          </body>
        </html>
      `);

      const result = await edgeCaseHandler.detectSessionExpiration();
      
      expect(result.expired).toBe(true);
      expect(result.type).toBe('account_locked');
    });

    it('should return false when session is valid', async () => {
      await page.setContent(`
        <html>
          <body>
            <div id="dashboard">
              <h1>Welcome to your dashboard</h1>
              <div class="user-info">Logged in as user@example.com</div>
            </div>
          </body>
        </html>
      `);

      const result = await edgeCaseHandler.detectSessionExpiration();
      
      expect(result.expired).toBe(false);
    });
  });

  describe('Layout Change Adaptation', () => {
    it('should find alternative selector for email input', async () => {
      await page.setContent(`
        <html>
          <body>
            <form>
              <!-- Original selector not present -->
              <input name="email" type="email" placeholder="Enter your email">
              <input type="password" placeholder="Password">
            </form>
          </body>
        </html>
      `);

      const result = await edgeCaseHandler.adaptToLayoutChanges('textbox[name="Correo"]');
      
      expect(result).toBe('input[name="email"]');
    });

    it('should find alternative selector for password input', async () => {
      await page.setContent(`
        <html>
          <body>
            <form>
              <input type="email" placeholder="Email">
              <!-- Original selector not present -->
              <input name="password" type="password" placeholder="Enter password">
            </form>
          </body>
        </html>
      `);

      const result = await edgeCaseHandler.adaptToLayoutChanges('textbox[placeholder="Contraseña"]');
      
      expect(result).toBe('input[name="password"]');
    });

    it('should find alternative selector for login button', async () => {
      await page.setContent(`
        <html>
          <body>
            <form>
              <input type="email">
              <input type="password">
              <!-- Original selector not present -->
              <button type="submit">Login</button>
            </form>
          </body>
        </html>
      `);

      const result = await edgeCaseHandler.adaptToLayoutChanges('text=Ingresar');
      
      expect(result).toBe('button:has-text("Login")');
    });

    it('should return null when no alternatives work', async () => {
      await page.setContent(`
        <html>
          <body>
            <div>No form elements here</div>
          </body>
        </html>
      `);

      const result = await edgeCaseHandler.adaptToLayoutChanges('textbox[name="Correo"]');
      
      expect(result).toBe(null);
    });

    it('should return null for unconfigured selectors', async () => {
      await page.setContent(`
        <html>
          <body>
            <button id="unknown-button">Unknown</button>
          </body>
        </html>
      `);

      const result = await edgeCaseHandler.adaptToLayoutChanges('button[id="unknown-button"]');
      
      expect(result).toBe(null);
    });
  });

  describe('Network Error Handling', () => {
    it('should retry network operations on failure', async () => {
      let attemptCount = 0;
      const networkOperation = async () => {
        attemptCount++;
        if (attemptCount < 3) {
          throw new Error('Network connection failed');
        }
        return 'success';
      };

      const result = await edgeCaseHandler.handleNetworkErrors(
        networkOperation,
        'test network operation'
      );

      expect(result).toBe('success');
      expect(attemptCount).toBe(3);
    });

    it('should eventually fail after max retries', async () => {
      const networkOperation = async () => {
        throw new Error('Persistent network error');
      };

      await expect(
        edgeCaseHandler.handleNetworkErrors(networkOperation, 'failing operation')
      ).rejects.toThrow();
    });
  });

  describe('Page Health Check', () => {
    it('should report healthy page', async () => {
      await page.setContent(`
        <html>
          <body>
            <div id="main-content">Healthy page content</div>
          </body>
        </html>
      `);

      const health = await edgeCaseHandler.performPageHealthCheck();
      
      expect(health.healthy).toBe(true);
      expect(health.issues).toHaveLength(0);
    });

    it('should detect session expiration in health check', async () => {
      await page.setContent(`
        <html>
          <body>
            <form id="login">
              <input name="Correo" type="email">
              <input type="password">
            </form>
          </body>
        </html>
      `);

      const health = await edgeCaseHandler.performPageHealthCheck();
      
      expect(health.healthy).toBe(false);
      expect(health.issues).toContain(expect.stringContaining('Session expired'));
      expect(health.recommendations).toContain('Re-authenticate user session');
    });

    it('should detect and handle popups in health check', async () => {
      await page.setContent(`
        <html>
          <body>
            <div class="popup">
              <button>OK</button>
            </div>
            <div id="main">Main content</div>
          </body>
        </html>
      `);

      const health = await edgeCaseHandler.performPageHealthCheck();
      
      // Popup should be handled automatically
      expect(health.issues).toContain('Unexpected popups were present');
      expect(health.recommendations).toContain('Popups have been handled automatically');
    });
  });

  describe('Emergency Recovery', () => {
    it('should perform successful emergency recovery', async () => {
      // Set up a page that needs recovery
      await page.setContent(`
        <html>
          <body>
            <div class="popup">
              <button>OK</button>
            </div>
            <div id="main-content">Content after recovery</div>
          </body>
        </html>
      `);

      const result = await edgeCaseHandler.performEmergencyRecovery();
      
      expect(result).toBe(true);
      expect(logger.logInfo).toHaveBeenCalledWith('Emergency recovery completed successfully');
    });

    it('should fail recovery when session is expired', async () => {
      await page.setContent(`
        <html>
          <body>
            <form id="login">
              <input name="Correo" type="email">
              <button>Ingresar</button>
            </form>
          </body>
        </html>
      `);

      const result = await edgeCaseHandler.performEmergencyRecovery();
      
      expect(result).toBe(false);
      expect(logger.logError).toHaveBeenCalledWith(
        expect.any(Error),
        expect.objectContaining({
          sessionType: 'login_required'
        })
      );
    });
  });

  describe('Custom Handlers', () => {
    it('should allow adding custom popup handlers', async () => {
      edgeCaseHandler.addPopupHandler({
        selector: 'button[data-testid="custom-close"]',
        action: 'close',
        priority: 1,
        description: 'Custom test popup'
      });

      await page.setContent(`
        <html>
          <body>
            <div class="custom-popup">
              <button data-testid="custom-close">Close</button>
            </div>
          </body>
        </html>
      `);

      const result = await edgeCaseHandler.handleUnexpectedPopups();
      
      expect(result).toBe(true);
      expect(logger.logInfo).toHaveBeenCalledWith(
        'Added custom popup handler',
        expect.objectContaining({
          selector: 'button[data-testid="custom-close"]'
        })
      );
    });

    it('should allow adding custom session indicators', async () => {
      edgeCaseHandler.addSessionIndicator({
        selector: 'div[data-testid="custom-session-expired"]',
        type: 'session_expired',
        description: 'Custom session expiration indicator'
      });

      await page.setContent(`
        <html>
          <body>
            <div data-testid="custom-session-expired">Your session has expired</div>
          </body>
        </html>
      `);

      const result = await edgeCaseHandler.detectSessionExpiration();
      
      expect(result.expired).toBe(true);
      expect(result.type).toBe('session_expired');
    });

    it('should allow adding custom layout changes', async () => {
      edgeCaseHandler.addLayoutChange({
        expectedSelector: 'button[data-testid="original-button"]',
        alternativeSelectors: ['button[data-testid="new-button"]'],
        description: 'Custom button layout change'
      });

      await page.setContent(`
        <html>
          <body>
            <button data-testid="new-button">New Button</button>
          </body>
        </html>
      `);

      const result = await edgeCaseHandler.adaptToLayoutChanges('button[data-testid="original-button"]');
      
      expect(result).toBe('button[data-testid="new-button"]');
    });
  });

  describe('Error Scenarios', () => {
    it('should handle page crashes gracefully', async () => {
      // Simulate page crash by closing the page
      await page.close();
      
      const result = await edgeCaseHandler.handleUnexpectedPopups();
      
      expect(result).toBe(false);
      expect(logger.logError).toHaveBeenCalled();
    });

    it('should handle browser disconnection', async () => {
      // Close browser to simulate disconnection
      await browser.close();
      
      const result = await edgeCaseHandler.performPageHealthCheck();
      
      expect(result.healthy).toBe(false);
      expect(result.issues).toContain('Health check failed');
    });

    it('should handle network timeouts in health check', async () => {
      // Mock network failure
      await page.route('**/*', route => {
        route.abort('failed');
      });

      const health = await edgeCaseHandler.performPageHealthCheck();
      
      expect(health.healthy).toBe(false);
      expect(health.issues).toContain('Network connectivity issues detected');
    });
  });

  describe('Performance and Timing', () => {
    it('should handle popups within reasonable time', async () => {
      await page.setContent(`
        <html>
          <body>
            <div class="popup">
              <button>OK</button>
            </div>
          </body>
        </html>
      `);

      const startTime = Date.now();
      const result = await edgeCaseHandler.handleUnexpectedPopups();
      const duration = Date.now() - startTime;
      
      expect(result).toBe(true);
      expect(duration).toBeLessThan(5000); // Should complete within 5 seconds
    });

    it('should timeout appropriately for missing elements', async () => {
      await page.setContent(`
        <html>
          <body>
            <div>No popups here</div>
          </body>
        </html>
      `);

      const startTime = Date.now();
      const result = await edgeCaseHandler.handleUnexpectedPopups();
      const duration = Date.now() - startTime;
      
      expect(result).toBe(false);
      expect(duration).toBeLessThan(2000); // Should fail quickly when nothing found
    });
  });
});