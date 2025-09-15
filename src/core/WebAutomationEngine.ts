import { chromium } from 'playwright-core';
import chromiumBinary from '@sparticuz/chromium';
import type { Browser, BrowserContext, Page } from 'playwright-core';
import { Logger } from './Logger.js';
import type { ReservationResult } from '../types/ReservationTypes.js';

// Selectores basados en análisis anti-bot completado - ESTABLES 99.87/100
export const SELECTORS = {
  login: {
    // Selectores estables confirmados por análisis MCP
    email: 'input[placeholder="Correo"]',
    password: 'input[placeholder="Contraseña"]', 
    submitButton: 'button[type="submit"]'
  },
  navigation: {
    // Selectores basados en texto visible (más estables)
    daySelector: (day: string) => `text=${day}.`, // ej: "vie.", "sáb."
    dayNumber: (number: string) => `text="${number}"`, // ej: "12", "13"
    todayButton: '.Ui2Boton:has-text("Hoy")',
    tomorrowButton: '.Ui2Boton:has-text("Mañana")'
  },
  classes: {
    // Selectores genéricos dinámicos basados en análisis real de BoxMagic
    // Usar getByRole/getByText de Playwright en lugar de CSS selectors con :has()
    classContainer: (className: string) => `.tarjetaInstancia >> text="${className}"`,
    classHeading: (className: string) => `h2:text("${className}")`,
    classHeadingExact: (className: string) => `h2 >> text="${className}"`,
    // Selectores de estado
    availableSpaces: 'text=Espacios disponibles',
    fullCapacity: 'text=Capacidad completa', 
    alreadyBooked: 'text=Agendada'
  },
  modal: {
    reserveButton: '.contenidoBoton:has-text("Agendar"), button:has-text("Agendar"), [role="button"]:has-text("Agendar")',
    reservingButton: '.contenidoBoton:has-text("Agendando"), button:has-text("Agendando"), button:has-text("Reservando")',
    closeButton: 'button:has-text("×"), button:has-text("Cerrar"), [aria-label*="close" i]',
    participantInfo: 'text=Participantes',
    modalContainer: '[role="dialog"], dialog, *:has(text="Agendar")'
  },
  popups: {
    okButton: 'button:has-text("OK"), button:has-text("Aceptar")',
    closeButton: 'button:has-text("×"), [aria-label*="close" i]',
    dismissButton: 'button:has-text("Entendido"), button:has-text("Cerrar")'
  }
} as const;

export interface WebAutomationEngine {
  initialize(): Promise<void>;
  login(email: string, password: string): Promise<boolean>;
  navigateToSchedule(): Promise<void>;
  selectDay(dayToSelect: 'today' | 'tomorrow'): Promise<void>;
  waitUntilReady(): Promise<void>;
  prepareReservation(email: string, password: string, dayToSelect: 'today' | 'tomorrow', className: string): Promise<void>;
  executeReservation(className: string): Promise<ReservationResult>;
  executeReservationUltraFast(className: string): Promise<ReservationResult>;
  verifyReservationSuccess(className: string): Promise<ReservationResult>;
  verifyReservationWithFailureTypes(className: string): Promise<ReservationResult & {
    failureType?: 'network_error' | 'capacity_full' | 'already_booked' | 'session_expired' | 'class_not_found' | 'unknown';
    participantCountChange?: {
      changed: boolean;
      previousCount?: { current: number; max: number };
      newCount?: { current: number; max: number };
      increased: boolean;
    };
  }>;
  detectParticipantCountChange(className: string, previousCount?: { current: number; max: number }): Promise<{
    changed: boolean;
    previousCount?: { current: number; max: number };
    newCount?: { current: number; max: number };
    increased: boolean;
  }>;
  checkClassStatus(className: string): Promise<'available' | 'full' | 'already_booked' | 'not_found'>;
  handlePopups(): Promise<void>;
  cleanup(): Promise<void>;
}

export class WebAutomationEngine implements WebAutomationEngine {
  private browser: Browser | null = null;
  private context: BrowserContext | null = null;
  private page: Page | null = null;
  private logger: Logger;
  private isInitialized = false;

  constructor(logger?: Logger) {
    this.logger = logger || new Logger();
  }

  async initialize(): Promise<void> {
    if (this.isInitialized) {
      this.logger.logInfo('WebAutomationEngine already initialized');
      return;
    }

    try {
      this.logger.logInfo('Initializing WebAutomationEngine with optimized browser configuration');
      
      // Configuración híbrida: local para desarrollo, @sparticuz/chromium para producción
      const isProduction = process.env.NODE_ENV === 'production' || process.env.VERCEL === '1';
      
      const browserArgs = [
        '--disable-blink-features=AutomationControlled', // Crítico: evitar detección
        '--disable-automation',
        '--no-first-run',
        '--disable-infobars',
        '--disable-extensions',
        '--disable-plugins',
        '--disable-images', // Acelerar carga
        '--disable-javascript-harmony-shipping',
        '--disable-background-timer-throttling',
        '--disable-renderer-backgrounding',
        '--disable-backgrounding-occluded-windows',
        '--disable-ipc-flooding-protection',
        '--password-store=basic',
        '--use-mock-keychain',
        '--no-default-browser-check',
        '--disable-default-apps'
      ];

      if (isProduction) {
        // Vercel/Producción: usar @sparticuz/chromium
        this.browser = await chromium.launch({
          args: [...chromiumBinary.args, ...browserArgs],
          executablePath: await chromiumBinary.executablePath(),
          headless: process.env['BROWSER_HEADLESS'] !== 'false'
        });
      } else {
        // Local: usar Chromium local de Playwright
        this.browser = await chromium.launch({
          args: browserArgs,
          headless: process.env['BROWSER_HEADLESS'] !== 'false'
        });
      }

      this.context = await this.browser.newContext({
        viewport: { width: 1366, height: 768 }, // Tamaño más común
        userAgent: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        locale: 'es-CL', // Configurar idioma chileno
        timezoneId: 'America/Santiago',
        permissions: ['geolocation'], // Permisos típicos
        geolocation: { latitude: -33.4489, longitude: -70.6693 }, // Santiago, Chile
        extraHTTPHeaders: {
          'Accept-Language': 'es-CL,es;q=0.9,en;q=0.8'
        }
      });

      this.page = await this.context.newPage();
      
      // Eliminar propiedades que indican automatización
      await this.page.addInitScript(() => {
        // Eliminar webdriver property
        delete (window as any).navigator.webdriver;
        
        // Sobrescribir plugins
        Object.defineProperty(navigator, 'plugins', {
          get: () => [1, 2, 3, 4, 5]
        });
        
        // Sobrescribir languages
        Object.defineProperty(navigator, 'languages', {
          get: () => ['es-CL', 'es', 'en']
        });
      });
      
      // Configuración de página optimizada
      this.page.setDefaultTimeout(parseInt(process.env['BROWSER_TIMEOUT'] || '30000'));
      
      this.isInitialized = true;
      this.logger.logInfo('WebAutomationEngine initialized successfully');
    } catch (error) {
      this.logger.logError(error as Error, { context: 'WebAutomationEngine.initialize' });
      throw error;
    }
  }

