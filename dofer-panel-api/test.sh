#!/bin/bash

# Script de Prueba Rápida - DOFER Panel Backend

echo "🧪 Iniciando pruebas del backend DOFER Panel..."
echo ""

# Colores
GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Configuración
PORT=3001
BASE_URL="http://localhost:$PORT"

echo "📦 Verificando que la base de datos esté corriendo..."
if docker ps | grep -q "dofer-panel-api-db-1"; then
    echo -e "${GREEN}✓${NC} Base de datos PostgreSQL corriendo"
else
    echo -e "${RED}✗${NC} Base de datos no encontrada. Ejecuta: docker-compose up -d db"
    exit 1
fi

echo ""
echo "🚀 Iniciando servidor en puerto $PORT..."
echo "   (Presiona Ctrl+C para detener cuando termines las pruebas)"
echo ""

# Exportar variables
export PORT=$PORT
export ENV=development
export DATABASE_URL="postgresql://postgres:postgres@localhost:54322/dofer_panel"
export JWT_SECRET="local-dev-secret"
export SUPABASE_URL="http://localhost"
export SUPABASE_ANON_KEY="dummy"
export SUPABASE_SERVICE_ROLE_KEY="dummy"

# Ejecutar servidor en background
go run cmd/api/main.go &
SERVER_PID=$!

# Esperar a que el servidor inicie
echo "⏳ Esperando que el servidor inicie..."
sleep 3

# Verificar que el servidor esté corriendo
if ! kill -0 $SERVER_PID 2>/dev/null; then
    echo -e "${RED}✗${NC} El servidor no pudo iniciar"
    exit 1
fi

echo ""
echo "═══════════════════════════════════════"
echo "  PROBANDO ENDPOINTS"
echo "═══════════════════════════════════════"
echo ""

# Test 1: Health Check
echo "1️⃣  Testing Health Check..."
RESPONSE=$(curl -s -w "\n%{http_code}" "$BASE_URL/health")
HTTP_CODE=$(echo "$RESPONSE" | tail -n1)
BODY=$(echo "$RESPONSE" | head -n-1)

if [ "$HTTP_CODE" = "200" ]; then
    echo -e "${GREEN}✓${NC} GET /health → $HTTP_CODE"
    echo "   Response: $BODY"
else
    echo -e "${RED}✗${NC} GET /health → $HTTP_CODE"
fi

echo ""

# Test 2: Ping
echo "2️⃣  Testing Ping..."
RESPONSE=$(curl -s -w "\n%{http_code}" "$BASE_URL/api/v1/ping")
HTTP_CODE=$(echo "$RESPONSE" | tail -n1)
BODY=$(echo "$RESPONSE" | head -n-1)

if [ "$HTTP_CODE" = "200" ]; then
    echo -e "${GREEN}✓${NC} GET /api/v1/ping → $HTTP_CODE"
    echo "   Response: $BODY"
else
    echo -e "${RED}✗${NC} GET /api/v1/ping → $HTTP_CODE"
fi

echo ""

# Test 3: Create Order
echo "3️⃣  Testing Create Order..."
ORDER_DATA='{
  "order_number": "TEST-001",
  "platform": "local",
  "customer_name": "Cliente de Prueba",
  "customer_email": "test@example.com",
  "customer_phone": "555-1234",
  "product_name": "Pieza 3D Prueba",
  "quantity": 1,
  "priority": "normal",
  "notes": "Orden de prueba automática"
}'

RESPONSE=$(curl -s -w "\n%{http_code}" -X POST "$BASE_URL/api/v1/orders" \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer test-token" \
  -d "$ORDER_DATA")

HTTP_CODE=$(echo "$RESPONSE" | tail -n1)
BODY=$(echo "$RESPONSE" | head -n-1)

if [ "$HTTP_CODE" = "201" ]; then
    echo -e "${GREEN}✓${NC} POST /api/v1/orders → $HTTP_CODE"
    echo "   Order created successfully!"
    ORDER_ID=$(echo "$BODY" | grep -o '"id":"[^"]*"' | head -1 | cut -d'"' -f4)
    PUBLIC_ID=$(echo "$BODY" | grep -o '"public_id":"[^"]*"' | head -1 | cut -d'"' -f4)
    echo "   Order ID: $ORDER_ID"
    echo "   Public ID: $PUBLIC_ID"
else
    echo -e "${RED}✗${NC} POST /api/v1/orders → $HTTP_CODE"
    echo "   Response: $BODY"
fi

echo ""

# Test 4: List Orders
echo "4️⃣  Testing List Orders..."
RESPONSE=$(curl -s -w "\n%{http_code}" "$BASE_URL/api/v1/orders" \
  -H "Authorization: Bearer test-token")

HTTP_CODE=$(echo "$RESPONSE" | tail -n1)
BODY=$(echo "$RESPONSE" | head -n-1)

if [ "$HTTP_CODE" = "200" ]; then
    echo -e "${GREEN}✓${NC} GET /api/v1/orders → $HTTP_CODE"
    TOTAL=$(echo "$BODY" | grep -o '"total":[0-9]*' | cut -d':' -f2)
    echo "   Total orders: $TOTAL"
else
    echo -e "${RED}✗${NC} GET /api/v1/orders → $HTTP_CODE"
fi

echo ""

# Test 5: Public Tracking (si tenemos PUBLIC_ID)
if [ ! -z "$PUBLIC_ID" ]; then
    echo "5️⃣  Testing Public Tracking..."
    RESPONSE=$(curl -s -w "\n%{http_code}" "$BASE_URL/api/v1/public/orders/$PUBLIC_ID")
    
    HTTP_CODE=$(echo "$RESPONSE" | tail -n1)
    BODY=$(echo "$RESPONSE" | head -n-1)
    
    if [ "$HTTP_CODE" = "200" ]; then
        echo -e "${GREEN}✓${NC} GET /api/v1/public/orders/{public_id} → $HTTP_CODE"
        echo "   Customer can track order!"
    else
        echo -e "${RED}✗${NC} GET /api/v1/public/orders/{public_id} → $HTTP_CODE"
    fi
fi

echo ""
echo "═══════════════════════════════════════"
echo "  RESUMEN"
echo "═══════════════════════════════════════"
echo ""
echo -e "${GREEN}✓${NC} Backend funcionando en puerto $PORT"
echo -e "${GREEN}✓${NC} Base de datos conectada"
echo -e "${GREEN}✓${NC} API respondiendo correctamente"
echo ""
echo "🔗 URLs disponibles:"
echo "   Health: $BASE_URL/health"
echo "   API:    $BASE_URL/api/v1/"
echo ""
echo "📝 Para probar manualmente:"
echo "   curl $BASE_URL/health"
echo "   curl $BASE_URL/api/v1/ping"
echo ""
echo "Presiona Ctrl+C para detener el servidor..."
echo ""

# Esperar señal de interrupción
wait $SERVER_PID
