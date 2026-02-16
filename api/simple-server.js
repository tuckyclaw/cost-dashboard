const express = require('express');
const cors = require('cors');
const fs = require('fs');
const path = require('path');
const moment = require('moment');

const app = express();
const PORT = process.env.PORT || 3001;
const DB_PATH = path.join(__dirname, '../database/metrics.json');

// Middleware
app.use(cors());
app.use(express.json());

// Cargar base de datos
function loadDatabase() {
  try {
    if (fs.existsSync(DB_PATH)) {
      return JSON.parse(fs.readFileSync(DB_PATH, 'utf8'));
    }
  } catch (error) {
    console.error(`Error cargando base de datos: ${error.message}`);
  }
  return { metrics: [], daily_summary: {} };
}

// Helper para filtrar por fecha
function filterByDate(metrics, startDate, endDate) {
  return metrics.filter(metric => {
    const metricDate = moment(metric.timestamp);
    if (startDate && metricDate.isBefore(startDate)) return false;
    if (endDate && metricDate.isAfter(endDate)) return false;
    return true;
  });
}

// API Endpoints

// 1. Resumen general
app.get('/api/summary', (req, res) => {
  const { timeRange = 'day' } = req.query;
  const db = loadDatabase();
  
  let startDate, endDate = moment();
  
  switch (timeRange) {
    case 'hour':
      startDate = moment().subtract(1, 'hour');
      break;
    case 'day':
      startDate = moment().subtract(1, 'day');
      break;
    case 'week':
      startDate = moment().subtract(1, 'week');
      break;
    case 'month':
      startDate = moment().subtract(1, 'month');
      break;
    default:
      startDate = moment().subtract(1, 'day');
  }
  
  const filteredMetrics = filterByDate(db.metrics, startDate, endDate);
  
  // Calcular estadísticas
  const total_cost = filteredMetrics.reduce((sum, m) => sum + m.cost_usd, 0);
  const total_tokens = filteredMetrics.reduce((sum, m) => sum + m.input_tokens + m.output_tokens, 0);
  
  // Tareas por categoría
  const tasks_by_category = {};
  filteredMetrics.forEach(m => {
    tasks_by_category[m.task_category] = (tasks_by_category[m.task_category] || 0) + 1;
  });
  
  // Modelos más usados
  const models_usage = {};
  filteredMetrics.forEach(m => {
    if (!models_usage[m.model]) {
      models_usage[m.model] = { count: 0, cost: 0 };
    }
    models_usage[m.model].count++;
    models_usage[m.model].cost += m.cost_usd;
  });
  
  const top_models = Object.entries(models_usage)
    .map(([model, data]) => ({
      model,
      count: data.count,
      cost: data.cost
    }))
    .sort((a, b) => b.cost - a.cost)
    .slice(0, 10);
  
  res.json({
    time_range: timeRange,
    date_range: {
      start: startDate.format('YYYY-MM-DD HH:mm:ss'),
      end: endDate.format('YYYY-MM-DD HH:mm:ss')
    },
    total_cost,
    total_tokens,
    tasks_by_category: Object.entries(tasks_by_category).map(([category, count]) => ({
      task_category: category,
      count
    })),
    top_models
  });
});

// 2. Métricas detalladas
app.get('/api/metrics', (req, res) => {
  const { startDate, endDate, model, taskCategory, limit = 100, offset = 0 } = req.query;
  const db = loadDatabase();
  
  let filteredMetrics = db.metrics;
  
  // Filtrar por fecha
  if (startDate || endDate) {
    const start = startDate ? moment(startDate) : null;
    const end = endDate ? moment(endDate) : null;
    filteredMetrics = filterByDate(filteredMetrics, start, end);
  }
  
  // Filtrar por modelo
  if (model) {
    filteredMetrics = filteredMetrics.filter(m => m.model === model);
  }
  
  // Filtrar por categoría
  if (taskCategory) {
    filteredMetrics = filteredMetrics.filter(m => m.task_category === taskCategory);
  }
  
  // Ordenar por fecha (más reciente primero)
  filteredMetrics.sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));
  
  // Paginación
  const paginated = filteredMetrics.slice(parseInt(offset), parseInt(offset) + parseInt(limit));
  
  res.json({
    metrics: paginated,
    pagination: {
      total: filteredMetrics.length,
      limit: parseInt(limit),
      offset: parseInt(offset)
    }
  });
});