  async login(email: string, password: string): Promise<boolean> {
    if (!this.page) {
      throw new Error('WebAutomationEngine not initialized. Call initialize() first.');
    }

    try {
      this.logger.logInfo('Starting login process', { email });

      // Navegar a la página de login si no estamos ya logueados
      await this.page.goto('https://members.boxmagic.app/acceso/ingreso');

      // Esperar a que la página cargue completamente (BoxMagic tarda en cargar)
      await this.page.waitForTimeout(5000);
      
      // Verificar si ya estamos logueados (redirige automáticamente a horarios)
      if (this.page.url().includes('/horarios')) {
        this.logger.logInfo('Already logged in, redirected to schedule');
        return true;
      }

      // Usar selectores estables confirmados por análisis anti-bot
      await this.page.getByRole('textbox', { name: 'Correo' }).waitFor({ timeout: 15000 });

      // Llenar credenciales con selectores estables
      await this.page.getByRole('textbox', { name: 'Correo' }).fill(email);
      await this.page.getByRole('textbox', { name: 'Contraseña' }).fill(password);

      this.logger.logInfo('Credentials filled, submitting login form');

      // Hacer clic en botón Ingresar - usar selector CSS estable
      await this.page.locator('button[type="submit"]').click();

      // Esperar a que el login se complete (verificar redirección a horarios)
      await this.page.waitForFunction(() => {
        return window.location.pathname.includes('/horarios');
      }, { timeout: 15000 });

      // Manejar popups informativos después del login
      await this.handlePopups();

      this.logger.logInfo('Login completed successfully');
      return true;

    } catch (error) {
      this.logger.logError(error as Error, { 
        context: 'WebAutomationEngine.login',
        email 
      });
      return false;
    }
  }

  async navigateToSchedule(): Promise<void> {
    if (!this.page) {
      throw new Error('WebAutomationEngine not initialized. Call initialize() first.');
    }

    try {
      this.logger.logInfo('Navigating to BoxMagic schedule page');
      
      await this.page.goto('https://members.boxmagic.app/app/horarios', {
        waitUntil: 'domcontentloaded',
        timeout: 30000
      });

      // Esperar a que la página cargue completamente
      await this.page.waitForTimeout(2000);

      this.logger.logInfo('Successfully navigated to schedule page');
    } catch (error) {
      this.logger.logError(error as Error, { context: 'WebAutomationEngine.navigateToSchedule' });
      throw error;
    }
  }

  /**
   * Close automatic modals that BoxMagic opens (like next scheduled class)
   */
  async closeAutomaticModals(): Promise<void> {
    if (!this.page) return;

    try {
      // Look for modal close buttons
      const closeSelectors = [
        'button[aria-label="Close"]',
        'button:has-text("×")',
        'button:has-text("Cerrar")',
        '[role="dialog"] button:first-child' // First button in dialog (usually close)
      ];

      for (const selector of closeSelectors) {
        try {
          const closeButton = this.page.locator(selector).first();
          if (await closeButton.isVisible({ timeout: 1000 })) {
            await closeButton.click();
            this.logger.logInfo(`Closed automatic modal with selector: ${selector}`);
            await this.page.waitForTimeout(1000); // Wait for modal to close
            break;
          }
        } catch {
          // Continue with next selector
        }
      }
    } catch (error) {
      this.logger.logInfo('No automatic modals found to close');
    }
  }

  async handlePopups(): Promise<void> {
    if (!this.page) {
      throw new Error('WebAutomationEngine not initialized. Call initialize() first.');
    }

    try {
      this.logger.logInfo('Checking for and handling popups');

      // Esperar un momento para que aparezcan los popups
      await this.page.waitForTimeout(3000);

      // Usar selectores correctos encontrados en análisis
      const popupSelectors = [
        'dialog.zonaModal',                    // Selector principal encontrado
        '.zonaModal',                          // Alternativo
        'dialog',                              // Genérico para DIALOG
        '.dialoWrapper'                        // Wrapper alternativo
      ];

      let popupFound = false;

      for (const selector of popupSelectors) {
        try {
          const popupElement = this.page.locator(selector).first();
          if (await popupElement.isVisible({ timeout: 2000 })) {
            this.logger.logInfo(`Popup found with selector: ${selector}`);
            popupFound = true;

            // Intentar cerrar con selectores específicos
            const closeSelectors = [
              `${selector} .elModal-nucleo-cerrador`,    // Selector que funcionó en test
              `${selector} button:has-text("×")`,        // Botón X
              '.elModal-nucleo-cerrador',                // Global
              '.cierreExterno'                           // Alternativo
            ];

            let closeSuccess = false;

            for (const closeSelector of closeSelectors) {
              try {
                const closeButton = this.page.locator(closeSelector).first();
                if (await closeButton.isVisible({ timeout: 1000 })) {
                  await closeButton.click();
                  await this.page.waitForTimeout(1000);
                  
                  // Verificar si se cerró
                  if (!(await popupElement.isVisible({ timeout: 1000 }))) {
                    this.logger.logInfo(`Popup closed with selector: ${closeSelector}`);
                    closeSuccess = true;
                    break;
                  }
                }
              } catch {
                // Continuar con siguiente selector
              }
            }

            // Si no funcionó con botones, probar Escape
            if (!closeSuccess) {
              await this.page.keyboard.press('Escape');
              await this.page.waitForTimeout(1000);
              
              if (!(await popupElement.isVisible({ timeout: 1000 }))) {
                this.logger.logInfo('Popup closed with Escape key');
                closeSuccess = true;
              }
            }

            if (closeSuccess) {
              break; // Salir del loop de popups
            }
          }
        } catch {
          // Continuar con siguiente selector
        }
      }

      if (popupFound) {
        this.logger.logInfo('Popup handling completed');
      } else {
        this.logger.logInfo('No popups found to handle');
      }

    } catch (error) {
      this.logger.logError(error as Error, { context: 'WebAutomationEngine.handlePopups' });
      // No lanzar error aquí, los popups son opcionales
    }
  }

