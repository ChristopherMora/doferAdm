#!/bin/bash
# Script para ejecutar migraciones en orden correcto

set -e

echo "Ejecutando migraciones..."

# Ejecutar schema local (sin Supabase)
psql -v ON_ERROR_STOP=1 --username "$POSTGRES_USER" --dbname "$POSTGRES_DB" < /docker-entrypoint-initdb.d/001_initial_schema_local.sql
echo "Schema local creado ✓"

# Ejecutar migraciones adicionales en orden
psql -v ON_ERROR_STOP=1 --username "$POSTGRES_USER" --dbname "$POSTGRES_DB" < /docker-entrypoint-initdb.d/002_add_product_image.sql
echo "Migración 002 completada ✓"

psql -v ON_ERROR_STOP=1 --username "$POSTGRES_USER" --dbname "$POSTGRES_DB" < /docker-entrypoint-initdb.d/003_add_order_timer.sql
echo "Migración 003 completada ✓"

psql -v ON_ERROR_STOP=1 --username "$POSTGRES_USER" --dbname "$POSTGRES_DB" < /docker-entrypoint-initdb.d/004_add_delivery_deadline.sql
echo "Migración 004 completada ✓"

psql -v ON_ERROR_STOP=1 --username "$POSTGRES_USER" --dbname "$POSTGRES_DB" < /docker-entrypoint-initdb.d/005_add_print_files.sql
echo "Migración 005 completada ✓"

psql -v ON_ERROR_STOP=1 --username "$POSTGRES_USER" --dbname "$POSTGRES_DB" < /docker-entrypoint-initdb.d/006_add_order_history.sql
echo "Migración 006 completada ✓"

psql -v ON_ERROR_STOP=1 --username "$POSTGRES_USER" --dbname "$POSTGRES_DB" < /docker-entrypoint-initdb.d/007_add_quotes.sql
echo "Migración 007 completada ✓"

psql -v ON_ERROR_STOP=1 --username "$POSTGRES_USER" --dbname "$POSTGRES_DB" < /docker-entrypoint-initdb.d/008_add_payments.sql
echo "Migración 008 completada ✓"

psql -v ON_ERROR_STOP=1 --username "$POSTGRES_USER" --dbname "$POSTGRES_DB" < /docker-entrypoint-initdb.d/009_add_order_items.sql
echo "Migración 009 completada ✓"

psql -v ON_ERROR_STOP=1 --username "$POSTGRES_USER" --dbname "$POSTGRES_DB" < /docker-entrypoint-initdb.d/010_add_quote_templates.sql
echo "Migración 010 completada ✓"

psql -v ON_ERROR_STOP=1 --username "$POSTGRES_USER" --dbname "$POSTGRES_DB" < /docker-entrypoint-initdb.d/011_add_printers_autoassignment.sql
echo "Migración 011 completada ✓"

psql -v ON_ERROR_STOP=1 --username "$POSTGRES_USER" --dbname "$POSTGRES_DB" < /docker-entrypoint-initdb.d/012_add_customers_crm.sql
echo "Migración 012 completada ✓"

echo "¡Todas las migraciones completadas!"
