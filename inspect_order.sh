#!/bin/bash
# Script para inspeccionar una orden específica

ORDER_ID="${1:-75200378-338a-40fa-96ed-20be8ba0cdb4}"

DB_CONTAINER=$(docker ps --format '{{.Names}}' | grep -i postgres | head -1)

if [ -z "$DB_CONTAINER" ]; then
  echo "❌ No se encontró el contenedor de PostgreSQL"
  exit 1
fi

echo "🔍 Inspeccionando orden: $ORDER_ID"
echo ""

docker exec -it "$DB_CONTAINER" psql -U dofer_user -d dofer_panel << EOF
-- Información de la orden
SELECT 
  id,
  order_number,
  customer_name,
  status,
  amount,
  amount_paid,
  balance,
  created_at
FROM orders 
WHERE id::text LIKE '%${ORDER_ID}%' OR order_number LIKE '%${ORDER_ID}%';

-- Items de la orden
SELECT 
  'ITEMS:' as section,
  COUNT(*) as total,
  SUM(total_price) as suma_total
FROM order_items
WHERE order_id::text LIKE '%${ORDER_ID}%';

-- Detalle de items
SELECT 
  product_name,
  quantity,
  unit_price,
  total_price,
  is_completed
FROM order_items
WHERE order_id::text LIKE '%${ORDER_ID}%'
ORDER BY created_at;

-- Pagos de la orden
SELECT 
  'PAYMENTS:' as section,
  COUNT(*) as total_pagos,
  SUM(amount) as suma_pagos
FROM order_payments
WHERE order_id::text LIKE '%${ORDER_ID}%';

-- Detalle de pagos
SELECT 
  amount,
  payment_method,
  payment_date,
  notes,
  created_by
FROM order_payments
WHERE order_id::text LIKE '%${ORDER_ID}%'
ORDER BY payment_date DESC;
EOF
