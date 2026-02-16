const fs = require('fs');
const path = require('path');
const chokidar = require('chokidar');
const winston = require('winston');
const moment = require('moment');

// Configuración
const OPENCLAW_HOME = process.env.OPENCLAW_HOME || '/root/.openclaw';
const SESSIONS_PATH = path.join(OPENCLAW_HOME, 'agents/main/sessions');
const DB_PATH = path.join(__dirname, '../database/metrics.json');

// Logger
const logger = winston.createLogger({
  level: 'info',
  format: winston.format.combine(
    winston.format.timestamp(),
    winston.format.json()
  ),
  transports: [
    new winston.transports.File({ filename: path.join(__dirname, '../logs/collector.log') }),
    new winston.transports.Console()
  ]
});

// Tarifas de costos actualizadas (USD por 1K tokens)
const COST_RATES = {
  'anthropic/claude-opus-4-5-20251101': { input: 0.015, output: 0.075 },
  'anthropic/claude-sonnet-4-5-20251101': { input: 0.003, output: 0.015 },
  'anthropic/claude-haiku-4-5-20251101': { input: 0.0008, output: 0.004 },
  'google/gemini-2.5-flash': { input: 0.0005, output: 0.0015 },
  'openai/codex/gpt-5.2': { input: 0.02, output: 0.08 },
  'openai/gpt-4o-realtime-preview': { input: 0.01, output: 0.03 },
  'deepseek/deepseek-chat': { input: 0.00014, output: 0.00028 },
  'xai/grok-1': { input: 0.001, output: 0.005 },
  'moonshot/kimi-k2.5': { input: 0.0005, output: 0.002 }
};

// Categorizar tarea basado en contenido
function categorizeTask(content) {
  const contentLower = content.toLowerCase();
  
  if (contentLower.includes('heartbeat') || contentLower.includes('calendar') || 
      contentLower.includes('email') || contentLower.includes('check')) {
    return 'routine';
  }
  
  if (contentLower.includes('briefing') || contentLower.includes('market') || 
      contentLower.includes('security') || contentLower.includes('research') ||
      contentLower.includes('analysis')) {
    return 'analysis';
  }
  
  if (contentLower.includes('code') || contentLower.includes('pr') || 
      contentLower.includes('review') || contentLower.includes('technical') ||
      contentLower.includes('github') || contentLower.includes('jira')) {
    return 'development';
  }
  
  if (contentLower.includes('strategy') || contentLower.includes('brainstorming') ||
      contentLower.includes('planning') || contentLower.includes('decision')) {
    return 'strategy';
  }
  
  if (contentLower.includes('linkedin') || contentLower.includes('post') || 
      contentLower.includes('writing') || contentLower.includes('social') ||
      contentLower.includes('content')) {
    return 'content';
  }
  
  if (contentLower.includes('search') || contentLower.includes('browser') ||
      contentLower.includes('web_search') || contentLower.includes('google')) {
    return 'search';
  }
  
  if (contentLower.includes('audio') || contentLower.includes('transcription') ||
      contentLower.includes('voice') || contentLower.includes('tts')) {
    return 'audio';
  }
  
  return 'other';
}

// Calcular costo basado en modelo y tokens
function calculateCost(model, inputTokens, outputTokens) {
  const rates = COST_RATES[model];
  if (!rates) {
    logger.warn(`Modelo no encontrado en tarifas: ${model}`);
    return {
      cost: 0.01, // costo por defecto
      provider: model.split('/')[0] || 'unknown'
    };
  }
  
  const cost = 
    (inputTokens / 1000) * rates.input +
    (outputTokens / 1000) * rates.output;
    
  return {
    cost: parseFloat(cost.toFixed(6)),
    provider: model.split('/')[0]
  };
}

// Cargar base de datos
function loadDatabase() {
  try {
    if (fs.existsSync(DB_PATH)) {
      return JSON.parse(fs.readFileSync(DB_PATH, 'utf8'));
    }
  } catch (error) {
    logger.error(`Error cargando base de datos: ${error.message}`);
  }
  return { metrics: [], daily_summary: {} };
}

// Guardar base de datos
function saveDatabase(db) {
  try {
    fs.writeFileSync(DB_PATH, JSON.stringify(db, null, 2));
  } catch (error) {
    logger.error(`Error guardando base de datos: ${error.message}`);
  }
}

