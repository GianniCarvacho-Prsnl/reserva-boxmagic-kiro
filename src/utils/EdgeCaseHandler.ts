import { Page, Browser } from 'playwright';
import { Logger } from '../core/Logger';
import { ErrorType } from '../types/ErrorTypes';
import { RetryStrategyManager } from './RetryStrategy';

/**
 * Edge case handler for robust error handling and recovery
 * Handles unexpected popups, session expiration, layout changes, and network issues
 */

export interface EdgeCaseConfig {
  popupTimeout: number;
  sessionCheckInterval: number;
  layoutChangeDetection: boolean;
  networkRetryAttempts: number;
}

export interface PopupHandler {
  selector: string;
  action: 'close' | 'accept' | 'dismiss';
  priority: number;
  description: string;
}

export interface SessionIndicator {
  selector: string;
  type: 'login_required' | 'session_expired' | 'account_locked';
  description: string;
}

export interface LayoutChange {
  expectedSelector: string;
  alternativeSelectors: string[];
  description: string;
}

export class EdgeCaseHandler {
  private page: Page;
  private browser: Browser;
  private logger: Logger;
  private retryManager: RetryStrategyManager;
  private config: EdgeCaseConfig;

  // Known popup handlers in priority order
  private popupHandlers: PopupHandler[] = [
    {
      selector: 'button:has-text("OK")',
      action: 'close',
      priority: 1,
      description: 'Generic OK button popup'
    },
    {
      selector: 'button:has-text("Aceptar")',
      action: 'close',
      priority: 1,
      description: 'Spanish Accept button popup'
    },
    {
      selector: 'button:has-text("Cerrar")',
      action: 'close',
      priority: 1,
      description: 'Spanish Close button popup'
    },
    {
      selector: '[aria-label="Close"], [aria-label="Cerrar"]',
      action: 'close',
      priority: 2,
      description: 'Close button with aria-label'
    },
    {
      selector: '.modal-close, .popup-close, .dialog-close',
      action: 'close',
      priority: 2,
      description: 'Modal close buttons by class'
    },
    {
      selector: 'button[title="Close"], button[title="Cerrar"]',
      action: 'close',
      priority: 3,
      description: 'Close button with title attribute'
    },
    {
      selector: '.cookie-consent button:has-text("Accept")',
      action: 'accept',
      priority: 4,
      description: 'Cookie consent banner'
    },
    {
      selector: '.notification .close, .alert .close',
      action: 'dismiss',
      priority: 5,
      description: 'Notification or alert close buttons'
    }
  ];

  // Session expiration indicators
  private sessionIndicators: SessionIndicator[] = [
    {
      selector: 'input[name="Correo"], input[placeholder*="email"]',
      type: 'login_required',
      description: 'Login form detected - session expired'
    },
    {
      selector: 'text="Sesión expirada", text="Session expired"',
      type: 'session_expired',
      description: 'Explicit session expiration message'
    },
    {
      selector: 'text="Cuenta bloqueada", text="Account locked"',
      type: 'account_locked',
      description: 'Account locked message'
    },
    {
      selector: 'text="Ingresar", button:has-text("Login")',
      type: 'login_required',
      description: 'Login button visible - not authenticated'
    }
  ];

  // Layout change adaptations
  private layoutChanges: LayoutChange[] = [
    {
      expectedSelector: 'textbox[name="Correo"]',
      alternativeSelectors: [
        'input[name="email"]',
        'input[type="email"]',
        'input[placeholder*="correo"]',
        'input[placeholder*="email"]'
      ],
      description: 'Email input field variations'
    },
    {
      expectedSelector: 'textbox[placeholder="Contraseña"]',
      alternativeSelectors: [
        'input[name="password"]',
        'input[type="password"]',
        'input[placeholder*="contraseña"]',
        'input[placeholder*="password"]'
      ],
      description: 'Password input field variations'
    },
    {
      expectedSelector: 'text=Ingresar',
      alternativeSelectors: [
        'button:has-text("Login")',
        'button:has-text("Entrar")',
        'button[type="submit"]',
        'input[type="submit"]'
      ],
      description: 'Login submit button variations'
    },
    {
      expectedSelector: 'text=Agendar',
      alternativeSelectors: [
        'button:has-text("Reservar")',
        'button:has-text("Book")',
        'button:has-text("Reserve")',
        '.reserve-button',
        '.book-button'
      ],
      description: 'Reserve button variations'
    }
  ];

