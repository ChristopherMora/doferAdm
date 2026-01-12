#!/bin/bash

# Script para iniciar el sistema completo DOFER Panel
# Requiere: Docker o Supabase configurado

echo "🚀 Iniciando DOFER Panel..."

# Colores
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m'

# Verificar Node.js v20
if [ -s "$HOME/.nvm/nvm.sh" ]; then
    source "$HOME/.nvm/nvm.sh"
    nvm use 20 >/dev/null 2>&1
fi

# Función para limpiar al salir
cleanup() {
    echo ""
    echo "🛑 Deteniendo servicios..."
    kill $BACKEND_PID 2>/dev/null
    kill $FRONTEND_PID 2>/dev/null
    exit 0
}

trap cleanup SIGINT SIGTERM

# Iniciar Frontend
echo "🎨 Iniciando Frontend (Next.js)..."
cd dofer-panel-web
npm run dev > /tmp/dofer-frontend.log 2>&1 &
FRONTEND_PID=$!
cd ..

# Esperar un momento para que el frontend inicie
sleep 2

# Verificar si el frontend está corriendo
if ps -p $FRONTEND_PID > /dev/null; then
    echo -e "${GREEN}✓ Frontend iniciado en http://localhost:3000${NC}"
else
    echo -e "${RED}❌ Error al iniciar el frontend${NC}"
    echo "Ver logs en: /tmp/dofer-frontend.log"
fi

# Intentar iniciar Backend (si está disponible la DB)
echo ""
echo "🔧 Intentando iniciar Backend (Go)..."
cd dofer-panel-api

# Verificar si la base de datos está disponible
if go run cmd/api/main.go > /tmp/dofer-backend.log 2>&1 &
then
    BACKEND_PID=$!
    sleep 2
    
    if ps -p $BACKEND_PID > /dev/null; then
        echo -e "${GREEN}✓ Backend iniciado en http://localhost:8080${NC}"
    else
        echo -e "${YELLOW}⚠ Backend no pudo iniciar (probablemente no hay DB)${NC}"
        echo "  Ver logs en: /tmp/dofer-backend.log"
        BACKEND_PID=""
    fi
fi

cd ..

echo ""
echo "================================================"
echo -e "${GREEN}🎉 Sistema en ejecución${NC}"
echo "================================================"
echo ""
if [ -n "$FRONTEND_PID" ]; then
    echo "🎨 Frontend:  http://localhost:3000"
fi
if [ -n "$BACKEND_PID" ]; then
    echo "🔧 Backend:   http://localhost:8080"
    echo "📊 Health:    http://localhost:8080/health"
fi
echo ""
echo "📋 Logs:"
if [ -n "$FRONTEND_PID" ]; then
    echo "   Frontend:  tail -f /tmp/dofer-frontend.log"
fi
if [ -n "$BACKEND_PID" ]; then
    echo "   Backend:   tail -f /tmp/dofer-backend.log"
fi
echo ""
echo "Presiona Ctrl+C para detener todos los servicios"
echo ""

# Mantener el script corriendo
wait
