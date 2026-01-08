# Instrucciones de Setup - DOFER Panel

## 📋 Resumen del Progreso

✅ **Completado:**
- Backend API en Go con Clean Architecture
- Frontend en Next.js con TypeScript y Tailwind
- Docker Compose configurado
- Migraciones SQL creadas
- Estructura de carpetas completa

⏳ **Pendiente:**
- Configurar proyecto en Supabase
- Aplicar migraciones
- Configurar variables de entorno

---

## 🔧 Pasos para Completar el Setup

### 1. Crear Proyecto en Supabase

1. Ve a [https://supabase.com](https://supabase.com)
2. Crea una cuenta o inicia sesión
3. Click en "New Project"
4. Configura:
   - **Name:** dofer-panel
   - **Database Password:** (guarda esta contraseña)
   - **Region:** Elige la más cercana
5. Espera 2-3 minutos a que se cree el proyecto

### 2. Aplicar Migraciones

1. En el dashboard de Supabase, ve a **SQL Editor**
2. Click en "New Query"
3. Copia y pega el contenido de:
   ```
   dofer-panel-api/internal/db/migrations/001_initial_schema.sql
   ```
4. Click en "Run" o presiona `Ctrl + Enter`
5. Verifica que se crearon las tablas:
   - users
   - products
   - orders
   - order_status_history

### 3. Configurar Variables de Entorno

#### Backend (`dofer-panel-api/.env`)

1. En Supabase dashboard, ve a **Settings > API**
2. Copia las siguientes credenciales:

```bash
# En: dofer-panel-api/.env
PORT=8080
ENV=development

# Database URL - Settings > Database > Connection String (URI)
DATABASE_URL=postgresql://postgres:[TU-PASSWORD]@db.[TU-PROYECTO-REF].supabase.co:5432/postgres

# Supabase Config - Settings > API
SUPABASE_URL=https://[TU-PROYECTO-REF].supabase.co
SUPABASE_ANON_KEY=[tu-anon-key]
SUPABASE_SERVICE_ROLE_KEY=[tu-service-role-key]

# JWT Secret - Generar uno aleatorio
JWT_SECRET=[genera-uno-aleatorio]
```

**Generar JWT_SECRET:**
```bash
openssl rand -base64 32
```

#### Frontend (`dofer-panel-web/.env.local`)

```bash
NEXT_PUBLIC_API_URL=http://localhost:8080/api/v1
NEXT_PUBLIC_SUPABASE_URL=https://[TU-PROYECTO-REF].supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=[tu-anon-key]
```

### 4. Probar el Setup

#### Backend:

```bash
cd dofer-panel-api

# Opción 1: Desarrollo directo
make run

# Opción 2: Docker
make docker-up
```

Verifica en tu navegador:
- http://localhost:8080/health (debe responder `{"status":"ok"}`)
- http://localhost:8080/api/v1/ping (debe responder `{"message":"pong"}`)

#### Frontend:

```bash
cd dofer-panel-web
npm run dev
```

Verifica en tu navegador:
- http://localhost:3000 (debe mostrar la landing page de DOFER)

---

## 🐛 Troubleshooting

### Error: "DATABASE_URL is required"
- Verifica que copiaste correctamente la URL de Supabase
- Reemplaza `[TU-PASSWORD]` con tu contraseña real
- Reemplaza `[TU-PROYECTO-REF]` con tu referencia de proyecto

### Error de conexión a base de datos
- Verifica que tu IP esté permitida en Supabase (Settings > Database > Connection pooling)
- Por defecto Supabase permite todas las IPs

### Frontend no se conecta al backend
- Verifica que el backend esté corriendo en puerto 8080
- Verifica CORS en `dofer-panel-api/internal/platform/httpserver/router/router.go`

---

## 📚 Próximos Pasos

Una vez que el setup esté completo:

1. **Implementar módulo Auth** (backend)
   - Login con Supabase
   - Validación JWT
   - Endpoints `/api/v1/auth/login` y `/api/v1/me`

2. **Implementar módulo Orders** (backend)
   - CRUD completo de órdenes
   - Cambio de estados
   - Asignación de operadores

3. **Crear páginas del panel** (frontend)
   - Login
   - Dashboard
   - Listado de órdenes
   - Tracking público

---

## 🔗 Recursos

- **Backend:** `dofer-panel-api/README.md`
- **Frontend:** `dofer-panel-web/README.md`
- **Estado del proyecto:** `PROJECT_STATUS.md`
- **Documentación Supabase:** https://supabase.com/docs
- **Go Chi Router:** https://github.com/go-chi/chi
- **Next.js Docs:** https://nextjs.org/docs

---

**¿Necesitas ayuda?** Revisa los logs:
```bash
# Backend
cd dofer-panel-api && make docker-logs

# Frontend  
cd dofer-panel-web && npm run dev
```