  async selectDay(dayToSelect: 'today' | 'tomorrow'): Promise<void> {
    if (!this.page) {
      throw new Error('WebAutomationEngine not initialized. Call initialize() first.');
    }

    try {
      this.logger.logInfo(`Selecting day: ${dayToSelect}`);

      // Esperar a que la página de horarios esté cargada
      await this.page.waitForLoadState('domcontentloaded');

      // Calcular el número del día objetivo
      const currentDate = new Date();
      const targetDate = dayToSelect === 'today' ? currentDate : new Date(currentDate.getTime() + 24 * 60 * 60 * 1000);
      const targetDay = targetDate.getDate().toString();
      
      this.logger.logInfo(`Target day number: ${targetDay} (${dayToSelect})`);

      // Calcular el nombre del día en español
      const dayNames = ['dom', 'lun', 'mar', 'mié', 'jue', 'vie', 'sáb'];
      const targetDayName = dayNames[targetDate.getDay()];
      
      this.logger.logInfo(`Target day name: ${targetDayName}`);

      // Buscar el elemento clickeable con el día correcto usando múltiples estrategias
      const daySelectors = [
        // Selector más específico basado en el patrón dom.14
        `text="${targetDayName}.${targetDay}"`,
        `text="${targetDayName}. ${targetDay}"`, 
        // Fallback a selectores más generales
        `text="${targetDay}"`,
        `[data-day="${targetDay}"]`,
        `button:has-text("${targetDay}")`,
        `.day-${targetDay}`
      ];

      let dayClicked = false;
      
      for (const selector of daySelectors) {
        try {
          const dayElement = this.page.locator(selector).first();
          
          if (await dayElement.isVisible({ timeout: 2000 })) {
            // Verificar que es clickeable
            const isEnabled = await dayElement.isEnabled({ timeout: 1000 });
            if (isEnabled) {
              this.logger.logInfo(`Found clickable day element with selector: ${selector}`);
              
              await dayElement.click({ force: true });
              this.logger.logInfo(`Successfully clicked day ${targetDay} using selector: ${selector}`);
              
              dayClicked = true;
              break;
            } else {
              this.logger.logInfo(`Day element found but not clickable: ${selector}`);
            }
          }
        } catch (selectorError) {
          // Continuar con el siguiente selector
          this.logger.logInfo(`Selector ${selector} failed, trying next one`);
        }
      }

      if (!dayClicked) {
        // Fallback: usar JavaScript para encontrar y hacer click en el número
        this.logger.logInfo('Standard selectors failed, trying JavaScript approach');
        
        const jsResult = await this.page.evaluate((targetDay) => {
          // Buscar todos los elementos con el número del día
          const elements = Array.from(document.querySelectorAll('*')).filter(el => {
            const text = el.textContent?.trim();
            return text === targetDay && 
                   (el.tagName === 'BUTTON' || 
                    el.getAttribute('onclick') || 
                    el.getAttribute('role') === 'button' ||
                    window.getComputedStyle(el).cursor === 'pointer');
          });
          
          if (elements.length > 0) {
            const element = elements[0] as HTMLElement;
            element.click();
            return { success: true, found: elements.length, text: element.textContent };
          }
          
          return { success: false, found: 0 };
        }, targetDay);
        
        if (jsResult.success) {
          this.logger.logInfo(`JavaScript click successful on day ${targetDay}`, jsResult);
          dayClicked = true;
        } else {
          this.logger.logError(new Error(`No clickable element found for day ${targetDay}`), { 
            jsResult,
            targetDay,
            dayToSelect 
          });
        }
      }

      if (dayClicked) {
        // Esperar a que se cargue la lista de clases del día seleccionado
        await this.waitForClassListToLoad();
        
        // Verificar que estamos en el día correcto
        await this.verifyCorrectDay(dayToSelect);
      } else {
        throw new Error(`Failed to select day ${targetDay} (${dayToSelect}) - no clickable elements found`);
      }

    } catch (error) {
      this.logger.logError(error as Error, { 
        context: 'WebAutomationEngine.selectDay',
        dayToSelect 
      });
      throw error;
    }
  }

  private async waitForClassListToLoad(): Promise<void> {
    if (!this.page) return;

    try {
      // Esperar a que aparezca al menos una clase o el contenedor de clases
      await this.page.waitForFunction(() => {
        const classElements = document.querySelectorAll('h3, h4, [role="heading"]');
        return classElements.length > 0 || 
               document.querySelector('.class-list') ||
               document.querySelector('[data-testid="class-list"]') ||
               document.querySelector('.schedule-container');
      }, { timeout: 10000 });

      this.logger.logInfo('Class list loaded successfully');
    } catch (error) {
      this.logger.logError(error as Error, { context: 'WebAutomationEngine.waitForClassListToLoad' });
      throw new Error('Failed to load class list');
    }
  }

  async verifyClassListLoaded(): Promise<boolean> {
    if (!this.page) {
      throw new Error('WebAutomationEngine not initialized. Call initialize() first.');
    }

    try {
      this.logger.logInfo('Verifying that class list is loaded');

      // Verificar que hay al menos una clase visible
      const classCount = await this.page.locator('h3, h4, [role="heading"]').count();
      
      if (classCount > 0) {
        this.logger.logInfo(`Class list verified: found ${classCount} classes`);
        return true;
      }

      // Verificar contenedores alternativos
      const hasContainer = await this.page.locator('.class-list, [data-testid="class-list"], .schedule-container').count() > 0;
      
      if (hasContainer) {
        this.logger.logInfo('Class list container found');
        return true;
      }

      this.logger.logInfo('No class list found');
      return false;

    } catch (error) {
      this.logger.logError(error as Error, { context: 'WebAutomationEngine.verifyClassListLoaded' });
      return false;
    }
  }

