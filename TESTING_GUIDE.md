# 🧪 Guía de Pruebas - DOFER Panel

## Opción 1: Prueba Rápida Sin Supabase (Solo Backend)

### Paso 1: Levantar Base de Datos Local

```bash
cd dofer-panel-api
docker-compose up -d db
```

Esto levanta PostgreSQL en `localhost:54322`

### Paso 2: Actualizar .env para DB Local

```bash
# En dofer-panel-api/.env
PORT=8080
ENV=development
DATABASE_URL=postgresql://postgres:postgres@localhost:54322/dofer_panel
JWT_SECRET=test-secret-key-for-development
SUPABASE_URL=http://localhost:8080
SUPABASE_ANON_KEY=dummy
SUPABASE_SERVICE_ROLE_KEY=dummy
```

### Paso 3: Aplicar Migraciones

```bash
# Conectarse a la base de datos
docker exec -it dofer-panel-api-db-1 psql -U postgres -d dofer_panel

# Copiar y pegar el contenido de:
# internal/db/migrations/001_initial_schema.sql
# Luego salir con \q
```

O usando archivo directamente:
```bash
docker exec -i dofer-panel-api-db-1 psql -U postgres -d dofer_panel < internal/db/migrations/001_initial_schema.sql
```

### Paso 4: Ejecutar Backend

```bash
cd dofer-panel-api
make run
```

Deberías ver:
```
level=INFO msg="database connection established"
level=INFO msg="starting server" port=8080 env=development
```

### Paso 5: Probar Endpoints

**Health Check:**
```bash
curl http://localhost:8080/health
# Respuesta: {"env":"development","status":"ok"}
```

**Ping:**
```bash
curl http://localhost:8080/api/v1/ping
# Respuesta: {"message":"pong"}
```

---

## Opción 2: Prueba Completa con Datos de Prueba

### Insertar Usuario de Prueba

```bash
docker exec -it dofer-panel-api-db-1 psql -U postgres -d dofer_panel
```

```sql
-- Crear usuario de prueba
INSERT INTO users (id, email, full_name, role, created_at, updated_at)
VALUES (
  'test-user-123',
  'admin@dofer.com',
  'Admin DOFER',
  'admin',
  NOW(),
  NOW()
);
```

### Crear Orden de Prueba

```bash
curl -X POST http://localhost:8080/api/v1/orders \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer dummy-token" \
  -d '{
    "order_number": "ORD-001",
    "platform": "local",
    "customer_name": "Juan Pérez",
    "customer_email": "juan@example.com",
    "customer_phone": "555-1234",
    "product_name": "Pieza 3D Custom",
    "quantity": 2,
    "priority": "normal",
    "notes": "Cliente solicita color rojo"
  }'
```

**Respuesta esperada:**
```json
{
  "id": "uuid-generado",
  "public_id": "uuid-publico",
  "order_number": "ORD-001",
  "platform": "local",
  "status": "new",
  "priority": "normal",
  "customer_name": "Juan Pérez",
  "product_name": "Pieza 3D Custom",
  "quantity": 2,
  "created_at": "2026-01-08T..."
}
```

### Listar Órdenes

```bash
curl http://localhost:8080/api/v1/orders \
  -H "Authorization: Bearer dummy-token"
```

### Cambiar Estado de Orden

```bash
curl -X PATCH http://localhost:8080/api/v1/orders/{ORDER_ID}/status \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer dummy-token" \
  -d '{"status": "printing"}'
```

### Ver Tracking Público (sin auth)

```bash
curl http://localhost:8080/api/v1/public/orders/{PUBLIC_ID}
```

---

## Opción 3: Prueba con Supabase Real

### 1. Crear Proyecto Supabase

1. Ve a https://supabase.com
2. Click en "New Project"
3. Configura:
   - Name: `dofer-panel`
   - Database Password: (guarda esto)
   - Region: Más cercana

### 2. Ejecutar Migraciones

1. En Supabase Dashboard → SQL Editor
2. Copia contenido de `internal/db/migrations/001_initial_schema.sql`
3. Click "Run"

### 3. Obtener Credenciales

En Supabase Dashboard → Settings → API:
- **URL**: `https://xxx.supabase.co`
- **anon key**: `eyJhbGc...`
- **service_role key**: `eyJhbGc...`

En Settings → Database → Connection String:
- **URI**: `postgresql://postgres:[PASSWORD]@db.xxx.supabase.co:5432/postgres`

### 4. Actualizar .env

