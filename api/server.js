const express = require('express');
const cors = require('cors');
const sqlite3 = require('sqlite3').verbose();
const path = require('path');
const moment = require('moment');

const app = express();
const PORT = process.env.PORT || 3001;
const DB_PATH = path.join(__dirname, '../database/metrics.db');

const db = new sqlite3.Database(DB_PATH);

// Middleware
app.use(cors());
app.use(express.json());

// Helper para formatear fechas
function formatDateRange(timeRange) {
  const now = moment();
  
  switch (timeRange) {
    case 'hour':
      return {
        start: now.clone().subtract(1, 'hour').format('YYYY-MM-DD HH:mm:ss'),
        end: now.format('YYYY-MM-DD HH:mm:ss')
      };
    case 'day':
      return {
        start: now.clone().subtract(1, 'day').format('YYYY-MM-DD HH:mm:ss'),
        end: now.format('YYYY-MM-DD HH:mm:ss')
      };
    case 'week':
      return {
        start: now.clone().subtract(1, 'week').format('YYYY-MM-DD HH:mm:ss'),
        end: now.format('YYYY-MM-DD HH:mm:ss')
      };
    case 'month':
      return {
        start: now.clone().subtract(1, 'month').format('YYYY-MM-DD HH:mm:ss'),
        end: now.format('YYYY-MM-DD HH:mm:ss')
      };
    default:
      return {
        start: now.clone().subtract(1, 'day').format('YYYY-MM-DD HH:mm:ss'),
        end: now.format('YYYY-MM-DD HH:mm:ss')
      };
  }
}

// API Endpoints

// 1. Resumen general
app.get('/api/summary', (req, res) => {
  const { timeRange = 'day' } = req.query;
  const dateRange = formatDateRange(timeRange);
  
  const queries = [
    // Costo total
    `SELECT SUM(cost_usd) as total_cost FROM metrics WHERE timestamp BETWEEN ? AND ?`,
    // Tokens totales
    `SELECT SUM(input_tokens + output_tokens) as total_tokens FROM metrics WHERE timestamp BETWEEN ? AND ?`,
    // Tareas por categoría
    `SELECT task_category, COUNT(*) as count FROM metrics WHERE timestamp BETWEEN ? AND ? GROUP BY task_category`,
    // Modelos más usados
    `SELECT model, COUNT(*) as count, SUM(cost_usd) as cost FROM metrics WHERE timestamp BETWEEN ? AND ? GROUP BY model ORDER BY cost DESC LIMIT 10`
  ];
  
  const params = [dateRange.start, dateRange.end];
  
  db.serialize(() => {
    const results = {};
    
    db.get(queries[0], params, (err, row) => {
      if (err) {
        res.status(500).json({ error: err.message });
        return;
      }
      results.total_cost = row.total_cost || 0;
    });
    
    db.get(queries[1], params, (err, row) => {
      if (err) {
        res.status(500).json({ error: err.message });
        return;
      }
      results.total_tokens = row.total_tokens || 0;
    });
    
    db.all(queries[2], params, (err, rows) => {
      if (err) {
        res.status(500).json({ error: err.message });
        return;
      }
      results.tasks_by_category = rows;
    });
    
    db.all(queries[3], params, (err, rows) => {
      if (err) {
        res.status(500).json({ error: err.message });
        return;
      }
      results.top_models = rows;
      res.json({
        time_range: timeRange,
        date_range: dateRange,
        ...results
      });
    });
  });
});

// 2. Métricas detalladas con filtros
app.get('/api/metrics', (req, res) => {
  const {
    startDate,
    endDate,
    model,
    taskCategory,
    minCost,
    maxCost,
    limit = 100,
    offset = 0
  } = req.query;
  
  let query = 'SELECT * FROM metrics WHERE 1=1';
  const params = [];
  
  if (startDate) {
    query += ' AND timestamp >= ?';
    params.push(startDate);
  }
  
  if (endDate) {
    query += ' AND timestamp <= ?';
    params.push(endDate);
  }
  
  if (model) {
    query += ' AND model = ?';
    params.push(model);
  }
  
  if (taskCategory) {
    query += ' AND task_category = ?';
    params.push(taskCategory);
  }
  
  if (minCost) {
    query += ' AND cost_usd >= ?';
    params.push(parseFloat(minCost));
  }
  
  if (maxCost) {
    query += ' AND cost_usd <= ?';
    params.push(parseFloat(maxCost));
  }
  
  query += ' ORDER BY timestamp DESC LIMIT ? OFFSET ?';
  params.push(parseInt(limit), parseInt(offset));
  
  db.all(query, params, (err, rows) => {
    if (err) {
      res.status(500).json({ error: err.message });
      return;
    }
    
    // También obtener el total para paginación
    const countQuery = query.replace('SELECT *', 'SELECT COUNT(*) as total').split('ORDER BY')[0];
    db.get(countQuery, params.slice(0, -2), (countErr, countRow) => {
      if (countErr) {
        res.status(500).json({ error: countErr.message });
        return;
      }
      
      res.json({
        metrics: rows,
        pagination: {
          total: countRow.total,
          limit: parseInt(limit),
          offset: parseInt(offset)
        }
      });
    });
  });
});