  private async verifyCorrectDay(expectedDay: 'today' | 'tomorrow'): Promise<void> {
    if (!this.page) return;

    try {
      // Verificar que estamos en el día correcto buscando indicadores visuales
      const currentDate = new Date();
      const targetDate = expectedDay === 'today' ? currentDate : new Date(currentDate.getTime() + 24 * 60 * 60 * 1000);
      
      // Buscar indicadores de fecha en la página
      const dayIndicators = await this.page.locator('text=/\\d{1,2}/', { hasText: targetDate.getDate().toString() }).count();
      
      if (dayIndicators === 0) {
        this.logger.logInfo(`Warning: Could not verify we're on the correct day (${expectedDay})`);
      } else {
        this.logger.logInfo(`Verified we're on the correct day: ${expectedDay}`);
      }
    } catch (error) {
      this.logger.logError(error as Error, { context: 'WebAutomationEngine.verifyCorrectDay' });
      // No lanzar error, esto es solo verificación
    }
  }

  async verifyCorrectDaySelected(expectedDay: 'today' | 'tomorrow'): Promise<boolean> {
    if (!this.page) {
      throw new Error('WebAutomationEngine not initialized. Call initialize() first.');
    }

    try {
      this.logger.logInfo(`Verifying we're on the correct day: ${expectedDay}`);

      // Obtener fecha objetivo
      const currentDate = new Date();
      const targetDate = expectedDay === 'today' ? currentDate : new Date(currentDate.getTime() + 24 * 60 * 60 * 1000);
      
      // Buscar múltiples indicadores de fecha
      const dayNumber = targetDate.getDate().toString();
      const dayName = targetDate.toLocaleDateString('es-ES', { weekday: 'short' }).toLowerCase();
      
      // Verificar número del día
      const dayNumberFound = await this.page.locator(`text=${dayNumber}`).count() > 0;
      
      // Verificar nombre del día (ej: "lun", "mar", etc.)
      const dayNameFound = await this.page.locator(`text=${dayName}`).count() > 0;
      
      // Verificar botones activos (con timeout corto para evitar bloqueos)
      let todayButtonActive: string | null = null;
      let tomorrowButtonActive: string | null = null;
      
      try {
        todayButtonActive = await this.page.locator(SELECTORS.navigation.todayButton).getAttribute('class', { timeout: 2000 });
      } catch {
        // Ignorar si no se encuentra
      }
      
      try {
        tomorrowButtonActive = await this.page.locator(SELECTORS.navigation.tomorrowButton).getAttribute('class', { timeout: 2000 });
      } catch {
        // Ignorar si no se encuentra
      }
      
      const isCorrectDay = dayNumberFound || dayNameFound || 
        (expectedDay === 'today' && todayButtonActive?.includes('active')) ||
        (expectedDay === 'tomorrow' && tomorrowButtonActive?.includes('active'));

      if (isCorrectDay) {
        this.logger.logInfo(`Successfully verified we're on ${expectedDay}`);
        return true;
      } else {
        this.logger.logInfo(`Could not verify we're on ${expectedDay}, but continuing`);
        return false;
      }

    } catch (error) {
      this.logger.logError(error as Error, { 
        context: 'WebAutomationEngine.verifyCorrectDaySelected',
        expectedDay 
      });
      return false;
    }
  }

  async checkClassStatus(className: string): Promise<'available' | 'full' | 'already_booked' | 'not_found'> {
    if (!this.page) {
      throw new Error('WebAutomationEngine not initialized. Call initialize() first.');
    }

    try {
      this.logger.logInfo(`Checking status for class: ${className}`);

      // Buscar el contenedor de la clase usando métodos Playwright específicos
      const classHeading = this.page.getByRole('heading', { name: className, exact: true }).first();
      
      if (!(await classHeading.isVisible({ timeout: 5000 }))) {
        this.logger.logInfo(`Class not found: ${className}`);
        return 'not_found';
      }

      // Encontrar el contenedor padre de la clase
      const classContainer = classHeading.locator('..').locator('..').locator('..').first();

      // Verificar si ya está agendada
      if (await classContainer.locator(SELECTORS.classes.alreadyBooked).isVisible({ timeout: 1000 })) {
        this.logger.logInfo(`Class ${className} is already booked`);
        return 'already_booked';
      }

      // Verificar si está llena
      if (await classContainer.locator(SELECTORS.classes.fullCapacity).isVisible({ timeout: 1000 })) {
        this.logger.logInfo(`Class ${className} is at full capacity`);
        return 'full';
      }

      // Verificar si tiene espacios disponibles
      if (await classContainer.locator(SELECTORS.classes.availableSpaces).isVisible({ timeout: 1000 })) {
        this.logger.logInfo(`Class ${className} has available spaces`);
        return 'available';
      }

      // Si no encontramos indicadores específicos, asumir que está disponible
      this.logger.logInfo(`Class ${className} status unclear, assuming available`);
      return 'available';

    } catch (error) {
      this.logger.logError(error as Error, { 
        context: 'WebAutomationEngine.checkClassStatus',
        className 
      });
      return 'not_found';
    }
  }

  async verifyClassExists(className: string): Promise<boolean> {
    if (!this.page) {
      throw new Error('WebAutomationEngine not initialized. Call initialize() first.');
    }

    try {
      this.logger.logInfo(`Verifying class exists: ${className}`);

      // Usar métodos Playwright específicos para buscar por texto de heading
      const classHeading = this.page.getByRole('heading', { name: className, exact: true }).first();
      const isVisible = await classHeading.isVisible({ timeout: 5000 });
      
      if (isVisible) {
        this.logger.logInfo(`Class ${className} found and visible`);
        return true;
      }

      this.logger.logInfo(`Class ${className} not found`);
      return false;

    } catch (error) {
      this.logger.logError(error as Error, { 
        context: 'WebAutomationEngine.verifyClassExists',
        className 
      });
      return false;
    }
  }

