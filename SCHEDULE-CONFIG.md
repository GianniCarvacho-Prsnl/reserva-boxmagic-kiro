# 📅 Configuración de Horarios - CrossFit Reservation Bot

## 🎯 Estrategia de Reservas

**Regla de 25 horas**: Las reservas se abren exactamente 25 horas antes de la clase.
- Clase del **Lunes 18:00** → Reserva se abre **Domingo 18:00**
- Clase del **Martes 19:00** → Reserva se abre **Lunes 19:00**

## 📋 Horarios Configurados

### 🗓️ Lunes a Viernes (Días de semana)
| Día | Clase | Hora Clase | Hora Reserva | Estado |
|-----|-------|------------|--------------|--------|
| **Lunes** | 18:00 CrossFit | 18:00 | Domingo 18:00 | ✅ Activo |
| **Martes** | 19:00 CrossFit | 19:00 | Lunes 19:00 | ✅ Activo |
| **Miércoles** | 18:00 CrossFit | 18:00 | Martes 18:00 | ✅ Activo |
| **Jueves** | 19:00 CrossFit | 19:00 | Miércoles 19:00 | ✅ Activo |
| **Viernes** | 18:00 CrossFit | 18:00 | Jueves 18:00 | ✅ Activo |

### 🏋️ Clases Especiales Viernes
| Clase | Hora | Reserva | Estado |
|-------|------|---------|--------|
| **Gymnastics** | 20:00 | Jueves 19:50 | ❌ Deshabilitado |

### 🌅 Fin de Semana (Sábado)
| Clase | Hora | Reserva | Estado |
|-------|------|---------|--------|
| **CrossFit** | 09:00 | Viernes 09:00 | ✅ Activo |
| **CrossFit** | 10:00 | Viernes 10:00 | ❌ Alternativo |
| **Weightlifting** | 11:00 | Viernes 11:00 | ❌ Deshabilitado |

## ⚙️ Configuración por Defecto

```json
{
  "dayToSelect": "tomorrow",     // Siempre reservar para mañana (regla 25h)
  "bufferSeconds": 30,           // 30 segundos de preparación
  "enabled": true                // Activo por defecto
}
```

## 🎮 Cómo Usar

### 1. **Activar/Desactivar Clases**
```json
"enabled": true   // ✅ Activo - Bot reservará automáticamente
"enabled": false  // ❌ Inactivo - Bot ignorará esta clase
```

### 2. **Cambiar Horarios**
```json
"reservationHour": "18:00",        // Hora de reserva (se repite cada semana)
"reservationDay": "thursday",      // Día de la semana para reservar
"cronExpression": "0 18 * * 4"     // Cron: min hora día mes día_semana (4=jueves)
```

### 3. **Testing Inmediato**
```json
{
  "id": "test-immediate",
  "dayToSelect": "today",        // Para testing usar "today"
  "enabled": false               // Mantener deshabilitado en producción
}
```

## 📊 Cron Expressions Explicadas

| Expresión | Significado | Día |
|-----------|-------------|-----|
| `0 18 * * 0` | Domingo 18:00 | Para clase Lunes |
| `0 19 * * 1` | Lunes 19:00 | Para clase Martes |
| `0 18 * * 2` | Martes 18:00 | Para clase Miércoles |
| `0 19 * * 3` | Miércoles 19:00 | Para clase Jueves |
| `0 18 * * 4` | Jueves 18:00 | Para clase Viernes |
| `0 9 * * 5` | Viernes 09:00 | Para clase Sábado |

## 🚀 Clases Más Populares (Recomendadas)

1. **18:00 CrossFit** (Lunes, Miércoles, Viernes) - Horario post-trabajo
2. **19:00 CrossFit** (Martes, Jueves) - Horario nocturno
3. **09:00 CrossFit** (Sábado) - Horario matutino fin de semana

## ⚠️ Notas Importantes

- **Timezone**: Todas las horas están en `America/Santiago` (Chile)
- **Regla 25h**: NUNCA cambiar `dayToSelect` a `"today"` en producción
- **Buffer**: 30 segundos es suficiente para login y navegación
- **Retry**: El bot reintenta automáticamente 1 vez si falla

## 🔧 Para Desarrolladores

### Agregar Nueva Clase
```json
{
  "id": "nueva-clase-id",
  "dayToSelect": "tomorrow",
  "className": "Nombre Exacto Como Aparece En Web",
  "reservationHour": "18:00",
  "reservationDay": "monday",
  "bufferSeconds": 30,
  "enabled": true,
  "cronExpression": "0 18 * * 1",
  "description": "Descripción clara"
}
```

### Testing
```bash
# Test inmediato (sin esperar horarios)
npx tsx test-immediate.ts

# Producción (espera horarios configurados)
npm run dev
```