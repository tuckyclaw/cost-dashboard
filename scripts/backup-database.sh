#!/bin/bash

# Script de backup para la base de datos del dashboard

set -e

BACKUP_DIR="./backups"
TIMESTAMP=$(date +"%Y%m%d_%H%M%S")
BACKUP_FILE="$BACKUP_DIR/cost-dashboard_$TIMESTAMP.json"

echo "🔧 Iniciando backup del dashboard de costos..."

# Crear directorio de backups si no existe
mkdir -p "$BACKUP_DIR"

# Backup de la base de datos de métricas
if [ -f "./database/metrics.json" ]; then
    cp "./database/metrics.json" "$BACKUP_FILE"
    echo "✅ Backup creado: $BACKUP_FILE"
    
    # Comprimir backup anterior (si existe)
    OLD_BACKUP="$BACKUP_DIR/cost-dashboard_$(date -d 'yesterday' +"%Y%m%d")*.json"
    if ls $OLD_BACKUP 1> /dev/null 2>&1; then
        gzip -f $OLD_BACKUP
        echo "✅ Backup anterior comprimido"
    fi
    
    # Mantener solo últimos 7 días de backups
    find "$BACKUP_DIR" -name "cost-dashboard_*.json" -mtime +7 -delete
    find "$BACKUP_DIR" -name "cost-dashboard_*.json.gz" -mtime +30 -delete
    
    echo "📊 Estadísticas del backup:"
    echo "   - Tamaño: $(du -h "$BACKUP_FILE" | cut -f1)"
    echo "   - Métricas: $(jq '.metrics | length' "$BACKUP_FILE")"
    echo "   - Resúmenes diarios: $(jq '.daily_summary | length' "$BACKUP_FILE")"
else
    echo "⚠️  No se encontró la base de datos metrics.json"
fi

# Backup de configuración
if [ -f "./config/cost-rates.json" ]; then
    cp "./config/cost-rates.json" "$BACKUP_DIR/cost-rates_$TIMESTAMP.json"
    echo "✅ Configuración respaldada"
fi

echo "🎉 Backup completado exitosamente!"