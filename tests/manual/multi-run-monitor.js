/**
 * Script para ejecutar múltiples sesiones de monitoreo automáticamente
 * Permite programar varias ejecuciones con intervalos específicos
 */

import { SelectorMonitor } from './selector-monitor.js';
import { writeFileSync, existsSync, readFileSync } from 'fs';

class MultiRunMonitor {
  constructor(config = {}) {
    this.config = {
      runs: 5, // Número de ejecuciones
      interval: 30000, // Intervalo entre ejecuciones (30 segundos)
      randomizeInterval: true, // Aleatorizar intervalo para simular uso humano
      headless: true, // Ejecutar en modo headless para múltiples runs
      saveDetailedLogs: true,
      ...config
    };
    
    this.runs = [];
    this.startTime = new Date();
  }

  async executeMultipleRuns() {
    console.log(`\n🚀 Iniciando ${this.config.runs} ejecuciones de monitoreo`);
    console.log(`⏱️  Intervalo base: ${this.config.interval}ms`);
    console.log(`🎲 Aleatorización: ${this.config.randomizeInterval ? 'Sí' : 'No'}\n`);

    for (let i = 1; i <= this.config.runs; i++) {
      console.log(`\n📋 ===== EJECUCIÓN ${i}/${this.config.runs} =====`);
      
      const runStart = new Date();
      let runData = null;
      
      try {
        runData = await this.executeAutomatedRun(i);
        runData.success = true;
        runData.error = null;
      } catch (error) {
        console.error(`❌ Error en ejecución ${i}:`, error.message);
        runData = {
          runNumber: i,
          runId: Date.now(),
          startTime: runStart,
          endTime: new Date(),
          success: false,
          error: error.message,
          selectors: {},
          screenshots: [],
          url: 'error'
        };
      }
      
      runData.duration = runData.endTime.getTime() - runData.startTime.getTime();
      this.runs.push(runData);
      
      // Guardar progreso
      this.saveProgressData();
      
      // Esperar antes de la siguiente ejecución (excepto en la última)
      if (i < this.config.runs) {
        const waitTime = this.calculateWaitTime();
        console.log(`⏳ Esperando ${waitTime}ms antes de la siguiente ejecución...`);
        await this.sleep(waitTime);
      }
    }

    console.log('\n✅ Todas las ejecuciones completadas');
    await this.generateAnalysisReport();
  }

  async executeAutomatedRun(runNumber) {
    const monitor = new SelectorMonitor();
    monitor.runId = `multi_${Date.now()}_${runNumber}`;
    
    // Configurar para ejecución automática
    await monitor.initialize();
    
    const runData = {
      runNumber,
      runId: monitor.runId,
      startTime: new Date(),
      endTime: null,
      selectors: {},
      screenshots: [],
      url: '',
      steps: []
    };

    try {
      // Navegación automática básica
      await monitor.page.goto('https://members.boxmagic.app/acceso/ingreso', {
        waitUntil: 'domcontentloaded',
        timeout: 30000
      });
      
      runData.url = monitor.page.url();
      
      // Capturar estado inicial
      const initialEvidence = await monitor.captureEvidence(
        `run${runNumber}_01_initial`, 
        `Ejecución ${runNumber} - Estado inicial`
      );
      
      runData.screenshots.push(initialEvidence.screenshot);
      runData.selectors.initial = initialEvidence.selectors;
      runData.steps.push(initialEvidence);

      // Esperar carga completa
      await monitor.page.waitForTimeout(5000);
      
      // Capturar estado después de carga
      const loadedEvidence = await monitor.captureEvidence(
        `run${runNumber}_02_loaded`, 
        `Ejecución ${runNumber} - Página completamente cargada`
      );
      
      runData.screenshots.push(loadedEvidence.screenshot);
      runData.selectors.loaded = loadedEvidence.selectors;
      runData.steps.push(loadedEvidence);

      // Intentar buscar elementos específicos y documentar cambios
      const selectorAnalysis = await this.analyzeSelectorsInPage(monitor.page, runNumber);
      runData.selectorAnalysis = selectorAnalysis;

      runData.endTime = new Date();
      
      console.log(`✅ Run ${runNumber} completado exitosamente`);
      
      await monitor.cleanup();
      return runData;
      
    } catch (error) {
      await monitor.cleanup();
      throw error;
    }
  }

