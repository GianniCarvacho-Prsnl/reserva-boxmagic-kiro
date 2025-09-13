# Guía de Monitoreo de Selectores Web

Esta guía explica cómo usar las herramientas de monitoreo de selectores para detectar posibles sistemas anti-automatización en BoxMagic.

## 📋 Herramientas Incluidas

### 1. `selector-monitor.js` - Monitoreo Manual Interactivo
Permite navegación paso a paso con captura de evidencias en cada etapa.

### 2. `multi-run-monitor.js` - Ejecuciones Múltiples Automatizadas
Ejecuta múltiples sesiones automáticamente para detectar patrones y cambios.

### 3. `selector-analyzer.js` - Análisis Avanzado y Reportes
Analiza todas las evidencias recopiladas y genera reportes detallados.

## 🚀 Cómo Usar

### Opción 1: Monitoreo Manual (Recomendado para primera vez)

```bash
# Ejecutar monitoreo interactivo
node selector-monitor.js
```

**Qué hace:**
- Abre BoxMagic en el navegador (no headless)
- Te guía paso a paso por el flujo de login y navegación
- Captura screenshots y DOM en cada paso
- Tú controlas cuándo avanzar al siguiente paso

**Pasos que documenta:**
1. Carga inicial de BoxMagic
2. Análisis de página de login
3. Llenado de credenciales (manual)
4. Clic en botón login (manual)
5. Página de horarios cargada
6. Selección de día (manual)
7. Examen de lista de clases
8. Clic en clase para abrir modal (manual)
9. Examen del modal de reserva
10. Cierre del modal (manual)

### Opción 2: Múltiples Ejecuciones Automáticas

```bash
# Ejecución rápida (3 runs, 15s intervalo)
node multi-run-monitor.js quick

# Ejecución estándar (5 runs, 30s intervalo)
node multi-run-monitor.js standard

# Ejecución exhaustiva (10 runs, 60s intervalo)
node multi-run-monitor.js thorough

# Prueba de estrés (20 runs, 5s intervalo)
node multi-run-monitor.js stress
```

**Qué hace:**
- Ejecuta múltiples sesiones automáticamente
- Captura selectores y estructura DOM en cada ejecución
- Detecta cambios entre ejecuciones
- Genera análisis de estabilidad automáticamente

### Opción 3: Análisis de Evidencias

```bash
# Analizar todas las evidencias recopiladas
node selector-analyzer.js
```

**Qué hace:**
- Carga todas las ejecuciones previas
- Analiza patrones en IDs y clases CSS
- Detecta señales de sistemas anti-automatización
- Genera reporte completo con recomendaciones

## 📁 Estructura de Evidencias

Después de ejecutar los scripts, encontrarás:

```
evidence/
├── monitoring-log.json              # Log histórico de todas las ejecuciones
├── multi-run-progress.json          # Datos de ejecuciones múltiples
├── multi-run-analysis.json          # Análisis automático de múltiples ejecuciones
├── comprehensive-analysis-report.json # Reporte completo detallado
├── analysis-report.txt              # Reporte legible para humanos
└── [timestamp]/                     # Directorio por cada ejecución individual
    ├── run-data.json                # Datos completos de la ejecución
    ├── 01_initial_load-screenshot.png
    ├── 01_initial_load-dom.html
    ├── 02_login_page_analysis-screenshot.png
    └── ...                          # Más evidencias por paso
```

## 🔍 Qué Buscar en los Resultados

### Señales de Anti-Automatización

1. **IDs/Clases Dinámicas:**
   - `css-abc123` (CSS-in-JS)
   - `styled-xyz789` (Styled Components)
   - Hashes hexadecimales como IDs

2. **Cambios Estructurales:**
   - Elementos que aparecen/desaparecen entre ejecuciones
   - Cambios en la estructura del DOM

3. **Patrones Temporales:**
   - Cambios que ocurren en horarios específicos
   - Comportamientos diferentes según el día/hora

4. **Elementos Inestables:**
   - Selectores que cambian frecuentemente
   - Alta variabilidad en atributos

### Métricas de Estabilidad

- **>80%**: Excelente estabilidad, no hay problema
- **60-80%**: Estabilidad moderada, optimización recomendada
- **<60%**: Baja estabilidad, revisión crítica necesaria

