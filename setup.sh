#!/bin/bash

# Setup script for Cost Dashboard

set -e

echo "🚀 Configurando Cost Dashboard para OpenClaw..."

# Verificar Node.js
if ! command -v node &> /dev/null; then
    echo "❌ Node.js no encontrado. Instalá Node.js primero."
    exit 1
fi

# Verificar npm
if ! command -v npm &> /dev/null; then
    echo "❌ npm no encontrado."
    exit 1
fi

# Instalar dependencias del backend
echo "📦 Instalando dependencias del backend..."
cd "$(dirname "$0")"
npm install

# Instalar dependencias del frontend
echo "📦 Instalando dependencias del frontend..."
cd frontend
npm install
cd ..

# Crear directorios necesarios
echo "📁 Creando directorios..."
mkdir -p logs database

# Configurar variables de entorno
echo "🔧 Configurando variables de entorno..."
cat > .env << EOF
OPENCLAW_HOME=/root/.openclaw
NODE_ENV=production
PORT=3001
REACT_APP_API_URL=http://localhost:3001/api
EOF

# Crear servicio systemd para el collector
echo "⚙️  Creando servicio systemd..."
cat > /etc/systemd/system/openclaw-cost-collector.service << EOF
[Unit]
Description=OpenClaw Cost Dashboard Collector
After=network.target

[Service]
Type=simple
User=root
WorkingDirectory=$(pwd)
EnvironmentFile=$(pwd)/.env
ExecStart=/usr/bin/node collector/index.js
Restart=always
RestartSec=10

[Install]
WantedBy=multi-user.target
EOF

# Crear servicio systemd para la API
cat > /etc/systemd/system/openclaw-cost-api.service << EOF
[Unit]
Description=OpenClaw Cost Dashboard API
After=network.target

[Service]
Type=simple
User=root
WorkingDirectory=$(pwd)
EnvironmentFile=$(pwd)/.env
ExecStart=/usr/bin/node api/server.js
Restart=always
RestartSec=10

[Install]
WantedBy=multi-user.target
EOF

# Habilitar y iniciar servicios
echo "🔌 Habilitando servicios..."
systemctl daemon-reload
systemctl enable openclaw-cost-collector
systemctl enable openclaw-cost-api

echo "✅ Instalación completada!"
echo ""
echo "📊 Para iniciar manualmente:"
echo "   Collector:  npm run collector"
echo "   API:        npm run api"
echo "   Frontend:   npm run frontend"
echo "   Todo:       npm run dev"
echo ""
echo "🌐 Dashboard disponible en: http://localhost:3000"
echo "🔗 API disponible en: http://localhost:3001/api"
echo ""
echo "📋 Para iniciar servicios systemd:"
echo "   sudo systemctl start openclaw-cost-collector"
echo "   sudo systemctl start openclaw-cost-api"
echo ""
echo "📝 Para ver logs:"
echo "   sudo journalctl -u openclaw-cost-collector -f"
echo "   sudo journalctl -u openclaw-cost-api -f"