// 3. Tendencias temporales
app.get('/api/trends', (req, res) => {
  const { groupBy = 'day', startDate, endDate } = req.query;
  
  let dateFormat;
  switch (groupBy) {
    case 'hour':
      dateFormat = '%Y-%m-%d %H:00:00';
      break;
    case 'day':
      dateFormat = '%Y-%m-%d';
      break;
    case 'week':
      dateFormat = '%Y-%W';
      break;
    case 'month':
      dateFormat = '%Y-%m';
      break;
    default:
      dateFormat = '%Y-%m-%d';
  }
  
  let query = `
    SELECT 
      strftime('${dateFormat}', timestamp) as period,
      SUM(cost_usd) as total_cost,
      SUM(input_tokens + output_tokens) as total_tokens,
      COUNT(*) as task_count
    FROM metrics
    WHERE 1=1
  `;
  
  const params = [];
  
  if (startDate) {
    query += ' AND timestamp >= ?';
    params.push(startDate);
  }
  
  if (endDate) {
    query += ' AND timestamp <= ?';
    params.push(endDate);
  }
  
  query += ` GROUP BY period ORDER BY period`;
  
  db.all(query, params, (err, rows) => {
    if (err) {
      res.status(500).json({ error: err.message });
      return;
    }
    
    res.json({
      group_by: groupBy,
      trends: rows
    });
  });
});

// 4. Análisis por modelo
app.get('/api/models', (req, res) => {
  const { startDate, endDate } = req.query;
  
  let query = `
    SELECT 
      model,
      provider,
      COUNT(*) as task_count,
      SUM(input_tokens) as total_input_tokens,
      SUM(output_tokens) as total_output_tokens,
      SUM(cost_usd) as total_cost,
      AVG(cost_usd) as avg_cost_per_task
    FROM metrics
    WHERE 1=1
  `;
  
  const params = [];
  
  if (startDate) {
    query += ' AND timestamp >= ?';
    params.push(startDate);
  }
  
  if (endDate) {
    query += ' AND timestamp <= ?';
    params.push(endDate);
  }
  
  query += ' GROUP BY model, provider ORDER BY total_cost DESC';
  
  db.all(query, params, (err, rows) => {
    if (err) {
      res.status(500).json({ error: err.message });
      return;
    }
    
    res.json({
      models: rows
    });
  });
});

// 5. Análisis por tarea
app.get('/api/tasks', (req, res) => {
  const { startDate, endDate } = req.query;
  
  let query = `
    SELECT 
      task_category,
      COUNT(*) as task_count,
      SUM(cost_usd) as total_cost,
      GROUP_CONCAT(DISTINCT model) as models_used,
      AVG(input_tokens + output_tokens) as avg_tokens_per_task
    FROM metrics
    WHERE 1=1
  `;
  
  const params = [];
  
  if (startDate) {
    query += ' AND timestamp >= ?';
    params.push(startDate);
  }
  
  if (endDate) {
    query += ' AND timestamp <= ?';
    params.push(endDate);
  }
  
  query += ' GROUP BY task_category ORDER BY total_cost DESC';
  
  db.all(query, params, (err, rows) => {
    if (err) {
      res.status(500).json({ error: err.message });
      return;
    }
    
    res.json({
      tasks: rows
    });
  });
});

// 6. Resumen diario
app.get('/api/daily', (req, res) => {
  const { limit = 30 } = req.query;
  
  const query = `
    SELECT * FROM daily_summary 
    ORDER BY date DESC 
    LIMIT ?
  `;
  
  db.all(query, [parseInt(limit)], (err, rows) => {
    if (err) {
      res.status(500).json({ error: err.message });
      return;
    }
    
    res.json({
      daily_summaries: rows
    });
  });
});

// 7. Estadísticas de proveedores
app.get('/api/providers', (req, res) => {
  const { startDate, endDate } = req.query;
  
  let query = `
    SELECT 
      provider,
      COUNT(*) as task_count,
      SUM(cost_usd) as total_cost,
      COUNT(DISTINCT model) as models_count
    FROM metrics
    WHERE 1=1
  `;
  
  const params = [];
  
  if (startDate) {
    query += ' AND timestamp >= ?';
    params.push(startDate);
  }
  
  if (endDate) {
    query += ' AND timestamp <= ?';
    params.push(endDate);
  }
  
  query += ' GROUP BY provider ORDER BY total_cost DESC';
  
  db.all(query, params, (err, rows) => {
    if (err) {
      res.status(500).json({ error: err.message });
      return;
    }
    
    res.json({
      providers: rows
    });
  });
});

// 8. Health check
app.get('/api/health', (req, res) => {
  db.get('SELECT COUNT(*) as count FROM metrics', (err, row) => {
    if (err) {
      res.status(500).json({ status: 'error', error: err.message });
      return;
    }
    
    res.json({
      status: 'healthy',
      metrics_count: row.count,
      uptime: process.uptime()
    });
  });
});

// Iniciar servidor
app.listen(PORT, () => {
  console.log(`Cost Dashboard API corriendo en http://localhost:${PORT}`);
  console.log('Endpoints disponibles:');
  console.log(`  GET /api/summary?timeRange=day|week|month`);
  console.log(`  GET /api/metrics?startDate=&endDate=&model=&taskCategory=`);
  console.log(`  GET /api/trends?groupBy=hour|day|week|month`);
  console.log(`  GET /api/models`);
  console.log(`  GET /api/tasks`);
  console.log(`  GET /api/daily?limit=30`);
  console.log(`  GET /api/providers`);
  console.log(`  GET /api/health`);
});

module.exports = app;