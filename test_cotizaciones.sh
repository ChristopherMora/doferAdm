#!/bin/bash

# Script de prueba para el sistema de cotizaciones
# Requiere que el backend esté corriendo en localhost:9000

BASE_URL="http://localhost:9000/api/v1"

echo "======================================"
echo "🧪 Test del Sistema de Cotizaciones"
echo "======================================"
echo ""

# Usar el access_token de supabase del primer usuario
# Para pruebas locales sin autenticación, puedes comentar esta línea
# TOKEN="tu-token-aqui"

echo "📝 Paso 1: Crear una nueva cotización"
echo "--------------------------------------"
QUOTE_RESPONSE=$(curl -s -X POST "$BASE_URL/quotes" \
  -H "Content-Type: application/json" \
  -d '{
    "customer_name": "Juan Pérez",
    "customer_email": "juan.perez@example.com",
    "customer_phone": "5551234567",
    "notes": "Cliente frecuente, descuento aplicado",
    "valid_days": 15
  }')

echo "Respuesta: $QUOTE_RESPONSE"
echo ""

# Extraer el ID de la cotización
QUOTE_ID=$(echo $QUOTE_RESPONSE | grep -o '"id":"[^"]*"' | cut -d'"' -f4)

if [ -z "$QUOTE_ID" ]; then
  echo "❌ Error: No se pudo crear la cotización"
  exit 1
fi

echo "✅ Cotización creada con ID: $QUOTE_ID"
echo ""

echo "📦 Paso 2: Agregar primer item (Maceta pequeña)"
echo "--------------------------------------"
ITEM1_RESPONSE=$(curl -s -X POST "$BASE_URL/quotes/$QUOTE_ID/items" \
  -H "Content-Type: application/json" \
  -d '{
    "product_name": "Maceta decorativa pequeña",
    "description": "Diseño hexagonal con drenaje",
    "weight_grams": 80,
    "print_time_hours": 3.5,
    "quantity": 5,
    "other_costs": 10.0
  }')

echo "Respuesta: $ITEM1_RESPONSE"
echo ""

echo "📦 Paso 3: Agregar segundo item (Figura personalizada)"
echo "--------------------------------------"
ITEM2_RESPONSE=$(curl -s -X POST "$BASE_URL/quotes/$QUOTE_ID/items" \
  -H "Content-Type: application/json" \
  -d '{
    "product_name": "Figura de superhéroe personalizada",
    "description": "Escala 1:10, color rojo",
    "weight_grams": 150,
    "print_time_hours": 8.0,
    "quantity": 2,
    "other_costs": 50.0
  }')

echo "Respuesta: $ITEM2_RESPONSE"
echo ""

echo "🔍 Paso 4: Obtener detalles de la cotización"
echo "--------------------------------------"
QUOTE_DETAILS=$(curl -s "$BASE_URL/quotes/$QUOTE_ID")
echo "Respuesta: $QUOTE_DETAILS"
echo ""

echo "📋 Paso 5: Listar todas las cotizaciones"
echo "--------------------------------------"
ALL_QUOTES=$(curl -s "$BASE_URL/quotes")
echo "Respuesta: $ALL_QUOTES"
echo ""

echo "✅ Paso 6: Aprobar la cotización"
echo "--------------------------------------"
APPROVE_RESPONSE=$(curl -s -X PATCH "$BASE_URL/quotes/$QUOTE_ID/status" \
  -H "Content-Type: application/json" \
  -d '{
    "status": "approved"
  }')

echo "Respuesta: $APPROVE_RESPONSE"
echo ""

echo "🔍 Paso 7: Verificar estado actualizado"
echo "--------------------------------------"
FINAL_QUOTE=$(curl -s "$BASE_URL/quotes/$QUOTE_ID")
echo "Respuesta: $FINAL_QUOTE"
echo ""

echo "======================================"
echo "✨ Pruebas completadas"
echo "======================================"
echo ""
echo "Resumen:"
echo "- Cotización ID: $QUOTE_ID"
echo "- Items agregados: 2"
echo "- Estado final: approved"
echo ""
echo "💡 Abre el frontend en http://localhost:3000/dashboard/quotes"
echo "   para ver la cotización en la interfaz gráfica"
