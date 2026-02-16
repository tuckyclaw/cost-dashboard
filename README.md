# OpenClaw Cost Dashboard

Dashboard para monitorear gastos, utilización de modelos y análisis de tareas en OpenClaw.

## 🚀 Características

✅ **Métricas en tiempo real:**
- Costos por modelo/proveedor
- Tokens consumidos (input/output)
- Tareas categorizadas automáticamente
- Tendencias temporales

✅ **Filtros avanzados:**
- Por fecha (hora, día, semana, mes)
- Por modelo/proveedor
- Por tipo de tarea (routine, analysis, development, strategy, content, search, audio)
- Por costo (rango)

✅ **Visualizaciones:**
- Gráficos de barras (costos por modelo)
- Líneas de tiempo (tendencias)
- Tablas detalladas con paginación
- Resumen diario/semanal/mensual

✅ **API REST completa:**
- `/api/health` - Estado del sistema
- `/api/summary` - Resumen por período
- `/api/metrics` - Lista de métricas
- `/api/models` - Estadísticas por modelo
- `/api/tasks` - Análisis por categoría

## 🏗️ Arquitectura

```
cost-dashboard/
├── collector/           # Captura datos de sesiones OpenClaw
│   ├── openclaw-collector.js  # Collector optimizado para OpenClaw
│   └── simple-collector.js    # Collector simple
├── api/                # API REST para consultas
│   ├── server.js      # API principal
│   └── simple-server.js # API simple
├── frontend/          # Dashboard web (React)
├── database/          # Almacena métricas (JSON)
├── logs/              # Logs del sistema
├── config/            # Configuración
└── scripts/           # Scripts de utilidad
```

## 📦 Instalación

```bash
# Clonar repositorio
git clone https://github.com/tuckyclaw/cost-dashboard.git
cd cost-dashboard

# Instalar dependencias
npm install

# Iniciar todo el sistema
./quick-start.sh
```

## 🚀 Uso Rápido

```bash
# Método 1: Script completo
./quick-start.sh

# Método 2: Componentes individuales
# Iniciar collector (captura datos de OpenClaw)
node collector/openclaw-collector.js

# Iniciar API
node api/simple-server.js

# Iniciar servidor web
node simple-web-server.js
```

## 🔗 Acceso

- **Dashboard Web:** http://localhost:3000
- **API REST:** http://localhost:3001/api
- **Estado del sistema:** http://localhost:3000/status

## ⚙️ Configuración

### 1. Rutas de OpenClaw
El collector monitorea automáticamente:
- `/root/.openclaw/agents/main/sessions/` (sesiones de OpenClaw)

### 2. Tarifas de modelos
Editar `config/cost-rates.json` con tarifas actualizadas:

```json
{
  "anthropic/claude-opus-4-5-20251101": {
    "input": 0.015,
    "output": 0.075
  },
  "google/gemini-2.5-flash": {
    "input": 0.0005,
    "output": 0.0015
  }
}
```

### 3. Variables de entorno
Crear `.env`:
```bash
OPENCLAW_HOME=/root/.openclaw
API_PORT=3001
WEB_PORT=3000
```

## 📊 Categorización Automática

El sistema categoriza automáticamente las tareas:

| Categoría | Palabras clave |
|-----------|----------------|
| **routine** | heartbeat, calendar, email, check |
| **analysis** | briefing, market, security, research, analysis |
| **development** | code, pr, review, technical, github, jira |
| **strategy** | strategy, brainstorming, planning, decision |
| **content** | linkedin, post, writing, social, content |
| **search** | search, browser, web_search, google |
| **audio** | audio, transcription, voice, tts |

## 🔄 Actualización Automática

El collector:
1. Monitorea el directorio de sesiones en tiempo real
2. Procesa archivos nuevos automáticamente
3. Calcula costos basado en tarifas configuradas
4. Categoriza tareas inteligentemente
5. Genera resumen diario automático

## 📈 API Endpoints

### GET `/api/health`
```json
{
  "status": "healthy",
  "metrics_count": 42,
  "daily_summaries": 7,
  "uptime": 3600.5
}
```

### GET `/api/summary?timeRange=day`
```json
{
  "time_range": "day",
  "total_cost": 1.25,
  "total_tokens": 12500,
  "tasks_by_category": [...],
  "top_models": [...]
}
```

### GET `/api/metrics?limit=10&offset=0`
```json
{
  "metrics": [...],
  "pagination": {
    "total": 42,
    "limit": 10,
    "offset": 0
  }
}
```

## 🐛 Solución de Problemas

### Collector no captura datos
```bash
# Verificar logs
tail -f logs/collector.out

# Verificar permisos
ls -la /root/.openclaw/agents/main/sessions/

# Forzar procesamiento
node collector/openclaw-collector.js --debug
```

### API no responde
```bash
# Verificar puertos
netstat -tlnp | grep :300

# Reiniciar servicios
pkill -f "simple-server"
node api/simple-server.js
```

### Dashboard no carga
```bash
# Verificar servidor web
curl http://localhost:3000/status

# Reiniciar
pkill -f "simple-web-server"
node simple-web-server.js
```

## 📝 Mantenimiento

### Limpieza de logs
```bash
# Rotar logs diariamente
./scripts/rotate-logs.sh
```

### Backup de base de datos
```bash
# Backup automático
./scripts/backup-database.sh
```

### Actualización
```bash
# Pull cambios
git pull origin main

# Reiniciar servicios
./quick-start.sh
```

## 🤝 Contribución

1. Fork el repositorio
2. Crear feature branch (`git checkout -b feature/amazing-feature`)
3. Commit cambios (`git commit -m 'Add amazing feature'`)
4. Push al branch (`git push origin feature/amazing-feature`)
5. Abrir Pull Request

## 📄 Licencia

MIT License - ver LICENSE file para detalles.

## 👤 Autor

**Tucky** - Chief of Staff AI @ Strike
- GitHub: [@tuckyclaw](https://github.com/tuckyclaw)
- Email: tucky@strike.sh

---

*Desarrollado específicamente para OpenClaw - Monitoreo inteligente de costos de IA*