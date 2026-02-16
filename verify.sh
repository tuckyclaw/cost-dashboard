#!/bin/bash

echo "🔍 Verificando Cost Dashboard..."

echo ""
echo "1. ✅ Servicios Activos:"
echo "-----------------------"

# Verificar collector
if ps aux | grep -q "simple-collector.js" | grep -v grep; then
    echo "   ✅ Collector corriendo"
else
    echo "   ❌ Collector NO corriendo"
fi

# Verificar API
if curl -s http://localhost:3001/api/health > /dev/null; then
    echo "   ✅ API corriendo"
    curl -s http://localhost:3001/api/health | jq -r '. | "      Métricas: \(.metrics_count), Resúmenes: \(.daily_summaries)"'
else
    echo "   ❌ API NO corriendo"
fi

# Verificar dashboard web
if curl -s http://localhost:3000/status > /dev/null; then
    echo "   ✅ Dashboard web corriendo"
else
    echo "   ❌ Dashboard web NO corriendo"
fi

echo ""
echo "2. 📊 Datos Recolectados:"
echo "------------------------"

# Verificar base de datos
DB_PATH="/root/.openclaw/workspace/cost-dashboard/database/metrics.json"
if [ -f "$DB_PATH" ]; then
    METRICS_COUNT=$(jq '.metrics | length' "$DB_PATH" 2>/dev/null || echo "0")
    DAILY_COUNT=$(jq '.daily_summary | length' "$DB_PATH" 2>/dev/null || echo "0")
    echo "   ✅ Base de datos: $METRICS_COUNT métricas, $DAILY_COUNT resúmenes diarios"
else
    echo "   ❌ Base de datos no encontrada"
fi

# Verificar logs
echo ""
echo "3. 📝 Logs:"
echo "----------"
LOGS_DIR="/root/.openclaw/workspace/cost-dashboard/logs"
if [ -d "$LOGS_DIR" ]; then
    echo "   ✅ Directorio de logs existe"
    ls -la "$LOGS_DIR" | grep -E "\.(out|log|pid)$" | awk '{print "      " $9 " (" $5 " bytes)"}'
else
    echo "   ❌ Directorio de logs no existe"
fi

echo ""
echo "4. 🌐 URLs de Acceso:"
echo "-------------------"
echo "   📊 Dashboard:      http://localhost:3000"
echo "   🔗 API:            http://localhost:3001/api"
echo "   📈 Estado:         http://localhost:3000/status"
echo "   📝 Logs Collector: http://localhost:3000/logs?type=collector"

echo ""
echo "5. 🔄 Probar Endpoints:"
echo "---------------------"

# Probar endpoints principales
echo "   • /api/summary:"
curl -s "http://localhost:3001/api/summary?timeRange=day" | jq -r '"      Costo: \(.total_cost | tostring), Tareas: \(.tasks_by_category | length)"' 2>/dev/null || echo "      ❌ Error"

echo "   • /api/models:"
curl -s "http://localhost:3001/api/models" | jq -r '"      Modelos: \(.models | length)"' 2>/dev/null || echo "      ❌ Error"

echo "   • /api/daily:"
curl -s "http://localhost:3001/api/daily?limit=5" | jq -r '"      Resúmenes: \(.daily_summaries | length)"' 2>/dev/null || echo "      ❌ Error"

echo ""
echo "6. 🎯 Próximos Pasos:"
echo "-------------------"
echo "   1. Acceder a http://localhost:3000 en tu navegador"
echo "   2. Seleccionar período de tiempo (hora/día/semana/mes)"
echo "   3. Explorar gráficos y tablas"
echo "   4. Exportar datos a CSV si es necesario"
echo "   5. Configurar alertas (fase 2)"

echo ""
echo "🎉 ¡Verificación completada! El dashboard está listo para usar."