  async analyzeSelectorsInPage(page, runNumber) {
    console.log(`🔍 Analizando selectores en ejecución ${runNumber}...`);
    
    return await page.evaluate((runNumber) => {
      const analysis = {
        runNumber,
        timestamp: new Date().toISOString(),
        findings: {}
      };

      // Analizar elementos de login
      const emailElements = document.querySelectorAll('input[type="email"], input[placeholder*="Correo"], input[name*="email"]');
      analysis.findings.emailInputs = Array.from(emailElements).map(el => ({
        id: el.id,
        className: el.className,
        name: el.name,
        placeholder: el.placeholder,
        type: el.type,
        xpath: this.getXPath(el),
        cssSelector: this.getCSSSelector(el)
      }));

      const passwordElements = document.querySelectorAll('input[type="password"], input[placeholder*="Contraseña"]');
      analysis.findings.passwordInputs = Array.from(passwordElements).map(el => ({
        id: el.id,
        className: el.className,
        name: el.name,
        placeholder: el.placeholder,
        type: el.type,
        xpath: this.getXPath(el),
        cssSelector: this.getCSSSelector(el)
      }));

      const buttons = document.querySelectorAll('button, input[type="button"], input[type="submit"]');
      analysis.findings.buttons = Array.from(buttons).map(el => ({
        id: el.id,
        className: el.className,
        textContent: el.textContent?.trim(),
        type: el.type,
        value: el.value,
        xpath: this.getXPath(el),
        cssSelector: this.getCSSSelector(el)
      }));

      // Buscar elementos dinámicos que cambien
      const dynamicElements = document.querySelectorAll('[id*="react"], [class*="css-"], [class*="styled-"], [data-testid]');
      analysis.findings.dynamicElements = Array.from(dynamicElements).map(el => ({
        id: el.id,
        className: el.className,
        tagName: el.tagName,
        dataTestId: el.getAttribute('data-testid'),
        xpath: this.getXPath(el),
        cssSelector: this.getCSSSelector(el)
      }));

      // Funciones auxiliares
      function getXPath(element) {
        if (element.id) {
          return `//*[@id="${element.id}"]`;
        }
        
        const parts = [];
        while (element && element.nodeType === Node.ELEMENT_NODE) {
          let index = 0;
          let sibling = element.previousSibling;
          while (sibling) {
            if (sibling.nodeType === Node.ELEMENT_NODE && sibling.nodeName === element.nodeName) {
              index++;
            }
            sibling = sibling.previousSibling;
          }
          
          const tagName = element.nodeName.toLowerCase();
          const part = index > 0 ? `${tagName}[${index + 1}]` : tagName;
          parts.unshift(part);
          element = element.parentNode;
        }
        
        return parts.length ? '/' + parts.join('/') : '';
      }

      function getCSSSelector(element) {
        if (element.id) {
          return `#${element.id}`;
        }
        
        const path = [];
        while (element && element.nodeType === Node.ELEMENT_NODE) {
          let selector = element.nodeName.toLowerCase();
          
          if (element.className) {
            const classes = element.className.split(/\s+/).filter(cls => cls);
            if (classes.length > 0) {
              selector += '.' + classes.join('.');
            }
          }
          
          path.unshift(selector);
          element = element.parentElement;
        }
        
        return path.join(' > ');
      }

      return analysis;
    }, runNumber);
  }

  calculateWaitTime() {
    if (!this.config.randomizeInterval) {
      return this.config.interval;
    }
    
    // Aleatorizar ±25% del intervalo base
    const variation = this.config.interval * 0.25;
    const randomVariation = (Math.random() - 0.5) * 2 * variation;
    return Math.max(1000, this.config.interval + randomVariation);
  }

  sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  saveProgressData() {
    const progressData = {
      startTime: this.startTime,
      currentTime: new Date(),
      totalRuns: this.config.runs,
      completedRuns: this.runs.length,
      config: this.config,
      runs: this.runs
    };
    
    writeFileSync('./evidence/multi-run-progress.json', JSON.stringify(progressData, null, 2));
  }

  async generateAnalysisReport() {
    console.log('\n📊 Generando reporte de análisis...');
    
    const report = {
      summary: {
        totalRuns: this.runs.length,
        successfulRuns: this.runs.filter(r => r.success).length,
        failedRuns: this.runs.filter(r => !r.success).length,
        averageDuration: this.runs.reduce((sum, r) => sum + (r.duration || 0), 0) / this.runs.length,
        startTime: this.startTime,
        endTime: new Date(),
        totalDuration: new Date().getTime() - this.startTime.getTime()
      },
      selectorChanges: this.analyzeSelectorChanges(),
      consistencyAnalysis: this.analyzeConsistency(),
      suspiciousPatterns: this.detectSuspiciousPatterns(),
      recommendations: this.generateRecommendations()
    };
    
    const reportPath = './evidence/multi-run-analysis.json';
    writeFileSync(reportPath, JSON.stringify(report, null, 2));
    
    console.log(`📄 Reporte guardado en: ${reportPath}`);
    this.printSummaryReport(report);
    
    return report;
  }

