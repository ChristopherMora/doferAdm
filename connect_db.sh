#!/bin/bash
# Script para conectarse a la base de datos PostgreSQL

# Buscar el contenedor de la base de datos
DB_CONTAINER=$(docker ps --format '{{.Names}}' | grep -i postgres | head -1)

if [ -z "$DB_CONTAINER" ]; then
  echo "❌ No se encontró el contenedor de PostgreSQL"
  echo "Contenedores activos:"
  docker ps --format "table {{.Names}}\t{{.Status}}"
  exit 1
fi

echo "✅ Conectando a: $DB_CONTAINER"
echo "📊 Base de datos: dofer_panel"
echo ""
echo "Comandos útiles:"
echo "  \\dt              - Ver todas las tablas"
echo "  \\d orders        - Ver estructura de tabla orders"
echo "  \\q               - Salir"
echo ""

# Conectar a la base de datos
docker exec -it "$DB_CONTAINER" psql -U dofer_user -d dofer_panel
