# ANÁLISIS COMPLETO: Sistema de Reservas CrossFit

## 🎯 TU PREGUNTA PRINCIPAL

**"¿Cómo funciona exactamente el sistema en Vercel? ¿Debo configurar cada ID en vercel.json Y TAMBIÉN en config.json?"**

**RESPUESTA DIRECTA: SÍ, debes configurar en AMBOS archivos, pero son configuraciones DIFERENTES que deben estar SINCRONIZADAS.**

---

## 📋 RESUMEN EJECUTIVO

Tu sistema funciona con **DOS archivos de configuración independientes** que deben mantenerse sincronizados manualmente:

1. **`config.json`** → Contiene los datos COMPLETOS de cada reserva (className, horarios, etc.)
2. **`vercel.json`** → Contiene los cron jobs que ACTIVAN cada reserva con el scheduleId

### El Problema Principal Identificado
❌ **FALTA SINCRONIZACIÓN**: Hay scheduleIds en `vercel.json` que no existen en `config.json`, y viceversa.

---

## 🏗️ ARQUITECTURA GENERAL

```mermaid
graph TB
    subgraph "CONFIGURACIÓN"
        CONFIG["`**config.json**
        📋 Schedules completos
        • id, className, reservationTime
        • cronExpression, enabled
        • dayToSelect, bufferSeconds`"]
        
        VERCEL_CONFIG["`**vercel.json**
        ⏰ Cron Jobs Activos
        • path: /api/reserve?scheduleId=X
        • schedule: cron expression
        • runtime y memory config`"]
    end
    
    subgraph "VERCEL PLATFORM"
        CRON["`⏰ **Vercel Cron**
        Ejecuta según schedule
        en vercel.json`"]
        
        API["`🔗 **/api/reserve.ts**
        Entry point principal
        Import desde dist/handlers/vercel.js`"]
        
        HANDLER["`⚙️ **Vercel Handler**
        • Busca scheduleId en config.json
        • Filtra por enabled=true
        • Crea ReservationBot`"]
    end
    
    subgraph "CORE SYSTEM"
        BOT["`🤖 **ReservationBot**
        Orquestador principal
        • Coordina todos los componentes
        • Maneja retry logic`"]
        
        CONFIG_MGR["`📝 **ConfigManager**
        • Carga config.json
        • Filtra schedules
        • Validación`"]
        
        WEB_ENGINE["`🌐 **WebAutomationEngine**
        • Playwright automation
        • BoxMagic selectors
        • Anti-detection`"]
        
        TIMING["`⏱️ **TimingController**
        • Precisión milisegundo
        • Timezone aware
        • Buffer timing`"]
    end
    
    subgraph "PROBLEMAS DETECTADOS" 
        PROB1["`❌ **Inconsistencias**
        • scheduleIds en vercel.json 
          NO existen en config.json
        • Horarios cron diferentes
        • enabled:false pero activo en cron`"]
    end
    
    %% Flujo principal
    CRON -->|scheduleId| API
    API --> HANDLER
    HANDLER --> CONFIG_MGR
    CONFIG_MGR --> CONFIG
    HANDLER --> BOT
    BOT --> WEB_ENGINE
    BOT --> TIMING
    
    %% Configuración
    VERCEL_CONFIG -.->|define crons| CRON
    CONFIG -.->|datos schedule| CONFIG_MGR
    
    %% Problemas
    VERCEL_CONFIG -.->|desincronizado| PROB1
    CONFIG -.->|desincronizado| PROB1
    
    %% Estilos
    classDef configClass fill:#e1f5fe,stroke:#01579b,stroke-width:2px
    classDef vercelClass fill:#fff3e0,stroke:#e65100,stroke-width:2px
    classDef coreClass fill:#f3e5f5,stroke:#4a148c,stroke-width:2px
    classDef problemClass fill:#ffebee,stroke:#c62828,stroke-width:2px
    
    class CONFIG,VERCEL_CONFIG configClass
    class CRON,API,HANDLER vercelClass
    class BOT,CONFIG_MGR,WEB_ENGINE,TIMING coreClass
    class PROB1 problemClass
```

---

## 🔄 FLUJO COMPLETO PASO A PASO

