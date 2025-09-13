/**
 * Herramienta avanzada de análisis y comparación de selectores
 * Analiza patrones, detecta sistemas anti-automatización y genera reportes detallados
 */

import { readFileSync, writeFileSync, existsSync, readdirSync } from 'fs';
import { join } from 'path';

class SelectorAnalyzer {
  constructor() {
    this.evidenceDir = './evidence';
    this.runs = [];
    this.analysis = {
      patterns: {},
      anomalies: [],
      stability: {},
      recommendations: []
    };
  }

  async loadAllRuns() {
    console.log('📂 Cargando datos de todas las ejecuciones...');
    
    if (!existsSync(this.evidenceDir)) {
      throw new Error('Directorio de evidencias no encontrado');
    }

    // Cargar log histórico
    const logPath = join(this.evidenceDir, 'monitoring-log.json');
    if (existsSync(logPath)) {
      const historicalLog = JSON.parse(readFileSync(logPath, 'utf8'));
      
      for (const runSummary of historicalLog) {
        const runDataPath = join(runSummary.evidenceDir, 'run-data.json');
        if (existsSync(runDataPath)) {
          const runData = JSON.parse(readFileSync(runDataPath, 'utf8'));
          this.runs.push(runData);
        }
      }
    }

    // Cargar datos de multi-run si existen
    const multiRunPath = join(this.evidenceDir, 'multi-run-progress.json');
    if (existsSync(multiRunPath)) {
      const multiRunData = JSON.parse(readFileSync(multiRunPath, 'utf8'));
      this.runs.push(...multiRunData.runs.filter(run => run.success && run.selectorAnalysis));
    }

    console.log(`✅ Cargadas ${this.runs.length} ejecuciones para análisis`);
    return this.runs;
  }

  analyzePatterns() {
    console.log('🔍 Analizando patrones en los selectores...');
    
    const patterns = {
      idPatterns: {},
      classPatterns: {},
      structuralChanges: [],
      temporalPatterns: [],
      suspiciousElements: []
    };

    // Analizar patrones de ID
    this.runs.forEach((run, index) => {
      if (!run.steps) return;
      
      run.steps.forEach(step => {
        Object.entries(step.selectors || {}).forEach(([elementType, selector]) => {
          if (selector.id) {
            const pattern = this.extractPattern(selector.id);
            if (!patterns.idPatterns[pattern.type]) {
              patterns.idPatterns[pattern.type] = [];
            }
            patterns.idPatterns[pattern.type].push({
              runIndex: index,
              runId: run.runId,
              elementType,
              id: selector.id,
              pattern: pattern.pattern,
              timestamp: step.timestamp
            });
          }
        });
      });
    });

    // Analizar patrones de clase CSS
    this.runs.forEach((run, index) => {
      if (!run.steps) return;
      
      run.steps.forEach(step => {
        Object.entries(step.selectors || {}).forEach(([elementType, selector]) => {
          if (selector.className) {
            const classes = selector.className.split(' ');
            classes.forEach(cls => {
              const pattern = this.extractPattern(cls);
              if (!patterns.classPatterns[pattern.type]) {
                patterns.classPatterns[pattern.type] = [];
              }
              patterns.classPatterns[pattern.type].push({
                runIndex: index,
                runId: run.runId,
                elementType,
                className: cls,
                pattern: pattern.pattern,
                timestamp: step.timestamp
              });
            });
          }
        });
      });
    });

    // Detectar cambios estructurales
    patterns.structuralChanges = this.detectStructuralChanges();
    
    // Detectar patrones temporales
    patterns.temporalPatterns = this.detectTemporalPatterns();
    
    // Identificar elementos sospechosos
    patterns.suspiciousElements = this.identifySuspiciousElements();

    this.analysis.patterns = patterns;
    return patterns;
  }

