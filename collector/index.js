const fs = require('fs');
const path = require('path');
const chokidar = require('chokidar');
const sqlite3 = require('sqlite3').verbose();
const winston = require('winston');
const moment = require('moment');

// Configuración
const OPENCLAW_HOME = process.env.OPENCLAW_HOME || '/root/.openclaw';
const SESSIONS_PATH = path.join(OPENCLAW_HOME, 'agents/main/sessions');
const LOGS_PATH = path.join(OPENCLAW_HOME, 'logs');
const DB_PATH = path.join(__dirname, '../database/metrics.db');

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

// Base de datos
const db = new sqlite3.Database(DB_PATH);

// Inicializar base de datos
function initDatabase() {
  db.serialize(() => {
    // Tabla de métricas
    db.run(`
      CREATE TABLE IF NOT EXISTS metrics (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        timestamp DATETIME DEFAULT CURRENT_TIMESTAMP,
        session_id TEXT,
        model TEXT,
        provider TEXT,
        input_tokens INTEGER,
        output_tokens INTEGER,
        cache_read_tokens INTEGER,
        cache_write_tokens INTEGER,
        cost_usd REAL,
        task_category TEXT,
        task_description TEXT,
        raw_data TEXT
      )
    `);

    // Tabla de resumen diario
    db.run(`
      CREATE TABLE IF NOT EXISTS daily_summary (
        date DATE PRIMARY KEY,
        total_cost REAL,
        total_tokens INTEGER,
        models_used TEXT,
        tasks_count INTEGER
      )
    `);

    // Índices para búsqueda rápida
    db.run('CREATE INDEX IF NOT EXISTS idx_timestamp ON metrics(timestamp)');
    db.run('CREATE INDEX IF NOT EXISTS idx_model ON metrics(model)');
    db.run('CREATE INDEX IF NOT EXISTS idx_task ON metrics(task_category)');
    
    logger.info('Base de datos inicializada');
  });
}

// Cargar tarifas de costos
const costRates = require('../config/cost-rates.json');

// Categorizar tarea basada en contenido
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

// Calcular costo basado en modelo y tokens
function calculateCost(model, inputTokens, outputTokens, cacheRead = 0, cacheWrite = 0) {
  // Buscar modelo en tarifas
  for (const [provider, providerData] of Object.entries(costRates.providers)) {
    if (providerData.models[model]) {
      const rates = providerData.models[model];
      const cost = 
        (inputTokens / 1000) * rates.input +
        (outputTokens / 1000) * rates.output +
        (cacheRead / 1000) * rates.cacheRead +
        (cacheWrite / 1000) * rates.cacheWrite;
      return {
        cost: parseFloat(cost.toFixed(6)),
        provider: provider
      };
    }
  }
  
  // Modelo no encontrado, estimación conservadora
  logger.warn(`Modelo no encontrado en tarifas: ${model}`);
  return {
    cost: 0.01, // Estimación conservadora
    provider: 'unknown'
  };
}

