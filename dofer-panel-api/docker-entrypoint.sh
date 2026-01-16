#!/bin/sh
set -e

echo "🔄 Running database migrations..."

# Esperar a que PostgreSQL esté listo
until PGPASSWORD=$DB_PASSWORD psql -h "db" -U "$DB_USER" -d "$DB_NAME" -c '\q' 2>/dev/null; do
  echo "⏳ Waiting for PostgreSQL..."
  sleep 2
done

echo "✅ PostgreSQL is ready"

# Ejecutar cada migración SQL en orden
for migration_file in /app/migrations/*.sql; do
  if [ -f "$migration_file" ]; then
    filename=$(basename "$migration_file")
    echo "📝 Running migration: $filename"
    
    PGPASSWORD=$DB_PASSWORD psql -h "db" -U "$DB_USER" -d "$DB_NAME" -f "$migration_file" || {
      echo "⚠️  Migration $filename failed (might already be applied)"
    }
  fi
done

echo "✅ All migrations completed"

# Iniciar la aplicación
exec "$@"
