#!/bin/bash

# Quick start script for Cost Dashboard

set -e

echo "🚀 Iniciando Cost Dashboard..."

# Verificar si ya está corriendo
if pgrep -f "node collector/index.js" > /dev/null; then
    echo "⚠️  Collector ya está corriendo"
else
    echo "▶️  Iniciando collector..."
    cd "$(dirname "$0")"
    nohup node collector/index.js > logs/collector.out 2>&1 &
    echo $! > logs/collector.pid
    echo "✅ Collector iniciado (PID: $(cat logs/collector.pid))"
fi

if pgrep -f "node api/server.js" > /dev/null; then
    echo "⚠️  API ya está corriendo"
else
    echo "▶️  Iniciando API..."
    cd "$(dirname "$0")"
    nohup node api/server.js > logs/api.out 2>&1 &
    echo $! > logs/api.pid
    echo "✅ API iniciada (PID: $(cat logs/api.pid))"
fi

echo ""
echo "📊 Dashboard disponible en: http://localhost:3000"
echo "🔗 API disponible en: http://localhost:3001/api"
echo ""
echo "📋 Para iniciar frontend:"
echo "   cd frontend && npm start"
echo ""
echo "📝 Para ver logs:"
echo "   tail -f logs/collector.out"
echo "   tail -f logs/api.out"