// Procesar archivo de sesión
function processSessionFile(filePath) {
  try {
    const content = fs.readFileSync(filePath, 'utf8');
    const lines = content.split('\n').filter(line => line.trim());
    
    lines.forEach(line => {
      try {
        const data = JSON.parse(line);
        
        // Extraer información relevante
        const message = data.message || data;
        if (message.role === 'assistant' && message.model) {
          const model = message.model;
          const inputTokens = message.usage?.input || message.usage?.prompt_tokens || message.usage?.input_tokens || data.usage?.input || 0;
          const outputTokens = message.usage?.output || message.usage?.completion_tokens || message.usage?.output_tokens || data.usage?.output || 0;
          const contentText = Array.isArray(message.content) 
            ? message.content.map(c => c.text || '').join(' ')
            : message.content || '';
          
          // Categorizar tarea
          const taskCategory = categorizeTask(contentText);
          
          // Calcular costo
          const costInfo = calculateCost(model, inputTokens, outputTokens);
          
          // Insertar en base de datos
          db.run(
            `INSERT INTO metrics 
             (timestamp, session_id, model, provider, input_tokens, output_tokens, cost_usd, task_category, task_description, raw_data)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
            [
              data.timestamp || new Date().toISOString(),
              path.basename(filePath, '.jsonl'),
              model,
              costInfo.provider,
              inputTokens,
              outputTokens,
              costInfo.cost,
              taskCategory,
              contentText.substring(0, 200), // Primeros 200 chars
              JSON.stringify(message)
            ],
            (err) => {
              if (err) {
                logger.error(`Error insertando métrica: ${err.message}`);
              }
            }
          );
          
          logger.debug(`Procesado: ${model} - ${inputTokens}/${outputTokens} tokens - $${costInfo.cost}`);
        }
      } catch (parseError) {
        // Ignorar líneas no JSON
      }
    });
  } catch (error) {
    logger.error(`Error procesando archivo ${filePath}: ${error.message}`);
  }
}

// Monitorear directorio de sesiones
function watchSessions() {
  logger.info(`Monitoreando sesiones en: ${SESSIONS_PATH}`);
  
  const watcher = chokidar.watch(SESSIONS_PATH, {
    ignored: /(^|[\/\\])\../, // Ignorar archivos ocultos
    persistent: true,
    ignoreInitial: false
  });
  
  // Procesar archivos existentes
  watcher.on('ready', () => {
    logger.info('Procesando archivos existentes...');
    const files = fs.readdirSync(SESSIONS_PATH);
    files.forEach(file => {
      if (file.endsWith('.jsonl')) {
        processSessionFile(path.join(SESSIONS_PATH, file));
      }
    });
  });
  
  // Procesar nuevos archivos
  watcher.on('add', (filePath) => {
    if (filePath.endsWith('.jsonl')) {
      logger.info(`Nuevo archivo detectado: ${filePath}`);
      setTimeout(() => processSessionFile(filePath), 1000); // Esperar a que se complete
    }
  });
  
  // Procesar cambios en archivos existentes
  watcher.on('change', (filePath) => {
    if (filePath.endsWith('.jsonl')) {
      logger.debug(`Archivo modificado: ${filePath}`);
      processSessionFile(filePath);
    }
  });
}

// Generar resumen diario
function generateDailySummary() {
  const today = moment().format('YYYY-MM-DD');
  
  db.get(`
    SELECT 
      SUM(cost_usd) as total_cost,
      SUM(input_tokens + output_tokens) as total_tokens,
      COUNT(DISTINCT model) as models_count,
      COUNT(*) as tasks_count,
      GROUP_CONCAT(DISTINCT model) as models_used
    FROM metrics 
    WHERE DATE(timestamp) = ?
  `, [today], (err, row) => {
    if (err) {
      logger.error(`Error generando resumen: ${err.message}`);
      return;
    }
    
    const summary = {
      date: today,
      total_cost: row.total_cost || 0,
      total_tokens: row.total_tokens || 0,
      models_used: row.models_used || '',
      tasks_count: row.tasks_count || 0
    };
    
    // Insertar o actualizar resumen
    db.run(`
      INSERT OR REPLACE INTO daily_summary (date, total_cost, total_tokens, models_used, tasks_count)
      VALUES (?, ?, ?, ?, ?)
    `, [summary.date, summary.total_cost, summary.total_tokens, summary.models_used, summary.tasks_count]);
    
    logger.info(`Resumen diario ${today}: $${summary.total_cost.toFixed(4)} - ${summary.tasks_count} tareas`);
  });
}

// Iniciar collector
function start() {
  logger.info('Iniciando Cost Dashboard Collector...');
  
  // Crear directorios necesarios
  const dirs = ['../logs', '../database'];
  dirs.forEach(dir => {
    const dirPath = path.join(__dirname, dir);
    if (!fs.existsSync(dirPath)) {
      fs.mkdirSync(dirPath, { recursive: true });
    }
  });
  
  // Inicializar base de datos
  initDatabase();
  
  // Monitorear sesiones
  watchSessions();
  
  // Generar resumen cada día a medianoche
  setInterval(generateDailySummary, 24 * 60 * 60 * 1000);
  generateDailySummary(); // Ejecutar inmediatamente
  
  // También generar resumen cada hora para debugging
  setInterval(() => {
    logger.info('Collector activo y monitoreando...');
  }, 60 * 60 * 1000);
  
  logger.info('Cost Dashboard Collector iniciado correctamente');
}

// Manejar cierre limpio
process.on('SIGINT', () => {
  logger.info('Deteniendo collector...');
  db.close();
  process.exit(0);
});

// Iniciar
if (require.main === module) {
  start();
}

module.exports = { start, calculateCost, categorizeTask };