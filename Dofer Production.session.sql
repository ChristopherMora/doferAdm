-- Ver la orden
SELECT id, order_number, customer_name, amount, amount_paid, balance, status
FROM orders 
WHERE order_number LIKE '%75200378%'
LIMIT 5;

-- Ver los items de esa orden (debería mostrar 14 items)
SELECT order_id, product_name, quantity, unit_price, total_price
FROM order_items
WHERE order_id IN (SELECT id FROM orders WHERE order_number LIKE '%75200378%');

-- Contar items y sumar totales
SELECT 
  COUNT(*) as total_items,
  SUM(total_price) as suma_items
FROM order_items
WHERE order_id IN (SELECT id FROM orders WHERE order_number LIKE '%75200378%');

-- Ver pagos (debería mostrar el pago de $8,000)
SELECT order_id, amount, payment_method, payment_date, notes
FROM order_payments
WHERE order_id IN (SELECT id FROM orders WHERE order_number LIKE '%75200378%');