  async getParticipantInfo(className: string): Promise<{ current: number; max: number } | null> {
    if (!this.page) {
      throw new Error('WebAutomationEngine not initialized. Call initialize() first.');
    }

    try {
      this.logger.logInfo(`Getting participant info for class: ${className}`);

      // Buscar la clase
      const classElement = this.page.locator(SELECTORS.classes.classHeading(className)).first();
      
      if (!(await classElement.isVisible({ timeout: 3000 }))) {
        this.logger.logInfo(`Class ${className} not found for participant info`);
        return null;
      }

      // Buscar información de participantes en el contenedor de la clase
      const classContainer = classElement.locator('..').first();
      
      // Buscar patrones comunes de información de participantes
      const participantPatterns = [
        /(\d+)\/(\d+)/,  // "5/15" format
        /(\d+)\s*de\s*(\d+)/,  // "5 de 15" format
        /Participantes:\s*(\d+)\/(\d+)/,  // "Participantes: 5/15"
        /(\d+)\s*participantes\s*de\s*(\d+)/  // "5 participantes de 15"
      ];

      const containerText = await classContainer.textContent() || '';
      
      for (const pattern of participantPatterns) {
        const match = containerText.match(pattern);
        if (match) {
          const current = parseInt(match[1]);
          const max = parseInt(match[2]);
          
          this.logger.logInfo(`Found participant info for ${className}: ${current}/${max}`);
          return { current, max };
        }
      }

      // Buscar elementos específicos de participantes
      try {
        const participantElement = await classContainer.locator(SELECTORS.modal.participantInfo).first();
        if (await participantElement.isVisible({ timeout: 1000 })) {
          const participantText = await participantElement.textContent() || '';
          const match = participantText.match(/(\d+)\/(\d+)/);
          if (match) {
            const current = parseInt(match[1]);
            const max = parseInt(match[2]);
            
            this.logger.logInfo(`Found participant info in element for ${className}: ${current}/${max}`);
            return { current, max };
          }
        }
      } catch {
        // Ignorar si no se encuentra el elemento específico
      }

      this.logger.logInfo(`No participant info found for class: ${className}`);
      return null;

    } catch (error) {
      this.logger.logError(error as Error, { 
        context: 'WebAutomationEngine.getParticipantInfo',
        className 
      });
      return null;
    }
  }

  async getAvailableSpaces(className: string): Promise<number | null> {
    const participantInfo = await this.getParticipantInfo(className);
    
    if (participantInfo) {
      const available = participantInfo.max - participantInfo.current;
      this.logger.logInfo(`Available spaces for ${className}: ${available}`);
      return available;
    }

    return null;
  }

  /**
   * Complete preparation phase for critical timing execution
   * Requirements 6.1, 6.2: Complete all setup before critical moment
   */
  async prepareReservation(
    email: string, 
    password: string, 
    dayToSelect: 'today' | 'tomorrow', 
    className: string
  ): Promise<void> {
    if (!this.page) {
      throw new Error('WebAutomationEngine not initialized. Call initialize() first.');
    }

    try {
      this.logger.logInfo('Starting reservation preparation phase', { className, dayToSelect });

      // Step 1: Complete login process
      const loginSuccess = await this.login(email, password);
      if (!loginSuccess) {
        throw new Error('Login failed during preparation phase');
      }

      // Step 2: Select target day (always "tomorrow" for 25h rule)
      await this.selectDay(dayToSelect);

      // Step 3: Preparation complete - ready to wait for exact timing
      this.logger.logInfo('Preparation phase completed - ready for critical timing execution', { className, dayToSelect });

      // Step 4: Position browser for critical timing execution
      await this.waitUntilReady();

      // Preparation complete - class verification will happen during critical execution
      this.logger.logInfo('Reservation preparation completed successfully', { 
        className, 
        dayToSelect
      });

    } catch (error) {
      this.logger.logError(error as Error, { 
        context: 'WebAutomationEngine.prepareReservation',
        className,
        dayToSelect
      });
      throw error;
    }
  }



  async waitUntilReady(): Promise<void> {
    if (!this.page) {
      throw new Error('WebAutomationEngine not initialized. Call initialize() first.');
    }

    try {
      this.logger.logInfo('Waiting until browser is ready for critical timing execution');

      // Verificar que la página está completamente cargada
      await this.page.waitForLoadState('networkidle', { timeout: 10000 });

      // Verificar que la lista de clases está visible
      await this.waitForClassListToLoad();

      this.logger.logInfo('Browser is ready for critical timing execution');
    } catch (error) {
      this.logger.logError(error as Error, { context: 'WebAutomationEngine.waitUntilReady' });
      throw error;
    }
  }