  analyzeSelectorChanges() {
    const changes = {
      elementIdChanges: [],
      classNameChanges: [],
      structuralChanges: [],
      newElements: [],
      removedElements: []
    };

    if (this.runs.length < 2) {
      return changes;
    }

    // Comparar selectores entre ejecuciones
    for (let i = 1; i < this.runs.length; i++) {
      const current = this.runs[i];
      const previous = this.runs[i - 1];
      
      if (current.success && previous.success && current.selectorAnalysis && previous.selectorAnalysis) {
        // Comparar elementos de email
        const currentEmailInputs = current.selectorAnalysis.findings.emailInputs || [];
        const previousEmailInputs = previous.selectorAnalysis.findings.emailInputs || [];
        
        this.compareElementArrays(currentEmailInputs, previousEmailInputs, changes, `run${i-1}_to_run${i}`, 'emailInputs');
        
        // Comparar botones
        const currentButtons = current.selectorAnalysis.findings.buttons || [];
        const previousButtons = previous.selectorAnalysis.findings.buttons || [];
        
        this.compareElementArrays(currentButtons, previousButtons, changes, `run${i-1}_to_run${i}`, 'buttons');
      }
    }

    return changes;
  }

  compareElementArrays(current, previous, changes, runComparison, elementType) {
    // Detectar elementos que cambiaron de ID
    current.forEach(currEl => {
      const prevEl = previous.find(p => 
        p.xpath === currEl.xpath && p.cssSelector !== currEl.cssSelector
      );
      
      if (prevEl) {
        changes.elementIdChanges.push({
          runComparison,
          elementType,
          previous: prevEl,
          current: currEl,
          changeType: 'selector_changed'
        });
      }
    });

    // Detectar nuevos elementos
    current.forEach(currEl => {
      const exists = previous.some(p => p.xpath === currEl.xpath);
      if (!exists) {
        changes.newElements.push({
          runComparison,
          elementType,
          element: currEl
        });
      }
    });

    // Detectar elementos removidos
    previous.forEach(prevEl => {
      const exists = current.some(c => c.xpath === prevEl.xpath);
      if (!exists) {
        changes.removedElements.push({
          runComparison,
          elementType,
          element: prevEl
        });
      }
    });
  }

  analyzeConsistency() {
    const consistency = {
      selectorStability: 0,
      structuralStability: 0,
      loadTimeConsistency: 0,
      overallScore: 0
    };

    if (this.runs.length < 2) {
      return consistency;
    }

    // Calcular estabilidad de selectores
    const successfulRuns = this.runs.filter(r => r.success);
    if (successfulRuns.length >= 2) {
      let stableSelectors = 0;
      let totalSelectors = 0;
      
      // Comparar elementos clave entre todas las ejecuciones
      const firstRun = successfulRuns[0];
      if (firstRun.selectorAnalysis) {
        const firstEmailInputs = firstRun.selectorAnalysis.findings.emailInputs || [];
        
        firstEmailInputs.forEach(firstEl => {
          totalSelectors++;
          const stableAcrossRuns = successfulRuns.every(run => {
            if (!run.selectorAnalysis) return false;
            const emailInputs = run.selectorAnalysis.findings.emailInputs || [];
            return emailInputs.some(el => el.cssSelector === firstEl.cssSelector);
          });
          
          if (stableAcrossRuns) stableSelectors++;
        });
      }
      
      consistency.selectorStability = totalSelectors > 0 ? (stableSelectors / totalSelectors) * 100 : 0;
    }

    // Calcular consistencia de tiempo de carga
    const durations = successfulRuns.map(r => r.duration).filter(d => d);
    if (durations.length >= 2) {
      const avgDuration = durations.reduce((sum, d) => sum + d, 0) / durations.length;
      const variance = durations.reduce((sum, d) => sum + Math.pow(d - avgDuration, 2), 0) / durations.length;
      const stdDev = Math.sqrt(variance);
      
      // Menor variabilidad = mayor consistencia
      consistency.loadTimeConsistency = Math.max(0, 100 - (stdDev / avgDuration) * 100);
    }

    consistency.overallScore = (consistency.selectorStability + consistency.loadTimeConsistency) / 2;
    
    return consistency;
  }

  detectSuspiciousPatterns() {
    const patterns = {
      frequentIdChanges: false,
      randomizedClassNames: false,
      dynamicElementCounts: false,
      irregularLoadTimes: false,
      patterns: []
    };

    // Detectar cambios frecuentes de ID
    const idChanges = this.runs.filter(run => 
      run.selectorAnalysis && 
      run.selectorAnalysis.findings.dynamicElements && 
      run.selectorAnalysis.findings.dynamicElements.length > 0
    );

    if (idChanges.length > this.runs.length * 0.5) {
      patterns.frequentIdChanges = true;
      patterns.patterns.push('Detectados elementos con IDs/clases dinámicas en más del 50% de las ejecuciones');
    }

    // Detectar nombres de clase aleatorizados
    const hasRandomizedClasses = this.runs.some(run => {
      if (!run.selectorAnalysis) return false;
      const elements = [
        ...(run.selectorAnalysis.findings.emailInputs || []),
        ...(run.selectorAnalysis.findings.buttons || [])
      ];
      
      return elements.some(el => 
        el.className && (
          el.className.includes('css-') || 
          el.className.includes('styled-') ||
          /[a-f0-9]{6,}/.test(el.className) // Hash-like patterns
        )
      );
    });

    if (hasRandomizedClasses) {
      patterns.randomizedClassNames = true;
      patterns.patterns.push('Detectados nombres de clase que parecen generados dinámicamente (css-, styled-, hashes)');
    }

    return patterns;
  }

