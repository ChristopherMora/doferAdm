#!/bin/bash

# Script para aplicar las nuevas migraciones manualmente
# Asegúrate de que Docker esté corriendo antes de ejecutar esto

set -e

echo "🔧 Aplicando nuevas migraciones a la base de datos..."

# Configuración
DB_HOST="localhost"
DB_PORT="${DB_PORT:-5433}"
DB_USER="${DB_USER:-dofer}"
DB_PASSWORD="${DB_PASSWORD:-dofer_secure_password_change_me}"
DB_NAME="${DB_NAME:-dofer_panel}"

# Función para ejecutar SQL
run_sql() {
    local file=$1
    echo "📄 Aplicando: $(basename $file)"
    PGPASSWORD=$DB_PASSWORD psql -h $DB_HOST -p $DB_PORT -U $DB_USER -d $DB_NAME -f "$file"
}

# Aplicar migraciones en orden
cd dofer-panel-api/internal/db/migrations

echo ""
echo "Aplicando migración 008: Pagos"
run_sql "008_add_payments.sql"

echo ""
echo "Aplicando migración 009: Items de órdenes"
run_sql "009_add_order_items.sql"

echo ""
echo "Aplicando migración 010: Templates de cotizaciones"
run_sql "010_add_quote_templates.sql"

echo ""
echo "Aplicando migración 011: Impresoras y auto-asignación"
run_sql "011_add_printers_autoassignment.sql"

echo ""
echo "Aplicando migración 012: Sistema CRM de clientes"
run_sql "012_add_customers_crm.sql"

echo ""
echo "✅ ¡Todas las migraciones aplicadas exitosamente!"
echo ""
echo "Para verificar las tablas nuevas, ejecuta:"
echo "PGPASSWORD=$DB_PASSWORD psql -h $DB_HOST -p $DB_PORT -U $DB_USER -d $DB_NAME -c '\dt'"
