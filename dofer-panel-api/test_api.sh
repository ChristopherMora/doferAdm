#!/bin/bash

# Script de testing para DOFER Panel API
# Asegúrate de que el servidor esté corriendo en puerto 9000

BASE_URL="http://localhost:9000"
API_URL="${BASE_URL}/api/v1"
AUTH_HEADER="Authorization: Bearer test-token"

echo "=== DOFER Panel API - Test Suite ==="
echo ""

# Health Check
echo "1. Health Check"
curl -s "${BASE_URL}/health" | jq '.' || curl -s "${BASE_URL}/health"
echo ""

# Crear orden
echo "2. Crear nueva orden"
ORDER_RESPONSE=$(curl -s -X POST \
  -H "${AUTH_HEADER}" \
  -H "Content-Type: application/json" \
  -d '{
    "order_number": "ORD-TEST-001",
    "platform": "tiktok",
    "customer_name": "María González",
    "customer_email": "maria@example.com",
    "customer_phone": "+52 123 456 7890",
    "product_name": "Figura Personalizada Batman",
    "quantity": 1,
    "priority": "urgent",
    "notes": "Entrega urgente - cumpleaños"
  }' \
  "${API_URL}/orders")

ORDER_ID=$(echo $ORDER_RESPONSE | grep -o '"id":"[^"]*"' | head -1 | cut -d'"' -f4)
PUBLIC_ID=$(echo $ORDER_RESPONSE | grep -o '"public_id":"[^"]*"' | head -1 | cut -d'"' -f4)
echo $ORDER_RESPONSE | jq '.' || echo $ORDER_RESPONSE
echo "ORDER_ID: $ORDER_ID"
echo "PUBLIC_ID: $PUBLIC_ID"
echo ""

# Listar órdenes
echo "3. Listar todas las órdenes"
curl -s -H "${AUTH_HEADER}" "${API_URL}/orders" | jq '.' || curl -s -H "${AUTH_HEADER}" "${API_URL}/orders"
echo ""

# Obtener orden específica
echo "4. Obtener orden por ID"
curl -s -H "${AUTH_HEADER}" "${API_URL}/orders/${ORDER_ID}" | jq '.' || curl -s -H "${AUTH_HEADER}" "${API_URL}/orders/${ORDER_ID}"
echo ""

# Actualizar estado
echo "5. Actualizar estado a 'printing'"
curl -s -X PATCH \
  -H "${AUTH_HEADER}" \
  -H "Content-Type: application/json" \
  -d '{"status":"printing"}' \
  "${API_URL}/orders/${ORDER_ID}/status" | jq '.' || curl -s -X PATCH -H "${AUTH_HEADER}" -H "Content-Type: application/json" -d '{"status":"printing"}' "${API_URL}/orders/${ORDER_ID}/status"
echo ""

# Asignar orden
echo "6. Asignar orden a usuario admin"
curl -s -X PATCH \
  -H "${AUTH_HEADER}" \
  -H "Content-Type: application/json" \
  -d '{"user_id":"11111111-1111-1111-1111-111111111111"}' \
  "${API_URL}/orders/${ORDER_ID}/assign" | jq '.' || curl -s -X PATCH -H "${AUTH_HEADER}" -H "Content-Type: application/json" -d '{"user_id":"11111111-1111-1111-1111-111111111111"}' "${API_URL}/orders/${ORDER_ID}/assign"
echo ""

# Tracking público
echo "7. Tracking público (sin autenticación)"
curl -s "${API_URL}/public/orders/${PUBLIC_ID}" | jq '.' || curl -s "${API_URL}/public/orders/${PUBLIC_ID}"
echo ""

# Filtrar órdenes por estado
echo "8. Filtrar órdenes por estado 'printing'"
curl -s -H "${AUTH_HEADER}" "${API_URL}/orders?status=printing" | jq '.' || curl -s -H "${AUTH_HEADER}" "${API_URL}/orders?status=printing"
echo ""

echo "=== Test completado ==="