  /**
   * Execute critical timing reservation sequence
   * Requirements 3.5, 6.3: Execute at exact moment with maximum speed
   */
  async executeReservation(className: string): Promise<ReservationResult> {
    if (!this.page) {
      throw new Error('WebAutomationEngine not initialized. Call initialize() first.');
    }

    const startTime = new Date();
    
    try {
      this.logger.logInfo(`Executing critical timing reservation for class: ${className}`);

      // Step 1: Verify class exists and check status (moved from preparation)
      const classExists = await this.verifyClassExists(className);
      if (!classExists) {
        throw new Error(`Target class "${className}" not found on selected day`);
      }

      const classStatus = await this.checkClassStatus(className);
      if (classStatus === 'already_booked') {
        this.logger.logInfo(`Class ${className} is already booked - no action needed`);
        return {
          success: true,
          message: `Class ${className} is already booked`,
          timestamp: startTime,
          timingAccuracy: 0,
          hasSpots: false,
          classStatus: 'already_booked'
        };
      }

      if (classStatus === 'full') {
        throw new Error(`Class "${className}" is already at full capacity`);
      }

      // Step 2: Execute reservation - buscar el heading y hacer clic en su contenedor clickable
      const classHeading = this.page.getByRole('heading', { name: className, exact: true }).first();
      
      if (!(await classHeading.isVisible({ timeout: 2000 }))) {
        throw new Error(`Class "${className}" not found for reservation execution`);
      }

      // Encontrar el contenedor clickable (3 niveles arriba según análisis)
      const classContainer = classHeading.locator('..').locator('..').locator('..').first();

      // Hacer clic en el contenedor de la clase para abrir modal
      const classClickStart = new Date();
      await classContainer.click({ force: true }); // Forzar click si hay elementos superpuestos
      const classClickEnd = new Date();
      
      this.logger.logInfo(`Class clicked in ${classClickEnd.getTime() - classClickStart.getTime()}ms`, { className });

      // Action 2: Wait for modal and click reserve button with detailed timing logs
      const reserveButtonStart = new Date();
      this.logger.logInfo(`Starting search for reserve button at ${reserveButtonStart.toISOString()}`, { className });
      
      try {
        // Search for button with detailed timing logs
        const reserveButton = this.page.locator(SELECTORS.modal.reserveButton).first();
        
        // Poll for button visibility with 100ms intervals and log progress
        let buttonFound = false;
        const maxAttempts = 50; // 5 seconds total
        
        for (let attempt = 0; attempt < maxAttempts; attempt++) {
          const checkTime = new Date();
          const isVisible = await reserveButton.isVisible();
          
          if (isVisible) {
            const foundTime = new Date();
            this.logger.logInfo(`Reserve button found after ${foundTime.getTime() - reserveButtonStart.getTime()}ms (attempt ${attempt + 1})`, { className });
            buttonFound = true;
            break;
          }
          
          // Log every 500ms to track progress
          if (attempt % 5 === 0) {
            this.logger.logInfo(`Still searching for reserve button... ${checkTime.getTime() - reserveButtonStart.getTime()}ms elapsed (attempt ${attempt + 1}/${maxAttempts})`, { className });
          }
          
          await this.page.waitForTimeout(100);
        }
        
        if (!buttonFound) {
          throw new Error(`Reserve button not found after ${maxAttempts * 100}ms`);
        }
        
        // Click immediately when found with force to bypass intercepting elements
        const clickStart = new Date();
        await reserveButton.click({ force: true });
        const clickEnd = new Date();
        
        const reserveButtonEnd = new Date();
        this.logger.logInfo(`Reserve button clicked successfully: find=${reserveButtonEnd.getTime() - reserveButtonStart.getTime()}ms, click=${clickEnd.getTime() - clickStart.getTime()}ms`, { className });
        
      } catch (modalError) {
        // If modal doesn't open, try alternative approach
        this.logger.logInfo(`Modal not opened, attempting alternative reservation method`, { className });
        
        // Try direct reservation without modal (some classes might work differently)
        const alternativeReserveSelectors = [
          'button:has-text("Reservar")',
          'button:has-text("Inscribirse")',
          '[data-action="reserve"]',
          '.reserve-button'
        ];
        
        let alternativeSuccess = false;
        for (const selector of alternativeReserveSelectors) {
          try {
            const altButton = this.page.locator(selector).first();
            if (await altButton.isVisible({ timeout: 500 })) {
              await altButton.click();
              alternativeSuccess = true;
              this.logger.logInfo(`Alternative reservation method succeeded with selector: ${selector}`, { className });
              break;
            }
          } catch {
            // Continue to next selector
          }
        }
        
        if (!alternativeSuccess) {
          throw new Error(`Modal did not open and no alternative reservation method found: ${(modalError as Error).message}`);
        }
      }

      const executionEndTime = new Date();
      const executionDuration = executionEndTime.getTime() - startTime.getTime();

      this.logger.logInfo(`Critical sequence completed in ${executionDuration}ms`, { className });

      // Action 3: Verify reservation result (with shorter timeout for speed)
      const result = await this.verifyReservationSuccess(className);
      
      const finalEndTime = new Date();
      const totalTimingAccuracy = finalEndTime.getTime() - startTime.getTime();

      this.logger.logInfo(`Reservation execution completed`, { 
        className, 
        success: result.success,
        executionDuration,
        totalTimingAccuracy
      });

      return {
        ...result,
        timestamp: startTime,
        timingAccuracy: totalTimingAccuracy
      };

    } catch (error) {
      const endTime = new Date();
      const timingAccuracy = endTime.getTime() - startTime.getTime();

      this.logger.logError(error as Error, { 
        context: 'WebAutomationEngine.executeReservation',
        className,
        timingAccuracy
      });

      return {
        success: false,
        message: `Reservation failed: ${(error as Error).message}`,
        timestamp: startTime,
        timingAccuracy,
        hasSpots: false,
        classStatus: 'available'
      };
    }
  }

  /**
   * Execute ultra-fast reservation using JavaScript evaluation for maximum speed
   * Requirements 6.3: Optimize for millisecond-level timing accuracy
   */
  async executeReservationUltraFast(className: string): Promise<ReservationResult> {
    if (!this.page) {
      throw new Error('WebAutomationEngine not initialized. Call initialize() first.');
    }

    const startTime = new Date();
    
    try {
      this.logger.logInfo(`Executing ultra-fast reservation for class: ${className}`);

      // Use JavaScript evaluation for maximum speed (bypasses Playwright's safety checks)
      const executionResult = await this.page.evaluate((className) => {
        const startTime = Date.now();
        
        // Find class container element using updated selector based on real BoxMagic structure
        const classSelectors = [
          `.tarjetaInstancia:has(h2:contains("${className}"))`,
          `h2:contains("${className}")`,
          `h3:contains("${className}")`,
          `h4:contains("${className}")`,
          `[role="heading"]:contains("${className}")`,
          `*:contains("${className}")`
        ];
        
        let classElement: Element | null = null;
        for (const selector of classSelectors) {
          try {
            classElement = document.querySelector(selector);
            if (classElement) break;
          } catch {
            // Continue to next selector
          }
        }
        
        if (!classElement) {
          return {
            success: false,
            message: `Class "${className}" not found`,
            duration: Date.now() - startTime
          };
        }
        
        // Click class element
        (classElement as HTMLElement).click();
        
        // Wait briefly for modal to appear
        const modalWaitStart = Date.now();
        let reserveButton: Element | null = null;
        
        // Polling for reserve button with timeout
        const maxWait = 2000; // 2 seconds max
        while (Date.now() - modalWaitStart < maxWait) {
          reserveButton = document.querySelector('button:has-text("Agendar")') ||
                          document.querySelector('button:contains("Agendar")') ||
                          document.querySelector('[data-action="reserve"]');
          
          if (reserveButton) {
            (reserveButton as HTMLElement).click();
            return {
              success: true,
              message: `Ultra-fast reservation executed for ${className}`,
              duration: Date.now() - startTime
            };
          }
          
          // Small delay to prevent excessive CPU usage
          const now = Date.now();
          while (Date.now() - now < 10) {
            // Busy wait for 10ms
          }
        }
        
        return {
          success: false,
          message: `Reserve button not found within timeout for ${className}`,
          duration: Date.now() - startTime
        };
        
      }, className);

      const executionEndTime = new Date();
      const executionDuration = executionEndTime.getTime() - startTime.getTime();

      this.logger.logInfo(`Ultra-fast execution completed in ${executionDuration}ms`, { 
        className,
        jsExecutionDuration: executionResult.duration
      });

      if (executionResult.success) {
        // Verify the result
        const verificationResult = await this.verifyReservationSuccess(className);
        
        return {
          ...verificationResult,
          timestamp: startTime,
          timingAccuracy: executionDuration
        };
      } else {
        return {
          success: false,
          message: executionResult.message,
          timestamp: startTime,
          timingAccuracy: executionDuration,
          hasSpots: false,
          classStatus: 'available'
        };
      }

    } catch (error) {
      const endTime = new Date();
      const timingAccuracy = endTime.getTime() - startTime.getTime();

      this.logger.logError(error as Error, { 
        context: 'WebAutomationEngine.executeReservationUltraFast',
        className,
        timingAccuracy
      });

      return {
        success: false,
        message: `Ultra-fast reservation failed: ${(error as Error).message}`,
        timestamp: startTime,
        timingAccuracy,
        hasSpots: false,
        classStatus: 'available'
      };
    }
  }