```bash
# dofer-panel-api/.env
PORT=8080
ENV=development
DATABASE_URL=postgresql://postgres:[TU-PASSWORD]@db.xxx.supabase.co:5432/postgres
SUPABASE_URL=https://xxx.supabase.co
SUPABASE_ANON_KEY=eyJhbGc...
SUPABASE_SERVICE_ROLE_KEY=eyJhbGc...
JWT_SECRET=$(openssl rand -base64 32)
```

### 5. Reiniciar Backend

```bash
cd dofer-panel-api
make run
```

---

## Probar Frontend

### 1. Configurar Variables

```bash
# dofer-panel-web/.env.local
NEXT_PUBLIC_API_URL=http://localhost:8080/api/v1
NEXT_PUBLIC_SUPABASE_URL=https://xxx.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJhbGc...
```

### 2. Ejecutar

```bash
cd dofer-panel-web
npm run dev
```

### 3. Abrir Navegador

- Frontend: http://localhost:3000
- Deberías ver la landing page de DOFER

---

## Herramientas Recomendadas

### 1. Postman / Insomnia

Importa esta colección:

```json
{
  "name": "DOFER Panel API",
  "requests": [
    {
      "name": "Health Check",
      "method": "GET",
      "url": "http://localhost:8080/health"
    },
    {
      "name": "Create Order",
      "method": "POST",
      "url": "http://localhost:8080/api/v1/orders",
      "headers": {
        "Authorization": "Bearer dummy-token",
        "Content-Type": "application/json"
      },
      "body": {
        "order_number": "ORD-001",
        "platform": "local",
        "customer_name": "Test User",
        "product_name": "Test Product",
        "quantity": 1
      }
    },
    {
      "name": "List Orders",
      "method": "GET",
      "url": "http://localhost:8080/api/v1/orders",
      "headers": {
        "Authorization": "Bearer dummy-token"
      }
    }
  ]
}
```

### 2. VS Code REST Client

Crea archivo `test.http`:

```http
### Health Check
GET http://localhost:8080/health

### Ping
GET http://localhost:8080/api/v1/ping

### Create Order
POST http://localhost:8080/api/v1/orders
Authorization: Bearer dummy-token
Content-Type: application/json

{
  "order_number": "ORD-001",
  "platform": "local",
  "customer_name": "Juan Pérez",
  "customer_email": "juan@example.com",
  "product_name": "Pieza Custom",
  "quantity": 2,
  "priority": "normal"
}

### List Orders
GET http://localhost:8080/api/v1/orders
Authorization: Bearer dummy-token

### List Orders - Filter by status
GET http://localhost:8080/api/v1/orders?status=new
Authorization: Bearer dummy-token

### Update Order Status
PATCH http://localhost:8080/api/v1/orders/{ORDER_ID}/status
Authorization: Bearer dummy-token
Content-Type: application/json

{
  "status": "printing"
}

### Public Tracking (no auth required)
GET http://localhost:8080/api/v1/public/orders/{PUBLIC_ID}
```

---

## Troubleshooting

### Error: "DATABASE_URL is required"
- Verifica que `.env` exista y tenga `DATABASE_URL`
- Ejecuta: `source .env && make run`

### Error: "unable to connect to database"
- Si usas Docker local: `docker-compose up -d db`
- Si usas Supabase: verifica URL y password

### Error: "table does not exist"
- No aplicaste las migraciones
- Ejecuta el SQL en Postgres/Supabase

### Backend no inicia
```bash
# Ver logs
cd dofer-panel-api
make run

# O con Docker
docker-compose logs -f api
```

### Frontend no conecta con backend
- Verifica que backend esté en puerto 8080
- Revisa CORS en `router.go`
- Verifica `.env.local` en frontend

---

## Scripts Útiles

### Reset Base de Datos Local

```bash
cd dofer-panel-api
docker-compose down -v
docker-compose up -d db
sleep 3
docker exec -i dofer-panel-api-db-1 psql -U postgres -d dofer_panel < internal/db/migrations/001_initial_schema.sql
```

### Ver Logs en Tiempo Real

```bash
# Backend
cd dofer-panel-api && make run

# DB
docker-compose logs -f db

# Frontend
cd dofer-panel-web && npm run dev
```

### Ejecutar Todo con Docker

```bash
cd dofer-panel-api
docker-compose up --build
```

---

## Checklist de Pruebas

- [ ] Backend inicia sin errores
- [ ] `/health` responde OK
- [ ] `/api/v1/ping` responde "pong"
- [ ] Puedo crear una orden
- [ ] Puedo listar órdenes
- [ ] Puedo cambiar estado de orden
- [ ] Tracking público funciona
- [ ] Frontend carga en localhost:3000
- [ ] No hay errores en consola del navegador

---

**¿Problemas?** Revisa logs con `make run` o `docker-compose logs -f`
