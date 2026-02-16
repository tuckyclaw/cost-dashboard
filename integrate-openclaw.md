# Integración con OpenClaw

Para que el Cost Dashboard funcione completamente, necesitás configurar OpenClaw para que exporte métricas de uso.

## 1. Configurar Logging Detallado

Editar `/root/.openclaw/openclaw.json` y agregar:

```json
"logging": {
  "level": "debug",
  "format": "json",
  "destination": "file",
  "file": {
    "path": "/root/.openclaw/logs/usage.jsonl",
    "maxSize": "10MB",
    "maxFiles": 5
  }
}
```

## 2. Script de Procesamiento de Logs

Crear `/root/.openclaw/scripts/process-usage-logs.js`:

```javascript
const fs = require('fs');
const path = require('path');
const { calculateCost, categorizeTask } = require('/root/.openclaw/workspace/cost-dashboard/collector');

// Procesar logs de OpenClaw y enviar a la API del dashboard
async function processLogs() {
  const logPath = '/root/.openclaw/logs/usage.jsonl';
  
  if (!fs.existsSync(logPath)) {
    console.log('No hay logs para procesar');
    return;
  }
  
  const logs = fs.readFileSync(logPath, 'utf8')
    .split('\n')
    .filter(line => line.trim())
    .map(line => JSON.parse(line));
  
  for (const log of logs) {
    if (log.model && log.usage) {
      // Enviar a la API del dashboard
      await fetch('http://localhost:3001/api/metrics', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          timestamp: log.timestamp,
          model: log.model,
          input_tokens: log.usage.input_tokens || 0,
          output_tokens: log.usage.output_tokens || 0,
          task_description: log.task || 'unknown',
          // ... otros campos
        })
      });
    }
  }
}

// Ejecutar cada 5 minutos
setInterval(processLogs, 5 * 60 * 1000);
processLogs();
```

## 3. Cron Job para Procesamiento

Agregar a crontab:

```bash
# Procesar logs cada 5 minutos
*/5 * * * * node /root/.openclaw/scripts/process-usage-logs.js
```

## 4. Integración Directa (Recomendada)

La mejor opción es modificar OpenClaw para que directamente envíe métricas al dashboard:

1. **Modificar el código de OpenClaw** para que después de cada llamada a modelo:
   - Capture tokens usados
   - Categorice la tarea
   - Envíe métricas a la API del dashboard

2. **Agregar middleware** en el gateway que intercepte todas las llamadas a modelos.

## 5. Métricas Adicionales a Capturar

- **Modelo usado** (ej: `claude-opus-4-5-20251101`)
- **Tokens de input/output**
- **Cache read/write** (si aplica)
- **Tiempo de respuesta**
- **Categoría de tarea** (basada en prompt/content)
- **Sesión/Usuario** (para multi-usuario)
- **Costo calculado**

## 6. Dashboard Features Adicionales

### Alertas de Costo
```javascript
// Configurar alertas cuando se superen umbrales
const alerts = {
  daily_limit: 10, // USD
  model_limit: {
    'claude-opus-4-5-20251101': 5, // USD
    'gemini-2.5-flash': 1 // USD
  },
  anomaly_detection: true
};
```

### Exportación de Reportes
- PDF mensual
- CSV para análisis
- Integración con Google Sheets
- Notificaciones por email/Telegram

### Optimización Automática
- Sugerencias para cambiar modelos
- Detección de tareas costosas
- Recomendaciones de optimización

## 7. Mantenimiento

### Actualizar Tarifas
Las tarifas están en `config/cost-rates.json`. Actualizarlas cuando cambien los precios de los proveedores.

### Limpieza de Datos
```sql
-- Mantener solo últimos 90 días
DELETE FROM metrics WHERE timestamp < DATE('now', '-90 days');
```

### Backup
```bash
# Backup diario de la base de datos
0 2 * * * cp /root/.openclaw/workspace/cost-dashboard/database/metrics.db /backup/cost-dashboard-$(date +%Y%m%d).db
```

## 8. Solución de Problemas

### No se ven datos
1. Verificar que el collector esté corriendo
2. Verificar permisos en directorio de sesiones
3. Verificar formato de logs de OpenClaw

### Costos incorrectos
1. Verificar tarifas en `cost-rates.json`
2. Verificar que se capturen todos los tokens
3. Verificar cálculos de cache read/write

### Dashboard lento
1. Agregar índices a la base de datos
2. Limpiar datos antiguos
3. Optimizar consultas