#!/bin/bash

# Script para actualizar el repositorio de GitHub automáticamente

set -e

echo "🔄 Actualizando repositorio GitHub..."

# Verificar que estamos en el directorio correcto
if [ ! -f "package.json" ] || [ ! -f "README.md" ]; then
    echo "❌ Error: No estás en el directorio del cost-dashboard"
    exit 1
fi

# Verificar estado de git
echo "📊 Estado actual de git:"
git status --short

# Preguntar por mensaje de commit
if [ -z "$1" ]; then
    read -p "📝 Mensaje del commit: " COMMIT_MSG
else
    COMMIT_MSG="$1"
fi

# Agregar todos los cambios
echo "📦 Agregando cambios..."
git add .

# Hacer commit
echo "💾 Haciendo commit..."
git commit -m "$COMMIT_MSG" || {
    echo "⚠️  No hay cambios para commitear"
    exit 0
}

# Hacer push
echo "🚀 Subiendo a GitHub..."
if git push origin main; then
    echo "✅ ¡Actualización completada!"
    echo ""
    echo "📈 Resumen:"
    echo "   - Commit: $(git log --oneline -1)"
    echo "   - Rama: main"
    echo "   - Remote: origin"
    echo ""
    echo "🌐 Ver en GitHub: https://github.com/tuckyclaw/cost-dashboard"
else
    echo "❌ Error al hacer push"
    echo ""
    echo "🔧 Solución de problemas:"
    echo "   1. Verificar conexión a internet"
    echo "   2. Verificar credenciales de GitHub"
    echo "   3. Verificar que el repositorio existe"
    echo "   4. Ejecutar: git remote -v"
    exit 1
fi

# Mostrar cambios recientes
echo ""
echo "📋 Últimos 3 commits:"
git log --oneline -3