  extractPattern(text) {
    if (!text) return { type: 'empty', pattern: '' };
    
    // Patrones comunes
    if (/^[a-f0-9]{6,}$/.test(text)) {
      return { type: 'hash', pattern: 'hexadecimal_hash' };
    }
    
    if (/^css-[a-z0-9]+$/.test(text)) {
      return { type: 'css-in-js', pattern: 'css-in-js_generated' };
    }
    
    if (/^styled-[a-z0-9]+$/.test(text)) {
      return { type: 'styled-components', pattern: 'styled-components_generated' };
    }
    
    if (/^[a-z]+-[0-9]+$/.test(text)) {
      return { type: 'incremental', pattern: 'prefix_with_number' };
    }
    
    if (/^[A-Z][a-z]+[0-9]+$/.test(text)) {
      return { type: 'camelcase-numeric', pattern: 'camelCase_with_number' };
    }
    
    if (/^[a-z]+_[a-z]+_[0-9]+$/.test(text)) {
      return { type: 'snake-case-numeric', pattern: 'snake_case_with_number' };
    }
    
    if (text.includes('react')) {
      return { type: 'react-generated', pattern: 'react_component' };
    }
    
    return { type: 'static', pattern: 'static_name' };
  }

  detectStructuralChanges() {
    const changes = [];
    
    for (let i = 1; i < this.runs.length; i++) {
      const current = this.runs[i];
      const previous = this.runs[i - 1];
      
      if (!current.steps || !previous.steps) continue;
      
      const currentSelectors = this.flattenSelectors(current.steps);
      const previousSelectors = this.flattenSelectors(previous.steps);
      
      // Detectar selectores que desaparecieron
      const disappeared = previousSelectors.filter(prev => 
        !currentSelectors.some(curr => 
          curr.elementType === prev.elementType && 
          curr.selector === prev.selector
        )
      );
      
      // Detectar selectores nuevos
      const appeared = currentSelectors.filter(curr => 
        !previousSelectors.some(prev => 
          prev.elementType === curr.elementType && 
          prev.selector === curr.selector
        )
      );
      
      if (disappeared.length > 0 || appeared.length > 0) {
        changes.push({
          betweenRuns: `${previous.runId} -> ${current.runId}`,
          disappeared: disappeared.length,
          appeared: appeared.length,
          details: { disappeared, appeared }
        });
      }
    }
    
    return changes;
  }

  detectTemporalPatterns() {
    const patterns = [];
    
    // Analizar si hay patrones en los cambios basados en tiempo
    const timeBasedChanges = {};
    
    this.runs.forEach(run => {
      const timestamp = new Date(run.timestamp);
      const hour = timestamp.getHours();
      const dayOfWeek = timestamp.getDay();
      
      const key = `${dayOfWeek}_${hour}`;
      if (!timeBasedChanges[key]) {
        timeBasedChanges[key] = [];
      }
      
      timeBasedChanges[key].push(run);
    });
    
    // Detectar si ciertos cambios ocurren en momentos específicos
    Object.entries(timeBasedChanges).forEach(([timeKey, runs]) => {
      if (runs.length >= 2) {
        const hasConsistentChanges = this.checkConsistentChanges(runs);
        if (hasConsistentChanges) {
          patterns.push({
            timePattern: timeKey,
            runs: runs.length,
            description: `Cambios consistentes detectados durante ${timeKey.replace('_', ' día de semana, hora ')}`
          });
        }
      }
    });
    
    return patterns;
  }

  identifySuspiciousElements() {
    const suspicious = [];
    
    // Elementos que cambian frecuentemente
    const elementFrequency = {};
    
    this.runs.forEach(run => {
      if (!run.steps) return;
      
      run.steps.forEach(step => {
        Object.entries(step.selectors || {}).forEach(([elementType, selector]) => {
          const key = `${elementType}_${selector.selector || selector.id || selector.className}`;
          if (!elementFrequency[key]) {
            elementFrequency[key] = { count: 0, variations: new Set(), runs: [] };
          }
          
          elementFrequency[key].count++;
          elementFrequency[key].variations.add(JSON.stringify(selector));
          elementFrequency[key].runs.push(run.runId);
        });
      });
    });
    
    // Identificar elementos con muchas variaciones
    Object.entries(elementFrequency).forEach(([key, data]) => {
      const variationRatio = data.variations.size / data.count;
      if (variationRatio > 0.5 && data.variations.size > 2) {
        suspicious.push({
          element: key,
          suspiciousReason: 'high_variation_ratio',
          variations: data.variations.size,
          occurrences: data.count,
          ratio: variationRatio,
          affectedRuns: data.runs
        });
      }
    });
    
    return suspicious;
  }

