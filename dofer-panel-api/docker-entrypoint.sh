#!/bin/sh
set -e

echo "=== Starting API Container ==="
echo "DB_USER: ${DB_USER}"
echo "DB_NAME: ${DB_NAME}"
echo ""

# Esperar a que PostgreSQL esté listo (conectarse al postgres por defecto primero)
echo "Waiting for PostgreSQL..."
MAX_RETRIES=30
RETRY_COUNT=0

until PGPASSWORD="${DB_PASSWORD}" psql -h "db" -U "${DB_USER}" -d "postgres" -c '\q' 2>/dev/null; do
  RETRY_COUNT=$((RETRY_COUNT+1))
  if [ $RETRY_COUNT -ge $MAX_RETRIES ]; then
    echo "ERROR: PostgreSQL not available after $MAX_RETRIES attempts"
    exit 1
  fi
  echo "  Attempt $RETRY_COUNT/$MAX_RETRIES..."
  sleep 2
done

echo "PostgreSQL is ready!"
echo ""

# Crear la base de datos si no existe
echo "Ensuring database exists..."
PGPASSWORD="${DB_PASSWORD}" psql -h "db" -U "${DB_USER}" -d "postgres" << 'SQL_EOF'
SELECT 1 FROM pg_database WHERE datname = 'dofer_panel';
SQL_EOF

DB_EXISTS=$(PGPASSWORD="${DB_PASSWORD}" psql -h "db" -U "${DB_USER}" -d "postgres" -tAc "SELECT 1 FROM pg_database WHERE datname = 'dofer_panel';" 2>/dev/null || echo "")

if [ -z "$DB_EXISTS" ]; then
  echo "Creating database ${DB_NAME}..."
  PGPASSWORD="${DB_PASSWORD}" psql -h "db" -U "${DB_USER}" -d "postgres" -c "CREATE DATABASE ${DB_NAME};" 2>/dev/null || true
  echo "  Database created"
else
  echo "  Database already exists"
fi

echo ""

# Crear tabla de migraciones
echo "Creating migrations tracking table..."
PGPASSWORD="${DB_PASSWORD}" psql -h "db" -U "${DB_USER}" -d "${DB_NAME}" -v ON_ERROR_STOP=1 << 'SQL_EOF'
CREATE TABLE IF NOT EXISTS schema_migrations (
    id SERIAL PRIMARY KEY,
    migration_file VARCHAR(255) UNIQUE NOT NULL,
    applied_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
SQL_EOF

if [ $? -eq 0 ]; then
  echo "  Migrations table OK"
else
  echo "ERROR: Failed to create migrations table"
  exit 1
fi

echo ""
echo "Applying migrations..."

# Aplicar migraciones SQL usando cat + pipe con logging detallado
for migration_file in /app/migrations/*.sql; do
  if [ -f "$migration_file" ]; then
    filename=$(basename "$migration_file")
    
    echo "  [$(date '+%H:%M:%S')] Processing: $filename"
    
    # Ejecutar la migración usando cat y pipe con stdout redirection
    echo "    → Executing SQL..."
    cat "$migration_file" | PGPASSWORD="${DB_PASSWORD}" psql -h "db" -U "${DB_USER}" -d "${DB_NAME}" -v ON_ERROR_STOP=1 2>&1 | head -5
    migration_exit_code=$?
    
    if [ $migration_exit_code -eq 0 ]; then
      echo "    → Marking as applied..."
      # Marcar como aplicada en la BD
      PGPASSWORD="${DB_PASSWORD}" psql -h "db" -U "${DB_USER}" -d "${DB_NAME}" -c \
        "INSERT INTO schema_migrations (migration_file) VALUES ('${filename}') ON CONFLICT DO NOTHING;" > /dev/null 2>&1
      echo "    ✓ SUCCESS"
    else
      echo "    ✗ FAILED with exit code: $migration_exit_code"
      exit 1
    fi
  fi
done

echo ""
echo "=== All migrations completed ==="
echo "Starting application..."
echo ""

# Iniciar la aplicación
exec "$@"