  /**
   * Verify reservation success with comprehensive result detection
   * Requirements 3.6: Detect reservation success/failure states
   */
  async verifyReservationSuccess(className: string): Promise<ReservationResult> {
    if (!this.page) {
      throw new Error('WebAutomationEngine not initialized. Call initialize() first.');
    }

    const timestamp = new Date();

    try {
      this.logger.logInfo(`Verifying reservation result for class: ${className}`);

      // Wait for UI to update after reservation attempt
      await this.page.waitForTimeout(1500);

      // Check for success indicators first (most important)
      const isBooked = await this.page.locator(SELECTORS.classes.alreadyBooked).isVisible({ timeout: 3000 });
      
      if (isBooked) {
        this.logger.logInfo(`Reservation successful - class ${className} is now booked`);
        
        const participantInfo = await this.getParticipantInfo(className);
        
        return {
          success: true,
          message: `Successfully reserved ${className}`,
          timestamp,
          timingAccuracy: 0, // Will be set by caller
          hasSpots: true,
          participantCount: participantInfo ? `${participantInfo.current}/${participantInfo.max}` : undefined,
          classStatus: 'already_booked'
        };
      }

      // Check for "Agendando..." state (reservation in progress)
      const isReserving = await this.page.locator(SELECTORS.modal.reservingButton).isVisible({ timeout: 1000 });
      
      if (isReserving) {
        this.logger.logInfo(`Reservation in progress for ${className}, waiting for completion`);
        
        // Wait a bit more for the reservation to complete
        await this.page.waitForTimeout(2000);
        
        // Check again for success
        const finalCheck = await this.page.locator(SELECTORS.classes.alreadyBooked).isVisible({ timeout: 2000 });
        
        if (finalCheck) {
          const participantInfo = await this.getParticipantInfo(className);
          
          return {
            success: true,
            message: `Successfully reserved ${className} (after processing delay)`,
            timestamp,
            timingAccuracy: 0,
            hasSpots: true,
            participantCount: participantInfo ? `${participantInfo.current}/${participantInfo.max}` : undefined,
            classStatus: 'already_booked'
          };
        }
      }

      // Check for failure indicators
      const isFull = await this.page.locator(SELECTORS.classes.fullCapacity).isVisible({ timeout: 1000 });
      
      if (isFull) {
        this.logger.logInfo(`Reservation failed - class ${className} is at full capacity`);
        
        return {
          success: false,
          message: `Class ${className} is at full capacity`,
          timestamp,
          timingAccuracy: 0,
          hasSpots: false,
          classStatus: 'full'
        };
      }

      // Check if class still shows as available (reservation might have failed silently)
      const hasAvailableSpaces = await this.page.locator(SELECTORS.classes.availableSpaces).isVisible({ timeout: 1000 });
      
      if (hasAvailableSpaces) {
        const participantInfo = await this.getParticipantInfo(className);
        
        return {
          success: false,
          message: `Reservation attempt failed - class ${className} still shows as available`,
          timestamp,
          timingAccuracy: 0,
          hasSpots: true,
          participantCount: participantInfo ? `${participantInfo.current}/${participantInfo.max}` : undefined,
          classStatus: 'available'
        };
      }

      // If no clear indicators found, check for error messages
      const errorMessages = await this.detectErrorMessages();
      
      if (errorMessages.length > 0) {
        return {
          success: false,
          message: `Reservation failed: ${errorMessages.join(', ')}`,
          timestamp,
          timingAccuracy: 0,
          hasSpots: false,
          classStatus: 'available'
        };
      }

      // Default case - unclear result
      this.logger.logInfo(`Reservation result unclear for ${className}`);
      
      return {
        success: false,
        message: `Reservation result unclear for ${className} - no definitive success or failure indicators found`,
        timestamp,
        timingAccuracy: 0,
        hasSpots: false,
        classStatus: 'available'
      };

    } catch (error) {
      this.logger.logError(error as Error, { 
        context: 'WebAutomationEngine.verifyReservationSuccess',
        className 
      });

      return {
        success: false,
        message: `Failed to verify reservation result: ${(error as Error).message}`,
        timestamp,
        timingAccuracy: 0,
        hasSpots: false,
        classStatus: 'available'
      };
    }
  }

  /**
   * Detect error messages on the page
   * Requirements 3.6: Handle different types of failure
   */
  private async detectErrorMessages(): Promise<string[]> {
    if (!this.page) return [];

    const errorMessages: string[] = [];

    try {
      // Common error message patterns in Spanish and English
      const errorSelectors = [
        'text=Error',
        'text=No se pudo',
        'text=Falló',
        'text=Sin conexión',
        'text=Tiempo agotado',
        'text=Network error',
        'text=Connection failed',
        'text=Server error',
        'text=No disponible',
        'text=Unavailable',
        'text=Sesión expirada',
        'text=Session expired',
        '[role="alert"]',
        '.error-message',
        '.alert-error',
        '.error',
        '.alert-danger',
        '[data-testid="error"]'
      ];

      for (const selector of errorSelectors) {
        try {
          const element = this.page.locator(selector).first();
          if (await element.isVisible({ timeout: 500 })) {
            const text = await element.textContent();
            if (text) {
              errorMessages.push(text.trim());
            }
          }
        } catch {
          // Continue checking other selectors
        }
      }

    } catch (error) {
      this.logger.logError(error as Error, { context: 'WebAutomationEngine.detectErrorMessages' });
    }

    return errorMessages;
  }

