#!/bin/sh
set -e

echo "🔄 Running database migrations..."

# Esperar a que PostgreSQL esté listo
until PGPASSWORD=$DB_PASSWORD psql -h "db" -U "$DB_USER" -d "$DB_NAME" -c '\q' 2>/dev/null; do
  echo "⏳ Waiting for PostgreSQL..."
  sleep 2
done

echo "✅ PostgreSQL is ready"

# Crear tabla de migraciones si no existe
PGPASSWORD=$DB_PASSWORD psql -h "db" -U "$DB_USER" -d "$DB_NAME" <<-EOSQL
	CREATE TABLE IF NOT EXISTS schema_migrations (
		id SERIAL PRIMARY KEY,
		migration_file VARCHAR(255) UNIQUE NOT NULL,
		applied_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
	);
EOSQL

echo "📊 Checking applied migrations..."

# Ejecutar cada migración SQL en orden (solo si no se ha aplicado)
for migration_file in /app/migrations/*.sql; do
  if [ -f "$migration_file" ]; then
    filename=$(basename "$migration_file")
    
    # Verificar si ya se aplicó
    already_applied=$(PGPASSWORD=$DB_PASSWORD psql -h "db" -U "$DB_USER" -d "$DB_NAME" -tAc "SELECT COUNT(*) FROM schema_migrations WHERE migration_file = '$filename'")
    
    if [ "$already_applied" = "0" ]; then
      echo "📝 Applying migration: $filename"
      
      if PGPASSWORD=$DB_PASSWORD psql -h "db" -U "$DB_USER" -d "$DB_NAME" -f "$migration_file"; then
        # Marcar como aplicada
        PGPASSWORD=$DB_PASSWORD psql -h "db" -U "$DB_USER" -d "$DB_NAME" -c "INSERT INTO schema_migrations (migration_file) VALUES ('$filename')"
        echo "   ✅ Migration $filename applied successfully"
      else
        echo "   ❌ Migration $filename FAILED!"
        exit 1
      fi
    else
      echo "⏭️  Skipping $filename (already applied)"
    fi
  fi
done

echo "✅ All migrations completed"
echo ""

# Iniciar la aplicación
exec "$@"
