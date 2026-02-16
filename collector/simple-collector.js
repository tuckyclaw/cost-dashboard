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

// Cargar tarifas de costos
const costRates = require('../config/cost-rates.json');

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

// Categorizar tarea
function categorizeTask(content) {
  const contentLower = content.toLowerCase();
  const categories = costRates.taskCategories;
  
  for (const [category, keywords] of Object.entries(categories)) {
    for (const keyword of keywords) {
      if (contentLower.includes(keyword)) {
        return category;
      }
    }
  }
  
  return 'other';
}

// Calcular costo
function calculateCost(model, inputTokens, outputTokens) {
  for (const [provider, providerData] of Object.entries(costRates.providers)) {
    if (providerData.models[model]) {
      const rates = providerData.models[model];
      const cost = 
        (inputTokens / 1000) * rates.input +
        (outputTokens / 1000) * rates.output;
      return {
        cost: parseFloat(cost.toFixed(6)),
        provider: provider
      };
    }
  }
  
  return {
    cost: 0.01,
    provider: 'unknown'
  };
}

// Procesar archivo de sesión
function processSessionFile(filePath, db) {
  try {
    const content = fs.readFileSync(filePath, 'utf8');
    const lines = content.split('\n').filter(line => line.trim());
    
    lines.forEach(line => {
      try {
        const data = JSON.parse(line);
        
        if (data.role === 'assistant' && data.model) {
          const model = data.model;
          const inputTokens = data.usage?.prompt_tokens || data.usage?.input_tokens || 0;
          const outputTokens = data.usage?.completion_tokens || data.usage?.output_tokens || 0;
          const contentText = data.content || '';
          
          // Verificar si ya existe esta métrica (por timestamp y contenido)
          const exists = db.metrics.some(m => 
            m.timestamp === data.timestamp && 
            m.model === model && 
            m.input_tokens === inputTokens
          );
          
          if (!exists && (inputTokens > 0 || outputTokens > 0)) {
            const taskCategory = categorizeTask(contentText);
            const costInfo = calculateCost(model, inputTokens, outputTokens);
            
            const metric = {
              id: db.metrics.length + 1,
              timestamp: data.timestamp || new Date().toISOString(),
              session_id: path.basename(filePath, '.jsonl'),
              model: model,
              provider: costInfo.provider,
              input_tokens: inputTokens,
              output_tokens: outputTokens,
              cost_usd: costInfo.cost,
              task_category: taskCategory,
              task_description: contentText.substring(0, 200)
            };
            
            db.metrics.push(metric);
            logger.debug(`Nueva métrica: ${model} - $${costInfo.cost}`);
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
  logger.info('Iniciando Cost Dashboard Collector (versión simple)...');
  
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
  
  logger.info('Cost Dashboard Collector iniciado correctamente');
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