// Procesar archivo de sesión de OpenClaw
function processSessionFile(filePath, db) {
  try {
    const content = fs.readFileSync(filePath, 'utf8');
    const lines = content.split('\n').filter(line => line.trim());
    
    let currentModel = null;
    let currentSessionId = path.basename(filePath, '.jsonl');
    
    lines.forEach(line => {
      try {
        const data = JSON.parse(line);
        
        // Trackear cambios de modelo
        if (data.type === 'model_change' || data.type === 'custom' && data.customType === 'model-snapshot') {
          if (data.provider && data.modelId) {
            currentModel = `${data.provider}/${data.modelId}`;
          }
        }
        
        // Procesar mensajes del asistente
        if (data.type === 'message' && data.role === 'assistant' && currentModel) {
          const usage = data.usage || {};
          const inputTokens = usage.prompt_tokens || usage.input_tokens || 0;
          const outputTokens = usage.completion_tokens || usage.output_tokens || 0;
          const contentText = data.content || '';
          
          // Solo procesar si hay tokens
          if (inputTokens > 0 || outputTokens > 0) {
            // Verificar si ya existe esta métrica
            const exists = db.metrics.some(m => 
              m.timestamp === data.timestamp && 
              m.model === currentModel && 
              m.input_tokens === inputTokens
            );
            
            if (!exists) {
              const taskCategory = categorizeTask(contentText);
              const costInfo = calculateCost(currentModel, inputTokens, outputTokens);
              
              const metric = {
                id: db.metrics.length + 1,
                timestamp: data.timestamp || new Date().toISOString(),
                session_id: currentSessionId,
                model: currentModel,
                provider: costInfo.provider,
                input_tokens: inputTokens,
                output_tokens: outputTokens,
                cost_usd: costInfo.cost,
                task_category: taskCategory,
                task_description: contentText.substring(0, 200)
              };
              
              db.metrics.push(metric);
              logger.debug(`Nueva métrica: ${currentModel} - $${costInfo.cost} - ${taskCategory}`);
            }
          }
        }
      } catch (parseError) {
        // Ignorar líneas no JSON
      }
    });
    
    // Guardar después de procesar
    saveDatabase(db);
  } catch (error) {
    logger.error(`Error procesando archivo ${filePath}: ${error.message}`);
  }
}

// Generar resumen diario
function generateDailySummary(db) {
  const today = moment().format('YYYY-MM-DD');
  const todayMetrics = db.metrics.filter(m => 
    moment(m.timestamp).format('YYYY-MM-DD') === today
  );
  
  const summary = {
    date: today,
    total_cost: todayMetrics.reduce((sum, m) => sum + m.cost_usd, 0),
    total_tokens: todayMetrics.reduce((sum, m) => sum + m.input_tokens + m.output_tokens, 0),
    tasks_count: todayMetrics.length,
    models_used: [...new Set(todayMetrics.map(m => m.model))].join(', ')
  };
  
  db.daily_summary[today] = summary;
  saveDatabase(db);
  
  logger.info(`Resumen diario ${today}: $${summary.total_cost.toFixed(4)} - ${summary.tasks_count} tareas`);
}

// Monitorear directorio de sesiones
function watchSessions(db) {
  logger.info(`Monitoreando sesiones en: ${SESSIONS_PATH}`);
  
  const watcher = chokidar.watch(SESSIONS_PATH, {
    ignored: /(^|[\/\\])\../,
    persistent: true,
    ignoreInitial: false
  });
  
  watcher.on('ready', () => {
    logger.info('Procesando archivos existentes...');
    const files = fs.readdirSync(SESSIONS_PATH);
    files.forEach(file => {
      if (file.endsWith('.jsonl')) {
        processSessionFile(path.join(SESSIONS_PATH, file), db);
      }
    });
  });
  
  watcher.on('add', (filePath) => {
    if (filePath.endsWith('.jsonl')) {
      logger.info(`Nuevo archivo detectado: ${filePath}`);
      setTimeout(() => processSessionFile(filePath, db), 1000);
    }
  });
  
  watcher.on('change', (filePath) => {
    if (filePath.endsWith('.jsonl')) {
      logger.debug(`Archivo modificado: ${filePath}`);
      processSessionFile(filePath, db);
    }
  });
}

// Iniciar collector
function start() {
  logger.info('Iniciando OpenClaw Cost Collector...');
  
  // Cargar base de datos
  const db = loadDatabase();
  
  // Monitorear sesiones
  watchSessions(db);
  
  // Generar resumen cada día a medianoche
  setInterval(() => generateDailySummary(db), 24 * 60 * 60 * 1000);
  generateDailySummary(db); // Ejecutar inmediatamente
  
  // Log cada hora
  setInterval(() => {
    logger.info(`Collector activo. Métricas: ${db.metrics.length}`);
  }, 60 * 60 * 1000);
  
  logger.info('OpenClaw Cost Collector iniciado correctamente');
}

// Manejar cierre limpio
process.on('SIGINT', () => {
  logger.info('Deteniendo collector...');
  process.exit(0);
});

// Iniciar
if (require.main === module) {
  start();
}

module.exports = { start, calculateCost, categorizeTask };