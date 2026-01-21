#!/bin/sh
set -e

echo "=== Starting API Container ==="
echo "DB_USER: ${DB_USER}"
echo "DB_NAME: ${DB_NAME}"
echo ""

# Esperar a que PostgreSQL esté listo
echo "Waiting for PostgreSQL..."
MAX_RETRIES=30
RETRY_COUNT=0

until PGPASSWORD="${DB_PASSWORD}" psql -h "db" -U "${DB_USER}" -d "${DB_NAME}" -c '\q' 2>/dev/null; do
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

# Aplicar migraciones SQL
for migration_file in /app/migrations/*.sql; do
  if [ -f "$migration_file" ]; then
    filename=$(basename "$migration_file")
    
    # Verificar si ya se aplicó
    already_applied=$(PGPASSWORD="${DB_PASSWORD}" psql -h "db" -U "${DB_USER}" -d "${DB_NAME}" -tAc \
      "SELECT COUNT(*) FROM schema_migrations WHERE migration_file = '${filename}'" 2>/dev/null || echo "0")
    
    if [ "$already_applied" = "0" ] || [ "$already_applied" = "" ]; then
      echo "  Applying: $filename"
      
      if PGPASSWORD="${DB_PASSWORD}" psql -h "db" -U "${DB_USER}" -d "${DB_NAME}" -v ON_ERROR_STOP=1 -f "$migration_file" > /dev/null 2>&1; then
        PGPASSWORD="${DB_PASSWORD}" psql -h "db" -U "${DB_USER}" -d "${DB_NAME}" -c \
          "INSERT INTO schema_migrations (migration_file) VALUES ('${filename}') ON CONFLICT (migration_file) DO NOTHING" > /dev/null 2>&1
        echo "    SUCCESS"
      else
        echo "    FAILED!"
        echo "ERROR: Migration $filename failed"
        exit 1
      fi
    else
      echo "  Skipping: $filename (already applied)"
    fi
  fi
done

echo ""
echo "=== All migrations completed ==="
echo "Starting application..."
echo ""

# Iniciar la aplicación
exec "$@"
