#!/bin/bash

# Script para crear el repositorio de GitHub y subir el código
# Ejecutar este script DESPUÉS de crear el repositorio manualmente en GitHub

set -e

echo "🚀 Configurando repositorio GitHub para Cost Dashboard..."

# Verificar que estamos en el directorio correcto
if [ ! -f "package.json" ] || [ ! -f "README.md" ]; then
    echo "❌ Error: No estás en el directorio del cost-dashboard"
    exit 1
fi

# Preguntar por el token de GitHub
read -p "🔑 Ingresá tu token de GitHub (ghp_...): " GITHUB_TOKEN

if [ -z "$GITHUB_TOKEN" ]; then
    echo "❌ Error: Se necesita un token de GitHub"
    exit 1
fi

# Configurar remote con token
echo "🔧 Configurando remote con token..."
git remote remove origin 2>/dev/null || true
git remote add origin "https://${GITHUB_TOKEN}@github.com/tuckyclaw/cost-dashboard.git"

# Hacer push
echo "📤 Subiendo código a GitHub..."
if git push -u origin main; then
    echo "✅ ¡Repositorio creado y código subido exitosamente!"
    echo ""
    echo "📊 Resumen:"
    echo "   - Commits subidos: $(git log --oneline | wc -l)"
    echo "   - Archivos: $(find . -type f -not -path "./.git/*" -not -path "./node_modules/*" | wc -l)"
    echo "   - Tamaño: $(du -sh . | cut -f1)"
    echo ""
    echo "🌐 Enlaces:"
    echo "   - Repositorio: https://github.com/tuckyclaw/cost-dashboard"
    echo "   - Dashboard local: http://localhost:3000"
    echo "   - API local: http://localhost:3001/api"
    echo ""
    echo "🔧 Para actualizaciones futuras:"
    echo "   ./scripts/update-github.sh \"Descripción del cambio\""
else
    echo "❌ Error al hacer push"
    echo ""
    echo "🔧 Solución de problemas:"
    echo "   1. Verificar que el repositorio existe: https://github.com/tuckyclaw/cost-dashboard"
    echo "   2. Verificar que el token tenga permisos de escritura"
    echo "   3. Crear el repositorio manualmente primero:"
    echo "      - Ir a https://github.com/tuckyclaw"
    echo "      - Click 'New repository'"
    echo "      - Nombre: cost-dashboard"
    echo "      - NO inicializar con README (ya tenemos)"
    echo "      - Luego ejecutar este script nuevamente"
    exit 1
fi

# Limpiar token de la URL por seguridad
echo "🔒 Limpiando token de la configuración..."
git remote set-url origin "git@github.com:tuckyclaw/cost-dashboard.git"

echo ""
echo "🎉 ¡Configuración completada! El dashboard está listo para usar."
echo "📝 Recordá: Siempre que hagas cambios, ejecutá: ./scripts/update-github.sh"