  constructor(
    page: Page,
    browser: Browser,
    logger: Logger,
    config?: Partial<EdgeCaseConfig>
  ) {
    this.page = page;
    this.browser = browser;
    this.logger = logger;
    this.retryManager = new RetryStrategyManager(logger);
    
    this.config = {
      popupTimeout: 5000,
      sessionCheckInterval: 30000,
      layoutChangeDetection: true,
      networkRetryAttempts: 3,
      ...config
    };
  }

  /**
   * Handle unexpected popups that may appear during navigation
   */
  async handleUnexpectedPopups(): Promise<boolean> {
    try {
      this.logger.logInfo('Checking for unexpected popups');

      for (const handler of this.popupHandlers) {
        try {
          const element = await this.page.locator(handler.selector).first();
          
          if (await element.isVisible({ timeout: 1000 })) {
            this.logger.logInfo(`Found popup: ${handler.description}`, {
              selector: handler.selector,
              action: handler.action
            });

            switch (handler.action) {
              case 'close':
              case 'accept':
              case 'dismiss':
                await element.click({ timeout: 2000 });
                this.logger.logInfo(`Successfully handled popup: ${handler.description}`);
                
                // Wait a moment for popup to close
                await this.page.waitForTimeout(500);
                return true;
            }
          }
        } catch (error) {
          // Continue to next handler if this one fails
          continue;
        }
      }

      return false;
    } catch (error) {
      this.logger.logError(error as Error, {
        context: 'handleUnexpectedPopups',
        errorType: ErrorType.UNEXPECTED_POPUP
      });
      return false;
    }
  }

  /**
   * Detect and handle session expiration
   */
  async detectSessionExpiration(): Promise<{ expired: boolean; type?: string }> {
    try {
      this.logger.logInfo('Checking session status');

      for (const indicator of this.sessionIndicators) {
        try {
          const element = await this.page.locator(indicator.selector).first();
          
          if (await element.isVisible({ timeout: 2000 })) {
            this.logger.logError(new Error(`Session issue detected: ${indicator.description}`), {
              context: 'detectSessionExpiration',
              sessionType: indicator.type,
              selector: indicator.selector
            });

            return {
              expired: true,
              type: indicator.type
            };
          }
        } catch (error) {
          // Continue checking other indicators
          continue;
        }
      }

      return { expired: false };
    } catch (error) {
      this.logger.logError(error as Error, {
        context: 'detectSessionExpiration',
        errorType: ErrorType.SESSION_EXPIRED
      });
      return { expired: true, type: 'unknown' };
    }
  }

