# Configuración de GitHub para Cost Dashboard

## Pasos para subir el proyecto a GitHub

### 1. Crear repositorio en GitHub

1. Ir a https://github.com/tuckyclaw
2. Click en "New repository"
3. Configurar:
   - **Repository name:** `cost-dashboard`
   - **Description:** `OpenClaw Cost Dashboard - Monitoreo inteligente de costos de modelos de IA`
   - **Visibility:** `Public` (o Private si preferís)
   - **Initialize with README:** `No` (ya tenemos nuestro README.md)
   - **Add .gitignore:** `Node`
   - **License:** `MIT License`

### 2. Configurar Git localmente

```bash
cd /root/.openclaw/workspace/cost-dashboard

# Configurar usuario
git config user.email "tucky@strike.sh"
git config user.name "Tucky"

# Agregar remote (reemplazar TU_TOKEN con token real)
git remote add origin https://TU_TOKEN@github.com/tuckyclaw/cost-dashboard.git

# O usar SSH (si tenés clave configurada)
git remote add origin git@github.com:tuckyclaw/cost-dashboard.git
```

### 3. Subir código

```bash
# Hacer push inicial
git push -u origin main

# Verificar que se subió
git log --oneline
```

### 4. Configurar GitHub Actions (opcional)

El proyecto ya incluye estructura para CI/CD. Solo necesitás habilitar GitHub Actions en el repositorio.

## Token de GitHub Personal

Si necesitás crear un token:

1. Ir a https://github.com/settings/tokens
2. Click en "Generate new token"
3. Seleccionar scopes:
   - `repo` (acceso completo a repositorios)
   - `workflow` (para GitHub Actions)
4. Copiar token y guardarlo en lugar seguro

## Configuración Automática (Script)

Ejecutar este script después de crear el repositorio:

```bash
./scripts/setup-github.sh
```

## Verificación

Para verificar que todo está configurado:

```bash
# Verificar remotes
git remote -v

# Verificar estado
git status

# Probar conexión
git fetch origin
```

## Actualizaciones Futuras

Siempre que hagas cambios:

```bash
# 1. Agregar cambios
git add .

# 2. Commit con mensaje descriptivo
git commit -m "Descripción del cambio"

# 3. Subir a GitHub
git push origin main

# 4. Verificar en GitHub.com
```

## Estructura del Repositorio

```
cost-dashboard/
├── collector/           # Captura datos de OpenClaw
├── api/                # API REST
├── frontend/           # Dashboard web
├── scripts/            # Scripts de utilidad
├── config/             # Configuración
├── database/           # Datos (NO subir a git)
├── logs/               # Logs (NO subir a git)
├── README.md           # Documentación principal
├── package.json        # Dependencias
└── .gitignore          # Archivos a ignorar
```

## Notas Importantes

- **NO subir** `database/` ni `logs/` a GitHub (están en .gitignore)
- **SÍ subir** `config/cost-rates.json` con tarifas de ejemplo
- Mantener `README.md` actualizado con cambios importantes
- Usar commits descriptivos para tracking

## Soporte

Si tenés problemas con GitHub:
1. Verificar token/credenciales
2. Verificar que el repositorio existe
3. Verificar permisos de escritura
4. Contactar a @tuckyclaw en GitHub