```mermaid
sequenceDiagram
    participant VC as Vercel Cron
    participant API as /api/reserve.ts
    participant VH as Vercel Handler
    participant CM as ConfigManager
    participant RB as ReservationBot
    participant WE as WebAutomationEngine
    participant TC as TimingController
    participant BM as BoxMagic Website
    
    Note over VC: Ejecuta según vercel.json<br/>schedule: "0 17 * * 0"
    
    VC->>API: GET /api/reserve?scheduleId=crossfit-lunes-18
    API->>VH: Import handler desde dist/
    
    VH->>CM: Buscar scheduleId en config.json
    CM-->>VH: Retorna schedule data o error
    
    alt Schedule encontrado y enabled=true
        VH->>RB: Crear ReservationBot con schedule
        RB->>TC: Calcular timing preciso
        TC-->>RB: Timing para ejecución
        
        Note over RB: FASE PREPARACIÓN (30s buffer)
        RB->>WE: Inicializar browser + login
        WE->>BM: Login con credenciales
        BM-->>WE: Autenticación exitosa
        WE->>BM: Navegar a página reservas
        WE->>BM: Buscar className en headings
        
        Note over RB: FASE CRÍTICA (precisión milisegundo)
        RB->>TC: Esperar hasta momento exacto
        TC-->>RB: Momento exacto alcanzado
        RB->>WE: Ejecutar reserva NOW
        WE->>BM: Click en botón reserva
        BM-->>WE: Respuesta reserva
        
        Note over RB: FASE VERIFICACIÓN
        WE->>BM: Verificar estado "Agendada"
        BM-->>WE: Confirmación estado
        WE-->>RB: Resultado verificación
        RB-->>VH: Success/Failure result
        VH-->>API: HTTP 200 + result JSON
        API-->>VC: Response completa
        
    else Schedule no encontrado o enabled=false
        CM-->>VH: Error: Schedule not found/disabled
        VH-->>API: HTTP 400 + error message
        API-->>VC: Error response
    end
    
    Note over VC,BM: ⚠️ PROBLEMA: Algunos scheduleIds en vercel.json<br/>NO existen en config.json
```

---

## ⚙️ CONFIGURACIÓN: DOS ARCHIVOS, DOS PROPÓSITOS

### 📋 config.json - Datos Completos de Reservas

```json
{
  "schedules": [
    {
      "id": "crossfit-lunes-18",                    // ← ID usado en vercel.json
      "dayToSelect": "tomorrow",                    // ← Usado por WebAutomationEngine
      "className": "18:00 CrossFit",               // ← Texto exacto a buscar en BoxMagic
      "reservationHour": "22:00",                  // ← Hora exacta de reserva
      "reservationDay": "sunday",                  // ← Día de la semana
      "bufferSeconds": 30,                         // ← Buffer de preparación
      "enabled": true,                             // ← Switch on/off
      "cronExpression": "0 18 * * 0",             // ← Para referencia
      "description": "CrossFit Lunes 18:00"
    }
  ]
}
```

**Propósito**: Contiene TODOS los datos necesarios para ejecutar la reserva.

### ⏰ vercel.json - Activación Automática

```json
{
  "crons": [
    {
      "path": "/api/reserve?scheduleId=crossfit-lunes-18",  // ← Debe coincidir con config.json
      "schedule": "0 17 * * 0"                             // ← Cuándo ejecutar
    }
  ]
}
```

**Propósito**: Define CUÁNDO Vercel debe ejecutar cada reserva.

---

## 🔍 ANÁLISIS DE TU CONFIGURACIÓN ACTUAL

### ✅ Lo que ESTÁ funcionando correctamente:

```mermaid
flowchart TD
    subgraph "CONFIG.JSON ✅"
        CFG1["`**crossfit-lunes-18**
        • enabled: true
        • className: '18:00 CrossFit'
        • cronExpression: '0 17 * * 0'`"]
        
        CFG2["`**crossfit-martes-19** 
        • enabled: true
        • className: '19:00 CrossFit'
        • cronExpression: '0 18 * * 1'`"]
    end
    
    subgraph "VERCEL.JSON ✅"
        VER1["`**crossfit-lunes-18**
        • schedule: '0 17 * * 0'
        • path: /api/reserve?scheduleId=...`"]
        
        VER2["`**crossfit-martes-19**
        • schedule: '0 18 * * 1' 
        • path: /api/reserve?scheduleId=...`"]
    end
    
    CFG1 -.->|coincide| VER1
    CFG2 -.->|coincide| VER2
    
    classDef okStyle fill:#e0f2f1,stroke:#00695c,stroke-width:2px
    class CFG1,CFG2,VER1,VER2 okStyle
```

### ⚠️ Problemas DETECTADOS:

```mermaid
flowchart TD
    subgraph "PROBLEMAS IDENTIFICADOS"
        PROB1["`❌ **metcon-viernes-18**
        En vercel.json PERO
        podría no estar en config.json actual`"]
        
        PROB2["`❌ **Schedules disabled**
        En config.json con enabled: false
        PERO activos en vercel.json`"]
        
        PROB3["`❌ **Horarios diferentes**
        cronExpression en config.json
        ≠ schedule en vercel.json`"]
    end
    
    classDef problemStyle fill:#ffebee,stroke:#c62828,stroke-width:2px
    class PROB1,PROB2,PROB3 problemStyle
```

---

## 🛠️ CÓMO CONFIGURAR CORRECTAMENTE

### Paso 1: Agregar una nueva reserva

