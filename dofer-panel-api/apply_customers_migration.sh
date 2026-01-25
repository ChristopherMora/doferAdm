#!/bin/bash
# Script para aplicar migración de customers

echo "🔄 Aplicando migración 014_update_customers_table.sql..."

# Leer variables de entorno o usar valores por defecto
DB_HOST="${DATABASE_HOST:-localhost}"
DB_PORT="${DATABASE_PORT:-5432}"
DB_NAME="${DATABASE_NAME:-dofer_db}"
DB_USER="${DATABASE_USER:-postgres}"

# Aplicar migración
PGPASSWORD="${DATABASE_PASSWORD}" psql \
    -h "$DB_HOST" \
    -p "$DB_PORT" \
    -U "$DB_USER" \
    -d "$DB_NAME" \
    -f internal/db/migrations/014_update_customers_table.sql

if [ $? -eq 0 ]; then
    echo "✅ Migración aplicada exitosamente"
else
    echo "❌ Error al aplicar migración"
    exit 1
fi