// 3. Tendencias temporales
app.get('/api/trends', (req, res) => {
  const { groupBy = 'day', startDate, endDate } = req.query;
  const db = loadDatabase();
  
  let filteredMetrics = db.metrics;
  
  if (startDate || endDate) {
    const start = startDate ? moment(startDate) : null;
    const end = endDate ? moment(endDate) : null;
    filteredMetrics = filterByDate(filteredMetrics, start, end);
  }
  
  // Agrupar por período
  const trends = {};
  filteredMetrics.forEach(metric => {
    const date = moment(metric.timestamp);
    let period;
    
    switch (groupBy) {
      case 'hour':
        period = date.format('YYYY-MM-DD HH:00:00');
        break;
      case 'day':
        period = date.format('YYYY-MM-DD');
        break;
      case 'week':
        period = date.format('YYYY-WW');
        break;
      case 'month':
        period = date.format('YYYY-MM');
        break;
      default:
        period = date.format('YYYY-MM-DD');
    }
    
    if (!trends[period]) {
      trends[period] = {
        period,
        total_cost: 0,
        total_tokens: 0,
        task_count: 0
      };
    }
    
    trends[period].total_cost += metric.cost_usd;
    trends[period].total_tokens += metric.input_tokens + metric.output_tokens;
    trends[period].task_count++;
  });
  
  const trendsArray = Object.values(trends).sort((a, b) => a.period.localeCompare(b.period));
  
  res.json({
    group_by: groupBy,
    trends: trendsArray
  });
});

// 4. Análisis por modelo
app.get('/api/models', (req, res) => {
  const { startDate, endDate } = req.query;
  const db = loadDatabase();
  
  let filteredMetrics = db.metrics;
  
  if (startDate || endDate) {
    const start = startDate ? moment(startDate) : null;
    const end = endDate ? moment(endDate) : null;
    filteredMetrics = filterByDate(filteredMetrics, start, end);
  }
  
  // Agrupar por modelo
  const models = {};
  filteredMetrics.forEach(metric => {
    if (!models[metric.model]) {
      models[metric.model] = {
        model: metric.model,
        provider: metric.provider,
        task_count: 0,
        total_input_tokens: 0,
        total_output_tokens: 0,
        total_cost: 0
      };
    }
    
    models[metric.model].task_count++;
    models[metric.model].total_input_tokens += metric.input_tokens;
    models[metric.model].total_output_tokens += metric.output_tokens;
    models[metric.model].total_cost += metric.cost_usd;
  });
  
  const modelsArray = Object.values(models)
    .map(m => ({
      ...m,
      avg_cost_per_task: m.total_cost / m.task_count
    }))
    .sort((a, b) => b.total_cost - a.total_cost);
  
  res.json({
    models: modelsArray
  });
});

// 5. Análisis por tarea
app.get('/api/tasks', (req, res) => {
  const { startDate, endDate } = req.query;
  const db = loadDatabase();
  
  let filteredMetrics = db.metrics;
  
  if (startDate || endDate) {
    const start = startDate ? moment(startDate) : null;
    const end = endDate ? moment(endDate) : null;
    filteredMetrics = filterByDate(filteredMetrics, start, end);
  }
  
  // Agrupar por categoría
  const tasks = {};
  filteredMetrics.forEach(metric => {
    if (!tasks[metric.task_category]) {
      tasks[metric.task_category] = {
        task_category: metric.task_category,
        task_count: 0,
        total_cost: 0,
        models_used: new Set(),
        total_tokens: 0
      };
    }
    
    tasks[metric.task_category].task_count++;
    tasks[metric.task_category].total_cost += metric.cost_usd;
    tasks[metric.task_category].models_used.add(metric.model);
    tasks[metric.task_category].total_tokens += metric.input_tokens + metric.output_tokens;
  });
  
  const tasksArray = Object.values(tasks)
    .map(t => ({
      ...t,
      models_used: Array.from(t.models_used).join(', '),
      avg_tokens_per_task: t.total_tokens / t.task_count
    }))
    .sort((a, b) => b.total_cost - a.total_cost);
  
  res.json({
    tasks: tasksArray
  });
});

// 6. Resumen diario
app.get('/api/daily', (req, res) => {
  const { limit = 30 } = req.query;
  const db = loadDatabase();
  
  const dailyArray = Object.values(db.daily_summary)
    .sort((a, b) => b.date.localeCompare(a.date))
    .slice(0, parseInt(limit));
  
  res.json({
    daily_summaries: dailyArray
  });
});

// 7. Health check
app.get('/api/health', (req, res) => {
  const db = loadDatabase();
  res.json({
    status: 'healthy',
    metrics_count: db.metrics.length,
    daily_summaries: Object.keys(db.daily_summary).length,
    uptime: process.uptime()
  });
});

// Iniciar servidor
app.listen(PORT, () => {
  console.log(`Cost Dashboard API (simple) corriendo en http://localhost:${PORT}`);
  console.log('Endpoints disponibles:');
  console.log(`  GET /api/summary?timeRange=day|week|month`);
  console.log(`  GET /api/metrics?startDate=&endDate=&model=&taskCategory=`);
  console.log(`  GET /api/trends?groupBy=hour|day|week|month`);
  console.log(`  GET /api/models`);
  console.log(`  GET /api/tasks`);
  console.log(`  GET /api/daily?limit=30`);
  console.log(`  GET /api/health`);
});

module.exports = app;