#!/bin/bash
# Script para ejecutar migraciones en orden correcto

set -e

echo "Ejecutando migraciones..."

# Ejecutar schema local (sin Supabase)
psql -v ON_ERROR_STOP=1 --username "$POSTGRES_USER" --dbname "$POSTGRES_DB" < /docker-entrypoint-initdb.d/001_initial_schema_local.sql

echo "Schema local creado ✓"

# Ejecutar migraciones adicionales
psql -v ON_ERROR_STOP=1 --username "$POSTGRES_USER" --dbname "$POSTGRES_DB" < /docker-entrypoint-initdb.d/002_add_product_image.sql
echo "Migración 002 completada ✓"

psql -v ON_ERROR_STOP=1 --username "$POSTGRES_USER" --dbname "$POSTGRES_DB" < /docker-entrypoint-initdb.d/003_add_order_timer.sql
echo "Migración 003 completada ✓"

psql -v ON_ERROR_STOP=1 --username "$POSTGRES_USER" --dbname "$POSTGRES_DB" < /docker-entrypoint-initdb.d/004_add_delivery_deadline.sql
echo "Migración 004 completada ✓"

echo "¡Todas las migraciones completadas!"
