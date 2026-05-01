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
PGPASSWORD="${DB_PASSWORD}" psql -h "db" -U "${DB_USER}" -d "postgres" -c "SELECT 1 FROM pg_database WHERE datname = '${DB_NAME}';"

DB_EXISTS=$(PGPASSWORD="${DB_PASSWORD}" psql -h "db" -U "${DB_USER}" -d "postgres" -tAc "SELECT 1 FROM pg_database WHERE datname = '${DB_NAME}';" 2>/dev/null || echo "")

if [ -z "$DB_EXISTS" ]; then
  echo "Creating database ${DB_NAME}..."
  PGPASSWORD="${DB_PASSWORD}" psql -h "db" -U "${DB_USER}" -d "postgres" -c "CREATE DATABASE ${DB_NAME};" 2>/dev/null || true
  echo "  Database created"
else
  echo "  Database already exists"
fi

echo ""

# Crear tabla de migraciones si no existe
echo "Creating migrations tracking table..."
PGPASSWORD="${DB_PASSWORD}" psql -h "db" -U "${DB_USER}" -d "${DB_NAME}" -v ON_ERROR_STOP=1 << 'SQL_EOF'
DO $$
BEGIN
    IF to_regclass('public.schema_migrations') IS NOT NULL
       AND NOT EXISTS (
           SELECT 1
           FROM information_schema.columns
           WHERE table_schema = 'public'
             AND table_name = 'schema_migrations'
             AND column_name = 'migration_file'
       ) THEN
        EXECUTE format(
            'ALTER TABLE schema_migrations RENAME TO %I',
            'schema_migrations_legacy_' || to_char(NOW(), 'YYYYMMDDHH24MISS')
        );
    END IF;
END $$;

CREATE TABLE IF NOT EXISTS schema_migrations (
    migration_file VARCHAR(255) PRIMARY KEY,
    applied_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

ALTER TABLE schema_migrations
    ADD COLUMN IF NOT EXISTS applied_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP;
SQL_EOF

if [ $? -eq 0 ]; then
  echo "  Migrations table OK"
else
  echo "ERROR: Failed to create migrations table"
  exit 1
fi

echo ""
echo "Applying migrations..."

# Aplicar solo migraciones pendientes.
for migration_file in /app/migrations/*.sql; do
  if [ -f "$migration_file" ]; then
    filename=$(basename "$migration_file")

    already_applied=$(PGPASSWORD="${DB_PASSWORD}" psql -h "db" -U "${DB_USER}" -d "${DB_NAME}" -tAc \
      "SELECT 1 FROM schema_migrations WHERE migration_file = '${filename}';" 2>/dev/null || echo "")

    if [ "$already_applied" = "1" ]; then
      echo "  [$(date '+%H:%M:%S')] Skipping: $filename (already applied)"
      continue
    fi
    
    echo "  [$(date '+%H:%M:%S')] Processing: $filename"
    
    # Ejecutar la migración sin pipelines para conservar el exit code real de psql.
    echo "    → Executing SQL..."
    output_file=$(mktemp)
    if PGPASSWORD="${DB_PASSWORD}" psql -h "db" -U "${DB_USER}" -d "${DB_NAME}" -v ON_ERROR_STOP=1 -f "$migration_file" > "$output_file" 2>&1; then
      sed -n '1,120p' "$output_file"
      echo "    → Marking as applied..."
      PGPASSWORD="${DB_PASSWORD}" psql -h "db" -U "${DB_USER}" -d "${DB_NAME}" -c \
        "INSERT INTO schema_migrations (migration_file) VALUES ('${filename}') ON CONFLICT DO NOTHING;" > /dev/null 2>&1
      rm -f "$output_file"
      echo "    ✓ SUCCESS"
    else
      echo "    ✗ FAILED"
      cat "$output_file"
      rm -f "$output_file"
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