  /**
   * Detect changes in participant count after reservation attempt
   * Requirements 3.6: Detect changes in counter of participants
   */
  async detectParticipantCountChange(className: string, previousCount?: { current: number; max: number }): Promise<{
    changed: boolean;
    previousCount?: { current: number; max: number };
    newCount?: { current: number; max: number };
    increased: boolean;
  }> {
    try {
      this.logger.logInfo(`Detecting participant count change for class: ${className}`);

      const currentCount = await this.getParticipantInfo(className);
      
      if (!previousCount || !currentCount) {
        return {
          changed: false,
          previousCount,
          newCount: currentCount || undefined,
          increased: false
        };
      }

      const changed = previousCount.current !== currentCount.current;
      const increased = currentCount.current > previousCount.current;

      if (changed) {
        this.logger.logInfo(`Participant count changed for ${className}`, {
          previous: `${previousCount.current}/${previousCount.max}`,
          current: `${currentCount.current}/${currentCount.max}`,
          increased
        });
      }

      return {
        changed,
        previousCount,
        newCount: currentCount,
        increased
      };

    } catch (error) {
      this.logger.logError(error as Error, { 
        context: 'WebAutomationEngine.detectParticipantCountChange',
        className 
      });

      return {
        changed: false,
        previousCount,
        increased: false
      };
    }
  }

  /**
   * Enhanced verification with multiple failure type detection
   * Requirements 3.6: Handle different types of failure (network, capacity, etc.)
   */
  async verifyReservationWithFailureTypes(className: string): Promise<ReservationResult & {
    failureType?: 'network_error' | 'capacity_full' | 'already_booked' | 'session_expired' | 'class_not_found' | 'unknown';
    participantCountChange?: {
      changed: boolean;
      previousCount?: { current: number; max: number };
      newCount?: { current: number; max: number };
      increased: boolean;
    };
  }> {
    const timestamp = new Date();

    try {
      this.logger.logInfo(`Enhanced verification for class: ${className}`);

      // Get initial participant count for comparison
      const initialCount = await this.getParticipantInfo(className);

      // Wait for UI to update
      await this.page!.waitForTimeout(1500);

      // Check for success first
      const isBooked = await this.page!.locator(SELECTORS.classes.alreadyBooked).isVisible({ timeout: 3000 });
      
      if (isBooked) {
        const participantCountChange = await this.detectParticipantCountChange(className, initialCount || undefined);
        
        return {
          success: true,
          message: `Successfully reserved ${className}`,
          timestamp,
          timingAccuracy: 0,
          hasSpots: true,
          participantCount: participantCountChange.newCount ? 
            `${participantCountChange.newCount.current}/${participantCountChange.newCount.max}` : undefined,
          classStatus: 'already_booked',
          participantCountChange
        };
      }

      // Check for specific failure types
      
      // 1. Network/Connection errors
      const networkErrors = await this.detectErrorMessages();
      if (networkErrors.length > 0) {
        return {
          success: false,
          message: `Network error: ${networkErrors.join(', ')}`,
          timestamp,
          timingAccuracy: 0,
          hasSpots: false,
          classStatus: 'available',
          failureType: 'network_error'
        };
      }

      // 2. Capacity full
      const isFull = await this.page!.locator(SELECTORS.classes.fullCapacity).isVisible({ timeout: 1000 });
      if (isFull) {
        return {
          success: false,
          message: `Class ${className} is at full capacity`,
          timestamp,
          timingAccuracy: 0,
          hasSpots: false,
          classStatus: 'full',
          failureType: 'capacity_full'
        };
      }

      // 3. Session expired
      const sessionExpiredIndicators = [
        'text=Sesión expirada',
        'text=Session expired',
        'text=Inicia sesión',
        'text=Login required',
        'input[name="email"]' // Login form appeared
      ];

      for (const indicator of sessionExpiredIndicators) {
        if (await this.page!.locator(indicator).isVisible({ timeout: 500 })) {
          return {
            success: false,
            message: `Session expired during reservation for ${className}`,
            timestamp,
            timingAccuracy: 0,
            hasSpots: false,
            classStatus: 'available',
            failureType: 'session_expired'
          };
        }
      }

      // 4. Class not found (might have been removed or changed)
      const classExists = await this.verifyClassExists(className);
      if (!classExists) {
        return {
          success: false,
          message: `Class ${className} not found after reservation attempt`,
          timestamp,
          timingAccuracy: 0,
          hasSpots: false,
          classStatus: 'available',
          failureType: 'class_not_found'
        };
      }

      // 5. Check if still available (silent failure)
      const hasAvailableSpaces = await this.page!.locator(SELECTORS.classes.availableSpaces).isVisible({ timeout: 1000 });
      
      if (hasAvailableSpaces) {
        const participantCountChange = await this.detectParticipantCountChange(className, initialCount || undefined);
        
        return {
          success: false,
          message: `Reservation attempt failed silently - class ${className} still shows as available`,
          timestamp,
          timingAccuracy: 0,
          hasSpots: true,
          participantCount: participantCountChange.newCount ? 
            `${participantCountChange.newCount.current}/${participantCountChange.newCount.max}` : undefined,
          classStatus: 'available',
          failureType: 'unknown',
          participantCountChange
        };
      }

      // Default unknown failure
      return {
        success: false,
        message: `Reservation result unclear for ${className} - no definitive indicators found`,
        timestamp,
        timingAccuracy: 0,
        hasSpots: false,
        classStatus: 'available',
        failureType: 'unknown'
      };

    } catch (error) {
      this.logger.logError(error as Error, { 
        context: 'WebAutomationEngine.verifyReservationWithFailureTypes',
        className 
      });

      return {
        success: false,
        message: `Failed to verify reservation result: ${(error as Error).message}`,
        timestamp,
        timingAccuracy: 0,
        hasSpots: false,
        classStatus: 'available',
        failureType: 'unknown'
      };
    }
  }



  async cleanup(): Promise<void> {
    try {
      this.logger.logInfo('Cleaning up WebAutomationEngine resources');

      if (this.page) {
        await this.page.close();
        this.page = null;
      }

      if (this.context) {
        await this.context.close();
        this.context = null;
      }

      if (this.browser) {
        await this.browser.close();
        this.browser = null;
      }

      this.isInitialized = false;
      this.logger.logInfo('WebAutomationEngine cleanup completed');
    } catch (error) {
      this.logger.logError(error as Error, { context: 'WebAutomationEngine.cleanup' });
    }
  }
}