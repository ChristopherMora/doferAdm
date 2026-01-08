# DOFER Panel API

API backend del panel administrativo de DOFER construido con Go y Clean Architecture.

## 🚀 Quick Start

### Requisitos
- Go 1.22+
- Docker & Docker Compose (opcional)
- Cuenta de Supabase

### Instalación

1. Clonar variables de entorno:
```bash
cp .env.example .env
```

2. Configurar `.env` con tus credenciales de Supabase

3. Instalar dependencias:
```bash
make deps
```

4. Aplicar migraciones en Supabase:
```bash
# Copia el contenido de internal/db/migrations/001_initial_schema.sql
# y ejecútalo en el SQL Editor de Supabase
```

5. Ejecutar en modo desarrollo:
```bash
make run
```

La API estará disponible en `http://localhost:8080`

## 🏗️ Arquitectura

Seguimos **Clean Architecture** con separación en capas:

```
internal/
├─ platform/          # Infraestructura transversal
│  ├─ config/        # Configuración
│  ├─ logger/        # Logger estructurado
│  ├─ httpserver/    # Servidor HTTP
│  └─ middleware/    # Middlewares (auth, logger)
├─ modules/          # Módulos de dominio
│  ├─ auth/
│  ├─ orders/
│  ├─ products/
│  └─ tracking/
└─ db/
   └─ migrations/    # Migraciones SQL
```

Cada módulo sigue la estructura:
- `domain/`: Entidades y reglas de negocio
- `app/`: Casos de uso
- `infra/`: Repositorios y adaptadores
- `transport/`: HTTP handlers

## 📡 API Endpoints

### Health Check
- `GET /health` - Estado del servicio
- `GET /api/v1/ping` - Ping test

### Auth (próximamente)
- `POST /api/v1/auth/login` - Login
- `GET /api/v1/me` - Usuario actual

### Orders (próximamente)
- `POST /api/v1/orders` - Crear orden
- `GET /api/v1/orders` - Listar órdenes
- `GET /api/v1/orders/:id` - Ver orden
- `PATCH /api/v1/orders/:id/status` - Cambiar estado
- `PATCH /api/v1/orders/:id/assign` - Asignar operador

### Public Tracking (próximamente)
- `GET /api/v1/public/orders/:public_id` - Estado público

## 🧪 Testing

```bash
make test
```

## 🐳 Docker

```bash
# Levantar servicios
make docker-up

# Ver logs
make docker-logs

# Detener
make docker-down
```

## 📝 Comandos Make

```bash
make help        # Ver todos los comandos
make deps        # Instalar dependencias
make run         # Ejecutar API
make build       # Compilar binario
make test        # Ejecutar tests
make clean       # Limpiar archivos
```

## 🔒 Seguridad

- JWT para autenticación
- RBAC (roles: admin, operator, viewer)
- CORS configurado
- Timeouts en requests
- Rate limiting (próximamente)

## 📄 Licencia

Privado - DOFER © 2026
