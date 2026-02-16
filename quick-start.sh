#!/bin/bash

# Quick start for Cost Dashboard (simple version)

echo "🚀 Iniciando Cost Dashboard Simple..."

# Crear directorios si no existen
mkdir -p logs database

# Iniciar collector
echo "▶️  Iniciando collector..."
cd "$(dirname "$0")"
nohup node collector/simple-collector.js > logs/collector.out 2>&1 &
COLLECTOR_PID=$!
echo $COLLECTOR_PID > logs/collector.pid
echo "✅ Collector iniciado (PID: $COLLECTOR_PID)"

# Iniciar API
echo "▶️  Iniciando API..."
nohup node api/simple-server.js > logs/api.out 2>&1 &
API_PID=$!
echo $API_PID > logs/api.pid
echo "✅ API iniciada (PID: $API_PID)"

# Esperar a que la API esté lista
echo "⏳ Esperando que la API esté lista..."
sleep 3

# Verificar que estén corriendo
if ps -p $COLLECTOR_PID > /dev/null && ps -p $API_PID > /dev/null; then
    echo ""
    echo "🎉 ¡Cost Dashboard funcionando!"
    echo ""
    echo "📊 Dashboard disponible en: http://localhost:3000 (cuando inicies el frontend)"
    echo "🔗 API disponible en: http://localhost:3001/api"
    echo ""
    echo "📋 Para iniciar el frontend:"
    echo "   cd frontend && npm start"
    echo ""
    echo "📝 Para ver logs:"
    echo "   tail -f logs/collector.out"
    echo "   tail -f logs/api.out"
    echo ""
    echo "🛑 Para detener:"
    echo "   kill $COLLECTOR_PID $API_PID"
    echo ""
    echo "🔍 Verificar estado:"
    echo "   curl -s http://localhost:3001/api/health | jq"
else
    echo "❌ Error iniciando servicios. Revisá los logs."
    exit 1
fi