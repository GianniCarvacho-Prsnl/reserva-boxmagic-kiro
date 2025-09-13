# Tests

Este directorio contiene tests manuales para el bot de reservas CrossFit.

## Tests Disponibles

### `manual/test-visual-flow.js`
**Test principal** que muestra visualmente el flujo completo:
- Login automático
- Selección del día (sábado → domingo)  
- Espera visual para inspección
- Verificación del cambio de día

**Uso:**
```bash
node tests/manual/test-visual-flow.js
```

Este test mantiene el navegador abierto para que puedas ver paso a paso:
1. ✅ Login
2. ✅ Cambio de día al calendario
3. ✅ Verificación visual del día seleccionado

## Otros Tests

Los demás archivos en `manual/` son tests experimentales usados durante el desarrollo. El único test importante para uso regular es `test-visual-flow.js`.