**1.1 En config.json:**
```json
{
  "id": "crossfit-miercoles-19",           // ← Crear ID único
  "dayToSelect": "tomorrow",
  "className": "19:00 CrossFit",           // ← Texto EXACTO en BoxMagic
  "reservationHour": "19:00",              // ← Hora exacta
  "reservationDay": "tuesday",             // ← Día anterior a la clase
  "bufferSeconds": 30,
  "enabled": true,                         // ← IMPORTANTE: true para activar
  "cronExpression": "0 19 * * 2",         // ← Para referencia
  "description": "CrossFit Miércoles 19:00"
}
```

**1.2 En vercel.json:**
```json
{
  "path": "/api/reserve?scheduleId=crossfit-miercoles-19",  // ← MISMO ID
  "schedule": "0 19 * * 2"                                 // ← MISMO horario cron
}
```

### Paso 2: Verificar sincronización

```bash
# Verificar que la configuración es válida
curl "https://tu-app.vercel.app/api/reserve?validate=true"

# Probar un schedule específico
curl "https://tu-app.vercel.app/api/reserve?scheduleId=crossfit-miercoles-19"
```

---

## ⏱️ TIMING DE EJECUCIÓN

```mermaid
gantt
    title Flujo Temporal de Reserva CrossFit (25-hour rule)
    dateFormat HH:mm:ss
    axisFormat %H:%M:%S
    
    section Preparación (30s buffer)
    Login y autenticación    :prep1, 16:59:30, 16:59:40
    Navegación a reservas    :prep2, after prep1, 16:59:45
    Búsqueda de className    :prep3, after prep2, 16:59:50
    Posicionamiento final    :prep4, after prep3, 16:59:58
    
    section Ejecución Crítica (1ms precision)
    Espera momento exacto    :crit, 16:59:58, 17:00:00
    Click reserva            :active, 17:00:00, 17:00:00
    
    section Verificación
    Confirmar "Agendada"     :verify1, 17:00:00, 17:00:02
    Logging resultado        :verify2, after verify1, 17:00:03
    Cleanup y cierre         :verify3, after verify2, 17:00:05
```

---

## 🚨 CHECKLIST DE CONFIGURACIÓN

### ✅ Antes de deployar a Vercel:

- [ ] **Todos los scheduleIds en vercel.json existen en config.json**
- [ ] **Todos los schedules tienen enabled: true si están en vercel.json**
- [ ] **Los horarios cron coinciden entre ambos archivos**
- [ ] **Las classNames coinciden EXACTAMENTE con BoxMagic**
- [ ] **Las variables de entorno están configuradas en Vercel**
- [ ] **La build funciona correctamente: `npm run build`**

### 🔧 Variables de entorno requeridas en Vercel:

```bash
BOXMAGIC_EMAIL=tu-email@example.com
BOXMAGIC_PASSWORD=tu-password
WEBHOOK_URL=https://tu-webhook-endpoint
TIMEZONE=America/Santiago
BROWSER_HEADLESS=true
NOTIFICATIONS_ENABLED=true
```

---

## 🎯 RESPUESTA A TUS PREGUNTAS ESPECÍFICAS

### ❓ "¿Cómo funcionará en Vercel?"

1. **Vercel ejecuta cron jobs** según `vercel.json`
2. **Cada cron llama** a `/api/reserve?scheduleId=X`
3. **El handler busca** el scheduleId en `config.json`
4. **Si existe y enabled=true**, ejecuta la reserva
5. **Si no existe o enabled=false**, devuelve error

### ❓ "¿Debo configurar cada ID en vercel.json Y TAMBIÉN en config.json?"

**SÍ, pero con propósitos diferentes:**

- **config.json**: Datos completos del schedule (className, timing, etc.)
- **vercel.json**: Cuándo activar ese schedule específico

### ❓ "¿Por qué hay IDs hardcodeados en vercel.json?"

Porque **Vercel cron jobs son estáticos**. No pueden ser dinámicos. Cada cron debe especificar exactamente qué endpoint llamar.

---

## 🛡️ RECOMENDACIONES DE MEJORA

### 1. Script de Validación
Crear un script que verifique sincronización:

```bash
npm run validate-config  # Propuesta para implementar
```

### 2. Generador Automático
Script que genere `vercel.json` desde `config.json`:

```bash
npm run generate-vercel  # Propuesta para implementar  
```

### 3. Webhook de Monitoreo
Configurar notificaciones para detectar inconsistencias.

---

## 📝 CONCLUSIÓN

Tu sistema está **funcionalmente correcto** pero requiere **sincronización manual** entre dos archivos de configuración. En modo desarrollo funciona perfecto porque usa directamente `config.json`, pero en Vercel necesitas mantener ambos archivos alineados.

**La clave es entender que son DOS SISTEMAS:**
1. **Vercel cron** (cuándo ejecutar)
2. **Config schedules** (qué ejecutar)

Ambos deben apuntar al mismo scheduleId para que funcione correctamente.