  analyzeStability() {
    console.log('📊 Analizando estabilidad de selectores...');
    
    const stability = {
      overall: 0,
      byElementType: {},
      byPatternType: {},
      recommendations: []
    };
    
    // Calcular estabilidad por tipo de elemento
    const elementTypes = ['email_input', 'password_input', 'login_button', 'class_heading'];
    
    elementTypes.forEach(elementType => {
      const elements = [];
      
      this.runs.forEach(run => {
        if (!run.steps) return;
        
        run.steps.forEach(step => {
          Object.entries(step.selectors || {}).forEach(([key, selector]) => {
            if (key.includes(elementType.replace('_', ''))) {
              elements.push({
                runId: run.runId,
                selector: selector.selector || selector.id || selector.className,
                timestamp: step.timestamp
              });
            }
          });
        });
      });
      
      if (elements.length > 1) {
        const uniqueSelectors = new Set(elements.map(e => e.selector));
        stability.byElementType[elementType] = {
          stability: ((elements.length - uniqueSelectors.size + 1) / elements.length) * 100,
          totalOccurrences: elements.length,
          uniqueSelectors: uniqueSelectors.size
        };
      }
    });
    
    // Calcular estabilidad general
    const stabilities = Object.values(stability.byElementType).map(s => s.stability);
    stability.overall = stabilities.length > 0 
      ? stabilities.reduce((sum, s) => sum + s, 0) / stabilities.length 
      : 0;
    
    this.analysis.stability = stability;
    return stability;
  }

  detectAntiAutomationSigns() {
    console.log('🕵️  Detectando señales de sistemas anti-automatización...');
    
    const signs = [];
    
    // 1. Cambios frecuentes en IDs/clases
    const dynamicPatterns = this.analysis.patterns.idPatterns['css-in-js'] || [];
    const styledPatterns = this.analysis.patterns.idPatterns['styled-components'] || [];
    
    if (dynamicPatterns.length > 0 || styledPatterns.length > 0) {
      signs.push({
        type: 'DYNAMIC_SELECTORS',
        severity: 'HIGH',
        description: 'Detectados selectores CSS generados dinámicamente',
        evidence: {
          cssInJs: dynamicPatterns.length,
          styledComponents: styledPatterns.length
        },
        recommendation: 'Usar selectores basados en contenido de texto o atributos data-testid'
      });
    }
    
    // 2. Cambios estructurales frecuentes
    if (this.analysis.patterns.structuralChanges.length > this.runs.length * 0.3) {
      signs.push({
        type: 'STRUCTURAL_INSTABILITY',
        severity: 'MEDIUM',
        description: 'Cambios estructurales frecuentes en la página',
        evidence: {
          changesDetected: this.analysis.patterns.structuralChanges.length,
          threshold: Math.round(this.runs.length * 0.3)
        },
        recommendation: 'Implementar selectores más robustos y tiempos de espera dinámicos'
      });
    }
    
    // 3. Elementos sospechosos
    const highVariationElements = this.analysis.patterns.suspiciousElements
      .filter(el => el.ratio > 0.7);
    
    if (highVariationElements.length > 0) {
      signs.push({
        type: 'HIGH_VARIATION_ELEMENTS',
        severity: 'HIGH',
        description: 'Elementos con alta variabilidad detectados',
        evidence: {
          elementsCount: highVariationElements.length,
          elements: highVariationElements.map(el => el.element)
        },
        recommendation: 'Evitar estos elementos variables y usar alternativas estables'
      });
    }
    
    // 4. Baja estabilidad general
    if (this.analysis.stability.overall < 70) {
      signs.push({
        type: 'LOW_STABILITY',
        severity: 'HIGH',
        description: 'Estabilidad general de selectores por debajo del umbral aceptable',
        evidence: {
          stability: Math.round(this.analysis.stability.overall),
          threshold: 70
        },
        recommendation: 'Revisar y rediseñar estrategia de selectores completamente'
      });
    }
    
    this.analysis.anomalies = signs;
    return signs;
  }

