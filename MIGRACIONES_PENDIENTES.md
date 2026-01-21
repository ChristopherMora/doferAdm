# 🔧 Migraciones Pendientes - Sistema CRM y Nuevas Funcionalidades

## ❗ Problema Identificado

El sistema está mostrando errores 500 en el módulo de **Clientes** porque las nuevas migraciones de base de datos (008-012) **NO se han aplicado** a la base de datos actual.

## 📋 Migraciones Pendientes

Las siguientes migraciones están en el código pero no se han ejecutado:

1. **008_add_payments.sql** - Sistema de pagos para cotizaciones
2. **009_add_order_items.sql** - Items individuales por orden
3. **010_add_quote_templates.sql** - Templates de cotizaciones reutilizables
4. **011_add_printers_autoassignment.sql** - Sistema de impresoras y auto-asignación
5. **012_add_customers_crm.sql** - **CRÍTICO** - Sistema CRM completo de clientes

## 🚀 Solución: Aplicar las Migraciones

### Opción 1: Recrear la Base de Datos (Recomendado para desarrollo)

```bash
cd /home/mora/doferAdm

# Detener los contenedores
docker compose down

# ELIMINAR el volumen de la base de datos (⚠️ BORRA TODOS LOS DATOS)
docker volume rm doferadm_postgres_data

# Iniciar de nuevo (las migraciones se aplicarán automáticamente)
docker compose up -d
```

### Opción 2: Aplicar Migraciones Manualmente (Preserva datos existentes)

```bash
cd /home/mora/doferAdm

# Asegúrate de que Docker esté corriendo
docker compose ps

# Ejecutar el script de migraciones
./apply_new_migrations.sh
```

**Si no tienes `psql` instalado en WSL**, ejecuta las migraciones desde el contenedor:

```bash
# Entrar al contenedor de PostgreSQL
docker compose exec db sh

# Dentro del contenedor, ejecutar las migraciones:
cd /docker-entrypoint-initdb.d

psql -U dofer -d dofer_panel -f 008_add_payments.sql
psql -U dofer -d dofer_panel -f 009_add_order_items.sql
psql -U dofer -d dofer_panel -f 010_add_quote_templates.sql
psql -U dofer -d dofer_panel -f 011_add_printers_autoassignment.sql
psql -U dofer -d dofer_panel -f 012_add_customers_crm.sql

# Salir del contenedor
exit
```

### Opción 3: Aplicar desde el contenedor de la API

```bash
cd /home/mora/doferAdm

# Copiar las migraciones al contenedor
docker compose exec api sh -c "cd /app && psql \$DATABASE_URL -f /app/migrations/008_add_payments.sql"
docker compose exec api sh -c "cd /app && psql \$DATABASE_URL -f /app/migrations/009_add_order_items.sql"
docker compose exec api sh -c "cd /app && psql \$DATABASE_URL -f /app/migrations/010_add_quote_templates.sql"
docker compose exec api sh -c "cd /app && psql \$DATABASE_URL -f /app/migrations/011_add_printers_autoassignment.sql"
docker compose exec api sh -c "cd /app && psql \$DATABASE_URL -f /app/migrations/012_add_customers_crm.sql"
```

## ✅ Verificar que las Migraciones se Aplicaron

Después de aplicar las migraciones, verifica que las tablas existen:

```bash
# Opción 1: Desde WSL (si tienes psql)
PGPASSWORD=dofer_secure_password_change_me psql -h localhost -p 5433 -U dofer -d dofer_panel -c "\dt"

# Opción 2: Desde el contenedor de DB
docker compose exec db psql -U dofer -d dofer_panel -c "\dt"
```

Deberías ver las siguientes **NUEVAS TABLAS**:

- ✅ `payments` - Pagos de cotizaciones
- ✅ `order_items` - Items de órdenes
- ✅ `quote_templates` - Templates de cotizaciones
- ✅ `printers` - Gestión de impresoras
- ✅ `printer_assignments` - Asignaciones automáticas
- ✅ `customers` - **TABLA PRINCIPAL DE CRM**
- ✅ `customer_interactions` - Interacciones con clientes
- ✅ `customer_segments` - Segmentos de clientes

## 🔄 Reiniciar los Servicios

Después de aplicar las migraciones:

```bash
cd /home/mora/doferAdm

# Reiniciar los servicios
docker compose restart api web

# Ver los logs para verificar que todo está bien
docker compose logs -f api
```

## 🎯 Resultado Esperado

Una vez aplicadas las migraciones:

1. ✅ El módulo de **Clientes** funcionará correctamente
2. ✅ Podrás crear, editar y ver clientes
3. ✅ Las estadísticas de clientes se mostrarán
4. ✅ El sistema de pagos estará disponible
5. ✅ Las impresoras podrán ser gestionadas
6. ✅ Los templates de cotizaciones funcionarán

## 📝 Notas Importantes

- ⚠️ La **Opción 1** (recrear base de datos) **BORRARÁ TODOS LOS DATOS**
- ✅ La **Opción 2 y 3** preservan los datos existentes
- 🔧 El archivo `000_init.sh` ya fue actualizado para incluir todas las migraciones
- 🚀 La próxima vez que recrees la base de datos, todas las migraciones se aplicarán automáticamente

## 🐛 Troubleshooting

### Error: "relation customers does not exist"
➡️ Las migraciones no se han aplicado. Sigue las opciones arriba.

### Error: "context deadline exceeded"
➡️ La base de datos no está respondiendo o las migraciones no se aplicaron.

### Error: "password authentication failed"
➡️ Verifica las credenciales en el archivo `.env`
