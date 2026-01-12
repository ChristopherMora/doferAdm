#!/bin/bash

echo "🚀 DOFER Panel - Inicio del Sistema"
echo "===================================="
echo ""

# Colores para output
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m' # No Color

# Función para verificar si un comando existe
command_exists() {
    command -v "$1" >/dev/null 2>&1
}

# 1. Verificar requisitos
echo "📋 Verificando requisitos del sistema..."

if ! command_exists go; then
    echo -e "${RED}❌ Go no está instalado${NC}"
    exit 1
fi
echo -e "${GREEN}✓ Go instalado:${NC} $(go version)"

if ! command_exists node; then
    echo -e "${RED}❌ Node.js no está instalado${NC}"
    exit 1
fi
echo -e "${GREEN}✓ Node.js instalado:${NC} $(node --version)"

# Verificar versión de Node.js
NODE_VERSION=$(node --version | cut -d'v' -f2 | cut -d'.' -f1)
if [ "$NODE_VERSION" -lt 20 ]; then
    echo -e "${YELLOW}⚠ Node.js versión $NODE_VERSION detectada. Se requiere v20+${NC}"
    
    if [ -s "$HOME/.nvm/nvm.sh" ]; then
        echo "🔄 Activando Node.js v20 con NVM..."
        source "$HOME/.nvm/nvm.sh"
        
        if ! nvm ls 20 >/dev/null 2>&1; then
            echo "📥 Instalando Node.js v20..."
            nvm install 20
        fi
        nvm use 20
        echo -e "${GREEN}✓ Node.js v20 activado${NC}"
    else
        echo -e "${RED}❌ Por favor instala Node.js v20+ o NVM${NC}"
        exit 1
    fi
fi

echo ""
echo "📦 Instalando dependencias..."

# 2. Backend
echo "🔧 Backend (Go)..."
cd dofer-panel-api
if [ ! -f ".env" ]; then
    echo -e "${YELLOW}⚠ Creando .env desde .env.example${NC}"
    cp .env.example .env
    JWT_SECRET=$(openssl rand -base64 32)
    sed -i "s/your-jwt-secret-here/$JWT_SECRET/" .env
fi
go mod download 2>/dev/null
echo -e "${GREEN}✓ Dependencias de Go instaladas${NC}"
cd ..

# 3. Frontend
echo "🎨 Frontend (Next.js)..."
cd dofer-panel-web
if [ ! -f ".env.local" ]; then
    echo -e "${YELLOW}⚠ Creando .env.local${NC}"
    cat > .env.local << EOF
NEXT_PUBLIC_API_URL=http://localhost:8080/api/v1
NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key
EOF
fi
if [ ! -d "node_modules" ]; then
    npm install
fi
echo -e "${GREEN}✓ Dependencias de npm instaladas${NC}"
cd ..

echo ""
echo "================================================"
echo -e "${GREEN}✅ Sistema listo para ejecutarse${NC}"
echo "================================================"
echo ""
echo "📝 Nota importante:"
echo "   El proyecto requiere una base de datos PostgreSQL."
echo ""
echo "🔧 Opciones para ejecutar:"
echo ""
echo "   Opción 1 - Con Docker (Recomendado):"
echo "   ======================================="
echo "   Si tienes Docker Desktop instalado:"
echo "   $ cd dofer-panel-api"
echo "   $ docker-compose up -d"
echo "   $ go run cmd/api/main.go"
echo ""
echo "   Opción 2 - Con Supabase (Cloud):"
echo "   ======================================="
echo "   1. Crea un proyecto en https://supabase.com"
echo "   2. Copia las credenciales a los archivos .env"
echo "   3. Aplica las migraciones SQL en Supabase"
echo "   4. Ejecuta: ./start.sh"
echo ""
echo "   Opción 3 - Solo Frontend (Sin Backend):"
echo "   ======================================="
echo "   $ cd dofer-panel-web"
echo "   $ npm run dev"
echo "   Abre: http://localhost:3000"
echo ""
echo "📚 Más información:"
echo "   - README.md"
echo "   - SETUP_INSTRUCTIONS.md"
echo ""
