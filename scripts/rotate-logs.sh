#!/bin/bash

# Script de rotación de logs del dashboard

set -e

LOG_DIR="./logs"
BACKUP_DIR="./logs/backups"
TIMESTAMP=$(date +"%Y%m%d")

echo "📝 Rotando logs del dashboard..."

# Crear directorio de backups de logs
mkdir -p "$BACKUP_DIR"

# Rotar logs si existen
for LOG_FILE in "$LOG_DIR"/*.out "$LOG_DIR"/*.log; do
    if [ -f "$LOG_FILE" ] && [ -s "$LOG_FILE" ]; then
        FILENAME=$(basename "$LOG_FILE")
        BACKUP_FILE="$BACKUP_DIR/${FILENAME%.*}_$TIMESTAMP.${FILENAME##*.}"
        
        # Mover log actual a backup
        mv "$LOG_FILE" "$BACKUP_FILE"
        
        # Crear nuevo log vacío
        touch "$LOG_FILE"
        
        echo "✅ Log rotado: $FILENAME → $(basename "$BACKUP_FILE")"
        echo "   Tamaño: $(du -h "$BACKUP_FILE" | cut -f1)"
        echo "   Líneas: $(wc -l < "$BACKUP_FILE")"
    fi
done

# Comprimir logs antiguos (más de 7 días)
find "$BACKUP_DIR" -name "*.out" -mtime +7 -exec gzip -f {} \;
find "$BACKUP_DIR" -name "*.log" -mtime +7 -exec gzip -f {} \;

# Eliminar logs comprimidos antiguos (más de 30 días)
find "$BACKUP_DIR" -name "*.gz" -mtime +30 -delete

echo "📊 Estadísticas de logs:"
echo "   - Logs activos: $(find "$LOG_DIR" -maxdepth 1 -name "*.out" -o -name "*.log" | wc -l)"
echo "   - Backups de logs: $(find "$BACKUP_DIR" -name "*.*" | wc -l)"
echo "   - Espacio total: $(du -sh "$LOG_DIR" | cut -f1)"

echo "🎉 Rotación de logs completada!"