  generateAdvancedRecommendations() {
    console.log('💡 Generando recomendaciones avanzadas...');
    
    const recommendations = [];
    
    // Analizar patrones detectados
    const patterns = this.analysis.patterns;
    
    if (patterns.idPatterns['hash']?.length > 0) {
      recommendations.push({
        category: 'Selector Strategy',
        priority: 'HIGH',
        issue: 'IDs con patrones de hash detectados',
        solution: 'Implementar selectores basados en atributos semánticos',
        implementation: [
          'page.getByRole("textbox", { name: "Correo" })',
          'page.getByPlaceholder("Correo")',
          'page.getByTestId("email-input")'
        ],
        avoidPatterns: patterns.idPatterns['hash'].map(p => p.id).slice(0, 3)
      });
    }
    
    if (patterns.classPatterns['css-in-js']?.length > 0) {
      recommendations.push({
        category: 'CSS-in-JS Handling',
        priority: 'HIGH',
        issue: 'Clases CSS-in-JS generadas dinámicamente',
        solution: 'Usar selectores de contenido y estructura',
        implementation: [
          'page.locator("input").filter({ hasText: "Correo" })',
          'page.locator("button").filter({ hasText: "Ingresar" })',
          'page.locator("form").getByRole("textbox").first()'
        ],
        avoidPatterns: patterns.classPatterns['css-in-js'].map(p => p.className).slice(0, 3)
      });
    }
    
    // Recomendaciones basadas en estabilidad
    const lowStabilityElements = Object.entries(this.analysis.stability.byElementType)
      .filter(([_, data]) => data.stability < 70)
      .map(([elementType, _]) => elementType);
    
    if (lowStabilityElements.length > 0) {
      recommendations.push({
        category: 'Element Stability',
        priority: 'MEDIUM',
        issue: `Elementos con baja estabilidad: ${lowStabilityElements.join(', ')}`,
        solution: 'Implementar estrategia de fallback para elementos inestables',
        implementation: [
          'const locator = page.locator("input[placeholder*=\\"Correo\\"]").or(page.getByRole("textbox", { name: "Correo" }));',
          'await locator.waitFor();',
          'await locator.fill(email);'
        ]
      });
    }
    
    // Recomendaciones específicas para BoxMagic
    recommendations.push({
      category: 'BoxMagic Specific',
      priority: 'HIGH',
      issue: 'Optimizaciones específicas para BoxMagic detectadas',
      solution: 'Implementar selectores optimizados para BoxMagic',
      implementation: [
        '// Login específico para BoxMagic',
        'await page.getByRole("textbox", { name: "Correo" }).fill(email);',
        'await page.getByPlaceholder("Contraseña").fill(password);',
        'await page.locator("div").filter({ hasText: /^IngresarEres nuevo aquí\\?Regístrate$/ }).getByRole("button").click();',
        '',
        '// Selección de clase específica',
        'await page.getByText(className, { exact: true }).first().click();',
        'await page.locator("button:has-text(\\"Agendar\\")").click();'
      ]
    });
    
    this.analysis.recommendations = recommendations;
    return recommendations;
  }

  async generateComprehensiveReport() {
    console.log('📄 Generando reporte completo...');
    
    await this.loadAllRuns();
    this.analyzePatterns();
    this.analyzeStability();
    const antiAutomationSigns = this.detectAntiAutomationSigns();
    const recommendations = this.generateAdvancedRecommendations();
    
    const report = {
      metadata: {
        generatedAt: new Date().toISOString(),
        totalRuns: this.runs.length,
        analyzedTimeSpan: {
          from: this.runs[0]?.timestamp,
          to: this.runs[this.runs.length - 1]?.timestamp
        }
      },
      summary: {
        overallStability: Math.round(this.analysis.stability.overall),
        antiAutomationSigns: antiAutomationSigns.length,
        criticalIssues: antiAutomationSigns.filter(s => s.severity === 'HIGH').length,
        recommendationsCount: recommendations.length
      },
      analysis: this.analysis,
      antiAutomationSigns,
      recommendations,
      rawData: {
        runs: this.runs.length,
        patternsFound: Object.keys(this.analysis.patterns.idPatterns).length + 
                      Object.keys(this.analysis.patterns.classPatterns).length
      }
    };
    
    const reportPath = './evidence/comprehensive-analysis-report.json';
    writeFileSync(reportPath, JSON.stringify(report, null, 2));
    
    // Generar también reporte legible en texto
    const readableReportPath = './evidence/analysis-report.txt';
    this.generateReadableReport(report, readableReportPath);
    
    console.log(`📊 Reporte completo guardado en: ${reportPath}`);
    console.log(`📖 Reporte legible guardado en: ${readableReportPath}`);
    
    this.printExecutiveSummary(report);
    
    return report;
  }