  /**
   * Adapt to minor layout changes by trying alternative selectors
   */
  async adaptToLayoutChanges(originalSelector: string): Promise<string | null> {
    if (!this.config.layoutChangeDetection) {
      return null;
    }

    try {
      this.logger.logInfo(`Adapting to layout changes for selector: ${originalSelector}`);

      // Find matching layout change configuration
      const layoutChange = this.layoutChanges.find(lc => 
        lc.expectedSelector === originalSelector
      );

      if (!layoutChange) {
        this.logger.logInfo(`No alternative selectors configured for: ${originalSelector}`);
        return null;
      }

      // Try alternative selectors
      for (const altSelector of layoutChange.alternativeSelectors) {
        try {
          const element = await this.page.locator(altSelector).first();
          
          if (await element.isVisible({ timeout: 2000 })) {
            this.logger.logInfo(`Found alternative selector: ${altSelector}`, {
              originalSelector,
              alternativeSelector: altSelector,
              description: layoutChange.description
            });
            return altSelector;
          }
        } catch (error) {
          // Continue to next alternative
          continue;
        }
      }

      this.logger.logError(new Error(`No working alternative found for selector: ${originalSelector}`), {
        context: 'adaptToLayoutChanges',
        errorType: ErrorType.LAYOUT_CHANGED,
        originalSelector,
        alternativesTried: layoutChange.alternativeSelectors.length
      });

      return null;
    } catch (error) {
      this.logger.logError(error as Error, {
        context: 'adaptToLayoutChanges',
        errorType: ErrorType.LAYOUT_CHANGED,
        originalSelector
      });
      return null;
    }
  }

  /**
   * Handle network errors and timeouts with intelligent retry
   */
  async handleNetworkErrors<T>(
    operation: () => Promise<T>,
    context: string
  ): Promise<T> {
    return this.retryManager.executeWithRetry(
      async () => {
        try {
          return await operation();
        } catch (error) {
          const errorMessage = (error as Error).message.toLowerCase();
          
          // Check for network-related errors
          if (this.isNetworkError(errorMessage)) {
            // Wait for network to stabilize
            await this.waitForNetworkStability();
            throw error; // Let retry manager handle it
          }
          
          throw error;
        }
      },
      context,
      {
        maxRetries: this.config.networkRetryAttempts,
        baseDelayMs: 2000,
        maxDelayMs: 10000,
        jitterMs: 500
      }
    ).then(result => {
      if (!result.success) {
        throw result.error || new Error(`Network operation failed: ${context}`);
      }
      return result.result!;
    });
  }

  /**
   * Comprehensive page health check
   */
  async performPageHealthCheck(): Promise<{
    healthy: boolean;
    issues: string[];
    recommendations: string[];
  }> {
    const issues: string[] = [];
    const recommendations: string[] = [];

    try {
      // Check if page is responsive
      try {
        await this.page.evaluate(() => document.readyState);
      } catch (error) {
        issues.push('Page is not responsive');
        recommendations.push('Reload the page');
      }

      // Check for JavaScript errors
      const jsErrors = await this.page.evaluate(() => {
        return (window as any).__jsErrors || [];
      });
      
      if (jsErrors.length > 0) {
        issues.push(`${jsErrors.length} JavaScript errors detected`);
        recommendations.push('Check browser console for errors');
      }

      // Check for session expiration
      const sessionCheck = await this.detectSessionExpiration();
      if (sessionCheck.expired) {
        issues.push(`Session expired: ${sessionCheck.type}`);
        recommendations.push('Re-authenticate user session');
      }

      // Check for unexpected popups
      const hasPopups = await this.handleUnexpectedPopups();
      if (hasPopups) {
        issues.push('Unexpected popups were present');
        recommendations.push('Popups have been handled automatically');
      }

      // Check network connectivity
      try {
        await this.page.evaluate(() => fetch('/favicon.ico', { method: 'HEAD' }));
      } catch (error) {
        issues.push('Network connectivity issues detected');
        recommendations.push('Check internet connection');
      }

      const healthy = issues.length === 0;

      this.logger.logInfo('Page health check completed', {
        healthy,
        issuesCount: issues.length,
        issues,
        recommendations
      });

      return { healthy, issues, recommendations };

    } catch (error) {
      this.logger.logError(error as Error, {
        context: 'performPageHealthCheck',
        errorType: ErrorType.BROWSER_ERROR
      });

      return {
        healthy: false,
        issues: ['Health check failed'],
        recommendations: ['Restart browser session']
      };
    }
  }

