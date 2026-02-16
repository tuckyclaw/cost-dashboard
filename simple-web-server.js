const express = require('express');
const path = require('path');
const fs = require('fs');

const app = express();
const PORT = 3000;

// Servir archivos estáticos
app.use(express.static(path.join(__dirname)));

// Ruta principal - servir el dashboard
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'simple-dashboard.html'));
});

// Ruta para ver logs
app.get('/logs', (req, res) => {
  const logType = req.query.type || 'collector';
  const logPath = path.join(__dirname, 'logs', `${logType}.out`);
  
  if (fs.existsSync(logPath)) {
    const content = fs.readFileSync(logPath, 'utf8');
    res.type('text/plain').send(content);
  } else {
    res.status(404).send('Log no encontrado');
  }
});

// Ruta para estado del sistema
app.get('/status', (req, res) => {
  const status = {
    timestamp: new Date().toISOString(),
    services: {
      collector: fs.existsSync(path.join(__dirname, 'logs/collector.pid')),
      api: fs.existsSync(path.join(__dirname, 'logs/api.pid')),
      web: true
    },
    database: {
      metrics: 0,
      daily_summaries: 0
    }
  };
  
  // Contar métricas si existe la base de datos
  const dbPath = path.join(__dirname, 'database/metrics.json');
  if (fs.existsSync(dbPath)) {
    try {
      const db = JSON.parse(fs.readFileSync(dbPath, 'utf8'));
      status.database.metrics = db.metrics?.length || 0;
      status.database.daily_summaries = Object.keys(db.daily_summary || {}).length;
    } catch (error) {
      status.database.error = error.message;
    }
  }
  
  res.json(status);
});

// Iniciar servidor
app.listen(PORT, () => {
  console.log(`📊 Dashboard web disponible en: http://localhost:${PORT}`);
  console.log(`🔗 API de métricas en: http://localhost:3001/api`);
  console.log(`📝 Logs disponibles en: http://localhost:${PORT}/logs?type=collector`);
  console.log(`📈 Estado del sistema: http://localhost:${PORT}/status`);
});