## 📊 Interpretando los Reportes

### Reporte de Análisis (analysis-report.txt)

```
🚨 SEÑALES DE ANTI-AUTOMATIZACIÓN
================================
1. DYNAMIC_SELECTORS (HIGH)
   Detectados selectores CSS generados dinámicamente
   Recomendación: Usar selectores basados en contenido de texto

💡 RECOMENDACIONES PRINCIPALES
=============================
1. [HIGH] Selector Strategy
   Problema: IDs con patrones de hash detectados
   Solución: Implementar selectores basados en atributos semánticos
```

### Puntuaciones de Estabilidad

- **Estabilidad general**: Promedio de todos los elementos
- **Por tipo de elemento**: email_input, password_input, login_button, etc.
- **Variaciones detectadas**: Número de selectores únicos vs ocurrencias totales

## 🛠️ Recomendaciones de Implementación

### Si se detectan sistemas anti-automatización:

1. **Usar selectores semánticos:**
```javascript
// ❌ Evitar
await page.locator('#css-abc123').click();

// ✅ Preferir
await page.getByRole('textbox', { name: 'Correo' }).fill(email);
await page.getByText('Ingresar').click();
```

2. **Implementar fallbacks:**
```javascript
const emailInput = page.locator('input[placeholder*="Correo"]')
  .or(page.getByRole('textbox', { name: 'Correo' }))
  .or(page.locator('input[name="email"]'));
```

3. **Usar esperas dinámicas:**
```javascript
await page.waitForLoadState('networkidle');
await page.getByText(className).waitFor();
```

## 🔄 Flujo de Trabajo Recomendado

1. **Primera ejecución:** Usar `selector-monitor.js` para entender el flujo manualmente
2. **Recopilación de datos:** Ejecutar `multi-run-monitor.js standard` varias veces a diferentes horas
3. **Análisis:** Ejecutar `selector-analyzer.js` para obtener el reporte completo
4. **Implementación:** Aplicar las recomendaciones en el código de automatización
5. **Validación:** Repetir el proceso para verificar mejoras

## ⚙️ Configuración Avanzada

### Personalizar Multi-Run Monitor

```javascript
// Configuración personalizada
const customConfig = {
  runs: 7,
  interval: 45000,  // 45 segundos
  randomizeInterval: true,
  headless: false,  // Ver ejecución
  saveDetailedLogs: true
};

const multiMonitor = new MultiRunMonitor(customConfig);
await multiMonitor.executeMultipleRuns();
```

### Modificar Selectores Monitoreados

Editar `selector-monitor.js` en la función `captureEvidence()` para agregar selectores específicos:

```javascript
// Buscar elementos específicos de tu aplicación
const customElements = document.querySelectorAll('.mi-selector-especifico');
customElements.forEach((el, i) => {
  selectors[`custom_element_${i}`] = {
    id: el.id,
    className: el.className,
    customAttribute: el.getAttribute('data-custom'),
    selector: this.generateSelector(el)
  };
});
```

## 🆘 Solución de Problemas

### Error: "WebDriver detected"
- El sitio detecta automatización incluso en el script de monitoreo
- Solución: Agregar más flags anti-detección en la configuración del navegador

### No se detectan cambios
- Ejecutar más sesiones en diferentes momentos
- Verificar que las credenciales sean válidas
- Aumentar el tiempo entre ejecuciones

### Reportes vacíos
- Verificar que el directorio `evidence/` contenga datos
- Comprobar que las ejecuciones se completaron exitosamente
- Revisar permisos de escritura en el directorio

## 📝 Notas Importantes

- **Credenciales**: Los scripts NO almacenan credenciales, debes ingresarlas manualmente
- **Rate Limiting**: Espera tiempo suficiente entre ejecuciones para evitar bloqueos
- **Evidencias**: Los screenshots pueden contener información sensible, manejar con cuidado
- **Recursos**: Las ejecuciones múltiples consumen recursos, cerrar otras aplicaciones si es necesario

---

¿Necesitas ayuda adicional? Revisa los logs en `evidence/` o ejecuta los scripts con más detalle para diagnosticar problemas específicos.