  generateRecommendations() {
    const recommendations = [];
    
    const consistency = this.analyzeConsistency();
    
    if (consistency.selectorStability < 80) {
      recommendations.push({
        priority: 'HIGH',
        category: 'Selector Stability',
        issue: 'Baja estabilidad de selectores detectada',
        recommendation: 'Usar selectores basados en texto, atributos data-* o roles ARIA en lugar de IDs/clases CSS',
        technical: 'Implementar locators como page.getByRole(), page.getByText(), page.getByTestId()'
      });
    }

    if (consistency.loadTimeConsistency < 70) {
      recommendations.push({
        priority: 'MEDIUM',
        category: 'Performance',
        issue: 'Tiempos de carga inconsistentes',
        recommendation: 'Implementar esperas dinámicas más robustas',
        technical: 'Usar page.waitForLoadState("networkidle") y verificar elementos específicos'
      });
    }

    const suspiciousPatterns = this.detectSuspiciousPatterns();
    
    if (suspiciousPatterns.randomizedClassNames) {
      recommendations.push({
        priority: 'HIGH',
        category: 'Anti-Automation',
        issue: 'Posible sistema anti-automatización detectado',
        recommendation: 'Evitar selectores CSS, usar selectores semánticos',
        technical: 'Implementar estrategia de fallback con múltiples selectores y detección de cambios en runtime'
      });
    }

    return recommendations;
  }

  printSummaryReport(report) {
    console.log('\n📊 ===== REPORTE DE ANÁLISIS =====');
    console.log(`\n✅ Ejecuciones exitosas: ${report.summary.successfulRuns}/${report.summary.totalRuns}`);
    console.log(`⏱️  Duración promedio: ${Math.round(report.summary.averageDuration)}ms`);
    console.log(`🎯 Estabilidad de selectores: ${Math.round(report.consistencyAnalysis.selectorStability)}%`);
    console.log(`⚡ Consistencia de carga: ${Math.round(report.consistencyAnalysis.loadTimeConsistency)}%`);
    console.log(`📈 Puntuación general: ${Math.round(report.consistencyAnalysis.overallScore)}%`);
    
    if (report.selectorChanges.elementIdChanges.length > 0) {
      console.log(`\n⚠️  Cambios detectados en selectores: ${report.selectorChanges.elementIdChanges.length}`);
    }
    
    if (report.suspiciousPatterns.patterns.length > 0) {
      console.log('\n🚨 Patrones sospechosos detectados:');
      report.suspiciousPatterns.patterns.forEach(pattern => {
        console.log(`   • ${pattern}`);
      });
    }
    
    if (report.recommendations.length > 0) {
      console.log('\n💡 Recomendaciones:');
      report.recommendations.forEach(rec => {
        console.log(`   [${rec.priority}] ${rec.issue}`);
        console.log(`        💭 ${rec.recommendation}`);
      });
    }
    
    console.log('\n=================================');
  }
}

// Función para ejecutar el análisis múltiple
async function runMultipleMonitoringSessions(config = {}) {
  const multiMonitor = new MultiRunMonitor(config);
  await multiMonitor.executeMultipleRuns();
}

// Configuraciones predefinidas
const PRESET_CONFIGS = {
  quick: {
    runs: 3,
    interval: 15000,
    randomizeInterval: true,
    headless: true
  },
  standard: {
    runs: 5,
    interval: 30000,
    randomizeInterval: true,
    headless: true
  },
  thorough: {
    runs: 10,
    interval: 60000,
    randomizeInterval: true,
    headless: true
  },
  stress: {
    runs: 20,
    interval: 5000,
    randomizeInterval: false,
    headless: true
  }
};

// Ejecutar si es llamado directamente
if (import.meta.url === `file://${process.argv[1]}`) {
  const preset = process.argv[2] || 'standard';
  const config = PRESET_CONFIGS[preset] || PRESET_CONFIGS.standard;
  
  console.log(`🎯 Ejecutando preset: ${preset}`);
  runMultipleMonitoringSessions(config).catch(console.error);
}

export { MultiRunMonitor, runMultipleMonitoringSessions, PRESET_CONFIGS };