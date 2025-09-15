/**
 * Script de monitoreo de selectores web
 * Detecta cambios en IDs, clases y otros selectores para analizar posibles controles anti-automatización
 */

import { chromium } from 'playwright-core';
import chromiumBinary from '@sparticuz/chromium';
import { writeFileSync, existsSync, readFileSync, mkdirSync } from 'fs';
import { join } from 'path';

class SelectorMonitor {
  constructor() {
    this.browser = null;
    this.context = null;
    this.page = null;
    this.runId = Date.now();
    this.evidenceDir = `./evidence/${this.runId}`;
    this.logFile = `./evidence/monitoring-log.json`;
    this.currentRun = {
      runId: this.runId,
      timestamp: new Date().toISOString(),
      url: '',
      steps: [],
      selectors: {},
      screenshots: [],
      domSnapshots: []
    };
    
    // Crear directorio de evidencias
    if (!existsSync('./evidence')) {
      mkdirSync('./evidence');
    }
    if (!existsSync(this.evidenceDir)) {
      mkdirSync(this.evidenceDir);
    }
  }

  async initialize() {
    console.log(`🚀 Iniciando monitoreo - Run ID: ${this.runId}`);
    
    this.browser = await chromium.launch({
      args: chromiumBinary.args,
      executablePath: await chromiumBinary.executablePath(),{
      headless: false, // Para poder ver lo que sucede
      channel: 'chrome',
      args: [
        '--no-sandbox',
        '--disable-setuid-sandbox',
        '--disable-dev-shm-usage',
        '--disable-blink-features=AutomationControlled',
        '--disable-automation',
        '--no-first-run'
      ]
    });

    this.context = await this.browser.newContext({
      viewport: { width: 1366, height: 768 },
      userAgent: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
      locale: 'es-CL',
      timezoneId: 'America/Santiago'
    });

    this.page = await this.context.newPage();
    
    // Eliminar indicadores de automatización
    await this.page.addInitScript(() => {
      delete (window as any).navigator.webdriver;
      Object.defineProperty(navigator, 'plugins', {
        get: () => [1, 2, 3, 4, 5]
      });
    });
  }

  async captureEvidence(stepName, description) {
    console.log(`📸 Capturando evidencia: ${stepName}`);
    
    const stepData = {
      step: stepName,
      description,
      timestamp: new Date().toISOString(),
      url: this.page.url(),
      selectors: {},
      screenshot: null,
      domSnapshot: null
    };

    // Capturar screenshot
    const screenshotPath = join(this.evidenceDir, `${stepName}-screenshot.png`);
    await this.page.screenshot({ 
      path: screenshotPath, 
      fullPage: true 
    });
    stepData.screenshot = screenshotPath;

    // Capturar selectores específicos de BoxMagic
    stepData.selectors = await this.page.evaluate(() => {
      const selectors = {};
      
      // Buscar elementos de login
      const emailInputs = document.querySelectorAll('input[type="email"], input[placeholder*="Correo"], input[placeholder*="Email"]');
      emailInputs.forEach((el, i) => {
        selectors[`email_input_${i}`] = {
          id: el.id,
          className: el.className,
          name: el.name,
          placeholder: el.placeholder,
          selector: this.generateSelector(el)
        };
      });

      const passwordInputs = document.querySelectorAll('input[type="password"], input[placeholder*="Contraseña"], input[placeholder*="Password"]');
      passwordInputs.forEach((el, i) => {
        selectors[`password_input_${i}`] = {
          id: el.id,
          className: el.className,
          name: el.name,
          placeholder: el.placeholder,
          selector: this.generateSelector(el)
        };
      });

      // Buscar botones de login
      const loginButtons = document.querySelectorAll('button:contains("Ingresar"), button:contains("Login"), [role="button"]:contains("Ingresar")');
      loginButtons.forEach((el, i) => {
        selectors[`login_button_${i}`] = {
          id: el.id,
          className: el.className,
          textContent: el.textContent?.trim(),
          selector: this.generateSelector(el)
        };
      });

      // Buscar elementos de navegación de días
      const dayButtons = document.querySelectorAll('button:contains("Hoy"), button:contains("Mañana"), button:contains("Today"), button:contains("Tomorrow")');
      dayButtons.forEach((el, i) => {
        selectors[`day_button_${i}`] = {
          id: el.id,
          className: el.className,
          textContent: el.textContent?.trim(),
          selector: this.generateSelector(el)
        };
      });

      // Buscar elementos de clases
      const classHeadings = document.querySelectorAll('h1, h2, h3, h4, h5, h6, [role="heading"]');
      classHeadings.forEach((el, i) => {
        if (el.textContent && (el.textContent.includes('CrossFit') || el.textContent.includes('Gymnastics') || el.textContent.includes('WOD'))) {
          selectors[`class_heading_${i}`] = {
            id: el.id,
            className: el.className,
            textContent: el.textContent?.trim(),
            tagName: el.tagName,
            selector: this.generateSelector(el)
          };
        }
      });

      // Buscar botones de reserva
      const reserveButtons = document.querySelectorAll('button:contains("Agendar"), button:contains("Reservar"), [role="button"]:contains("Agendar")');
      reserveButtons.forEach((el, i) => {
        selectors[`reserve_button_${i}`] = {
          id: el.id,
          className: el.className,
          textContent: el.textContent?.trim(),
          selector: this.generateSelector(el)
        };
      });

      // Buscar modales y popups
      const modals = document.querySelectorAll('[role="dialog"], .modal, .popup, dialog');
      modals.forEach((el, i) => {
        selectors[`modal_${i}`] = {
          id: el.id,
          className: el.className,
          visible: !el.hidden && el.style.display !== 'none',
          selector: this.generateSelector(el)
        };
      });

      // Función auxiliar para generar selectores únicos
      function generateSelector(element) {
        if (element.id) return `#${element.id}`;
        
        let selector = element.tagName.toLowerCase();
        if (element.className) {
          const classes = element.className.split(' ').filter(cls => cls.trim());
          if (classes.length > 0) {
            selector += '.' + classes.join('.');
          }
        }
        
        // Agregar posición si es necesario
        const siblings = Array.from(element.parentElement?.children || [])
          .filter(el => el.tagName === element.tagName);
        if (siblings.length > 1) {
          const index = siblings.indexOf(element);
          selector += `:nth-child(${index + 1})`;
        }
        
        return selector;
      }

      return selectors;
    });

    // Capturar HTML del DOM
    const domContent = await this.page.content();
    const domPath = join(this.evidenceDir, `${stepName}-dom.html`);
    writeFileSync(domPath, domContent);
    stepData.domSnapshot = domPath;

    // Agregar información adicional de la página
    stepData.pageInfo = {
      title: await this.page.title(),
      url: this.page.url(),
      viewport: await this.page.viewportSize(),
      loadState: await this.page.evaluate(() => document.readyState)
    };

    this.currentRun.steps.push(stepData);
    this.saveRunData();
    
    console.log(`✅ Evidencia capturada para: ${stepName}`);
    return stepData;
  }

  async navigateToBoxMagic() {
    console.log('🌐 Navegando a BoxMagic...');
    await this.page.goto('https://members.boxmagic.app/acceso/ingreso');
    await this.page.waitForTimeout(3000);
    
    this.currentRun.url = this.page.url();
    await this.captureEvidence('01_initial_load', 'Página inicial de BoxMagic cargada');
  }

  async waitForUserInstruction(message) {
    console.log(`\n⏸️  ${message}`);
    console.log('Presiona ENTER para continuar...');
    
    return new Promise((resolve) => {
      process.stdin.once('data', () => {
        resolve();
      });
    });
  }

  async executeStep(stepName, description, action) {
    console.log(`\n🔄 Ejecutando: ${stepName}`);
    console.log(`   ${description}`);
    
    if (action) {
      await action();
    }
    
    await this.captureEvidence(stepName, description);
    await this.waitForUserInstruction(`Completa el paso: ${description}`);
  }

  async runMonitoringSession() {
    console.log('\n🎯 Iniciando sesión de monitoreo de selectores\n');
    
    await this.navigateToBoxMagic();

    // Paso 1: Examinar página de login
    await this.executeStep(
      '02_login_page_analysis', 
      'Analizar elementos de la página de login',
      null
    );

    // Paso 2: Llenar credenciales (manual)
    await this.executeStep(
      '03_fill_credentials', 
      'Llenar credenciales de login (hazlo manualmente)',
      null
    );

    // Paso 3: Hacer clic en botón login
    await this.executeStep(
      '04_click_login', 
      'Hacer clic en botón Ingresar (hazlo manualmente)',
      null
    );

    // Paso 4: Página de horarios cargada
    await this.executeStep(
      '05_schedule_page_loaded', 
      'Página de horarios cargada',
      async () => {
        await this.page.waitForTimeout(3000);
      }
    );

    // Paso 5: Seleccionar día
    await this.executeStep(
      '06_select_day', 
      'Seleccionar día (Hoy/Mañana) - hazlo manualmente',
      null
    );

    // Paso 6: Examinar lista de clases
    await this.executeStep(
      '07_examine_classes', 
      'Examinar lista de clases disponibles',
      async () => {
        await this.page.waitForTimeout(2000);
      }
    );

    // Paso 7: Hacer clic en una clase
    await this.executeStep(
      '08_click_class', 
      'Hacer clic en una clase para abrir modal (hazlo manualmente)',
      null
    );

    // Paso 8: Examinar modal de reserva
    await this.executeStep(
      '09_examine_modal', 
      'Examinar modal de reserva que se abrió',
      async () => {
        await this.page.waitForTimeout(1000);
      }
    );

    // Paso 9: Cerrar modal
    await this.executeStep(
      '10_close_modal', 
      'Cerrar modal (hazlo manualmente)',
      null
    );

    // Paso 10: Logout
    await this.executeStep(
      '11_logout', 
      'Hacer logout (opcional - hazlo manualmente)',
      null
    );

    console.log('\n✅ Sesión de monitoreo completada');
    console.log(`📁 Evidencias guardadas en: ${this.evidenceDir}`);
    console.log(`📊 Log completo en: ${this.logFile}`);
  }

  saveRunData() {
    // Guardar datos de la ejecución actual
    const runPath = join(this.evidenceDir, 'run-data.json');
    writeFileSync(runPath, JSON.stringify(this.currentRun, null, 2));

    // Actualizar log histórico
    let historicalLog = [];
    if (existsSync(this.logFile)) {
      try {
        historicalLog = JSON.parse(readFileSync(this.logFile, 'utf8'));
      } catch (error) {
        console.warn('⚠️  Error leyendo log histórico:', error.message);
      }
    }

    // Agregar resumen de la ejecución actual
    historicalLog.push({
      runId: this.runId,
      timestamp: this.currentRun.timestamp,
      url: this.currentRun.url,
      stepCount: this.currentRun.steps.length,
      selectorCount: Object.keys(this.currentRun.selectors).length,
      evidenceDir: this.evidenceDir
    });

    writeFileSync(this.logFile, JSON.stringify(historicalLog, null, 2));
  }

  async compareWithPreviousRuns() {
    if (!existsSync(this.logFile)) {
      console.log('📋 No hay ejecuciones previas para comparar');
      return;
    }

    const historicalLog = JSON.parse(readFileSync(this.logFile, 'utf8'));
    
    if (historicalLog.length < 2) {
      console.log('📋 Se necesitan al menos 2 ejecuciones para comparar');
      return;
    }

    console.log('\n🔍 Comparando con ejecuciones previas...');
    
    // Comparar última ejecución con la anterior
    const currentRun = historicalLog[historicalLog.length - 1];
    const previousRun = historicalLog[historicalLog.length - 2];
    
    console.log(`\n📊 Comparación entre runs:`);
    console.log(`   Actual: ${currentRun.runId} (${currentRun.timestamp})`);
    console.log(`   Anterior: ${previousRun.runId} (${previousRun.timestamp})`);
    
    // Aquí podrías agregar lógica de comparación más detallada
    // analizando los selectores específicos entre ejecuciones
  }

  async cleanup() {
    console.log('\n🧹 Limpiando recursos...');
    
    if (this.page) await this.page.close();
    if (this.context) await this.context.close();
    if (this.browser) await this.browser.close();
    
    console.log('✅ Cleanup completado');
  }
}

// Función principal para ejecutar el monitoreo
async function runSelectorMonitoring() {
  const monitor = new SelectorMonitor();
  
  try {
    await monitor.initialize();
    await monitor.runMonitoringSession();
    await monitor.compareWithPreviousRuns();
  } catch (error) {
    console.error('❌ Error durante el monitoreo:', error);
  } finally {
    await monitor.cleanup();
  }
}

// Ejecutar si es llamado directamente
if (import.meta.url === `file://${process.argv[1]}`) {
  runSelectorMonitoring().catch(console.error);
}

export { SelectorMonitor, runSelectorMonitoring };