  generateReadableReport(report, path) {
    let content = '';
    
    content += '===============================================\n';
    content += '    ANÁLISIS DE SELECTORES WEB - BOXMAGIC    \n';
    content += '===============================================\n\n';
    
    content += `Generado: ${report.metadata.generatedAt}\n`;
    content += `Ejecuciones analizadas: ${report.metadata.totalRuns}\n`;
    content += `Estabilidad general: ${report.summary.overallStability}%\n`;
    content += `Señales anti-automatización: ${report.summary.antiAutomationSigns}\n\n`;
    
    content += '🚨 SEÑALES DE ANTI-AUTOMATIZACIÓN\n';
    content += '================================\n\n';
    
    if (report.antiAutomationSigns.length === 0) {
      content += 'No se detectaron señales evidentes de sistemas anti-automatización.\n\n';
    } else {
      report.antiAutomationSigns.forEach((sign, index) => {
        content += `${index + 1}. ${sign.type} (${sign.severity})\n`;
        content += `   ${sign.description}\n`;
        content += `   Recomendación: ${sign.recommendation}\n\n`;
      });
    }
    
    content += '💡 RECOMENDACIONES PRINCIPALES\n';
    content += '=============================\n\n';
    
    report.recommendations.forEach((rec, index) => {
      content += `${index + 1}. [${rec.priority}] ${rec.category}\n`;
      content += `   Problema: ${rec.issue}\n`;
      content += `   Solución: ${rec.solution}\n`;
      if (rec.implementation) {
        content += `   Implementación:\n`;
        rec.implementation.forEach(impl => {
          content += `   ${impl}\n`;
        });
      }
      content += '\n';
    });
    
    content += '📊 ESTABILIDAD POR TIPO DE ELEMENTO\n';
    content += '==================================\n\n';
    
    Object.entries(report.analysis.stability.byElementType).forEach(([elementType, data]) => {
      content += `${elementType}: ${Math.round(data.stability)}% (${data.totalOccurrences} ocurrencias, ${data.uniqueSelectors} únicos)\n`;
    });
    
    content += '\n===============================================\n';
    content += 'Fin del reporte\n';
    content += '===============================================\n';
    
    writeFileSync(path, content);
  }

  printExecutiveSummary(report) {
    console.log('\n🎯 ===== RESUMEN EJECUTIVO =====');
    console.log(`📊 Estabilidad general: ${report.summary.overallStability}%`);
    
    if (report.summary.overallStability >= 80) {
      console.log('✅ Estado: BUENO - Los selectores son estables');
    } else if (report.summary.overallStability >= 60) {
      console.log('⚠️  Estado: REGULAR - Se recomienda optimización');
    } else {
      console.log('🚨 Estado: CRÍTICO - Requiere atención inmediata');
    }
    
    if (report.summary.criticalIssues > 0) {
      console.log(`🚨 ${report.summary.criticalIssues} problemas críticos detectados`);
    }
    
    console.log('\n🔧 Acciones recomendadas:');
    const highPriorityRecs = report.recommendations.filter(r => r.priority === 'HIGH');
    highPriorityRecs.slice(0, 3).forEach((rec, index) => {
      console.log(`   ${index + 1}. ${rec.issue}`);
    });
    
    console.log('\n===============================');
  }

  // Métodos auxiliares
  flattenSelectors(steps) {
    const flattened = [];
    
    steps.forEach(step => {
      Object.entries(step.selectors || {}).forEach(([elementType, selector]) => {
        flattened.push({
          elementType,
          selector: selector.selector || selector.id || selector.className,
          timestamp: step.timestamp
        });
      });
    });
    
    return flattened;
  }

  checkConsistentChanges(runs) {
    // Lógica simple para detectar cambios consistentes
    return runs.length >= 2;
  }
}

// Función principal
async function runSelectorAnalysis() {
  const analyzer = new SelectorAnalyzer();
  
  try {
    const report = await analyzer.generateComprehensiveReport();
    return report;
  } catch (error) {
    console.error('❌ Error durante el análisis:', error);
    throw error;
  }
}

// Ejecutar si es llamado directamente
if (import.meta.url === `file://${process.argv[1]}`) {
  runSelectorAnalysis().catch(console.error);
}

export { SelectorAnalyzer, runSelectorAnalysis };