  /**
   * Emergency recovery procedures
   */
  async performEmergencyRecovery(): Promise<boolean> {
    try {
      this.logger.logInfo('Performing emergency recovery');

      // Step 1: Handle any popups
      await this.handleUnexpectedPopups();

      // Step 2: Check and handle session issues
      const sessionCheck = await this.detectSessionExpiration();
      if (sessionCheck.expired) {
        this.logger.logError(new Error('Session expired during emergency recovery'), {
          sessionType: sessionCheck.type
        });
        return false; // Cannot recover from session expiration automatically
      }

      // Step 3: Reload page if necessary
      try {
        const currentUrl = this.page.url();
        if (!currentUrl.includes('boxmagic.app')) {
          this.logger.logInfo('Navigating back to BoxMagic');
          await this.page.goto('https://members.boxmagic.app/app/horarios', {
            waitUntil: 'domcontentloaded',
            timeout: 15000
          });
        }
      } catch (error) {
        this.logger.logError(error as Error, {
          context: 'Emergency recovery navigation'
        });
        return false;
      }

      // Step 4: Wait for page stability
      await this.waitForPageStability();

      this.logger.logInfo('Emergency recovery completed successfully');
      return true;

    } catch (error) {
      this.logger.logError(error as Error, {
        context: 'performEmergencyRecovery',
        errorType: ErrorType.BROWSER_ERROR
      });
      return false;
    }
  }

  /**
   * Wait for network stability
   */
  private async waitForNetworkStability(timeoutMs: number = 10000): Promise<void> {
    const startTime = Date.now();
    
    while (Date.now() - startTime < timeoutMs) {
      try {
        // Try a simple network request
        await this.page.evaluate(() => 
          fetch('/favicon.ico', { method: 'HEAD' })
        );
        
        // If successful, network is stable
        return;
      } catch (error) {
        // Wait and retry
        await this.page.waitForTimeout(1000);
      }
    }
    
    throw new Error('Network did not stabilize within timeout');
  }

  /**
   * Wait for page stability
   */
  private async waitForPageStability(timeoutMs: number = 10000): Promise<void> {
    try {
      // Wait for network idle
      await this.page.waitForLoadState('networkidle', { timeout: timeoutMs });
      
      // Wait for DOM to be ready
      await this.page.waitForFunction(
        () => document.readyState === 'complete',
        { timeout: timeoutMs }
      );
      
      // Additional small delay for dynamic content
      await this.page.waitForTimeout(1000);
      
    } catch (error) {
      this.logger.logError(error as Error, {
        context: 'waitForPageStability'
      });
      // Don't throw - page might still be usable
    }
  }

  /**
   * Check if error is network-related
   */
  private isNetworkError(errorMessage: string): boolean {
    const networkKeywords = [
      'network',
      'connection',
      'timeout',
      'dns',
      'ssl',
      'certificate',
      'unreachable',
      'refused',
      'reset',
      'aborted'
    ];

    return networkKeywords.some(keyword => 
      errorMessage.includes(keyword)
    );
  }

  /**
   * Add custom popup handler
   */
  addPopupHandler(handler: PopupHandler): void {
    this.popupHandlers.push(handler);
    // Sort by priority
    this.popupHandlers.sort((a, b) => a.priority - b.priority);
    
    this.logger.logInfo('Added custom popup handler', {
      selector: handler.selector,
      action: handler.action,
      priority: handler.priority
    });
  }

  /**
   * Add custom session indicator
   */
  addSessionIndicator(indicator: SessionIndicator): void {
    this.sessionIndicators.push(indicator);
    
    this.logger.logInfo('Added custom session indicator', {
      selector: indicator.selector,
      type: indicator.type
    });
  }

  /**
   * Add custom layout change adaptation
   */
  addLayoutChange(layoutChange: LayoutChange): void {
    this.layoutChanges.push(layoutChange);
    
    this.logger.logInfo('Added custom layout change adaptation', {
      expectedSelector: layoutChange.expectedSelector,
      alternativesCount: layoutChange.alternativeSelectors.length
    });
  }
}